import { ipcMain } from "electron";
import { getVideoInfo, downloadVideo } from "../services/VideoService";
import { createFinalVideo } from "../services/FinalVideoService";
import fs from "fs";
import path from "path";

export const setupVideoIpc = () => {
    ipcMain.handle("get-video-info", (_event, url) => {
        return getVideoInfo(url);
    });

    ipcMain.on("download-video", (event, url, projectPath) => {
        downloadVideo(url, projectPath, (progress) => {
            event.sender.send("download-progress", progress);
        }).then((success) => {
            event.sender.send("download-complete", success);
        });
    });

    ipcMain.handle("check-final-video-ready", (_event, projectPath: string) => {
        const videoDir = path.join(projectPath, "original", "video");
        const srtDir = path.join(projectPath, "transcript");
        const audioDir = path.join(projectPath, "audio_gene");
        const finalPath = path.join(projectPath, "final", "final_video.mp4");

        if (
            !fs.existsSync(videoDir) ||
            fs
                .readdirSync(videoDir)
                .filter((f) => /\.(mp4|mkv|webm|avi|mov)$/i.test(f)).length === 0
        ) {
            return {
                ready: false,
                missing: "Chưa tải video gốc. Hãy tải video ở bước 1.",
            };
        }
        if (
            !fs.existsSync(srtDir) ||
            fs.readdirSync(srtDir).filter((f) => f.endsWith(".srt")).length === 0
        ) {
            return {
                ready: false,
                missing: "Chưa có phụ đề gốc. Hãy tạo phụ đề ở bước 2.",
            };
        }
        if (
            !fs.existsSync(audioDir) ||
            fs.readdirSync(audioDir).filter((f) => f.endsWith(".mp3")).length === 0
        ) {
            return {
                ready: false,
                missing: "Chưa tạo audio. Hãy tạo audio ở bước 4.",
            };
        }

        return {
            ready: true,
            existingFinal: fs.existsSync(finalPath) ? finalPath : null,
        };
    });

    ipcMain.on("create-final-video", async (event, projectPath: string) => {
        try {
            await createFinalVideo(projectPath, (p) => {
                event.sender.send("final-video-progress", p);
            });
        } catch (err) {
            console.error("Create final video failed:", err);
            event.sender.send("final-video-progress", {
                status: "error",
                progress: 0,
                detail: `Lỗi: ${err}`,
            });
        }
    });
};
