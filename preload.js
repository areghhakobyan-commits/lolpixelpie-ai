const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pixelpieLocal", {
  listOllamaModels: (baseUrl) => ipcRenderer.invoke("local:ollama-models", baseUrl),
  chatWithOllama: (args) => ipcRenderer.invoke("local:ollama-chat", args),
  checkComfyUI: (baseUrl) => ipcRenderer.invoke("local:comfy-status", baseUrl),
  generateImage: (args) => ipcRenderer.invoke("local:comfy-generate", args)
});
