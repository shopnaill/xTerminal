import { SettingsManager } from './settings';
import { EventEmitter } from 'events';

export class GitAuthManager extends EventEmitter {
  private settingsManager: SettingsManager;
  private gitCommandPattern = /^\s*git\s+(pull|fetch|clone|push|ls-remote)\s*/i;
  private githubUrlPattern = /github\.com/i;
  private credentialPrompts: Map<string, { username: boolean; password: boolean }> = new Map();

  constructor(settingsManager: SettingsManager) {
    super();
    this.settingsManager = settingsManager;
  }

  /**
   * Check if a command is a git command that might need authentication
   */
  isGitCommand(command: string): boolean {
    return this.gitCommandPattern.test(command);
  }

  /**
   * Check if command involves GitHub (either explicitly or implicitly via remote)
   * For commands like "git pull", we assume they might involve GitHub
   */
  async involvesGitHub(command: string, terminalId: string): Promise<boolean> {
    // If command explicitly mentions github.com, it involves GitHub
    if (this.githubUrlPattern.test(command)) {
      return true;
    }
    
    // For commands like "git pull", "git fetch", etc., we assume they might involve GitHub
    // We can't easily check the remote URL without running a git command, so we'll be optimistic
    // and assume any git pull/fetch/clone/push might involve GitHub
    if (this.isGitCommand(command)) {
      return true; // Assume it might be GitHub
    }
    
    return false;
  }

  /**
   * Inject GitHub token into git command
   * For HTTPS URLs, inject token into the URL
   * For commands without URLs, we'll handle credential prompts
   */
  async injectGitHubToken(command: string, terminalId: string): Promise<string> {
    const token = await this.settingsManager.getGitHubToken();
    
    if (!token) {
      console.log(`[GitAuth] No GitHub token available for command: ${command}`);
      return command; // No token available, return original command
    }

    console.log(`[GitAuth] Processing command: ${command}`);

    // Check if it's a git command involving GitHub
    if (!this.isGitCommand(command)) {
      console.log(`[GitAuth] Not a git command: ${command}`);
      return command;
    }

    const involvesGH = await this.involvesGitHub(command, terminalId);
    console.log(`[GitAuth] Command involves GitHub: ${involvesGH}`);

    if (!involvesGH) {
      return command;
    }

    // For HTTPS GitHub URLs, inject token
    // Pattern: https://github.com/user/repo.git
    // Convert to: https://TOKEN@github.com/user/repo.git
    const httpsPattern = /(https?:\/\/)(github\.com\/[^\s]+)/gi;
    if (httpsPattern.test(command)) {
      const modified = command.replace(httpsPattern, `$1${token}@$2`);
      console.log(`[GitAuth] Modified command with URL: ${modified}`);
      return modified;
    }

    // For commands without explicit URL (like "git pull"), we can't modify the command
    // Instead, we'll mark this terminal as needing credential auto-fill
    // The credential prompts will be intercepted and auto-filled
    this.credentialPrompts.set(terminalId, { username: false, password: false });
    const isMarked = this.credentialPrompts.has(terminalId);
    console.log(`[GitAuth] Marked terminal ${terminalId} for credential auto-fill: ${isMarked}`);
    console.log(`[GitAuth] Total terminals marked: ${this.credentialPrompts.size}`);
    console.log(`[GitAuth] Marked terminals: ${Array.from(this.credentialPrompts.keys()).join(', ')}`);
    
    return command;
  }

  /**
   * Check if we should auto-fill credentials for a terminal
   */
  shouldAutoFillCredentials(terminalId: string): boolean {
    const has = this.credentialPrompts.has(terminalId);
    if (!has) {
      console.log(`[GitAuth] Terminal ${terminalId} NOT marked for auto-fill. Marked terminals: ${Array.from(this.credentialPrompts.keys()).join(', ')}`);
    }
    return has;
  }

  /**
   * Get GitHub token directly
   */
  async getGitHubToken(): Promise<string | null> {
    return await this.settingsManager.getGitHubToken();
  }

  /**
   * Handle credential prompt - returns the token to use
   */
  async handleCredentialPrompt(terminalId: string, promptType: 'username' | 'password'): Promise<string | null> {
    if (!this.shouldAutoFillCredentials(terminalId)) {
      return null;
    }

    const token = await this.settingsManager.getGitHubToken();
    if (!token) {
      return null;
    }

    const prompt = this.credentialPrompts.get(terminalId);
    if (!prompt) {
      return null;
    }

    if (promptType === 'username') {
      // For GitHub, use the token as username
      prompt.username = true;
      return token;
    } else if (promptType === 'password') {
      // For password, use the token again (GitHub accepts token as both username and password)
      prompt.password = true;
      return token;
    }

    return null;
  }

  /**
   * Clear credential prompt tracking for a terminal
   */
  clearCredentialPrompt(terminalId: string): void {
    this.credentialPrompts.delete(terminalId);
  }

  /**
   * Get environment variables for git authentication
   */
  async getGitEnvVars(): Promise<{ [key: string]: string }> {
    const token = await this.settingsManager.getGitHubToken();
    const env: { [key: string]: string } = {};

    if (token) {
      // Set GIT_ASKPASS to use our custom askpass script
      // For now, we'll use a simple approach with credential helper
      env.GIT_TERMINAL_PROMPT = '0';
      // Note: Actual credential injection will be done via command modification
      // or by setting up a credential helper script
    }

    return env;
  }

  /**
   * Create a git credential helper script content
   * This will be used to automatically provide GitHub token
   */
  async getCredentialHelperScript(): Promise<string | null> {
    const token = await this.settingsManager.getGitHubToken();
    
    if (!token) {
      return null;
    }

    // For Windows PowerShell
    if (process.platform === 'win32') {
      return `$input = Read-Host
if ($input -match 'password') {
    Write-Output '${token}'
} else {
    Write-Output ''
}`;
    }

    // For Unix-like systems
    return `#!/bin/sh
echo '${token}'`;
  }
}

