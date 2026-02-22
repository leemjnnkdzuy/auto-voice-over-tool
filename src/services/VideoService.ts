import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getYtDlpPath, getFfmpegPath } from './EnvironmentService';

// Helper to ensure directory exists
const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

export const getVideoInfo = async (url: string): Promise<any> => {
    return new Promise((resolve) => {
        try {
            const ytDlpPath = getYtDlpPath();
            const proc = spawn(ytDlpPath, [
                '--dump-json',
                '--no-download',
                url
            ]);

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                if (code !== 0) {
                    console.error('yt-dlp info error:', stderr);
                    resolve(null);
                    return;
                }

                try {
                    const info = JSON.parse(stdout);
                    resolve({
                        title: info.title || '',
                        thumbnail: info.thumbnail || '',
                        duration: info.duration || 0,
                        id: info.id || '',
                        url: info.webpage_url || info.original_url || url,
                        author: info.uploader || info.channel || '',
                        viewCount: info.view_count || 0,
                        uploadDate: info.upload_date
                            ? `${info.upload_date.slice(0, 4)}-${info.upload_date.slice(4, 6)}-${info.upload_date.slice(6, 8)}`
                            : '',
                        description: info.description || '',
                        isLive: info.is_live || false,
                    });
                } catch (e) {
                    console.error('Failed to parse yt-dlp output:', e);
                    resolve(null);
                }
            });

            proc.on('error', (err) => {
                console.error('yt-dlp spawn error:', err);
                resolve(null);
            });
        } catch (error) {
            console.error("Error getting video info:", error);
            resolve(null);
        }
    });
};

export const downloadVideo = async (
    url: string,
    projectPath: string,
    onProgress: (progress: { video: number, audio: number }) => void
): Promise<boolean> => {
    return new Promise((resolve) => {
        try {
            const videoDir = path.join(projectPath, 'original', 'video');
            const audioDir = path.join(projectPath, 'original', 'audio');
            ensureDir(videoDir);
            ensureDir(audioDir);

            const ytDlpPath = getYtDlpPath();
            const ffmpegPath = getFfmpegPath();

            let videoProgress = 0;
            let audioProgress = 0;
            let videoFinished = false;
            let audioFinished = false;

            const checkDone = () => {
                if (videoFinished && audioFinished) {
                    onProgress({ video: 100, audio: 100 });
                    resolve(true);
                }
            };

            const reportProgress = () => {
                onProgress({ video: videoProgress, audio: audioProgress });
            };

            // Parse yt-dlp progress from output
            const parseProgress = (data: string): number | null => {
                const match = data.match(/\[download\]\s+(\d+\.?\d*)%/);
                if (match) {
                    return parseFloat(match[1]);
                }
                return null;
            };

            // Download video only (no audio)
            const videoProc = spawn(ytDlpPath, [
                '-f', 'bestvideo[ext=mp4]/bestvideo',
                '--ffmpeg-location', ffmpegPath,
                '-o', path.join(videoDir, '%(id)s.%(ext)s'),
                '--newline',
                '--no-part', // Avoid .part files for smoother progress tracking?
                url
            ]);

            videoProc.stdout.on('data', (data) => {
                const text = data.toString();
                const pct = parseProgress(text);
                if (pct !== null) {
                    videoProgress = pct;
                    reportProgress();
                }
            });

            videoProc.stderr.on('data', (data) => {
                // yt-dlp often writes progress to stderr/stdout depending on version
                const text = data.toString();
                const pct = parseProgress(text);
                if (pct !== null) {
                    videoProgress = pct;
                    reportProgress();
                }
            });

            videoProc.on('close', (code) => {
                console.log('Video download finished, exit code:', code);
                videoProgress = 100;
                videoFinished = true;
                reportProgress();
                checkDone();
            });

            videoProc.on('error', (err) => {
                console.error('Video download error:', err);
                videoFinished = true; // Mark finished to avoid hanging? Or resolve false?
                // Let's assume we want to finish both attempts.
                videoProgress = 0; // or 100?
                checkDone();
            });

            // Download audio only
            const audioProc = spawn(ytDlpPath, [
                '-f', 'bestaudio[ext=m4a]/bestaudio',
                '--ffmpeg-location', ffmpegPath,
                '--extract-audio',
                '--audio-format', 'mp3',
                '-o', path.join(audioDir, '%(id)s.%(ext)s'),
                '--newline',
                '--no-part',
                url
            ]);

            audioProc.stdout.on('data', (data) => {
                const text = data.toString();
                const pct = parseProgress(text);
                if (pct !== null) {
                    audioProgress = pct;
                    reportProgress();
                }
            });

            audioProc.stderr.on('data', (data) => {
                const text = data.toString();
                const pct = parseProgress(text);
                if (pct !== null) {
                    audioProgress = pct;
                    reportProgress();
                }
            });

            audioProc.on('close', (code) => {
                console.log('Audio download finished, exit code:', code);
                audioProgress = 100;
                audioFinished = true;
                reportProgress();
                checkDone();
            });

            audioProc.on('error', (err) => {
                console.error('Audio download error:', err);
                audioFinished = true;
                checkDone();
            });

        } catch (error) {
            console.error("Download failed:", error);
            resolve(false);
        }
    });
};

export const importLocalVideo = async (
    sourcePath: string,
    projectPath: string,
    onProgress: (progress: { video: number, audio: number }) => void
): Promise<any> => {
    return new Promise(async (resolve) => {
        try {
            const videoDir = path.join(projectPath, 'original', 'video');
            const audioDir = path.join(projectPath, 'original', 'audio');
            ensureDir(videoDir);
            ensureDir(audioDir);

            const ffmpegPath = getFfmpegPath();
            const fileName = path.basename(sourcePath);
            const ext = path.extname(sourcePath);
            const id = path.parse(fileName).name;
            const targetVideoPath = path.join(videoDir, fileName);

            // 1. Copy video file
            onProgress({ video: 20, audio: 0 });
            fs.copyFileSync(sourcePath, targetVideoPath);
            onProgress({ video: 50, audio: 0 });

            // 2. Extract audio using ffmpeg
            const targetAudioPath = path.join(audioDir, `${id}.mp3`);
            const audioProc = spawn(ffmpegPath, [
                '-i', targetVideoPath,
                '-vn',
                '-acodec', 'libmp3lame',
                '-y',
                targetAudioPath
            ]);

            audioProc.on('close', async (code) => {
                if (code !== 0) {
                    console.error('Audio extraction failed');
                    resolve(null);
                    return;
                }
                onProgress({ video: 50, audio: 100 });

                // 3. Generate thumbnail
                const thumbnailPath = path.join(videoDir, `${id}.jpg`);
                const thumbProc = spawn(ffmpegPath, [
                    '-i', targetVideoPath,
                    '-ss', '00:00:01',
                    '-vframes', '1',
                    '-q:v', '2',
                    '-y',
                    thumbnailPath
                ]);

                thumbProc.on('close', async (tCode) => {
                    // 4. Get video duration using ffmpeg
                    const ffprobePath = ffmpegPath.replace('ffmpeg.exe', 'ffprobe.exe');
                    const durationProc = spawn(ffprobePath, [
                        '-v', 'error',
                        '-show_entries', 'format=duration',
                        '-of', 'default=noprint_wrappers=1:nokey=1',
                        targetVideoPath
                    ]);

                    let durationOutput = '';
                    durationProc.stdout.on('data', (data) => { durationOutput += data.toString(); });

                    durationProc.on('close', () => {
                        const duration = parseFloat(durationOutput.trim()) || 0;
                        onProgress({ video: 100, audio: 100 });

                        resolve({
                            title: id,
                            thumbnail: `data:image/jpeg;base64,${fs.readFileSync(thumbnailPath).toString('base64')}`,
                            duration: Math.floor(duration),
                            id: id,
                            url: sourcePath,
                            author: 'Local File',
                            description: `File: ${fileName}`,
                        });

                        // Clean up temporary thumbnail file after reading if needed, 
                        // but actually we might want to keep it in the project folder
                    });
                });
            });

        } catch (error) {
            console.error("Local import failed:", error);
            resolve(null);
        }
    });
};
