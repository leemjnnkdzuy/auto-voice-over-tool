import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import started from "electron-squirrel-startup";
import { connectDB } from "./services/DatabaseService";
import { startVideoServer } from "./services/VideoServerService";
import { setupIpcHandlers } from "./ipc";

if (started) {
	app.quit();
}

const createWindow = () => {
	connectDB();

	const mainWindow = new BrowserWindow({
		minHeight: 720,
		minWidth: 1280,
		autoHideMenuBar: true,
		icon: path.join(__dirname, "../../src/assets/logo.png"),
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
		},
	});

	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
	} else {
		mainWindow.loadFile(
			path.join(
				__dirname,
				`../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
			),
		);
	}
};

let settingsWindow: BrowserWindow | null = null;

ipcMain.handle("open-settings-window", () => {
	if (settingsWindow && !settingsWindow.isDestroyed()) {
		settingsWindow.focus();
		return;
	}

	settingsWindow = new BrowserWindow({
		minHeight: 720,
		minWidth: 1280,
		autoHideMenuBar: true,
		icon: path.join(__dirname, "../../src/assets/logo.png"),
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
		},
	});

	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		settingsWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/settings/whisper-model`);
	} else {
		settingsWindow.loadFile(
			path.join(
				__dirname,
				`../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
			),
			{ hash: "/settings/whisper-model" },
		);
	}

	settingsWindow.on("closed", () => {
		settingsWindow = null;
	});
});

app.whenReady().then(async () => {
	await startVideoServer();
	setupIpcHandlers();
	createWindow();
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});
