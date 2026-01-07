export class SettingsDialog {
  private overlay: HTMLElement;
  private dialog: HTMLElement;
  private form: HTMLFormElement;
  private resolveCallback?: (result: { saved: boolean }) => void;
  private githubTokenInput: HTMLInputElement;
  private githubTokenStatus: HTMLElement;
  private geminiTokenInput: HTMLInputElement;
  private geminiTokenStatus: HTMLElement;
  private checkForUpdatesBtn: HTMLElement;

  constructor() {
    this.overlay = document.getElementById('settingsDialogOverlay')!;
    this.dialog = document.getElementById('settingsDialog')!;
    this.form = document.getElementById('settingsForm') as HTMLFormElement;
    this.githubTokenInput = document.getElementById('githubToken') as HTMLInputElement;
    this.githubTokenStatus = document.getElementById('githubTokenStatus')!;
    this.geminiTokenInput = document.getElementById('geminiToken') as HTMLInputElement;
    this.geminiTokenStatus = document.getElementById('geminiTokenStatus')!;
    this.checkForUpdatesBtn = document.getElementById('checkForUpdatesBtn')!;

    if (!this.overlay || !this.dialog || !this.form || !this.githubTokenInput || !this.githubTokenStatus || !this.geminiTokenInput || !this.geminiTokenStatus || !this.checkForUpdatesBtn) {
      throw new Error('SettingsDialog: Required DOM elements not found');
    }

    this.setupEventListeners();
    this.loadSettings();
  }

  private setupEventListeners(): void {
    // Close button
    document.getElementById('settingsDialogClose')?.addEventListener('click', () => this.close(false));
    document.getElementById('settingsDialogCancel')?.addEventListener('click', () => this.close(false));

    // Overlay click to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close(false);
      }
    });

    // Form submit
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // GitHub token input change
    this.githubTokenInput.addEventListener('input', () => {
      this.updateGitHubTokenStatus();
    });

    // Delete GitHub token button
    document.getElementById('deleteGitHubTokenBtn')?.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete the stored GitHub token?')) {
        const result = await window.electronAPI.settings.deleteGitHubToken();
        if (result.success) {
          this.githubTokenInput.value = '';
          this.updateGitHubTokenStatus();
        }
      }
    });

    // Gemini token input change
    this.geminiTokenInput.addEventListener('input', () => {
      this.updateGeminiTokenStatus();
    });

    // Delete Gemini token button
    document.getElementById('deleteGeminiTokenBtn')?.addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete the stored Gemini API token?')) {
        const result = await window.electronAPI.settings.deleteGeminiToken();
        if (result.success) {
          this.geminiTokenInput.value = '';
          this.updateGeminiTokenStatus();
        }
      }
    });

    // Check for updates button
    this.checkForUpdatesBtn.addEventListener('click', async () => {
      await this.checkForUpdates();
    });
  }

  private async checkForUpdates(): Promise<void> {
    try {
      this.checkForUpdatesBtn.textContent = 'Checking...';
      this.checkForUpdatesBtn.disabled = true;

      const result = await window.electronAPI.update.checkForUpdates();
      
      if (result.success && result.updateAvailable) {
        // Update dialog will be shown automatically via event listener
        alert(`Update available! Version ${result.version} is ready to download.`);
      } else if (result.success && !result.updateAvailable) {
        alert('You are using the latest version.');
      } else {
        alert(`Failed to check for updates: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      alert(`Error checking for updates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.checkForUpdatesBtn.textContent = 'Check for Updates';
      this.checkForUpdatesBtn.disabled = false;
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const settings = await window.electronAPI.settings.get();
      
      // Load UI theme
      const themeSelect = document.getElementById('uiTheme') as HTMLSelectElement;
      if (themeSelect) {
        themeSelect.value = settings.ui?.theme || 'dark';
      }
      
      // Load terminal settings
      const fontSizeInput = document.getElementById('fontSize') as HTMLInputElement;
      const fontFamilyInput = document.getElementById('fontFamily') as HTMLInputElement;
      if (fontSizeInput) fontSizeInput.value = settings.terminal.fontSize.toString();
      if (fontFamilyInput) fontFamilyInput.value = settings.terminal.fontFamily;

      // Check GitHub token status
      const hasToken = await window.electronAPI.settings.hasGitHubToken();
      if (hasToken.success && hasToken.hasToken) {
        this.githubTokenInput.value = '••••••••••••••••'; // Placeholder to show token exists
        this.githubTokenInput.placeholder = 'Token is stored (enter new token to update)';
      }
      this.updateGitHubTokenStatus();

      // Check Gemini token status
      const hasGeminiToken = await window.electronAPI.settings.hasGeminiToken();
      if (hasGeminiToken.success && hasGeminiToken.hasToken) {
        this.geminiTokenInput.value = '••••••••••••••••'; // Placeholder to show token exists
        this.geminiTokenInput.placeholder = 'Token is stored (enter new token to update)';
      }
      this.updateGeminiTokenStatus();
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  private async updateGitHubTokenStatus(): Promise<void> {
    const tokenValue = this.githubTokenInput.value.trim();
    const hasToken = await window.electronAPI.settings.hasGitHubToken();
    
    if (hasToken.success && hasToken.hasToken) {
      this.githubTokenStatus.textContent = 'Token is stored';
      this.githubTokenStatus.className = 'token-status token-stored';
    } else if (tokenValue.length > 0) {
      this.githubTokenStatus.textContent = 'Token will be saved';
      this.githubTokenStatus.className = 'token-status token-pending';
    } else {
      this.githubTokenStatus.textContent = 'No token stored';
      this.githubTokenStatus.className = 'token-status token-none';
    }
  }

  private async updateGeminiTokenStatus(): Promise<void> {
    const tokenValue = this.geminiTokenInput.value.trim();
    const hasToken = await window.electronAPI.settings.hasGeminiToken();
    
    if (hasToken.success && hasToken.hasToken) {
      this.geminiTokenStatus.textContent = 'Token is stored';
      this.geminiTokenStatus.className = 'token-status token-stored';
    } else if (tokenValue.length > 0) {
      this.geminiTokenStatus.textContent = 'Token will be saved';
      this.geminiTokenStatus.className = 'token-status token-pending';
    } else {
      this.geminiTokenStatus.textContent = 'No token stored';
      this.geminiTokenStatus.className = 'token-status token-none';
    }
  }

  private async handleSubmit(): Promise<void> {
    try {
      // Get UI theme
      const uiTheme = (document.getElementById('uiTheme') as HTMLSelectElement).value || 'dark';
      
      // Get terminal settings
      const fontSize = parseInt((document.getElementById('fontSize') as HTMLInputElement).value) || 14;
      const fontFamily = (document.getElementById('fontFamily') as HTMLInputElement).value || 'Consolas, "Courier New", monospace';

      // Update settings
      await window.electronAPI.settings.set({
        ui: {
          theme: uiTheme as 'light' | 'dark' | 'auto',
        },
        terminal: {
          fontSize,
          fontFamily,
          theme: 'dark', // Terminal theme (separate from UI theme)
        },
      });

      // Handle GitHub token
      const githubToken = this.githubTokenInput.value.trim();
      if (githubToken && githubToken !== '••••••••••••••••') {
        // Only save if it's a new token (not the placeholder)
        const result = await window.electronAPI.settings.setGitHubToken(githubToken);
        if (!result.success) {
          alert(`Failed to save GitHub token: ${result.error || 'Unknown error'}`);
          return;
        }
      }

      // Handle Gemini token
      const geminiToken = this.geminiTokenInput.value.trim();
      if (geminiToken && geminiToken !== '••••••••••••••••') {
        // Only save if it's a new token (not the placeholder)
        const result = await window.electronAPI.settings.setGeminiToken(geminiToken);
        if (!result.success) {
          alert(`Failed to save Gemini API token: ${result.error || 'Unknown error'}`);
          return;
        }
      }

      this.close(true);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert(`Error saving settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  show(): Promise<{ saved: boolean }> {
    return new Promise((resolve) => {
      this.resolveCallback = resolve;
      this.overlay.style.display = 'flex';
      this.loadSettings();
      (document.getElementById('fontSize') as HTMLInputElement)?.focus();
    });
  }

  private close(saved: boolean): void {
    this.overlay.style.display = 'none';
    if (this.resolveCallback) {
      this.resolveCallback({ saved });
      this.resolveCallback = undefined;
    }
  }
}

export {};

