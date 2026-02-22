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
} from "lucide-react";
import { parseSrt, stringifySrt, MINECRAFT_GLOSSARY, TARGET_LANGUAGES, type SrtEntry } from "@/lib/utils";
import { useProcessContext } from "@/stores/ProcessStore";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

            const apiKey = await window.api.getApiKey("deepseek");
            setHasApiKey(!!apiKey);

            const projects = await window.api.getProjects();
            const project = projects.find((p: any) => p.id === id);
            if (project) {
                setProjectPath(project.path);

                const existing = await window.api.getExistingSrt(project.path);
                if (existing) {
                    const entries = parseSrt(existing.srtContent);
                    setSrtEntries(entries);

                    const translatedContent = await window.api.getTranslatedSrt(project.path, selectedLang);
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
            setIsChecking(false);
        };

        init();
    }, [id]);

    useEffect(() => {
        const checkTranslation = async () => {
            if (!projectPath || phase === "translating" || phase === "no-srt") return;

            const translatedContent = await window.api.getTranslatedSrt(projectPath, selectedLang);
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

        try {
            const apiKey = await window.api.getApiKey("deepseek");
            const langName = TARGET_LANGUAGES.find(l => l.code === selectedLang)?.name || selectedLang;

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
                    const response = await fetch("https://api.deepseek.com/chat/completions", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${apiKey}`,
                        },
                        body: JSON.stringify({
                            model: "deepseek-chat",
                            messages: [
                                {
                                    role: "system",
                                    content: `You are a professional Minecraft subtitle translator. Translate subtitle segments from English to ${langName}.

IMPORTANT RULES:
- Use official Minecraft terminology for the target language
- Keep translations natural, conversational, and suitable for voice-over dubbing
- Each segment is separated by "---"
- Return ONLY the translated segments separated by "---", nothing else
- Preserve the same number of segments
- Keep proper nouns (player names, server names) unchanged
- Translations should be concise and match subtitle timing

${MINECRAFT_GLOSSARY(langName)}`
                                },
                                {
                                    role: "user",
                                    content: textsToTranslate,
                                },
                            ],
                            temperature: 0.3,
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

            const srtContent = stringifySrt(finalTranslated);
            await window.api.saveTranslatedSrt(projectPath, selectedLang, srtContent);

            setTranslatedEntries(finalTranslated);
            setPhase("done");

            if (isAutoProcessRef.current && onComplete) {
                onComplete();
            }
        } catch (error) {
            console.error("Translation failed:", error);
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

            { }
            {phase === "no-srt" && (
                <div className="text-center space-y-4 animate-in fade-in duration-300">
                    <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto" />
                    <h2 className="text-xl font-bold">Chưa có phụ đề</h2>
                    <p className="text-sm text-muted-foreground">
                        Hãy tạo phụ đề trước khi dịch. Quay lại tab "Tạo phụ đề" để bắt đầu.
                    </p>
                </div>
            )}

            { }
            {phase === "idle" && srtEntries.length > 0 && (
                <div className="w-full max-w-lg animate-in fade-in duration-300 space-y-6">
                    <div className="text-center space-y-2">
                        <Languages className="w-12 h-12 text-primary mx-auto" />
                        <h2 className="text-xl font-bold">Dịch phụ đề</h2>
                        <p className="text-sm text-muted-foreground">
                            {srtEntries.length} đoạn phụ đề sẵn sàng để dịch
                        </p>
                    </div>

                    { }
                    {!hasApiKey && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-center">
                            <p className="text-sm text-amber-600 font-medium">
                                ⚠️ Chưa có API key DeepSeek
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Vui lòng thêm API key ở trang chủ để sử dụng tính năng dịch.
                            </p>
                        </div>
                    )}

                    { }
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

                    { }
                    <Button
                        className="w-full gap-2"
                        size="lg"
                        onClick={handleStartTranslate}
                        disabled={!hasApiKey}
                    >
                        <Play className="w-4 h-4" />
                        Bắt đầu dịch
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </div>
            )}

            { }
            {phase === "translating" && (
                <div className="w-full max-w-lg space-y-6 animate-in fade-in duration-300">
                    <div className="text-center space-y-2">
                        <h2 className="text-xl font-bold">Đang dịch...</h2>
                        <p className="text-sm text-muted-foreground">
                            {progress.current} / {progress.total} đoạn ({progress.percent}%)
                        </p>
                    </div>
                    <Progress value={progress.percent} className="w-full" />
                </div>
            )}

            { }
            {phase === "done" && translatedEntries.length > 0 && (
                <div className="w-full h-full flex flex-col gap-4 animate-in fade-in duration-300 overflow-hidden">
                    { }
                    <div className="flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <div>
                                <h2 className="text-lg font-bold">Dịch xong!</h2>
                                <p className="text-xs text-muted-foreground">
                                    {translatedEntries.length} đoạn đã được dịch sang {TARGET_LANGUAGES.find(l => l.code === selectedLang)?.name}
                                    <br />
                                    <span className="text-primary">Đã lưu file vào thư mục translate/</span>
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                                setTranslatedEntries([]);
                                setPhase("idle");
                            }}>
                                Dịch lại
                            </Button>
                            {onComplete && (
                                <Button size="sm" onClick={onComplete} className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
                                    Tiếp tục
                                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                                </Button>
                            )}
                        </div>
                    </div>

                    { }
                    <div className="flex-1 overflow-y-auto border rounded-xl">
                        <div className="divide-y">
                            {translatedEntries.map((entry, i) => (
                                <div key={entry.index} className="grid grid-cols-2 divide-x hover:bg-muted/30 transition-colors">
                                    <div className="p-3">
                                        <p className="text-xs text-muted-foreground font-mono mb-1">
                                            #{entry.index} • {srtEntries[i]?.startTime}
                                        </p>
                                        <p className="text-sm">{srtEntries[i]?.text}</p>
                                    </div>
                                    <div className="p-3">
                                        <p className="text-xs text-primary font-mono mb-1 flex items-center gap-2">
                                            <ReactCountryFlag countryCode={TARGET_LANGUAGES.find(l => l.code === selectedLang)?.flag || ""} svg /> Bản dịch
                                        </p>
                                        <p className="text-sm">{entry.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
