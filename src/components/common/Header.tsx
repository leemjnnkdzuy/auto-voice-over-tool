import { Spinner } from '@/components/ui/spinner';
import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams, matchPath } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, CheckCircle2, Circle} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProcessContext } from "@/stores/ProcessStore";
import { useAutoPipeline, AUTO_PHASE_LABELS } from "@/stores/AutoPipelineStore";
import { motion } from "motion/react";

export const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

    const parsedPath = matchPath("/project/:id", location.pathname) || matchPath("/project/:id/auto", location.pathname);
    const projectId = parsedPath ? parsedPath.params.id : null;
    const isAutoPage = !!matchPath("/project/:id/auto", location.pathname);

    const isProjectPage = !!projectId;
    const currentTab = searchParams.get("tab") || "download";
    const { isProcessing } = useProcessContext();
    const { currentPhase, completedPhases } = useAutoPipeline();

    const [projectName, setProjectName] = useState("");
    const [projectDate, setProjectDate] = useState("");
    const [projectPath, setProjectPath] = useState("");
    const [phaseStatus, setPhaseStatus] = useState({
        download: false,
        transcript: false,
        translate: false,
        audio: false,
        final: false});

    useEffect(() => {
        if (projectId) {
            window.api.getProjects().then((projects) => {
                const proj = projects.find(p => p.id === projectId);
                if (proj) {
                    setProjectName(proj.name);
                    setProjectPath(proj.path);
                    if (proj.createdAt) {
                        try {
                            const date = new Date(proj.createdAt);
                            setProjectDate(date.toLocaleDateString('vi-VN'));
                        } catch {
                            setProjectDate("");
                        }
                    }
                }
            });
        }
    }, [projectId]);

    useEffect(() => {
        if (!projectPath) return;

        const checkPhases = async () => {
            try {
                const status = await window.api.checkProjectPhases(projectPath);
                setPhaseStatus(prev => {
                    if (prev.download !== status.download ||
                        prev.transcript !== status.transcript ||
                        prev.translate !== status.translate ||
                        prev.audio !== status.audio ||
                        prev.final !== status.final) {
                        return status;
                    }
                    return prev;
                });
            } catch {
            }
        };

        checkPhases();
        const intervalId = setInterval(checkPhases, 1000);
        return () => clearInterval(intervalId);
    }, [projectPath]);

    const getPhaseIndex = (key: string) => AUTO_PHASE_LABELS.findIndex(p => p.key === key);

    return (
        <header className="border-b bg-background px-6 py-3 flex items-center justify-between h-16 shrink-0 z-50 relative">
            <div className="flex items-center gap-4">
                {isProjectPage && (
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="-ml-3" disabled={isProcessing}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="flex flex-col">
                            <span className="font-semibold text-sm leading-none">{projectName}</span>
                            {projectDate && (
                                <span className="text-xs text-muted-foreground mt-1">
                                    {projectDate}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Manual mode: 5-step tabs */}
            {isProjectPage && !isAutoPage && (
                <Tabs
                    value={currentTab}
                    onValueChange={(val) => !isProcessing && setSearchParams({ tab: val })}
                    className="absolute left-1/2 -translate-x-1/2 w-[800px]"
                >
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="download" disabled={isProcessing}>1. Nhập video</TabsTrigger>
                        <TabsTrigger value="transcript" disabled={isProcessing || !phaseStatus.download}>2. Tạo phụ đề</TabsTrigger>
                        <TabsTrigger value="translate" disabled={isProcessing || !phaseStatus.transcript}>3. Dịch phụ đề</TabsTrigger>
                        <TabsTrigger value="audio" disabled={isProcessing || !phaseStatus.translate}>4. Tạo audio</TabsTrigger>
                        <TabsTrigger value="final" disabled={isProcessing || !phaseStatus.audio}>5. Tạo video</TabsTrigger>
                    </TabsList>
                </Tabs>
            )}

            {/* Auto mode: pipeline progress stepper */}
            {isProjectPage && isAutoPage && currentPhase !== "config" && (
                <div className="absolute left-1/2 -translate-x-1/2 w-[700px]">
                    <div className="flex items-center gap-1">
                        {AUTO_PHASE_LABELS.map((phase, i) => {
                            const phaseIdx = getPhaseIndex(phase.key);
                            const currentIdx = getPhaseIndex(currentPhase);
                            const isActive = phase.key === currentPhase;
                            const isDone = completedPhases.has(phase.key) || currentPhase === "done";
                            const isPast = phaseIdx < currentIdx;

                            return (
                                <div key={phase.key} className="flex items-center flex-1">
                                    <div className={`flex items-center gap-1.5 text-xs font-medium transition-all duration-300 ${isActive ? "text-primary" : isDone || isPast ? "text-green-500" : "text-muted-foreground/50"
                                        }`}>
                                        {isDone || isPast ? (
                                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                            </motion.div>
                                        ) : isActive ? (
                                            <Spinner className="w-4 h-4 animate-spin shrink-0" />
                                        ) : (
                                            <Circle className="w-4 h-4 shrink-0" />
                                        )}
                                        <span className="whitespace-nowrap">{phase.label}</span>
                                    </div>
                                    {i < AUTO_PHASE_LABELS.length - 1 && (
                                        <div className="flex-1 h-px mx-2 bg-border relative overflow-hidden">
                                            <motion.div
                                                className="absolute inset-y-0 left-0 bg-green-500/50"
                                                initial={{ width: "0%" }}
                                                animate={{ width: isDone || isPast ? "100%" : "0%" }}
                                                transition={{ duration: 0.4, ease: "easeOut" }}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Right side buttons */}
            {isProjectPage && !isAutoPage && (
                <button
                    className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${!phaseStatus.download || isProcessing
                        ? "opacity-40 cursor-not-allowed text-muted-foreground bg-muted border border-border"
                        : "text-foreground cursor-pointer hover:opacity-90"
                        }`}
                    onClick={() => phaseStatus.download && !isProcessing && navigate(`/project/${projectId}/auto`)}
                    disabled={!phaseStatus.download || isProcessing}
                    style={phaseStatus.download && !isProcessing ? {
                        background: "var(--background)",
                        border: "none",
                        padding: "6px 12px"} : undefined}
                >
                    {phaseStatus.download && !isProcessing && (
                        <>
                            <span
                                className="absolute -inset-[1.5px] rounded-[7px] -z-10 animate-[gradient-spin_3s_linear_infinite]"
                                style={{
                                    background: "conic-gradient(from var(--gradient-angle), #4285f4, #ea4335, #fbbc04, #34a853, #4285f4)"}}
                            />
                            <span className="absolute inset-0 rounded-md bg-background -z-[5]" />
                        </>
                    )}
                    <Sparkles className="w-3.5 h-3.5" />
                    Tự động
                </button>
            )}
            {isProjectPage && isAutoPage && (
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => navigate(`/project/${projectId}`)}
                >
                    Thủ công
                </Button>
            )}
            {!isProjectPage && <div />}
        </header>
    );
};
