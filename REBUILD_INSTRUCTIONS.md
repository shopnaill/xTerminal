# Rebuilding Native Modules for Electron

## Problem
The native modules (`node-pty` and `keytar`) need to be rebuilt for Electron. This requires Visual Studio Build Tools.

## Solution

### Option 1: Install Visual Studio Build Tools (Recommended)

1. **Download Visual Studio Build Tools 2022**:
   - Visit: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
   - Download "Build Tools for Visual Studio 2022"

2. **Install with C++ workload**:
   - Run the installer
   - Select "Desktop development with C++" workload
   - Make sure "MSVC v143 - VS 2022 C++ x64/x86 build tools" is checked
   - Click "Install"

3. **Rebuild modules**:
   ```powershell
   npm run rebuild:electron
   ```

### Option 2: Use Pre-built Binaries (If Available)

If you have pre-built binaries or want to skip rebuilding temporarily:

1. Close all Electron processes
2. Delete the build folders:
   ```powershell
   Remove-Item -Recurse -Force node_modules\node-pty\build -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force node_modules\keytar\build -ErrorAction SilentlyContinue
   ```
3. Try running the app - it may work if binaries are already compatible

### Option 3: Use Alternative Terminal (Temporary Workaround)

The app will work for SSH connections even if local terminals fail. You can:
- Use SSH sessions (they work without node-pty rebuild)
- Wait until build tools are installed for local terminal support

## Troubleshooting

### Error: "Could not find any Visual Studio installation"
- Install Visual Studio Build Tools (see Option 1)
- Or install full Visual Studio 2022 Community with C++ workload

### Error: "EPERM: operation not permitted"
- Close all Electron/Node processes
- Run PowerShell as Administrator
- Try the rebuild again

### Check if build tools are installed:
```powershell
npm config get msvs_version
```

If it returns a version number, build tools are configured.

## After Successful Rebuild

Once rebuild succeeds, you should see:
- `node_modules\node-pty\build\Release\conpty.node` exists
- `node_modules\keytar\build\Release\keytar.node` exists

Then run:
```powershell
npm start
```
