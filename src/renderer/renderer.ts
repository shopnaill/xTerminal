// xterm and FitAddon are loaded from CDN as global objects
declare const Terminal: any;
declare const FitAddon: any;

interface TerminalTab {
  id: string;
  terminal: any;
  fitAddon: any;
  wrapper: HTMLDivElement;
  button: HTMLButtonElement;
  title: string;
  sessionId?: string;
  session?: Session;
}

interface Session {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  username: string;
  keyPath?: string;
}


class TerminalApp {
  private tabs: Map<string, TerminalTab> = new Map();
  private activeTabId: string | null = null;
  private tabCounter: number = 1;
  private tabBar: HTMLElement;
  private terminalContainer: HTMLElement;
  private newTabBtn: HTMLElement;
  private sessionDialog: any;
  private sessionSidebar: any;
  private sftpBrowser: any;
  private chatAgent: any;
  private updateDialog: any;
  private sidebarWidth: number = 240;
  private isResizing: boolean = false;

  constructor() {
    console.log('TerminalApp: Initializing...');
    console.log('TerminalApp: Terminal available?', typeof Terminal !== 'undefined');
    console.log('TerminalApp: FitAddon available?', typeof FitAddon !== 'undefined');
    console.log('TerminalApp: electronAPI available?', typeof window.electronAPI !== 'undefined');
    
    this.tabBar = document.getElementById('tabBar')!;
    this.terminalContainer = document.getElementById('terminalContainer')!;
    this.newTabBtn = document.getElementById('newTabBtn')!;

    if (!this.tabBar || !this.terminalContainer || !this.newTabBtn) {
      console.error('TerminalApp: Required DOM elements not found!');
      console.error('tabBar:', !!this.tabBar, 'terminalContainer:', !!this.terminalContainer, 'newTabBtn:', !!this.newTabBtn);
      return;
    }

    this.setupEventListeners();
    this.setupIPCListeners();
    this.setupResizableSidebar();
    this.createNewTab();
    
    // Initialize components after a short delay to ensure scripts are loaded
    setTimeout(() => {
      this.initComponents();
    }, 100);
    
    console.log('TerminalApp: Initialized successfully');
  }

  private async initComponents(): Promise<void> {
    // Initialize session dialog
    await this.initSessionDialog();
    
    // Initialize session sidebar
    try {
      const { SessionSidebar } = await import('./session-sidebar.js');
      this.sessionSidebar = new SessionSidebar('sessionSidebar');
      this.sessionSidebar.setOnSessionClick(async (session: Session) => {
        const passwordResult = await window.electronAPI.session.getPassword(session.id);
        const password = passwordResult.success && passwordResult.password ? passwordResult.password : undefined;
        await this.createSessionTab(session, password);
      });
      this.sessionSidebar.setOnSessionEdit(async (session: Session) => {
        await this.editSession(session);
      });
      this.sessionSidebar.setOnSessionDelete(async (session: Session) => {
        await this.deleteSession(session);
      });
    } catch (error) {
      console.error('Failed to load SessionSidebar:', error);
    }

    // Initialize SFTP browser
    try {
      const { SFTPBrowser } = await import('./sftp-browser.js');
      this.sftpBrowser = new SFTPBrowser();
    } catch (error) {
      console.error('Failed to load SFTPBrowser:', error);
    }

    // Initialize Chat Agent
    try {
      const { ChatAgent } = await import('./chat-agent.js');
      this.chatAgent = new ChatAgent();
    } catch (error) {
      console.error('Failed to load ChatAgent:', error);
    }

    // Initialize Update Dialog
    try {
      const { UpdateDialog } = await import('./update-dialog.js');
      this.updateDialog = new UpdateDialog();
    } catch (error) {
      console.error('Failed to load UpdateDialog:', error);
    }

    // Setup toolbar buttons
    this.setupToolbar();
    
    // Load and apply theme
    this.loadAndApplyTheme();
    
    // Setup git clone dialog listener
    window.addEventListener('open-settings', () => {
      this.showSettingsDialog();
    });
  }
  
  private async loadAndApplyTheme(): Promise<void> {
    try {
      const settings = await window.electronAPI.settings.get();
      this.applyTheme(settings.ui?.theme || 'dark');
    } catch (error) {
      console.error('Failed to load theme:', error);
      this.applyTheme('dark');
    }
  }
  
  private applyTheme(theme: 'light' | 'dark' | 'auto'): void {
    let effectiveTheme: 'light' | 'dark' = theme === 'auto' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    
    // Listen for system theme changes if auto mode
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handleChange);
    }
  }

  private async initSessionDialog(): Promise<void> {
    // Dynamically import SessionDialog
    try {
      const { SessionDialog } = await import('./session-dialog.js');
      this.sessionDialog = new SessionDialog();
      console.log('SessionDialog initialized successfully');
    } catch (error) {
      console.error('Failed to load SessionDialog:', error);
    }
  }

  private setupEventListeners(): void {
    this.newTabBtn.addEventListener('click', () => {
      this.createNewTab();
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      this.resizeActiveTerminal();
    });
  }

  private setupResizableSidebar(): void {
    const resizer = document.getElementById('sidebarResizer');
    const sidebar = document.getElementById('sessionSidebar');
    
    if (!resizer || !sidebar) {
      return;
    }

    // Load saved width from localStorage
    const savedWidth = localStorage.getItem('sidebarWidth');
    if (savedWidth) {
      this.sidebarWidth = parseInt(savedWidth, 10);
      sidebar.style.width = `${this.sidebarWidth}px`;
    }

    resizer.addEventListener('mousedown', (e) => {
      this.isResizing = true;
      resizer.classList.add('resizing');
      e.preventDefault();
    });

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isResizing) return;
      
      const newWidth = e.clientX;
      const minWidth = 150;
      const maxWidth = 500;
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        this.sidebarWidth = newWidth;
        sidebar!.style.width = `${newWidth}px`;
      }
    };

    const handleMouseUp = () => {
      if (this.isResizing) {
        this.isResizing = false;
        resizer.classList.remove('resizing');
        localStorage.setItem('sidebarWidth', this.sidebarWidth.toString());
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  private setupToolbar(): void {
    const sessionBtn = document.getElementById('toolbarSessionBtn');
    const serversBtn = document.getElementById('toolbarServersBtn');
    const settingsBtn = document.getElementById('toolbarSettingsBtn');
    const cloneBtn = document.getElementById('toolbarCloneBtn');
    const chatBtn = document.getElementById('toolbarChatBtn');

    if (sessionBtn) {
      sessionBtn.addEventListener('click', () => {
        this.showSessionDialog();
      });
    }

    if (serversBtn) {
      serversBtn.addEventListener('click', () => {
        // TODO: Show server management
        console.log('Servers button clicked');
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', async () => {
        await this.showSettingsDialog();
      });
    }

    if (chatBtn) {
      chatBtn.addEventListener('click', () => {
        if (this.chatAgent) {
          const terminalId = this.activeTabId;
          if (terminalId) {
            this.chatAgent.setTerminalId(terminalId);
          }
          this.chatAgent.show(terminalId || undefined);
        }
      });
    }

    if (cloneBtn) {
      cloneBtn.addEventListener('click', async () => {
        await this.showGitCloneDialog();
      });
    }
  }

  private async showGitCloneDialog(): Promise<void> {
    try {
      const { GitCloneDialog } = await import('./git-clone-dialog.js');
      const cloneDialog = new GitCloneDialog();
      const result = await cloneDialog.show();
      
      if (result.clone && result.repo) {
        // Get the command from backend
        const commandResult = await window.electronAPI.git.clone(result.repo, result.directory || undefined);
        
        if (commandResult.success && commandResult.command) {
          // Get active terminal tab
          const activeTab = this.tabs.get(this.activeTabId || '');
          if (activeTab) {
            // Send command to terminal
            await window.electronAPI.terminal.write(this.activeTabId!, commandResult.command + '\r\n');
          } else {
            alert('No active terminal. Please open a terminal tab first.');
          }
        } else {
          alert(`Failed to prepare clone command: ${commandResult.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Failed to show git clone dialog:', error);
      alert(`Failed to open git clone dialog: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async showSettingsDialog(): Promise<void> {
    try {
      const { SettingsDialog } = await import('./settings-dialog.js');
      const settingsDialog = new SettingsDialog();
      const result = await settingsDialog.show();
      
      // Reload theme if settings were saved
      if (result.saved) {
        await this.loadAndApplyTheme();
      }
    } catch (error) {
      console.error('Failed to show settings dialog:', error);
      alert(`Failed to open settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async editSession(session: Session): Promise<void> {
    try {
      if (!this.sessionDialog) {
        await this.initSessionDialog();
      }
      if (!this.sessionDialog) {
        console.error('SessionDialog failed to initialize');
        return;
      }
      
      const result = await this.sessionDialog.show(session);
      if (result.connect && result.session) {
        // Update existing session
        const updateResult = await window.electronAPI.session.save({
          ...result.session,
          id: session.id, // Preserve the ID
        }, result.password);
        
        if (updateResult.success) {
          // Refresh sidebar
          if (this.sessionSidebar) {
            await this.sessionSidebar.refresh();
          }
          // If password was provided, update it
          if (result.password) {
            await window.electronAPI.session.setPassword(session.id, result.password);
          }
        } else {
          alert(`Failed to update session: ${updateResult.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error editing session:', error);
      alert(`Error editing session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async deleteSession(session: Session): Promise<void> {
    try {
      const result = await window.electronAPI.session.delete(session.id);
      if (result.success) {
        // Refresh sidebar
        if (this.sessionSidebar) {
          await this.sessionSidebar.refresh();
        }
      } else {
        alert(`Failed to delete session: ${(result as any).error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert(`Error deleting session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async showSessionDialog(): Promise<void> {
    try {
      if (!this.sessionDialog) {
        await this.initSessionDialog();
      }
      if (!this.sessionDialog) {
        console.error('SessionDialog failed to initialize');
        alert('Failed to load session dialog. Please check the console for errors.');
        return;
      }
      const result = await this.sessionDialog.show();
      if (result.connect && result.session) {
        await this.createSessionTab(result.session, result.password);
      }
    } catch (error) {
      console.error('Error showing session dialog:', error);
      alert(`Error opening session dialog: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createSessionTab(session: Session, password?: string): Promise<void> {
    const id = this.generateTabId();
    const title = session.name || `${session.username}@${session.host}`;

    // Create terminal wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'terminal-wrapper';
    wrapper.id = `terminal-${id}`;
    this.terminalContainer.appendChild(wrapper);

    // Create xterm terminal
    const terminal = new Terminal({
      theme: {
        background: '#0d0d0d', /* X Engine dark background */
        foreground: '#00ff88', /* Professional green text */
        cursor: '#00ff88', /* Professional green cursor */
        selection: '#00a8ff', /* Professional blue selection */
        black: '#000000',
        red: '#ff4444',
        green: '#00ff88', /* Professional green */
        yellow: '#ffd700',
        blue: '#00a8ff', /* Neon blue */
        magenta: '#ff00ff',
        cyan: '#00d4ff', /* Bright neon blue */
        white: '#e8eaf6',
        brightBlack: '#666666',
        brightRed: '#ff6666',
        brightGreen: '#33ffaa', /* Bright professional green */
        brightYellow: '#ffff00',
        brightBlue: '#00d4ff', /* Bright neon blue */
        brightMagenta: '#ff66ff',
        brightCyan: '#66ffff',
        brightWhite: '#ffffff',
      },
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
    });

    // FitAddon might be on self or window
    const FitAddonModule = (window as any).FitAddon || (self as any).FitAddon;
    if (!FitAddonModule) {
      console.error('FitAddon module not found on window!');
      throw new Error('FitAddon is not available');
    }
    
    // The actual class is at FitAddon.FitAddon (ES module export)
    const FitAddonClass = FitAddonModule.FitAddon || FitAddonModule.default || FitAddonModule;
    if (!FitAddonClass || typeof FitAddonClass !== 'function') {
      console.error('FitAddon class not found! Module:', FitAddonModule);
      throw new Error('FitAddon class is not available');
    }
    
    // FitAddon should be a class constructor
    const fitAddon = new FitAddonClass();
    terminal.loadAddon(fitAddon);
    
    // Load autocomplete addon
    try {
      const { AutocompleteAddon } = await import('./autocomplete-addon.js');
      const autocompleteAddon = new AutocompleteAddon(id);
      terminal.loadAddon(autocompleteAddon);
    } catch (error) {
      console.error('Failed to load autocomplete addon:', error);
    }
    
    terminal.open(wrapper);
    
    // Setup context menu for terminal
    this.setupTerminalContextMenu(wrapper, terminal, id);

    // Create tab button
    const button = document.createElement('button');
    button.className = 'tab-button';
    button.innerHTML = `
      <span class="tab-title">${title}</span>
      <button class="tab-close" data-tab-id="${id}">×</button>
    `;

    // Insert before new tab button
    this.tabBar.insertBefore(button, this.newTabBtn);

    // Setup tab button events
    button.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('tab-close')) {
        e.stopPropagation();
        const tabId = (e.target as HTMLElement).getAttribute('data-tab-id');
        if (tabId) {
          this.closeTab(tabId);
        }
      } else {
        this.switchTab(id);
      }
    });

    // Setup terminal input
    terminal.onData((data: string) => {
      window.electronAPI.terminal.write(id, data);
    });

    const tab: TerminalTab = {
      id,
      terminal,
      fitAddon,
      wrapper,
      button,
      title,
      sessionId: session.id,
      session,
    };

    this.tabs.set(id, tab);
    this.switchTab(id);

    // Fit terminal and create backend session
    setTimeout(async () => {
      fitAddon.fit();
      const cols = terminal.cols;
      const rows = terminal.rows;
      const result = await window.electronAPI.terminal.create(id, cols, rows, session.id, password);
      if (!result.success) {
        terminal.writeln(`\r\n\x1b[31mFailed to connect: ${(result as any).error || 'Unknown error'}\x1b[0m`);
      } else {
        // Refresh session sidebar to update last used
        if (this.sessionSidebar) {
          await this.sessionSidebar.refresh();
        }
      }
    }, 100);
  }

  private setupIPCListeners(): void {
    // Listen for terminal data
    window.electronAPI.onTerminalData((id: string, data: string) => {
      const tab = this.tabs.get(id);
      if (tab) {
        tab.terminal.write(data);
      }
    });

    // Listen for terminal exit
    window.electronAPI.onTerminalExit((id: string, info: { code: number; signal?: number }) => {
      this.closeTab(id);
    });

    // Listen for terminal errors
    window.electronAPI.onTerminalError((id: string, error: string) => {
      const tab = this.tabs.get(id);
      if (tab) {
        tab.terminal.writeln(`\r\n\x1b[31mError: ${error}\x1b[0m`);
      }
    });

    // Listen for SFTP ready
    window.electronAPI.onSFTPReady((id: string) => {
      // Reload SFTP browser if it's currently showing this terminal
      if (this.sftpBrowser && this.sftpBrowser.getCurrentTerminalId() === id) {
        this.sftpBrowser.loadDirectory(this.sftpBrowser.getCurrentPath());
      }
    });
  }

  private generateTabId(): string {
    return `tab-${Date.now()}-${this.tabCounter++}`;
  }

  private async createNewTab(session?: Session, password?: string): Promise<void> {
    const id = this.generateTabId();
    const title = session ? (session.name || `${session.username}@${session.host}`) : `Terminal ${this.tabs.size + 1}`;

    // Create terminal wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'terminal-wrapper';
    wrapper.id = `terminal-${id}`;
    this.terminalContainer.appendChild(wrapper);

    // Create xterm terminal
    const terminal = new Terminal({
      theme: {
        background: '#0d0d0d', /* X Engine dark background */
        foreground: '#00ff88', /* Professional green text */
        cursor: '#00ff88', /* Professional green cursor */
        selection: '#00a8ff', /* Professional blue selection */
        black: '#000000',
        red: '#ff4444',
        green: '#00ff88', /* Professional green */
        yellow: '#ffd700',
        blue: '#00a8ff', /* Neon blue */
        magenta: '#ff00ff',
        cyan: '#00d4ff', /* Bright neon blue */
        white: '#e8eaf6',
        brightBlack: '#666666',
        brightRed: '#ff6666',
        brightGreen: '#33ffaa', /* Bright professional green */
        brightYellow: '#ffff00',
        brightBlue: '#00d4ff', /* Bright neon blue */
        brightMagenta: '#ff66ff',
        brightCyan: '#66ffff',
        brightWhite: '#ffffff',
      },
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
    });

    // FitAddon is wrapped in an ES module object, so we need to access FitAddon.FitAddon
    const FitAddonModule = (window as any).FitAddon;
    if (!FitAddonModule) {
      console.error('FitAddon module not found on window!');
      throw new Error('FitAddon is not available');
    }
    
    // The actual class is at FitAddon.FitAddon (ES module export)
    const FitAddonClass = FitAddonModule.FitAddon || FitAddonModule.default || FitAddonModule;
    if (!FitAddonClass || typeof FitAddonClass !== 'function') {
      console.error('FitAddon class not found! Module:', FitAddonModule);
      throw new Error('FitAddon class is not available');
    }
    
    // FitAddon should be a class constructor
    const fitAddon = new FitAddonClass();
    terminal.loadAddon(fitAddon);
    
    // Load autocomplete addon
    try {
      const { AutocompleteAddon } = await import('./autocomplete-addon.js');
      const autocompleteAddon = new AutocompleteAddon(id);
      terminal.loadAddon(autocompleteAddon);
    } catch (error) {
      console.error('Failed to load autocomplete addon:', error);
    }
    
    terminal.open(wrapper);
    
    // Setup context menu for terminal
    this.setupTerminalContextMenu(wrapper, terminal, id);

    // Create tab button
    const button = document.createElement('button');
    button.className = 'tab-button';
    button.innerHTML = `
      <span class="tab-title">${title}</span>
      <button class="tab-close" data-tab-id="${id}">×</button>
    `;

    // Insert before new tab button
    this.tabBar.insertBefore(button, this.newTabBtn);

    // Setup tab button events
    button.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('tab-close')) {
        e.stopPropagation();
        const tabId = (e.target as HTMLElement).getAttribute('data-tab-id');
        if (tabId) {
          this.closeTab(tabId);
        }
      } else {
        this.switchTab(id);
      }
    });

    // Setup terminal input
    terminal.onData((data: string) => {
      window.electronAPI.terminal.write(id, data);
    });

    const tab: TerminalTab = {
      id,
      terminal,
      fitAddon,
      wrapper,
      button,
      title,
      sessionId: session?.id,
      session,
    };

    this.tabs.set(id, tab);
    this.switchTab(id);

    // Fit terminal and create backend session
    setTimeout(async () => {
      fitAddon.fit();
      const cols = terminal.cols;
      const rows = terminal.rows;
      if (session) {
        const result = await window.electronAPI.terminal.create(id, cols, rows, session.id, password);
        if (!result.success) {
          terminal.writeln(`\r\n\x1b[31mFailed to connect: ${(result as any).error || 'Unknown error'}\x1b[0m`);
        }
      } else {
        await window.electronAPI.terminal.create(id, cols, rows);
      }
    }, 100);
  }

  private switchTab(id: string): void {
    if (!this.tabs.has(id)) {
      return;
    }

    // Update active states
    if (this.activeTabId) {
      const prevTab = this.tabs.get(this.activeTabId);
      if (prevTab) {
        prevTab.button.classList.remove('active');
        prevTab.wrapper.classList.remove('active');
      }
    }

    const tab = this.tabs.get(id);
    if (tab) {
      tab.button.classList.add('active');
      tab.wrapper.classList.add('active');
      this.activeTabId = id;

      // Update chat agent with new terminal ID
      if (this.chatAgent) {
        this.chatAgent.setTerminalId(id);
      }

      // Update session sidebar active state
      if (this.sessionSidebar && tab.sessionId) {
        this.sessionSidebar.setActiveSession(tab.sessionId);
      }

      // Show/hide SFTP browser based on session type
      if (this.sftpBrowser) {
        if (tab.session && tab.session.type === 'ssh') {
          const host = `${tab.session.host}:${tab.session.port}`;
          // Show browser immediately, but it will retry loading until SFTP is ready
          this.sftpBrowser.show(id, host);
        } else {
          this.sftpBrowser.hide();
        }
      }

      // Update status bar
      this.updateStatusBar(tab.session);

      // Resize terminal when switching
      setTimeout(() => {
        tab.fitAddon.fit();
        const cols = tab.terminal.cols;
        const rows = tab.terminal.rows;
        window.electronAPI.terminal.resize(id, cols, rows);
      }, 50);
    }
  }

  private updateStatusBar(session?: Session): void {
    const statusConnection = document.getElementById('statusConnection');
    if (statusConnection) {
      if (session) {
        if (session.type === 'ssh') {
          statusConnection.textContent = `${session.username}@${session.host}:${session.port}`;
        } else {
          statusConnection.textContent = session.name || 'Local Terminal';
        }
      } else {
        statusConnection.textContent = 'Disconnected';
      }
    }
  }

  private async closeTab(id: string): Promise<void> {
    const tab = this.tabs.get(id);
    if (!tab) {
      return;
    }

    // Destroy backend terminal
    await window.electronAPI.terminal.destroy(id);

    // Remove from DOM
    tab.button.remove();
    tab.wrapper.remove();
    tab.terminal.dispose();

    // Remove from map
    this.tabs.delete(id);

    // Switch to another tab if this was active
    if (this.activeTabId === id) {
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        this.switchTab(remainingTabs[remainingTabs.length - 1]);
      } else {
        this.activeTabId = null;
        // Create a new tab if all are closed
        this.createNewTab();
      }
    }
  }

  private setupTerminalContextMenu(wrapper: HTMLDivElement, terminal: any, terminalId: string): void {
    let contextMenu: HTMLElement | null = null;

    wrapper.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      
      // Remove existing context menu if any
      if (contextMenu) {
        contextMenu.remove();
      }

      // Create context menu
      contextMenu = document.createElement('div');
      contextMenu.className = 'terminal-context-menu';
      contextMenu.style.position = 'fixed';
      contextMenu.style.left = `${e.clientX}px`;
      contextMenu.style.top = `${e.clientY}px`;
      contextMenu.style.zIndex = '10000';

      // Copy option
      const copyOption = document.createElement('div');
      copyOption.className = 'context-menu-item';
      copyOption.textContent = 'Copy';
      copyOption.addEventListener('click', () => {
        const selection = terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection).then(() => {
            console.log('Copied to clipboard:', selection);
          }).catch(err => {
            console.error('Failed to copy:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = selection;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.select();
            try {
              document.execCommand('copy');
              document.body.removeChild(textArea);
            } catch (err) {
              console.error('Fallback copy failed:', err);
              document.body.removeChild(textArea);
            }
          });
        }
        if (contextMenu) {
          contextMenu.remove();
          contextMenu = null;
        }
      });
      contextMenu.appendChild(copyOption);

      // Paste option
      const pasteOption = document.createElement('div');
      pasteOption.className = 'context-menu-item';
      pasteOption.textContent = 'Paste';
      pasteOption.addEventListener('click', async () => {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            // Write to terminal
            const tab = this.tabs.get(terminalId);
            if (tab) {
              await window.electronAPI.terminal.write(terminalId, text);
            }
          }
        } catch (err) {
          console.error('Failed to paste:', err);
          // Fallback: try to get clipboard data from event (won't work for async clipboard API)
          alert('Paste failed. Please use Ctrl+V or Cmd+V to paste.');
        }
        if (contextMenu) {
          contextMenu.remove();
          contextMenu = null;
        }
      });
      contextMenu.appendChild(pasteOption);

      // Select All option
      const selectAllOption = document.createElement('div');
      selectAllOption.className = 'context-menu-item';
      selectAllOption.textContent = 'Select All';
      selectAllOption.addEventListener('click', () => {
        // Select all text in terminal
        terminal.selectAll();
        if (contextMenu) {
          contextMenu.remove();
          contextMenu = null;
        }
      });
      contextMenu.appendChild(selectAllOption);

      document.body.appendChild(contextMenu);

      // Hide on click outside
      const hideOnClick = (e: MouseEvent) => {
        if (!contextMenu?.contains(e.target as Node)) {
          if (contextMenu) {
            contextMenu.remove();
            contextMenu = null;
          }
          document.removeEventListener('click', hideOnClick);
        }
      };
      setTimeout(() => document.addEventListener('click', hideOnClick), 0);
    });
  }

  private resizeActiveTerminal(): void {
    if (this.activeTabId) {
      const tab = this.tabs.get(this.activeTabId);
      if (tab) {
        tab.fitAddon.fit();
        const cols = tab.terminal.cols;
        const rows = tab.terminal.rows;
        window.electronAPI.terminal.resize(this.activeTabId, cols, rows);
      }
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new TerminalApp();
  });
} else {
  new TerminalApp();
}

// Export nothing - this is a script file
export {};

