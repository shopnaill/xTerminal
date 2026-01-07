# Install Windows SDK

## Current Issue

The build is failing because Windows SDK 10.0.19041.0 is not installed. VS 2026 is detected correctly, but the Windows SDK is missing.

## Solution: Install Windows SDK

### Option 1: Via Visual Studio Installer (Recommended)

1. Open **Visual Studio Installer**
2. Click **Modify** on your VS 2026 installation
3. Go to **Individual components** tab
4. Search for "Windows SDK"
5. Select the latest **Windows 10 SDK** or **Windows 11 SDK** (e.g., 10.0.22621.0 or similar)
6. Click **Modify** to install

### Option 2: Standalone Windows SDK

1. Download Windows SDK from:
   https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
2. Run the installer
3. Select the SDK version to install
4. Complete the installation

### Option 3: Use Existing SDK (If Installed Elsewhere)

If Windows SDK is installed but not detected, you can set it manually:

```cmd
set WindowsSDKVersion=10.0.22621.0
```

Replace `10.0.22621.0` with your actual SDK version.

## After Installation

1. **Restart your terminal**
2. **Rebuild node-pty:**
   ```cmd
   rebuild-node-pty-final.bat
   ```

## Verify SDK Installation

Check if SDK is installed:
```powershell
Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\Include" -Directory
```

You should see folders like `10.0.22621.0` or similar.

## Current Status

✅ VS 2026 detected and working  
✅ Build process started  
❌ Windows SDK missing (needs installation)

Once Windows SDK is installed, the build should complete successfully!

