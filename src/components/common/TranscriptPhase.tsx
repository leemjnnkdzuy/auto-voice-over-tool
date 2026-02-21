import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileText, Play, CheckCircle2, RotateCcw, Volume2, Pause, Cpu, Zap, Cloud, Download, Check, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { parseSrt, formatTimeShort, timeToSeconds, type SrtEntry } from "@/lib/utils";
import { useProcessContext } from "@/stores/ProcessStore";

type TranscriptEngine = 'whisper-cpu' | 'whisper-gpu' | 'assemblyai';

interface EngineOption {
    id: TranscriptEngine;
    name: string;
    subtitle: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
    borderColor: string;
    disabled: boolean;
}

interface TranscriptProgress {
    status: string;
    progress: number;
    detail: string;
}

const ENGINES: EngineOption[] = [
    {
        id: 'whisper-cpu',
        name: 'Whisper',
        subtitle: 'CPU',
        description: 'Chạy trên CPU, tương thích mọi máy tính',
        icon: <Cpu className="w-6 h-6" />,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/50',
        disabled: false,
    },
    {
        id: 'whisper-gpu',
        name: 'Whisper',
        subtitle: 'NVIDIA GPU',
        description: 'Tăng tốc bằng CUDA, nhanh gấp 5-10 lần',
        icon: <Zap className="w-6 h-6" />,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10',
        borderColor: 'border-green-500/50',
        disabled: false,
    },
    {
        id: 'assemblyai',
        name: 'AssemblyAI',
        subtitle: 'Cloud API',
        description: 'API đám mây, chính xác cao, cần API key',
        icon: <Cloud className="w-6 h-6" />,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/50',
        disabled: true,
    },
];

export const TranscriptPhase = ({ onComplete }: { onComplete?: () => void }) => {
    const { id } = useParams();
    const [phase, setPhase] = useState<"idle" | "processing" | "done">("idle");
    const [progress, setProgress] = useState<TranscriptProgress>({
        status: "idle",
        progress: 0,
        detail: "",
    });
    const [srtEntries, setSrtEntries] = useState<SrtEntry[]>([]);
    const [srtPath, setSrtPath] = useState("");
    const [projectPath, setProjectPath] = useState("");
    const [isChecking, setIsChecking] = useState(true);
    const [audioUrl, setAudioUrl] = useState<string>("");
    const [isPlaying, setIsPlaying] = useState(false);
    const [activeSegment, setActiveSegment] = useState<number | null>(null);

    const [selectedEngine, setSelectedEngine] = useState<TranscriptEngine>('whisper-cpu');
    const [engineStatus, setEngineStatus] = useState<Record<string, boolean>>({
        cpu: false,
        gpu: false,
    });
    const [isOptimizing, setIsOptimizing] = useState(false);

    const { setIsProcessing: setGlobalProcessing, isAutoProcess } = useProcessContext();

    const isAutoProcessRef = useRef(isAutoProcess);
    useEffect(() => {
        isAutoProcessRef.current = isAutoProcess;
    }, [isAutoProcess]);

    useEffect(() => {
        setGlobalProcessing(phase === "processing" || isOptimizing);
    }, [phase, isOptimizing, setGlobalProcessing]);

    const listRef = useRef<HTMLDivElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Check engine readiness
    const checkEngines = async () => {
        try {
            const [cpuReady, gpuReady] = await Promise.all([
                window.api.checkWhisperEngine('cpu'),
                window.api.checkWhisperEngine('gpu'),
            ]);
            setEngineStatus({ cpu: cpuReady, gpu: gpuReady });
        } catch (err) {
            console.error("Failed to check engines:", err);
        }
    };

    // Load audio file via IPC
    const loadAudio = async (projPath: string) => {
        try {
            const result = await window.api.readAudioFile(projPath);
            if (result) {
                const blob = new Blob([result.buffer], { type: result.mimeType });
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
            }
        } catch (err) {
            console.error("Failed to load audio:", err);
        }
    };

    useEffect(() => {
        const init = async () => {
            const projects = await window.api.getProjects();
            const project = projects.find((p: any) => p.id === id);
            if (project) {
                setProjectPath(project.path);

                const existing = await window.api.getExistingSrt(project.path);
                if (existing) {
                    setSrtEntries(parseSrt(existing.srtContent));
                    setSrtPath(existing.srtPath);
                    setPhase("done");
                    loadAudio(project.path);
                }
            }
            await checkEngines();
            setIsChecking(false);
        };

        init();

        window.api.onTranscriptProgress((data: TranscriptProgress) => {
            setProgress(data);
            if (data.status === "done") {
                setPhase("done");
            }
            if (data.status === "error") {
                setPhase("idle");
            }
        });

        window.api.onTranscriptComplete((result: any) => {
            if (result) {
                setSrtEntries(parseSrt(result.srtContent));
                setSrtPath(result.srtPath);
                setPhase("done");

                if (isAutoProcessRef.current && onComplete) {
                    onComplete();
                }
            }
        });

        return () => {
            window.api.removeTranscriptListeners();
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [id]);

    // Load audio when phase changes to done
    useEffect(() => {
        if (phase === "done" && projectPath && !audioUrl) {
            loadAudio(projectPath);
        }
    }, [phase, projectPath]);

    // Track playing state and auto-follow subtitle
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => { setIsPlaying(false); setActiveSegment(null); };

        const onTimeUpdate = () => {
            const currentTime = audio.currentTime;
            // Find the segment that matches the current time
            const currentEntry = srtEntries.find(entry => {
                const start = timeToSeconds(entry.startTime);
                const end = timeToSeconds(entry.endTime);
                return currentTime >= start && currentTime <= end;
            });
            if (currentEntry) {
                setActiveSegment(currentEntry.index);
            }
        };

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('timeupdate', onTimeUpdate);

        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('timeupdate', onTimeUpdate);
        };
    }, [audioUrl, srtEntries]);

    const autoStartedRef = useRef(false);

    useEffect(() => {
        if (isAutoProcess && phase === "idle" && !autoStartedRef.current && srtEntries.length === 0 && projectPath && selectedEngine) {
            autoStartedRef.current = true;
            handleStartTranscript();
        }
    }, [isAutoProcess, phase, srtEntries, projectPath, selectedEngine]);

    const handleStartTranscript = () => {
        if (!projectPath || !selectedEngine) return;
        setPhase("processing");
        setProgress({ status: "preparing", progress: 0, detail: "Đang chuẩn bị..." });
        window.api.transcribeAudio(projectPath, selectedEngine);
    };

    const handleRetranscript = () => {
        setSrtEntries([]);
        setSrtPath("");
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setActiveSegment(null);
        setPhase("idle");
        checkEngines();
    };


    const handleOptimize = async () => {
        if (!srtPath) return;
        setIsOptimizing(true);
        try {
            const result = await window.api.optimizeSrt(srtPath);
            if (result) {
                setSrtEntries(parseSrt(result.srtContent));
            }
        } catch (err) {
            console.error("Optimize failed:", err);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handlePlaySegment = (entry: SrtEntry) => {
        if (audioRef.current) {
            const seconds = timeToSeconds(entry.startTime);
            audioRef.current.currentTime = seconds;
            audioRef.current.play();
            setActiveSegment(entry.index);
        }
    };

    const getEngineStatusKey = (engineId: TranscriptEngine): string => {
        if (engineId === 'whisper-cpu') return 'cpu';
        if (engineId === 'whisper-gpu') return 'gpu';
        return '';
    };

    if (isChecking) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center p-4 space-y-4 max-w-7xl w-full mx-auto h-full">

            {/* ==================== IDLE STATE ==================== */}
            {phase === "idle" && (
                <div className="flex flex-col items-center gap-8 animate-in fade-in duration-300 w-full max-w-3xl">
                    {/* Title */}
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                            <FileText className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-2xl font-bold">Tạo phụ đề tự động</h2>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto">
                            Chọn công cụ nhận dạng giọng nói bên dưới để bắt đầu tạo file phụ đề SRT.
                        </p>
                    </div>

                    {/* Engine Cards */}
                    <div className="grid grid-cols-3 gap-4 w-full">
                        {ENGINES.map((engine) => {
                            const isSelected = selectedEngine === engine.id;
                            const statusKey = getEngineStatusKey(engine.id);
                            const isReady = statusKey ? engineStatus[statusKey] : false;

                            return (
                                <button
                                    key={engine.id}
                                    disabled={engine.disabled}
                                    onClick={() => !engine.disabled && setSelectedEngine(engine.id)}
                                    className={`
                                        relative flex flex-col items-center text-center p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer
                                        ${engine.disabled
                                            ? 'opacity-50 cursor-not-allowed border-border bg-muted/30'
                                            : isSelected
                                                ? `${engine.borderColor} bg-card shadow-lg scale-[1.02]`
                                                : 'border-border hover:border-primary/30 bg-card hover:shadow-md'
                                        }
                                    `}
                                >
                                    {/* Selected indicator */}
                                    {isSelected && !engine.disabled && (
                                        <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                            <Check className="w-3 h-3 text-primary-foreground" />
                                        </div>
                                    )}

                                    {/* Icon */}
                                    <div className={`w-14 h-14 rounded-xl ${engine.bgColor} flex items-center justify-center mb-4 ${engine.color}`}>
                                        {engine.icon}
                                    </div>

                                    {/* Title */}
                                    <h3 className="font-semibold text-base">{engine.name}</h3>
                                    <span className={`text-xs font-medium ${engine.color} mb-2`}>{engine.subtitle}</span>

                                    {/* Description */}
                                    <p className="text-xs text-muted-foreground leading-relaxed mb-4 min-h-[2.5rem]">
                                        {engine.description}
                                    </p>

                                    {/* Status Badge */}
                                    {engine.disabled ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border">
                                            Sắp có
                                        </span>
                                    ) : isReady ? (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-600 border border-green-500/20">
                                            <Check className="w-3 h-3" />
                                            Sẵn sàng
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                            <Download className="w-3 h-3" />
                                            Cần tải xuống
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Start Button */}
                    <Button
                        size="lg"
                        onClick={handleStartTranscript}
                        disabled={!selectedEngine || ENGINES.find(e => e.id === selectedEngine)?.disabled}
                        className="shadow-lg shadow-primary/20 px-8"
                    >
                        <Play className="w-4 h-4 mr-2" />
                        Bắt đầu nhận dạng
                    </Button>
                </div>
            )}

            {/* ==================== PROCESSING STATE ==================== */}
            {phase === "processing" && (
                <div className="flex flex-col items-center gap-6 w-full max-w-lg animate-in fade-in duration-300">
                    <div className="text-center space-y-1">
                        <h2 className="text-xl font-bold">Đang xử lý...</h2>
                        <p className="text-sm text-muted-foreground">{progress.detail}</p>
                    </div>
                    <Progress value={progress.progress} className="w-full h-2" />
                    <p className="text-xs text-muted-foreground">{Math.round(progress.progress)}%</p>
                </div>
            )}

            {/* ==================== DONE STATE ==================== */}
            {phase === "done" && srtEntries.length > 0 && (
                <div className="w-full h-full flex flex-col gap-4 animate-in fade-in duration-300 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <div>
                                <h2 className="text-lg font-bold">Phụ đề đã sẵn sàng</h2>
                                <p className="text-xs text-muted-foreground">{srtEntries.length} đoạn • {srtPath}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleOptimize} disabled={isOptimizing}>
                                {isOptimizing ? (
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                ) : (
                                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                                )}
                                Tối ưu
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleRetranscript}>
                                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                Làm lại
                            </Button>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
                        {/* Left Column (30%) - Audio Player */}
                        <div className="w-[30%] shrink-0 flex flex-col">
                            <div className="bg-card border rounded-xl shadow-sm flex flex-col overflow-hidden h-full">
                                <div className="flex items-center gap-2 p-4 border-b bg-muted/50">
                                    <Volume2 className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-medium">Trình phát âm thanh</span>
                                </div>

                                <div className="flex-1 flex items-center justify-center p-6">
                                    {audioUrl ? (
                                        <div className="text-center space-y-3">
                                            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center transition-colors ${isPlaying ? 'bg-primary/20 animate-pulse' : 'bg-muted/50'}`}>
                                                {isPlaying ? (
                                                    <Volume2 className="w-8 h-8 text-primary" />
                                                ) : (
                                                    <Volume2 className="w-8 h-8 text-muted-foreground/40" />
                                                )}
                                            </div>
                                            {activeSegment !== null ? (
                                                <div className="space-y-2">
                                                    <p className="text-xs font-mono text-primary font-medium">
                                                        Đoạn #{activeSegment}
                                                    </p>
                                                    <p className="text-sm text-foreground leading-relaxed px-2 max-h-[200px] overflow-y-auto">
                                                        {srtEntries.find(e => e.index === activeSegment)?.text || ''}
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">
                                                    Nhấn vào đoạn phụ đề để nghe
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center text-muted-foreground text-sm p-4">
                                            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin opacity-30" />
                                            <p>Đang tải audio...</p>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 border-t bg-muted/20">
                                    <audio
                                        ref={audioRef}
                                        controls
                                        className="w-full h-10"
                                        src={audioUrl || undefined}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Column (70%) - SRT List */}
                        <div className="flex-1 min-w-0 flex flex-col border rounded-xl shadow-sm overflow-hidden bg-card">
                            <div
                                ref={listRef}
                                className="flex-1 overflow-y-auto p-4 space-y-3"
                            >
                                {srtEntries.map((entry) => (
                                    <Card
                                        key={entry.index}
                                        className={`w-full shadow-none border transition-all cursor-pointer group py-0 gap-0 overflow-hidden ${activeSegment === entry.index
                                            ? 'border-primary/70 ring-1 ring-primary/20'
                                            : 'hover:border-primary/30'
                                            }`}
                                        onClick={() => handlePlaySegment(entry)}
                                    >
                                        <div className="px-4 py-2.5 bg-muted/50 flex items-center justify-between border-b">
                                            <div className="flex items-center gap-3">
                                                <span className="bg-background border px-2 py-0.5 rounded text-xs font-mono text-muted-foreground font-medium min-w-[2rem] w-auto h-6 flex items-center justify-center shrink-0">
                                                    #{entry.index}
                                                </span>
                                                <span className="text-xs font-mono text-primary/80 bg-primary/5 px-2 py-0.5 rounded flex items-center gap-1 border border-primary/10">
                                                    {formatTimeShort(entry.startTime)} <span className="mx-1 text-muted-foreground">→</span> {formatTimeShort(entry.endTime)}
                                                </span>
                                            </div>
                                            <div className={`flex items-center gap-1 text-xs transition-opacity ${activeSegment === entry.index ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-100 text-muted-foreground'
                                                }`}>
                                                {activeSegment === entry.index && isPlaying ? (
                                                    <>
                                                        <Pause className="w-3 h-3" />
                                                        <span>Đang phát</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="w-3 h-3 fill-current" />
                                                        <span>Phát</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <CardContent className={`p-3 px-4 ${activeSegment === entry.index ? 'bg-primary/5' : ''}`}>
                                            <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
                                                {entry.text}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Done but empty */}
            {phase === "done" && srtEntries.length === 0 && (
                <div className="text-center space-y-4 animate-in fade-in duration-300">
                    <p className="text-muted-foreground">Không có nội dung phụ đề.</p>
                    <Button variant="outline" onClick={handleRetranscript}>
                        Thử lại
                    </Button>
                </div>
            )}
        </div>
    );
};
