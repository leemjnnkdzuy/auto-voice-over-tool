import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clipboard, CheckCircle2, RotateCcw, ArrowRight, Upload, Link, FolderOpen } from "lucide-react";
import { useProcessContext } from "@/stores/ProcessStore";

type InputMode = "choose" | "url" | "local";
type Phase = "input" | "review" | "downloading" | "importing" | "completed";

export const InputPhase = ({ onComplete }: { onComplete?: () => void }) => {
    const { id } = useParams();
    const [phase, setPhase] = useState<Phase>("input");
    const [inputMode, setInputMode] = useState<InputMode>("choose");
    const [url, setUrl] = useState("");
    const [videoInfo, setVideoInfo] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [projectPath, setProjectPath] = useState("");
    const [downloadProgress, setDownloadProgress] = useState({ video: 0, audio: 0 });
    const [importProgress, setImportProgress] = useState({ step: "", progress: 0, detail: "" });
    const [localFilePath, setLocalFilePath] = useState("");
    const [localFileName, setLocalFileName] = useState("");
    const [isChecking, setIsChecking] = useState(true);

    const { setIsProcessing: setGlobalProcessing, isAutoProcess } = useProcessContext();

    const isAutoProcessRef = useRef(isAutoProcess);
    useEffect(() => {
        isAutoProcessRef.current = isAutoProcess;
    }, [isAutoProcess]);

    const projectPathRef = useRef(projectPath);
    const videoInfoRef = useRef(videoInfo);

    useEffect(() => {
        setGlobalProcessing(isProcessing || phase === "downloading" || phase === "importing");
    }, [isProcessing, phase, setGlobalProcessing]);

    useEffect(() => { projectPathRef.current = projectPath; }, [projectPath]);
    useEffect(() => { videoInfoRef.current = videoInfo; }, [videoInfo]);

    useEffect(() => {
        let mounted = true;

        const fetchProject = async () => {
            try {
                const projects = await window.api.getProjects();
                const project = projects.find((p: any) => p.id === id);
                if (project && mounted) {
                    setProjectPath(project.path);

                    const metadata = await window.api.getProjectMetadata(project.path);
                    if (metadata && metadata.status === 'completed' && (metadata.videoInfo || metadata.localFile)) {
                        if (metadata.videoInfo) setVideoInfo(metadata.videoInfo);
                        if (metadata.localFile) {
                            setLocalFileName(metadata.localFile.name);
                            setLocalFilePath(metadata.localFile.path);
                            setInputMode("local");
                        } else {
                            setInputMode("url");
                        }
                        setPhase("completed");
                    }
                }
            } catch (error) {
                console.error("Failed to load project:", error);
            } finally {
                if (mounted) setIsChecking(false);
            }
        };
        fetchProject();

        window.api.onDownloadProgress((progress) => {
            if (mounted) setDownloadProgress(progress);
        });

        window.api.onDownloadComplete((success) => {
            if (mounted) {
                if (success) {
                    setPhase("completed");
                    if (projectPathRef.current && videoInfoRef.current) {
                        window.api.saveProjectMetadata(projectPathRef.current, {
                            videoInfo: videoInfoRef.current,
                            status: 'completed'
                        });
                        if (isAutoProcessRef.current && onComplete) {
                            onComplete();
                        }
                    }
                } else {
                    alert("Tải xuống thất bại!");
                    setPhase("input");
                }
            }
        });

        window.api.onImportLocalProgress((progress) => {
            if (mounted) setImportProgress(progress);
        });

        window.api.onImportLocalComplete((success) => {
            if (mounted) {
                if (success) {
                    setPhase("completed");
                    if (projectPathRef.current) {
                        window.api.saveProjectMetadata(projectPathRef.current, {
                            localFile: { name: localFileName, path: localFilePath },
                            status: 'completed'
                        });
                        if (isAutoProcessRef.current && onComplete) {
                            onComplete();
                        }
                    }
                } else {
                    alert("Import video thất bại!");
                    setPhase("input");
                }
            }
        });

        return () => {
            mounted = false;
            window.api.removeDownloadListeners();
            window.api.removeImportLocalListeners();
        };
    }, [id]);

    const handleUrlSubmit = async () => {
        if (!url) return;
        setIsProcessing(true);
        try {
            const info = await window.api.getVideoInfo(url);
            if (info) {
                setVideoInfo(info);
                if (isAutoProcess && projectPath) {
                    setPhase("downloading");
                    window.api.downloadVideo(info.url, projectPath);
                } else {
                    setPhase("review");
                }
            } else {
                alert("Không tìm thấy thông tin video hoặc URL không hợp lệ");
            }
        } catch (error) {
            console.error(error);
            alert("Lỗi khi lấy thông tin video");
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) setUrl(text);
        } catch (error) {
            console.error("Failed to read clipboard:", error);
        }
    };

    const handleConfirmDownload = () => {
        if (!projectPath || !videoInfo) {
            alert("Không tìm thấy đường dẫn project!");
            return;
        }
        setPhase("downloading");
        window.api.downloadVideo(videoInfo.url, projectPath);
    };

    const handleSelectLocalFile = async () => {
        const filePath = await window.api.selectVideoFile();
        if (filePath) {
            const name = filePath.split(/[\\/]/).pop() || "video";
            setLocalFilePath(filePath);
            setLocalFileName(name);
        }
    };

    const handleImportLocal = () => {
        if (!localFilePath || !projectPath) return;
        setPhase("importing");
        setImportProgress({ step: "copying", progress: 0, detail: "Đang bắt đầu..." });
        window.api.importLocalVideo(localFilePath, projectPath);
    };

    const [isResetting, setIsResetting] = useState(false);

    const handleReset = async () => {
        if (!projectPath) return;

        const confirmed = confirm("Bạn chắc chắn muốn chọn video khác? Tất cả dữ liệu hiện tại (phụ đề, bản dịch, audio, video final) sẽ bị xóa.");
        if (!confirmed) return;

        setIsResetting(true);
        try {
            await window.api.resetProjectData(projectPath);
        } catch (err) {
            console.error("Reset project failed:", err);
        }
        setIsResetting(false);

        setPhase("input");
        setInputMode("choose");
        setUrl("");
        setVideoInfo(null);
        setLocalFilePath("");
        setLocalFileName("");
        setDownloadProgress({ video: 0, audio: 0 });
        setImportProgress({ step: "", progress: 0, detail: "" });
    };

    if (isChecking) {
        return (
            <div className="flex items-center justify-center h-40">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center p-4 space-y-4 max-w-5xl w-full mx-auto animate-in fade-in duration-300">

            {phase === "input" && inputMode === "choose" && (
                <div className="w-full max-w-lg space-y-6 text-center">
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold">Chọn nguồn video</h2>
                        <p className="text-sm text-muted-foreground">
                            Chọn cách nhập video cho dự án
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            className="flex flex-col items-center gap-3 p-6 border rounded-xl bg-card hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                            onClick={() => setInputMode("url")}
                        >
                            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Link className="w-7 h-7 text-primary" />
                            </div>
                            <div>
                                <p className="font-semibold">Từ URL</p>
                                <p className="text-xs text-muted-foreground mt-1">YouTube hoặc link video</p>
                            </div>
                        </button>

                        <button
                            className="flex flex-col items-center gap-3 p-6 border rounded-xl bg-card hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
                            onClick={() => setInputMode("local")}
                        >
                            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Upload className="w-7 h-7 text-primary" />
                            </div>
                            <div>
                                <p className="font-semibold">Từ máy tính</p>
                                <p className="text-xs text-muted-foreground mt-1">Chọn file video có sẵn</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {phase === "input" && inputMode === "url" && (
                <div className="w-full space-y-4">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setInputMode("choose")}>
                            ← Quay lại
                        </Button>
                        <h2 className="text-xl font-bold">Nhập URL Video</h2>
                    </div>
                    <div className="flex gap-2 w-full">
                        <div className="relative flex-1">
                            <Input
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={url}
                                className="pr-10"
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={handlePaste}
                                title="Dán"
                            >
                                <Clipboard className="w-4 h-4" />
                            </Button>
                        </div>
                        <Button onClick={handleUrlSubmit} disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tiếp tục"}
                        </Button>
                    </div>
                </div>
            )}

            {phase === "input" && inputMode === "local" && (
                <div className="w-full max-w-lg space-y-6">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setInputMode("choose")}>
                            ← Quay lại
                        </Button>
                        <h2 className="text-xl font-bold">Chọn video từ máy tính</h2>
                    </div>

                    <div
                        className="border-2 border-dashed rounded-xl p-8 text-center space-y-4 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
                        onClick={handleSelectLocalFile}
                    >
                        {localFilePath ? (
                            <div className="space-y-2">
                                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                                <p className="font-semibold text-sm">{localFileName}</p>
                                <p className="text-xs text-muted-foreground break-all">{localFilePath}</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <FolderOpen className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                                <p className="text-sm text-muted-foreground">
                                    Nhấn để chọn file video
                                </p>
                                <p className="text-xs text-muted-foreground/60">
                                    Hỗ trợ: MP4, MKV, WebM, AVI, MOV, FLV, WMV
                                </p>
                            </div>
                        )}
                    </div>

                    {localFilePath && (
                        <Button className="w-full gap-2" size="lg" onClick={handleImportLocal}>
                            <Upload className="w-4 h-4" />
                            Import & tách audio
                        </Button>
                    )}
                </div>
            )}

            {phase === "review" && videoInfo && (
                <div className="w-full h-full min-h-[400px] grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 flex flex-col gap-4">
                        <div className="aspect-video w-full rounded-xl overflow-hidden shadow-xl border bg-black relative group shrink-0">
                            <img
                                src={videoInfo.thumbnail}
                                alt="Thumbnail"
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded font-mono">
                                {Math.floor(videoInfo.duration / 60)}:{(videoInfo.duration % 60).toString().padStart(2, '0')}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mt-auto shrink-0">
                            <Button
                                size="lg"
                                className="w-full shadow-lg shadow-primary/20"
                                onClick={handleConfirmDownload}
                            >
                                Tải xuống ngay
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                className="w-full"
                                onClick={() => setPhase("input")}
                            >
                                Quay lại
                            </Button>
                        </div>
                    </div>

                    <div className="md:col-span-2 flex flex-col h-full bg-card border rounded-xl shadow-sm overflow-hidden text-left">
                        <div className="p-6 flex-1 overflow-y-auto space-y-4">
                            <div>
                                <h3 className="font-bold text-xl leading-tight mb-2">{videoInfo.title}</h3>
                                <p className="text-secondary-foreground font-medium">{videoInfo.author}</p>
                            </div>
                            <div className="text-sm text-muted-foreground whitespace-pre-line border-t pt-4">
                                {videoInfo.description ? videoInfo.description.slice(0, 300) + (videoInfo.description.length > 300 ? '...' : '') : "Không có mô tả."}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {phase === "downloading" && (
                <div className="text-center space-y-6 w-full max-w-lg mx-auto">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                            <span>Đang tải Audio...</span>
                            <span>{Math.round(downloadProgress.audio)}%</span>
                        </div>
                        <Progress value={downloadProgress.audio} className="w-full h-2" />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                            <span>Đang tải Video...</span>
                            <span>{Math.round(downloadProgress.video)}%</span>
                        </div>
                        <Progress value={downloadProgress.video} className="w-full h-2" />
                    </div>
                </div>
            )}

            {phase === "importing" && (
                <div className="text-center space-y-6 w-full max-w-lg mx-auto">
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold">Đang xử lý video...</h2>
                        <p className="text-sm text-muted-foreground">{importProgress.detail}</p>
                    </div>
                    <Progress value={importProgress.progress} className="w-full h-2" />
                </div>
            )}

            {phase === "completed" && (
                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-300">
                    <div className="md:col-span-1 flex flex-col gap-4">
                        <div className="aspect-video w-full rounded-xl overflow-hidden shadow-xl border bg-black relative group shrink-0">
                            {videoInfo?.thumbnail ? (
                                <img
                                    src={videoInfo.thumbnail}
                                    alt="Thumbnail"
                                    className="w-full h-full object-cover opacity-80"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted">
                                    <Upload className="w-12 h-12 text-muted-foreground/30" />
                                </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <CheckCircle2 className="w-12 h-12 text-green-500 drop-shadow-md" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mt-auto shrink-0">
                            {onComplete && (
                                <Button size="lg" onClick={onComplete} className="w-full shadow-lg shadow-green-500/20 bg-green-600 hover:bg-green-700">
                                    Tiếp tục tạo phụ đề <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleReset}
                                disabled={isResetting}
                            >
                                {isResetting ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                )}
                                {isResetting ? "Đang xóa dữ liệu..." : "Chọn video khác"}
                            </Button>
                        </div>
                    </div>

                    <div className="md:col-span-2 flex flex-col justify-center space-y-4 p-6 bg-card border rounded-xl shadow-sm">
                        <div className="flex items-center gap-3 text-green-600 mb-2">
                            <CheckCircle2 className="w-6 h-6" />
                            <h3 className="font-bold text-xl">
                                {videoInfo ? "Đã tải xuống thành công!" : "Đã import thành công!"}
                            </h3>
                        </div>
                        <div>
                            <h4 className="font-semibold text-lg">
                                {videoInfo ? videoInfo.title : localFileName}
                            </h4>
                            {videoInfo && (
                                <p className="text-muted-foreground">{videoInfo.author}</p>
                            )}
                        </div>
                        <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                            <p><span className="font-semibold">Đường dẫn:</span> {projectPath}</p>
                            {videoInfo ? (
                                <>
                                    <p><span className="font-semibold">Video:</span> /original/video/{videoInfo.id}.mp4</p>
                                    <p><span className="font-semibold">Audio:</span> /original/audio/{videoInfo.id}.mp3</p>
                                </>
                            ) : (
                                <>
                                    <p><span className="font-semibold">Video:</span> /original/video/{localFileName}</p>
                                    <p><span className="font-semibold">Audio:</span> /original/audio/ (đã tách từ video)</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
