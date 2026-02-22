import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams, matchPath, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProcessContext } from "@/stores/ProcessStore";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Header = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();

    const parsedPath = matchPath("/project/:id", location.pathname);
    const projectId = parsedPath ? parsedPath.params.id : null;

    const isProjectPage = !!projectId;
    const currentTab = searchParams.get("tab") || "download";
    const { isProcessing, isAutoProcess, setIsAutoProcess } = useProcessContext();

    const [projectName, setProjectName] = useState("");
    const [projectDate, setProjectDate] = useState("");
    const [projectPath, setProjectPath] = useState("");
    const [phaseStatus, setPhaseStatus] = useState({
        download: false,
        transcript: false,
        translate: false,
        audio: false,
        final: false,
    });

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

            {isProjectPage && (
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

            { }
            <div className="flex items-center gap-2">
                <Switch
                    id="auto-process"
                    checked={isAutoProcess}
                    onCheckedChange={setIsAutoProcess}
                    disabled={isProcessing}
                />
                <Label htmlFor="auto-process" className="text-sm font-medium whitespace-nowrap cursor-pointer">
                    Tự động xử lý
                </Label>
            </div>
        </header>
    );
};
