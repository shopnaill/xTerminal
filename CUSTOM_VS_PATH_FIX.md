# Fix for Custom Visual Studio Path (D:\Program Files\VS)

Your Visual Studio 2026 is installed at a custom location, and node-gyp can't automatically detect the version. Here are solutions:

## Solution 1: Use Developer Command Prompt (Recommended)

1. **Open Developer Command Prompt for VS 2026**:
   - Press `Win + R`
   - Type: `cmd`
   - Press `Ctrl + Shift + Enter` (to run as admin)
   - Or find it in Start Menu: "Developer Command Prompt for VS 2026"

2. **If Developer Command Prompt is not available**, run this in a regular Command Prompt:
   ```cmd
   "D:\Program Files\VS\VC\Auxiliary\Build\vcvars64.bat"
   ```

3. **Navigate to project and install**:
   ```cmd
   cd D:\Work\Terminal
   npm install
   ```

The Developer Command Prompt has all the environment variables pre-configured.

## Solution 2: Create a Batch File Wrapper

Create a file `npm-install.bat` in your project root:

```batch
@echo off
call "D:\Program Files\VS\VC\Auxiliary\Build\vcvars64.bat"
cd /d "%~dp0"
call npm install
```

Then run: `npm-install.bat`

## Solution 3: Set Environment Variables Permanently

Add these to your system environment variables (requires admin):

1. Open System Properties → Environment Variables
2. Add/Edit:
   - `VCINSTALLDIR` = `D:\Program Files\VS\VC\`
   - `VSINSTALLDIR` = `D:\Program Files\VS\`
   - `WindowsSdkDir` = `D:\Program Files\VS\SDK\` (if exists)

3. Restart your terminal and run `npm install`

## Solution 4: Use Pre-built Binary (Workaround)

If building continues to fail, you can try using a pre-built version:

```powershell
npm install --ignore-scripts
# Then manually download a pre-built node-pty binary for your Node.js version
# Or wait for npm to provide pre-built binaries
```

## Why This Happens

node-gyp looks for Visual Studio in standard locations and reads version information from specific files. Your custom installation path (`D:\Program Files\VS`) doesn't have the version detection files in the format node-gyp expects, so it can't determine it's Visual Studio 2026.

## Verification

After successful installation, verify node-pty works:
```powershell
node -e "const pty = require('node-pty'); console.log('node-pty loaded successfully');"
```

If you see "node-pty loaded successfully", you're good to go!

