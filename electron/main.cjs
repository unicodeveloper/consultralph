const { app, BrowserWindow, dialog, shell, ipcMain } = require("electron");
const fs = require("fs");
const http = require("http");
const https = require("https");
const net = require("net");
const path = require("path");
const { fork } = require("child_process");

let mainWindow = null;
let serverProcess = null;
let serverUrl = process.env.ELECTRON_RENDERER_URL || null;

const LOCAL_HOST = "127.0.0.1";
const IS_DEV = Boolean(process.env.ELECTRON_RENDERER_URL);
const MAX_LOAD_RETRIES = 20;
const LOAD_RETRY_DELAY_MS = 500;

function getRootDir() {
  return path.resolve(__dirname, "..");
}

function resolveEnvFilePath(rootDir) {
  if (process.env.CONSULTR_ENV_FILE) {
    return process.env.CONSULTR_ENV_FILE;
  }

  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(rootDir, ".env"),
    path.join(path.dirname(process.execPath), ".env"),
    path.join(app.getPath("userData"), ".env"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function loadEnvFile(rootDir) {
  const envPath = resolveEnvFilePath(rootDir);
  if (!envPath) {
    return null;
  }

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  return envPath;
}

function hasApiKey() {
  return Boolean(process.env.VALYU_API_KEY);
}

function validateValyuApiKey(apiKey) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const req = https.get(
      "https://api.valyu.ai/v1/datasources/categories",
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      },
      (res) => {
        // Consume response data to free up memory
        res.resume();
        if (res.statusCode === 200) {
          settle({ valid: true });
        } else if (res.statusCode === 401 || res.statusCode === 403) {
          settle({ valid: false, error: "Invalid or revoked API key." });
        } else {
          settle({
            valid: false,
            error: `Unexpected response from Valyu API (HTTP ${res.statusCode}).`,
          });
        }
      }
    );

    req.on("error", (err) => {
      settle({
        valid: false,
        error: `Could not reach Valyu API. Check your internet connection.\n(${err.message})`,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      settle({
        valid: false,
        error: "Request timed out. Check your internet connection and try again.",
      });
    });
  });
}

function saveApiKeyToEnvFile(apiKey) {
  const envPath = path.join(app.getPath("userData"), ".env");
  let lines = [];

  if (fs.existsSync(envPath)) {
    lines = fs.readFileSync(envPath, "utf-8").split("\n");
  }

  let replaced = false;
  lines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#") && trimmed.startsWith("VALYU_API_KEY=")) {
      replaced = true;
      return `VALYU_API_KEY="${apiKey}"`;
    }
    return line;
  });

  if (!replaced) {
    lines.push(`VALYU_API_KEY="${apiKey}"`);
  }

  fs.writeFileSync(envPath, lines.join("\n"), "utf-8");
  process.env.VALYU_API_KEY = apiKey;
}

function showSetupWindow() {
  return new Promise((resolve) => {
    let resolved = false;

    const setupWindow = new BrowserWindow({
      width: 480,
      height: 540,
      resizable: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "setup-preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const handleValidateAndSave = async (_event, apiKey) => {
      const result = await validateValyuApiKey(apiKey);
      if (result.valid) {
        saveApiKeyToEnvFile(apiKey);
        // Resolve immediately so closing during delay still counts as success
        resolved = true;
        resolve(true);
        // Short delay so user sees the success message before window closes
        setTimeout(() => {
          if (!setupWindow.isDestroyed()) {
            setupWindow.close();
          }
        }, 1200);
      }
      return result;
    };

    const handleOpenExternal = (_event, url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === "https:" && parsed.origin === "https://platform.valyu.ai") {
          shell.openExternal(url);
        }
      } catch {
        // invalid URL, ignore
      }
    };

    ipcMain.handle("setup:validate-and-save-key", handleValidateAndSave);
    ipcMain.on("setup:open-external", handleOpenExternal);

    setupWindow.on("closed", () => {
      ipcMain.removeHandler("setup:validate-and-save-key");
      ipcMain.removeListener("setup:open-external", handleOpenExternal);
      if (!resolved) {
        resolve(false);
      }
    });

    setupWindow.loadFile(path.join(__dirname, "setup.html"));
  });
}

function getStandaloneServerPath(rootDir) {
  const candidates = [
    path.join(rootDir, ".next", "standalone", "server.js"),
    path.join(process.resourcesPath, "standalone", "server.js"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, LOCAL_HOST, () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Failed to allocate a local port"));
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function isServerReachable(url) {
  return new Promise((resolve) => {
    const request = http.get(url, () => {
      resolve(true);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(url, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await isServerReachable(url)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for Next.js server at ${url}`);
}

async function startNextStandaloneServer(rootDir) {
  const serverPath = getStandaloneServerPath(rootDir);
  if (!serverPath) {
    throw new Error(
      "Desktop build is missing .next/standalone/server.js. Run `npm run desktop:build:web` and `npm run desktop:prepare` first."
    );
  }

  const standaloneRoot = path.dirname(serverPath);
  const staticDir = path.join(standaloneRoot, ".next", "static");
  if (!fs.existsSync(staticDir)) {
    throw new Error(
      "Desktop build is missing .next/standalone/.next/static. Run `npm run desktop:prepare` after `npm run desktop:build:web`."
    );
  }

  if (!process.env.VALYU_API_KEY) {
    throw new Error(
      "VALYU_API_KEY is required for desktop self-hosted mode. Add it to your .env file."
    );
  }

  const port = await getFreePort();
  serverUrl = `http://${LOCAL_HOST}:${port}`;

  const env = {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: LOCAL_HOST,
    PORT: String(port),
    NEXT_PUBLIC_APP_MODE: "self-hosted",
  };

  serverProcess = fork(serverPath, {
    cwd: path.dirname(serverPath),
    env,
    stdio: "pipe",
  });

  serverProcess.stdout?.on("data", (data) => {
    process.stdout.write(`[next] ${data}`);
  });

  serverProcess.stderr?.on("data", (data) => {
    process.stderr.write(`[next] ${data}`);
  });

  serverProcess.on("exit", (code, signal) => {
    if (app.isQuitting) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    dialog.showErrorBox("Next.js server stopped", `The desktop server exited with ${reason}.`);
    app.quit();
  });

  await waitForServer(serverUrl);
}

function stopNextServer() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
}

function createWindow(url) {
  let remainingLoadRetries = MAX_LOAD_RETRIES;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (!targetUrl.startsWith(serverUrl || "")) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || !mainWindow || mainWindow.isDestroyed()) {
        return;
      }

      // Ignore aborted navigations (e.g. redirects/reloads).
      if (errorCode === -3) {
        return;
      }

      if (remainingLoadRetries > 0) {
        remainingLoadRetries -= 1;
        setTimeout(() => {
          if (!mainWindow || mainWindow.isDestroyed()) {
            return;
          }
          mainWindow.loadURL(url).catch(() => {});
        }, LOAD_RETRY_DELAY_MS);
        return;
      }

      dialog.showErrorBox(
        "Failed to load desktop app",
        `Could not load ${validatedURL || url}.\n\nChromium error ${errorCode}: ${errorDescription}`
      );
    }
  );

  mainWindow.loadURL(url).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("Failed to load desktop app", message);
  });

  if (IS_DEV) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function bootstrap() {
  try {
    const rootDir = getRootDir();
    loadEnvFile(rootDir);

    process.env.NEXT_PUBLIC_APP_MODE = "self-hosted";

    if (!IS_DEV && !hasApiKey()) {
      const keyProvided = await showSetupWindow();
      if (!keyProvided) {
        app.quit();
        return;
      }
    }

    if (!IS_DEV) {
      await startNextStandaloneServer(rootDir);
    } else {
      await waitForServer(serverUrl);
    }

    createWindow(serverUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    dialog.showErrorBox("ConsultR Desktop failed to start", message);
    app.quit();
  }
}

app.whenReady().then(bootstrap);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverUrl) {
    createWindow(serverUrl);
  }
});

app.on("before-quit", () => {
  app.isQuitting = true;
  stopNextServer();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
