const { app, BrowserWindow, shell, Menu, ipcMain } = require("electron");
const path = require("node:path");
const crypto = require("node:crypto");

const APP_URL = path.join(__dirname, "index.html");

function localServiceUrl(value, fallback) {
  const parsed = new URL(value || fallback);
  const allowed = ["localhost", "127.0.0.1", "[::1]"];
  if (!allowed.includes(parsed.hostname)) {
    throw new Error("For privacy, PixelPie only connects to local Ollama and ComfyUI servers.");
  }
  return parsed.origin;
}

async function readJson(response, serviceName) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(serviceName + " returned an invalid response.");
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || (serviceName + " returned HTTP " + response.status));
  }
  return data;
}

ipcMain.handle("local:ollama-models", async (_event, baseUrl) => {
  const base = localServiceUrl(baseUrl, "http://127.0.0.1:11434");
  const response = await fetch(base + "/api/tags");
  const data = await readJson(response, "Ollama");
  return (data.models || []).map((model) => model.name);
});

ipcMain.handle("local:ollama-chat", async (_event, args) => {
  const base = localServiceUrl(args?.baseUrl, "http://127.0.0.1:11434");
  const model = String(args?.model || "").trim();
  if (!model) throw new Error("Enter an Ollama model name in Settings.");
  const messages = Array.isArray(args?.messages) ? args.messages : [];
  const response = await fetch(base + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: messages.map((item) => ({
        role: item.role,
        content: String(item.content || "")
      })),
      stream: false
    })
  });
  const data = await readJson(response, "Ollama");
  const answer = data?.message?.content;
  if (!answer) throw new Error("Ollama returned an empty response.");
  return answer;
});

ipcMain.handle("local:comfy-status", async (_event, baseUrl) => {
  const base = localServiceUrl(baseUrl, "http://127.0.0.1:8188");
  const response = await fetch(base + "/system_stats");
  const data = await readJson(response, "ComfyUI");
  return {
    ok: true,
    devices: (data.devices || []).map((device) => device.name || device.type || "Device")
  };
});

ipcMain.handle("local:comfy-generate", async (_event, args) => {
  const base = localServiceUrl(args?.baseUrl, "http://127.0.0.1:8188");
  const text = String(args?.text || "").trim();
  if (!text) throw new Error("Describe the image you want to create.");
  if (!args?.workflow || typeof args.workflow !== "object" || Array.isArray(args.workflow)) {
    throw new Error("Import a ComfyUI API workflow in Settings first.");
  }

  const workflow = JSON.parse(JSON.stringify(args.workflow));
  let nodeId = String(args.promptNodeId || "").trim();
  let promptNode = nodeId ? workflow[nodeId] : null;

  if (!nodeId) {
    const candidate = Object.entries(workflow).find(([, node]) =>
      node && typeof node === "object" &&
      String(node.class_type || "").includes("CLIPTextEncode") &&
      node.inputs && typeof node.inputs.text === "string"
    );
    if (candidate) {
      nodeId = candidate[0];
      promptNode = candidate[1];
    }
  }

  if (!promptNode || !promptNode.inputs || !Object.prototype.hasOwnProperty.call(promptNode.inputs, "text")) {
    throw new Error("Couldn't find the positive text-prompt node. Set its node ID in Settings (usually a CLIPTextEncode node with a text input).");
  }
  promptNode.inputs.text = text;

  const queued = await readJson(await fetch(base + "/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: crypto.randomUUID() })
  }), "ComfyUI");

  const promptId = queued.prompt_id;
  if (!promptId) {
    const details = queued.node_errors ? JSON.stringify(queued.node_errors) : "ComfyUI did not return a prompt ID.";
    throw new Error(details);
  }

  for (let attempt = 0; attempt < 600; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const historyResponse = await fetch(base + "/history/" + encodeURIComponent(promptId));
    const history = await readJson(historyResponse, "ComfyUI");
    const job = history[promptId];
    if (!job) continue;

    const statusText = job.status?.status_str;
    if (statusText === "error") {
      throw new Error("ComfyUI could not complete this workflow. Check the ComfyUI terminal for details.");
    }

    const images = Object.values(job.outputs || {}).flatMap((output) => output.images || []);
    if (images.length) {
      const imageInfo = images[0];
      const viewUrl = new URL(base + "/view");
      viewUrl.searchParams.set("filename", imageInfo.filename);
      viewUrl.searchParams.set("subfolder", imageInfo.subfolder || "");
      viewUrl.searchParams.set("type", imageInfo.type || "output");
      const imageResponse = await fetch(viewUrl);
      if (!imageResponse.ok) throw new Error("ComfyUI generated an image but PixelPie couldn't retrieve it.");
      const bytes = Buffer.from(await imageResponse.arrayBuffer());
      const mime = imageResponse.headers.get("content-type") || "image/png";
      return "data:" + mime + ";base64," + bytes.toString("base64");
    }
  }

  throw new Error("Image generation is taking longer than expected. Check ComfyUI; the job may still be running.");
});


/* Draw Things local HTTP API */
ipcMain.handle("local:drawthings-status", async (_event, baseUrl) => {
  const base = localServiceUrl(baseUrl, "http://127.0.0.1:7860");
  const data = await readJson(await fetch(base + "/", { signal: AbortSignal.timeout(15000) }), "Draw Things");
  return {
    ok: true,
    model: data.model || "Loaded model",
    width: data.width || 512,
    height: data.height || 512,
    steps: data.steps || 16
  };
});

ipcMain.handle("local:drawthings-generate", async (_event, args) => {
  const base = localServiceUrl(args?.baseUrl, "http://127.0.0.1:7860");
  const prompt = String(args?.prompt || "").trim();
  if (!prompt) throw new Error("Describe the image you want to create.");
  const width = Math.max(256, Math.min(768, Number(args?.width) || 512));
  const height = Math.max(256, Math.min(768, Number(args?.height) || 512));
  const steps = Math.max(1, Math.min(30, Number(args?.steps) || 16));
  const data = await readJson(await fetch(base + "/sdapi/v1/txt2img", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(600000),
    body: JSON.stringify({
      prompt,
      negative_prompt: String(args?.negativePrompt || ""),
      width,
      height,
      steps,
      seed: -1,
      batch_size: 1,
      n_iter: 1
    })
  }), "Draw Things");
  const encoded = data?.images?.[0];
  if (typeof encoded !== "string" || !encoded) {
    throw new Error("Draw Things returned no image. Check that its HTTP API is enabled and a model is loaded.");
  }
  const base64 = encoded.replace(/^data:image\\/[^;]+;base64,/, "");
  return "data:image/png;base64," + base64;
});

function openExternal(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      shell.openExternal(parsed.href).catch((error) => {
        console.error("Could not open external link:", error);
      });
    }
  } catch {
    console.warn("Blocked invalid external URL:", url);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 600,
    show: false,
    autoHideMenuBar: process.platform !== "darwin",
    backgroundColor: "#08090d",
    title: "PixelPie AI",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (url !== win.webContents.getURL() && !url.startsWith("file://")) {
      event.preventDefault();
      openExternal(url);
    }
  });

  win.once("ready-to-show", () => win.show());
  win.loadFile(APP_URL);

  if (!app.isPackaged) {
    win.webContents.on("before-input-event", (event, input) => {
      if (
        input.type === "keyDown" &&
        input.key.toLowerCase() === "i" &&
        input.control &&
        input.shift
      ) {
        win.webContents.toggleDevTools();
        event.preventDefault();
      }
    });
  }

  return win;
}

function buildMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [{
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" }
          ]
        }]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "New Chat",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            const win = BrowserWindow.getFocusedWindow();
            if (win) {
              win.webContents.executeJavaScript(
                "if (typeof newChat === 'function') newChat();"
              );
            }
          }
        },
        { type: "separator" },
        { role: "close" },
        ...(process.platform === "darwin" ? [] : [{ role: "quit" }])
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "togglefullscreen" },
        ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }])
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    app.setName("PixelPie AI");
    buildMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
