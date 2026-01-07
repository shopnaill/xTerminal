# Making node-gyp Work with Visual Studio 2026

## The Problem

node-gyp's Visual Studio finder only recognizes versions 2017, 2019, and 2022. Visual Studio 2026 (Insiders) is not in this list, so node-gyp rejects it even though the tools are compatible.

## Solution: Patch node-gyp

We need to modify node-gyp's `find-visualstudio.js` to recognize VS 2026.

### Automatic Patch (Recommended)

Run the patch script:
```cmd
patch-node-gyp-vs2026.bat
```

This will:
1. Find node-gyp's find-visualstudio.js file
2. Create a backup
3. Add VS 2026 to the supported versions list
4. Update version checks

### Manual Patch

If the automatic patch doesn't work, do it manually:

1. **Find node-gyp location:**
   ```cmd
   where node-gyp
   ```
   Usually at: `%APPDATA%\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js`

2. **Open the file in a text editor** (as Administrator if needed)

3. **Find and modify these sections:**

   **a) Add 26 to supported versions:**
   ```javascript
   // Find this line (around line 50-60):
   const supportedVersions = [17, 19, 22]
   
   // Change to:
   const supportedVersions = [17, 19, 22, 26]
   ```

   **b) Update version checks:**
   ```javascript
   // Find lines with version checks like:
   if (version === 17 || version === 19 || version === 22)
   
   // Change to:
   if (version === 17 || version === 19 || version === 22 || version === 26)
   ```

   **c) Update version filtering:**
   ```javascript
   // Find lines that filter versions, add 26:
   version === 17 || version === 19 || version === 22 || version === 26
   ```

4. **Save the file**

5. **Rebuild node-pty:**
   ```cmd
   npm rebuild node-pty
   ```

## Alternative: Force Version Detection

If patching doesn't work, we can try to create a version detection file:

1. **Create version file:**
   ```cmd
   echo 18.3.0 > "D:\Program Files\VS\VC\Auxiliary\Build\version.txt"
   ```

2. **Or create installation ID file:**
   ```cmd
   echo {Visual Studio 2026} > "D:\Program Files\VS\Common7\IDE\installid.txt"
   ```

## Verify Installation

After patching, verify:
```cmd
npm rebuild node-pty
node -e "const pty = require('node-pty'); console.log('Success!');"
```

## Restore Original

If something goes wrong, restore the backup:
```cmd
copy "%APPDATA%\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js.backup" "%APPDATA%\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js"
```

## Why This Works

VS 2026 uses the same compiler toolchain as VS 2022 (MSVC 14.44), so it's fully compatible. We just need to tell node-gyp to accept it.

## Notes

- This patch will be lost if you update npm/node-gyp
- You may need to reapply after npm updates
- Consider keeping a copy of the patched file for easy reapplication

