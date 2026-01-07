/// <reference path="./types.d.ts" />

// Custom xterm.js addon for autocomplete functionality
export class AutocompleteAddon {
  private terminal: any;
  private terminalId: string;
  private overlay: HTMLElement | null = null;
  private suggestions: string[] = [];
  private selectedIndex: number = 0;
  private isVisible: boolean = false;
  private currentPrefix: string = '';
  private keyHandler: ((event: KeyboardEvent) => boolean) | null = null;

  constructor(terminalId: string) {
    this.terminalId = terminalId;
  }

  activate(terminal: any): void {
    console.log('AutocompleteAddon: Activating for terminal', this.terminalId);
    this.terminal = terminal;
    this.createOverlay();
    this.setupKeyHandlers();
    console.log('AutocompleteAddon: Activated successfully');
  }

  dispose(): void {
    if (this.keyHandler && this.terminal) {
      // Remove key handler if possible
      // Note: xterm.js doesn't provide a way to remove custom key handlers
      // but dispose is called when terminal is destroyed anyway
    }
    // Remove global key handler if it exists
    const globalHandler = (this as any)._globalKeyHandler;
    if (globalHandler) {
      document.removeEventListener('keydown', globalHandler);
      delete (this as any)._globalKeyHandler;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private createOverlay(): void {
    this.overlay = document.createElement('div');
    this.overlay.className = 'autocomplete-overlay';
    this.overlay.style.display = 'none';
    this.overlay.setAttribute('data-autocomplete-terminal', this.terminalId);
    document.body.appendChild(this.overlay);
    console.log('AutocompleteAddon: Overlay created and added to DOM', this.overlay);
  }

  private setupKeyHandlers(): void {
    // Intercept Tab key and navigation keys when overlay is visible
    this.keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
        // Check if we're in the terminal (not in an input field)
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return true; // Let default behavior happen
        }

        console.log('AutocompleteAddon: Tab key pressed, handling autocomplete');
        event.preventDefault();
        event.stopPropagation();
        this.handleTabKey();
        return false;
      }

      if (this.isVisible) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          event.stopPropagation();
          this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
          this.updateOverlay();
          return false;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          event.stopPropagation();
          this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
          this.updateOverlay();
          return false;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          this.selectSuggestion();
          return false;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          this.hideOverlay();
          return false;
        }
      }

      return true;
    };
    
    // Try xterm.js key handler first
    if (this.terminal && typeof this.terminal.attachCustomKeyEventHandler === 'function') {
      this.terminal.attachCustomKeyEventHandler(this.keyHandler);
      console.log('AutocompleteAddon: Key handler attached via attachCustomKeyEventHandler');
    } else {
      console.warn('AutocompleteAddon: attachCustomKeyEventHandler not available on terminal');
    }
    
    // Also add a global keydown listener as fallback (but check if terminal element is focused)
    const globalKeyHandler = (event: KeyboardEvent) => {
      // Only handle if terminal is focused
      const terminalElement = this.terminal?.element;
      if (!terminalElement || !terminalElement.contains(document.activeElement)) {
        return;
      }
      
      // Check if we're not in an input field
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      
      // Call our key handler
      const result = this.keyHandler!(event);
      if (result === false) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    
    document.addEventListener('keydown', globalKeyHandler);
    console.log('AutocompleteAddon: Global keydown listener added as fallback');
    
    // Store handler for cleanup
    (this as any)._globalKeyHandler = globalKeyHandler;
  }

  private async handleTabKey(): Promise<void> {
    try {
      console.log('AutocompleteAddon: Tab key handler called');
      // Get current line from terminal
      const buffer = this.terminal.buffer.active;
      const cursorY = buffer.cursorY;
      const cursorX = buffer.cursorX;
      console.log('AutocompleteAddon: Cursor position - Y:', cursorY, 'X:', cursorX);
      
      const line = buffer.getLine(cursorY);
      if (!line) {
        console.log('AutocompleteAddon: No line at cursor position');
        return;
      }

      // Get text from current line (trimming trailing spaces)
      let lineText = '';
      for (let i = 0; i < buffer.cols; i++) {
        const cell = line.getCell(i);
        if (cell) {
          const char = cell.getChars();
          if (char) {
            lineText += char;
          } else {
            // Stop at first empty cell to avoid trailing spaces
            break;
          }
        }
      }
      
      lineText = lineText.trimEnd();
      console.log('AutocompleteAddon: Current line text:', JSON.stringify(lineText));

      // Extract current word (from cursor position backwards)
      let prefix = '';
      let startPos = cursorX - 1;

      // Find the start of the current word (allow spaces for URLs with spaces)
      while (startPos >= 0 && startPos < lineText.length) {
        const char = lineText[startPos];
        // Allow word chars, dots, slashes, colons, hyphens, @ for git URLs
        if (char && char.match(/[\w\-_./:@]/)) {
          prefix = char + prefix;
          startPos--;
        } else if (char === ' ') {
          // For URLs, we might want to include the space, but usually not
          // Check if we're after a command like "git clone "
          const beforeSpace = lineText.substring(0, startPos).trim();
          if (beforeSpace.match(/^(git\s+clone|git\s+pull|git\s+fetch|wget|curl|ssh|scp)$/i)) {
            // After a URL command, we want suggestions, so reset prefix to empty
            // and we'll search from the space forward
            prefix = '';
            break;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      
      // If prefix is empty but we're at a space after a URL command, get the rest
      if (prefix.length === 0 && cursorX < lineText.length && lineText[cursorX - 1] === ' ') {
        // Extract everything after the space
        const afterSpace = lineText.substring(cursorX).trim();
        prefix = afterSpace;
      }

      this.currentPrefix = prefix;
      console.log('AutocompleteAddon: Extracted prefix:', JSON.stringify(prefix));

      if (prefix.length === 0) {
        console.log('AutocompleteAddon: Empty prefix, hiding overlay');
        this.hideOverlay();
        return;
      }

      console.log('AutocompleteAddon: Getting suggestions for prefix:', prefix);
      // Get suggestions from backend
      const result = await window.electronAPI.terminal.getSuggestions(this.terminalId, prefix);
      
      console.log('AutocompleteAddon: Received suggestions:', result);
      console.log('AutocompleteAddon: Suggestions array:', result.suggestions);
      
      if (result.success && result.suggestions && result.suggestions.length > 0) {
        this.suggestions = result.suggestions;
        this.selectedIndex = 0;
        console.log('AutocompleteAddon: Showing overlay with', this.suggestions.length, 'suggestions:', this.suggestions);
        this.showOverlay();
        
        // Debug: Check if overlay is actually visible
        setTimeout(() => {
          if (this.overlay) {
            const isVisible = this.overlay.style.display !== 'none' && 
                             window.getComputedStyle(this.overlay).display !== 'none';
            console.log('AutocompleteAddon: Overlay visibility check - display:', this.overlay.style.display, 
                       'computed display:', window.getComputedStyle(this.overlay).display,
                       'isVisible:', isVisible,
                       'overlay element:', this.overlay);
          }
        }, 100);
      } else {
        console.log('AutocompleteAddon: No suggestions available - success:', result.success, 
                   'suggestions:', result.suggestions);
        this.hideOverlay();
      }
    } catch (error) {
      console.error('Autocomplete error:', error);
      this.hideOverlay();
    }
  }

  private showOverlay(): void {
    if (!this.overlay) {
      console.error('AutocompleteAddon: Overlay element not found!');
      return;
    }

    this.isVisible = true;
    this.updateOverlay();
    
    // Position overlay near cursor
    const terminalElement = this.terminal.element;
    if (!terminalElement) {
      console.error('AutocompleteAddon: Terminal element not found!');
      return;
    }
    
    const rect = terminalElement.getBoundingClientRect();
    
    // Get cursor position (approximate)
    const buffer = this.terminal.buffer.active;
    const cursorY = buffer.cursorY;
    const cursorX = buffer.cursorX;
    
    // Calculate position
    const charWidth = terminalElement.offsetWidth / this.terminal.cols;
    const charHeight = terminalElement.offsetHeight / this.terminal.rows;
    
    const left = rect.left + (cursorX * charWidth);
    const top = rect.top + ((cursorY + 1) * charHeight) + 4;
    
    this.overlay.style.left = `${left}px`;
    this.overlay.style.top = `${top}px`;
    this.overlay.style.display = 'block';
    this.overlay.style.zIndex = '100000'; // Very high z-index to ensure visibility
    this.overlay.style.position = 'fixed';
    
    console.log('AutocompleteAddon: Overlay shown at position', left, top, 'with', this.suggestions.length, 'suggestions');
    
    // Force a repaint
    this.overlay.offsetHeight;
  }

  private updateOverlay(): void {
    if (!this.overlay || !this.isVisible) {
      console.log('AutocompleteAddon: Cannot update overlay - overlay exists:', !!this.overlay, 'isVisible:', this.isVisible);
      return;
    }

    const html = this.suggestions.map((suggestion, index) => {
      const isSelected = index === this.selectedIndex;
      const className = isSelected ? 'autocomplete-item selected' : 'autocomplete-item';
      return `<div class="${className}" data-index="${index}">${this.highlightMatch(suggestion, this.currentPrefix)}</div>`;
    }).join('');
    
    this.overlay.innerHTML = html;
    console.log('AutocompleteAddon: Overlay updated with HTML:', html.substring(0, 200));
  }

  private highlightMatch(text: string, prefix: string): string {
    if (!prefix) return text;
    const index = text.toLowerCase().indexOf(prefix.toLowerCase());
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const match = text.substring(index, index + prefix.length);
    const after = text.substring(index + prefix.length);
    
    return `${before}<strong>${match}</strong>${after}`;
  }

  private hideOverlay(): void {
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
    this.isVisible = false;
    this.suggestions = [];
    this.selectedIndex = 0;
  }

  private selectSuggestion(): void {
    if (this.suggestions.length === 0 || !this.isVisible) return;

    const selected = this.suggestions[this.selectedIndex];
    if (!selected) return;

    // Calculate how many characters to delete (the prefix)
    const prefixLength = this.currentPrefix.length;
    
    // Delete prefix and insert suggestion
    // Send backspace to delete prefix, then type suggestion
    for (let i = 0; i < prefixLength; i++) {
      this.terminal.write('\b');
    }
    
    this.terminal.write(selected);
    this.hideOverlay();
  }
}

export {};
