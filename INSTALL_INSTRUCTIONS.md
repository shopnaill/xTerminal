# Installation Instructions for Custom Visual Studio Path

Since your Visual Studio is installed at `D:\Program Files\VS` (a non-standard location), node-gyp has trouble detecting it automatically.

## Option 1: Use the Batch Script (Recommended)

Run the provided batch script which sets up the Visual Studio environment:

```powershell
.\install.bat
```

This script will:
1. Set up the Visual Studio 2026 Developer Command Prompt environment
2. Run `npm install` with the correct environment variables

## Option 2: Manual Installation via Developer Command Prompt

1. Open **Developer Command Prompt for VS 2026** (or run):
   ```cmd
   "D:\Program Files\VS\VC\Auxiliary\Build\vcvars64.bat"
   ```

2. Navigate to the project directory:
   ```cmd
   cd D:\Work\Terminal
   ```

3. Run npm install:
   ```cmd
   npm install
   ```

## Option 3: Set Environment Variables in PowerShell

Run these commands in PowerShell before `npm install`:

```powershell
$env:VCINSTALLDIR = "D:\Program Files\VS\VC\"
$env:VSINSTALLDIR = "D:\Program Files\VS\"
$env:WindowsSdkDir = "D:\Program Files\VS\SDK\"
npm install
```

## Troubleshooting

If you still encounter issues:

1. **Make sure the C++ workload is installed** in Visual Studio
2. **Restart your terminal** after setting environment variables
3. **Try running as Administrator** if you get permission errors
4. **Clear npm cache**: `npm cache clean --force`
5. **Delete node_modules** and try again: `Remove-Item -Recurse -Force node_modules`

## Alternative: Use Pre-built Binaries

If building continues to fail, you could try using a pre-built version, though this is less recommended:
- Consider using `node-pty-prebuilt-multiarch` (less maintained)
- Or wait for a pre-built binary for your Node.js version

