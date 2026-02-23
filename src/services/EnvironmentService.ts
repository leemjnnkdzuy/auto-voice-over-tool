import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { spawn } from 'child_process';
import { getHardwareInfo } from './HardwareService';

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
const MODEL_CONFIG_PATH = path.join(MODELS_DIR, 'model-config.json');

export interface WhisperModelInfo {
    id: string;
    name: string;
    fileName: string;
    url: string;
    disk: string;
    mem: string;
    downloaded: boolean;
    active: boolean;
}

export const WHISPER_MODELS = [
    {
        id: 'tiny',
        name: 'Tiny',
        fileName: 'ggml-tiny.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
        disk: '75 MiB',
        mem: '~273 MB',
    },
    {
        id: 'base',
        name: 'Base',
        fileName: 'ggml-base.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
        disk: '142 MiB',
        mem: '~388 MB',
    },
    {
        id: 'small',
        name: 'Small',
        fileName: 'ggml-small.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
        disk: '466 MiB',
        mem: '~852 MB',
    },
    {
        id: 'medium',
        name: 'Medium',
        fileName: 'ggml-medium.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
        disk: '1.5 GiB',
        mem: '~2.1 GB',
    },
    {
        id: 'large',
        name: 'Large',
        fileName: 'ggml-large-v3-turbo.bin',
        url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
        disk: '2.9 GiB',
        mem: '~3.9 GB',
    },
];

const readModelConfig = (): { activeModel: string } => {
    try {
        if (fs.existsSync(MODEL_CONFIG_PATH)) {
            return JSON.parse(fs.readFileSync(MODEL_CONFIG_PATH, 'utf-8'));
        }
    } catch (error) {
        console.warn('Failed to read model config, using default:', error);
    }
    return { activeModel: 'base' };
};

const writeModelConfig = (config: { activeModel: string }) => {
    ensureDir(MODELS_DIR);
    fs.writeFileSync(MODEL_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
};

export const getActiveModelId = (): string => {
    return readModelConfig().activeModel;
};

export const setActiveModelId = (modelId: string): boolean => {
    const model = WHISPER_MODELS.find(m => m.id === modelId);
    if (!model) return false;
    const modelPath = path.join(MODELS_DIR, model.fileName);
    if (!fs.existsSync(modelPath)) return false;
    writeModelConfig({ activeModel: modelId });
    return true;
};

export const getWhisperModelPath = (): string => {
    const config = readModelConfig();
    const model = WHISPER_MODELS.find(m => m.id === config.activeModel);
    if (model) {
        const modelPath = path.join(MODELS_DIR, model.fileName);
        if (fs.existsSync(modelPath)) return modelPath;
    }
    return path.join(MODELS_DIR, 'ggml-base.bin');
};

export const listWhisperModels = (): WhisperModelInfo[] => {
    const config = readModelConfig();
    return WHISPER_MODELS.map(m => ({
        ...m,
        downloaded: fs.existsSync(path.join(MODELS_DIR, m.fileName)),
        active: m.id === config.activeModel,
    }));
};

const activeDownloadConfig: { modelId: string | null; percent: number } = {
    modelId: null,
    percent: 0,
};

export const getWhisperDownloadStatus = () => {
    return { modelId: activeDownloadConfig.modelId, percent: activeDownloadConfig.percent };
};

export const setWhisperDownloadStatus = (modelId: string | null, percent: number) => {
    activeDownloadConfig.modelId = modelId;
    activeDownloadConfig.percent = percent;
};

export const downloadWhisperModel = async (
    modelId: string,
    onProgress: (percent: number) => void,
): Promise<boolean> => {
    const model = WHISPER_MODELS.find(m => m.id === modelId);
    if (!model) return false;

    ensureDir(MODELS_DIR);
    const destPath = path.join(MODELS_DIR, model.fileName);

    if (fs.existsSync(destPath)) return true;

    activeDownloadConfig.modelId = modelId;
    activeDownloadConfig.percent = 0;

    try {
        await downloadFile(model.url, destPath, (percent) => {
            activeDownloadConfig.percent = percent;
            onProgress(percent);
        });
        activeDownloadConfig.modelId = null;
        activeDownloadConfig.percent = 0;
        return true;
    } catch (err) {
        console.error(`Failed to download model ${modelId}:`, err);
        if (fs.existsSync(destPath)) {
            try {
                fs.unlinkSync(destPath);
            } catch (cleanupError) {
                console.warn(`Failed to remove partial model file for ${modelId}:`, cleanupError);
            }
        }
        activeDownloadConfig.modelId = null;
        activeDownloadConfig.percent = 0;
        return false;
    }
};

export const deleteWhisperModel = (modelId: string): boolean => {
    const downloadedCount = WHISPER_MODELS.filter(m =>
        fs.existsSync(path.join(MODELS_DIR, m.fileName))
    ).length;

    if (downloadedCount <= 1) return false;

    const model = WHISPER_MODELS.find(m => m.id === modelId);
    if (!model) return false;

    const modelPath = path.join(MODELS_DIR, model.fileName);
    if (!fs.existsSync(modelPath)) return false;

    const config = readModelConfig();
    if (config.activeModel === modelId) {
        const otherModel = WHISPER_MODELS.find(m =>
            m.id !== modelId && fs.existsSync(path.join(MODELS_DIR, m.fileName))
        );
        if (otherModel) {
            writeModelConfig({ activeModel: otherModel.id });
        } else {
            return false;
        }
    }

    try {
        fs.unlinkSync(modelPath);
        return true;
    } catch (err) {
        console.error(`Failed to delete model ${modelId}:`, err);
        return false;
    }
};

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
        const makeRequest = (currentUrl: string, redirectCount = 0) => {
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
const extractExeFromZip = async (zipPath: string, destDir: string, exeName: string): Promise<boolean> => {
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
                if (fs.existsSync(zipPath)) {
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
export const isHandBrakeReady = (): boolean => fs.existsSync(getHandBrakePath());
export const isWhisperReady = (): boolean => fs.existsSync(getWhisperPath('cpu'));
export const isWhisperModelReady = (): boolean => {
    return WHISPER_MODELS.some(m => fs.existsSync(path.join(MODELS_DIR, m.fileName)));
};

export const isWhisperEngineReady = (engine: 'cpu' | 'gpu'): boolean => {
    return fs.existsSync(getWhisperPath(engine));
};

export const isEnvironmentReady = (): boolean => {
    return isYtDlpReady() && isFfmpegReady() && isHandBrakeReady() && isWhisperEngineReady('cpu') && isWhisperEngineReady('gpu') && isWhisperModelReady();
};

/**
 * Download a specific whisper engine variant on-demand
 */
export const downloadWhisperEngine = async (
    engine: 'cpu' | 'gpu',
    onProgress: ProgressCallback
): Promise<boolean> => {
    if (isWhisperEngineReady(engine)) return true;

    const url = engine === 'gpu' ? WHISPER_GPU_URL : WHISPER_CPU_URL;
    const destDir = engine === 'gpu' ? WHISPER_GPU_DIR : WHISPER_CPU_DIR;
    const label = engine === 'gpu' ? 'Whisper GPU (CUDA)' : 'Whisper CPU';

    ensureDir(destDir);

    onProgress({ status: 'downloading', progress: 0, detail: `Đang tải ${label}...` });
    const zipPath = path.join(destDir, 'whisper.zip');

    await downloadFile(url, zipPath, (percent) => {
        onProgress({ status: 'downloading', progress: percent * 0.8, detail: `Đang tải ${label}... ${percent}%` });
    });

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


        if (!isYtDlpReady()) {
            onProgress({ status: 'downloading', progress: 0, detail: 'Đang tải yt-dlp...' });
            await downloadFile(YT_DLP_URL, getYtDlpPath(), (percent) => {
                onProgress({ status: 'downloading', progress: percent * 0.15, detail: `Đang tải yt-dlp... ${percent}%` });
            });
            onProgress({ status: 'downloading', progress: 15, detail: 'yt-dlp đã tải xong!' });
        } else {
            onProgress({ status: 'checking', progress: 15, detail: 'yt-dlp đã sẵn sàng.' });
        }

        if (!isFfmpegReady()) {
            onProgress({ status: 'downloading', progress: 15, detail: 'Đang tải ffmpeg...' });
            const zipPath = path.join(FFMPEG_DIR, 'ffmpeg.zip');
            await downloadFile(FFMPEG_URL, zipPath, (percent) => {
                onProgress({ status: 'downloading', progress: 15 + percent * 0.10, detail: `Đang tải ffmpeg... ${percent}%` });
            });
            onProgress({ status: 'extracting', progress: 25, detail: 'Đang giải nén ffmpeg...' });
            const extracted = await extractExeFromZip(zipPath, FFMPEG_DIR, 'ffmpeg.exe');
            if (!extracted) {
                onProgress({ status: 'error', progress: 25, detail: 'Không thể giải nén ffmpeg!' });
                return false;
            }
            onProgress({ status: 'downloading', progress: 27, detail: 'ffmpeg đã sẵn sàng!' });
        } else {
            onProgress({ status: 'checking', progress: 27, detail: 'ffmpeg đã sẵn sàng.' });
        }

        if (!isHandBrakeReady()) {
            onProgress({ status: 'downloading', progress: 27, detail: 'Đang tải HandBrakeCLI...' });
            const hbZipPath = path.join(HANDBRAKE_DIR, 'handbrake.zip');
            await downloadFile(HANDBRAKE_URL, hbZipPath, (percent) => {
                onProgress({ status: 'downloading', progress: 27 + percent * 0.09, detail: `Đang tải HandBrakeCLI... ${percent}%` });
            });
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

        if (!isWhisperEngineReady('cpu')) {
            onProgress({ status: 'downloading', progress: 38, detail: 'Đang tải Whisper CPU...' });
            const whisperZipPath = path.join(WHISPER_CPU_DIR, 'whisper-cpu.zip');
            await downloadFile(WHISPER_CPU_URL, whisperZipPath, (percent) => {
                onProgress({ status: 'downloading', progress: 38 + percent * 0.08, detail: `Đang tải Whisper CPU... ${percent}%` });
            });
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

        if (!isWhisperEngineReady('gpu')) {
            onProgress({ status: 'downloading', progress: 48, detail: 'Đang tải Whisper GPU (CUDA)...' });
            const whisperGpuZipPath = path.join(WHISPER_GPU_DIR, 'whisper-gpu.zip');
            await downloadFile(WHISPER_GPU_URL, whisperGpuZipPath, (percent) => {
                onProgress({ status: 'downloading', progress: 48 + percent * 0.10, detail: `Đang tải Whisper GPU... ${percent}%` });
            });
            onProgress({ status: 'extracting', progress: 58, detail: 'Đang giải nén Whisper GPU...' });
            const extracted = await extractExeFromZip(whisperGpuZipPath, WHISPER_GPU_DIR, 'whisper-cli.exe');
            if (!extracted) {
                onProgress({ status: 'error', progress: 58, detail: 'Không thể giải nén Whisper GPU!' });
                return false;
            }
            onProgress({ status: 'downloading', progress: 60, detail: 'Whisper GPU đã sẵn sàng!' });
        } else {
            onProgress({ status: 'checking', progress: 60, detail: 'Whisper GPU đã sẵn sàng.' });
        }

        if (!isWhisperModelReady()) {
            onProgress({ status: 'downloading', progress: 60, detail: 'Đang tải mô hình Whisper (base)...' });
            const baseModel = WHISPER_MODELS.find(m => m.id === 'base');
            if (!baseModel) {
                onProgress({ status: 'error', progress: 60, detail: 'Thiếu cấu hình mô hình Whisper base!' });
                return false;
            }
            const baseModelPath = path.join(MODELS_DIR, baseModel.fileName);
            await downloadFile(baseModel.url, baseModelPath, (percent) => {
                onProgress({ status: 'downloading', progress: 60 + percent * 0.35, detail: `Đang tải mô hình Whisper... ${percent}%` });
            });
            writeModelConfig({ activeModel: 'base' });
            onProgress({ status: 'downloading', progress: 95, detail: 'Mô hình Whisper đã tải xong!' });
        } else {
            onProgress({ status: 'checking', progress: 95, detail: 'Mô hình Whisper đã sẵn sàng.' });
        }

        onProgress({ status: 'checking', progress: 98, detail: 'Đang kiểm tra phần cứng hệ thống...' });
        await getHardwareInfo();

        onProgress({ status: 'ready', progress: 100, detail: 'Môi trường đã sẵn sàng!' });
        return true;

    } catch (error) {
        console.error('Environment setup failed:', error);
        onProgress({ status: 'error', progress: 0, detail: `Lỗi: ${error}` });
        return false;
    }
};


