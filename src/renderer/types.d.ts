declare const Terminal: any;
declare const FitAddon: any;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

declare global {
  interface Window {
    electronAPI: {
      terminal: {
        create: (id: string, cols: number, rows: number, sessionId?: string, password?: string) => Promise<{ success: boolean }>;
        write: (id: string, data: string) => Promise<{ success: boolean }>;
        resize: (id: string, cols: number, rows: number) => Promise<{ success: boolean }>;
        destroy: (id: string) => Promise<{ success: boolean }>;
        list: () => Promise<string[]>;
        getHistory: (id: string) => Promise<{ success: boolean; history?: string[]; error?: string }>;
        getSuggestions: (id: string, prefix: string) => Promise<{ success: boolean; suggestions?: string[]; error?: string }>;
      };
      session: {
        list: () => Promise<Session[]>;
        get: (id: string) => Promise<Session | undefined>;
        save: (sessionData: any, password?: string) => Promise<{ success: boolean; session?: Session; error?: string }>;
        delete: (id: string) => Promise<{ success: boolean }>;
        getPassword: (sessionId: string) => Promise<{ success: boolean; password?: string | null }>;
        setPassword: (sessionId: string, password: string) => Promise<{ success: boolean }>;
      };
      sftp: {
        list: (terminalId: string, path: string) => Promise<{ success: boolean; files?: any[]; error?: string }>;
        readFile: (terminalId: string, path: string) => Promise<{ success: boolean; data?: string; error?: string }>;
        writeFile: (terminalId: string, path: string, data: string) => Promise<{ success: boolean; error?: string }>;
        mkdir: (terminalId: string, path: string) => Promise<{ success: boolean; error?: string }>;
        delete: (terminalId: string, path: string) => Promise<{ success: boolean; error?: string }>;
        rename: (terminalId: string, oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
        copy: (terminalId: string, sourcePath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
        chmod: (terminalId: string, path: string, mode: number) => Promise<{ success: boolean; error?: string }>;
        download: (terminalId: string, remotePath: string) => Promise<{ success: boolean; localPath?: string; error?: string }>;
        openFile: (terminalId: string, remotePath: string) => Promise<{ success: boolean; error?: string }>;
      };
      git: {
        clone: (repo: string, targetDirectory?: string) => Promise<{ success: boolean; command?: string; error?: string }>;
        browseDirectory: () => Promise<{ success: boolean; directory?: string; error?: string }>;
      };
      chat: {
        sendMessage: (messages: ChatMessage[], terminalContext?: string) => Promise<{ success: boolean; response?: string; error?: string }>;
        executeCommand: (terminalId: string, command: string) => Promise<{ success: boolean; error?: string }>;
      };
      update: {
        checkForUpdates: () => Promise<{ success: boolean; updateAvailable?: boolean; version?: string; error?: string }>;
        downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
        installUpdate: () => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{ status: string; version?: string; progress?: number; error?: string }>;
        onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => void;
        onUpdateNotAvailable: (callback: (info: { version: string }) => void) => void;
        onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => void;
        onUpdateDownloaded: (callback: (info: { version: string }) => void) => void;
        onUpdateError: (callback: (error: string) => void) => void;
      };
      settings: {
        get: () => Promise<any>;
        set: (updates: any) => Promise<{ success: boolean; settings?: any; error?: string }>;
        getGitHubToken: () => Promise<{ success: boolean; token?: string | null; error?: string }>;
        setGitHubToken: (token: string) => Promise<{ success: boolean; error?: string }>;
        deleteGitHubToken: () => Promise<{ success: boolean; error?: string }>;
        hasGitHubToken: () => Promise<{ success: boolean; hasToken?: boolean; error?: string }>;
        getGeminiToken: () => Promise<{ success: boolean; token?: string | null; error?: string }>;
        setGeminiToken: (token: string) => Promise<{ success: boolean; error?: string }>;
        deleteGeminiToken: () => Promise<{ success: boolean; error?: string }>;
        hasGeminiToken: () => Promise<{ success: boolean; hasToken?: boolean; error?: string }>;
      };
      onTerminalData: (callback: (id: string, data: string) => void) => void;
      onTerminalExit: (callback: (id: string, info: { code: number; signal?: number }) => void) => void;
      onTerminalError: (callback: (id: string, error: string) => void) => void;
      onSFTPReady: (callback: (id: string) => void) => void;
    };
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
}

export {};

