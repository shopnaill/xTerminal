/// <reference path="./types.d.ts" />

export class UpdateDialog {
  private overlay: HTMLElement;
  private dialog: HTMLElement;
  private versionLabel: HTMLElement;
  private releaseNotes: HTMLElement;
  private progressBar: HTMLElement;
  private progressPercent: HTMLElement;
  private statusMessage: HTMLElement;
  private downloadButton: HTMLElement;
  private installButton: HTMLElement;
  private laterButton: HTMLElement;
  private closeButton: HTMLElement;
  private resolveCallback?: (result: { action: 'download' | 'install' | 'later' | 'close' }) => void;
  
  private currentVersion: string = '';
  private downloadProgress: number = 0;

  constructor() {
    this.overlay = document.getElementById('updateDialogOverlay')!;
    this.dialog = document.getElementById('updateDialog')!;
    this.versionLabel = document.getElementById('updateVersion')!;
    this.releaseNotes = document.getElementById('updateReleaseNotes')!;
    this.progressBar = document.getElementById('updateProgressBar')!;
    this.progressPercent = document.getElementById('updateProgressPercent')!;
    this.statusMessage = document.getElementById('updateStatusMessage')!;
    this.downloadButton = document.getElementById('updateDownloadBtn')!;
    this.installButton = document.getElementById('updateInstallBtn')!;
    this.laterButton = document.getElementById('updateLaterBtn')!;
    this.closeButton = document.getElementById('updateDialogClose')!;

    if (!this.overlay || !this.dialog || !this.versionLabel || !this.downloadButton) {
      throw new Error('UpdateDialog: Required DOM elements not found');
    }

    this.setupEventListeners();
    this.setupUpdateListeners();
  }

  private setupEventListeners(): void {
    this.downloadButton.addEventListener('click', () => this.handleDownload());
    this.installButton.addEventListener('click', () => this.handleInstall());
    this.laterButton.addEventListener('click', () => this.close('later'));
    if (this.closeButton) {
      this.closeButton.addEventListener('click', () => this.close('close'));
    }
    
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close('close');
      }
    });
  }

  private setupUpdateListeners(): void {
    // Listen for update events
    window.electronAPI.update.onUpdateAvailable((info) => {
      this.showUpdateAvailable(info.version, info.releaseNotes);
    });

    window.electronAPI.update.onUpdateNotAvailable((info) => {
      // Can show a toast notification if manual check
    });

    window.electronAPI.update.onDownloadProgress((progress) => {
      this.updateDownloadProgress(progress.percent);
    });

    window.electronAPI.update.onUpdateDownloaded((info) => {
      this.showDownloadComplete(info.version);
    });

    window.electronAPI.update.onUpdateError((error) => {
      this.showError(error);
    });
  }

  showUpdateAvailable(version: string, releaseNotes?: string): void {
    this.currentVersion = version;
    if (this.versionLabel) {
      this.versionLabel.textContent = `Version ${version}`;
    }
    
    if (this.releaseNotes && releaseNotes) {
      this.releaseNotes.innerHTML = this.formatReleaseNotes(releaseNotes);
      this.releaseNotes.style.display = 'block';
    } else if (this.releaseNotes) {
      this.releaseNotes.style.display = 'none';
    }

    // Show download button, hide install button
    if (this.downloadButton) {
      this.downloadButton.style.display = 'block';
    }
    if (this.installButton) {
      this.installButton.style.display = 'none';
    }
    if (this.laterButton) {
      this.laterButton.style.display = 'block';
    }

    // Hide progress bar initially
    if (this.progressBar && this.progressBar.parentElement) {
      this.progressBar.parentElement.style.display = 'none';
    }
    if (this.statusMessage) {
      this.statusMessage.textContent = 'A new version is available!';
      this.statusMessage.style.display = 'block';
    }

    this.show();
  }

  showDownloadComplete(version: string): void {
    if (this.statusMessage) {
      this.statusMessage.textContent = 'Update downloaded successfully! Click "Install & Restart" to apply the update.';
      this.statusMessage.style.display = 'block';
    }

    // Hide download button, show install button
    if (this.downloadButton) {
      this.downloadButton.style.display = 'none';
    }
    if (this.installButton) {
      this.installButton.style.display = 'block';
    }
    if (this.laterButton) {
      this.laterButton.style.display = 'block';
    }

    // Hide progress bar
    if (this.progressBar && this.progressBar.parentElement) {
      this.progressBar.parentElement.style.display = 'none';
    }
  }

  updateDownloadProgress(percent: number): void {
    this.downloadProgress = percent;
    
    // Show progress bar
    if (this.progressBar && this.progressBar.parentElement) {
      this.progressBar.parentElement.style.display = 'block';
    }
    
    if (this.progressBar) {
      this.progressBar.style.width = `${percent}%`;
    }
    
    if (this.progressPercent) {
      this.progressPercent.textContent = `${percent}%`;
    }
    
    if (this.statusMessage) {
      this.statusMessage.textContent = `Downloading update... ${percent}%`;
      this.statusMessage.style.display = 'block';
    }

    // Hide download button during download
    if (this.downloadButton && percent > 0) {
      this.downloadButton.style.display = 'none';
    }
  }

  showError(error: string): void {
    if (this.statusMessage) {
      this.statusMessage.textContent = `Error: ${error}`;
      this.statusMessage.style.display = 'block';
    }

    // Show download button again on error
    if (this.downloadButton) {
      this.downloadButton.style.display = 'block';
      this.downloadButton.textContent = 'Retry Download';
    }
  }

  private async handleDownload(): Promise<void> {
    try {
      if (this.downloadButton) {
        this.downloadButton.disabled = true;
        this.downloadButton.textContent = 'Downloading...';
      }

      const result = await window.electronAPI.update.downloadUpdate();
      
      if (!result.success) {
        this.showError(result.error || 'Failed to download update');
        if (this.downloadButton) {
          this.downloadButton.disabled = false;
          this.downloadButton.textContent = 'Retry Download';
        }
      }
      // Progress will be updated via event listeners
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Unknown error');
      if (this.downloadButton) {
        this.downloadButton.disabled = false;
        this.downloadButton.textContent = 'Download Update';
      }
    }
  }

  private async handleInstall(): Promise<void> {
    try {
      if (this.installButton) {
        this.installButton.disabled = true;
        this.installButton.textContent = 'Installing...';
      }

      const result = await window.electronAPI.update.installUpdate();
      
      if (!result.success) {
        this.showError(result.error || 'Failed to install update');
        if (this.installButton) {
          this.installButton.disabled = false;
          this.installButton.textContent = 'Install & Restart';
        }
      } else {
        // App will restart, so we don't need to do anything
        if (this.statusMessage) {
          this.statusMessage.textContent = 'Restarting to install update...';
        }
      }
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Unknown error');
      if (this.installButton) {
        this.installButton.disabled = false;
        this.installButton.textContent = 'Install & Restart';
      }
    }
  }

  show(): void {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
    }
  }

  close(action: 'download' | 'install' | 'later' | 'close' = 'close'): void {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
    if (this.resolveCallback) {
      this.resolveCallback({ action });
      this.resolveCallback = undefined;
    }
  }

  private formatReleaseNotes(notes: string): string {
    // Convert markdown-like text to HTML
    let formatted = notes
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
    
    return formatted;
  }
}

export {};
