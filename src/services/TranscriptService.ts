import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getWhisperPath, getWhisperModelPath, getWhisperTurboModelPath, getFfmpegPath, isWhisperEngineReady, downloadWhisperEngine } from './EnvironmentService';
import { optimizeSrtFile } from '../lib/SrtOptimizer';

export type TranscriptEngine = 'whisper-gpu-turbo';

interface TranscriptProgress {
    status: 'preparing' | 'converting' | 'transcribing' | 'downloading' | 'done' | 'error';
    progress: number; // 0-100
    detail: string;
}

type ProgressCallback = (progress: TranscriptProgress) => void;

/**
 * Convert audio file (mp3/m4a/etc.) to 16kHz mono WAV using ffmpeg
 * whisper.cpp requires WAV 16kHz mono input
 */
const convertToWav = (inputPath: string, outputPath: string, ffmpegPath: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const proc = spawn(ffmpegPath, [
            '-i', inputPath,
            '-ar', '16000',    // 16kHz sample rate
            '-ac', '1',        // mono
            '-c:a', 'pcm_s16le', // 16-bit PCM
            '-y',              // overwrite
            outputPath
        ]);

        proc.stderr.on('data', (data) => {
            console.log('[ffmpeg convert]', data.toString());
        });

        proc.on('close', (code) => {
            resolve(code === 0);
        });

        proc.on('error', (err) => {
            console.error('ffmpeg convert error:', err);
            resolve(false);
        });
    });
};

/**
 * Run whisper.cpp to transcribe audio and generate SRT
 */
const runWhisper = (
    wavPath: string,
    outputDir: string,
    outputName: string,
    onProgress: ProgressCallback
): Promise<string | null> => {
    return new Promise((resolve) => {
        const whisperPath = getWhisperPath('gpu');
        const modelPath = getWhisperTurboModelPath();

        // whisper-cli outputs files as <output_file>.srt
        const outputBase = path.join(outputDir, outputName);

        const args = [
            '-m', modelPath,
            '-f', wavPath,
            '-osrt',                // Output SRT format
            '-of', outputBase,      // Output file base name (whisper adds .srt)
            '-l', 'auto',           // Auto-detect language
            '--print-progress',     // Print progress
        ];

        console.log('Running whisper:', whisperPath, args.join(' '));

        const proc = spawn(whisperPath, args, {
            cwd: path.dirname(whisperPath)
        });

        let lastProgress = 0;

        proc.stderr.on('data', (data) => {
            const text = data.toString();
            console.log('[whisper stderr]', text);

            // Parse progress: whisper.cpp prints "whisper_full_with_state: progress =  XX%"
            const progressMatch = text.match(/progress\s*=\s*(\d+)%/);
            if (progressMatch) {
                const pct = parseInt(progressMatch[1], 10);
                if (pct > lastProgress) {
                    lastProgress = pct;
                    onProgress({
                        status: 'transcribing',
                        progress: 30 + pct * 0.7, // 30-100% range
                        detail: `Đang chuyển đổi giọng nói... ${pct}%`
                    });
                }
            }
        });

        proc.stdout.on('data', (data) => {
            const text = data.toString();
            console.log('[whisper stdout]', text);

            const progressMatch = text.match(/progress\s*=\s*(\d+)%/);
            if (progressMatch) {
                const pct = parseInt(progressMatch[1], 10);
                if (pct > lastProgress) {
                    lastProgress = pct;
                    onProgress({
                        status: 'transcribing',
                        progress: 30 + pct * 0.7,
                        detail: `Đang chuyển đổi giọng nói... ${pct}%`
                    });
                }
            }
        });

        proc.on('close', (code) => {
            console.log('Whisper finished, exit code:', code);
            const srtPath = outputBase + '.srt';
            if (code === 0 && fs.existsSync(srtPath)) {
                resolve(srtPath);
            } else {
                console.error('Whisper failed or SRT not found. Code:', code, 'Expected:', srtPath);
                resolve(null);
            }
        });

        proc.on('error', (err) => {
            console.error('Whisper spawn error:', err);
            resolve(null);
        });
    });
};

/**
 * Find the audio file in the project's original/audio directory
 */
const findAudioFile = (projectPath: string, videoId?: string): string | null => {
    const audioDir = path.join(projectPath, 'original', 'audio');
    if (!fs.existsSync(audioDir)) return null;

    const files = fs.readdirSync(audioDir);
    let audioFile = null;

    if (videoId) {
        audioFile = files.find(f => f.startsWith(videoId) && (
            f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav') ||
            f.endsWith('.opus') || f.endsWith('.ogg') || f.endsWith('.webm')
        ));
    }

    if (!audioFile) {
        audioFile = files.find(f =>
            f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav') ||
            f.endsWith('.opus') || f.endsWith('.ogg') || f.endsWith('.webm')
        );
    }

    if (audioFile) {
        return path.join(audioDir, audioFile);
    }
    return null;
};

/**
 * Main transcription function:
 * 1. Check and download whisper engine if needed
 * 2. Find audio file in project
 * 3. Convert to WAV (16kHz mono)
 * 4. Run whisper.cpp to generate SRT
 * 5. Return SRT content
 */
export const transcribeAudio = async (
    projectPath: string,
    videoId: string,
    onProgress: ProgressCallback
): Promise<{ srtPath: string; srtContent: string } | null> => {
    try {
        // AssemblyAI placeholder

        // Step 0: Auto-download engine if needed
        if (!isWhisperEngineReady('gpu')) {
            onProgress({ status: 'downloading', progress: 0, detail: `Cần tải Whisper GPU...` });
            const downloaded = await downloadWhisperEngine('gpu', (p) => {
                onProgress({
                    status: 'downloading',
                    progress: p.progress * 0.15, // Map 0-100 → 0-15
                    detail: p.detail
                });
            });
            if (!downloaded) {
                onProgress({ status: 'error', progress: 0, detail: 'Không thể tải Whisper engine!' });
                return null;
            }
        }

        // Step 1: Find audio file
        onProgress({ status: 'preparing', progress: 15, detail: 'Đang tìm file âm thanh...' });
        const audioFile = findAudioFile(projectPath, videoId);
        if (!audioFile) {
            onProgress({ status: 'error', progress: 0, detail: 'Không tìm thấy file âm thanh trong project!' });
            return null;
        }
        console.log('Found audio file:', audioFile);
        onProgress({ status: 'preparing', progress: 18, detail: `Đã tìm thấy: ${path.basename(audioFile)}` });

        // Step 2: Convert to WAV
        const transcriptDir = path.join(projectPath, 'transcript');
        if (!fs.existsSync(transcriptDir)) {
            fs.mkdirSync(transcriptDir, { recursive: true });
        }

        const wavPath = path.join(transcriptDir, `${videoId}_16k.wav`);

        // Always re-convert to ensure we use the latest audio file (don't cache WAV by videoId)
        onProgress({ status: 'converting', progress: 20, detail: 'Đang chuyển đổi âm thanh sang định dạng WAV...' });
        const ffmpegPath = getFfmpegPath();
        const converted = await convertToWav(audioFile, wavPath, ffmpegPath);
        if (!converted) {
            onProgress({ status: 'error', progress: 20, detail: 'Lỗi chuyển đổi âm thanh!' });
            return null;
        }

        onProgress({ status: 'converting', progress: 30, detail: 'Chuyển đổi âm thanh hoàn tất!' });

        // Step 3: Run whisper
        onProgress({ status: 'transcribing', progress: 30, detail: 'Bắt đầu nhận dạng giọng nói...' });

        const srtPath = await runWhisper(wavPath, transcriptDir, videoId, onProgress);

        if (!srtPath) {
            onProgress({ status: 'error', progress: 0, detail: 'Nhận dạng giọng nói thất bại!' });
            return null;
        }

        // Step 4: Optimize SRT — re-segment at sentence boundaries
        onProgress({ status: 'transcribing', progress: 95, detail: 'Đang tối ưu phụ đề...' });
        const srtContent = optimizeSrtFile(srtPath);
        console.log('SRT optimized:', srtPath);

        onProgress({ status: 'done', progress: 100, detail: 'Hoàn thành nhận dạng giọng nói!' });

        return { srtPath, srtContent };

    } catch (error) {
        console.error('Transcription failed:', error);
        onProgress({ status: 'error', progress: 0, detail: `Lỗi: ${error}` });
        return null;
    }
};

/**
 * Read existing SRT file if already transcribed
 */
export const getExistingSrt = (projectPath: string, videoId: string): { srtPath: string; srtContent: string } | null => {
    const transcriptDir = path.join(projectPath, 'transcript');
    if (!fs.existsSync(transcriptDir)) return null;

    const srtPath = path.join(transcriptDir, `${videoId}.srt`);

    if (fs.existsSync(srtPath)) {
        const srtContent = fs.readFileSync(srtPath, 'utf-8');
        return { srtPath, srtContent };
    }

    return null;
};
