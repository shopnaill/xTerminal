import Store from 'electron-store';
import * as keytar from 'keytar';

export type ConnectionType = 'ssh' | 'rdp' | 'telnet' | 'local';

export interface PortForwarding {
  localPort: number;
  remoteHost: string;
  remotePort: number;
}

export interface Session {
  id: string;
  name: string;
  type: ConnectionType;
  host: string;
  port: number;
  username: string;
  keyPath?: string;
  jumpHost?: string;
  portForwarding?: PortForwarding[];
  customCommands?: string[];
  environmentVariables?: { [key: string]: string };
  terminalSettings?: {
    fontSize?: number;
    fontFamily?: string;
    theme?: string;
  };
  createdAt: number;
  lastUsed?: number;
}

export class SessionManager {
  private store: Store<{ sessions: Session[] }>;
  private serviceName = 'terminal-app';

  constructor() {
    this.store = new Store<{ sessions: Session[] }>({
      name: 'sessions',
      defaults: {
        sessions: [],
      },
    });
  }

  /**
   * Get all saved sessions
   */
  getAllSessions(): Session[] {
    return this.store.get('sessions', []);
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): Session | undefined {
    const sessions = this.getAllSessions();
    return sessions.find((s) => s.id === id);
  }

  /**
   * Save a new session or update an existing one
   */
  async saveSession(session: Omit<Session, 'id' | 'createdAt' | 'lastUsed'> & { id?: string }): Promise<Session> {
    const sessions = this.getAllSessions();
    let savedSession: Session;

    if (session.id) {
      // Update existing session
      const index = sessions.findIndex((s) => s.id === session.id);
      if (index >= 0) {
        savedSession = {
          ...sessions[index],
          ...session,
          lastUsed: Date.now(),
        };
        sessions[index] = savedSession;
      } else {
        throw new Error(`Session with id ${session.id} not found`);
      }
    } else {
      // Create new session
      // Generate UUID using crypto.randomUUID or fallback
      let sessionId: string;
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        sessionId = crypto.randomUUID();
      } else {
        // Fallback: simple ID generation
        sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      }
      savedSession = {
        ...session,
        id: sessionId,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      };
      sessions.push(savedSession);
    }

    this.store.set('sessions', sessions);
    return savedSession;
  }

  /**
   * Delete a session
   */
  async deleteSession(id: string): Promise<boolean> {
    const sessions = this.getAllSessions();
    const index = sessions.findIndex((s) => s.id === id);
    
    if (index >= 0) {
      // Delete password from keyring
      await this.deletePassword(id);
      sessions.splice(index, 1);
      this.store.set('sessions', sessions);
      return true;
    }
    
    return false;
  }

  /**
   * Save password to OS keyring
   */
  async savePassword(sessionId: string, password: string): Promise<void> {
    try {
      await keytar.setPassword(this.serviceName, sessionId, password);
    } catch (error) {
      console.error('Failed to save password to keyring:', error);
      throw error;
    }
  }

  /**
   * Get password from OS keyring
   */
  async getPassword(sessionId: string): Promise<string | null> {
    try {
      return await keytar.getPassword(this.serviceName, sessionId);
    } catch (error) {
      console.error('Failed to get password from keyring:', error);
      return null;
    }
  }

  /**
   * Delete password from OS keyring
   */
  async deletePassword(sessionId: string): Promise<void> {
    try {
      await keytar.deletePassword(this.serviceName, sessionId);
    } catch (error) {
      console.error('Failed to delete password from keyring:', error);
    }
  }

  /**
   * Update last used timestamp
   */
  updateLastUsed(id: string): void {
    const sessions = this.getAllSessions();
    const session = sessions.find((s) => s.id === id);
    if (session) {
      session.lastUsed = Date.now();
      this.store.set('sessions', sessions);
    }
  }
}

