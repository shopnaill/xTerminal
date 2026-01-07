import { autoUpdater, UpdateInfo } from 'electron-updater';
import { app } from 'electron';
import { EventEmitter } from 'events';

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

  constructor() {
    super();
    
    // Configure auto-updater
    autoUpdater.autoDownload = false; // Ask user before downloading
    autoUpdater.autoInstallOnAppQuit = true; // Install on next quit
    
    // Set update check interval (optional - can be disabled)
    // autoUpdater.checkForUpdatesAndNotify();

    // Listen to update events
    this.setupEventListeners();
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
      this.updateStatus({
        status: 'available',
        version: info.version,
        releaseNotes: info.releaseNotes || undefined,
      });
      this.emit('update-available', {
        version: info.version,
        releaseNotes: info.releaseNotes || undefined,
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
      this.updateStatus({
        status: 'error',
        error: err.message,
      });
      this.emit('update-error', err.message);
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
      // Note: electron-updater automatically reads publish config from package.json
      // Make sure to configure "publish" section in package.json with your GitHub repo
      
      // Skip update check in development mode
      if (!app.isPackaged) {
        console.warn('Update check skipped in development mode');
        return {
          success: false,
          error: 'Update checking is only available in packaged application',
        };
      }

      autoUpdater.autoDownload = autoDownload;
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to check for updates:', errorMessage);
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
}
