import { spawn, IPty } from 'node-pty';
import { EventEmitter } from 'events';
import { Client as SSHClient, ConnectConfig, SFTPWrapper } from 'ssh2';
import { Session, ConnectionType } from './session';
import * as fs from 'fs';
import * as path from 'path';
import { GitAuthManager } from './git-auth';
import { GeminiApiService } from './gemini-api';

export class TerminalSession extends EventEmitter {
  private pty: IPty | null = null;
  private sshClient: SSHClient | null = null;
  private sftpClient: SFTPWrapper | null = null;
  private id: string;
  private shell: string;
  private session?: Session;
  private connectionType: ConnectionType = 'local';
  private gitAuthManager?: GitAuthManager;
  private geminiApiService?: GeminiApiService;
  private commandBuffer: string = '';
  private commandHistory: string[] = [];
  private currentCommand: string = '';
  private readonly MAX_HISTORY = 1000;

  constructor(id: string, shell: string = 'powershell.exe', session?: Session, gitAuthManager?: GitAuthManager, geminiApiService?: GeminiApiService) {
    super();
    this.id = id;
    this.shell = shell;
    this.session = session;
    this.gitAuthManager = gitAuthManager;
    this.geminiApiService = geminiApiService;
    if (session) {
      this.connectionType = session.type;
    }
  }

  start(cols: number = 80, rows: number = 24, password?: string): void {
    if (this.pty) {
      return;
    }

    if (this.connectionType === 'ssh' && this.session) {
      this.connectSSH(cols, rows, password);
    } else {
      this.startLocal(cols, rows);
    }
  }

  private startLocal(cols: number = 80, rows: number = 24): void {
    const isWindows = process.platform === 'win32';
    let shellPath: string;
    let shellArgs: string[] = [];

    if (isWindows) {
      // Windows: Use PowerShell by default, fallback to CMD
      if (this.shell === 'powershell.exe' || this.shell === 'pwsh.exe') {
        shellPath = this.shell;
        // PowerShell arguments for interactive terminal session
        shellArgs = ['-NoLogo', '-NoExit'];
      } else if (this.shell === 'cmd.exe') {
        shellPath = 'cmd.exe';
        shellArgs = [];
      } else {
        shellPath = this.shell;
      }
    } else {
      // Unix-like systems
      shellPath = process.env.SHELL || '/bin/bash';
    }

    try {
      const spawnOptions: any = {
        name: 'xterm-color',
        cols: cols,
        rows: rows,
        cwd: process.cwd() || (isWindows ? process.env.USERPROFILE : process.env.HOME),
        env: process.env as { [key: string]: string },
      };

      if (isWindows) {
        // Use ConPTY on Windows 10+ for better terminal support
        spawnOptions.useConpty = true;
      }

      this.pty = spawn(shellPath, shellArgs, spawnOptions);

      let waitingForUsername = false;
      let waitingForPassword = false;
      
      this.pty.onData(async (data: string) => {
        // Track command history
        for (const char of data) {
          if (char === '\r' || char === '\n') {
            // Command completed
            const command = this.currentCommand.trim();
            if (command && command.length > 0) {
              // Avoid duplicates (check last entry)
              if (this.commandHistory.length === 0 || this.commandHistory[this.commandHistory.length - 1] !== command) {
                this.commandHistory.push(command);
                // Limit history size
                if (this.commandHistory.length > this.MAX_HISTORY) {
                  this.commandHistory.shift();
                }
              }
            }
            this.currentCommand = '';
          } else if (char === '\b' || char === '\x7f') {
            // Backspace
            if (this.currentCommand.length > 0) {
              this.currentCommand = this.currentCommand.slice(0, -1);
            }
          } else if (char >= ' ') {
            // Printable character
            this.currentCommand += char;
          }
        }
        
        // Check for git credential prompts and auto-fill
        if (this.gitAuthManager && this.gitAuthManager.shouldAutoFillCredentials(this.id)) {
          // Check for username prompt - be more flexible with matching
          if ((data.includes("Username for") && data.includes("github.com")) ||
              data.match(/Username\s+for\s+['"]?https?:\/\/github\.com['"]?:?\s*$/i) ||
              data.match(/Username\s+for\s+['"]?https?:\/\/github\.com['"]?:?\s*\n/i)) {
            if (!waitingForUsername) {
              waitingForUsername = true;
              console.log('Detected GitHub username prompt, auto-filling...');
              // Auto-fill username with token
              setTimeout(async () => {
                const token = await this.gitAuthManager!.handleCredentialPrompt(this.id, 'username');
                if (token && this.pty) {
                  console.log('Sending GitHub token as username');
                  this.pty.write(token + '\n');
                }
              }, 150);
            }
          }
          // Check for password prompt
          else if ((data.includes("Password for") && data.includes("github.com")) ||
                   data.match(/Password\s+for\s+['"]?https?:\/\/github\.com['"]?:?\s*$/i) ||
                   data.match(/Password\s+for\s+['"]?https?:\/\/github\.com['"]?:?\s*\n/i) ||
                   (waitingForUsername && data.includes('Password'))) {
            if (!waitingForPassword) {
              waitingForPassword = true;
              console.log('Detected GitHub password prompt, auto-filling...');
              // Auto-fill password with token
              setTimeout(async () => {
                const token = await this.gitAuthManager!.getGitHubToken();
                if (token && this.pty) {
                  console.log('Sending GitHub token as password');
                  this.pty.write(token + '\n');
                  // Clear the credential prompt tracking after password
                  this.gitAuthManager!.clearCredentialPrompt(this.id);
                  waitingForUsername = false;
                  waitingForPassword = false;
                }
              }, 150);
            }
          }
        }
        
        this.emit('data', data);
      });

      this.pty.onExit((e: { exitCode: number; signal?: number }) => {
        this.emit('exit', { code: e.exitCode, signal: e.signal });
        this.pty = null;
      });
    } catch (error) {
      this.emit('error', error);
    }
  }

  private connectSSH(cols: number, rows: number, password?: string): void {
    if (!this.session || this.session.type !== 'ssh') {
      this.emit('error', new Error('SSH session configuration is missing'));
      return;
    }

    console.log(`Connecting to SSH: ${this.session.username}@${this.session.host}:${this.session.port}`);
    console.log(`Auth method: ${this.session.keyPath ? 'key' : 'password'}, password provided: ${!!password}`);

    const sshConfig: ConnectConfig = {
      host: this.session.host,
      port: this.session.port,
      username: this.session.username,
      readyTimeout: 20000, // 20 second timeout
      tryKeyboard: true, // Enable keyboard-interactive authentication
    };

    // Add authentication methods - try key first, then password
    if (this.session.keyPath) {
      // Key-based authentication
      try {
        const keyPath = path.resolve(this.session.keyPath);
        if (!fs.existsSync(keyPath)) {
          throw new Error(`SSH key file not found: ${keyPath}`);
        }
        const keyContent = fs.readFileSync(keyPath, 'utf8');
        if (!keyContent || keyContent.trim().length === 0) {
          throw new Error('SSH key file is empty');
        }
        sshConfig.privateKey = keyContent;
        console.log('Using SSH key authentication');
        // If key is passphrase-protected, we might need to handle it later
        // For now, we'll let SSH2 handle it and fall back to password if needed
      } catch (error: any) {
        console.error(`Failed to read SSH key: ${error.message}`);
        // If key read fails and we have a password, try password auth instead
        if (password) {
          console.log('Falling back to password authentication');
          sshConfig.password = password;
          delete sshConfig.privateKey;
        } else {
          this.emit('error', new Error(`Failed to read SSH key: ${error.message}. Please provide a password or fix the key path.`));
          return;
        }
      }
    }
    
    // Add password authentication (either as primary or fallback)
    if (password && !sshConfig.privateKey) {
      sshConfig.password = password;
      console.log('Using password authentication');
    } else if (password && sshConfig.privateKey) {
      // If both key and password are available, try key first, password as fallback
      sshConfig.password = password;
      console.log('Using key authentication with password fallback');
    }

    // If no authentication method is configured, error out
    if (!sshConfig.privateKey && !sshConfig.password) {
      const errorMsg = this.session.keyPath 
        ? 'SSH key file could not be read and no password was provided.'
        : 'SSH authentication method not provided. Please provide either an SSH key or password.';
      this.emit('error', new Error(errorMsg));
      return;
    }

    // Add jump host if configured
    if (this.session.jumpHost) {
      // TODO: Implement jump host support
      console.warn('Jump host support not yet implemented');
    }

    // Create SSH client
    this.sshClient = new SSHClient();

    // Handle keyboard-interactive authentication prompts
    this.sshClient.on('keyboard-interactive', (name, instructions, instructionsLang, prompts, finish) => {
      // If we have a password, use it for keyboard-interactive prompts
      if (password && prompts.length > 0) {
        const responses: string[] = [];
        prompts.forEach((prompt: any) => {
          // For password prompts, use the provided password
          if (prompt.prompt.toLowerCase().includes('password') || !prompt.echo) {
            responses.push(password);
          } else {
            responses.push('');
          }
        });
        finish(responses);
      } else {
        // No password available, cancel authentication
        finish([]);
      }
    });

    this.sshClient.on('ready', () => {
      console.log('SSH connection established');
      
      // Initialize SFTP client
      this.sshClient!.sftp((err, sftp) => {
        if (err) {
          console.error('Failed to initialize SFTP:', err);
        } else {
          this.sftpClient = sftp;
          this.emit('sftp-ready');
        }
      });

      // Request a shell session
      this.sshClient!.shell(
        {
          cols: cols,
          rows: rows,
        },
        (err: Error | undefined, stream: any) => {
          if (err) {
            this.emit('error', err);
            return;
          }

          // Create a pseudo-terminal-like interface using node-pty
          // Since we can't use node-pty directly with SSH, we'll pipe the stream
          // For now, we'll create a local shell and pipe SSH data through it
          this.createSSHPty(cols, rows, stream);
        }
      );
    });

    this.sshClient.on('error', (err: Error) => {
      console.error('SSH connection error:', err.message);
      console.error('Error details:', {
        host: this.session?.host,
        port: this.session?.port,
        username: this.session?.username,
        hasKey: !!this.session?.keyPath,
        hasPassword: !!password,
      });
      this.emit('error', err);
    });

    // Connect to SSH server
    try {
      this.sshClient.connect(sshConfig);
    } catch (error: any) {
      this.emit('error', new Error(`Failed to initiate SSH connection: ${error.message}`));
    }
  }

  private createSSHPty(cols: number, rows: number, sshStream: any): void {
    // For SSH, we'll pipe data directly without using node-pty
    // Create a minimal pty-like interface for compatibility
    // SSH stream data goes directly to UI
    let inputBuffer = '';
    let outputBuffer = '';
    let waitingForUsername = false;
    let waitingForPassword = false;
    let usernameSent = false;
    let passwordSent = false;
    
    // Function to check for prompts in accumulated buffer
    const checkForPrompts = async (buffer: string) => {
      // Always log if we see username/password/github, even if not marked for auto-fill
      if (buffer.toLowerCase().includes('username') || buffer.toLowerCase().includes('password') || buffer.toLowerCase().includes('github')) {
        const isMarked = this.gitAuthManager && this.gitAuthManager.shouldAutoFillCredentials(this.id);
        console.log(`[GitAuth] Buffer contains username/password/github. Auto-fill enabled: ${isMarked}`);
        console.log(`[GitAuth] Buffer content: ${JSON.stringify(buffer.slice(-200))}`); // Last 200 chars
      }
      
      if (!this.gitAuthManager || !this.gitAuthManager.shouldAutoFillCredentials(this.id)) {
        return;
      }
      
      // Check for username prompt - be VERY aggressive with detection
      // Check multiple patterns and be lenient with matching
      // Also check if we see "Username" followed by "for" and "github" anywhere in buffer
      const lowerBuffer = buffer.toLowerCase();
      const hasUsernamePrompt = !waitingForUsername && !usernameSent && (
          buffer.match(/Username\s+for\s+['"]?https?:\/\/github\.com['"]?:?\s*$/im) ||
          buffer.match(/Username\s+for\s+['"]?https?:\/\/github\.com['"]?:?\s*\r?\n/im) ||
          buffer.match(/Username\s+for\s+['"]?https?:\/\/github/i) ||
          (lowerBuffer.includes("username") && lowerBuffer.includes("for") && lowerBuffer.includes("github")) ||
          (lowerBuffer.includes("username") && lowerBuffer.includes("github.com")) ||
          (lowerBuffer.includes("username") && lowerBuffer.includes("github") && !waitingForPassword) // Very lenient fallback
      );
      
      if (hasUsernamePrompt) {
        waitingForUsername = true;
        console.log('[GitAuth] ✅ Detected GitHub username prompt in buffer, auto-filling...');
        console.log(`[GitAuth] Buffer snippet: ${JSON.stringify(buffer.slice(-150))}`);
        
        // Auto-fill username with token immediately
        setTimeout(async () => {
          if (usernameSent) {
            console.log('[GitAuth] Username already sent, skipping');
            return;
          }
          const token = await this.gitAuthManager!.handleCredentialPrompt(this.id, 'username');
          if (token && sshStream && !sshStream.destroyed) {
            console.log(`[GitAuth] ✅ Sending GitHub token as username (length: ${token.length})`);
            // Send token and newline together - only once
            sshStream.write(token + '\r\n');
            usernameSent = true; // Mark as sent AFTER successfully sending
          } else {
            console.log('[GitAuth] ❌ No token available for username');
            waitingForUsername = false; // Reset if no token
          }
        }, 150); // Short delay for username
      }
      // Check for password prompt - be very lenient
      const hasPasswordPrompt = !waitingForPassword && !passwordSent && (
          buffer.match(/Password\s+for\s+['"]?https?:\/\/github\.com['"]?:?\s*$/im) ||
          buffer.match(/Password\s+for\s+['"]?https?:\/\/github\.com['"]?:?\s*\r?\n/im) ||
          buffer.match(/Password\s+for\s+['"]?https?:\/\/github/i) ||
          (buffer.toLowerCase().includes("password") && buffer.toLowerCase().includes("github") && buffer.match(/password\s+for/i)) ||
          (buffer.toLowerCase().includes("password") && buffer.toLowerCase().includes("github.com"))
      );
      
      if (hasPasswordPrompt) {
        waitingForPassword = true;
        console.log('[GitAuth] ✅ Detected GitHub password prompt in buffer, auto-filling...');
        console.log(`[GitAuth] Buffer snippet: ${JSON.stringify(buffer.slice(-100))}`);
        
        // Auto-fill password with token (GitHub accepts token as password when token is username)
        setTimeout(async () => {
          if (passwordSent) {
            console.log('[GitAuth] Password already sent, skipping');
            return;
          }
          const token = await this.gitAuthManager!.getGitHubToken();
          if (token && sshStream && !sshStream.destroyed) {
            console.log(`[GitAuth] ✅ Sending GitHub token as password (length: ${token.length})`);
            // Send token and newline together - only once
            sshStream.write(token + '\r\n');
            passwordSent = true; // Mark as sent AFTER successfully sending
            // Clear the credential prompt tracking after password
            this.gitAuthManager!.clearCredentialPrompt(this.id);
            waitingForUsername = false;
            waitingForPassword = false;
            usernameSent = false; // Reset for next time
            passwordSent = false; // Reset for next time
            outputBuffer = ''; // Clear buffer after successful auth
          } else {
            console.log('[GitAuth] ❌ No token available for password');
            waitingForPassword = false; // Reset if no token
          }
        }, 150); // Delay for password
      }
    };
    
    sshStream.on('data', async (data: Buffer) => {
      const output = data.toString();
      outputBuffer += output;
      this.emit('data', output);
      
      // Check for prompts in accumulated buffer (handles chunked output)
      await checkForPrompts(outputBuffer);
      
      // Limit buffer size to prevent memory issues
      if (outputBuffer.length > 1000) {
        outputBuffer = outputBuffer.slice(-500); // Keep last 500 chars
      }
    });

    sshStream.stderr.on('data', async (data: Buffer) => {
      const output = data.toString();
      outputBuffer += output;
      this.emit('data', output);
      
      // Git prompts often come through stderr, so check here too
      await checkForPrompts(outputBuffer);
      
      // Limit buffer size
      if (outputBuffer.length > 1000) {
        outputBuffer = outputBuffer.slice(-500);
      }
    });

    sshStream.on('close', () => {
      if (this.sshClient) {
        this.sshClient.end();
        this.sshClient = null;
      }
      this.pty = null;
      this.emit('exit', { code: 0 });
    });

    // Store SSH stream reference for write operations
    (this as any).sshStream = sshStream;

    // Create a dummy pty object for compatibility with resize operations
    // We'll use a minimal implementation that satisfies the interface
    const self = this;
    this.pty = {
      write: (data: string) => {
        if (sshStream && !sshStream.destroyed) {
          // For SSH, intercept git commands and inject GitHub token
          if (self.gitAuthManager) {
            // Check if this data contains a complete command (has newline)
            // This handles both typed commands and commands recalled from history
            const hasNewline = data.includes('\r') || data.includes('\n');
            
            if (hasNewline) {
              // Extract command from the data itself (for history recall) or from buffer (for typed)
              // Try to extract command from the data first (handles history recall)
              let command = '';
              
              // Look for command pattern in the data (handles history recall where full command is sent)
              const commandMatch = data.match(/([^\r\n]+)/);
              if (commandMatch) {
                const potentialCommand = commandMatch[1].trim();
                // Check if it looks like a command (not just escape sequences)
                if (potentialCommand.length > 0 && !potentialCommand.match(/^\x1b\[/)) {
                  // Combine with buffer if buffer has content
                  if (self.commandBuffer.trim()) {
                    command = (self.commandBuffer + potentialCommand).trim();
                  } else {
                    command = potentialCommand;
                  }
                }
              }
              
              // If no command found in data, use buffer (for typed commands)
              if (!command && self.commandBuffer.trim()) {
                command = self.commandBuffer.trim();
              }
              
              // Also try to extract from the full data string (remove escape sequences)
              if (!command) {
                // Remove ANSI escape sequences and extract text
                const cleanData = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\[[?0-9;]*[hl]/g, '');
                const lines = cleanData.split(/[\r\n]+/).filter(line => line.trim().length > 0);
                if (lines.length > 0) {
                  // Get the last line that looks like a command
                  for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim();
                    if (line.length > 0 && !line.match(/^[\x00-\x1f]/) && line.match(/^[a-zA-Z]/)) {
                      command = line;
                      break;
                    }
                  }
                }
              }
              
              const savedBuffer = self.commandBuffer;
              console.log(`[GitAuth] Command complete detected. Data: "${data.slice(0, 50)}...", Buffer: "${savedBuffer}", Extracted command: "${command}" (terminalId: ${self.id})`);
              
              // Clear buffer after extracting command
              self.commandBuffer = '';
              
              if (command) {
                // Check if it's a git command that might need authentication
                if (self.gitAuthManager.isGitCommand(command)) {
                  console.log(`[GitAuth] ✅ Detected git command: ${command}`);
                  // Reset credential flags for new command
                  waitingForUsername = false;
                  waitingForPassword = false;
                  usernameSent = false;
                  passwordSent = false;
                  // Mark this terminal for credential auto-fill
                  self.gitAuthManager.injectGitHubToken(command, self.id).then(modifiedCommand => {
                    const hasToken = self.gitAuthManager!.shouldAutoFillCredentials(self.id);
                    console.log(`[GitAuth] Command processed. Auto-fill enabled: ${hasToken} (terminalId: ${self.id})`);
                    if (!hasToken) {
                      console.error(`[GitAuth] ❌ ERROR: Terminal ${self.id} was NOT marked for auto-fill!`);
                    }
                    if (modifiedCommand !== command && sshStream && !sshStream.destroyed) {
                      // Replace command in the data if URL was modified
                      const modifiedData = data.replace(command, modifiedCommand);
                      sshStream.write(modifiedData);
                    } else if (sshStream && !sshStream.destroyed) {
                      // Command doesn't have URL, but we've marked it for credential auto-fill
                      sshStream.write(data);
                    }
                  }).catch(error => {
                    console.error('[GitAuth] Failed to inject GitHub token:', error);
                    if (sshStream && !sshStream.destroyed) {
                      sshStream.write(data);
                    }
                  });
                  return; // Don't write the original data, we'll write it in the promise
                } else {
                  console.log(`[GitAuth] Not a git command: "${command}"`);
                }
              } else {
                // Empty command (just Enter pressed)
                console.log(`[GitAuth] Empty command detected (just Enter, buffer was: "${savedBuffer}")`);
              }
            } else {
              // No newline - accumulate characters into buffer (for typed commands)
              const chars = Array.from(data);
              for (const char of chars) {
                const charCode = char.charCodeAt(0);
                // Include printable ASCII (32-126), tabs (9)
                // Exclude escape sequences (27 = ESC)
                if (charCode === 27) {
                  // Escape sequence - clear buffer as it might be arrow keys or other control
                  // But don't clear completely, just reset to avoid mixing with typed input
                  if (data.length > 1) {
                    // Likely an escape sequence, don't accumulate
                    break;
                  }
                } else if ((charCode >= 32 && charCode <= 126) || charCode === 9) {
                  self.commandBuffer += char;
                  // Limit buffer size to prevent issues
                  if (self.commandBuffer.length > 200) {
                    self.commandBuffer = self.commandBuffer.slice(-100);
                  }
                }
              }
            }
            
            sshStream.write(data);
            return;
          }
          
          sshStream.write(data);
        }
      },
      resize: (cols: number, rows: number) => {
        if (sshStream && !sshStream.destroyed) {
          sshStream.setWindow(rows, cols);
        }
      },
      kill: () => {
        if (sshStream && !sshStream.destroyed) {
          sshStream.end();
        }
      },
      onData: () => {},
      onExit: () => {},
      pid: 0,
      cols: cols,
      rows: rows,
      process: '',
    } as any as IPty;
  }

  write(data: string): void {
    if (this.pty) {
      // For local terminals, handle git command interception
      if (this.connectionType === 'local' && this.gitAuthManager) {
        this.commandBuffer += data;
        
        // Check for Enter key to detect complete command
        if (data.includes('\r') || data.includes('\n')) {
          const command = this.commandBuffer.trim();
          this.commandBuffer = '';
          
          // Check if it's a git command that might need authentication
          if (this.gitAuthManager.isGitCommand(command)) {
            // Mark for credential auto-fill and inject token if URL present
            this.gitAuthManager.injectGitHubToken(command, this.id).then(modifiedCommand => {
              if (modifiedCommand !== command && this.pty) {
                // Replace command in the data if URL was modified
                const modifiedData = data.replace(command, modifiedCommand);
                this.pty.write(modifiedData);
              } else if (this.pty) {
                // Command doesn't have URL, but we've marked it for credential auto-fill
                this.pty.write(data);
              }
            }).catch(error => {
              console.error('Failed to inject GitHub token:', error);
              if (this.pty) {
                this.pty.write(data);
              }
            });
            return;
          }
        }
      }
      
      this.pty.write(data);
    }
  }

  resize(cols: number, rows: number): void {
    if (this.pty) {
      this.pty.resize(cols, rows);
    }
    // For SSH, also resize the SSH stream window
    if (this.connectionType === 'ssh' && (this as any).sshStream) {
      const sshStream = (this as any).sshStream;
      if (sshStream && !sshStream.destroyed) {
        sshStream.setWindow(rows, cols);
      }
    }
  }

  getSFTPClient(): SFTPWrapper | null {
    return this.sftpClient;
  }

  getCommandHistory(): string[] {
    return [...this.commandHistory];
  }

  async getSuggestions(prefix: string): Promise<string[]> {
    console.log('[Terminal] getSuggestions called with prefix:', prefix);
    const suggestions: string[] = [];
    const lowerPrefix = prefix.toLowerCase();
    
    // Check if prefix suggests URL/link completion
    const shouldUseGemini = this.shouldUseGeminiForPrefix(prefix);
    console.log('[Terminal] shouldUseGemini:', shouldUseGemini, 'hasApiKey:', this.geminiApiService?.hasApiKey());
    
    // If Gemini is enabled and prefix suggests URL, try to get suggestions from Gemini
    if (shouldUseGemini && this.geminiApiService && this.geminiApiService.hasApiKey()) {
      try {
        // Extract context (command) from recent history if available
        const context = this.getCommandContext();
        console.log('[Terminal] Calling Gemini API with prefix:', prefix, 'context:', context);
        const geminiSuggestions = await this.geminiApiService.getLinkSuggestions(prefix, context);
        console.log('[Terminal] Gemini API returned', geminiSuggestions.length, 'suggestions:', geminiSuggestions);
        
        // Add Gemini suggestions first (they're more relevant for URLs)
        for (const suggestion of geminiSuggestions) {
          if (!suggestions.includes(suggestion)) {
            suggestions.push(suggestion);
          }
        }
      } catch (error) {
        console.error('[Terminal] Gemini API suggestion error:', error);
        // Continue with fallback suggestions
      }
    }
    
    // Common shell commands
    const commonCommands = [
      'git', 'npm', 'node', 'cd', 'ls', 'pwd', 'mkdir', 'rm', 'cp', 'mv',
      'cat', 'grep', 'find', 'ps', 'kill', 'echo', 'export', 'env',
      'ssh', 'scp', 'curl', 'wget', 'tar', 'zip', 'unzip',
      'python', 'python3', 'pip', 'pip3', 'java', 'javac',
      'docker', 'kubectl', 'terraform', 'ansible'
    ];
    
    // Add matching commands
    for (const cmd of commonCommands) {
      if (cmd.toLowerCase().startsWith(lowerPrefix) && cmd.toLowerCase() !== lowerPrefix) {
        if (!suggestions.includes(cmd)) {
          suggestions.push(cmd);
        }
      }
    }
    
    // Add matching history entries
    for (const hist of this.commandHistory) {
      if (hist.toLowerCase().startsWith(lowerPrefix) && 
          hist.toLowerCase() !== lowerPrefix &&
          !suggestions.includes(hist)) {
        suggestions.push(hist);
      }
    }
    
    // Limit to 10 suggestions
    return suggestions.slice(0, 10);
  }

  private shouldUseGeminiForPrefix(prefix: string): boolean {
    // Check if prefix contains URL-like patterns
    const urlPatterns = [
      /^(https?:\/\/|git@|www\.)/i,
      /\.(com|org|io|net|edu|gov|co|uk|de|fr|it|es|jp|cn|au|ca|br|in|ru|kr|mx|nl|pl|se|tr|za|be|ch|at|dk|fi|no|nz|sg|hk|tw|my|ph|id|th|vn|ae|sa|il|eg|ma|ke|gh|ng|dz|tn|jo|lb|kw|qa|bh|om|ye|iq|sy|af|pk|bd|lk|np|mm|kh|la|bn|mo|mn|kz|uz|az|am|ge|kg|tj|tm|md|by|ua|bg|ro|hu|cz|sk|si|hr|rs|me|ba|mk|al|lt|lv|ee|is|lu|mt|cy|ad|mc|sm|va|li|fo|gl|gi|je|gg|im|ax|as|gu|mp|pr|vi|vg|ky|bm|ms|tc|fk|gs|pn|sh|ac|ta|cc|cx|nf|hm|aq|tf|bv|sj)/i,
      /^[\w-]+\./i,
    ];
    
    // Check if any pattern matches
    for (const pattern of urlPatterns) {
      if (pattern.test(prefix)) {
        return true;
      }
    }
    
    // Check if recent command context suggests URL completion
    const recentContext = this.getCommandContext();
    if (recentContext) {
      const urlCommands = ['git clone', 'wget', 'curl', 'ssh', 'scp', 'git pull', 'git fetch'];
      const lowerContext = recentContext.toLowerCase();
      for (const cmd of urlCommands) {
        if (lowerContext.includes(cmd)) {
          return true;
        }
      }
    }
    
    return false;
  }

  private getCommandContext(): string | undefined {
    // Get the most recent command from history that might provide context
    if (this.commandHistory.length > 0) {
      const recent = this.commandHistory[this.commandHistory.length - 1];
      // Check if it's a URL-related command
      const urlCommands = ['git clone', 'git pull', 'git fetch', 'wget', 'curl', 'ssh', 'scp'];
      const lowerRecent = recent.toLowerCase();
      for (const cmd of urlCommands) {
        if (lowerRecent.includes(cmd)) {
          return recent;
        }
      }
    }
    return undefined;
  }

  destroy(): void {
    if (this.pty) {
      this.pty.kill();
      this.pty = null;
    }
    if (this.sftpClient) {
      this.sftpClient.end();
      this.sftpClient = null;
    }
    if (this.sshClient) {
      this.sshClient.end();
      this.sshClient = null;
    }
  }

  getId(): string {
    return this.id;
  }

  isActive(): boolean {
    return this.pty !== null;
  }
}

