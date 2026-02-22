import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { DownloadPhase } from "@/components/common/DownloadPhase";
import { TranscriptPhase } from "@/components/common/TranscriptPhase";
import { TranslatePhase } from "@/components/common/TranslatePhase";
import { AudioGeneratePhase } from "@/components/common/AudioGeneratePhase";
import { CreateFinalVideoPhase } from "@/components/common/CreateFinalVideoPhase";

const PHASE_ORDER = ["download", "transcript", "translate", "audio", "final"] as const;

export const ProjectPage = () => {
    const { id } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentPhase = searchParams.get("tab") || "download";
    const [projectPath, setProjectPath] = useState("");

    useEffect(() => {
        if (id) {
            window.api.getProjects().then((projects) => {
                const proj = projects.find((p: any) => p.id === id);
                if (proj) setProjectPath(proj.path);
            });
        }
    }, [id]);

    const markPhaseComplete = useCallback(async (phase: string) => {
        if (!projectPath) return;
        const meta = await window.api.getProjectMetadata(projectPath) || {};
        const completed: string[] = meta.completedPhases || [];
        if (!completed.includes(phase)) {
            completed.push(phase);
        }
        await window.api.saveProjectMetadata(projectPath, { completedPhases: completed });
    }, [projectPath]);

    const completeAndNavigate = useCallback((currentPhase: string, nextTab: string) => {
        markPhaseComplete(currentPhase);
        setSearchParams({ tab: nextTab });
    }, [markPhaseComplete, setSearchParams]);

    return (
        <div className="container mx-auto py-6 h-full flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
                {currentPhase === "download" && (
                    <DownloadPhase onComplete={() => completeAndNavigate("download", "transcript")} />
                )}
                {currentPhase === "transcript" && (
                    <TranscriptPhase onComplete={() => completeAndNavigate("transcript", "translate")} />
                )}
                {currentPhase === "translate" && (
                    <TranslatePhase onComplete={() => completeAndNavigate("translate", "audio")} />
                )}
                {currentPhase === "audio" && (
                    <AudioGeneratePhase onComplete={() => completeAndNavigate("audio", "final")} />
                )}
                {currentPhase === "final" && (
                    <CreateFinalVideoPhase onComplete={() => completeAndNavigate("final", "download")} />
                )}
            </div>
        </div>
    );
};
