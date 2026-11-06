# PixelPie AI

PixelPie AI is a desktop application built with Electron. The existing HTML, CSS, and JavaScript interface remains in `index.html`.

## Requirements

- Node.js 20.11 or newer
- npm

## Run locally

```bash
npm install
npm start
```

## Build installers

Build for the current operating system:

```bash
npm run dist
```

Build for a specific platform (use that platform's runner for the most reliable result):

```bash
npm run dist:mac
npm run dist:win
npm run dist:linux
```

Build output is written to the `dist/` directory.

- macOS: DMG and ZIP
- Windows: NSIS EXE installer
- Linux: AppImage and DEB

Cross-platform packaging is most reliable when each target is built on its own operating system. The GitHub Actions workflow builds all three platforms on their native runners.

## Settings and chat history

The app stores its OpenRouter API key, selected model, and chat history in Electron's persistent local Chromium storage for the current OS user. These values are not included in the application package.

## Security

- Node integration is disabled in the renderer.
- Context isolation and Chromium sandboxing are enabled.
- External HTTP and HTTPS links open in the system browser.
- The app does not load remote web pages in its main window.

## API key

Open **Settings** in PixelPie AI and enter your own OpenRouter API key. Do not commit API keys to this repository.
