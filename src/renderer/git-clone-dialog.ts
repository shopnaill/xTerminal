export class GitCloneDialog {
  private overlay: HTMLElement;
  private dialog: HTMLElement;
  private form: HTMLFormElement;
  private repoInput: HTMLInputElement;
  private directoryRadio: HTMLInputElement;
  private browseRadio: HTMLInputElement;
  private directoryPath: HTMLElement;
  private browseBtn: HTMLElement;
  private tokenStatus: HTMLElement;
  private resolveCallback?: (result: { repo: string; directory: string; clone: boolean }) => void;
  private selectedDirectory: string = '';

  constructor() {
    // Create dialog elements dynamically
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.id = 'gitCloneDialogOverlay';
    this.overlay.style.display = 'none';

    this.dialog = document.createElement('div');
    this.dialog.className = 'modal-dialog';
    this.dialog.id = 'gitCloneDialog';

    this.dialog.innerHTML = `
      <div class="modal-header">
        <h2>Clone GitHub Repository</h2>
        <button class="modal-close" id="gitCloneDialogClose">&times;</button>
      </div>
      <div class="modal-body">
        <form id="gitCloneForm">
          <div class="form-group">
            <label for="repoInput">Repository URL or Name</label>
            <input type="text" id="repoInput" placeholder="user/repo or https://github.com/user/repo.git" required>
            <small class="form-help">Enter GitHub repository URL or owner/repo name</small>
          </div>

          <div class="form-group">
            <label>Clone Location</label>
            <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="radio" name="directoryOption" id="currentDirRadio" value="current" checked>
                <span>Current terminal directory</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="radio" name="directoryOption" id="browseDirRadio" value="browse">
                <span>Select directory</span>
              </label>
            </div>
            <div id="directoryPath" style="margin-top: 8px; padding: 8px; background: var(--bg-tertiary); border-radius: 4px; font-size: 11px; color: var(--text-muted); display: none;">
              No directory selected
            </div>
            <button type="button" id="browseDirBtn" class="btn-secondary" style="margin-top: 8px; display: none;">Browse...</button>
          </div>

          <div class="form-group">
            <div id="tokenStatus" class="token-status token-none" style="padding: 8px; border-radius: 4px;">
              Checking token status...
            </div>
            <small class="form-help" style="margin-top: 4px;">
              <a href="#" id="openSettingsLink" style="color: var(--accent-blue); text-decoration: none;">Configure GitHub token in Settings</a>
            </small>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" id="gitCloneDialogCancel">Cancel</button>
            <button type="submit" class="btn-primary" id="gitCloneDialogClone">Clone</button>
          </div>
        </form>
      </div>
    `;

    this.overlay.appendChild(this.dialog);
    document.body.appendChild(this.overlay);

    this.form = document.getElementById('gitCloneForm') as HTMLFormElement;
    this.repoInput = document.getElementById('repoInput') as HTMLInputElement;
    this.directoryRadio = document.getElementById('currentDirRadio') as HTMLInputElement;
    this.browseRadio = document.getElementById('browseDirRadio') as HTMLInputElement;
    this.directoryPath = document.getElementById('directoryPath')!;
    this.browseBtn = document.getElementById('browseDirBtn')!;
    this.tokenStatus = document.getElementById('tokenStatus')!;

    this.setupEventListeners();
    this.loadTokenStatus();
  }

  private setupEventListeners(): void {
    // Close button
    document.getElementById('gitCloneDialogClose')?.addEventListener('click', () => this.close(false));
    document.getElementById('gitCloneDialogCancel')?.addEventListener('click', () => this.close(false));

    // Overlay click to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close(false);
      }
    });

    // Directory option change
    this.directoryRadio.addEventListener('change', () => {
      this.updateDirectoryUI();
    });

    this.browseRadio.addEventListener('change', () => {
      this.updateDirectoryUI();
    });

    // Browse button
    this.browseBtn.addEventListener('click', async () => {
      await this.browseDirectory();
    });

    // Open settings link
    document.getElementById('openSettingsLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.close(false);
      // Trigger settings dialog - this will be handled by renderer
      window.dispatchEvent(new CustomEvent('open-settings'));
    });

    // Form submit
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  }

  private updateDirectoryUI(): void {
    const isBrowse = this.browseRadio.checked;
    this.directoryPath.style.display = isBrowse ? 'block' : 'none';
    this.browseBtn.style.display = isBrowse ? 'inline-block' : 'none';
  }

  private async browseDirectory(): Promise<void> {
    try {
      const result = await window.electronAPI.git.browseDirectory();
      if (result.success && result.directory) {
        this.selectedDirectory = result.directory;
        this.directoryPath.textContent = result.directory;
        this.directoryPath.style.color = 'var(--text-primary)';
      }
    } catch (error) {
      console.error('Failed to browse directory:', error);
    }
  }

  private async loadTokenStatus(): Promise<void> {
    try {
      const hasToken = await window.electronAPI.settings.hasGitHubToken();
      if (hasToken.success && hasToken.hasToken) {
        this.tokenStatus.textContent = '✓ GitHub token is configured';
        this.tokenStatus.className = 'token-status token-stored';
      } else {
        this.tokenStatus.textContent = '⚠ No GitHub token configured';
        this.tokenStatus.className = 'token-status token-none';
      }
    } catch (error) {
      console.error('Failed to check token status:', error);
      this.tokenStatus.textContent = '⚠ Unable to check token status';
      this.tokenStatus.className = 'token-status token-none';
    }
  }

  private async handleSubmit(): Promise<void> {
    const repo = this.repoInput.value.trim();
    if (!repo) {
      alert('Please enter a repository URL or name');
      return;
    }

    let directory = '';
    if (this.browseRadio.checked) {
      if (!this.selectedDirectory) {
        alert('Please select a directory');
        return;
      }
      directory = this.selectedDirectory;
    }

    this.close(true, { repo, directory });
  }

  show(): Promise<{ repo: string; directory: string; clone: boolean }> {
    return new Promise((resolve) => {
      this.resolveCallback = resolve;
      this.overlay.style.display = 'flex';
      this.repoInput.value = '';
      this.selectedDirectory = '';
      this.directoryPath.textContent = 'No directory selected';
      this.directoryPath.style.color = 'var(--text-muted)';
      this.directoryRadio.checked = true;
      this.updateDirectoryUI();
      this.loadTokenStatus();
      setTimeout(() => this.repoInput.focus(), 100);
    });
  }

  private close(clone: boolean, data?: { repo: string; directory: string }): void {
    this.overlay.style.display = 'none';
    if (this.resolveCallback) {
      this.resolveCallback({ 
        repo: data?.repo || '', 
        directory: data?.directory || '', 
        clone 
      });
      this.resolveCallback = undefined;
    }
  }
}

export {};
