# Terminal App

A Windows terminal emulator application with tabbed interface, similar to MobaXTerm. Built with Electron, TypeScript, and xterm.js.

## Features

- Multiple terminal tabs
- Windows PowerShell/CMD support
- Modern tabbed interface
- Terminal resizing
- Clean, dark theme

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Windows 10/11 (primary target)
- **Visual Studio Build Tools** with "Desktop development with C++" workload (required for `node-pty`)

### Installing Visual Studio Build Tools

`node-pty` requires native compilation. You need Visual Studio Build Tools:

1. Download from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022
2. Run the installer
3. Select **"Desktop development with C++"** workload
4. Click Install
5. **Restart your terminal** after installation

**Note**: If your Visual Studio is installed at a custom path (like `D:\Program Files\VS`), see [CUSTOM_VS_PATH_FIX.md](CUSTOM_VS_PATH_FIX.md) for special instructions.

## Installation

### Standard Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the application:
```bash
npm start
```

### Custom Visual Studio Path

If you have Visual Studio at a non-standard location (e.g., `D:\Program Files\VS`):

1. **Install dependencies without building native modules:**
   ```bash
   npm run install:no-build
   ```

2. **Rebuild node-pty using Developer Command Prompt:**
   - Open **Command Prompt** (not PowerShell)
   - Run: `rebuild-node-pty.bat`
   - Or use Developer Command Prompt and run: `npm run rebuild:pty`

3. **Build and start:**
   ```bash
   npm run build
   npm start
   ```

See [QUICK_START.md](QUICK_START.md) for detailed instructions.

## Development

For development with auto-rebuild:
```bash
npm run dev
```

## Building for Distribution

To create a Windows installer:
```bash
npm run package:win
```

The installer will be created in the `dist` folder.

## Project Structure

```
Terminal/
├── src/
│   ├── main/           # Electron main process
│   │   ├── main.ts     # Main process entry point
│   │   └── terminal.ts # Terminal session management
│   ├── renderer/       # Renderer process (UI)
│   │   ├── index.html  # Main window HTML
│   │   ├── renderer.ts # Renderer logic and tab management
│   │   └── styles.css  # UI styling
│   └── preload/        # Preload scripts
│       └── preload.ts  # Secure IPC bridge
└── dist/               # Compiled output
```

## Usage

- Click the **+** button to create a new terminal tab
- Click on a tab to switch between terminals
- Click the **×** button on a tab to close it
- The terminal automatically resizes when the window is resized

## Troubleshooting

### node-pty Build Issues

If `npm install` fails with Visual Studio errors:

1. **Use the rebuild script:**
   ```cmd
   rebuild-node-pty.bat
   ```
   (Run from Command Prompt, not PowerShell)

2. **Or use Developer Command Prompt:**
   - Open Developer Command Prompt for VS
   - Run: `npm rebuild node-pty`

3. **Verify installation:**
   ```bash
   node -e "const pty = require('node-pty'); console.log('Success!');"
   ```

### Electron Installation Issues

If Electron fails to install:
```bash
npm install electron --save-dev
```

## Technologies

- **Electron**: Desktop application framework
- **TypeScript**: Type-safe JavaScript
- **xterm.js**: Terminal emulator for the browser
- **node-pty**: Native terminal process handling

## License

MIT
