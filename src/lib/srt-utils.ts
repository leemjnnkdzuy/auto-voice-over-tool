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
