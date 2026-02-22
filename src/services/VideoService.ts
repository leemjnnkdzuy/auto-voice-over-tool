import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getYtDlpPath, getFfmpegPath } from './EnvironmentService';

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

            const parseProgress = (data: string): number | null => {
                const match = data.match(/\[download\]\s+(\d+\.?\d*)%/);
                if (match) {
                    return parseFloat(match[1]);
                }
                return null;
            };

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
                videoProgress = 0; // or 100?
                checkDone();
            });

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
