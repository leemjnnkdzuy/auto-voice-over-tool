import { useSearchParams, useParams } from "react-router-dom";
import { DownloadPhase } from "@/components/common/DownloadPhase";
import { TranscriptPhase } from "@/components/common/TranscriptPhase";
import { TranslatePhase } from "@/components/common/TranslatePhase";
import { AudioGeneratePhase } from "@/components/common/AudioGeneratePhase";
import { CreateFinalVideoPhase } from "@/components/common/CreateFinalVideoPhase";

export const ProjectPage = () => {
    const { id } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const currentPhase = searchParams.get("tab") || "download";

    return (
        <div className="container mx-auto py-6 h-full flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
                {currentPhase === "download" && (
                    <DownloadPhase onComplete={() => setSearchParams({ tab: "transcript" })} />
                )}
                {currentPhase === "transcript" && (
                    <TranscriptPhase onComplete={() => setSearchParams({ tab: "translate" })} />
                )}
                {currentPhase === "translate" && (
                    <TranslatePhase onComplete={() => setSearchParams({ tab: "audio" })} />
                )}
                {currentPhase === "audio" && (
                    <AudioGeneratePhase onComplete={() => setSearchParams({ tab: "final" })} />
                )}
                {currentPhase === "final" && (
                    <CreateFinalVideoPhase onComplete={() => setSearchParams({ tab: "download" })} />
                )}
            </div>
        </div>
    );
};
