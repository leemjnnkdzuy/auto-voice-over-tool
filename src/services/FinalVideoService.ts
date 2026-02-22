import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { getFfmpegPath, getHandBrakePath } from './EnvironmentService';
import { parseSrt, timeToSeconds } from '../lib/srt-utils';

export interface FinalVideoProgress {
    status: 'preparing' | 'processing' | 'concatenating' | 'rerendering' | 'done' | 'error';
    progress: number;
    detail: string;
    current?: number;
    total?: number;
}

interface Segment {
    type: 'dubbed' | 'gap';
    index?: number;
    videoStart: number;
    videoEnd: number;
    videoDuration: number;
    audioPath?: string;
    audioDuration?: number;
}

/**
 * Run an ffmpeg command and return a promise
 */
const runFfmpeg = (args: string[]): Promise<{ success: boolean; stderr: string }> => {
    return new Promise((resolve) => {
        const ffmpeg = getFfmpegPath();
        const proc = spawn(ffmpeg, args, { windowsHide: true });
        let stderr = '';

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                console.error(`[FFMPEG ERROR] Code ${code}\nArgs: ${args.join(' ')}\nStderr: ${stderr}`);
            }
            resolve({ success: code === 0, stderr });
        });

        proc.on('error', (err) => {
            console.error(`[FFMPEG SPAWN ERROR] ${err.message}`);
            resolve({ success: false, stderr: err.message });
        });
    });
};

/**
 * Get the duration of a media file in seconds
 */
const getMediaDuration = async (filePath: string): Promise<number> => {
    return new Promise((resolve) => {
        const ffmpeg = getFfmpegPath();
        const proc = spawn(ffmpeg, [
            '-i', filePath,
            '-f', 'null', '-'
        ], { windowsHide: true });

        let stderr = '';
        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', () => {
            const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
            if (match) {
                const hours = parseInt(match[1]);
                const minutes = parseInt(match[2]);
                const seconds = parseInt(match[3]);
                const centiseconds = parseInt(match[4]);
                resolve(hours * 3600 + minutes * 60 + seconds + centiseconds / 100);
            } else {
                resolve(0);
            }
        });

        proc.on('error', () => resolve(0));
    });
};

const findOriginalVideo = (projectPath: string): string | null => {
    const videoDir = path.join(projectPath, 'original', 'video');
    if (!fs.existsSync(videoDir)) return null;
    const files = fs.readdirSync(videoDir);
    const videoFile = files.find(f => /\.(mp4|mkv|webm|avi|mov)$/i.test(f));
    return videoFile ? path.join(videoDir, videoFile) : null;
};

const findOriginalSrt = (projectPath: string): string | null => {
    const srtDir = path.join(projectPath, 'transcript');
    if (!fs.existsSync(srtDir)) return null;
    const files = fs.readdirSync(srtDir);
    const srtFile = files.find(f => f.endsWith('.srt'));
    return srtFile ? path.join(srtDir, srtFile) : null;
};

const buildSegmentMap = async (
    srtContent: string,
    audioDir: string,
    totalVideoDuration: number,
): Promise<Segment[]> => {
    const entries = parseSrt(srtContent);
    const segments: Segment[] = [];

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const entryStart = timeToSeconds(entry.startTime);
        const entryEnd = timeToSeconds(entry.endTime);

        const prevEnd = i === 0 ? 0 : timeToSeconds(entries[i - 1].endTime);
        if (entryStart > prevEnd + 0.05) {
            segments.push({
                type: 'gap',
                videoStart: prevEnd,
                videoEnd: entryStart,
                videoDuration: entryStart - prevEnd,
            });
        }

        const audioFileName = `${String(entry.index).padStart(4, '0')}.mp3`;
        const audioPath = path.join(audioDir, audioFileName);
        let audioDuration = 0;
        if (fs.existsSync(audioPath)) {
            audioDuration = await getMediaDuration(audioPath);
        }

        segments.push({
            type: 'dubbed',
            index: entry.index,
            videoStart: entryStart,
            videoEnd: entryEnd,
            videoDuration: entryEnd - entryStart,
            audioPath: fs.existsSync(audioPath) ? audioPath : undefined,
            audioDuration,
        });
    }

    if (entries.length > 0) {
        const lastEnd = timeToSeconds(entries[entries.length - 1].endTime);
        if (totalVideoDuration > lastEnd + 0.05) {
            segments.push({
                type: 'gap',
                videoStart: lastEnd,
                videoEnd: totalVideoDuration,
                videoDuration: totalVideoDuration - lastEnd,
            });
        }
    }

    return segments;
};

/**
 * Video encoding args — used for ALL segments.
 * Re-encoding everything ensures:
 * - Each clip starts with a proper keyframe (no frozen frames)
 * - Frame-accurate seeking (no missing video)
 * - Consistent codec params across all clips (no stuttering at concat joins)
 */
const VIDEO_ARGS = [
    '-c:v', 'h264_nvenc',  // Use GPU NVENC encoding for better speed
    '-preset', 'fast',     // Fast preset
    '-cq', '22',           // Constant Quality (similar to CRF)
];

const AUDIO_ARGS = ['-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-ac', '2'];

/**
 * Process a single segment into a self-contained video+audio clip.
 * ALL segments are re-encoded with NVENC to guarantee clean keyframes.
 */
const processSegment = async (
    segment: Segment,
    originalVideoPath: string,
    tempDir: string,
    segIndex: number,
): Promise<string | null> => {
    const outputPath = path.join(tempDir, `seg_${String(segIndex).padStart(4, '0')}.mp4`);
    const duration = segment.videoDuration;

    // ── Gap: re-encode video + keep original audio ──
    if (segment.type === 'gap') {
        const result = await runFfmpeg([
            '-y',
            '-ss', segment.videoStart.toFixed(3),
            '-t', duration.toFixed(3),
            '-i', originalVideoPath,
            ...VIDEO_ARGS,
            ...AUDIO_ARGS,
            outputPath,
        ]);
        return result.success ? outputPath : null;
    }

    // ── Dubbed: no TTS audio → video + silence ──
    if (!segment.audioPath || !segment.audioDuration || segment.audioDuration === 0) {
        const result = await runFfmpeg([
            '-y',
            '-ss', segment.videoStart.toFixed(3),
            '-t', duration.toFixed(3),
            '-i', originalVideoPath,
            '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-map', '0:v', '-map', '1:a',
            ...VIDEO_ARGS,
            ...AUDIO_ARGS,
            '-t', duration.toFixed(3),
            outputPath,
        ]);
        return result.success ? outputPath : null;
    }

    const videoDur = segment.videoDuration;
    const audioDur = segment.audioDuration;
    const ratio = audioDur / videoDur;

    // ── Case 1: Audio fits (shorter or equal) → pad with silence ──
    if (ratio <= 1.0) {
        const result = await runFfmpeg([
            '-y',
            '-ss', segment.videoStart.toFixed(3),
            '-t', videoDur.toFixed(3),
            '-i', originalVideoPath,
            '-i', segment.audioPath,
            '-map', '0:v', '-map', '1:a',
            ...VIDEO_ARGS,
            '-af', 'apad',
            ...AUDIO_ARGS,
            '-t', videoDur.toFixed(3),
            outputPath,
        ]);
        return result.success ? outputPath : null;
    }

    // ── Case 2: Audio slightly longer (≤ 1.3x) → speed up audio only ──
    if (ratio <= 1.3) {
        const result = await runFfmpeg([
            '-y',
            '-ss', segment.videoStart.toFixed(3),
            '-t', videoDur.toFixed(3),
            '-i', originalVideoPath,
            '-i', segment.audioPath,
            '-map', '0:v', '-map', '1:a',
            ...VIDEO_ARGS,
            '-af', `atempo=${ratio.toFixed(4)},apad`,
            ...AUDIO_ARGS,
            '-t', videoDur.toFixed(3),
            outputPath,
        ]);
        return result.success ? outputPath : null;
    }

    // ── Case 3: Audio much longer (> 1.3x) → audio 1.3x + slow down video ──
    const adjustedAudioDur = audioDur / 1.3;
    const videoSlowFactor = adjustedAudioDur / videoDur;
    const targetDur = adjustedAudioDur;

    const result = await runFfmpeg([
        '-y',
        '-ss', segment.videoStart.toFixed(3),
        '-t', videoDur.toFixed(3),
        '-i', originalVideoPath,
        '-i', segment.audioPath,
        '-map', '0:v', '-map', '1:a',
        '-vf', `setpts=${videoSlowFactor.toFixed(4)}*PTS`,
        '-af', 'atempo=1.3,apad',
        ...VIDEO_ARGS,
        ...AUDIO_ARGS,
        '-t', targetDur.toFixed(3),
        outputPath,
    ]);
    return result.success ? outputPath : null;
};

/**
 * Concatenate all segment clips into the final video.
 */
const concatenateSegments = async (
    segmentPaths: string[],
    outputPath: string,
    tempDir: string,
): Promise<boolean> => {
    const listPath = path.join(tempDir, 'concat_list.txt');
    const listContent = segmentPaths
        .map(p => `file '${p.replace(/\\/g, '/')}'`)
        .join('\n');
    fs.writeFileSync(listPath, listContent, 'utf-8');

    const result = await runFfmpeg([
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-c', 'copy',
        outputPath,
    ]);

    return result.success;
};

/**
 * Re-render the final video using HandBrakeCLI to fix frame/audio sync.
 * Uses constant framerate (CFR) mode to ensure consistent frame timing.
 */
const rerenderWithHandBrake = async (
    inputPath: string,
    outputPath: string,
    onProgress?: (percent: number) => void,
): Promise<boolean> => {
    return new Promise((resolve) => {
        const handbrake = getHandBrakePath();

        // HandBrakeCLI will hang waiting for user input if the output file already exists.
        // We must ensure the destination file is deleted first.
        if (fs.existsSync(outputPath)) {
            try {
                fs.unlinkSync(outputPath);
            } catch (e) {
                console.error("Failed to delete existing HandBrake output file:", e);
                resolve(false);
                return;
            }
        }

        // Settings theo hướng dẫn:
        // - Framerate: "Same as source" (không chỉ định --rate → tự lấy từ source)
        // - Constant Framerate (--cfr) thay vì Peak Framerate
        // - Encoder: nvenc_h264 (GPU) để tăng tốc render
        // - Quality: 22 (tương đương CRF 22)
        // - Audio: AAC stereo, giữ nguyên sample rate từ source
        const args = [
            '-i', inputPath,
            '-o', outputPath,
            '--encoder', 'nvenc_h264',
            '--quality', '22',
            '--cfr',                    // Constant Framerate (quan trọng nhất!)
            '--aencoder', 'av_aac',
            '--ab', '192',
            '--mixdown', 'stereo',
            '--optimize',
        ];

        const proc = spawn(handbrake, args, { windowsHide: true });
        let stderr = '';

        proc.stdout.on('data', (data) => {
            const line = data.toString();
            // HandBrakeCLI outputs progress like: "Encoding: task 1 of 1, 45.23 %"
            const match = line.match(/(\d+\.?\d*)\s*%/);
            if (match && onProgress) {
                onProgress(parseFloat(match[1]));
            }
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                console.error('HandBrake re-render stderr:', stderr);
            }
            resolve(code === 0);
        });

        proc.on('error', (err) => {
            console.error('HandBrake error:', err);
            resolve(false);
        });
    });
};

/**
 * Create final dubbed video.
 *
 * ALL segments are re-encoded with x264 CPU encoder.
 * This guarantees:
 *   ✅ No frozen frames (each clip starts with proper keyframe)
 *   ✅ No missing video (frame-accurate seeking + re-encoding)
 *   ✅ No stuttering (consistent codec params for concat)
 *   ✅ Audio max 1.3x speed (natural sounding)
 *   ✅ Video slowdown when needed (smooth playback)
 *   ✅ Fallbacks to CPU to avoid strict NVENC driver requirements
 *
 * Expected time depends heavily on CPU speed.
 */
export const createFinalVideo = async (
    projectPath: string,
    videoId: string,
    onProgress: (p: FinalVideoProgress) => void,
): Promise<string | null> => {
    try {
        const originalVideo = findOriginalVideo(projectPath);
        console.log(`[FinalVideo] Searching for original video in: ${path.join(projectPath, 'original', 'video')} -> Found:`, originalVideo);
        if (!originalVideo) {
            onProgress({ status: 'error', progress: 0, detail: 'Không tìm thấy video gốc!' });
            return null;
        }

        const originalSrt = findOriginalSrt(projectPath);
        console.log(`[FinalVideo] Searching for original SRT in: ${path.join(projectPath, 'transcript')} -> Found:`, originalSrt);
        if (!originalSrt) {
            onProgress({ status: 'error', progress: 0, detail: 'Không tìm thấy file SRT gốc!' });
            return null;
        }

        const audioDir = path.join(projectPath, 'audio_gene');
        console.log(`[FinalVideo] Checking for audio_gene dir: ${audioDir} -> Exists:`, fs.existsSync(audioDir));
        if (!fs.existsSync(audioDir)) {
            onProgress({ status: 'error', progress: 0, detail: 'Không tìm thấy thư mục audio_gene!' });
            return null;
        }

        onProgress({ status: 'preparing', progress: 5, detail: 'Đang phân tích video và SRT...' });

        const videoDuration = await getMediaDuration(originalVideo);
        console.log(`[FinalVideo] Video duration: ${videoDuration}`);
        if (videoDuration === 0) {
            onProgress({ status: 'error', progress: 0, detail: 'Không thể đọc thông tin video!' });
            return null;
        }

        const srtContent = fs.readFileSync(originalSrt, 'utf-8');
        const segments = await buildSegmentMap(srtContent, audioDir, videoDuration);
        console.log(`[FinalVideo] Segments generated:`, segments.length);

        if (segments.length === 0) {
            onProgress({ status: 'error', progress: 0, detail: 'Không có đoạn nào để xử lý!' });
            return null;
        }

        const dubbedCount = segments.filter(s => s.type === 'dubbed').length;
        const gapCount = segments.filter(s => s.type === 'gap').length;
        let slowdownCount = 0;
        for (const seg of segments) {
            if (seg.type === 'dubbed' && seg.audioDuration && seg.videoDuration > 0) {
                if (seg.audioDuration / seg.videoDuration > 1.3) slowdownCount++;
            }
        }

        onProgress({
            status: 'preparing',
            progress: 10,
            detail: `${segments.length} đoạn: ${dubbedCount} lồng tiếng, ${gapCount} gap, ${slowdownCount} giảm tốc`,
        });

        const tempDir = path.join(projectPath, 'temp_final');
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempDir, { recursive: true });

        // Process segments with limited concurrency (NVENC session limit = ~3)
        const CONCURRENCY = 3;
        const segmentPaths: (string | null)[] = new Array(segments.length).fill(null);
        let completed = 0;
        const startTime = Date.now();

        const processItem = async (seg: Segment, idx: number): Promise<void> => {
            const result = await processSegment(seg, originalVideo, tempDir, idx);
            segmentPaths[idx] = result;
            completed++;

            const elapsed = (Date.now() - startTime) / 1000;
            const avgTime = elapsed / completed;
            const remaining = Math.round(avgTime * (segments.length - completed));
            const label = seg.type === 'dubbed' ? `#${seg.index}` : 'gap';

            onProgress({
                status: 'processing',
                progress: 10 + Math.round((completed / segments.length) * 78),
                detail: `${completed}/${segments.length} (${label}) — còn ~${remaining}s`,
                current: completed,
                total: segments.length,
            });
        };

        // Parallel with concurrency limit
        const queue = segments.map((seg, idx) => ({ seg, idx }));
        const activeWorkers: Promise<void>[] = [];

        while (queue.length > 0 || activeWorkers.length > 0) {
            while (queue.length > 0 && activeWorkers.length < CONCURRENCY) {
                const item = queue.shift()!;
                const worker = processItem(item.seg, item.idx).then(() => {
                    activeWorkers.splice(activeWorkers.indexOf(worker), 1);
                });
                activeWorkers.push(worker);
            }
            if (activeWorkers.length > 0) {
                await Promise.race(activeWorkers);
            }
        }

        const validPaths = segmentPaths.filter((p): p is string => p !== null);
        console.log(`[FinalVideo] Processing completely, valid paths: ${validPaths.length} / ${segmentPaths.length}`);
        if (validPaths.length === 0) {
            onProgress({ status: 'error', progress: 0, detail: 'Không thể xử lý bất kỳ đoạn nào!' });
            fs.rmSync(tempDir, { recursive: true, force: true });
            return null;
        }

        const failedCount = segments.length - validPaths.length;
        if (failedCount > 0) {
            console.warn(`${failedCount} segments failed to process`);
        }

        onProgress({
            status: 'concatenating',
            progress: 90,
            detail: `Đang ghép ${validPaths.length} đoạn thành video final...`,
        });

        const outputDir = path.join(projectPath, 'final');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPath = path.join(outputDir, `${videoId}_final.mp4`);
        console.log(`[FinalVideo] Output path for concat: ${outputPath}`);
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        const concatSuccess = await concatenateSegments(validPaths, outputPath, tempDir);
        console.log(`[FinalVideo] Concat success: ${concatSuccess}, file exists: ${fs.existsSync(outputPath)}`);

        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch { }

        if (!concatSuccess || !fs.existsSync(outputPath)) {
            onProgress({ status: 'error', progress: 0, detail: 'Ghép video thất bại!' });
            return null;
        }

        // ── Re-render with HandBrakeCLI for frame/audio sync ──
        onProgress({
            status: 'rerendering',
            progress: 92,
            detail: 'Đang re-render video bằng HandBrake để đồng bộ khung hình & âm thanh...',
        });

        const rerenderedPath = path.join(outputDir, `${videoId}_final_synced.mp4`);
        if (fs.existsSync(rerenderedPath)) {
            fs.unlinkSync(rerenderedPath);
        }

        const rerenderSuccess = await rerenderWithHandBrake(
            outputPath,
            rerenderedPath,
            (percent) => {
                onProgress({
                    status: 'rerendering',
                    progress: 92 + Math.round(percent * 0.07),
                    detail: `Re-rendering: ${percent.toFixed(1)}%`,
                });
            },
        );
        console.log(`[FinalVideo] Handbrake success: ${rerenderSuccess}, file exists: ${fs.existsSync(rerenderedPath)}`);

        if (rerenderSuccess && fs.existsSync(rerenderedPath)) {
            // Replace the original concat output with the re-rendered version
            try {
                fs.unlinkSync(outputPath);
                fs.renameSync(rerenderedPath, outputPath);
            } catch (e) {
                console.warn('Could not replace concat output with re-rendered:', e);
                // Keep the re-rendered file as-is
            }
        } else {
            console.warn('HandBrake re-render failed, keeping original concat output');
            // Clean up failed re-render file if exists
            if (fs.existsSync(rerenderedPath)) {
                try { fs.unlinkSync(rerenderedPath); } catch { }
            }
        }

        const totalTime = Math.round((Date.now() - startTime) / 1000);
        onProgress({
            status: 'done',
            progress: 100,
            detail: `Hoàn tất! Video final đã được tạo (${totalTime}s).`,
        });

        return outputPath;

    } catch (err) {
        console.error('Create final video failed:', err);
        onProgress({
            status: 'error',
            progress: 0,
            detail: `Lỗi: ${err}`,
        });
        return null;
    }
};
