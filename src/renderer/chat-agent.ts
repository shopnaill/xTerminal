/// <reference path="./types.d.ts" />

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  commands?: string[]; // Commands extracted from assistant messages
}

export class ChatAgent {
  private panel: HTMLElement;
  private messagesContainer: HTMLElement;
  private inputField: HTMLInputElement;
  private sendButton: HTMLElement;
  private closeButton: HTMLElement;
  private copyTerminalButton: HTMLElement;
  private confirmationDialog: HTMLElement;
  private confirmationCommand: HTMLElement;
  private confirmationTerminal: HTMLElement;
  private acceptButton: HTMLElement;
  private rejectButton: HTMLElement;
  
  private messages: ChatMessage[] = [];
  private isVisible: boolean = false;
  private currentTerminalId: string | null = null;
  private pendingCommand: { command: string; terminalId: string } | null = null;

  constructor() {
    // Get DOM elements
    this.panel = document.getElementById('chatPanel')!;
    this.messagesContainer = document.getElementById('chatMessages')!;
    this.inputField = document.getElementById('chatInput') as HTMLInputElement;
    this.sendButton = document.getElementById('chatSendButton')!;
    this.closeButton = document.getElementById('chatCloseButton')!;
    this.copyTerminalButton = document.getElementById('copyTerminalContentBtn')!;
    this.confirmationDialog = document.getElementById('commandConfirmationDialog')!;
    this.confirmationCommand = document.getElementById('confirmationCommand')!;
    this.confirmationTerminal = document.getElementById('confirmationTerminal')!;
    this.acceptButton = document.getElementById('confirmAcceptBtn')!;
    this.rejectButton = document.getElementById('confirmRejectBtn')!;

    if (!this.panel || !this.messagesContainer || !this.inputField || !this.sendButton) {
      throw new Error('ChatAgent: Required DOM elements not found');
    }

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Send button
    this.sendButton.addEventListener('click', () => this.handleSend());
    
    // Enter key in input
    this.inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Close button
    if (this.closeButton) {
      this.closeButton.addEventListener('click', () => this.hide());
    }

    // Copy terminal content button
    if (this.copyTerminalButton) {
      this.copyTerminalButton.addEventListener('click', () => this.copyTerminalContent());
    }

    // Confirmation dialog buttons
    if (this.acceptButton) {
      this.acceptButton.addEventListener('click', () => this.executePendingCommand());
    }
    if (this.rejectButton) {
      this.rejectButton.addEventListener('click', () => this.cancelPendingCommand());
    }

    // Close dialog on overlay click
    if (this.confirmationDialog) {
      this.confirmationDialog.addEventListener('click', (e) => {
        if (e.target === this.confirmationDialog) {
          this.cancelPendingCommand();
        }
      });
    }
  }

  show(terminalId?: string): void {
    if (terminalId) {
      this.currentTerminalId = terminalId;
    }
    this.isVisible = true;
    this.panel.classList.add('visible');
    this.inputField.focus();
  }

  hide(): void {
    this.isVisible = false;
    this.panel.classList.remove('visible');
  }

  setTerminalId(terminalId: string): void {
    this.currentTerminalId = terminalId;
  }

  private async handleSend(): Promise<void> {
    const message = this.inputField.value.trim();
    if (!message) return;

    // Clear input
    this.inputField.value = '';

    // Add user message
    this.addMessage('user', message);

    // Show loading indicator
    const loadingId = this.addLoadingMessage();

    try {
      // Get terminal context if available
      let terminalContext: string | undefined;
      if (this.currentTerminalId) {
        // Get recent terminal history/output
        terminalContext = await this.getTerminalContext();
      }

      // Send to Gemini API
      const result = await window.electronAPI.chat.sendMessage(this.messages, terminalContext);

      // Remove loading message
      this.removeMessage(loadingId);

      if (result.success && result.response) {
        // Extract commands from response
        const commands = this.extractCommands(result.response);
        
        // Add assistant message with commands
        this.addMessage('assistant', result.response, commands);
      } else {
        this.addMessage('assistant', `Error: ${result.error || 'Failed to get response'}`);
      }
    } catch (error) {
      this.removeMessage(loadingId);
      this.addMessage('assistant', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private addMessage(role: 'user' | 'assistant', content: string, commands?: string[]): string {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const message: ChatMessage = { role, content, commands };
    this.messages.push(message);

    const messageElement = document.createElement('div');
    messageElement.className = `chat-message chat-message-${role}`;
    messageElement.id = messageId;

    if (role === 'user') {
      messageElement.innerHTML = `<div class="chat-message-content">${this.escapeHtml(content)}</div>`;
    } else {
      // Format assistant message with markdown-like rendering
      const formattedContent = this.formatMessage(content);
      messageElement.innerHTML = `
        <div class="chat-message-content">${formattedContent}</div>
        ${commands && commands.length > 0 ? this.renderCommands(commands, messageId) : ''}
      `;
    }

    this.messagesContainer.appendChild(messageElement);
    this.scrollToBottom();

    return messageId;
  }

  private addLoadingMessage(): string {
    const messageId = `loading-${Date.now()}`;
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message chat-message-assistant';
    messageElement.id = messageId;
    messageElement.innerHTML = '<div class="chat-message-content"><div class="loading-dots"><span></span><span></span><span></span></div></div>';
    this.messagesContainer.appendChild(messageElement);
    this.scrollToBottom();
    return messageId;
  }

  private removeMessage(messageId: string): void {
    const element = document.getElementById(messageId);
    if (element) {
      element.remove();
    }
  }

  private formatMessage(content: string): string {
    // Basic markdown-like formatting
    let formatted = this.escapeHtml(content);
    
    // Code blocks
    formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre class="chat-code-block"><code>${this.escapeHtml(code.trim())}</code></pre>`;
    });
    
    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="chat-inline-code">$1</code>');
    
    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  }

  private renderCommands(commands: string[], messageId: string): string {
    return commands.map((cmd, index) => `
      <div class="command-suggestion" data-command="${this.escapeHtml(cmd)}" data-message-id="${messageId}">
        <div class="command-preview">
          <code>${this.escapeHtml(cmd)}</code>
        </div>
        <button class="btn-execute-command" data-command-index="${index}">Execute</button>
      </div>
    `).join('');
  }

  private extractCommands(content: string): string[] {
    const commands: string[] = [];

    // Extract from code blocks
    const codeBlockRegex = /```(?:bash|cmd|sh|powershell|zsh|fish)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const code = match[1].trim();
      const lines = code.split('\n').map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('#'));
      commands.push(...lines);
    }

    // Look for inline command patterns
    const inlineCommandRegex = /(?:^|\n)(?:[$>]|C:\\>|PS\s+[A-Z]:\\)\s*([^\n]+)/g;
    while ((match = inlineCommandRegex.exec(content)) !== null) {
      const cmd = match[1].trim();
      if (cmd && !commands.includes(cmd)) {
        commands.push(cmd);
      }
    }

    // Add event listeners for execute buttons after rendering
    setTimeout(() => {
      this.messagesContainer.querySelectorAll('.btn-execute-command').forEach(btn => {
        if (!btn.hasAttribute('data-listener-attached')) {
          btn.setAttribute('data-listener-attached', 'true');
          btn.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const commandSuggestion = target.closest('.command-suggestion');
            const command = commandSuggestion?.getAttribute('data-command');
            if (command && this.currentTerminalId) {
              this.showCommandConfirmation(command, this.currentTerminalId);
            }
          });
        }
      });
    }, 0);

    return commands;
  }

  private showCommandConfirmation(command: string, terminalId: string): void {
    this.pendingCommand = { command, terminalId };
    if (this.confirmationCommand) {
      this.confirmationCommand.textContent = command;
    }
    if (this.confirmationTerminal) {
      this.confirmationTerminal.textContent = terminalId;
    }
    if (this.confirmationDialog) {
      this.confirmationDialog.style.display = 'flex';
    }
  }

  private async executePendingCommand(): Promise<void> {
    if (!this.pendingCommand) return;

    const { command, terminalId } = this.pendingCommand;

    try {
      const result = await window.electronAPI.chat.executeCommand(terminalId, command);
      
      if (result.success) {
        this.addMessage('user', `[Executed] ${command}`);
      } else {
        this.addMessage('assistant', `Failed to execute command: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      this.addMessage('assistant', `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    this.cancelPendingCommand();
  }

  private cancelPendingCommand(): void {
    this.pendingCommand = null;
    if (this.confirmationDialog) {
      this.confirmationDialog.style.display = 'none';
    }
  }

  private async copyTerminalContent(): Promise<void> {
    if (!this.currentTerminalId) {
      this.addMessage('assistant', 'No active terminal selected.');
      return;
    }

    try {
      const context = await this.getTerminalContext();
      if (context) {
        this.addMessage('user', `[Terminal Context]\n${context}`);
        this.addMessage('assistant', 'Terminal content copied. How can I help you with this?');
      } else {
        this.addMessage('assistant', 'No terminal content available to copy.');
      }
    } catch (error) {
      this.addMessage('assistant', `Error copying terminal content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getTerminalContext(): Promise<string> {
    if (!this.currentTerminalId) return '';

    try {
      // Get command history from terminal
      const historyResult = await window.electronAPI.terminal.getHistory(this.currentTerminalId);
      if (historyResult.success && historyResult.history) {
        // Return last 20 commands/output lines
        const recentHistory = historyResult.history.slice(-20).join('\n');
        return recentHistory || 'No recent terminal history available.';
      }
    } catch (error) {
      console.error('Error getting terminal context:', error);
    }

    return 'Terminal context not available.';
  }

  private scrollToBottom(): void {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export {};
