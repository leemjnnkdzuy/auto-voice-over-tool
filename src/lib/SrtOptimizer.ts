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

    // Check Asian punctuations (Chinese/Japanese ending marks)
    if (char === '。' || char === '！' || char === '？') {
        return true;
    }

    // Sentence-ending punctuation (English/Latin)
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
 */
const interpolateTime = (startMs: number, endMs: number, charPos: number, totalChars: number): number => {
    if (totalChars <= 0) return startMs;
    const ratio = Math.min(charPos / totalChars, 1.0);
    return Math.round(startMs + (endMs - startMs) * ratio);
};

// Max segment duration in ms (10 seconds)
const MAX_SEGMENT_DURATION_MS = 10000;
// Min segment duration in ms (1.2 seconds)
const MIN_SEGMENT_DURATION_MS = 1200;

/**
 * Detect if the SRT content is primarily CJK (Chinese/Japanese/Korean)
 */
const isCJKDominant = (text: string): boolean => {
    const cjkCount = (text.match(/[\u3000-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/g) || []).length;
    return cjkCount > text.length * 0.2; // >20% CJK characters
};

interface SimpleSpan {
    startMs: number;
    endMs: number;
    text: string;
}

/**
 * CJK strategy: preserve Whisper's segment boundaries, merge short, split long
 */
const optimizeSrtCJK = (segments: SrtSegment[]): string => {
    const spans: SimpleSpan[] = segments.map(seg => ({
        startMs: timeToMs(seg.startTime),
        endMs: timeToMs(seg.endTime),
        text: seg.text.trim(),
    })).filter(s => s.text.length > 0);

    // Merge very short segments with adjacent ones
    const merged: SimpleSpan[] = [];
    for (const span of spans) {
        const duration = span.endMs - span.startMs;
        const prev = merged[merged.length - 1];

        if (prev && duration < MIN_SEGMENT_DURATION_MS) {
            const combined = span.endMs - prev.startMs;
            if (combined <= MAX_SEGMENT_DURATION_MS * 1.5) {
                prev.text = prev.text + span.text;
                prev.endMs = span.endMs;
                continue;
            }
        }
        merged.push({ ...span });
    }

    // Split any segments that are too long
    const final: SimpleSpan[] = [];
    for (const span of merged) {
        const duration = span.endMs - span.startMs;

        if (duration <= MAX_SEGMENT_DURATION_MS) {
            final.push(span);
            continue;
        }

        // Try to split at CJK punctuation first
        const text = span.text;
        const subSplits: number[] = [];
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (c === '。' || c === '！' || c === '？' || c === '.' || c === '!' || c === '?') {
                subSplits.push(i + 1);
            } else if ((c === '，' || c === '、' || c === ',') && i > 0) {
                subSplits.push(i + 1);
            }
        }

        if (subSplits.length > 0) {
            let lastIdx = 0;
            for (const splitIdx of subSplits) {
                const chunk = text.substring(lastIdx, splitIdx).trim();
                if (chunk.length > 0) {
                    const chunkRatio = lastIdx / text.length;
                    const splitRatio = splitIdx / text.length;
                    final.push({
                        startMs: Math.round(span.startMs + (span.endMs - span.startMs) * chunkRatio),
                        endMs: Math.round(span.startMs + (span.endMs - span.startMs) * splitRatio),
                        text: chunk,
                    });
                }
                lastIdx = splitIdx;
            }
            if (lastIdx < text.length) {
                const chunk = text.substring(lastIdx).trim();
                if (chunk.length > 0) {
                    final.push({
                        startMs: Math.round(span.startMs + (span.endMs - span.startMs) * (lastIdx / text.length)),
                        endMs: span.endMs,
                        text: chunk,
                    });
                }
            }
        } else {
            // No punctuation — split by character count proportionally
            const numChunks = Math.ceil(duration / MAX_SEGMENT_DURATION_MS);
            const chunkSize = Math.ceil(text.length / numChunks);
            for (let i = 0; i < numChunks; i++) {
                const startChar = i * chunkSize;
                const endChar = Math.min((i + 1) * chunkSize, text.length);
                const chunk = text.substring(startChar, endChar).trim();
                if (chunk.length === 0) continue;
                final.push({
                    startMs: Math.round(span.startMs + duration * (startChar / text.length)),
                    endMs: Math.round(span.startMs + duration * (endChar / text.length)),
                    text: chunk,
                });
            }
        }
    }

    const outputLines: string[] = [];
    for (let i = 0; i < final.length; i++) {
        const s = final[i];
        outputLines.push(`${i + 1}`);
        outputLines.push(`${msToTime(s.startMs)} --> ${msToTime(s.endMs)}`);
        outputLines.push(s.text);
        outputLines.push('');
    }
    return outputLines.join('\r\n');
};

interface LatinSpan {
    startIdx: number;
    endIdx: number;
    text: string;
    startMs: number;
    endMs: number;
}

/**
 * Latin text strategy: merge all, then re-split at sentence boundaries
 */
const optimizeSrtLatin = (originalSegments: SrtSegment[]): string => {
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

    if (charTimeline.length === 0) {
        return originalSegments.map((s, i) => `${i + 1}\r\n${s.startTime} --> ${s.endTime}\r\n${s.text}\r\n`).join('\r\n');
    }

    const fullText = charTimeline.map(c => c.char).join('');

    const splitPoints: number[] = [];
    for (let i = 0; i < fullText.length; i++) {
        if (isSentenceEnd(fullText, i)) {
            splitPoints.push(i + 1);
        }
    }

    const sentenceSpans: LatinSpan[] = [];
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

    const finalSpans: LatinSpan[] = [];

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

            if ((char === ',' && i + 1 < text.length && text[i + 1] === ' ') || char === '，' || char === '、') {
                const posMs = charTimeline[globalIdx]?.timeMs || 0;
                const durationFromStart = posMs - span.startMs;
                if (durationFromStart >= MIN_SEGMENT_DURATION_MS) {
                    subSplitPoints.push(i + 1);
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

    const mergedSpans: LatinSpan[] = [];
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
 * Optimize SRT segments by re-splitting at sentence boundaries.
 *
 * Routes to CJK strategy for Chinese/Japanese/Korean (preserves Whisper's timestamps),
 * or Latin strategy for other languages (merges then re-splits by sentence).
 */
export const optimizeSrt = (srtContent: string): string => {
    const originalSegments = parseSrtContent(srtContent);
    if (originalSegments.length === 0) return srtContent;

    const allText = originalSegments.map(s => s.text).join('');
    const useCJKStrategy = isCJKDominant(allText);

    if (useCJKStrategy) {
        return optimizeSrtCJK(originalSegments);
    }

    return optimizeSrtLatin(originalSegments);
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
