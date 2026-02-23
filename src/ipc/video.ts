import {ipcMain, dialog} from "electron";
import {getVideoInfo, downloadVideo} from "../services/VideoService";
import {createFinalVideo} from "../services/FinalVideoService";
import {getFfmpegPath} from "../services/EnvironmentService";
import {spawn} from "child_process";
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

	ipcMain.handle("select-video-file", async () => {
		const result = await dialog.showOpenDialog({
			properties: ["openFile"],
			filters: [
				{
					name: "Video",
					extensions: [
						"mp4",
						"mkv",
						"webm",
						"avi",
						"mov",
						"flv",
						"wmv",
					],
				},
			],
		});
		return result.canceled ? null : result.filePaths[0];
	});

	ipcMain.on(
		"import-local-video",
		(event, filePath: string, projectPath: string) => {
			const videoDir = path.join(projectPath, "original", "video");
			const audioDir = path.join(projectPath, "original", "audio");

			if (!fs.existsSync(videoDir))
				fs.mkdirSync(videoDir, {recursive: true});
			if (!fs.existsSync(audioDir))
				fs.mkdirSync(audioDir, {recursive: true});

			const ext = path.extname(filePath);
			const baseName = path.basename(filePath, ext);
			const destVideo = path.join(videoDir, `${baseName}${ext}`);
			const destAudio = path.join(audioDir, `${baseName}.mp3`);

			event.sender.send("import-local-progress", {
				step: "copying",
				progress: 0,
				detail: "Đang copy video...",
			});

			try {
				fs.copyFileSync(filePath, destVideo);
			} catch (err) {
				console.error("Copy video failed:", err);
				event.sender.send("import-local-complete", false);
				return;
			}

			event.sender.send("import-local-progress", {
				step: "copying",
				progress: 50,
				detail: "Copy video xong. Đang tách audio...",
			});

			const ffmpegPath = getFfmpegPath();

			const proc = spawn(ffmpegPath, [
				"-i",
				destVideo,
				"-vn",
				"-acodec",
				"libmp3lame",
				"-ab",
				"192k",
				"-ar",
				"44100",
				"-y",
				destAudio,
			]);

			proc.stderr.on("data", (data: Buffer) => {
				const text = data.toString();
				const durationMatch = text.match(
					/Duration:\s*(\d+):(\d+):(\d+)/,
				);
				const timeMatch = text.match(/time=(\d+):(\d+):(\d+)/);
				if (durationMatch && timeMatch) {
					const totalSec =
						parseInt(durationMatch[1]) * 3600 +
						parseInt(durationMatch[2]) * 60 +
						parseInt(durationMatch[3]);
					const currentSec =
						parseInt(timeMatch[1]) * 3600 +
						parseInt(timeMatch[2]) * 60 +
						parseInt(timeMatch[3]);
					if (totalSec > 0) {
						const pct = Math.min(
							100,
							Math.round((currentSec / totalSec) * 100),
						);
						event.sender.send("import-local-progress", {
							step: "extracting",
							progress: 50 + pct * 0.5,
							detail: `Đang tách audio... ${pct}%`,
						});
					}
				}
			});

			proc.on("close", (code: number) => {
				if (code === 0) {
					event.sender.send("import-local-progress", {
						step: "done",
						progress: 100,
						detail: "Hoàn tất!",
					});
					event.sender.send("import-local-complete", true);
				} else {
					console.error("FFmpeg extract audio failed, code:", code);
					event.sender.send("import-local-complete", false);
				}
			});

			proc.on("error", (err: Error) => {
				console.error("FFmpeg spawn error:", err);
				event.sender.send("import-local-complete", false);
			});
		},
	);

	ipcMain.handle("check-final-video-ready", (_event, projectPath: string) => {
		const videoDir = path.join(projectPath, "original", "video");
		const srtDir = path.join(projectPath, "transcript");
		const audioDir = path.join(projectPath, "audio_gene");
		const finalPath = path.join(projectPath, "final", "final_video.mp4");

		if (
			!fs.existsSync(videoDir) ||
			fs
				.readdirSync(videoDir)
				.filter((f) => /\.(mp4|mkv|webm|avi|mov)$/i.test(f)).length ===
				0
		) {
			return {
				ready: false,
				missing: "Chưa tải video gốc. Hãy tải video ở bước 1.",
			};
		}
		if (
			!fs.existsSync(srtDir) ||
			fs.readdirSync(srtDir).filter((f) => f.endsWith(".srt")).length ===
				0
		) {
			return {
				ready: false,
				missing: "Chưa có phụ đề gốc. Hãy tạo phụ đề ở bước 2.",
			};
		}
		if (
			!fs.existsSync(audioDir) ||
			fs.readdirSync(audioDir).filter((f) => f.endsWith(".mp3"))
				.length === 0
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
