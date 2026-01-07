import { SFTPWrapper } from 'ssh2';
import { EventEmitter } from 'events';

export interface FileInfo {
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

export class SFTPManager extends EventEmitter {
  private terminals: Map<string, SFTPWrapper> = new Map();

  registerTerminal(terminalId: string, sftp: SFTPWrapper): void {
    this.terminals.set(terminalId, sftp);
    this.emit('terminal-registered', terminalId);
  }

  unregisterTerminal(terminalId: string): void {
    this.terminals.delete(terminalId);
    this.emit('terminal-unregistered', terminalId);
  }

  getSFTP(terminalId: string): SFTPWrapper | null {
    return this.terminals.get(terminalId) || null;
  }

  async listDirectory(terminalId: string, path: string): Promise<FileInfo[]> {
    const sftp = this.getSFTP(terminalId);
    if (!sftp) {
      throw new Error(`SFTP client not available for terminal ${terminalId}`);
    }

    return new Promise((resolve, reject) => {
      sftp.readdir(path, (err, list) => {
        if (err) {
          reject(err);
          return;
        }
        // Map FileEntryWithStats to FileInfo by deriving type from stats
        const fileInfos: FileInfo[] = list.map((entry: any) => {
          let type: 'd' | '-' | 'l' = '-';
          const stats = entry.attrs;
          
          // Use Stats methods if available
          if (stats) {
            if (typeof stats.isDirectory === 'function' && stats.isDirectory()) {
              type = 'd';
            } else if (typeof stats.isSymbolicLink === 'function' && stats.isSymbolicLink()) {
              type = 'l';
            } else {
              // Fallback: check mode bits (S_IFDIR = 0o040000, S_IFLNK = 0o120000)
              const mode = stats.mode || 0;
              if ((mode & 0o170000) === 0o040000) {
                type = 'd';
              } else if ((mode & 0o170000) === 0o120000) {
                type = 'l';
              }
            }
          }
          
          // Ensure numeric values are within safe ranges for IPC serialization
          const safeSize = Math.min(stats?.size || 0, Number.MAX_SAFE_INTEGER);
          const safeMode = (stats?.mode || 0) & 0xFFFF; // Limit to 16 bits
          const safeUid = Math.min(stats?.uid || 0, 0xFFFFFFFF);
          const safeGid = Math.min(stats?.gid || 0, 0xFFFFFFFF);
          
          return {
            filename: entry.filename,
            longname: entry.longname || entry.filename,
            attrs: {
              mode: safeMode,
              uid: safeUid,
              gid: safeGid,
              size: safeSize,
              atime: stats?.atime || 0,
              mtime: stats?.mtime || 0,
            },
            type,
          } as FileInfo;
        });
        resolve(fileInfos);
      });
    });
  }

  async readFile(terminalId: string, path: string): Promise<Buffer> {
    const sftp = this.getSFTP(terminalId);
    if (!sftp) {
      throw new Error(`SFTP client not available for terminal ${terminalId}`);
    }

    return new Promise((resolve, reject) => {
      sftp.readFile(path, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
  }

  async writeFile(terminalId: string, path: string, data: Buffer | string): Promise<void> {
    const sftp = this.getSFTP(terminalId);
    if (!sftp) {
      throw new Error(`SFTP client not available for terminal ${terminalId}`);
    }

    return new Promise((resolve, reject) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
      sftp.writeFile(path, buffer, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async mkdir(terminalId: string, path: string): Promise<void> {
    const sftp = this.getSFTP(terminalId);
    if (!sftp) {
      throw new Error(`SFTP client not available for terminal ${terminalId}`);
    }

    return new Promise((resolve, reject) => {
      sftp.mkdir(path, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async delete(terminalId: string, path: string): Promise<void> {
    const sftp = this.getSFTP(terminalId);
    if (!sftp) {
      throw new Error(`SFTP client not available for terminal ${terminalId}`);
    }

    return new Promise((resolve, reject) => {
      // Try to determine if it's a file or directory
      sftp.lstat(path, (err, stats) => {
        if (err) {
          reject(err);
          return;
        }

        if (stats.isDirectory()) {
          sftp.rmdir(path, (rmErr) => {
            if (rmErr) {
              reject(rmErr);
              return;
            }
            resolve();
          });
        } else {
          sftp.unlink(path, (unlinkErr) => {
            if (unlinkErr) {
              reject(unlinkErr);
              return;
            }
            resolve();
          });
        }
      });
    });
  }

  async getCurrentDirectory(terminalId: string): Promise<string> {
    const sftp = this.getSFTP(terminalId);
    if (!sftp) {
      throw new Error(`SFTP client not available for terminal ${terminalId}`);
    }

    return new Promise((resolve, reject) => {
      sftp.realpath('.', (err, absPath) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(absPath);
      });
    });
  }

  async rename(terminalId: string, oldPath: string, newPath: string): Promise<void> {
    const sftp = this.getSFTP(terminalId);
    if (!sftp) {
      throw new Error(`SFTP client not available for terminal ${terminalId}`);
    }

    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async copy(terminalId: string, sourcePath: string, destPath: string): Promise<void> {
    const sftp = this.getSFTP(terminalId);
    if (!sftp) {
      throw new Error(`SFTP client not available for terminal ${terminalId}`);
    }

    // Read source file
    const data = await this.readFile(terminalId, sourcePath);
    
    // Write to destination
    return this.writeFile(terminalId, destPath, data);
  }

  async chmod(terminalId: string, path: string, mode: number): Promise<void> {
    const sftp = this.getSFTP(terminalId);
    if (!sftp) {
      throw new Error(`SFTP client not available for terminal ${terminalId}`);
    }

    return new Promise((resolve, reject) => {
      sftp.chmod(path, mode, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async download(terminalId: string, remotePath: string): Promise<Buffer> {
    // Download just returns the file buffer
    // The main process will handle saving to local filesystem
    return this.readFile(terminalId, remotePath);
  }
}

