import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Loader2,
    Volume2,
    CheckCircle2,
    Play,
    FileText,
    AlertCircle,
    Music,
    Square,
    RefreshCw,
    Settings,
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { parseSrt, TARGET_LANGUAGES, type SrtEntry } from "@/lib/utils";
import { useProcessContext } from "@/stores/ProcessStore";
import ReactCountryFlag from "react-country-flag";

interface AudioProgress {
    status: 'generating' | 'done' | 'error';
    progress: number;
    detail: string;
    current?: number;
    total?: number;
    entryIndex?: number;
    entryStatus?: 'start' | 'done' | 'failed';
}

type EntryAudioStatus = 'pending' | 'generating' | 'done' | 'failed';

export const AudioGeneratePhase = ({ onComplete }: { onComplete?: () => void }) => {
    const { id } = useParams();
    const [phase, setPhase] = useState<"loading" | "no-translation" | "ready">("loading");
    const [projectPath, setProjectPath] = useState("");
    const [translatedEntries, setTranslatedEntries] = useState<SrtEntry[]>([]);
    const [translatedLang, setTranslatedLang] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState<AudioProgress | null>(null);
    const [audioFiles, setAudioFiles] = useState<{ name: string; path: string }[]>([]);
    const [entryStatuses, setEntryStatuses] = useState<Map<number, EntryAudioStatus>>(new Map());
    const [playingIndex, setPlayingIndex] = useState<number | null>(null);
    const [voices, setVoices] = useState<any[]>([]);
    const [selectedVoice, setSelectedVoice] = useState("");
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [concurrency, setConcurrency] = useState(3);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlayAll, setIsPlayAll] = useState(false);
    const isPlayAllRef = useRef(false);

    useEffect(() => {
        isPlayAllRef.current = isPlayAll;
    }, [isPlayAll]);

    const { setIsProcessing: setGlobalProcessing, isAutoProcess } = useProcessContext();

    const isAutoProcessRef = useRef(isAutoProcess);
    const retryCountRef = useRef(0);
    const retryItemsQueueRef = useRef<number[]>([]);

    useEffect(() => {
        isAutoProcessRef.current = isAutoProcess;
    }, [isAutoProcess]);

    useEffect(() => {
        setGlobalProcessing(isGenerating);
    }, [isGenerating, setGlobalProcessing]);

    useEffect(() => {
        const init = async () => {
            const projects = await window.api.getProjects();
            const project = projects.find((p: any) => p.id === id);
            if (!project) {
                setPhase("loading");
                return;
            }
            setProjectPath(project.path);

            const metadata = await window.api.getProjectMetadata(project.path);
            if (!metadata || !metadata.videoInfo) {
                setPhase("loading");
                return;
            }
            const videoId = metadata.videoInfo.id;

            const langs = ["vi", "zh", "ja", "ko", "fr", "de", "es", "pt", "ru", "en", "th"];
            let foundLang = "";
            let foundContent = "";

            for (const lang of langs) {
                const content = await window.api.getTranslatedSrt(project.path, videoId, lang);
                if (content) {
                    foundLang = lang;
                    foundContent = content;
                    break;
                }
            }

            if (foundContent && foundLang) {
                const entries = parseSrt(foundContent);
                setTranslatedEntries(entries);
                setTranslatedLang(foundLang);

                const existingAudio = await window.api.listGeneratedAudio(project.path, videoId);
                if (existingAudio && existingAudio.length > 0) {
                    setAudioFiles(existingAudio);
                    // Mark existing audio entries as done
                    const statuses = new Map<number, EntryAudioStatus>();
                    entries.forEach(entry => {
                        const baseName = `${String(entry.index).padStart(4, '0')}`;
                        const hasAudio = existingAudio.some((f: { name: string }) =>
                            f.name === `${baseName}.mp3` || f.name === `${baseName}.wav`
                        );
                        statuses.set(entry.index, hasAudio ? 'done' : 'pending');
                    });
                    setEntryStatuses(statuses);
                }
                setPhase("ready");
            } else {
                setPhase("no-translation");
            }
        };

        init();
    }, [id]);

    // Fetch voices and load saved voice
    useEffect(() => {
        const fetchVoices = async () => {
            if (!translatedLang) return;
            const allVoices = await window.api.getEdgeVoices();
            // Filter voices by language (e.g. 'vi' -> 'vi-VN')
            const filtered = allVoices.filter((v: any) => v.Locale.startsWith(translatedLang));
            setVoices(filtered);

            // Load saved voice from localStorage
            const savedVoice = localStorage.getItem(`voice_${translatedLang}`);
            if (savedVoice && filtered.some(v => v.ShortName === savedVoice)) {
                setSelectedVoice(savedVoice);
            } else if (filtered.length > 0) {
                setSelectedVoice(filtered[0].ShortName);
            }

            const savedConcurrency = localStorage.getItem('audio_concurrency');
            if (savedConcurrency) {
                setConcurrency(parseInt(savedConcurrency, 10));
            }
        };
        fetchVoices();
    }, [translatedLang]);

    useEffect(() => {
        window.api.onAudioGenerateProgress((progressData: AudioProgress) => {
            setProgress(progressData);

            // Update per-entry status
            if (progressData.entryIndex !== undefined && progressData.entryStatus) {
                setEntryStatuses(prev => {
                    const next = new Map(prev);
                    if (progressData.entryStatus === 'start') {
                        next.set(progressData.entryIndex!, 'generating');
                    } else if (progressData.entryStatus === 'done') {
                        next.set(progressData.entryIndex!, 'done');
                    } else if (progressData.entryStatus === 'failed') {
                        next.set(progressData.entryIndex!, 'failed');
                    }
                    return next;
                });
            }

            if (progressData.status === 'done') {
                setIsGenerating(false);
                if (projectPath) {
                    window.api.getProjectMetadata(projectPath).then(metadata => {
                        if (metadata && metadata.videoInfo) {
                            window.api.listGeneratedAudio(projectPath, metadata.videoInfo.id).then(files => {
                                setAudioFiles(files);

                                // If it's a global done (not a single item retry done)
                                if (progressData.entryIndex === undefined) {
                                    // Check for failed entries for auto-retry
                                    setEntryStatuses(currentStatuses => {
                                        const failedIndices = Array.from(currentStatuses.entries())
                                            .filter(([_, s]) => s === 'failed')
                                            .map(([idx]) => idx);

                                        if (isAutoProcessRef.current) {
                                            if (failedIndices.length > 0 && retryCountRef.current < 3) {
                                                retryCountRef.current += 1;
                                                retryItemsQueueRef.current = failedIndices;
                                                setTimeout(() => processRetryQueue(failedIndices), 500);
                                            } else if (onComplete) {
                                                onComplete();
                                            }
                                        }
                                        return currentStatuses;
                                    });
                                } else {
                                    // It's a single item done
                                    if (retryItemsQueueRef.current.length > 0) {
                                        // We are in a batch retry process
                                        retryItemsQueueRef.current = retryItemsQueueRef.current.filter(id => id !== progressData.entryIndex);
                                        if (retryItemsQueueRef.current.length === 0) {
                                            // Batch retry finished
                                            if (isAutoProcessRef.current && onComplete) {
                                                onComplete();
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    });
                }
            } else if (progressData.status === 'error') {
                setIsGenerating(false);
                // Also handle error in batch retry
                if (progressData.entryIndex !== undefined && retryItemsQueueRef.current.length > 0) {
                    retryItemsQueueRef.current = retryItemsQueueRef.current.filter(id => id !== progressData.entryIndex);
                    if (retryItemsQueueRef.current.length === 0 && isAutoProcessRef.current && onComplete) {
                        onComplete();
                    }
                }
            }
        });

        return () => {
            window.api.removeAudioGenerateListeners();
        };
    }, [projectPath, onComplete]);

    const autoStartedRef = useRef(false);

    useEffect(() => {
        if (isAutoProcess && phase === "ready" && !autoStartedRef.current && translatedEntries.length > 0 && translatedLang && projectPath) {
            autoStartedRef.current = true;

            // If already complete, just proceed
            const doneCount = Array.from(entryStatuses.values()).filter(s => s === 'done').length;
            if (audioFiles.length > 0 && doneCount >= translatedEntries.length) {
                if (onComplete) onComplete();
                return;
            }

            setTimeout(() => {
                handleStartGenerate();
            }, 500);
        }
    }, [isAutoProcess, phase, translatedEntries.length, translatedLang, projectPath, audioFiles.length, entryStatuses, onComplete]);

    const handleStartGenerate = async () => {
        if (!projectPath || !translatedLang) return;
        setIsGenerating(true);
        retryCountRef.current = 0;
        setProgress(null);
        // Reset all statuses to pending
        const statuses = new Map<number, EntryAudioStatus>();
        translatedEntries.forEach(entry => {
            statuses.set(entry.index, 'pending');
        });
        setEntryStatuses(statuses);
        setAudioFiles([]);
        const metadata = await window.api.getProjectMetadata(projectPath);
        if (!metadata || !metadata.videoInfo) return;
        const videoId = metadata.videoInfo.id;
        window.api.generateAudio(projectPath, videoId, translatedLang, concurrency, selectedVoice);
    };

    const processRetryQueue = async (indices: number[]) => {
        setIsGenerating(true);
        const metadata = await window.api.getProjectMetadata(projectPath);
        if (!metadata || !metadata.videoInfo) return;
        const videoId = metadata.videoInfo.id;
        for (const idx of indices) {
            await window.api.generateSingleAudio(projectPath, videoId, translatedLang, idx, selectedVoice);
        }
    };

    const handleRegenerateItem = async (index: number) => {
        if (!projectPath || !translatedLang) return;
        const item = translatedEntries.find(e => e.index === index);
        if (!item) return;

        setEntryStatuses(prev => {
            const next = new Map(prev);
            next.set(index, 'generating');
            return next;
        });

        try {
            const metadata = await window.api.getProjectMetadata(projectPath);
            if (!metadata || !metadata.videoInfo) return;
            const videoId = metadata.videoInfo.id;
            await window.api.generateSingleAudio(projectPath, videoId, translatedLang, item.index, selectedVoice);
        } catch (err) {
            console.error("Regenerate failed:", err);
            setEntryStatuses(prev => {
                const next = new Map(prev);
                next.set(index, 'failed');
                return next;
            });
        }
    };

    const handleRetryGenerateItem = async (index: number) => {
        if (!projectPath || !translatedLang || isGenerating) return;
        setIsGenerating(true);
        const metadata = await window.api.getProjectMetadata(projectPath);
        if (!metadata || !metadata.videoInfo) return;
        const videoId = metadata.videoInfo.id;
        await window.api.generateSingleAudio(projectPath, videoId, translatedLang, index, selectedVoice);
    };

    const handlePreviewVoice = async () => {
        if (!selectedVoice || isPreviewing) return;
        setIsPreviewing(true);
        try {
            const previewText = translatedLang === 'vi' ? "Đây là bản nghe thử giọng nói." : "This is a voice preview.";
            const dataUrl = await window.api.previewEdgeVoice(selectedVoice, previewText);
            if (dataUrl) {
                const audio = new Audio(dataUrl);
                audio.onended = () => setIsPreviewing(false);
                audio.onerror = () => setIsPreviewing(false);
                await audio.play();
            } else {
                setIsPreviewing(false);
            }
        } catch (err) {
            console.error("Preview failed:", err);
            setIsPreviewing(false);
        }
    };

    const handlePlayAudio = async (index: number, audioPath: string) => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        if (playingIndex === index) {
            setPlayingIndex(null);
            setIsPlayAll(false);
            return;
        }

        setPlayingIndex(index);
        try {
            const dataUrl = await window.api.readGeneratedAudio(audioPath);
            if (!dataUrl) {
                setPlayingIndex(null);
                setIsPlayAll(false);
                return;
            }
            const audio = new Audio(dataUrl);
            audioRef.current = audio;
            audio.onended = () => {
                if (isPlayAllRef.current) {
                    const nextIndex = translatedEntries.findIndex((e, i) => i > index && entryStatuses.get(e.index) === 'done' && audioFiles.some(f => f.name.startsWith(String(e.index).padStart(4, '0'))));
                    if (nextIndex !== -1) {
                        const nextFile = audioFiles.find(f => f.name.startsWith(String(translatedEntries[nextIndex].index).padStart(4, '0')));
                        if (nextFile) {
                            handlePlayAudio(nextIndex, nextFile.path);
                            return;
                        }
                    }
                    setIsPlayAll(false);
                }
                setPlayingIndex(null);
                audioRef.current = null;
            };
            audio.onerror = () => {
                setIsPlayAll(false);
                setPlayingIndex(null);
                audioRef.current = null;
            };
            await audio.play();
        } catch {
            setIsPlayAll(false);
            setPlayingIndex(null);
            audioRef.current = null;
        }
    };

    const handlePlayAll = () => {
        if (isPlayAll) {
            setIsPlayAll(false);
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setPlayingIndex(null);
        } else {
            const firstIndex = translatedEntries.findIndex(e => entryStatuses.get(e.index) === 'done' && audioFiles.some(f => f.name.startsWith(String(e.index).padStart(4, '0'))));
            if (firstIndex !== -1) {
                setIsPlayAll(true);
                const firstFile = audioFiles.find(f => f.name.startsWith(String(translatedEntries[firstIndex].index).padStart(4, '0')));
                if (firstFile) {
                    handlePlayAudio(firstIndex, firstFile.path);
                }
            }
        }
    };



    const hasAnyAudio = audioFiles.length > 0;
    const doneCount = Array.from(entryStatuses.values()).filter(s => s === 'done').length;
    const failedCount = Array.from(entryStatuses.values()).filter(s => s === 'failed').length;

    if (phase === "loading") {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (phase === "no-translation") {
        return (
            <div className="flex flex-col items-center justify-center h-full p-4">
                <div className="text-center space-y-4 animate-in fade-in duration-300">
                    <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto" />
                    <h2 className="text-xl font-bold">Chưa có bản dịch</h2>
                    <p className="text-sm text-muted-foreground">
                        Hãy dịch phụ đề trước khi tạo audio. Quay lại tab "Dịch phụ đề" để bắt đầu.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="flex flex-col p-4 gap-4 max-w-7xl w-full mx-auto h-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <Volume2 className="w-5 h-5 text-primary" />
                        <div>
                            <h2 className="text-lg font-bold">Tạo audio - Edge TTS</h2>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                {translatedEntries.length} đoạn -
                                {(() => {
                                    const langItem = TARGET_LANGUAGES.find(l => l.code === translatedLang);
                                    return langItem ? (
                                        <span className="flex items-center gap-1.5 ml-1">
                                            <ReactCountryFlag countryCode={langItem.flag} svg />
                                            {langItem.name}
                                        </span>
                                    ) : (
                                        <span>{translatedLang}</span>
                                    );
                                })()}
                                {doneCount > 0 && <span className="ml-1">- {doneCount} đã tạo</span>}
                                {failedCount > 0 && <span className="ml-1">- {failedCount} lỗi</span>}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Voice Selection & Preview */}
                <div className="bg-muted/30 border rounded-xl p-4 flex flex-col gap-4 shrink-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Settings className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Cấu hình giọng đọc</h3>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1 space-y-1.5 w-full">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Chọn giọng đọc</label>
                            <Select
                                value={selectedVoice}
                                onValueChange={(val) => {
                                    setSelectedVoice(val);
                                    localStorage.setItem(`voice_${translatedLang}`, val);
                                }}
                                disabled={isGenerating}
                            >
                                <SelectTrigger className="w-full bg-background border-muted-foreground/20">
                                    <SelectValue placeholder="Đang tải danh sách giọng đọc..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {voices.length === 0 ? (
                                        <SelectItem value="loading" disabled>
                                            Đang tải giọng đọc...
                                        </SelectItem>
                                    ) : (
                                        voices.map((v) => (
                                            <SelectItem key={v.ShortName} value={v.ShortName}>
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <span className="font-medium text-sm">{v.FriendlyName.split(' - ')[1] || v.ShortName}</span>
                                                    <span className="text-[10px] text-muted-foreground leading-none">
                                                        {v.Gender} - {v.Locale}
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-[100px] shrink-0 space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Số luồng</label>
                            <Select
                                value={concurrency.toString()}
                                onValueChange={(val) => {
                                    setConcurrency(parseInt(val, 10));
                                    localStorage.setItem('audio_concurrency', val);
                                }}
                                disabled={isGenerating}
                            >
                                <SelectTrigger className="w-full bg-background border-muted-foreground/20">
                                    <SelectValue placeholder="1" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[1, 2, 3, 5, 8, 10, 15, 20].map(n => (
                                        <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                variant="outline"
                                className={`flex-1 sm:flex-initial gap-2 border-muted-foreground/20 ${isPlayAll ? 'bg-primary/10 text-primary border-primary/50' : ''}`}
                                onClick={handlePlayAll}
                                disabled={isGenerating || !hasAnyAudio}
                            >
                                {isPlayAll ? (
                                    <Square className="w-4 h-4" />
                                ) : (
                                    <Play className="w-4 h-4" />
                                )}
                                {isPlayAll ? "Dừng phát" : "Phát tất cả"}
                            </Button>

                            <Button
                                variant="outline"
                                className="flex-1 sm:flex-initial gap-2 border-muted-foreground/20"
                                onClick={handlePreviewVoice}
                                disabled={!selectedVoice || isPreviewing || isGenerating}
                            >
                                {isPreviewing ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Volume2 className="w-4 h-4" />
                                )}
                                Nghe thử
                            </Button>

                            <Button
                                className="flex-1 sm:flex-initial gap-2 relative overflow-hidden group min-w-[140px]"
                                onClick={handleStartGenerate}
                                disabled={isGenerating || !selectedVoice}
                            >
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary/10 via-white/20 to-primary/10 -translate-x-full group-hover:animate-shimmer" />
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Đang tạo...
                                    </>
                                ) : (
                                    <>
                                        <Music className="w-4 h-4" />
                                        {hasAnyAudio ? "Tạo lại tất cả" : "Bắt đầu tạo"}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Progress bar during generation */}
                {isGenerating && progress && (
                    <div className="shrink-0 space-y-1">
                        <Progress value={progress.progress} className="w-full h-2" />
                        <p className="text-xs text-muted-foreground text-center">
                            {progress.detail}
                        </p>
                    </div>
                )}

                {/* Entry list */}
                <div className="flex-1 overflow-y-auto border rounded-xl">
                    <div className="divide-y">
                        {translatedEntries.map((entry, i) => {
                            const baseName = `${String(entry.index).padStart(4, '0')}`;
                            const audioFile = audioFiles.find(f =>
                                f.name === `${baseName}.mp3` || f.name === `${baseName}.wav`
                            );
                            const status = entryStatuses.get(entry.index) || 'pending';
                            const isPlaying = playingIndex === i;

                            return (
                                <div
                                    key={entry.index}
                                    className={`flex items-center gap-3 p-3 transition-colors group ${status === 'generating'
                                        ? 'bg-primary/5 border-l-2 border-l-primary'
                                        : status === 'done' && audioFile
                                            ? 'hover:bg-muted/30 cursor-pointer'
                                            : status === 'failed'
                                                ? 'hover:bg-destructive/5 cursor-pointer'
                                                : 'hover:bg-muted/30'
                                        }`}
                                    onClick={() => {
                                        if (status === 'done' && audioFile) {
                                            handlePlayAudio(i, audioFile.path);
                                        } else if (status === 'failed' && !isGenerating) {
                                            handleRetryGenerateItem(entry.index);
                                        }
                                    }}
                                >
                                    {/* Play button / status icon */}
                                    <div className="shrink-0 w-8 h-8 flex items-center justify-center">
                                        {status === 'generating' ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        ) : status === 'done' && audioFile ? (
                                            <Button
                                                variant={isPlaying ? "default" : "ghost"}
                                                size="icon"
                                                className="w-8 h-8"
                                                onClick={() => handlePlayAudio(i, audioFile.path)}
                                            >
                                                {isPlaying ? (
                                                    <Square className="w-3 h-3" />
                                                ) : (
                                                    <Play className="w-4 h-4" />
                                                )}
                                            </Button>
                                        ) : status === 'failed' ? (
                                            <AlertCircle className="w-4 h-4 text-destructive" />
                                        ) : (
                                            <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/20" />
                                        )}
                                    </div>

                                    {/* Text */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground font-mono mb-0.5">
                                            #{entry.index} • {entry.startTime}
                                        </p>
                                        <p className="text-sm truncate">{entry.text}</p>
                                    </div>

                                    {/* Status indicator */}
                                    <div className="shrink-0 relative w-12 h-8 flex items-center justify-end">
                                        <div className="absolute inset-0 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                            <Tooltip delayDuration={100}>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="w-8 h-8 hover:bg-muted cursor-pointer text-muted-foreground hover:text-foreground"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRetryGenerateItem(entry.index);
                                                        }}
                                                        disabled={isGenerating || status === 'generating'}
                                                    >
                                                        <RefreshCw className={`w-4 h-4 ${isGenerating || status === 'generating' ? 'opacity-50' : ''}`} />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent side="left">
                                                    <p>Tạo lại âm thanh</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                        <div className="flex items-center justify-end w-full transition-opacity duration-200 opacity-100 group-hover:opacity-0">
                                            {status === 'done' && (
                                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                                            )}
                                            {status === 'failed' && (
                                                <AlertCircle className="w-4 h-4 text-destructive" />
                                            )}
                                            {status === 'generating' && (
                                                <span className="text-xs text-primary font-medium">Đang tạo</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
};
