import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Loader2, FileText, Play, CheckCircle2, RotateCcw, Volume2, Pause, Cpu, Zap, Cloud, Download, Check, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { parseSrt, stringifySrt, formatTimeShort, timeToSeconds, type SrtEntry } from "@/lib/utils";
import { useProcessContext } from "@/stores/ProcessStore";

type TranscriptEngine = 'whisper-gpu-turbo';

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
        id: 'whisper-gpu-turbo',
        name: 'Whisper Turbo',
        subtitle: 'NVIDIA GPU',
        description: 'Tốc độ siêu nhanh & siêu chính xác (Cần GPU mạnh)',
        icon: <Zap className="w-6 h-6" />,
        color: 'text-green-600',
        bgColor: 'bg-green-600/10',
        borderColor: 'border-green-600/50',
        disabled: false,
    }
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

    const [selectedEngine, setSelectedEngine] = useState<TranscriptEngine>('whisper-gpu-turbo');
    const [engineStatus, setEngineStatus] = useState<Record<string, boolean>>({
        cpu: false,
        gpu: false,
        turboModelReady: false,
    });
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizingIndices, setOptimizingIndices] = useState<Set<number>>(new Set());
    const [optimizedIndices, setOptimizedIndices] = useState<Set<number>>(new Set());
    const [optimizePrompt, setOptimizePrompt] = useState(() => {
        return localStorage.getItem("optimizePrompt") || "";
    });

    useEffect(() => {
        localStorage.setItem("optimizePrompt", optimizePrompt);
    }, [optimizePrompt]);

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
            const [cpuReady, gpuReady, turboModelReady] = await Promise.all([
                window.api.checkWhisperEngine('cpu'),
                window.api.checkWhisperEngine('gpu'),
                window.api.checkWhisperTurboModelReady(),
            ]);
            setEngineStatus({ cpu: cpuReady, gpu: gpuReady, turboModelReady });
        } catch (err) {
            console.error("Failed to check engines:", err);
        }
    };

    // Load audio file via IPC
    const loadAudio = async (projPath: string, vId: string) => {
        try {
            const result = await window.api.readAudioFile(projPath, vId);
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

                const metadata = await window.api.getProjectMetadata(project.path);
                if (metadata && metadata.videoInfo) {
                    const videoId = metadata.videoInfo.id;
                    const existing = await window.api.getExistingSrt(project.path, videoId);
                    if (existing) {
                        setSrtEntries(parseSrt(existing.srtContent));
                        setSrtPath(existing.srtPath);
                        setPhase("done");
                        loadAudio(project.path, videoId);
                    }
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
            window.api.getProjectMetadata(projectPath).then((metadata: any) => {
                if (metadata && metadata.videoInfo) {
                    loadAudio(projectPath, metadata.videoInfo.id);
                }
            });
        }
    }, [phase, projectPath, audioUrl]);

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

    const handleStartTranscript = async () => {
        if (!projectPath || !selectedEngine) return;
        setProgress({ status: "preparing", progress: 0, detail: "Đang chuẩn bị..." });
        try {
            const metadata = await window.api.getProjectMetadata(projectPath);
            if (!metadata || !metadata.videoInfo) {
                alert("Không tìm thấy thông tin video!");
                return;
            }
            const videoId = metadata.videoInfo.id;

            setPhase("processing");
            window.api.transcribeAudio(projectPath, videoId);
        } catch (err) {
            console.error("Failed to start transcript:", err);
            setPhase("idle");
            setProgress({ status: "error", progress: 0, detail: "Lỗi khi bắt đầu phiên dịch." });
        }
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
        setOptimizingIndices(new Set());
        setOptimizedIndices(new Set());
        try {
            // First do local timestamp optimization
            const result = await window.api.optimizeSrt(srtPath);
            let currentEntries = srtEntries;
            if (result) {
                currentEntries = parseSrt(result.srtContent);
                setSrtEntries(currentEntries);
            }

            // Check for API key for AI optimization
            const apiKey = await window.api.getApiKey("openai");
            if (apiKey && currentEntries.length > 0) {
                // Stay in 'done' phase so the list stays visible
                setProgress({ status: "processing", progress: 0, detail: "Đang tối ưu phụ đề bằng AI..." });

                const baseUrl = await window.api.getApiKey("openai_url") || "https://api.openai.com/v1";
                const modelName = await window.api.getApiKey("openai_model") || "grok-3";
                const globalPrompt = await window.api.getApiKey("openai_prompt") || "";

                // Combine global prompt with user's custom prompt for this specific run
                let finalPrompt = "";
                if (globalPrompt && optimizePrompt) {
                    finalPrompt = `${globalPrompt}\n\nAdditional Instructions: ${optimizePrompt}`;
                } else if (optimizePrompt) {
                    finalPrompt = optimizePrompt;
                } else {
                    finalPrompt = globalPrompt;
                }

                const BATCH_SIZE = 20;
                const CONCURRENCY = 5;

                let completedCount = 0;
                const optimizedMap = new Map<number, string>();

                // Prepare batches
                const batches: SrtEntry[][] = [];
                for (let i = 0; i < currentEntries.length; i += BATCH_SIZE) {
                    batches.push(currentEntries.slice(i, i + BATCH_SIZE));
                }

                // Mark all entries as "pending optimize"
                const allIndices = new Set(currentEntries.map(e => e.index));
                setOptimizingIndices(allIndices);

                const processBatch = async (batch: SrtEntry[]) => {
                    const textsToOptimize = batch.map(e => e.text).join("\n---\n");

                    try {
                        const response = await fetch(`${baseUrl}/chat/completions`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": `Bearer ${apiKey}`,
                            },
                            body: JSON.stringify({
                                model: modelName,
                                messages: [
                                    {
                                        role: "system",
                                        content: finalPrompt ?
                                            `${finalPrompt}\n\nIMPORTANT RULES:\n- Each segment is separated by "---"\n- Return ONLY the optimized segments separated by "---", nothing else\n- Preserve the exact same number of segments`
                                            :
                                            `You are a professional subtitle editor. Enhance and correct the grammar of the following subtitle segments.\n\nIMPORTANT RULES:\n- Fix spelling and grammatical errors\n- Remove filler words (uh, um, ah, etc.)\n- Keep the original language (do not translate)\n- Each segment is separated by "---"\n- Return ONLY the optimized segments separated by "---", nothing else\n- Preserve the exact same number of segments\n- Keep it concise and maintain the original meaning`
                                    },
                                    { role: "user", content: textsToOptimize },
                                ],
                                temperature: 0.3,
                                stream: false
                            }),
                        });

                        if (!response.ok) throw new Error(await response.text());

                        const data = await response.json();
                        const optimizedText = data.choices?.[0]?.message?.content || "";
                        const optimizedParts = optimizedText.split(/\n?---\n?/);

                        batch.forEach((entry, idx) => {
                            const newText = optimizedParts[idx]?.trim() || entry.text;
                            console.log(`[AI Optimize] Seg #${entry.index}:\n  Original: "${entry.text}"\n  Optimized: "${newText}"\n`);
                            optimizedMap.set(entry.index, newText);
                        });

                    } catch (err) {
                        console.error("Batch failed, keeping original text:", err);
                        batch.forEach(entry => optimizedMap.set(entry.index, entry.text));
                    } finally {
                        completedCount += batch.length;
                        // Update entries with what we have so far
                        const partialOptimized: SrtEntry[] = currentEntries.map(entry => ({
                            ...entry,
                            text: optimizedMap.get(entry.index) || entry.text
                        }));
                        setSrtEntries(partialOptimized);

                        // Mark completed entries as "done optimizing"
                        setOptimizingIndices(prev => {
                            const next = new Set(prev);
                            batch.forEach(e => next.delete(e.index));
                            return next;
                        });
                        setOptimizedIndices(prev => {
                            const next = new Set(prev);
                            batch.forEach(e => next.add(e.index));
                            return next;
                        });

                        setProgress({
                            status: "processing",
                            progress: Math.round((completedCount / currentEntries.length) * 100),
                            detail: `Đang tối ưu phụ đề bằng AI... ${completedCount}/${currentEntries.length}`
                        });
                    }
                };

                const queue = [...batches];
                const activeWorkers: Promise<void>[] = [];

                while (queue.length > 0 || activeWorkers.length > 0) {
                    while (queue.length > 0 && activeWorkers.length < CONCURRENCY) {
                        const batch = queue.shift()!;
                        const worker = processBatch(batch).then(() => {
                            activeWorkers.splice(activeWorkers.indexOf(worker), 1);
                        });
                        activeWorkers.push(worker);
                    }

                    if (activeWorkers.length > 0) {
                        await Promise.race(activeWorkers);
                    }
                }

                const finalOptimized: SrtEntry[] = currentEntries.map(entry => ({
                    ...entry,
                    text: optimizedMap.get(entry.index) || entry.text
                }));

                const finalSrtContent = stringifySrt(finalOptimized);
                await window.api.saveSrt(srtPath, finalSrtContent);
                setSrtEntries(finalOptimized);
                setOptimizingIndices(new Set());

                // Return to done phase
                // setPhase("done"); // No longer needed as we stay in 'done' phase
                setProgress({ status: "done", progress: 100, detail: "Tối ưu hoàn tất!" });
            }
        } catch (err) {
            console.error("Optimize failed:", err);
            // setPhase("done"); // No longer needed as we stay in 'done' phase
            setOptimizingIndices(new Set());
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
        if (engineId === 'whisper-gpu-turbo') return 'gpu-turbo';
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
                            let isReady = false;

                            if (statusKey === 'gpu-turbo') {
                                isReady = engineStatus['gpu'] && engineStatus['turboModelReady'];
                            }

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
                        className="shadow-lg shadow-primary/20 px-8 relative overflow-hidden group"
                    >
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary/10 via-white/20 to-primary/10 -translate-x-full group-hover:animate-shimmer" />
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            <Play className="w-4 h-4" />
                            Bắt đầu nhận dạng
                        </span>
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
                                <p className="text-xs text-muted-foreground">{srtEntries.length} đoạn - {srtPath}</p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleRetranscript}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            Làm lại
                        </Button>
                    </div>

                    {/* Optimization Tools */}
                    <div className="bg-muted/30 border rounded-xl p-4 flex flex-col gap-3 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary" />
                                <span className="text-sm font-semibold">Tối ưu bằng AI</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Textarea
                                placeholder="Ghi chú thêm cho AI"
                                value={optimizePrompt}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOptimizePrompt(e.target.value)}
                                className="w-full min-h-[100px] text-sm resize-none overflow-y-auto [&::-webkit-scrollbar]:hidden"
                                disabled={isOptimizing}
                            />
                            <Button className="w-full group relative overflow-hidden min-h-[44px]" onClick={handleOptimize} disabled={isOptimizing}>
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary/10 via-white/20 to-primary/10 -translate-x-full group-hover:animate-shimmer" />
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    {isOptimizing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-4 h-4" />
                                    )}
                                    <span className="text-sm font-semibold">Tối ưu ngay</span>
                                </span>
                            </Button>
                        </div>
                    </div>

                    {/* Optimize Progress - shown inline when optimizing */}
                    {isOptimizing && progress && (
                        <div className="shrink-0 bg-amber-500/5 border border-amber-400/20 rounded-xl px-4 py-3 flex items-center gap-3 animate-in fade-in duration-300">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-xs font-medium text-amber-600">{progress.detail}</p>
                                    <span className="text-xs text-amber-500 font-mono shrink-0 ml-2">{Math.round(progress.progress)}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-amber-200/30 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-amber-400 rounded-full transition-all duration-300"
                                        style={{ width: `${progress.progress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

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
                                {srtEntries.map((entry) => {
                                    const isEntryOptimizing = optimizingIndices.has(entry.index);
                                    const isEntryDone = optimizedIndices.has(entry.index);
                                    return (
                                        <Card
                                            key={entry.index}
                                            className={`w-full shadow-none border transition-all cursor-pointer group py-0 gap-0 overflow-hidden
                                            ${isEntryOptimizing ? 'border-amber-400/50 bg-amber-50/5' : ''}
                                            ${isEntryDone && isOptimizing ? 'border-green-500/40' : ''}
                                            ${!isEntryOptimizing && !isEntryDone && activeSegment === entry.index ? 'border-primary/70 ring-1 ring-primary/20' : ''}
                                            ${!isEntryOptimizing && !isEntryDone && activeSegment !== entry.index ? 'hover:border-primary/30' : ''}
                                        `}
                                            onClick={() => !isEntryOptimizing && handlePlaySegment(entry)}
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
                                                <div className="flex items-center gap-1.5">
                                                    {isEntryOptimizing && (
                                                        <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                            Đang tối ưu
                                                        </span>
                                                    )}
                                                    {isEntryDone && isOptimizing && (
                                                        <span className="flex items-center gap-1 text-xs text-green-500 font-medium">
                                                            <Sparkles className="w-3 h-3" />
                                                            Đã tối ưu
                                                        </span>
                                                    )}
                                                    {!isEntryOptimizing && !isEntryDone && (
                                                        <div className={`flex items-center gap-1 text-xs transition-opacity ${activeSegment === entry.index ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-100 text-muted-foreground'}`}>
                                                            {activeSegment === entry.index && isPlaying ? (
                                                                <><Pause className="w-3 h-3" /><span>Đang phát</span></>
                                                            ) : (
                                                                <><Play className="w-3 h-3 fill-current" /><span>Phát</span></>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <CardContent className={`p-3 px-4 transition-all ${isEntryOptimizing ? 'opacity-50' :
                                                activeSegment === entry.index ? 'bg-primary/5' : ''
                                                }`}>
                                                <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
                                                    {entry.text}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
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
