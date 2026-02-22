import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Loader2,
    Languages,
    CheckCircle2,
    Play,
    Settings,
    FileText,
    ArrowRight,
    ChevronDown,
    Check,
    RotateCcw,
    Download,
} from "lucide-react";
import { parseSrt, stringifySrt, TARGET_LANGUAGES, type SrtEntry } from "@/lib/utils";
import { useProcessContext } from "@/stores/ProcessStore";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import ReactCountryFlag from "react-country-flag";

export const TranslatePhase = ({ onComplete }: { onComplete?: () => void }) => {
    const { id } = useParams();
    const [phase, setPhase] = useState<"idle" | "no-srt" | "translating" | "done">("idle");
    const [srtEntries, setSrtEntries] = useState<SrtEntry[]>([]);
    const [translatedEntries, setTranslatedEntries] = useState<SrtEntry[]>([]);
    const [selectedLang, setSelectedLang] = useState("vi");
    const [projectPath, setProjectPath] = useState("");
    const [hasApiKey, setHasApiKey] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0 });
    const [translatingIndices, setTranslatingIndices] = useState<Set<number>>(new Set());
    const [translatedIndices, setTranslatedIndices] = useState<Set<number>>(new Set());
    const [translatePrompt, setTranslatePrompt] = useState(() => {
        return localStorage.getItem("translatePrompt") || "";
    });

    useEffect(() => {
        localStorage.setItem("translatePrompt", translatePrompt);
    }, [translatePrompt]);

    const { setIsProcessing: setGlobalProcessing, isAutoProcess } = useProcessContext();

    const isAutoProcessRef = useRef(isAutoProcess);
    useEffect(() => {
        isAutoProcessRef.current = isAutoProcess;
    }, [isAutoProcess]);

    useEffect(() => {
        setGlobalProcessing(phase === "translating");
    }, [phase, setGlobalProcessing]);

    useEffect(() => {
        const init = async () => {
            setSrtEntries([]);
            setTranslatedEntries([]);
            setPhase("idle");

            // Check API key
            const apiKey = await window.api.getApiKey("openai");
            setHasApiKey(!!apiKey);

            // Get project info
            const projects = await window.api.getProjects();
            const project = projects.find((p: any) => p.id === id);
            if (project) {
                setProjectPath(project.path);

                // Check existing SRT
                const metadata = await window.api.getProjectMetadata(project.path);
                if (metadata && metadata.videoInfo) {
                    const videoId = metadata.videoInfo.id;
                    const existing = await window.api.getExistingSrt(project.path, videoId);
                    if (existing) {
                        const entries = parseSrt(existing.srtContent);
                        setSrtEntries(entries);

                        // Check if translation exists for current lang
                        const translatedContent = await window.api.getTranslatedSrt(project.path, videoId, selectedLang);
                        if (translatedContent) {
                            setTranslatedEntries(parseSrt(translatedContent));
                            setPhase("done");
                        } else {
                            setPhase("idle");
                        }
                    } else {
                        setPhase("no-srt");
                    }
                }
            }
            setIsChecking(false); // This line was misplaced, moved inside the init function.
        };

        init();
    }, [id, selectedLang]); // Added selectedLang to dependencies as it's used in init.

    const handleExport = async (format: "srt" | "txt") => {
        if (!translatedEntries.length) return;

        let content = "";
        let extension = "";
        let defaultName = `subtitles_${selectedLang}_${Date.now()}`;

        if (format === "srt") {
            content = stringifySrt(translatedEntries);
            extension = "srt";
        } else {
            content = translatedEntries.map(e => e.text).join("\n");
            extension = "txt";
        }

        const success = await window.api.exportSubtitle(content, `${defaultName}.${extension}`, [extension]);
        if (success) {
            // Optional: show a toast or success message
        }
    };

    // Check translation when language changes
    useEffect(() => {
        const checkTranslation = async () => {
            if (!projectPath || phase === "translating" || phase === "no-srt") return;

            const metadata = await window.api.getProjectMetadata(projectPath);
            if (!metadata || !metadata.videoInfo) return;
            const videoId = metadata.videoInfo.id;

            const translatedContent = await window.api.getTranslatedSrt(projectPath, videoId, selectedLang);
            if (translatedContent) {
                setTranslatedEntries(parseSrt(translatedContent));
                setPhase("done");
            } else {
                setTranslatedEntries([]);
                setPhase("idle");
            }
        };
        checkTranslation();
    }, [selectedLang, projectPath]);

    const autoStartedRef = useRef(false);

    useEffect(() => {
        if (isAutoProcess && phase === "idle" && !autoStartedRef.current && srtEntries.length > 0 && hasApiKey && projectPath) {
            // Check if already done (the init block finds translatedSrt and sets to "done")
            // Wait, the init hook sets to "done" if it exists. So it'll only auto start if idle.
            autoStartedRef.current = true;
            setTimeout(() => {
                handleStartTranslate();
            }, 500);
        }
    }, [isAutoProcess, phase, srtEntries.length, hasApiKey, projectPath]);

    const handleStartTranslate = async () => {
        if (!projectPath || !hasApiKey || srtEntries.length === 0) return;
        setPhase("translating");
        setProgress({ current: 0, total: srtEntries.length, percent: 0 });

        // Mark all entries as pending
        const allIndices = new Set(srtEntries.map(e => e.index));
        setTranslatingIndices(allIndices);
        setTranslatedIndices(new Set());
        // Initialize translated entries with original text as placeholder
        setTranslatedEntries(srtEntries.map(e => ({ ...e, text: "" })));

        try {
            const apiKey = await window.api.getApiKey("openai");
            const baseUrl = await window.api.getApiKey("openai_url") || "https://api.openai.com/v1";
            const modelName = await window.api.getApiKey("openai_model") || "grok-3";
            const globalPrompt = await window.api.getApiKey("openai_prompt") || "";
            const langName = TARGET_LANGUAGES.find(l => l.code === selectedLang)?.name || selectedLang;

            let finalPrompt = "";
            if (globalPrompt && translatePrompt) {
                finalPrompt = `${globalPrompt}\n\nAdditional Translation Instructions: ${translatePrompt}`;
            } else if (translatePrompt) {
                finalPrompt = translatePrompt;
            } else {
                finalPrompt = globalPrompt;
            }

            localStorage.setItem("translatePrompt", translatePrompt);

            const BATCH_SIZE = 20;
            const CONCURRENCY = 5;

            const batches: SrtEntry[][] = [];
            for (let i = 0; i < srtEntries.length; i += BATCH_SIZE) {
                batches.push(srtEntries.slice(i, i + BATCH_SIZE));
            }

            let completedCount = 0;
            const translatedMap = new Map<number, string>();

            const processBatch = async (batch: SrtEntry[]) => {
                const textsToTranslate = batch.map(e => e.text).join("\n---\n");

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
                                        `${finalPrompt}\n\nIMPORTANT RULES:\n- Translate to ${langName}\n- Keep translations natural, conversational, and suitable for voice-over dubbing\n- Each segment is separated by "---"\n- Return ONLY the translated segments separated by "---", nothing else\n- Preserve the same number of segments\n- Keep proper nouns unchanged if appropriate\n- Translations should be concise and match subtitle timing`
                                        :
                                        `You are a professional subtitle translator. Translate subtitle segments from English to ${langName}.\n\nIMPORTANT RULES:\n- Keep translations natural, conversational, and suitable for voice-over dubbing\n- Each segment is separated by "---"\n- Return ONLY the translated segments separated by "---", nothing else\n- Preserve the same number of segments\n- Keep proper nouns (names, places etc.) unchanged if appropriate\n- Translations should be concise and match subtitle timing`
                                },
                                { role: "user", content: textsToTranslate },
                            ],
                            temperature: 0.3,
                            stream: false
                        }),
                    });

                    if (!response.ok) throw new Error(await response.text());

                    const data = await response.json();
                    const translatedText = data.choices?.[0]?.message?.content || "";
                    const translatedParts = translatedText.split(/\n?---\n?/);

                    batch.forEach((entry, idx) => {
                        translatedMap.set(entry.index, translatedParts[idx]?.trim() || entry.text);
                    });

                } catch (err) {
                    console.error("Batch failed, keeping original text:", err);
                    batch.forEach(entry => translatedMap.set(entry.index, entry.text));
                } finally {
                    completedCount += batch.length;

                    // Update translated entries with what we have so far
                    const partial: SrtEntry[] = srtEntries.map(entry => ({
                        ...entry,
                        text: translatedMap.get(entry.index) || "",
                    }));
                    setTranslatedEntries(partial);

                    // Update indices state
                    setTranslatingIndices(prev => {
                        const next = new Set(prev);
                        batch.forEach(e => next.delete(e.index));
                        return next;
                    });
                    setTranslatedIndices(prev => {
                        const next = new Set(prev);
                        batch.forEach(e => next.add(e.index));
                        return next;
                    });

                    setProgress({
                        current: completedCount,
                        total: srtEntries.length,
                        percent: Math.round((completedCount / srtEntries.length) * 100),
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

            const finalTranslated: SrtEntry[] = srtEntries.map(entry => ({
                ...entry,
                text: translatedMap.get(entry.index) || entry.text
            }));

            // Save to file
            const srtContent = stringifySrt(finalTranslated);
            const metadata = await window.api.getProjectMetadata(projectPath);
            if (!metadata || !metadata.videoInfo) return;
            const videoId = metadata.videoInfo.id;

            await window.api.saveTranslatedSrt(projectPath, videoId, selectedLang, srtContent);

            setTranslatedEntries(finalTranslated);
            setTranslatingIndices(new Set());
            setPhase("done");

            if (isAutoProcessRef.current && onComplete) {
                onComplete();
            }
        } catch (error) {
            console.error("Translation failed:", error);
            setTranslatingIndices(new Set());
            setPhase("idle");
        }
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

            {/* NO SRT STATE */}
            {phase === "no-srt" && (
                <div className="text-center space-y-4 animate-in fade-in duration-300">
                    <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto" />
                    <h2 className="text-xl font-bold">Chưa có phụ đề</h2>
                    <p className="text-sm text-muted-foreground">
                        Hãy tạo phụ đề trước khi dịch. Quay lại tab "Tạo phụ đề" để bắt đầu.
                    </p>
                </div>
            )}

            {/* IDLE STATE */}
            {phase === "idle" && srtEntries.length > 0 && (
                <div className="w-full max-w-lg animate-in fade-in duration-300 space-y-6">
                    <div className="text-center space-y-2">
                        <Languages className="w-12 h-12 text-primary mx-auto" />
                        <h2 className="text-xl font-bold">Dịch phụ đề</h2>
                        <p className="text-sm text-muted-foreground">
                            {srtEntries.length} đoạn phụ đề sẵn sàng để dịch
                        </p>
                    </div>

                    {/* API Key Status */}
                    {!hasApiKey && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-center">
                            <p className="text-sm text-amber-600 font-medium">
                                ⚠️ Chưa có API key OpenAI
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Vui lòng thêm API key ở trang chủ để sử dụng tính năng dịch.
                            </p>
                        </div>
                    )}

                    {/* Language Selection */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold">Chọn ngôn ngữ đích</h3>
                        <div className="w-full">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between h-12">
                                        {(() => {
                                            const lang = TARGET_LANGUAGES.find(l => l.code === selectedLang);
                                            return (
                                                <span className="flex items-center gap-3">
                                                    <span className="text-xl flex items-center justify-center">
                                                        <ReactCountryFlag countryCode={lang?.flag || ""} svg />
                                                    </span>
                                                    <span className="font-medium">{lang?.name}</span>
                                                </span>
                                            );
                                        })()}
                                        <ChevronDown className="w-4 h-4 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-[300px]" align="start">
                                    {TARGET_LANGUAGES.map(lang => (
                                        <DropdownMenuItem
                                            key={lang.code}
                                            onClick={() => setSelectedLang(lang.code)}
                                            className="flex items-center gap-3 py-2.5 cursor-pointer"
                                        >
                                            <span className="text-lg flex items-center justify-center">
                                                <ReactCountryFlag countryCode={lang.flag} svg />
                                            </span>
                                            <span className="font-medium">{lang.name}</span>
                                            {selectedLang === lang.code && (
                                                <Check className="ml-auto w-4 h-4 text-primary" />
                                            )}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>

                    {/* Custom Prompt Configuration */}
                    <div className="bg-muted/30 border rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Settings className="w-4 h-4 text-primary" />
                                <span className="text-sm font-semibold">Cấu hình dịch (Tuỳ chọn)</span>
                            </div>
                        </div>
                        <Textarea
                            placeholder="Ghi chú thêm cho AI (vd: dịch sang phong cách cổ trang, xưng hô anh/em...)"
                            value={translatePrompt}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                setTranslatePrompt(e.target.value);
                                localStorage.setItem("translatePrompt", e.target.value);
                            }}
                            className="w-full min-h-[60px] text-sm resize-none"
                        />
                    </div>

                    {/* Start Button */}
                    <Button
                        className="w-full gap-2 relative overflow-hidden group"
                        size="lg"
                        onClick={handleStartTranslate}
                        disabled={!hasApiKey}
                    >
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary/10 via-white/20 to-primary/10 -translate-x-full group-hover:animate-shimmer" />
                        <Play className="w-4 h-4" />
                        Bắt đầu dịch
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </div>
            )}

            {/* TRANSLATING + DONE STATE — combined streaming view */}
            {(phase === "translating" || phase === "done") && (srtEntries.length > 0) && (
                <div className="w-full h-full flex flex-col gap-3 animate-in fade-in duration-300 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            {phase === "translating" ? (
                                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                            )}
                            <div>
                                <h2 className="text-lg font-bold">
                                    {phase === "translating" ? "Đang dịch..." : "Dịch xong!"}
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    {phase === "translating"
                                        ? `${progress.current} / ${progress.total} đoạn (${progress.percent}%)`
                                        : `${translatedEntries.length} đoạn sang ${TARGET_LANGUAGES.find(l => l.code === selectedLang)?.name}`}
                                </p>
                            </div>
                        </div>
                        {phase === "done" && (
                            <div className="flex items-center gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="gap-2 relative overflow-hidden group">
                                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 -translate-x-full group-hover:animate-shimmer" />
                                            <span className="relative z-10 flex items-center justify-center gap-1.5">
                                                <Download className="w-3.5 h-3.5" />
                                                Xuất file
                                            </span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        <DropdownMenuItem onClick={() => handleExport("srt")} className="gap-2 cursor-pointer">
                                            <FileText className="w-4 h-4" />
                                            SRT Subtitle (.srt)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExport("txt")} className="gap-2 cursor-pointer">
                                            <FileText className="w-4 h-4" />
                                            Plain Text (.txt)
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <Button variant="outline" size="sm" onClick={() => {
                                    setTranslatedEntries([]);
                                    setPhase("idle");
                                }} className="gap-2 relative overflow-hidden group">
                                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 -translate-x-full group-hover:animate-shimmer" />
                                    <span className="relative z-10 flex items-center justify-center gap-1.5">
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Dịch lại
                                    </span>
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Progress bar — only while translating */}
                    {phase === "translating" && (
                        <div className="shrink-0">
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-300"
                                    style={{ width: `${progress.percent}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Side-by-side comparison with streaming */}
                    <div className="flex-1 overflow-y-auto border rounded-xl">
                        <div className="divide-y">
                            {srtEntries.map((srcEntry, i) => {
                                const isEntryTranslating = translatingIndices.has(srcEntry.index);
                                const isEntryDone = translatedIndices.has(srcEntry.index);
                                const translatedEntry = translatedEntries[i];
                                const translatedText = translatedEntry?.text || "";
                                return (
                                    <div
                                        key={srcEntry.index}
                                        className={`grid grid-cols-2 divide-x transition-colors ${isEntryTranslating
                                                ? "bg-primary/5 border-l-2 border-l-primary/40"
                                                : "hover:bg-muted/30"
                                            }`}
                                    >
                                        {/* Original */}
                                        <div className="p-3">
                                            <p className="text-xs text-muted-foreground font-mono mb-1">
                                                #{srcEntry.index} • {srcEntry.startTime}
                                            </p>
                                            <p className="text-sm">{srcEntry.text}</p>
                                        </div>
                                        {/* Translation */}
                                        <div className="p-3">
                                            <p className="text-xs font-mono mb-1 flex items-center gap-1.5">
                                                {isEntryTranslating ? (
                                                    <span className="flex items-center gap-1 text-primary/70">
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                        Đang dịch...
                                                    </span>
                                                ) : isEntryDone || phase === "done" ? (
                                                    <span className="flex items-center gap-1 text-primary">
                                                        <ReactCountryFlag countryCode={TARGET_LANGUAGES.find(l => l.code === selectedLang)?.flag || ""} svg />
                                                        Bản dịch
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground/40">Chờ dịch...</span>
                                                )}
                                            </p>
                                            <p className={`text-sm transition-opacity ${isEntryTranslating ? "opacity-30" : "opacity-100"}`}>
                                                {translatedText}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
