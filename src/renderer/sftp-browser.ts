interface FileInfo {
  filename: string;
  longname: string;
  attrs: {
    mode: number;
    uid: number;
    gid: number;
    size: number;
    atime: number;
    mtime: number;
  };
  type: 'd' | '-' | 'l';
}

export class SFTPBrowser {
  private container: HTMLElement;
  private content: HTMLElement;
  private pathElement: HTMLElement;
  private hostElement: HTMLElement;
  private itemCountElement: HTMLElement;
  private currentPath: string = '/';
  private currentTerminalId: string | null = null;
  private selectedFile: FileInfo | null = null;
  private contextMenu: HTMLElement | null = null;
  private toolbar: HTMLElement | null = null;
  private files: FileInfo[] = [];

  constructor() {
    this.container = document.getElementById('sftpBrowser')!;
    this.content = document.getElementById('sftpContent')!;
    this.pathElement = document.getElementById('sftpPath')!;
    this.hostElement = document.getElementById('sftpHost')!;
    this.itemCountElement = document.getElementById('sftpItemCount')!;

    if (!this.container || !this.content || !this.pathElement || !this.hostElement || !this.itemCountElement) {
      throw new Error('SFTPBrowser: Required DOM elements not found');
    }

    this.setupContextMenu();
    this.setupToolbar();
    this.setupGlobalClickHandler();
    this.setupKeyboardShortcuts();
  }

  private setupContextMenu(): void {
    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'context-menu';
    this.contextMenu.style.display = 'none';
    this.contextMenu.style.position = 'fixed';
    document.body.appendChild(this.contextMenu);
  }

  private setupToolbar(): void {
    // Check if toolbar already exists
    let toolbar = this.container.querySelector('.sftp-toolbar') as HTMLElement;
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.className = 'sftp-toolbar';
      this.container.insertBefore(toolbar, this.pathElement);
    }
    this.toolbar = toolbar;

    toolbar.innerHTML = `
      <div class="sftp-nav-buttons">
        <button class="sftp-toolbar-btn" id="sftpBackBtn" title="Go to parent directory">⬅ Back</button>
        <button class="sftp-toolbar-btn" id="sftpHomeBtn" title="Go to root directory">🏠 Home</button>
        <button class="sftp-toolbar-btn" id="sftpRefreshBtn" title="Refresh directory">🔄 Refresh</button>
      </div>
      <div class="sftp-toolbar-separator"></div>
      <div class="sftp-action-buttons">
        <button class="sftp-toolbar-btn" id="sftpDownloadBtn" title="Download">⬇ Download</button>
        <button class="sftp-toolbar-btn" id="sftpRenameBtn" title="Rename">✏ Rename</button>
        <button class="sftp-toolbar-btn" id="sftpDeleteBtn" title="Delete">🗑 Delete</button>
        <button class="sftp-toolbar-btn" id="sftpPermissionsBtn" title="Permissions">🔒 Permissions</button>
      </div>
    `;

    // Navigation buttons
    document.getElementById('sftpBackBtn')?.addEventListener('click', () => {
      this.navigateUp();
    });

    document.getElementById('sftpHomeBtn')?.addEventListener('click', () => {
      this.loadDirectory('/');
    });

    document.getElementById('sftpRefreshBtn')?.addEventListener('click', () => {
      this.loadDirectory(this.currentPath);
    });

    // Action buttons
    document.getElementById('sftpDownloadBtn')?.addEventListener('click', () => {
      if (this.selectedFile && !this.isDirectory(this.selectedFile)) {
        this.downloadFile(this.selectedFile);
      }
    });

    document.getElementById('sftpRenameBtn')?.addEventListener('click', () => {
      if (this.selectedFile) {
        this.showRenameDialog(this.selectedFile);
      }
    });

    document.getElementById('sftpDeleteBtn')?.addEventListener('click', () => {
      if (this.selectedFile) {
        this.deleteFile(this.selectedFile);
      }
    });

    document.getElementById('sftpPermissionsBtn')?.addEventListener('click', () => {
      if (this.selectedFile) {
        this.showPermissionsDialog(this.selectedFile);
      }
    });

    this.updateToolbarState();
  }

  private setupGlobalClickHandler(): void {
    document.addEventListener('click', (e) => {
      if (this.contextMenu && !this.contextMenu.contains(e.target as Node)) {
        this.contextMenu.style.display = 'none';
      }
    });
  }

  private setupKeyboardShortcuts(): void {
    // Only handle shortcuts when SFTP browser is visible
    document.addEventListener('keydown', (e) => {
      if (this.container.style.display === 'none' || !this.currentTerminalId) {
        return;
      }

      // Check if focus is on an input/textarea (don't interfere with typing)
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      // Backspace or Alt+Left Arrow: Go to parent directory
      if ((e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) && this.currentPath !== '/') {
        e.preventDefault();
        this.navigateUp();
      }

      // Home key: Go to root
      if (e.key === 'Home' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        this.loadDirectory('/');
      }

      // F5: Refresh
      if (e.key === 'F5') {
        e.preventDefault();
        this.loadDirectory(this.currentPath);
      }
    });
  }

  show(terminalId: string, host: string): void {
    this.currentTerminalId = terminalId;
    this.hostElement.textContent = host;
    this.container.style.display = 'flex';
    // Delay loading to give SFTP client time to initialize
    setTimeout(() => {
      this.loadDirectory('/');
    }, 100);
  }

  hide(): void {
    this.container.style.display = 'none';
    this.currentTerminalId = null;
    this.currentPath = '/';
    this.selectedFile = null;
    this.updateToolbarState();
  }

  async loadDirectory(path: string, retryCount: number = 0): Promise<void> {
    if (!this.currentTerminalId) {
      return;
    }

    try {
      this.content.innerHTML = '<div class="sftp-loading">Loading...</div>';
      const result = await window.electronAPI.sftp.list(this.currentTerminalId, path);
      if (!result.success || !result.files) {
        // If SFTP is not ready yet, retry with exponential backoff
        const errorMsg = (result.error || '').toLowerCase();
        const isNotAvailable = errorMsg.includes('not available') || 
                              errorMsg.includes('sftp client not available') ||
                              errorMsg.includes('sftp client');
        if (isNotAvailable && retryCount < 10) {
          const delay = Math.min(500 * (retryCount + 1), 2000); // Max 2 seconds
          this.content.innerHTML = `<div class="sftp-loading">Waiting for SFTP connection... (${retryCount + 1}/10)</div>`;
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.loadDirectory(path, retryCount + 1);
        }
        throw new Error(result.error || 'Failed to load directory');
      }
      this.currentPath = path;
      this.pathElement.textContent = path;
      this.pathElement.title = path;
      this.files = result.files;
      this.renderFiles(result.files);
      this.updateItemCount(result.files.length);
      this.selectedFile = null;
      this.updateToolbarState();
      this.updateNavigationState();
    } catch (error: any) {
      // If SFTP is not ready yet, retry with exponential backoff
      const errorMsg = (error.message || '').toLowerCase();
      const isNotAvailable = errorMsg.includes('not available') || 
                            errorMsg.includes('sftp client not available') ||
                            errorMsg.includes('sftp client');
      if (isNotAvailable && retryCount < 10) {
        const delay = Math.min(500 * (retryCount + 1), 2000); // Max 2 seconds
        this.content.innerHTML = `<div class="sftp-loading">Waiting for SFTP connection... (${retryCount + 1}/10)</div>`;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.loadDirectory(path, retryCount + 1);
      }
      console.error('Failed to load directory:', error);
      const errorText = retryCount >= 10 
        ? 'SFTP connection timeout. Please check your connection.'
        : `Error: ${error.message || 'Failed to load directory'}`;
      this.content.innerHTML = `<div style="padding: 12px; color: var(--text-muted); font-size: 12px;">${errorText}</div>`;
    }
  }

  private renderFiles(files: FileInfo[]): void {
    this.content.innerHTML = '';

    // Add parent directory link if not at root
    if (this.currentPath !== '/') {
      const parentItem = this.createFileItem({
        filename: '..',
        longname: '..',
        attrs: {
          mode: 0,
          uid: 0,
          gid: 0,
          size: 0,
          atime: 0,
          mtime: 0,
        },
        type: 'd',
      }, true);
      this.content.appendChild(parentItem);
    }

    // Sort: directories first, then files
    const sorted = [...files].sort((a, b) => {
      if (a.type === 'd' && b.type !== 'd') return -1;
      if (a.type !== 'd' && b.type === 'd') return 1;
      return a.filename.localeCompare(b.filename);
    });

    sorted.forEach(file => {
      const item = this.createFileItem(file, false);
      this.content.appendChild(item);
    });
  }

  private createFileItem(file: FileInfo, isParent: boolean): HTMLElement {
    const item = document.createElement('div');
    item.className = 'sftp-item';
    item.dataset.filename = file.filename;

    const icon = document.createElement('span');
    icon.className = 'sftp-item-icon';
    icon.textContent = this.getFileIcon(file);

    const details = document.createElement('div');
    details.className = 'sftp-item-details';

    const name = document.createElement('span');
    name.className = 'sftp-item-name';
    name.textContent = file.filename;

    const meta = document.createElement('div');
    meta.className = 'sftp-item-meta';
    if (!isParent) {
      meta.innerHTML = `
        <span>${this.formatSize(file.attrs.size)}</span>
        <span>${this.formatPermissions(file.attrs.mode)}</span>
        <span>${this.formatDate(file.attrs.mtime)}</span>
      `;
    }

    details.appendChild(name);
    if (!isParent) {
      details.appendChild(meta);
    }

    item.appendChild(icon);
    item.appendChild(details);

    // Click to select
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFile(file, item);
    });

    // Double click to navigate
    if (file.type === 'd' || isParent) {
      item.addEventListener('dblclick', () => {
        if (isParent) {
          this.navigateUp();
        } else {
          this.navigateTo(file.filename);
        }
      });
    }

    // Right click for context menu
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.selectFile(file, item);
      this.showContextMenu(e, file);
    });

    return item;
  }

  private selectFile(file: FileInfo, item: HTMLElement): void {
    // Remove previous selection
    this.content.querySelectorAll('.sftp-item.selected').forEach(el => {
      el.classList.remove('selected');
    });

    // Add selection
    item.classList.add('selected');
    this.selectedFile = file;
    this.updateToolbarState();
  }

  private showContextMenu(e: MouseEvent, file: FileInfo): void {
    if (!this.contextMenu) return;

    const isDir = this.isDirectory(file);
    this.contextMenu.innerHTML = `
      ${!isDir ? '<div class="context-menu-item" data-action="open">🔓 Open</div>' : ''}
      ${!isDir ? '<div class="context-menu-item" data-action="download">⬇ Download</div>' : ''}
      <div class="context-menu-item" data-action="rename">✏ Rename</div>
      <div class="context-menu-item" data-action="copy">📋 Copy</div>
      <div class="context-menu-item" data-action="move">✂ Move</div>
      <div class="context-menu-item" data-action="permissions">🔒 Permissions</div>
      <div class="context-menu-item context-menu-item-danger" data-action="delete">🗑 Delete</div>
    `;

    this.contextMenu.style.display = 'block';
    this.contextMenu.style.left = `${e.clientX}px`;
    this.contextMenu.style.top = `${e.clientY}px`;

    this.contextMenu.querySelectorAll('.context-menu-item').forEach(menuItem => {
      menuItem.addEventListener('click', () => {
        const action = menuItem.getAttribute('data-action');
        this.handleContextMenuAction(action!, file);
        this.contextMenu!.style.display = 'none';
      });
    });
  }

  private handleContextMenuAction(action: string, file: FileInfo): void {
    switch (action) {
      case 'open':
        if (!this.isDirectory(file)) {
          this.openFile(file);
        }
        break;
      case 'download':
        if (!this.isDirectory(file)) {
          this.downloadFile(file);
        }
        break;
      case 'rename':
        this.showRenameDialog(file);
        break;
      case 'copy':
        this.showCopyDialog(file);
        break;
      case 'move':
        this.showMoveDialog(file);
        break;
      case 'permissions':
        this.showPermissionsDialog(file);
        break;
      case 'delete':
        this.deleteFile(file);
        break;
    }
  }

  private updateToolbarState(): void {
    if (!this.toolbar) return;

    const hasSelection = !!this.selectedFile;
    const isDir = this.selectedFile ? this.isDirectory(this.selectedFile) : false;
    const canGoBack = this.currentPath !== '/';

    // Navigation buttons
    (document.getElementById('sftpBackBtn') as HTMLButtonElement)!.disabled = !canGoBack;
    (document.getElementById('sftpHomeBtn') as HTMLButtonElement)!.disabled = this.currentPath === '/';
    (document.getElementById('sftpRefreshBtn') as HTMLButtonElement)!.disabled = false;

    // Action buttons
    (document.getElementById('sftpDownloadBtn') as HTMLButtonElement)!.disabled = !hasSelection || isDir;
    (document.getElementById('sftpRenameBtn') as HTMLButtonElement)!.disabled = !hasSelection;
    (document.getElementById('sftpDeleteBtn') as HTMLButtonElement)!.disabled = !hasSelection;
    (document.getElementById('sftpPermissionsBtn') as HTMLButtonElement)!.disabled = !hasSelection;
  }

  private async openFile(file: FileInfo): Promise<void> {
    if (!this.currentTerminalId) return;

    const filePath = this.getFilePath(file.filename);
    try {
      // Show loading indicator
      const originalContent = this.content.innerHTML;
      this.content.innerHTML = `<div class="sftp-loading">Opening ${file.filename}...</div>`;
      
      const result = await window.electronAPI.sftp.openFile(this.currentTerminalId, filePath);
      
      // Restore content
      this.content.innerHTML = originalContent;
      this.renderFiles(this.files);
      
      if (result.success) {
        // File opened successfully, no need to show alert
      } else {
        alert(`Failed to open file: ${result.error}`);
      }
    } catch (error: any) {
      // Restore content on error
      this.content.innerHTML = '';
      this.renderFiles(this.files);
      alert(`Error opening file: ${error.message}`);
    }
  }

  private async downloadFile(file: FileInfo): Promise<void> {
    if (!this.currentTerminalId) return;

    const filePath = this.getFilePath(file.filename);
    try {
      const result = await window.electronAPI.sftp.download(this.currentTerminalId, filePath);
      if (result.success) {
        alert(`File downloaded to: ${result.localPath}`);
      } else {
        alert(`Download failed: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Download error: ${error.message}`);
    }
  }

  private async deleteFile(file: FileInfo): Promise<void> {
    if (!this.currentTerminalId) return;
    if (!confirm(`Are you sure you want to delete "${file.filename}"?`)) return;

    const filePath = this.getFilePath(file.filename);
    try {
      const result = await window.electronAPI.sftp.delete(this.currentTerminalId, filePath);
      if (result.success) {
        await this.loadDirectory(this.currentPath);
      } else {
        alert(`Delete failed: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Delete error: ${error.message}`);
    }
  }

  private showRenameDialog(file: FileInfo): void {
    const dialog = this.createDialog('Rename', `
      <div class="form-group">
        <label>New name:</label>
        <input type="text" class="sftp-dialog-input" id="renameInput" value="${file.filename}">
      </div>
    `);

    const input = dialog.querySelector('#renameInput') as HTMLInputElement;
    input.select();

    dialog.querySelector('.sftp-dialog-btn-primary')?.addEventListener('click', async () => {
      const newName = input.value.trim();
      if (!newName || newName === file.filename) {
        this.closeDialog(dialog);
        return;
      }

      await this.renameFile(file, newName);
      this.closeDialog(dialog);
    });
  }

  private async renameFile(file: FileInfo, newName: string): Promise<void> {
    if (!this.currentTerminalId) return;

    const oldPath = this.getFilePath(file.filename);
    const newPath = this.getFilePath(newName);

    try {
      const result = await window.electronAPI.sftp.rename(this.currentTerminalId, oldPath, newPath);
      if (result.success) {
        await this.loadDirectory(this.currentPath);
      } else {
        alert(`Rename failed: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Rename error: ${error.message}`);
    }
  }

  private showCopyDialog(file: FileInfo): void {
    const dialog = this.createDialog('Copy', `
      <div class="form-group">
        <label>Destination path:</label>
        <input type="text" class="sftp-dialog-input" id="copyInput" value="${this.currentPath}/">
      </div>
    `);

    const input = dialog.querySelector('#copyInput') as HTMLInputElement;
    input.select();

    dialog.querySelector('.sftp-dialog-btn-primary')?.addEventListener('click', async () => {
      const destPath = input.value.trim();
      if (!destPath) {
        this.closeDialog(dialog);
        return;
      }

      await this.copyFile(file, destPath);
      this.closeDialog(dialog);
    });
  }

  private async copyFile(file: FileInfo, destPath: string): Promise<void> {
    if (!this.currentTerminalId) return;

    const sourcePath = this.getFilePath(file.filename);
    const finalDestPath = destPath.endsWith('/') 
      ? `${destPath}${file.filename}` 
      : destPath;

    try {
      const result = await window.electronAPI.sftp.copy(this.currentTerminalId, sourcePath, finalDestPath);
      if (result.success) {
        await this.loadDirectory(this.currentPath);
        alert('File copied successfully');
      } else {
        alert(`Copy failed: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Copy error: ${error.message}`);
    }
  }

  private showMoveDialog(file: FileInfo): void {
    const dialog = this.createDialog('Move', `
      <div class="form-group">
        <label>Destination path:</label>
        <input type="text" class="sftp-dialog-input" id="moveInput" value="${this.currentPath}/">
      </div>
    `);

    const input = dialog.querySelector('#moveInput') as HTMLInputElement;
    input.select();

    dialog.querySelector('.sftp-dialog-btn-primary')?.addEventListener('click', async () => {
      const destPath = input.value.trim();
      if (!destPath) {
        this.closeDialog(dialog);
        return;
      }

      await this.moveFile(file, destPath);
      this.closeDialog(dialog);
    });
  }

  private async moveFile(file: FileInfo, destPath: string): Promise<void> {
    if (!this.currentTerminalId) return;

    const oldPath = this.getFilePath(file.filename);
    const newPath = destPath.endsWith('/') 
      ? `${destPath}${file.filename}` 
      : destPath;

    try {
      const result = await window.electronAPI.sftp.rename(this.currentTerminalId, oldPath, newPath);
      if (result.success) {
        await this.loadDirectory(this.currentPath);
        alert('File moved successfully');
      } else {
        alert(`Move failed: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Move error: ${error.message}`);
    }
  }

  private showPermissionsDialog(file: FileInfo): void {
    const mode = file.attrs.mode & 0o777;
    const ownerRead = !!(mode & 0o400);
    const ownerWrite = !!(mode & 0o200);
    const ownerExecute = !!(mode & 0o100);
    const groupRead = !!(mode & 0o040);
    const groupWrite = !!(mode & 0o020);
    const groupExecute = !!(mode & 0o010);
    const otherRead = !!(mode & 0o004);
    const otherWrite = !!(mode & 0o002);
    const otherExecute = !!(mode & 0o001);

    const dialog = this.createDialog('Change Permissions', `
      <div class="permission-editor">
        <div class="permission-group">
          <div class="permission-group-label">Owner</div>
          <div class="permission-checkbox">
            <input type="checkbox" id="perm-owner-read" ${ownerRead ? 'checked' : ''}>
            <label for="perm-owner-read">Read</label>
          </div>
          <div class="permission-checkbox">
            <input type="checkbox" id="perm-owner-write" ${ownerWrite ? 'checked' : ''}>
            <label for="perm-owner-write">Write</label>
          </div>
          <div class="permission-checkbox">
            <input type="checkbox" id="perm-owner-execute" ${ownerExecute ? 'checked' : ''}>
            <label for="perm-owner-execute">Execute</label>
          </div>
        </div>
        <div class="permission-group">
          <div class="permission-group-label">Group</div>
          <div class="permission-checkbox">
            <input type="checkbox" id="perm-group-read" ${groupRead ? 'checked' : ''}>
            <label for="perm-group-read">Read</label>
          </div>
          <div class="permission-checkbox">
            <input type="checkbox" id="perm-group-write" ${groupWrite ? 'checked' : ''}>
            <label for="perm-group-write">Write</label>
          </div>
          <div class="permission-checkbox">
            <input type="checkbox" id="perm-group-execute" ${groupExecute ? 'checked' : ''}>
            <label for="perm-group-execute">Execute</label>
          </div>
        </div>
        <div class="permission-group">
          <div class="permission-group-label">Other</div>
          <div class="permission-checkbox">
            <input type="checkbox" id="perm-other-read" ${otherRead ? 'checked' : ''}>
            <label for="perm-other-read">Read</label>
          </div>
          <div class="permission-checkbox">
            <input type="checkbox" id="perm-other-write" ${otherWrite ? 'checked' : ''}>
            <label for="perm-other-write">Write</label>
          </div>
          <div class="permission-checkbox">
            <input type="checkbox" id="perm-other-execute" ${otherExecute ? 'checked' : ''}>
            <label for="perm-other-execute">Execute</label>
          </div>
        </div>
      </div>
      <div class="permission-octal">
        Octal: <span id="perm-octal-display">${mode.toString(8).padStart(3, '0')}</span>
      </div>
    `);

    const updateOctal = () => {
      const getValue = (id: string) => (dialog.querySelector(`#${id}`) as HTMLInputElement)?.checked ? 1 : 0;
      
      const owner = getValue('perm-owner-read') * 4 + getValue('perm-owner-write') * 2 + getValue('perm-owner-execute');
      const group = getValue('perm-group-read') * 4 + getValue('perm-group-write') * 2 + getValue('perm-group-execute');
      const other = getValue('perm-other-read') * 4 + getValue('perm-other-write') * 2 + getValue('perm-other-execute');
      
      const octal = `${owner}${group}${other}`;
      (dialog.querySelector('#perm-octal-display') as HTMLElement)!.textContent = octal;
    };

    dialog.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', updateOctal);
    });

    dialog.querySelector('.sftp-dialog-btn-primary')?.addEventListener('click', async () => {
      const getValue = (id: string) => (dialog.querySelector(`#${id}`) as HTMLInputElement)?.checked ? 1 : 0;
      
      const owner = getValue('perm-owner-read') * 4 + getValue('perm-owner-write') * 2 + getValue('perm-owner-execute');
      const group = getValue('perm-group-read') * 4 + getValue('perm-group-write') * 2 + getValue('perm-group-execute');
      const other = getValue('perm-other-read') * 4 + getValue('perm-other-write') * 2 + getValue('perm-other-execute');
      
      const octal = parseInt(`${owner}${group}${other}`, 8);
      await this.changePermissions(file, octal);
      this.closeDialog(dialog);
    });
  }

  private async changePermissions(file: FileInfo, mode: number): Promise<void> {
    if (!this.currentTerminalId) return;

    const filePath = this.getFilePath(file.filename);
    try {
      const result = await window.electronAPI.sftp.chmod(this.currentTerminalId, filePath, mode);
      if (result.success) {
        await this.loadDirectory(this.currentPath);
        alert('Permissions updated successfully');
      } else {
        alert(`Permission change failed: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Permission change error: ${error.message}`);
    }
  }

  private createDialog(title: string, content: string): HTMLElement {
    const overlay = document.createElement('div');
    overlay.className = 'sftp-dialog-overlay';
    overlay.innerHTML = `
      <div class="sftp-dialog">
        <div class="sftp-dialog-title">${title}</div>
        ${content}
        <div class="sftp-dialog-actions">
          <button class="sftp-dialog-btn sftp-dialog-btn-secondary">Cancel</button>
          <button class="sftp-dialog-btn sftp-dialog-btn-primary">OK</button>
        </div>
      </div>
    `;

    overlay.querySelector('.sftp-dialog-btn-secondary')?.addEventListener('click', () => {
      this.closeDialog(overlay);
    });

    document.body.appendChild(overlay);
    return overlay;
  }

  private closeDialog(dialog: HTMLElement): void {
    dialog.remove();
  }

  private navigateUp(): void {
    if (this.currentPath === '/') {
      return;
    }

    const parts = this.currentPath.split('/').filter(p => p);
    parts.pop();
    const newPath = parts.length === 0 ? '/' : '/' + parts.join('/');
    this.loadDirectory(newPath);
  }

  private navigateTo(name: string): void {
    const newPath = this.currentPath === '/' 
      ? `/${name}` 
      : `${this.currentPath}/${name}`;
    this.loadDirectory(newPath);
  }

  private getFilePath(filename: string): string {
    return this.currentPath === '/' 
      ? `/${filename}` 
      : `${this.currentPath}/${filename}`;
  }

  private isDirectory(file: FileInfo): boolean {
    return file.type === 'd';
  }

  private getFileIcon(file: FileInfo): string {
    if (file.type === 'd') return '📁';
    if (file.filename.endsWith('.pdf')) return '📄';
    if (file.filename.match(/\.(zip|tar|gz|bz2|xz)$/i)) return '📦';
    if (file.filename.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) return '🖼';
    if (file.filename.match(/\.(mp4|avi|mov|mkv)$/i)) return '🎬';
    if (file.filename.match(/\.(mp3|wav|flac|ogg)$/i)) return '🎵';
    return '📄';
  }

  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  private formatPermissions(mode: number): string {
    const perms = mode & 0o777;
    return perms.toString(8).padStart(3, '0');
  }

  private formatDate(timestamp: number): string {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private updateItemCount(count: number): void {
    this.itemCountElement.textContent = `${count} item${count !== 1 ? 's' : ''}`;
  }

  getCurrentPath(): string {
    return this.currentPath;
  }

  getCurrentTerminalId(): string | null {
    return this.currentTerminalId;
  }

  private updateNavigationState(): void {
    // Update navigation button states based on current path
    this.updateToolbarState();
  }
}

export {};
