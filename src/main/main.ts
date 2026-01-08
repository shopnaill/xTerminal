import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { TerminalSession } from './terminal';
import { SessionManager, Session } from './session';
import { SFTPManager } from './sftp';
import { SettingsManager } from './settings';
import { GitAuthManager } from './git-auth';
import { GeminiApiService, ChatMessage } from './gemini-api';
import { UpdateService } from './update-service';

let mainWindow: BrowserWindow | null = null;
const terminals = new Map<string, TerminalSession>();
const sessionManager = new SessionManager();
const sftpManager = new SFTPManager();
const settingsManager = new SettingsManager();
const gitAuthManager = new GitAuthManager(settingsManager);
const geminiApiService = new GeminiApiService();
const updateService = new UpdateService(settingsManager);

// Initialize Gemini API service with token if available
async function initializeGeminiService(): Promise<void> {
  try {
    const token = await settingsManager.getGeminiToken();
    if (token) {
      geminiApiService.setApiKey(token);
    }
  } catch (error) {
    console.error('Failed to initialize Gemini service:', error);
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'default',
    title: 'X Engine Terminal',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    
    // Set main window for update service
    if (mainWindow) {
      updateService.setMainWindow(mainWindow);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Clean up all terminals
    terminals.forEach((terminal) => terminal.destroy());
    terminals.clear();
  });
}

app.whenReady().then(() => {
  initializeGeminiService();
  createWindow();
  
  // Initialize update service with main window
  if (mainWindow) {
    updateService.setMainWindow(mainWindow);
    
    // Check for updates after a delay (let app initialize first)
    // Only check if app is packaged (not in development)
    if (app.isPackaged) {
      setTimeout(() => {
        updateService.checkForUpdates(false).catch(err => {
          console.error('Auto-update check failed:', err);
        });
      }, 5000); // Wait 5 seconds after app startup
    } else {
      console.log('Skipping auto-update check in development mode');
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      if (mainWindow) {
        updateService.setMainWindow(mainWindow);
      }
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers - Terminal Operations
ipcMain.handle('terminal:create', async (event, id: string, cols: number, rows: number, sessionId?: string, password?: string) => {
  let terminal: TerminalSession;
  let session: Session | undefined;

  if (sessionId) {
    // Create terminal from saved session
    session = sessionManager.getSession(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Get password from keyring if not provided
    // Try to get password even if keyPath exists, as it might be needed as fallback
    if (!password && session.type === 'ssh') {
      try {
        const passwordResult = await sessionManager.getPassword(sessionId);
        password = passwordResult || undefined;
        console.log(`Password retrieved from keyring: ${password ? 'yes' : 'no'}`);
      } catch (error) {
        console.error('Failed to retrieve password from keyring:', error);
        password = undefined;
      }
    }

    // Update last used timestamp
    sessionManager.updateLastUsed(sessionId);

    terminal = new TerminalSession(id, 'powershell.exe', session, gitAuthManager, geminiApiService);
  } else {
    // Create local terminal
    let shell: string;
    if (process.platform === 'win32') {
      shell = 'powershell.exe';
    } else {
      shell = process.env.SHELL || '/bin/bash';
    }
    terminal = new TerminalSession(id, shell, undefined, gitAuthManager, geminiApiService);
  }

  terminal.on('data', (data: string) => {
    mainWindow?.webContents.send('terminal:data', id, data);
  });

  terminal.on('exit', (info: { code: number; signal?: number }) => {
    mainWindow?.webContents.send('terminal:exit', id, info);
    terminals.delete(id);
  });

  terminal.on('error', (error: Error) => {
    mainWindow?.webContents.send('terminal:error', id, error.message);
  });

  // Register SFTP client when ready for SSH sessions
  if (session && session.type === 'ssh') {
    terminal.on('sftp-ready', () => {
      const sftp = terminal.getSFTPClient();
      if (sftp) {
        console.log(`SFTP client registered for terminal ${id}`);
        sftpManager.registerTerminal(id, sftp);
        // Notify renderer that SFTP is ready
        mainWindow?.webContents.send('sftp:ready', id);
      } else {
        console.error(`SFTP client is null for terminal ${id}`);
      }
    });
  }

  terminal.start(cols, rows, password);
  terminals.set(id, terminal);
  return { success: true };
});

ipcMain.handle('terminal:write', (event, id: string, data: string) => {
  const terminal = terminals.get(id);
  if (terminal) {
    terminal.write(data);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

ipcMain.handle('terminal:resize', (event, id: string, cols: number, rows: number) => {
  const terminal = terminals.get(id);
  if (terminal) {
    terminal.resize(cols, rows);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

ipcMain.handle('terminal:destroy', async (event, id: string) => {
  const terminal = terminals.get(id);
  if (terminal) {
    terminal.destroy();
    terminals.delete(id);
    sftpManager.unregisterTerminal(id);
    return { success: true };
  }
  return { success: false, error: 'Terminal not found' };
});

// SFTP IPC Handlers
ipcMain.handle('sftp:list', async (event, terminalId: string, path: string) => {
  try {
    const files = await sftpManager.listDirectory(terminalId, path);
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('sftp:readFile', async (event, terminalId: string, path: string) => {
  try {
    const data = await sftpManager.readFile(terminalId, path);
    // Electron IPC has a message size limit (~100MB), check before sending
    const MAX_IPC_SIZE = 100 * 1024 * 1024; // 100MB
    if (data.length > MAX_IPC_SIZE) {
      return { 
        success: false, 
        error: `File too large (${(data.length / 1024 / 1024).toFixed(2)}MB). Maximum size for read is 100MB. Use download instead.` 
      };
    }
    return { success: true, data: data.toString('base64') };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('sftp:writeFile', async (event, terminalId: string, path: string, data: string | Buffer) => {
  try {
    await sftpManager.writeFile(terminalId, path, data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('sftp:mkdir', async (event, terminalId: string, path: string) => {
  try {
    await sftpManager.mkdir(terminalId, path);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('sftp:delete', async (event, terminalId: string, path: string) => {
  try {
    await sftpManager.delete(terminalId, path);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('sftp:rename', async (event, terminalId: string, oldPath: string, newPath: string) => {
  try {
    await sftpManager.rename(terminalId, oldPath, newPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('sftp:copy', async (event, terminalId: string, sourcePath: string, destPath: string) => {
  try {
    await sftpManager.copy(terminalId, sourcePath, destPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('sftp:chmod', async (event, terminalId: string, filePath: string, mode: number) => {
  try {
    await sftpManager.chmod(terminalId, filePath, mode);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('sftp:download', async (event, terminalId: string, remotePath: string) => {
  try {
    // Show save dialog first to avoid downloading if user cancels
    if (!mainWindow) {
      return { success: false, error: 'Main window not available' };
    }
    
    const fileName = path.basename(remotePath);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save File',
      defaultPath: fileName,
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      return { success: false, error: 'Download cancelled' };
    }
    
    // Download file (this may take time for large files)
    const data = await sftpManager.download(terminalId, remotePath);
    
    // Save file to local filesystem using writeFile for better error handling
    await fs.promises.writeFile(result.filePath!, data);
    return { success: true, localPath: result.filePath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Settings IPC Handlers
ipcMain.handle('settings:get', () => {
  return settingsManager.getSettings();
});

ipcMain.handle('settings:set', (event, updates: any) => {
  try {
    const updated = settingsManager.updateSettings(updates);
    return { success: true, settings: updated };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('settings:getGitHubToken', async () => {
  try {
    const token = await settingsManager.getGitHubToken();
    return { success: true, token };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('settings:setGitHubToken', async (event, token: string) => {
  try {
    await settingsManager.setGitHubToken(token);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('settings:deleteGitHubToken', async () => {
  try {
    await settingsManager.deleteGitHubToken();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('settings:hasGitHubToken', async () => {
  try {
    const hasToken = await settingsManager.hasGitHubToken();
    return { success: true, hasToken };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('settings:getGeminiToken', async () => {
  try {
    const token = await settingsManager.getGeminiToken();
    return { success: true, token };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('settings:setGeminiToken', async (event, token: string) => {
  try {
    await settingsManager.setGeminiToken(token);
    // Update Gemini API service with new token
    geminiApiService.setApiKey(token);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('settings:deleteGeminiToken', async () => {
  try {
    await settingsManager.deleteGeminiToken();
    // Clear Gemini API service token
    geminiApiService.clearApiKey();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('settings:hasGeminiToken', async () => {
  try {
    const hasToken = await settingsManager.hasGeminiToken();
    return { success: true, hasToken };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// IPC Handlers - Update
ipcMain.handle('update:checkForUpdates', async () => {
  try {
    const result = await updateService.checkForUpdates(false);
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('update:downloadUpdate', async () => {
  try {
    const result = await updateService.downloadUpdate();
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('update:installUpdate', async () => {
  try {
    const result = await updateService.installUpdate();
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('update:getStatus', () => {
  try {
    const status = updateService.getStatus();
    return status;
  } catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Forward update events to renderer
updateService.on('update-available', (info: { version: string; releaseNotes?: string }) => {
  mainWindow?.webContents.send('update:available', info);
});

updateService.on('update-not-available', (info: { version: string }) => {
  mainWindow?.webContents.send('update:not-available', info);
});

updateService.on('download-progress', (progress: { percent: number; transferred: number; total: number }) => {
  mainWindow?.webContents.send('update:download-progress', progress);
});

updateService.on('update-downloaded', (info: { version: string }) => {
  mainWindow?.webContents.send('update:downloaded', info);
});

updateService.on('update-error', (error: string) => {
  mainWindow?.webContents.send('update:error', error);
});

ipcMain.handle('terminal:list', () => {
  return Array.from(terminals.keys());
});

ipcMain.handle('terminal:getHistory', (event, id: string) => {
  const terminal = terminals.get(id);
  if (terminal) {
    return { success: true, history: terminal.getCommandHistory() };
  }
  return { success: false, error: 'Terminal not found' };
});

ipcMain.handle('terminal:getSuggestions', async (event, id: string, prefix: string) => {
  const terminal = terminals.get(id);
  if (terminal) {
    try {
      const suggestions = await terminal.getSuggestions(prefix);
      return { success: true, suggestions };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  return { success: false, error: 'Terminal not found' };
});

// IPC Handlers - Chat
ipcMain.handle('chat:sendMessage', async (event, messages: ChatMessage[], terminalContext?: string) => {
  try {
    if (!geminiApiService.hasApiKey()) {
      return { success: false, error: 'Gemini API key not configured. Please add it in Settings.' };
    }

    const response = await geminiApiService.sendChatMessage(messages, terminalContext);
    return { success: true, response };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('chat:executeCommand', async (event, terminalId: string, command: string) => {
  try {
    const terminal = terminals.get(terminalId);
    if (!terminal) {
      return { success: false, error: 'Terminal not found' };
    }

    // Execute command by writing to terminal (add newline to execute)
    terminal.write(command + '\r\n');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// IPC Handlers - Session Management
ipcMain.handle('session:list', () => {
  return sessionManager.getAllSessions();
});

ipcMain.handle('session:get', (event, id: string) => {
  return sessionManager.getSession(id);
});

ipcMain.handle('session:save', async (event, sessionData: Omit<Session, 'id' | 'createdAt' | 'lastUsed'> & { id?: string }, password?: string) => {
  try {
    const session = await sessionManager.saveSession(sessionData);
    
    // Save password to keyring if provided
    if (password && (session.type === 'ssh' || session.type === 'rdp' || session.type === 'telnet')) {
      await sessionManager.savePassword(session.id, password);
    }
    
    return { success: true, session };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('session:delete', async (event, id: string) => {
  try {
    const success = await sessionManager.deleteSession(id);
    return { success };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('session:getPassword', async (event, sessionId: string) => {
  try {
    const password = await sessionManager.getPassword(sessionId);
    return { success: true, password };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('session:setPassword', async (event, sessionId: string, password: string) => {
  try {
    await sessionManager.savePassword(sessionId, password);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Git Clone IPC Handlers
ipcMain.handle('git:clone', async (event, repo: string, targetDirectory?: string) => {
  try {
    // Parse repo input - handle various formats
    let repoUrl = repo.trim();
    
    // If it's just "user/repo", convert to full URL
    if (!repoUrl.includes('://') && !repoUrl.startsWith('git@')) {
      if (repoUrl.includes('/')) {
        repoUrl = `https://github.com/${repoUrl}`;
      } else {
        return { success: false, error: 'Invalid repository format. Use "user/repo" or full URL' };
      }
    }
    
    // Ensure it ends with .git if it's a GitHub URL
    if (repoUrl.includes('github.com') && !repoUrl.endsWith('.git')) {
      repoUrl += '.git';
    }
    
    // Get GitHub token
    const token = await settingsManager.getGitHubToken();
    if (!token) {
      return { success: false, error: 'GitHub token not configured. Please set it in Settings.' };
    }
    
    // Inject token into HTTPS URL
    if (repoUrl.startsWith('https://')) {
      repoUrl = repoUrl.replace('https://', `https://${token}@`);
    }
    
    // Build git clone command
    let command = `git clone ${repoUrl}`;
    if (targetDirectory) {
      command += ` "${targetDirectory}"`;
    }
    
    return { success: true, command };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('git:browseDirectory', async (event) => {
  try {
    if (!mainWindow) {
      return { success: false, error: 'Main window not available' };
    }
    
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Directory for Clone',
      properties: ['openDirectory', 'createDirectory']
    });
    
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, error: 'No directory selected' };
    }
    
    return { success: true, directory: result.filePaths[0] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// SFTP Open File IPC Handler
ipcMain.handle('sftp:openFile', async (event, terminalId: string, remotePath: string) => {
  try {
    // Download file to temp directory
    const data = await sftpManager.download(terminalId, remotePath);
    
    // Create temp file
    const tempDir = os.tmpdir();
    const fileName = path.basename(remotePath);
    const tempPath = path.join(tempDir, `sftp-open-${Date.now()}-${fileName}`);
    
    // Write to temp file
    fs.writeFileSync(tempPath, data);
    
    // Open with system default application
    await shell.openPath(tempPath);
    
    // Schedule cleanup after 5 minutes
    setTimeout(() => {
      try {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (err) {
        console.error('Failed to cleanup temp file:', err);
      }
    }, 5 * 60 * 1000);
    
    return { success: true, tempPath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

