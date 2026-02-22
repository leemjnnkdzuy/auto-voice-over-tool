import { Spinner } from '@/components/ui/spinner';
import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.svg";

interface SetupProgress {
    status: string;
    progress: number;
    detail: string;
}

export const LoadingScreen = ({ onReady }: { onReady: () => void }) => {
    const [progress, setProgress] = useState<SetupProgress>({
        status: "checking",
        progress: 0,
        detail: "Đang kiểm tra môi trường..."
    });
    const [error, setError] = useState(false);

    useEffect(() => {
        window.api.onSetupProgress((data: SetupProgress) => {
            setProgress(data);

            if (data.status === "ready") {
                setTimeout(() => {
                    onReady();
                }, 800);
            }

            if (data.status === "error") {
                setError(true);
            }
        });

        window.api.setupEnvironment();

        return () => {
            window.api.removeSetupListeners();
        };
    }, []);

    const handleRetry = () => {
        setError(false);
        setProgress({
            status: "checking",
            progress: 0,
            detail: "Đang thử lại..."
        });
        window.api.setupEnvironment();
    };

    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-background gap-8 p-8">
            { }
            <div className="text-center space-y-4 flex flex-col items-center">
                <img src={logo} alt="AVOT Logo" className="w-24 h-24 object-contain animate-pulse" />
                <p className="text-muted-foreground text-sm font-medium">
                    Đang chuẩn bị môi trường làm việc...
                </p>
            </div>

            { }
            <div className="w-full max-w-md space-y-4">
                <Progress value={progress.progress} className="h-2" />

                <div className="flex items-center gap-3 justify-center">
                    {error ? (
                        <XCircle className="w-5 h-5 text-destructive animate-in fade-in" />
                    ) : progress.status === "ready" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 animate-in fade-in zoom-in" />
                    ) : (
                        <Spinner className="w-5 h-5 animate-spin text-primary" />
                    )}
                    <span className="text-sm text-muted-foreground">
                        {progress.detail}
                    </span>
                </div>

                {progress.progress > 0 && progress.status !== "ready" && !error && (
                    <p className="text-xs text-center text-muted-foreground/60">
                        {Math.round(progress.progress)}%
                    </p>
                )}

                {error && (
                    <div className="flex justify-center pt-2">
                        <Button onClick={handleRetry} variant="outline" size="sm">
                            Thử lại
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
