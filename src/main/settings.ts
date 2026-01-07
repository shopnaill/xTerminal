import Store from 'electron-store';
import * as keytar from 'keytar';

export interface AppSettings {
  terminal: {
    fontSize: number;
    fontFamily: string;
    theme: string;
  };
  ui: {
    theme: 'light' | 'dark' | 'auto';
  };
  github: {
    enabled: boolean;
    tokenStored: boolean; // Whether token is stored (not the token itself)
  };
  gemini: {
    enabled: boolean;
    tokenStored: boolean; // Whether token is stored (not the token itself)
  };
  connection: {
    defaultPort: number;
    defaultTimeout: number;
  };
}

const defaultSettings: AppSettings = {
  terminal: {
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: 'dark',
  },
  ui: {
    theme: 'dark',
  },
  github: {
    enabled: true,
    tokenStored: false,
  },
  gemini: {
    enabled: true,
    tokenStored: false,
  },
  connection: {
    defaultPort: 22,
    defaultTimeout: 20000,
  },
};

export class SettingsManager {
  private store: Store<{ settings: AppSettings }>;
  private serviceName = 'terminal-app';
  private githubTokenKey = 'github-access-token';
  private geminiTokenKey = 'gemini-api-token';

  constructor() {
    this.store = new Store<{ settings: AppSettings }>({
      name: 'settings',
      defaults: {
        settings: defaultSettings,
      },
    });
  }

  getSettings(): AppSettings {
    const settings = this.store.get('settings');
    return { ...defaultSettings, ...settings };
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = this.deepMerge(current, updates);
    this.store.set('settings', updated);
    return updated;
  }

  async getGitHubToken(): Promise<string | null> {
    try {
      const token = await keytar.getPassword(this.serviceName, this.githubTokenKey);
      return token;
    } catch (error) {
      console.error('Failed to get GitHub token from keyring:', error);
      return null;
    }
  }

  async setGitHubToken(token: string): Promise<void> {
    try {
      await keytar.setPassword(this.serviceName, this.githubTokenKey, token);
      // Update settings to indicate token is stored
      const current = this.getSettings();
      this.updateSettings({
        github: {
          ...current.github,
          tokenStored: true,
        },
      });
    } catch (error) {
      console.error('Failed to save GitHub token to keyring:', error);
      throw error;
    }
  }

  async deleteGitHubToken(): Promise<void> {
    try {
      await keytar.deletePassword(this.serviceName, this.githubTokenKey);
      // Update settings to indicate token is not stored
      const current = this.getSettings();
      this.updateSettings({
        github: {
          ...current.github,
          tokenStored: false,
        },
      });
    } catch (error) {
      console.error('Failed to delete GitHub token from keyring:', error);
      throw error;
    }
  }

  async hasGitHubToken(): Promise<boolean> {
    const token = await this.getGitHubToken();
    return token !== null && token.length > 0;
  }

  async getGeminiToken(): Promise<string | null> {
    try {
      const token = await keytar.getPassword(this.serviceName, this.geminiTokenKey);
      return token;
    } catch (error) {
      console.error('Failed to get Gemini token from keyring:', error);
      return null;
    }
  }

  async setGeminiToken(token: string): Promise<void> {
    try {
      await keytar.setPassword(this.serviceName, this.geminiTokenKey, token);
      // Update settings to indicate token is stored
      const current = this.getSettings();
      this.updateSettings({
        gemini: {
          ...current.gemini,
          tokenStored: true,
        },
      });
    } catch (error) {
      console.error('Failed to save Gemini token to keyring:', error);
      throw error;
    }
  }

  async deleteGeminiToken(): Promise<void> {
    try {
      await keytar.deletePassword(this.serviceName, this.geminiTokenKey);
      // Update settings to indicate token is not stored
      const current = this.getSettings();
      this.updateSettings({
        gemini: {
          ...current.gemini,
          tokenStored: false,
        },
      });
    } catch (error) {
      console.error('Failed to delete Gemini token from keyring:', error);
      throw error;
    }
  }

  async hasGeminiToken(): Promise<boolean> {
    const token = await this.getGeminiToken();
    return token !== null && token.length > 0;
  }

  private deepMerge(target: any, source: any): any {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
}

