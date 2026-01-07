export type ConnectionType = 'ssh' | 'rdp' | 'telnet' | 'local';

export interface Session {
  id: string;
  name: string;
  type: ConnectionType;
  host: string;
  port: number;
  username: string;
  keyPath?: string;
  jumpHost?: string;
  portForwarding?: any[];
  customCommands?: string[];
  environmentVariables?: { [key: string]: string };
  terminalSettings?: {
    fontSize?: number;
    fontFamily?: string;
    theme?: string;
  };
  createdAt?: number;
  lastUsed?: number;
}

// Types are declared in renderer.ts

export class SessionDialog {
  private overlay: HTMLElement;
  private dialog: HTMLElement;
  private form: HTMLFormElement;
  private connectionTypeSelect: HTMLSelectElement;
  private sshFields: HTMLElement;
  private authMethodSelect: HTMLSelectElement;
  private passwordGroup: HTMLElement;
  private keyPathGroup: HTMLElement;
  private resolveCallback?: (result: { session?: Session; password?: string; connect: boolean }) => void;

  constructor() {
    this.overlay = document.getElementById('sessionDialogOverlay')!;
    this.dialog = document.getElementById('sessionDialog')!;
    this.form = document.getElementById('sessionForm') as HTMLFormElement;
    this.connectionTypeSelect = document.getElementById('connectionType') as HTMLSelectElement;
    this.sshFields = document.getElementById('sshFields')!;
    this.authMethodSelect = document.getElementById('authMethod') as HTMLSelectElement;
    this.passwordGroup = document.getElementById('passwordGroup')!;
    this.keyPathGroup = document.getElementById('keyPathGroup')!;

    if (!this.overlay || !this.dialog || !this.form || !this.connectionTypeSelect || 
        !this.sshFields || !this.authMethodSelect || !this.passwordGroup || !this.keyPathGroup) {
      throw new Error('SessionDialog: Required DOM elements not found');
    }

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Close button
    document.getElementById('sessionDialogClose')?.addEventListener('click', () => this.close(false));
    document.getElementById('sessionDialogCancel')?.addEventListener('click', () => this.close(false));

    // Overlay click to close
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) {
        this.close(false);
      }
    });

    // Connection type change
    this.connectionTypeSelect.addEventListener('change', () => {
      this.updateFieldsVisibility();
    });

    // Auth method change
    this.authMethodSelect.addEventListener('change', () => {
      const isPassword = this.authMethodSelect.value === 'password';
      this.passwordGroup.style.display = isPassword ? 'block' : 'none';
      this.keyPathGroup.style.display = isPassword ? 'none' : 'block';
      
      // Disable hidden fields to prevent validation errors
      const passwordInput = document.getElementById('password') as HTMLInputElement;
      const keyPathInput = document.getElementById('keyPath') as HTMLInputElement;
      if (passwordInput) {
        passwordInput.disabled = !isPassword;
        passwordInput.required = false;
      }
      if (keyPathInput) {
        keyPathInput.disabled = isPassword;
        keyPathInput.required = false;
      }
    });

    // Form submit
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      // Remove required attribute from all hidden/invisible fields to prevent HTML5 validation errors
      const allInputs = this.form.querySelectorAll('input, select, textarea');
      allInputs.forEach((input) => {
        const element = input as HTMLElement;
        const computedStyle = window.getComputedStyle(element);
        const isHidden = computedStyle.display === 'none' || 
                        computedStyle.visibility === 'hidden' ||
                        element.offsetParent === null;
        if (isHidden) {
          (input as HTMLInputElement).required = false;
          (input as HTMLInputElement).removeAttribute('required');
        }
      });
      this.handleSubmit();
    });

    // Browse key button
    document.getElementById('browseKeyBtn')?.addEventListener('click', () => {
      // TODO: Implement file browser
      alert('File browser not yet implemented. Please enter the full path to your SSH key.');
    });
  }

  private updateFieldsVisibility(): void {
    const connectionType = this.connectionTypeSelect.value as ConnectionType;
    const isSSH = connectionType === 'ssh';
    this.sshFields.style.display = isSSH ? 'block' : 'none';
    
    // Make SSH fields required when SSH is selected, remove required when hidden
    const sshInputs = this.sshFields.querySelectorAll('input[type="text"], input[type="number"]');
    sshInputs.forEach((input) => {
      (input as HTMLInputElement).required = isSSH;
      // Disable hidden required fields to prevent validation errors
      if (!isSSH) {
        (input as HTMLInputElement).disabled = true;
      } else {
        (input as HTMLInputElement).disabled = false;
      }
    });
    
    // Also handle password and keyPath fields
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    const keyPathInput = document.getElementById('keyPath') as HTMLInputElement;
    if (passwordInput) {
      passwordInput.required = false; // Never required at HTML level, validated in JS
      passwordInput.disabled = !isSSH || this.authMethodSelect.value !== 'password';
    }
    if (keyPathInput) {
      keyPathInput.required = false; // Never required at HTML level, validated in JS
      keyPathInput.disabled = !isSSH || this.authMethodSelect.value !== 'key';
    }
  }

  private editingSessionId: string | null = null;

  private async handleSubmit(): Promise<void> {
    const connectionType = this.connectionTypeSelect.value as ConnectionType;
    const sessionName = (document.getElementById('sessionName') as HTMLInputElement).value;
    const saveSession = (document.getElementById('saveSession') as HTMLInputElement).checked;

    let session: Session | undefined;
    let password: string | undefined;

    if (connectionType === 'ssh') {
      const host = (document.getElementById('host') as HTMLInputElement).value;
      const port = parseInt((document.getElementById('port') as HTMLInputElement).value) || 22;
      const username = (document.getElementById('username') as HTMLInputElement).value;
      const authMethod = this.authMethodSelect.value;

      if (!host || !username) {
        alert('Please fill in all required fields');
        return;
      }

      const sessionData: any = {
        name: sessionName || `${username}@${host}`,
        type: 'ssh',
        host,
        port,
        username,
      };

      // If editing, preserve the ID
      if (this.editingSessionId) {
        sessionData.id = this.editingSessionId;
      }

      if (authMethod === 'password') {
        password = (document.getElementById('password') as HTMLInputElement).value;
        // Don't require password if editing (might not want to change it)
        if (!this.editingSessionId && !password) {
          alert('Please enter a password');
          return;
        }
      } else {
        const keyPath = (document.getElementById('keyPath') as HTMLInputElement).value;
        if (!keyPath) {
          alert('Please enter the path to your SSH key');
          return;
        }
        sessionData.keyPath = keyPath;
      }

      if (saveSession || this.editingSessionId) {
        const result = await window.electronAPI.session.save(sessionData, password);
        if (result.success && result.session) {
          session = result.session as Session;
        } else {
          alert(`Failed to save session: ${result.error || 'Unknown error'}`);
          return;
        }
      } else {
        // Create temporary session object for connection
        session = {
          ...sessionData,
          id: 'temp-' + Date.now(),
          createdAt: Date.now(),
        } as Session;
      }
    } else if (connectionType === 'local') {
      if (saveSession || this.editingSessionId) {
        const sessionData: any = {
          name: sessionName || 'Local Terminal',
          type: 'local',
          host: 'localhost',
          port: 0,
          username: '',
        };
        if (this.editingSessionId) {
          sessionData.id = this.editingSessionId;
        }
        const result = await window.electronAPI.session.save(sessionData);
        if (result.success && result.session) {
          session = result.session as Session;
        }
      }
    }

    this.editingSessionId = null;
    this.close(true, session, password);
  }

  show(editSession?: Session): Promise<{ session?: Session; password?: string; connect: boolean }> {
    return new Promise((resolve) => {
      this.resolveCallback = resolve;
      this.overlay.style.display = 'flex';
      this.form.reset();
      
      if (editSession) {
        this.editingSessionId = editSession.id;
        // Populate form with session data for editing
        (document.getElementById('sessionName') as HTMLInputElement).value = editSession.name;
        this.connectionTypeSelect.value = editSession.type;
        (document.getElementById('saveSession') as HTMLInputElement).checked = true;
        this.updateFieldsVisibility();
        
        if (editSession.type === 'ssh') {
          (document.getElementById('host') as HTMLInputElement).value = editSession.host;
          (document.getElementById('port') as HTMLInputElement).value = editSession.port.toString();
          (document.getElementById('username') as HTMLInputElement).value = editSession.username;
          
          if (editSession.keyPath) {
            this.authMethodSelect.value = 'key';
            (document.getElementById('keyPath') as HTMLInputElement).value = editSession.keyPath;
          } else {
            this.authMethodSelect.value = 'password';
          }
          this.authMethodSelect.dispatchEvent(new Event('change'));
        }
        
        // Update dialog title and button
        const title = this.dialog.querySelector('h2');
        if (title) title.textContent = 'Edit Session';
        const connectBtn = document.getElementById('sessionDialogConnect');
        if (connectBtn) connectBtn.textContent = 'Save';
      } else {
        this.editingSessionId = null;
        // Update dialog title for new session
        const title = this.dialog.querySelector('h2');
        if (title) title.textContent = 'New Session';
        const connectBtn = document.getElementById('sessionDialogConnect');
        if (connectBtn) connectBtn.textContent = 'Connect';
      }
      
      this.updateFieldsVisibility();
      (document.getElementById('sessionName') as HTMLInputElement).focus();
    });
  }

  private close(connect: boolean, session?: Session, password?: string): void {
    this.overlay.style.display = 'none';
    if (this.resolveCallback) {
      this.resolveCallback({ session, password, connect });
      this.resolveCallback = undefined;
    }
  }
}

export {};

