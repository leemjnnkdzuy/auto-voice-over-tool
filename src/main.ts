import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import path from "path";
import { optimizeSrtFile } from "./lib/SrtOptimizer";
import fs from "fs";
import * as http from "http";
import * as url from "url";
import started from "electron-squirrel-startup";
import {
	connectDB,
	getProjects,
	addProject,
	deleteProject,
	updateProjectPin,
} from "./services/DatabaseService";
import {
	getPinnedPath,
	setPinnedPath,
	createProjectFolder,
	deleteProjectFolder,
	getProjectMetadata,
	saveProjectMetadata,
	getApiKey,
	setApiKey,
	clearProjectData,
} from "./services/ConfigService";
import { getVideoInfo, downloadVideo, importLocalVideo } from "./services/VideoService";
import {
	setupEnvironment,
	isEnvironmentReady,
	isWhisperEngineReady,
	isWhisperTurboModelReady
} from "./services/EnvironmentService";
import { transcribeAudio, getExistingSrt } from "./services/TranscriptService";
import { generateAllAudio, generateAudioSegment, VOICE_MAP, getEdgeVoices, previewEdgeVoice } from "./services/PiperService";
import { createFinalVideo } from "./services/FinalVideoService";
import { parseSrt as parseSrtMain } from "./lib/srt-utils";

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

// Start local HTTP server for video streaming
const startVideoServer = () => {
	return new Promise<void>((resolve) => {
		const server = http.createServer((req, res) => {
			if (!req.url) {
				res.writeHead(404);
				res.end();
				return;
			}

			// URL: http://localhost:9999/video?path=C%3A%5CUsers%5C...
			const parsedUrl = url.parse(req.url, true);
			if (parsedUrl.pathname === "/video") {
				const filePath = parsedUrl.query.path as string;

				if (!filePath) {
					res.writeHead(400);
					res.end("Missing path parameter");
					return;
				}

				if (!fs.existsSync(filePath)) {
					console.error(`Video file not found: ${filePath}`);
					res.writeHead(404);
					res.end("File not found");
					return;
				}

				try {
					const stat = fs.statSync(filePath);
					const fileSize = stat.size;
					const rangeHeader = req.headers.range;

					if (rangeHeader) {
						// Parse range header: "bytes=start-end"
						const parts = rangeHeader
							.replace(/bytes=/, "")
							.split("-");
						const start = parseInt(parts[0], 10);
						const end =
							parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

						if (
							start >= fileSize ||
							end >= fileSize ||
							start > end
						) {
							res.writeHead(416, {
								"Content-Range": `bytes */${fileSize}`,
							});
							res.end();
							return;
						}

						const chunksize = end - start + 1;
						res.writeHead(206, {
							"Content-Range": `bytes ${start}-${end}/${fileSize}`,
							"Accept-Ranges": "bytes",
							"Content-Length": chunksize,
							"Content-Type": "video/mp4",
							"Access-Control-Allow-Origin": "*",
						});

						fs.createReadStream(filePath, { start, end }).pipe(res);
					} else {
						// No range requested, send entire file
						res.writeHead(200, {
							"Content-Length": fileSize,
							"Accept-Ranges": "bytes",
							"Content-Type": "video/mp4",
							"Access-Control-Allow-Origin": "*",
						});
						fs.createReadStream(filePath).pipe(res);
					}
				} catch (err) {
					console.error("Error streaming video:", err);
					res.writeHead(500);
					res.end("Server error");
				}
			} else {
				res.writeHead(404);
				res.end();
			}
		});

		server.listen(9999, "127.0.0.1", () => {
			console.log("Video server started on http://127.0.0.1:9999");
			resolve();
		});
	});
};

ipcMain.handle("get-projects", () => {
	return getProjects();
});

ipcMain.handle("add-project", (event, project) => {
	return addProject(project);
});

ipcMain.handle("delete-project", (event, id) => {
	const projects = getProjects();
	const project = projects.find((p: any) => p.id === id);
	if (project) {
		deleteProjectFolder(project.path);
	}
	return deleteProject(id);
});

ipcMain.handle("update-project-pin", (event, id, pinned) => {
	return updateProjectPin(id, pinned);
});

ipcMain.handle("select-directory", async () => {
	const result = await dialog.showOpenDialog({
		properties: ["openDirectory"],
	});
	return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("get-pinned-path", () => {
	return getPinnedPath();
});

ipcMain.handle("set-pinned-path", (event, path) => {
	return setPinnedPath(path);
});

ipcMain.handle("create-project-folder", (event, basePath, projectName) => {
	return createProjectFolder(basePath, projectName);
});

ipcMain.handle("get-project-metadata", (event, projectPath) => {
	return getProjectMetadata(projectPath);
});

ipcMain.handle("save-project-metadata", (_event, projectPath: string, metadata: any) => {
	return saveProjectMetadata(projectPath, metadata);
});

ipcMain.handle("clear-project-data", (_event, projectPath: string) => {
	return clearProjectData(projectPath);
});

ipcMain.handle("get-video-info", (event, url) => {
	return getVideoInfo(url);
});

// API Key management
ipcMain.handle("get-api-key", (_event, provider: string) => {
	return getApiKey(provider);
});

ipcMain.handle("set-api-key", (event, provider: string, key: string) => {
	return setApiKey(provider, key);
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
			{ name: "Videos", extensions: ["mp4", "mkv", "webm", "avi", "mov"] },
		],
	});
	if (result.canceled) return null;
	return result.filePaths[0];
});

ipcMain.on("import-local-video", (event, sourcePath, projectPath) => {
	importLocalVideo(sourcePath, projectPath, (progress) => {
		event.sender.send("download-progress", progress);
	}).then((videoInfo) => {
		event.sender.send("import-local-complete", videoInfo);
	});
});

// Environment setup
ipcMain.handle("check-environment", () => {
	return isEnvironmentReady();
});

ipcMain.on("setup-environment", (event) => {
	setupEnvironment((progress) => {
		event.sender.send("setup-progress", progress);
	}).then((success) => {
		if (!success) {
			event.sender.send("setup-progress", {
				status: "error",
				progress: 0,
				detail: "Cài đặt môi trường thất bại!",
			});
		}
	});
});

// Transcription
ipcMain.handle("get-existing-srt", (event, projectPath, videoId) => {
	return getExistingSrt(projectPath, videoId);
});

ipcMain.on("transcribe-audio", (event, projectPath, videoId) => {
	transcribeAudio(
		projectPath,
		videoId,
		(progress) => {
			event.sender.send("transcript-progress", progress);
		}
	).then((result) => {
		event.sender.send("transcript-complete", result);
	});
});

ipcMain.handle("check-whisper-engine", (event, engine: string) => {
	return isWhisperEngineReady(engine as "cpu" | "gpu");
});

ipcMain.handle("check-whisper-turbo-model-ready", () => {
	return isWhisperTurboModelReady();
});

ipcMain.handle("optimize-srt", (event, srtPath: string) => {
	try {
		const optimized = optimizeSrtFile(srtPath);
		return { srtContent: optimized };
	} catch (error) {
		console.error("SRT optimization failed:", error);
		return null;
	}
});

ipcMain.handle("save-srt", (event, srtPath: string, content: string) => {
	try {
		fs.writeFileSync(srtPath, content, "utf-8");
		return true;
	} catch (error) {
		console.error("Failed to save SRT:", error);
		return false;
	}
});

ipcMain.handle(
	"save-translated-srt",
	(event, projectPath: string, videoId: string, lang: string, content: string) => {
		try {
			const translateDir = path.join(projectPath, "translate");
			if (!fs.existsSync(translateDir)) {
				fs.mkdirSync(translateDir, { recursive: true });
			}
			const filePath = path.join(translateDir, `${videoId}_${lang}.srt`);
			fs.writeFileSync(filePath, content, "utf-8");
			return filePath;
		} catch (error) {
			console.error("Failed to save translated SRT:", error);
			return null;
		}
	},
);

ipcMain.handle(
	"get-translated-srt",
	(event, projectPath: string, videoId: string, lang: string) => {
		try {
			const srtPath = path.join(projectPath, "translate", `${videoId}_${lang}.srt`);
			if (fs.existsSync(srtPath)) {
				const content = fs.readFileSync(srtPath, "utf-8");
				return content;
			}
		} catch (error) {
			console.error("Failed to get translated SRT:", error);
		}
		return null;
	},
);

// Edge TTS
ipcMain.on(
	"generate-audio",
	async (event, projectPath: string, videoId: string, lang: string, concurrency: number, voiceName?: string) => {
		try {
			// 1. Read translated SRT
			const srtPath = path.join(projectPath, "translate", `${videoId}_${lang}.srt`);
			if (!fs.existsSync(srtPath)) {
				event.sender.send("audio-generate-progress", {
					status: "error",
					progress: 0,
					detail: "Không tìm thấy file SRT đã dịch!",
				});
				return;
			}

			const srtContent = fs.readFileSync(srtPath, "utf-8");
			const entries = parseSrtMain(srtContent);

			if (entries.length === 0) {
				event.sender.send("audio-generate-progress", {
					status: "error",
					progress: 0,
					detail: "File SRT trống!",
				});
				return;
			}

			// 2. Check voice support
			const targetVoice = voiceName || (VOICE_MAP[lang] ? VOICE_MAP[lang].voice : null);
			if (!targetVoice) {
				event.sender.send("audio-generate-progress", {
					status: "error",
					progress: 0,
					detail: `Không hỗ trợ ngôn ngữ/giọng đọc: ${lang}`,
				});
				return;
			}

			// 3. Clean up old audio files before regenerating
			const outputDir = path.join(projectPath, "audio_gene");
			if (fs.existsSync(outputDir)) {
				const oldFiles = fs
					.readdirSync(outputDir)
					.filter((f) => f.endsWith(".mp3") || f.endsWith(".wav"));
				for (const f of oldFiles) {
					try {
						fs.unlinkSync(path.join(outputDir, f));
					} catch {
						/* ignore */
					}
				}
			}

			// 4. Generate audio segments sequentially
			const results = await generateAllAudio(
				entries.map((e) => ({ index: e.index, text: e.text })),
				lang,
				outputDir,
				(p) => {
					event.sender.send("audio-generate-progress", p);
				},
				concurrency,
				voiceName
			);

			const successCount = results.filter((r) => r !== "").length;
			event.sender.send("audio-generate-progress", {
				status: "done",
				progress: 100,
				detail: `Hoàn tất! ${successCount}/${entries.length} audio đã được tạo.`,
				current: successCount,
				total: entries.length,
			});
		} catch (err) {
			console.error("Audio generation failed:", err);
			event.sender.send("audio-generate-progress", {
				status: "error",
				progress: 0,
				detail: `Lỗi: ${err}`,
			});
		}
	},
);

ipcMain.handle(
	"generate-single-audio",
	async (event, projectPath: string, videoId: string, lang: string, targetIndex: number, voiceName?: string) => {
		try {
			const srtPath = path.join(projectPath, "translate", `${videoId}_${lang}.srt`);
			if (!fs.existsSync(srtPath)) {
				event.sender.send("audio-generate-progress", {
					status: "error",
					progress: 0,
					detail: "Không tìm thấy file SRT đã dịch!",
					entryIndex: targetIndex,
					entryStatus: "failed"
				});
				return false;
			}

			const srtContent = fs.readFileSync(srtPath, "utf-8");
			const entries = parseSrtMain(srtContent);
			const entry = entries.find(e => e.index === targetIndex);

			if (!entry) {
				event.sender.send("audio-generate-progress", {
					status: "error",
					progress: 0,
					detail: `Không tìm thấy đoạn phụ đề số ${targetIndex}`,
					entryIndex: targetIndex,
					entryStatus: "failed"
				});
				return false;
			}

			const targetVoice = voiceName || (VOICE_MAP[lang] ? VOICE_MAP[lang].voice : null);
			if (!targetVoice) {
				event.sender.send("audio-generate-progress", {
					status: "error",
					progress: 0,
					detail: `Không hỗ trợ ngôn ngữ/giọng đọc: ${lang}`,
					entryIndex: targetIndex,
					entryStatus: "failed"
				});
				return false;
			}

			event.sender.send("audio-generate-progress", {
				status: "generating",
				progress: 100, // Or whatever
				detail: `Đang tạo lại đoạn ${targetIndex}...`,
				entryIndex: targetIndex,
				entryStatus: "start"
			});

			const outputDir = path.join(projectPath, "audio_gene");
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			const fileName = `${String(targetIndex).padStart(4, '0')}.mp3`;
			const outputPath = path.join(outputDir, fileName);

			const success = await generateAudioSegment(entry.text, targetVoice, outputPath);

			if (success) {
				event.sender.send("audio-generate-progress", {
					status: "done",
					progress: 100,
					detail: `Đã tạo lại đoạn ${targetIndex}`,
					entryIndex: targetIndex,
					entryStatus: "done"
				});
				return true;
			} else {
				event.sender.send("audio-generate-progress", {
					status: "error",
					progress: 100, // Done but failed
					detail: `Tạo đoạn ${targetIndex} thất bại`,
					entryIndex: targetIndex,
					entryStatus: "failed"
				});
				return false;
			}
		} catch (err) {
			console.error("Single audio generation failed:", err);
			event.sender.send("audio-generate-progress", {
				status: "error",
				progress: 100,
				detail: `Lỗi khi tạo lại đoạn ${targetIndex}: ${err}`,
				entryIndex: targetIndex,
				entryStatus: "failed"
			});
			return false;
		}
	}
);

ipcMain.handle("list-generated-audio", (event, projectPath: string, videoId: string) => {
	try {
		const audioDir = path.join(projectPath, "audio_gene");
		if (!fs.existsSync(audioDir)) return [];
		const files = fs
			.readdirSync(audioDir)
			.filter((f) => f.endsWith(".mp3") || f.endsWith(".wav"))
			.sort();
		return files.map((f) => ({
			name: f,
			path: path.join(audioDir, f),
		}));
	} catch {
		return [];
	}
});

ipcMain.handle("read-generated-audio", async (event, audioPath: string) => {
	try {
		if (!fs.existsSync(audioPath)) return null;
		const buffer = fs.readFileSync(audioPath);
		return `data:audio/mp3;base64,${buffer.toString("base64")}`;
	} catch (error) {
		console.error("Failed to read audio:", error);
		return null;
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
	} catch (error) {
		console.error("Failed to read video file:", error);
		return null;
	}
});

// Edge TTS Handlers
ipcMain.handle('get-edge-voices', async () => {
	try {
		return await getEdgeVoices();
	} catch (err) {
		console.error('Error in IPC handler get-edge-voices:', err);
		return [];
	}
});

ipcMain.handle('preview-edge-voice', async (event, voiceName: string, text: string) => {
	try {
		const tempDir = path.join(app.getPath('temp'), 'auto-voice-over-tool');
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true });
		}
		const outputPath = path.join(tempDir, `preview_${Date.now()}.mp3`);
		const success = await previewEdgeVoice(voiceName, text, outputPath);
		if (success) {
			const buffer = fs.readFileSync(outputPath);
			fs.unlinkSync(outputPath); // Clean up immediately after reading
			return `data:audio/mp3;base64,${buffer.toString("base64")}`;
		}
		return null;
	} catch (error) {
		console.error("Failed to preview edge voice:", error);
		return null;
	}
});

// Final Video
ipcMain.handle("check-final-video-ready", (_event, projectPath: string, videoId: string) => {
	const videoDir = path.join(projectPath, "original", "video");
	const srtDir = path.join(projectPath, "transcript");
	const audioDir = path.join(projectPath, "audio_gene");
	const finalPath = path.join(projectPath, "final", `${videoId}_final.mp4`);

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

ipcMain.on("create-final-video", async (event, projectPath: string, videoId: string) => {
	try {
		await createFinalVideo(projectPath, videoId, (p) => {
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

ipcMain.handle("export-subtitle", async (_event, content: string, defaultName: string, extensions: string[]) => {
	const result = await dialog.showSaveDialog({
		defaultPath: defaultName,
		filters: [
			{ name: "Subtitle Files", extensions: extensions },
		],
	});
	if (result.canceled || !result.filePath) return false;
	try {
		fs.writeFileSync(result.filePath, content, "utf8");
		return true;
	} catch (error) {
		console.error("Failed to export subtitle:", error);
		return false;
	}
});

// Audio file reading for playback
ipcMain.handle("read-audio-file", (event, projectPath: string, videoId: string) => {
	const transcriptAudioPath = path.join(projectPath, "transcript", `${videoId}_16k.wav`);
	if (fs.existsSync(transcriptAudioPath)) {
		const buffer = fs.readFileSync(transcriptAudioPath);
		return { buffer: buffer.buffer, mimeType: "audio/wav" };
	}
	// Try original audio
	const originalDir = path.join(projectPath, "original", "audio");
	if (fs.existsSync(originalDir)) {
		const files = fs.readdirSync(originalDir);
		let audioFile = null;
		if (videoId) {
			audioFile = files.find(f => f.startsWith(videoId) && /\.(mp3|m4a|wav|ogg|webm|opus)$/i.test(f));
		}
		if (!audioFile) {
			audioFile = files.find((f) => /\.(mp3|m4a|wav|ogg|webm|opus)$/i.test(f));
		}
		if (audioFile) {
			const ext = path.extname(audioFile).slice(1).toLowerCase();
			const mimeMap: Record<string, string> = {
				mp3: "audio/mpeg",
				m4a: "audio/mp4",
				wav: "audio/wav",
				ogg: "audio/ogg",
				webm: "audio/webm",
				opus: "audio/opus",
			};
			const buffer = fs.readFileSync(path.join(originalDir, audioFile));
			return {
				buffer: buffer.buffer,
				mimeType: mimeMap[ext] || "audio/mpeg",
			};
		}
	}
	return null;
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
	await startVideoServer();
	createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});
