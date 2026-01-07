# Workaround Solutions for node-pty Build Issue

## Problem
node-gyp cannot detect Visual Studio 2026 from the custom installation path (`D:\Program Files\VS`). This is a known limitation of node-gyp's Visual Studio finder.

## Solution Options

### Option 1: Create a Junction/Symlink (Recommended)

Create a symlink from the standard Visual Studio location to your custom installation:

**Run as Administrator:**
```cmd
mklink /J "C:\Program Files\Microsoft Visual Studio\2022\BuildTools" "D:\Program Files\VS"
```

Then try rebuilding:
```cmd
npm rebuild node-pty
```

### Option 2: Install Visual Studio 2022 in Standard Location

Install Visual Studio 2022 Build Tools in the standard location:
- Download: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
- Install to: `C:\Program Files\Microsoft Visual Studio\2022\BuildTools`
- Select "Desktop development with C++" workload

Then rebuild:
```cmd
npm rebuild node-pty
```

### Option 3: Use Pre-built Binary (If Available)

Check if there's a pre-built binary for your Node.js version:
```powershell
npm install node-pty-prebuilt-multiarch --save
```

Then update `src/main/terminal.ts` to use the pre-built version.

### Option 4: Manual Build Script

Try the manual build script:
```cmd
rebuild-node-pty-manual.bat
```

This attempts to bypass version detection.

### Option 5: Use WSL or Docker

If you have WSL2 installed, you can build node-pty in Linux:
```bash
# In WSL
npm install
npm rebuild node-pty
```

Then copy the built files back to Windows.

## Recommended Approach

**Option 1 (Symlink)** is the cleanest solution if you want to keep your custom Visual Studio installation. It allows node-gyp to find Visual Studio while keeping your files where you want them.

## Verification

After any solution, verify it works:
```cmd
node -e "const pty = require('node-pty'); console.log('Success!');"
```

If you see "Success!", node-pty is working correctly.

