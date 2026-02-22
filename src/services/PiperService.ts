import path from 'path';
import fs from 'fs';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// Edge TTS voice mapping: lang code -> voice name
export interface VoiceConfig {
    voice: string;
    label: string;
}

export const VOICE_MAP: Record<string, VoiceConfig> = {
    vi: { voice: 'vi-VN-NamMinhNeural', label: '🇻🇳 Tiếng Việt - NamMinh' },
    zh: { voice: 'zh-CN-XiaoxiaoNeural', label: '🇨🇳 中文 - Xiaoxiao' },
    ja: { voice: 'ja-JP-NanamiNeural', label: '🇯🇵 日本語 - Nanami' },
    ko: { voice: 'ko-KR-SunHiNeural', label: '🇰🇷 한국어 - SunHi' },
    fr: { voice: 'fr-FR-DeniseNeural', label: '🇫🇷 Français - Denise' },
    de: { voice: 'de-DE-KatjaNeural', label: '🇩🇪 Deutsch - Katja' },
    es: { voice: 'es-ES-ElviraNeural', label: '🇪🇸 Español - Elvira' },
    pt: { voice: 'pt-BR-FranciscaNeural', label: '🇧🇷 Português - Francisca' },
    ru: { voice: 'ru-RU-SvetlanaNeural', label: '🇷🇺 Русский - Svetlana' },
    en: { voice: 'en-US-JennyNeural', label: '🇺🇸 English - Jenny' },
    th: { voice: 'th-TH-PremwadeeNeural', label: '🇹🇭 ภาษาไทย - Premwadee' },
};

export interface EdgeVoice {
    Name: string;
    ShortName: string;
    Gender: string;
    Locale: string;
    SuggestedCodec: string;
    FriendlyName: string;
    Status: string;
    VoiceTag: {
        ContentCategories: string[];
        VoicePersonalities: string[];
    };
}

export const getEdgeVoices = async (): Promise<EdgeVoice[]> => {
    try {
        const tts = new MsEdgeTTS();
        const voices = await tts.getVoices();
        return voices as EdgeVoice[];
    } catch (err) {
        console.error("Failed to get Edge TTS voices:", err);
        return [];
    }
};

export const previewEdgeVoice = async (voiceName: string, text: string, outputPath: string): Promise<boolean> => {
    return generateAudioSegment(text, voiceName, outputPath);
};

export interface TTSProgress {
    status: 'generating' | 'done' | 'error';
    progress: number;
    detail: string;
    current?: number;
    total?: number;
    entryIndex?: number;
    entryStatus?: 'start' | 'done' | 'failed';
}

const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

/**
 * Generate audio for a single text segment using Edge TTS.
 * Uses toStream() and writes directly to the target path for precise control.
 */
export const generateAudioSegment = async (
    text: string,
    voiceName: string,
    outputPath: string
): Promise<boolean> => {
    const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleanText) {
        console.log(`Skipping empty text for ${outputPath}`);
        return false;
    }

    try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

        const { audioStream } = tts.toStream(cleanText);

        return new Promise<boolean>((resolve) => {
            const writeStream = fs.createWriteStream(outputPath);
            let hasData = false;

            audioStream.on('data', (chunk: Buffer) => {
                hasData = true;
                writeStream.write(chunk);
            });

            audioStream.on('end', () => {
                writeStream.end(() => {
                    tts.close();
                    if (hasData && fs.existsSync(outputPath)) {
                        const stat = fs.statSync(outputPath);
                        if (stat.size > 0) {
                            resolve(true);
                        } else {
                            fs.unlinkSync(outputPath);
                            resolve(false);
                        }
                    } else {
                        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        resolve(false);
                    }
                });
            });

            audioStream.on('error', (err: Error) => {
                console.error(`Edge TTS stream error for ${outputPath}:`, err);
                writeStream.end(() => {
                    tts.close();
                    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                    resolve(false);
                });
            });
        });
    } catch (err) {
        console.error(`Edge TTS error for ${outputPath}:`, err);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        return false;
    }
};

/**
 * Generate audio for all SRT entries SEQUENTIALLY (one by one, in order).
 */
export const generateAllAudio = async (
    entries: { index: number; text: string }[],
    langCode: string,
    outputDir: string,
    onProgress: (p: TTSProgress) => void,
    concurrency: number = 1,
    customVoiceName?: string
): Promise<string[]> => {
    ensureDir(outputDir);

    const voiceName = customVoiceName || (VOICE_MAP[langCode] ? VOICE_MAP[langCode].voice : null);
    if (!voiceName) {
        onProgress({ status: 'error', progress: 0, detail: `Không hỗ trợ ngôn ngữ/giọng đọc: ${langCode}` });
        return [];
    }

    const results: string[] = new Array(entries.length).fill('');

    for (let i = 0; i < entries.length; i++) {
        // Just queue them up
    }

    let completedCount = 0;
    const queue = entries.map((entry, idx) => ({ entry, idx }));
    const activeWorkers: Promise<void>[] = [];

    const processItem = async (entry: { index: number; text: string }, i: number): Promise<void> => {
        const fileName = `${String(entry.index).padStart(4, '0')}.mp3`;
        const outputPath = path.join(outputDir, fileName);

        // Notify: starting this entry
        onProgress({
            status: 'generating',
            progress: Math.round((completedCount / entries.length) * 100),
            detail: `Đang tạo audio... ${completedCount + 1}/${entries.length}`,
            current: completedCount + 1,
            total: entries.length,
            entryIndex: entry.index,
            entryStatus: 'start',
        });

        const success = await generateAudioSegment(entry.text, voiceName, outputPath);

        if (success) {
            results[i] = outputPath;
        }

        completedCount++;

        // Notify: this entry done/failed
        onProgress({
            status: 'generating',
            progress: Math.round((completedCount / entries.length) * 100),
            detail: `Đang tạo audio... ${completedCount}/${entries.length}`,
            current: completedCount,
            total: entries.length,
            entryIndex: entry.index,
            entryStatus: success ? 'done' : 'failed',
        });
    };

    while (queue.length > 0 || activeWorkers.length > 0) {
        while (queue.length > 0 && activeWorkers.length < concurrency) {
            const item = queue.shift()!;
            const worker = processItem(item.entry, item.idx).then(() => {
                activeWorkers.splice(activeWorkers.indexOf(worker), 1);
            });
            activeWorkers.push(worker);
        }
        if (activeWorkers.length > 0) {
            await Promise.race(activeWorkers);
        }
    }

    return results;
};
