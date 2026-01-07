import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Terminal operations
      terminal: {
    create: (id: string, cols: number, rows: number, sessionId?: string, password?: string) =>
      ipcRenderer.invoke('terminal:create', id, cols, rows, sessionId, password),
    write: (id: string, data: string) =>
      ipcRenderer.invoke('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', id, cols, rows),
    destroy: (id: string) =>
      ipcRenderer.invoke('terminal:destroy', id),
    list: () =>
      ipcRenderer.invoke('terminal:list'),
    getHistory: (id: string) =>
      ipcRenderer.invoke('terminal:getHistory', id),
    getSuggestions: (id: string, prefix: string) =>
      ipcRenderer.invoke('terminal:getSuggestions', id, prefix),
  },

  // Session management
  session: {
    list: () => ipcRenderer.invoke('session:list'),
    get: (id: string) => ipcRenderer.invoke('session:get', id),
    save: (sessionData: any, password?: string) =>
      ipcRenderer.invoke('session:save', sessionData, password),
    delete: (id: string) => ipcRenderer.invoke('session:delete', id),
    getPassword: (sessionId: string) => ipcRenderer.invoke('session:getPassword', sessionId),
    setPassword: (sessionId: string, password: string) =>
      ipcRenderer.invoke('session:setPassword', sessionId, password),
  },

  // SFTP operations
  sftp: {
    list: (terminalId: string, path: string) =>
      ipcRenderer.invoke('sftp:list', terminalId, path),
    readFile: (terminalId: string, path: string) =>
      ipcRenderer.invoke('sftp:readFile', terminalId, path),
    writeFile: (terminalId: string, path: string, data: Buffer | string) =>
      ipcRenderer.invoke('sftp:writeFile', terminalId, path, data),
    mkdir: (terminalId: string, path: string) =>
      ipcRenderer.invoke('sftp:mkdir', terminalId, path),
    delete: (terminalId: string, path: string) =>
      ipcRenderer.invoke('sftp:delete', terminalId, path),
    rename: (terminalId: string, oldPath: string, newPath: string) =>
      ipcRenderer.invoke('sftp:rename', terminalId, oldPath, newPath),
    copy: (terminalId: string, sourcePath: string, destPath: string) =>
      ipcRenderer.invoke('sftp:copy', terminalId, sourcePath, destPath),
    chmod: (terminalId: string, path: string, mode: number) =>
      ipcRenderer.invoke('sftp:chmod', terminalId, path, mode),
    download: (terminalId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:download', terminalId, remotePath),
    openFile: (terminalId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:openFile', terminalId, remotePath),
  },

  // Settings operations
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (updates: any) => ipcRenderer.invoke('settings:set', updates),
    getGitHubToken: () => ipcRenderer.invoke('settings:getGitHubToken'),
    setGitHubToken: (token: string) => ipcRenderer.invoke('settings:setGitHubToken', token),
    deleteGitHubToken: () => ipcRenderer.invoke('settings:deleteGitHubToken'),
    hasGitHubToken: () => ipcRenderer.invoke('settings:hasGitHubToken'),
    getGeminiToken: () => ipcRenderer.invoke('settings:getGeminiToken'),
    setGeminiToken: (token: string) => ipcRenderer.invoke('settings:setGeminiToken', token),
    deleteGeminiToken: () => ipcRenderer.invoke('settings:deleteGeminiToken'),
    hasGeminiToken: () => ipcRenderer.invoke('settings:hasGeminiToken'),
  },

  // Git operations
  git: {
    clone: (repo: string, targetDirectory?: string) =>
      ipcRenderer.invoke('git:clone', repo, targetDirectory),
    browseDirectory: () =>
      ipcRenderer.invoke('git:browseDirectory'),
  },

  // Chat operations
  chat: {
    sendMessage: (messages: any[], terminalContext?: string) =>
      ipcRenderer.invoke('chat:sendMessage', messages, terminalContext),
    executeCommand: (terminalId: string, command: string) =>
      ipcRenderer.invoke('chat:executeCommand', terminalId, command),
  },

  // Update operations
  update: {
    checkForUpdates: () => ipcRenderer.invoke('update:checkForUpdates'),
    downloadUpdate: () => ipcRenderer.invoke('update:downloadUpdate'),
    installUpdate: () => ipcRenderer.invoke('update:installUpdate'),
    getStatus: () => ipcRenderer.invoke('update:getStatus'),
    onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => {
      ipcRenderer.on('update:available', (event, info) => callback(info));
    },
    onUpdateNotAvailable: (callback: (info: { version: string }) => void) => {
      ipcRenderer.on('update:not-available', (event, info) => callback(info));
    },
    onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => {
      ipcRenderer.on('update:download-progress', (event, progress) => callback(progress));
    },
    onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
      ipcRenderer.on('update:downloaded', (event, info) => callback(info));
    },
    onUpdateError: (callback: (error: string) => void) => {
      ipcRenderer.on('update:error', (event, error) => callback(error));
    },
  },

  // Event listeners
  onTerminalData: (callback: (id: string, data: string) => void) => {
    ipcRenderer.on('terminal:data', (event, id, data) => callback(id, data));
  },
  onTerminalExit: (callback: (id: string, info: { code: number; signal?: number }) => void) => {
    ipcRenderer.on('terminal:exit', (event, id, info) => callback(id, info));
  },
  onTerminalError: (callback: (id: string, error: string) => void) => {
    ipcRenderer.on('terminal:error', (event, id, error) => callback(id, error));
  },
  onSFTPReady: (callback: (id: string) => void) => {
    ipcRenderer.on('sftp:ready', (event, id) => callback(id));
  },
});

