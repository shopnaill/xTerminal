# Quick Start Guide

## Current Status

The app is built and Electron is installed, but `node-pty` needs to be compiled with Visual Studio. The terminal functionality won't work until `node-pty` is built.

## Option 1: Build node-pty (Recommended)

**Use Command Prompt (not PowerShell):**

1. Open **Command Prompt** (cmd.exe)
2. Navigate to the project:
   ```cmd
   cd D:\Work\Terminal
   ```
3. Run the rebuild script:
   ```cmd
   rebuild-node-pty.bat
   ```

This script will:
- Set up the Visual Studio environment
- Rebuild node-pty with the correct compiler
- Verify the build succeeded

## Option 2: Use Developer Command Prompt

1. Open **Developer Command Prompt for VS 2026** (search in Start Menu)
2. Navigate to project:
   ```cmd
   cd D:\Work\Terminal
   ```
3. Rebuild:
   ```cmd
   npm rebuild node-pty
   ```

## Option 3: Run App Without Terminal (Testing UI)

If you just want to test the UI without terminal functionality:

```powershell
npm start
```

The app will launch, but terminals won't work until `node-pty` is built.

## Verify Installation

After rebuilding, test that node-pty works:

```powershell
node -e "const pty = require('node-pty'); console.log('node-pty loaded successfully');"
```

If you see "node-pty loaded successfully", you're ready to go!

## Next Steps

Once `node-pty` is built:
1. Run `npm start` to launch the app
2. Click the **+** button to create terminal tabs
3. Start using your terminal app!

