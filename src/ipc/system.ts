import { ipcMain, shell } from "electron";
import fs from "fs";
import path from "path";
import { getApiKey, setApiKey } from "../services/ConfigService";

export const setupSystemIpc = () => {
    ipcMain.handle("get-api-key", (_event, provider: string) => {
        return getApiKey(provider);
    });

    ipcMain.handle("set-api-key", (_event, provider: string, key: string) => {
        return setApiKey(provider, key);
    });

    ipcMain.handle("open-in-explorer", (_event, filePath: string) => {
        try {
            shell.showItemInFolder(filePath);
            return true;
        } catch {
            return false;
        }
    });

    ipcMain.handle("open-file", async (_event, filePath: string) => {
        try {
            await shell.openPath(filePath);
            return true;
        } catch {
            return false;
        }
    });

    ipcMain.handle("read-video-file", (_event, filePath: string) => {
        try {
            if (!fs.existsSync(filePath)) return null;
            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mime =
                ext === ".mp4" ? "video/mp4"
                    : ext === ".mkv" ? "video/x-matroska"
                        : ext === ".webm" ? "video/webm"
                            : "video/mp4";
            const base64 = buffer.toString("base64");
            return `data:${mime};base64,${base64}`;
        } catch {
            return null;
        }
    });

    ipcMain.handle("check-project-phases", (_event, projectPath: string) => {
        const empty = { download: false, transcript: false, translate: false, audio: false, final: false };
        try {
            if (!projectPath || !fs.existsSync(projectPath)) return empty;

            const configFile = path.join(projectPath, "project.json");
            if (!fs.existsSync(configFile)) return empty;

            const meta = JSON.parse(fs.readFileSync(configFile, "utf-8"));
            const completed: string[] = meta.completedPhases || [];

            return {
                download: completed.includes("download"),
                transcript: completed.includes("transcript"),
                translate: completed.includes("translate"),
                audio: completed.includes("audio"),
                final: completed.includes("final"),
            };
        } catch {
            return empty;
        }
    });
};
