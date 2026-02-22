import { createContext, useContext, useState, ReactNode } from "react";

export type AutoPhase = "config" | "input" | "transcript" | "translate" | "audio" | "final" | "done";

export const AUTO_PHASE_LABELS: { key: AutoPhase; label: string }[] = [
    { key: "input", label: "Nhập video" },
    { key: "transcript", label: "Tạo phụ đề" },
    { key: "translate", label: "Dịch phụ đề" },
    { key: "audio", label: "Tạo audio" },
    { key: "final", label: "Tạo video" },
];

interface AutoPipelineContextType {
    currentPhase: AutoPhase;
    setCurrentPhase: (phase: AutoPhase) => void;
    completedPhases: Set<AutoPhase>;
    markPhaseCompleted: (phase: AutoPhase) => void;
    resetPipeline: () => void;
}

const AutoPipelineContext = createContext<AutoPipelineContextType>({
    currentPhase: "config",
    setCurrentPhase: () => { },
    completedPhases: new Set(),
    markPhaseCompleted: () => { },
    resetPipeline: () => { },
});

export const useAutoPipeline = () => useContext(AutoPipelineContext);

export const AutoPipelineProvider = ({ children }: { children: ReactNode }) => {
    const [currentPhase, setCurrentPhase] = useState<AutoPhase>("config");
    const [completedPhases, setCompletedPhases] = useState<Set<AutoPhase>>(new Set());

    const markPhaseCompleted = (phase: AutoPhase) => {
        setCompletedPhases(prev => {
            const next = new Set(prev);
            next.add(phase);
            return next;
        });
    };

    const resetPipeline = () => {
        setCurrentPhase("config");
        setCompletedPhases(new Set());
    };

    return (
        <AutoPipelineContext.Provider value={{
            currentPhase, setCurrentPhase,
            completedPhases, markPhaseCompleted,
            resetPipeline,
        }}>
            {children}
        </AutoPipelineContext.Provider>
    );
};
