import { Spinner } from '@/components/ui/spinner';
import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    
    Volume2,
    CheckCircle2,
    Play,
    FileText,
    AlertCircle,
    Music,
    Square,
    RefreshCw,
    ArrowRight} from "lucide-react";
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
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const { setIsProcessing: setGlobalProcessing } = useProcessContext();

    const retryCountRef = useRef(0);

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

            const langs = ["vi", "zh", "ja", "ko", "fr", "de", "es", "pt", "ru", "en", "th"];
            let foundLang = "";
            let foundContent = "";

            for (const lang of langs) {
                const content = await window.api.getTranslatedSrt(project.path, lang);
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

                const existingAudio = await window.api.listGeneratedAudio(project.path);
                if (existingAudio && existingAudio.length > 0) {
                    setAudioFiles(existingAudio);
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

    useEffect(() => {
        window.api.onAudioGenerateProgress((progressData: AudioProgress) => {
            setProgress(progressData);

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
                    window.api.listGeneratedAudio(projectPath).then(files => {
                        setAudioFiles(files);
                    });
                }
            } else if (progressData.status === 'error') {
                setIsGenerating(false);
            }
        });

        return () => {
            window.api.removeAudioGenerateListeners();
        };
    }, [projectPath, onComplete]);


    const handleStartGenerate = () => {
        if (!projectPath || !translatedLang) return;
        setIsGenerating(true);
        retryCountRef.current = 0;
        setProgress(null);
        const statuses = new Map<number, EntryAudioStatus>();
        translatedEntries.forEach(entry => {
            statuses.set(entry.index, 'pending');
        });
        setEntryStatuses(statuses);
        setAudioFiles([]);
        window.api.generateAudio(projectPath, translatedLang);
    };

    const processRetryQueue = async (indices: number[]) => {
        setIsGenerating(true);
        for (const idx of indices) {
            await window.api.generateSingleAudio(projectPath, translatedLang, idx);
        }
    };

    const handleRetryGenerateItem = async (index: number) => {
        if (!projectPath || !translatedLang || isGenerating) return;
        setIsGenerating(true);
        await window.api.generateSingleAudio(projectPath, translatedLang, index);
    };

    const handlePlayAudio = async (index: number, audioPath: string) => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        if (playingIndex === index) {
            setPlayingIndex(null);
            return;
        }

        setPlayingIndex(index);
        try {
            const dataUrl = await window.api.readGeneratedAudio(audioPath);
            if (!dataUrl) {
                setPlayingIndex(null);
                return;
            }
            const audio = new Audio(dataUrl);
            audioRef.current = audio;
            audio.onended = () => {
                setPlayingIndex(null);
                audioRef.current = null;
            };
            audio.onerror = () => {
                setPlayingIndex(null);
                audioRef.current = null;
            };
            await audio.play();
        } catch {
            setPlayingIndex(null);
            audioRef.current = null;
        }
    };



    const hasAnyAudio = audioFiles.length > 0;
    const doneCount = Array.from(entryStatuses.values()).filter(s => s === 'done').length;
    const failedCount = Array.from(entryStatuses.values()).filter(s => s === 'failed').length;

    if (phase === "loading") {
        return (
            <div className="flex items-center justify-center h-full">
                <Spinner className="w-8 h-8 animate-spin text-primary" />
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
                <div className="flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <Volume2 className="w-5 h-5 text-primary" />
                        <div>
                            <h2 className="text-lg font-bold">Tạo audio - Edge TTS</h2>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                {translatedEntries.length} đoạn •
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
                                {doneCount > 0 && <span className="ml-1">• {doneCount} đã tạo</span>}
                                {failedCount > 0 && <span className="ml-1">• {failedCount} lỗi</span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant={hasAnyAudio ? "outline" : "default"}
                            className="gap-2"
                            onClick={handleStartGenerate}
                            disabled={isGenerating}
                        >
                            {isGenerating ? (
                                <>
                                    <Spinner className="w-3.5 h-3.5 animate-spin" />
                                    Đang tạo...
                                </>
                            ) : (
                                <>
                                    <Music className="w-3.5 h-3.5" />
                                    {hasAnyAudio ? "Tạo lại" : "Bắt đầu tạo"}
                                </>
                            )}
                        </Button>
                        {onComplete && hasAnyAudio && (
                            <Button size="sm" onClick={onComplete} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                                Tiếp tục
                                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                            </Button>
                        )}
                    </div>
                </div>

                {isGenerating && progress && (
                    <div className="shrink-0 space-y-1">
                        <Progress value={progress.progress} className="w-full h-2" />
                        <p className="text-xs text-muted-foreground text-center">
                            {progress.detail}
                        </p>
                    </div>
                )}

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
                                        : 'hover:bg-muted/30'
                                        }`}
                                >
                
                                    <div className="shrink-0 w-8 h-8 flex items-center justify-center">
                                        {status === 'generating' ? (
                                            <Spinner className="w-4 h-4 animate-spin text-primary" />
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

                
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-muted-foreground font-mono mb-0.5">
                                            #{entry.index} • {entry.startTime}
                                        </p>
                                        <p className="text-sm truncate">{entry.text}</p>
                                    </div>

                
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
