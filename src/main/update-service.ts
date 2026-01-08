import { autoUpdater, UpdateInfo } from 'electron-updater';
import { app } from 'electron';
import { EventEmitter } from 'events';
import { SettingsManager } from './settings';

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  progress?: number;
  error?: string;
  releaseNotes?: string;
}

export class UpdateService extends EventEmitter {
  private status: UpdateStatus = { status: 'idle' };
  private updateAvailable: UpdateInfo | null = null;
  private mainWindow: Electron.BrowserWindow | null = null;
  private settingsManager?: SettingsManager;

  constructor(settingsManager?: SettingsManager) {
    super();
    
    this.settingsManager = settingsManager;
    
    // Configure auto-updater
    autoUpdater.autoDownload = false; // Ask user before downloading
    autoUpdater.autoInstallOnAppQuit = true; // Install on next quit
    
    // Configure custom update server
    if (app.isPackaged) {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: 'https://xengine.gym-engine.com/updates'
      });
      console.log('Update server configured: https://xengine.gym-engine.com/updates');
    }
    
    // Set update check interval (optional - can be disabled)
    // autoUpdater.checkForUpdatesAndNotify();

    // Listen to update events
    this.setupEventListeners();
  }
  
  async initializeGitHubToken(): Promise<void> {
    if (this.settingsManager) {
      try {
        const token = await this.settingsManager.getGitHubToken();
        if (token) {
          // Set GitHub token for electron-updater (for private repos)
          // electron-updater uses GH_TOKEN environment variable or setFeedURL
          process.env.GH_TOKEN = token;
          console.log('GitHub token configured for update service');
        }
      } catch (error) {
        console.error('Failed to load GitHub token for updates:', error);
      }
    }
  }

  setMainWindow(window: Electron.BrowserWindow): void {
    this.mainWindow = window;
  }

  private setupEventListeners(): void {
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for updates...');
      this.updateStatus({ status: 'checking' });
      this.emit('checking');
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log('Update available:', info.version);
      this.updateAvailable = info;
      const releaseNotes = this.formatReleaseNotes(info.releaseNotes);
      this.updateStatus({
        status: 'available',
        version: info.version,
        releaseNotes,
      });
      this.emit('update-available', {
        version: info.version,
        releaseNotes,
      });
    });

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      console.log('Update not available. Current version is latest.');
      this.updateStatus({ status: 'idle' });
      this.emit('update-not-available', {
        version: info.version,
      });
    });

    autoUpdater.on('error', (err: Error) => {
      console.error('Update error:', err);
      let errorMessage = err.message;
      
      // Provide better error messages for common issues
      if (err.message.includes('404') || err.message.includes('Not Found')) {
        errorMessage = 'Repository not found or has no releases. Please verify the repository exists and has at least one published release.';
      } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
        errorMessage = 'Access denied. If the repository is private, please configure your GitHub Personal Access Token in Settings.';
      }
      
      this.updateStatus({
        status: 'error',
        error: errorMessage,
      });
      this.emit('update-error', errorMessage);
    });

    autoUpdater.on('download-progress', (progress: any) => {
      const percent = Math.round(progress.percent || 0);
      console.log('Download progress:', percent + '%');
      this.updateStatus({
        status: 'downloading',
        progress: percent,
      });
      this.emit('download-progress', {
        percent: percent,
        transferred: progress.transferred || 0,
        total: progress.total || 0,
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      console.log('Update downloaded:', info.version);
      this.updateStatus({
        status: 'downloaded',
        version: info.version,
      });
      this.emit('update-downloaded', {
        version: info.version,
      });
    });
  }

  async checkForUpdates(autoDownload: boolean = false): Promise<{ success: boolean; updateAvailable?: boolean; version?: string; error?: string }> {
    try {
      // Skip update check in development mode
      if (!app.isPackaged) {
        console.warn('Update check skipped in development mode');
        return {
          success: false,
          error: 'Update checking is only available in packaged application',
        };
      }

      // Ensure custom server URL is set
      if (!autoUpdater.getFeedURL()) {
        autoUpdater.setFeedURL({
          provider: 'generic',
          url: 'https://xengine.gym-engine.com/updates'
        });
        console.log('Update server URL configured: https://xengine.gym-engine.com/updates');
      }

      autoUpdater.autoDownload = autoDownload;
      
      try {
        const result = await autoUpdater.checkForUpdates();
        
        if (result && result.updateInfo) {
          return {
            success: true,
            updateAvailable: true,
            version: result.updateInfo.version,
          };
        }
        
        return {
          success: true,
          updateAvailable: false,
        };
      } catch (checkError) {
        // If checkForUpdates throws, it might be because of missing assets
        const errorMsg = checkError instanceof Error ? checkError.message : String(checkError);
        throw new Error(errorMsg);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to check for updates:', errorMessage);
      
      // Provide helpful error messages for common issues
      if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
        const updateUrl = 'https://xengine.gym-engine.com/updates';
        return {
          success: false,
          error: `Update check failed: Files not found on server (404).\n\nPlease ensure these files are accessible:\n1. ${updateUrl}/latest.yml\n2. ${updateUrl}/X-Engine-Terminal-Setup-1.0.0.exe\n\nUpload the files from:\n- d:\\Work\\Terminal\\release\\latest.yml\n- d:\\Work\\Terminal\\release\\X Engine Terminal Setup 1.0.0.exe\n\nNote: Make sure your web server allows direct file access and the filenames match exactly.`,
        };
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async downloadUpdate(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.updateAvailable) {
        return {
          success: false,
          error: 'No update available to download',
        };
      }

      this.updateStatus({ status: 'downloading', progress: 0 });
      await autoUpdater.downloadUpdate();
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to download update:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async installUpdate(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.status.status !== 'downloaded') {
        return {
          success: false,
          error: 'Update not downloaded yet',
        };
      }

      // Quit and install - electron-updater will handle the installation
      autoUpdater.quitAndInstall(false, true);
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to install update:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  getStatus(): UpdateStatus {
    return { ...this.status };
  }

  private updateStatus(status: Partial<UpdateStatus>): void {
    this.status = { ...this.status, ...status };
  }

  private formatReleaseNotes(releaseNotes: string | Array<{ name?: string | null; note?: string | null }> | null | undefined): string | undefined {
    if (!releaseNotes) {
      return undefined;
    }
    
    if (typeof releaseNotes === 'string') {
      return releaseNotes;
    }
    
    if (Array.isArray(releaseNotes)) {
      return releaseNotes
        .map((item) => {
          if (typeof item === 'string') {
            return item;
          }
          const note = item.note || '';
          const name = item.name || '';
          if (note) {
            return name ? `${name}\n${note}` : note;
          }
          return name;
        })
        .filter((note) => note && note.length > 0)
        .join('\n\n');
    }
    
    return undefined;
  }
}
