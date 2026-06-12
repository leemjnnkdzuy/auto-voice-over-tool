import { ipcMain, WebContents } from "electron";
import {
    setupEnvironment,
    isEnvironmentReady,
    isWhisperEngineReady,
    listWhisperModels,
    downloadWhisperModel,
    deleteWhisperModel,
    getActiveModelId,
    setActiveModelId,
    getWhisperDownloadStatus,
    setWhisperDownloadStatus,
} from "../services/EnvironmentService";

const safeSend = (sender: WebContents, channel: string, ...args: any[]) => {
    try {
        if (!sender.isDestroyed()) {
            sender.send(channel, ...args);
        }
    } catch {
        // Frame was disposed, ignore
    }
};

export const setupEnvironmentIpc = () => {
    ipcMain.handle("get-whisper-download-status", () => {
        return getWhisperDownloadStatus();
    });

    ipcMain.handle("check-environment", () => {
        return isEnvironmentReady();
    });

    ipcMain.on("setup-environment", (event) => {
        setupEnvironment((progress) => {
            safeSend(event.sender, "setup-progress", progress);
        }).then((success) => {
            if (!success) {
                safeSend(event.sender, "setup-progress", {
                    status: "error",
                    progress: 0,
                    detail: "Cài đặt môi trường thất bại!",
                });
            }
        });
    });

    ipcMain.handle("check-whisper-engine", (_event, engine: string) => {
        return isWhisperEngineReady(engine as "cpu" | "gpu");
    });

    ipcMain.handle("list-whisper-models", () => {
        return listWhisperModels();
    });

    ipcMain.handle("download-whisper-model", (_event, modelId: string) => {
        setWhisperDownloadStatus(modelId, 0);

        downloadWhisperModel(modelId, (percent) => {
            setWhisperDownloadStatus(modelId, percent);
        }).then(() => {
            setWhisperDownloadStatus(null, 0);
        }).catch(() => {
            setWhisperDownloadStatus(null, 0);
        });

        return true;
    });

    ipcMain.handle("delete-whisper-model", (_event, modelId: string) => {
        return deleteWhisperModel(modelId);
    });

    ipcMain.handle("get-active-whisper-model", () => {
        return getActiveModelId();
    });

    ipcMain.handle("set-active-whisper-model", (_event, modelId: string) => {
        return setActiveModelId(modelId);
    });
};
