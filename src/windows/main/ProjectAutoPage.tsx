import { Spinner } from '@/components/ui/spinner';
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Play,
    
    CheckCircle2,
    Settings,
    Sparkles} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WHISPER_LANGUAGES, LANGUAGE_TO_COUNTRY, TARGET_LANGUAGES } from "@/lib/utils";
import ReactCountryFlag from "react-country-flag";
import { motion, AnimatePresence } from "motion/react";
import { useAutoPipeline, type AutoPhase, AUTO_PHASE_LABELS } from "@/stores/AutoPipelineStore";
import { useHardwareStore } from "@/stores/HardwareStore";

export const ProjectAutoPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentPhase, setCurrentPhase, markPhaseCompleted, resetPipeline } = useAutoPipeline();
    const { hasNvidiaGpu } = useHardwareStore();

    const [projectPath, setProjectPath] = useState("");
    const [projectName, setProjectName] = useState("");
    const [phaseProgress, setPhaseProgress] = useState(0);
    const [phaseDetail, setPhaseDetail] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Config state
    const [whisperEngine, setWhisperEngine] = useState("whisper-cpp-cpu");
    const [sourceLanguage, setSourceLanguage] = useState("auto");
    const [targetLanguage, setTargetLanguage] = useState("vi");
    const [selectedPromptId, setSelectedPromptId] = useState("");
    const [prompts, setPrompts] = useState<{ id: string; name: string; systemPrompt: string }[]>([]);
    const [hasApiKey, setHasApiKey] = useState(false);
    const [isReady, setIsReady] = useState(false);

    const abortRef = useRef(false);

    useEffect(() => {
        return () => { resetPipeline(); };
    }, []);

    useEffect(() => {
        const init = async () => {
            if (!id) return;
            const projects = await window.api.getProjects();
            const proj = projects.find((p: any) => p.id === id);
            if (proj) {
                setProjectPath(proj.path);
                setProjectName(proj.name);
            }

            const apiKey = await window.api.getApiKey("deepseek");
            setHasApiKey(!!apiKey);

            const loadedPrompts = await window.api.getPrompts();
            setPrompts(loadedPrompts);
            const activePromptId = await window.api.getActivePromptId();
            if (activePromptId && loadedPrompts.find((p: any) => p.id === activePromptId)) {
                setSelectedPromptId(activePromptId);
            } else if (loadedPrompts.length > 0) {
                setSelectedPromptId(loadedPrompts[0].id);
            }

            setIsReady(true);
        };
        init();
    }, [id]);


    const handleStart = () => {
        if (!projectPath || !hasApiKey) return;
        abortRef.current = false;
        setError(null);
        setCurrentPhase("input");
        runPipeline();
    };

    const runPipeline = async () => {
        try {
            // Phase 1: Check if input already done
            setCurrentPhase("input");
            setPhaseDetail("Kiểm tra video...");
            setPhaseProgress(0);

            const metadata = await window.api.getProjectMetadata(projectPath);
            if (metadata?.status === "completed" && (metadata.videoInfo || metadata.localFile)) {
                markPhaseCompleted("input");
                setPhaseProgress(100);
            } else {
                setError("Chưa có video. Vui lòng nhập video ở chế độ thủ công trước.");
                return;
            }
            if (abortRef.current) return;

            // Phase 2: Transcript
            setCurrentPhase("transcript");
            setPhaseDetail("Đang tạo phụ đề...");
            setPhaseProgress(0);

            const existingSrt = await window.api.getExistingSrt(projectPath);
            if (existingSrt) {
                markPhaseCompleted("transcript");
                setPhaseProgress(100);
                setPhaseDetail("Phụ đề đã có sẵn");
            } else {
                await new Promise<void>((resolve, reject) => {
                    window.api.onTranscriptProgress((progress: any) => {
                        setPhaseProgress(progress.percent || 0);
                        setPhaseDetail(progress.detail || "Đang xử lý...");
                    });
                    window.api.onTranscriptComplete((success: boolean) => {
                        window.api.removeTranscriptListeners();
                        if (success) {
                            markPhaseCompleted("transcript");
                            setPhaseProgress(100);
                            resolve();
                        } else {
                            reject(new Error("Tạo phụ đề thất bại"));
                        }
                    });
                    window.api.transcribeAudio(projectPath, whisperEngine, sourceLanguage);
                });
            }
            if (abortRef.current) return;

            // Phase 3: Translate
            setCurrentPhase("translate");
            setPhaseDetail("Kiểm tra bản dịch...");
            setPhaseProgress(0);

            const translatedContent = await window.api.getTranslatedSrt(projectPath, targetLanguage);
            if (translatedContent) {
                markPhaseCompleted("translate");
                setPhaseProgress(100);
                setPhaseDetail("Bản dịch đã có sẵn");
            } else {
                // Need to translate
                const { parseSrt, stringifySrt } = await import("@/lib/utils");
                const srtData = await window.api.getExistingSrt(projectPath);
                if (!srtData) throw new Error("Không tìm thấy file SRT");

                const srtEntries = parseSrt(srtData.srtContent);
                const apiKey = await window.api.getApiKey("deepseek");
                const langName = TARGET_LANGUAGES.find(l => l.code === targetLanguage)?.name || targetLanguage;
                const promptConfig = prompts.find(p => p.id === selectedPromptId) || prompts[0];
                const userPrompt = promptConfig?.systemPrompt || "";

                const systemPrompt = `Translate subtitle segments to ${langName}.

FORMAT RULES:
- Each segment is separated by "---"
- Return ONLY the translated segments separated by "---", nothing else
- Preserve the same number of segments
- Do NOT add any extra text, explanation, or numbering

${userPrompt}`.trim();

                const BATCH_SIZE = 20;
                const CONCURRENCY = 5;
                const batches: any[][] = [];
                for (let i = 0; i < srtEntries.length; i += BATCH_SIZE) {
                    batches.push(srtEntries.slice(i, i + BATCH_SIZE));
                }

                let completedCount = 0;
                const translatedMap = new Map<number, string>();

                const processBatch = async (batch: any[]) => {
                    const textsToTranslate = batch.map((e: any) => e.text).join("\n---\n");
                    try {
                        const response = await fetch("https://api.deepseek.com/chat/completions", {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
                            body: JSON.stringify({
                                model: "deepseek-chat",
                                messages: [
                                    { role: "system", content: systemPrompt },
                                    { role: "user", content: textsToTranslate },
                                ],
                                temperature: 0.3})});
                        if (!response.ok) throw new Error(await response.text());
                        const data = await response.json();
                        const translatedParts = (data.choices?.[0]?.message?.content || "").split(/\n?---\n?/);
                        batch.forEach((entry: any, idx: number) => {
                            translatedMap.set(entry.index, translatedParts[idx]?.trim() || entry.text);
                        });
                    } catch {
                        batch.forEach((entry: any) => translatedMap.set(entry.index, entry.text));
                    } finally {
                        completedCount += batch.length;
                        setPhaseProgress(Math.round((completedCount / srtEntries.length) * 100));
                        setPhaseDetail(`Đang dịch... ${completedCount}/${srtEntries.length}`);
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
                    if (activeWorkers.length > 0) await Promise.race(activeWorkers);
                }

                const finalTranslated = srtEntries.map((entry: any) => ({
                    ...entry,
                    text: translatedMap.get(entry.index) || entry.text}));
                await window.api.saveTranslatedSrt(projectPath, targetLanguage, stringifySrt(finalTranslated));
                markPhaseCompleted("translate");
                setPhaseProgress(100);
            }
            if (abortRef.current) return;

            // Phase 4: Audio
            setCurrentPhase("audio");
            setPhaseDetail("Tạo audio...");
            setPhaseProgress(0);

            const existingAudioFiles = await window.api.listGeneratedAudio(projectPath);
            if (existingAudioFiles && existingAudioFiles.length > 0) {
                markPhaseCompleted("audio");
                setPhaseProgress(100);
                setPhaseDetail("Audio đã có sẵn");
            } else {
                await new Promise<void>((resolve, reject) => {
                    window.api.onAudioGenerateProgress((progress: any) => {
                        if (progress.current !== undefined && progress.total) {
                            const pct = Math.round((progress.current / progress.total) * 100);
                            setPhaseProgress(pct);
                            setPhaseDetail(`Đang tạo audio... ${progress.current}/${progress.total}`);
                        }
                        if (progress.status === "done") {
                            window.api.removeAudioGenerateListeners();
                            markPhaseCompleted("audio");
                            setPhaseProgress(100);
                            resolve();
                        } else if (progress.status === "error") {
                            window.api.removeAudioGenerateListeners();
                            reject(new Error("Tạo audio thất bại"));
                        }
                    });

                    window.api.generateAudio(projectPath, targetLanguage);
                });
            }
            if (abortRef.current) return;

            // Phase 5: Final video
            setCurrentPhase("final");
            setPhaseDetail("Tạo video cuối...");
            setPhaseProgress(0);

            await new Promise<void>((resolve, reject) => {
                window.api.onFinalVideoProgress((progress: any) => {
                    setPhaseProgress(progress.percent || 0);
                    setPhaseDetail(progress.detail || "Đang xử lý video...");

                    if (progress.status === "done") {
                        window.api.removeFinalVideoListeners();
                        markPhaseCompleted("final");
                        setPhaseProgress(100);
                        resolve();
                    } else if (progress.status === "error") {
                        window.api.removeFinalVideoListeners();
                        reject(new Error("Tạo video cuối thất bại"));
                    }
                });

                window.api.createFinalVideo(projectPath);
            });

            // Done!
            setCurrentPhase("done");
            setPhaseDetail("Hoàn tất pipeline!");
            setPhaseProgress(100);

        } catch (err: any) {
            setError(err?.message || "Có lỗi xảy ra");
        }
    };

    if (!isReady) {
        return (
            <div className="flex items-center justify-center h-full">
                <Spinner className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Main Content */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
                <AnimatePresence mode="wait">
                    {/* Config Phase */}
                    {currentPhase === "config" && (
                        <motion.div
                            key="config"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.25 }}
                            className="w-full max-w-lg space-y-6"
                        >
                            <div className="text-center space-y-2">
                                <Sparkles className="w-12 h-12 text-primary mx-auto" />
                                <h2 className="text-xl font-bold">Xử lý tự động</h2>
                                <p className="text-sm text-muted-foreground">
                                    Cấu hình pipeline và tool sẽ tự động chạy qua tất cả các bước.
                                </p>
                            </div>

                            {!hasApiKey && (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-center">
                                    <p className="text-sm text-amber-600 font-medium">
                                        ⚠️ Chưa có API key DeepSeek
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Cần API key để dịch phụ đề. Thêm ở Cài đặt.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Whisper Engine</label>
                                    <Select value={whisperEngine} onValueChange={setWhisperEngine}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="whisper-cpp-cpu">Whisper.cpp (CPU)</SelectItem>
                                            <SelectItem value="whisper-cpp-gpu" disabled={!hasNvidiaGpu}>Whisper.cpp (GPU) {!hasNvidiaGpu && "(Không hỗ trợ)"}</SelectItem>
                                            <SelectItem value="assemblyai">AssemblyAI (Cloud)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Ngôn ngữ nguồn (audio gốc)</label>
                                    <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {WHISPER_LANGUAGES.map(lang => (
                                                <SelectItem key={lang.code} value={lang.code}>
                                                    <span className="flex items-center gap-2">
                                                        {lang.code !== "auto" && LANGUAGE_TO_COUNTRY[lang.code] && (
                                                            <ReactCountryFlag countryCode={LANGUAGE_TO_COUNTRY[lang.code]} svg className="text-base" />
                                                        )}
                                                        <span>{lang.name}</span>
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">Prompt dịch</label>
                                        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => window.api.openSettingsWindow()}>
                                            <Settings className="w-3 h-3 mr-1" /> Quản lý
                                        </Button>
                                    </div>
                                    <Select value={selectedPromptId} onValueChange={setSelectedPromptId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Chọn prompt..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {prompts.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Ngôn ngữ đích (dịch sang)</label>
                                    <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TARGET_LANGUAGES.map(lang => (
                                                <SelectItem key={lang.code} value={lang.code}>
                                                    <span className="flex items-center gap-2">
                                                        <ReactCountryFlag countryCode={lang.flag} svg className="text-base" />
                                                        <span>{lang.name}</span>
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Button
                                className="w-full gap-2"
                                size="lg"
                                onClick={handleStart}
                                disabled={!hasApiKey || !projectPath}
                            >
                                <Play className="w-4 h-4" />
                                Bắt đầu xử lý tự động
                            </Button>

                            {error && (
                                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
                                    <p className="text-sm text-destructive font-medium">{error}</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Running Phases */}
                    {currentPhase !== "config" && currentPhase !== "done" && (
                        <motion.div
                            key={currentPhase}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.2 }}
                            className="w-full max-w-lg space-y-6"
                        >
                            <div className="text-center space-y-2">
                                <Spinner className="w-12 h-12 text-primary mx-auto animate-spin" />
                                <h2 className="text-xl font-bold">
                                    {AUTO_PHASE_LABELS.find(p => p.key === currentPhase)?.label || "Đang xử lý"}
                                </h2>
                                <p className="text-sm text-muted-foreground">{phaseDetail}</p>
                            </div>
                            <Progress value={phaseProgress} className="w-full" />
                            {error && (
                                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
                                    <p className="text-sm text-destructive font-medium">{error}</p>
                                    <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate(`/project/${id}`)}>
                                        Chuyển sang chế độ thủ công
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Done */}
                    {currentPhase === "done" && (
                        <motion.div
                            key="done"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="w-full max-w-lg space-y-6 text-center"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.1 }}
                            >
                                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
                            </motion.div>
                            <h2 className="text-2xl font-bold">Hoàn tất!</h2>
                            <p className="text-sm text-muted-foreground">
                                Pipeline đã xử lý xong toàn bộ. Video cuối đã được tạo thành công.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <Button variant="outline" onClick={() => navigate(`/project/${id}?tab=final`)}>
                                    Xem video
                                </Button>
                                <Button onClick={() => navigate("/")}>
                                    Về trang chủ
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};
