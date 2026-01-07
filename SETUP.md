# Setup Instructions

## Prerequisites for Windows

### 1. Install Visual Studio Build Tools

`node-pty` requires native compilation on Windows. You need to install Visual Studio Build Tools:

**Option A: Visual Studio Build Tools (Recommended - Smaller download)**
1. Download Visual Studio Build Tools from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
2. Run the installer
3. Select "Desktop development with C++" workload
4. Click Install

**Option B: Full Visual Studio**
1. Download Visual Studio Community (free) from: https://visualstudio.microsoft.com/downloads/
2. During installation, select "Desktop development with C++" workload
3. Complete the installation

### 2. Install Windows Build Tools (Alternative)

If you prefer using npm to install build tools:

```powershell
npm install --global windows-build-tools
```

**Note:** This method is deprecated but may still work. The Visual Studio Build Tools method above is recommended.

### 3. Restart Your Terminal

After installing Visual Studio Build Tools, close and reopen your terminal/PowerShell window.

### 4. Install Dependencies

```powershell
npm install
```

### 5. Build and Run

```powershell
npm run build
npm start
```

## Troubleshooting

If you still encounter issues:

1. **Make sure you have the latest Node.js** (v16 or higher)
2. **Run PowerShell as Administrator** when installing dependencies
3. **Clear npm cache**: `npm cache clean --force`
4. **Delete node_modules and package-lock.json**, then reinstall:
   ```powershell
   Remove-Item -Recurse -Force node_modules
   Remove-Item package-lock.json
   npm install
   ```

## Alternative: Use Pre-built Binaries

If you continue to have issues with building `node-pty`, you can try using a pre-built version or consider using `node-pty-prebuilt-multiarch` (though this is less maintained).

