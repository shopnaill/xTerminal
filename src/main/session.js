import Store from 'electron-store';
import * as keytar from 'keytar';
import { v4 as uuidv4 } from 'uuid';
export class SessionManager {
    constructor() {
        this.serviceName = 'terminal-app';
        this.store = new Store({
            name: 'sessions',
            defaults: {
                sessions: [],
            },
        });
    }
    /**
     * Get all saved sessions
     */
    getAllSessions() {
        return this.store.get('sessions', []);
    }
    /**
     * Get a session by ID
     */
    getSession(id) {
        const sessions = this.getAllSessions();
        return sessions.find((s) => s.id === id);
    }
    /**
     * Save a new session or update an existing one
     */
    async saveSession(session) {
        const sessions = this.getAllSessions();
        let savedSession;
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
            }
            else {
                throw new Error(`Session with id ${session.id} not found`);
            }
        }
        else {
            // Create new session
            savedSession = {
                ...session,
                id: uuidv4(),
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
    async deleteSession(id) {
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
    async savePassword(sessionId, password) {
        try {
            await keytar.setPassword(this.serviceName, sessionId, password);
        }
        catch (error) {
            console.error('Failed to save password to keyring:', error);
            throw error;
        }
    }
    /**
     * Get password from OS keyring
     */
    async getPassword(sessionId) {
        try {
            return await keytar.getPassword(this.serviceName, sessionId);
        }
        catch (error) {
            console.error('Failed to get password from keyring:', error);
            return null;
        }
    }
    /**
     * Delete password from OS keyring
     */
    async deletePassword(sessionId) {
        try {
            await keytar.deletePassword(this.serviceName, sessionId);
        }
        catch (error) {
            console.error('Failed to delete password from keyring:', error);
        }
    }
    /**
     * Update last used timestamp
     */
    updateLastUsed(id) {
        const sessions = this.getAllSessions();
        const session = sessions.find((s) => s.id === id);
        if (session) {
            session.lastUsed = Date.now();
            this.store.set('sessions', sessions);
        }
    }
}
//# sourceMappingURL=session.js.map