interface Session {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  username: string;
  keyPath?: string;
}

export class SessionSidebar {
  private container: HTMLElement;
  private content: HTMLElement;
  private onSessionClick?: (session: Session) => void;
  private onSessionEdit?: (session: Session) => void;
  private onSessionDelete?: (session: Session) => void;
  private activeSessionId: string | null = null;
  private contextMenu: HTMLElement | null = null;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    if (!this.container) {
      throw new Error(`SessionSidebar: Container element '${containerId}' not found`);
    }
    this.content = this.container.querySelector('.sidebar-content') as HTMLElement;
    if (!this.content) {
      throw new Error('SessionSidebar: Content element not found');
    }
    this.setupEventListeners();
    this.loadSessions();
  }

  setOnSessionClick(callback: (session: Session) => void): void {
    this.onSessionClick = callback;
  }

  setOnSessionEdit(callback: (session: Session) => void): void {
    this.onSessionEdit = callback;
  }

  setOnSessionDelete(callback: (session: Session) => void): void {
    this.onSessionDelete = callback;
  }

  setActiveSession(sessionId: string | null): void {
    this.activeSessionId = sessionId;
    this.updateActiveState();
  }

  private setupEventListeners(): void {
    // Refresh button (search button repurposed for now)
    const searchBtn = document.getElementById('sidebarSearchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.loadSessions();
      });
    }
  }

  private async loadSessions(): Promise<void> {
    try {
      const sessions = await window.electronAPI.session.list();
      this.renderSessions(sessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      this.content.innerHTML = '<div style="padding: 12px; color: #858585; font-size: 12px;">Failed to load sessions</div>';
    }
  }

  private renderSessions(sessions: Session[]): void {
    this.content.innerHTML = '';

    if (sessions.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.style.padding = '12px';
      emptyState.style.color = '#858585';
      emptyState.style.fontSize = '12px';
      emptyState.textContent = 'No saved sessions';
      this.content.appendChild(emptyState);
      return;
    }

    // Group sessions by type
    const grouped: { [key: string]: Session[] } = {};
    sessions.forEach(session => {
      const type = session.type || 'other';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(session);
    });

    // Render grouped sessions
    Object.keys(grouped).forEach(type => {
      const section = document.createElement('div');
      section.className = 'sidebar-section';

      const title = document.createElement('div');
      title.className = 'sidebar-section-title';
      title.textContent = this.getTypeLabel(type);
      section.appendChild(title);

      grouped[type].forEach(session => {
        const item = this.createSessionItem(session);
        section.appendChild(item);
      });

      this.content.appendChild(section);
    });
  }

  private getTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      ssh: 'SSH Sessions',
      local: 'Local Sessions',
      rdp: 'RDP Sessions',
      telnet: 'Telnet Sessions',
    };
    return labels[type] || 'Other Sessions';
  }

  private getTypeIcon(type: string): string {
    const icons: { [key: string]: string } = {
      ssh: '🖥️',
      local: '💻',
      rdp: '🖥️',
      telnet: '📡',
    };
    return icons[type] || '📁';
  }

  private createSessionItem(session: Session): HTMLElement {
    const item = document.createElement('div');
    item.className = 'session-item';
    item.setAttribute('data-session-id', session.id);
    if (session.id === this.activeSessionId) {
      item.classList.add('active');
    }

    const icon = document.createElement('span');
    icon.className = 'session-item-icon';
    icon.textContent = this.getTypeIcon(session.type);

    const info = document.createElement('div');
    info.className = 'session-item-info';

    const name = document.createElement('div');
    name.className = 'session-item-name';
    name.textContent = session.name || `${session.username}@${session.host}`;

    const host = document.createElement('div');
    host.className = 'session-item-host';
    if (session.type === 'ssh') {
      host.textContent = `${session.host}:${session.port} (SSH)`;
    } else if (session.type === 'local') {
      host.textContent = 'Local Terminal';
    } else {
      host.textContent = session.host || 'Unknown';
    }

    info.appendChild(name);
    info.appendChild(host);
    item.appendChild(icon);
    item.appendChild(info);

    // Left click to connect
    item.addEventListener('click', (e) => {
      if (e.button === 0 && !(e.target as HTMLElement).closest('.context-menu')) {
        if (this.onSessionClick) {
          this.onSessionClick(session);
        }
      }
    });

    // Right click for context menu
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e.clientX, e.clientY, session);
    });

    return item;
  }

  private showContextMenu(x: number, y: number, session: Session): void {
    // Remove existing context menu
    if (this.contextMenu) {
      this.contextMenu.remove();
    }

    // Create context menu
    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'context-menu';
    this.contextMenu.style.position = 'fixed';
    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    this.contextMenu.style.zIndex = '10000';

    // Edit option
    const editOption = document.createElement('div');
    editOption.className = 'context-menu-item';
    editOption.textContent = 'Edit';
    editOption.addEventListener('click', () => {
      if (this.onSessionEdit) {
        this.onSessionEdit(session);
      }
      this.hideContextMenu();
    });
    this.contextMenu.appendChild(editOption);

    // Delete option
    const deleteOption = document.createElement('div');
    deleteOption.className = 'context-menu-item context-menu-item-danger';
    deleteOption.textContent = 'Delete';
    deleteOption.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete session "${session.name}"?`)) {
        if (this.onSessionDelete) {
          await this.onSessionDelete(session);
        }
      }
      this.hideContextMenu();
    });
    this.contextMenu.appendChild(deleteOption);

    document.body.appendChild(this.contextMenu);

    // Hide on click outside
    const hideOnClick = (e: MouseEvent) => {
      if (!this.contextMenu?.contains(e.target as Node)) {
        this.hideContextMenu();
        document.removeEventListener('click', hideOnClick);
      }
    };
    setTimeout(() => document.addEventListener('click', hideOnClick), 0);
  }

  private hideContextMenu(): void {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  private updateActiveState(): void {
    const items = this.content.querySelectorAll('.session-item');
    items.forEach(item => {
      item.classList.remove('active');
    });
  }

  async refresh(): Promise<void> {
    await this.loadSessions();
    this.updateActiveState();
  }
}

export {};

