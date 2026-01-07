# Using Visual Studio 2026 with node-pty

## Step-by-Step Guide

### Step 1: Patch node-gyp (Required)

**Run as Administrator:**

```cmd
patch-node-gyp-vs2026.bat
```

Or run PowerShell directly:
```powershell
powershell -ExecutionPolicy Bypass -File patch-node-gyp-vs2026.ps1
```

This modifies node-gyp to recognize VS 2026 (version 26).

**What it does:**
- Adds version 26 to supported versions
- Updates version detection logic
- Creates a backup automatically

### Step 2: Rebuild node-pty

After patching, rebuild node-pty:

**Option A: Simple method (Recommended)**
```cmd
rebuild-node-pty-simple.bat
```

**Option B: Manual method**
1. Open Command Prompt
2. Set up VS environment:
   ```cmd
   "D:\Program Files\VS\VC\Auxiliary\Build\vcvars64.bat"
   ```
3. Navigate to project:
   ```cmd
   cd D:\Work\Terminal
   ```
4. Rebuild:
   ```cmd
   npm rebuild node-pty
   ```

### Step 3: Verify

```cmd
node -e "const pty = require('node-pty'); console.log('Success!');"
```

If you see "Success!", you're done!

### Step 4: Start the App

```powershell
npm start
```

## Troubleshooting

### "node-gyp still can't find VS"

1. **Verify the patch was applied:**
   - Check if backup file exists: `%APPDATA%\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js.backup`
   - The patched file should contain "26" in version checks

2. **Reapply the patch:**
   ```cmd
   patch-node-gyp-vs2026.bat
   ```

3. **Check VS environment:**
   ```cmd
   "D:\Program Files\VS\VC\Auxiliary\Build\vcvars64.bat"
   where cl
   ```
   Should show the compiler path.

### "Patch script fails"

Run PowerShell script directly:
```powershell
powershell -ExecutionPolicy Bypass -File patch-node-gyp-vs2026.ps1
```

### "Rebuild still fails after patching"

1. **Clear and reinstall:**
   ```cmd
   rmdir /s /q node_modules\node-pty
   npm install node-pty --ignore-scripts
   npm rebuild node-pty
   ```

2. **Check build output:**
   Look in `node_modules\node-pty\build\Release\` for `.node` files

## Important Notes

- **Patch persists** until you update npm/node-gyp
- **Reapply patch** after npm updates
- **Backup is created** automatically (`.backup` file)
- **VS 2026 uses same toolchain** as VS 2022, so it's fully compatible

## Quick Reference

```cmd
REM 1. Patch node-gyp (as Admin)
patch-node-gyp-vs2026.bat

REM 2. Rebuild (from VS Command Prompt)
"D:\Program Files\VS\VC\Auxiliary\Build\vcvars64.bat"
cd D:\Work\Terminal
npm rebuild node-pty

REM 3. Verify
node -e "const pty = require('node-pty'); console.log('Success!');"

REM 4. Start app
npm start
```

