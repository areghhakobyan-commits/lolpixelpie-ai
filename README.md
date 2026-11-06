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


## Local AI providers

PixelPie AI can use local Ollama for chat and a local ComfyUI server for image generation. Both services run separately from the Electron app; PixelPie connects to their loopback APIs.

### Ollama chat

1. Install and start [Ollama](https://ollama.com/).
2. Download a chat model, for example:

   ```bash
   ollama pull llama3.2
   ```

3. Open PixelPie AI → Settings.
4. Select **Ollama (local)**, keep the address as `http://127.0.0.1:11434`, and enter the exact model name shown by `ollama list`.
5. Use **Refresh** to check the local model list.

### ComfyUI image generation

1. Install and start [ComfyUI](https://github.com/Comfy-Org/ComfyUI) separately.
2. In ComfyUI, prepare a working text-to-image workflow and export it using **Save (API Format)**.
3. In PixelPie AI → Settings, keep the ComfyUI address as `http://127.0.0.1:8188` and import the exported JSON workflow.
4. If automatic prompt-node detection selects the wrong text encoder, enter the positive prompt node ID in Settings.
5. Switch to **Image**, enter a prompt, and generate.

The ComfyUI workflow must already work in ComfyUI itself and must include a text input node with a `text` input. PixelPie currently changes that positive prompt input and displays the first generated image.

### Intel Mac note

ComfyUI's current official macOS desktop support focuses on Apple Silicon. CPU execution exists in ComfyUI, but an Intel Mac may require a manual setup and image generation can be very slow. PixelPie does not install or bundle ComfyUI or image models. Check ComfyUI's current [system requirements](https://github.com/sd-comfyui/docs.comfy.org/blob/main/installation/system_requirements.mdx) before downloading large models.

### Local-service privacy

The Ollama and ComfyUI integrations accept loopback addresses only (`localhost`, `127.0.0.1`, or `::1`). Prompts and workflows are sent to services on the same computer, not to an image-generation cloud API. OpenRouter remains an optional cloud chat provider.
