import fs from 'fs';

interface SrtSegment {
    index: number;
    startTime: string;  // "HH:MM:SS,mmm"
    endTime: string;
    text: string;
}

/**
 * Parse SRT timestamp to milliseconds
 */
const timeToMs = (time: string): number => {
    const match = time.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) return 0;
    const [, h, m, s, ms] = match;
    return parseInt(h) * 3600000 + parseInt(m) * 60000 + parseInt(s) * 1000 + parseInt(ms);
};

/**
 * Convert milliseconds to SRT timestamp format
 */
const msToTime = (ms: number): string => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const msPart = ms % 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(msPart).padStart(3, '0')}`;
};

/**
 * Parse an SRT file content into segments
 */
const parseSrtContent = (content: string): SrtSegment[] => {
    const segments: SrtSegment[] = [];
    const blocks = content.trim().split(/\r?\n\r?\n/);

    for (const block of blocks) {
        const lines = block.trim().split(/\r?\n/);
        if (lines.length < 3) continue;

        const index = parseInt(lines[0]);
        if (isNaN(index)) continue;

        const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
        if (!timeMatch) continue;

        const text = lines.slice(2).join(' ').trim();

        segments.push({
            index,
            startTime: timeMatch[1],
            endTime: timeMatch[2],
            text,
        });
    }

    return segments;
};

/**
 * Check if a character position is at a sentence boundary
 */
const isSentenceEnd = (text: string, pos: number): boolean => {
    if (pos < 0 || pos >= text.length) return false;
    const char = text[pos];
    if (char === '.' || char === '!' || char === '?') {
        const nextChar = pos + 1 < text.length ? text[pos + 1] : ' ';
        const nextNextChar = pos + 2 < text.length ? text[pos + 2] : '';
        if (nextChar === ' ' && (nextNextChar === '' || /[A-Z"'\u201C\u201D]/.test(nextNextChar))) {
            return true;
        }
        if (pos === text.length - 1) return true;
    }
    return false;
};

/**
 * Interpolate a timestamp within a segment based on character position
 * Uses linear interpolation between start and end times
 */
const interpolateTime = (startMs: number, endMs: number, charPos: number, totalChars: number): number => {
    if (totalChars <= 0) return startMs;
    const ratio = Math.min(charPos / totalChars, 1.0);
    return Math.round(startMs + (endMs - startMs) * ratio);
};

const MAX_SEGMENT_DURATION_MS = 12000;
const MIN_SEGMENT_DURATION_MS = 1500;

/**
 * Optimize SRT segments by re-splitting at sentence boundaries.
 * 
 * Strategy:
 * 1. Merge all segments into a continuous stream with character-level timing
 * 2. Find sentence boundaries in the merged text
 * 3. Create new segments that align with sentence boundaries
 * 4. If a sentence is too long, split at comma/conjunction boundaries
 */
export const optimizeSrt = (srtContent: string): string => {
    const originalSegments = parseSrtContent(srtContent);
    if (originalSegments.length === 0) return srtContent;

    interface CharTimeInfo {
        char: string;
        timeMs: number;
    }

    const charTimeline: CharTimeInfo[] = [];

    for (const seg of originalSegments) {
        const startMs = timeToMs(seg.startTime);
        const endMs = timeToMs(seg.endTime);
        const text = seg.text.trim();

        for (let i = 0; i < text.length; i++) {
            charTimeline.push({
                char: text[i],
                timeMs: interpolateTime(startMs, endMs, i, text.length),
            });
        }

        if (charTimeline.length > 0) {
            const lastTime = charTimeline[charTimeline.length - 1].timeMs;
            charTimeline.push({ char: ' ', timeMs: lastTime });
        }
    }

    if (charTimeline.length === 0) return srtContent;

    const fullText = charTimeline.map(c => c.char).join('');

    const splitPoints: number[] = []; // character indices where we should split (after this index)

    for (let i = 0; i < fullText.length; i++) {
        if (isSentenceEnd(fullText, i)) {
            splitPoints.push(i + 1); // Split after the punctuation + the space
        }
    }

    interface TextSpan {
        startIdx: number;
        endIdx: number;
        text: string;
        startMs: number;
        endMs: number;
    }

    const sentenceSpans: TextSpan[] = [];
    let lastSplit = 0;

    for (const splitIdx of splitPoints) {
        let actualEnd = splitIdx;
        while (actualEnd < fullText.length && fullText[actualEnd] === ' ') {
            actualEnd++;
        }

        if (actualEnd > lastSplit) {
            const text = fullText.substring(lastSplit, splitIdx).trim();
            if (text.length > 0) {
                sentenceSpans.push({
                    startIdx: lastSplit,
                    endIdx: splitIdx - 1,
                    text,
                    startMs: charTimeline[lastSplit]?.timeMs || 0,
                    endMs: charTimeline[Math.min(splitIdx - 1, charTimeline.length - 1)]?.timeMs || 0,
                });
            }
        }
        lastSplit = actualEnd;
    }

    if (lastSplit < fullText.length) {
        const text = fullText.substring(lastSplit).trim();
        if (text.length > 0) {
            sentenceSpans.push({
                startIdx: lastSplit,
                endIdx: fullText.length - 1,
                text,
                startMs: charTimeline[lastSplit]?.timeMs || 0,
                endMs: charTimeline[charTimeline.length - 1]?.timeMs || 0,
            });
        }
    }

    const finalSpans: TextSpan[] = [];

    for (const span of sentenceSpans) {
        const duration = span.endMs - span.startMs;

        if (duration <= MAX_SEGMENT_DURATION_MS) {
            finalSpans.push(span);
            continue;
        }

        const subSplitPoints: number[] = [];
        const text = fullText.substring(span.startIdx, span.endIdx + 1);

        for (let i = 0; i < text.length; i++) {
            const globalIdx = span.startIdx + i;
            const char = text[i];

            if (char === ',' && i + 1 < text.length && text[i + 1] === ' ') {
                const posMs = charTimeline[globalIdx]?.timeMs || 0;
                const durationFromStart = posMs - span.startMs;
                if (durationFromStart >= MIN_SEGMENT_DURATION_MS) {
                    subSplitPoints.push(i + 1); // After comma
                }
            }
        }

        if (subSplitPoints.length === 0) {
            finalSpans.push(span);
            continue;
        }

        let subLastSplit = 0;
        for (const subSplit of subSplitPoints) {
            const subText = text.substring(subLastSplit, subSplit + 1).trim();
            const subStartIdx = span.startIdx + subLastSplit;
            const subEndIdx = span.startIdx + subSplit;

            if (subText.length > 0) {
                const subStartMs = charTimeline[subStartIdx]?.timeMs || 0;
                const subEndMs = charTimeline[subEndIdx]?.timeMs || 0;
                const subDuration = subEndMs - subStartMs;

                if (subDuration >= MIN_SEGMENT_DURATION_MS || finalSpans.length === 0) {
                    finalSpans.push({
                        startIdx: subStartIdx,
                        endIdx: subEndIdx,
                        text: subText,
                        startMs: subStartMs,
                        endMs: subEndMs,
                    });
                    subLastSplit = subSplit + 1;
                }
            }
        }

        if (subLastSplit < text.length) {
            const remainText = text.substring(subLastSplit).trim();
            if (remainText.length > 0) {
                const subStartIdx = span.startIdx + subLastSplit;
                const remainStartMs = charTimeline[subStartIdx]?.timeMs || 0;
                const remainEndMs = span.endMs;
                const remainDuration = remainEndMs - remainStartMs;

                if (remainDuration < MIN_SEGMENT_DURATION_MS && finalSpans.length > 0) {
                    const prev = finalSpans[finalSpans.length - 1];
                    prev.text = prev.text + ' ' + remainText;
                    prev.endMs = remainEndMs;
                    prev.endIdx = span.endIdx;
                } else {
                    finalSpans.push({
                        startIdx: subStartIdx,
                        endIdx: span.endIdx,
                        text: remainText,
                        startMs: remainStartMs,
                        endMs: remainEndMs,
                    });
                }
            }
        }
    }

    const mergedSpans: TextSpan[] = [];
    for (const span of finalSpans) {
        const duration = span.endMs - span.startMs;
        if (duration < MIN_SEGMENT_DURATION_MS && mergedSpans.length > 0) {
            const prev = mergedSpans[mergedSpans.length - 1];
            prev.text = prev.text + ' ' + span.text;
            prev.endMs = span.endMs;
            prev.endIdx = span.endIdx;
        } else {
            mergedSpans.push({ ...span });
        }
    }

    const outputLines: string[] = [];
    for (let i = 0; i < mergedSpans.length; i++) {
        const span = mergedSpans[i];
        outputLines.push(`${i + 1}`);
        outputLines.push(`${msToTime(span.startMs)} --> ${msToTime(span.endMs)}`);
        outputLines.push(span.text);
        outputLines.push('');
    }

    return outputLines.join('\r\n');
};

/**
 * Optimize an SRT file in place
 */
export const optimizeSrtFile = (srtPath: string): string => {
    const content = fs.readFileSync(srtPath, 'utf-8');
    const optimized = optimizeSrt(content);
    fs.writeFileSync(srtPath, optimized, 'utf-8');
    return optimized;
};

export interface SrtEntry {
    index: number;
    startTime: string;
    endTime: string;
    text: string;
}

export const parseSrt = (content: string): SrtEntry[] => {
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const entries: SrtEntry[] = [];

    const blocks = normalized.trim().split(/\n\s*\n/);

    for (const block of blocks) {
        const lines = block.trim().split('\n');
        if (lines.length >= 2) {
            const indexLine = lines[0].trim();
            const timeLine = lines[1].trim();

            const index = parseInt(indexLine, 10);
            if (isNaN(index)) continue;

            const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);

            if (timeMatch) {
                const text = lines.slice(2).join('\n').trim();
                entries.push({
                    index,
                    startTime: timeMatch[1],
                    endTime: timeMatch[2],
                    text,
                });
            }
        }
    }

    return entries;
};

export const stringifySrt = (entries: SrtEntry[]): string => {
    return entries.map(entry => {
        return `${entry.index}\n${entry.startTime} --> ${entry.endTime}\n${entry.text}\n`;
    }).join('\n');
};

export const timeToSeconds = (time: string): number => {
    if (!time) return 0;

    const [hms, ms] = time.replace(',', '.').split('.');
    const parts = hms.split(':').map(Number);

    let seconds = 0;
    if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
    }

    const milliseconds = ms ? parseFloat(`0.${ms}`) : 0;

    return seconds + milliseconds;
};

