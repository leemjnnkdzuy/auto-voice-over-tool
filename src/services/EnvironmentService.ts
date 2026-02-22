import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { spawn } from 'child_process';

// Bin directory: in dev mode use project root, in production use userData
const isDev = !app.isPackaged;
const BIN_DIR = isDev
    ? path.join(process.cwd(), 'bin')
    : path.join(app.getPath('userData'), 'bin');

const MODELS_DIR = path.join(BIN_DIR, 'models');
const WHISPER_CPU_DIR = path.join(BIN_DIR, 'whisper-cpu');
const WHISPER_GPU_DIR = path.join(BIN_DIR, 'whisper-gpu');
const YT_DLP_DIR = path.join(BIN_DIR, 'yt-dlp');
const FFMPEG_DIR = path.join(BIN_DIR, 'ffmpeg');
const HANDBRAKE_DIR = path.join(BIN_DIR, 'handbrake');

export const getYtDlpPath = () => path.join(YT_DLP_DIR, 'yt-dlp.exe');
export const getFfmpegPath = () => path.join(FFMPEG_DIR, 'ffmpeg.exe');
export const getHandBrakePath = () => path.join(HANDBRAKE_DIR, 'HandBrakeCLI.exe');
export const getWhisperModelPath = () => path.join(MODELS_DIR, 'ggml-base.bin');
export const getWhisperTurboModelPath = () => path.join(MODELS_DIR, 'ggml-large-v3-turbo.bin');

export const getWhisperPath = (engine: 'cpu' | 'gpu' = 'cpu') => {
    if (engine === 'gpu') {
        return path.join(WHISPER_GPU_DIR, 'whisper-cli.exe');
    }
    return path.join(WHISPER_CPU_DIR, 'whisper-cli.exe');
};

const YT_DLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const FFMPEG_URL = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip';
const WHISPER_CPU_URL = 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.3/whisper-bin-x64.zip';
const WHISPER_GPU_URL = 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.3/whisper-cublas-12.4.0-bin-x64.zip';
const WHISPER_MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin';
const WHISPER_TURBO_MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin';
const HANDBRAKE_URL = 'https://github.com/HandBrake/HandBrake/releases/download/1.10.2/HandBrakeCLI-1.10.2-win-x86_64.zip';

interface SetupProgress {
    status: string;
    progress: number;
    detail: string;
}

type ProgressCallback = (progress: SetupProgress) => void;

const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

/**
 * Download a file from URL with redirect support
 */
const downloadFile = (url: string, destPath: string, onProgress?: (percent: number) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
        const makeRequest = (currentUrl: string, redirectCount: number = 0) => {
            if (redirectCount > 10) {
                reject(new Error('Too many redirects'));
                return;
            }

            const parsedUrl = new URL(currentUrl);
            const options = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.pathname + parsedUrl.search,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            };

            https.get(options, (response) => {
                // Handle redirects
                if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    makeRequest(response.headers.location, redirectCount + 1);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`Download failed with status code: ${response.statusCode}`));
                    return;
                }

                const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedSize = 0;

                const fileStream = fs.createWriteStream(destPath);
                response.pipe(fileStream);

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    if (totalSize > 0 && onProgress) {
                        onProgress(Math.round((downloadedSize / totalSize) * 100));
                    }
                });

                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve();
                });

                fileStream.on('error', (err) => {
                    fs.unlinkSync(destPath);
                    reject(err);
                });
            }).on('error', (err) => {
                reject(err);
            });
        };

        makeRequest(url);
    });
};

/**
 * Extract a specific exe from a downloaded zip using PowerShell
 */
const extractExeFromZip = async (zipPath: string, destDir: string, exeName: string, keepZip: boolean = false): Promise<boolean> => {
    return new Promise((resolve) => {
        try {
            const psCommand = `
                $zipPath = '${zipPath.replace(/'/g, "''")}';
                $extractPath = '${destDir.replace(/'/g, "''")}';
                $tempExtract = Join-Path $extractPath '${exeName}_temp';
                
                if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
                
                Expand-Archive -Path $zipPath -DestinationPath $tempExtract -Force;
                
                $targetExe = Get-ChildItem -Path $tempExtract -Recurse -Filter "${exeName}" | Select-Object -First 1;
                
                if ($targetExe) {
                    Copy-Item $targetExe.FullName (Join-Path $extractPath '${exeName}') -Force;
                    # Also copy any DLLs that might be needed
                    $dllFiles = Get-ChildItem -Path $targetExe.DirectoryName -Filter "*.dll" -ErrorAction SilentlyContinue;
                    foreach ($dll in $dllFiles) {
                        Copy-Item $dll.FullName (Join-Path $extractPath $dll.Name) -Force;
                    }
                    Remove-Item $tempExtract -Recurse -Force;
                    Write-Output "SUCCESS";
                } else {
                    Remove-Item $tempExtract -Recurse -Force;
                    Write-Output "NOTFOUND";
                }
            `;

            const proc = spawn('powershell.exe', ['-NoProfile', '-Command', psCommand], {
                windowsHide: true
            });

            let output = '';
            proc.stdout.on('data', (data) => { output += data.toString(); });
            proc.stderr.on('data', (data) => { console.error('Extract stderr:', data.toString()); });

            proc.on('close', () => {
                // Clean up zip only if requested
                if (!keepZip && fs.existsSync(zipPath)) {
                    fs.unlinkSync(zipPath);
                }
                resolve(output.includes('SUCCESS'));
            });

            proc.on('error', (err) => {
                console.error('Extract error:', err);
                resolve(false);
            });
        } catch (error) {
            console.error('Extract exception:', error);
            resolve(false);
        }
    });
};

/**
 * Check readiness
 */
export const isYtDlpReady = (): boolean => fs.existsSync(getYtDlpPath());
export const isFfmpegReady = (): boolean => fs.existsSync(getFfmpegPath());
export const isFfprobeReady = (): boolean => fs.existsSync(path.join(FFMPEG_DIR, 'ffprobe.exe'));
export const isHandBrakeReady = (): boolean => fs.existsSync(getHandBrakePath());
export const isWhisperReady = (): boolean => fs.existsSync(getWhisperPath('cpu'));
export const isWhisperModelReady = (): boolean => fs.existsSync(getWhisperModelPath());
export const isWhisperTurboModelReady = (): boolean => fs.existsSync(getWhisperTurboModelPath());

export const isWhisperEngineReady = (engine: 'cpu' | 'gpu'): boolean => {
    return fs.existsSync(getWhisperPath(engine));
};

export const isEnvironmentReady = (): boolean => {
    // Whisper GPU is now optional for readiness, but CPU, ffmpeg, ffprobe, etc. are required
    return isYtDlpReady() && isFfmpegReady() && isFfprobeReady() && isHandBrakeReady() && isWhisperEngineReady('cpu') && isWhisperModelReady();
};

/**
 * Download a specific whisper engine variant on-demand
 */
export const downloadWhisperEngine = async (
    engine: 'cpu' | 'gpu',
    onProgress: ProgressCallback
): Promise<boolean> => {
    if (isWhisperEngineReady(engine)) {
        onProgress({ status: 'ready', progress: 100, detail: `${engine === 'gpu' ? 'Whisper GPU' : 'Whisper CPU'} đã sẵn sàng!` });
        return true;
    }

    const url = engine === 'gpu' ? WHISPER_GPU_URL : WHISPER_CPU_URL;
    const destDir = engine === 'gpu' ? WHISPER_GPU_DIR : WHISPER_CPU_DIR;
    const label = engine === 'gpu' ? 'Whisper GPU (CUDA)' : 'Whisper CPU';

    ensureDir(destDir);

    const zipPath = path.join(destDir, 'whisper.zip');

    // Check if zip already exists
    if (fs.existsSync(zipPath)) {
        onProgress({ status: 'extracting', progress: 50, detail: `Tìm thấy ${label} (zip), đang giải nén...` });
    } else {
        onProgress({ status: 'downloading', progress: 0, detail: `Đang tải ${label}...` });
        await downloadFile(url, zipPath, (percent) => {
            onProgress({ status: 'downloading', progress: percent * 0.8, detail: `Đang tải ${label}... ${percent}%` });
        });
    }

    onProgress({ status: 'extracting', progress: 80, detail: `Đang giải nén ${label}...` });
    const extracted = await extractExeFromZip(zipPath, destDir, 'whisper-cli.exe');
    if (!extracted) {
        onProgress({ status: 'error', progress: 0, detail: `Không thể giải nén ${label}!` });
        return false;
    }

    onProgress({ status: 'ready', progress: 100, detail: `${label} đã sẵn sàng!` });
    return true;
};

/**
 * Setup the environment: download yt-dlp, ffmpeg, whisper.cpp (CPU + GPU), and whisper model if missing
 */
export const setupEnvironment = async (onProgress: ProgressCallback): Promise<boolean> => {
    try {
        ensureDir(BIN_DIR);
        ensureDir(MODELS_DIR);
        ensureDir(YT_DLP_DIR);
        ensureDir(FFMPEG_DIR);
        ensureDir(HANDBRAKE_DIR);
        ensureDir(WHISPER_CPU_DIR);
        ensureDir(WHISPER_GPU_DIR);

        // Progress allocation:
        // yt-dlp:           0-15%
        // ffmpeg:          15-27%
        // HandBrakeCLI:    27-38%
        // whisper CPU:     38-48%
        // whisper GPU:     48-60%
        // whisper model:   60-95%
        // done:            100%

        // Step 1: yt-dlp
        if (!isYtDlpReady()) {
            onProgress({ status: 'downloading', progress: 0, detail: 'Đang tải yt-dlp...' });
            await downloadFile(YT_DLP_URL, getYtDlpPath(), (percent) => {
                onProgress({ status: 'downloading', progress: percent * 0.15, detail: `Đang tải yt-dlp... ${percent}%` });
            });
            onProgress({ status: 'downloading', progress: 15, detail: 'yt-dlp đã tải xong!' });
        } else {
            onProgress({ status: 'checking', progress: 15, detail: 'yt-dlp đã sẵn sàng.' });
        }

        // Step 2: ffmpeg & ffprobe
        if (!isFfmpegReady() || !isFfprobeReady()) {
            const zipPath = path.join(FFMPEG_DIR, 'ffmpeg.zip');
            if (fs.existsSync(zipPath)) {
                onProgress({ status: 'extracting', progress: 15, detail: 'Tìm thấy ffmpeg (zip), đang giải nén...' });
            } else {
                onProgress({ status: 'downloading', progress: 15, detail: 'Đang tải ffmpeg...' });
                await downloadFile(FFMPEG_URL, zipPath, (percent) => {
                    onProgress({ status: 'downloading', progress: 15 + percent * 0.10, detail: `Đang tải ffmpeg... ${percent}%` });
                });
            }
            onProgress({ status: 'extracting', progress: 25, detail: 'Đang giải nén ffmpeg...' });
            const extracted = await extractExeFromZip(zipPath, FFMPEG_DIR, 'ffmpeg.exe', true);
            if (!extracted) {
                onProgress({ status: 'error', progress: 25, detail: 'Không thể giải nén ffmpeg!' });
                return false;
            }

            onProgress({ status: 'extracting', progress: 26, detail: 'Đang giải nén ffprobe...' });
            await extractExeFromZip(zipPath, FFMPEG_DIR, 'ffprobe.exe', false);

            onProgress({ status: 'downloading', progress: 27, detail: 'ffmpeg/ffprobe đã sẵn sàng!' });
        } else {
            onProgress({ status: 'checking', progress: 27, detail: 'ffmpeg/ffprobe đã sẵn sàng.' });
        }

        // Step 2.5: HandBrakeCLI
        if (!isHandBrakeReady()) {
            const hbZipPath = path.join(HANDBRAKE_DIR, 'handbrake.zip');
            if (fs.existsSync(hbZipPath)) {
                onProgress({ status: 'extracting', progress: 27, detail: 'Tìm thấy HandBrakeCLI (zip), đang giải nén...' });
            } else {
                onProgress({ status: 'downloading', progress: 27, detail: 'Đang tải HandBrakeCLI...' });
                await downloadFile(HANDBRAKE_URL, hbZipPath, (percent) => {
                    onProgress({ status: 'downloading', progress: 27 + percent * 0.09, detail: `Đang tải HandBrakeCLI... ${percent}%` });
                });
            }
            onProgress({ status: 'extracting', progress: 36, detail: 'Đang giải nén HandBrakeCLI...' });
            const extracted = await extractExeFromZip(hbZipPath, HANDBRAKE_DIR, 'HandBrakeCLI.exe');
            if (!extracted) {
                onProgress({ status: 'error', progress: 36, detail: 'Không thể giải nén HandBrakeCLI!' });
                return false;
            }
            onProgress({ status: 'downloading', progress: 38, detail: 'HandBrakeCLI đã sẵn sàng!' });
        } else {
            onProgress({ status: 'checking', progress: 38, detail: 'HandBrakeCLI đã sẵn sàng.' });
        }

        // Step 3: whisper.cpp (CPU)
        if (!isWhisperEngineReady('cpu')) {
            const whisperZipPath = path.join(WHISPER_CPU_DIR, 'whisper-cpu.zip');
            if (fs.existsSync(whisperZipPath)) {
                onProgress({ status: 'extracting', progress: 38, detail: 'Tìm thấy Whisper CPU (zip), đang giải nén...' });
            } else {
                onProgress({ status: 'downloading', progress: 38, detail: 'Đang tải Whisper CPU...' });
                await downloadFile(WHISPER_CPU_URL, whisperZipPath, (percent) => {
                    onProgress({ status: 'downloading', progress: 38 + percent * 0.08, detail: `Đang tải Whisper CPU... ${percent}%` });
                });
            }
            onProgress({ status: 'extracting', progress: 46, detail: 'Đang giải nén Whisper CPU...' });
            const extracted = await extractExeFromZip(whisperZipPath, WHISPER_CPU_DIR, 'whisper-cli.exe');
            if (!extracted) {
                onProgress({ status: 'error', progress: 46, detail: 'Không thể giải nén Whisper CPU!' });
                return false;
            }
            onProgress({ status: 'downloading', progress: 48, detail: 'Whisper CPU đã sẵn sàng!' });
        } else {
            onProgress({ status: 'checking', progress: 48, detail: 'Whisper CPU đã sẵn sàng.' });
        }

        // Step 4: whisper.cpp (GPU - CUDA)
        if (!isWhisperEngineReady('gpu')) {
            const whisperGpuZipPath = path.join(WHISPER_GPU_DIR, 'whisper-gpu.zip');
            if (fs.existsSync(whisperGpuZipPath)) {
                onProgress({ status: 'extracting', progress: 48, detail: 'Tìm thấy Whisper GPU (zip), đang giải nén...' });
            } else {
                onProgress({ status: 'downloading', progress: 48, detail: 'Đang tải Whisper GPU (CUDA)...' });
                await downloadFile(WHISPER_GPU_URL, whisperGpuZipPath, (percent) => {
                    onProgress({ status: 'downloading', progress: 48 + percent * 0.10, detail: `Đang tải Whisper GPU... ${percent}%` });
                });
            }
            onProgress({ status: 'extracting', progress: 58, detail: 'Đang giải nén Whisper GPU...' });
            const extracted = await extractExeFromZip(whisperGpuZipPath, WHISPER_GPU_DIR, 'whisper-cli.exe');
            if (!extracted) {
                // Whisper GPU is optional, so we don't return false here if it fails,
                // BUT if the user is in the setup screen, they might want to know.
                // However, since it's optional in isEnvironmentReady, let's just log and continue.
                console.warn('Whisper GPU extraction failed, but it is optional.');
                onProgress({ status: 'checking', progress: 60, detail: 'Bỏ qua Whisper GPU (lỗi hoặc không hỗ trợ).' });
            } else {
                onProgress({ status: 'downloading', progress: 60, detail: 'Whisper GPU đã sẵn sàng!' });
            }
        } else {
            onProgress({ status: 'checking', progress: 60, detail: 'Whisper GPU đã sẵn sàng.' });
        }

        // Step 5: whisper model (ggml-base.bin ~148MB)
        if (!isWhisperModelReady()) {
            onProgress({ status: 'downloading', progress: 60, detail: 'Đang tải mô hình Whisper (base)...' });
            await downloadFile(WHISPER_MODEL_URL, getWhisperModelPath(), (percent) => {
                onProgress({ status: 'downloading', progress: 60 + percent * 0.35, detail: `Đang tải mô hình Whisper... ${percent}%` });
            });
            onProgress({ status: 'downloading', progress: 95, detail: 'Mô hình Whisper đã tải xong!' });
        } else {
            onProgress({ status: 'checking', progress: 95, detail: 'Mô hình Whisper đã sẵn sàng.' });
        }

        onProgress({ status: 'ready', progress: 100, detail: 'Môi trường đã sẵn sàng!' });
        return true;

    } catch (error) {
        console.error('Environment setup failed:', error);
        onProgress({ status: 'error', progress: 0, detail: `Lỗi: ${error}` });
        return false;
    }
};


