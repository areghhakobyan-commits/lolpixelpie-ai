const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("node:path");

const APP_URL = path.join(__dirname, "index.html");

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
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webviewTag: false
    }
  });

  // Links opened with target="_blank" go to the user's normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });

  // Keep the app window on its local interface.
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
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
