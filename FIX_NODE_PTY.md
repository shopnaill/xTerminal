# Fix node-pty Installation

## Current Status
- ✅ Dependencies installed
- ✅ TypeScript build working
- ⚠️ node-pty needs to be rebuilt with Visual Studio

## Step-by-Step Fix

### Step 1: Open Developer Command Prompt

**Important**: Use **Command Prompt** (cmd.exe), NOT PowerShell!

1. Press `Win + R`
2. Type: `cmd`
3. Press `Enter`

### Step 2: Set Up Visual Studio Environment

In the Command Prompt, run:
```cmd
"D:\Program Files\VS\VC\Auxiliary\Build\vcvars64.bat"
```

You should see:
```
**********************************************************************
** Visual Studio 2026 Developer Command Prompt v18.3.0-insiders
** Copyright (c) 2025 Microsoft Corporation
**********************************************************************
[vcvarsall.bat] Environment initialized for: 'x64'
```

### Step 3: Navigate to Project

```cmd
cd D:\Work\Terminal
```

### Step 4: Rebuild node-pty

```cmd
npm rebuild node-pty
```

Wait for it to complete. You should see:
```
> node-pty@1.0.0 install D:\Work\Terminal\node_modules\node-pty
> node-gyp rebuild

...
```

### Step 5: Verify Installation

```cmd
node -e "const pty = require('node-pty'); console.log('node-pty loaded successfully!');"
```

If you see "node-pty loaded successfully!", you're done!

### Step 6: Start the App

From PowerShell (or the same Command Prompt):
```powershell
npm start
```

## Alternative: Use the Batch Script

1. Open **Command Prompt** (not PowerShell)
2. Navigate to project:
   ```cmd
   cd D:\Work\Terminal
   ```
3. Run:
   ```cmd
   rebuild-node-pty.bat
   ```

This script does all the steps above automatically.

## Troubleshooting

### "Cannot find module 'node-pty'"

This means the rebuild didn't complete successfully. Try:

1. **Delete node_modules/node-pty:**
   ```cmd
   rmdir /s /q node_modules\node-pty
   ```

2. **Reinstall and rebuild:**
   ```cmd
   npm install node-pty --ignore-scripts
   npm rebuild node-pty
   ```

### "node-gyp rebuild failed"

Make sure:
- You're in a Command Prompt (not PowerShell)
- Visual Studio environment is set up (vcvars64.bat was called)
- You're in the project directory
- Visual Studio 2026 has C++ workload installed

### Still Not Working?

Try building manually:
```cmd
cd node_modules\node-pty
node-gyp rebuild
cd ..\..
```

