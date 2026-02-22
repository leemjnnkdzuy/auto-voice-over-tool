import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Clipboard, CheckCircle2, RotateCcw, ArrowRight, Upload, FileVideo } from "lucide-react";
import { useProcessContext } from "@/stores/ProcessStore";

export const DownloadPhase = ({ onComplete }: { onComplete?: () => void }) => {
    const { id } = useParams();
    const [phase, setPhase] = useState<"input" | "review" | "downloading" | "completed">("input");
    const [url, setUrl] = useState("");
    const [videoInfo, setVideoInfo] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [projectPath, setProjectPath] = useState("");
    const [downloadProgress, setDownloadProgress] = useState({ video: 0, audio: 0 });
    const [isChecking, setIsChecking] = useState(true);

    const { setIsProcessing: setGlobalProcessing, isAutoProcess } = useProcessContext();

    const isAutoProcessRef = useRef(isAutoProcess);
    useEffect(() => {
        isAutoProcessRef.current = isAutoProcess;
    }, [isAutoProcess]);

    const projectPathRef = useRef(projectPath);
    const videoInfoRef = useRef(videoInfo);

    useEffect(() => {
        setGlobalProcessing(isProcessing || phase === "downloading");
    }, [isProcessing, phase, setGlobalProcessing]);

    useEffect(() => {
        projectPathRef.current = projectPath;
    }, [projectPath]);

    useEffect(() => {
        videoInfoRef.current = videoInfo;
    }, [videoInfo]);

    useEffect(() => {
        let mounted = true;

        const fetchProject = async () => {
            try {
                const projects = await window.api.getProjects();
                const project = projects.find((p: any) => p.id === id);
                if (project && mounted) {
                    setProjectPath(project.path);

                    // Check metadata
                    const metadata = await window.api.getProjectMetadata(project.path);
                    if (metadata && metadata.status === 'completed' && metadata.videoInfo) {
                        setVideoInfo(metadata.videoInfo);
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

        // Listeners
        window.api.onDownloadProgress((progress) => {
            if (mounted) setDownloadProgress(progress);
        });

        window.api.onDownloadComplete((success) => {
            if (mounted) {
                if (success) {
                    setPhase("completed");
                    // Save metadata on success using current refs
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

        window.api.onImportLocalComplete((info) => {
            if (mounted) {
                if (info) {
                    setVideoInfo(info);
                    setPhase("completed");
                    // Save metadata on success using current refs
                    if (projectPathRef.current) {
                        window.api.saveProjectMetadata(projectPathRef.current, {
                            videoInfo: info,
                            status: 'completed'
                        });

                        if (isAutoProcessRef.current && onComplete) {
                            onComplete();
                        }
                    }
                } else {
                    alert("Import video thất bại!");
                    setIsProcessing(false);
                    setPhase("input");
                }
            }
        });

        return () => {
            mounted = false;
            window.api.removeDownloadListeners();
        };
    }, [id]);

    const saveMetadata = async (completed: boolean) => {
        if (!projectPath || !videoInfo) return;
        await window.api.saveProjectMetadata(projectPath, {
            videoInfo,
            status: completed ? 'completed' : 'input'
        });
    };

    const handleInitialSubmit = async () => {
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

    const handleConfirmDownload = async () => {
        if (!projectPath || !videoInfo) {
            alert("Không tìm thấy đường dẫn project!");
            return;
        }
        setPhase("downloading");
        window.api.downloadVideo(videoInfo.url, projectPath);
    };

    const handleSelectLocalVideo = async () => {
        if (!projectPath) {
            alert("Không tìm thấy đường dẫn project!");
            return;
        }
        const filePath = await window.api.selectVideoFile();
        if (filePath) {
            setIsProcessing(true);
            setPhase("downloading");
            setDownloadProgress({ video: 0, audio: 0 });
            window.api.importLocalVideo(filePath, projectPath);
        }
    };

    const handleReset = () => {
        setPhase("input");
        setUrl("");
        setVideoInfo(null);
        setDownloadProgress({ video: 0, audio: 0 });
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

            {phase === "input" && (
                <div className="w-full space-y-4">
                    <h2 className="text-xl font-bold text-center">Nhập URL Video</h2>
                    <div className="flex gap-2 w-full">
                        <div className="relative flex-1">
                            <Input
                                placeholder="https://www.youtube.com/watch?v=..."
                                value={url}
                                className="pr-10"
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleInitialSubmit()}
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
                        <Button onClick={handleInitialSubmit} disabled={isProcessing} className="relative overflow-hidden group min-w-[100px]">
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary/10 via-white/20 to-primary/10 -translate-x-full group-hover:animate-shimmer" />
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tiếp tục"}
                        </Button>
                    </div>

                    <div className="flex flex-col items-center gap-2 pt-2 border-t w-full">
                        <p className="text-xs text-muted-foreground">Hoặc</p>
                        <Button
                            variant="outline"
                            className="gap-2 w-full max-w-sm relative overflow-hidden group"
                            onClick={handleSelectLocalVideo}
                            disabled={isProcessing}
                        >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 -translate-x-full group-hover:animate-shimmer" />
                            <Upload className="w-4 h-4 relative z-10" />
                            <span className="relative z-10">Chọn video từ máy tính</span>
                        </Button>
                    </div>
                </div>
            )}

            {phase === "review" && videoInfo && (
                <div className="w-full h-full min-h-[400px] grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column: Thumbnail & Actions */}
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
                                className="w-full shadow-lg shadow-primary/20 relative overflow-hidden group"
                                onClick={handleConfirmDownload}
                            >
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-primary/10 via-white/20 to-primary/10 -translate-x-full group-hover:animate-shimmer" />
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

                    {/* Right Column: Details */}
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

            {/* Completed / Review Downloaded State */}
            {phase === "completed" && videoInfo && (
                <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-300">
                    <div className="md:col-span-1 flex flex-col gap-4">
                        <div className="aspect-video w-full rounded-xl overflow-hidden shadow-xl border bg-black relative group shrink-0">
                            <img
                                src={videoInfo.thumbnail}
                                alt="Thumbnail"
                                className="w-full h-full object-cover opacity-80"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <CheckCircle2 className="w-12 h-12 text-green-500 drop-shadow-md" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 mt-auto shrink-0">
                            {/* Actions for completed state */}
                            {onComplete && (
                                <Button size="lg" onClick={onComplete} className="w-full shadow-lg shadow-green-500/20 bg-green-600 hover:bg-green-700 relative overflow-hidden group border-none">
                                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-shimmer" />
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        Tiếp tục tạo phụ đề <ArrowRight className="w-4 h-4" />
                                    </span>
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleReset}
                            >
                                <RotateCcw className="w-4 h-4 mr-2" /> Tải video khác
                            </Button>
                        </div>
                    </div>

                    <div className="md:col-span-2 flex flex-col justify-center space-y-4 p-6 bg-card border rounded-xl shadow-sm">
                        <div className="flex items-center gap-3 text-green-600 mb-2">
                            <CheckCircle2 className="w-6 h-6" />
                            <h3 className="font-bold text-xl">Đã tải xuống thành công!</h3>
                        </div>
                        <div>
                            <h4 className="font-semibold text-lg">{videoInfo.title}</h4>
                            <p className="text-muted-foreground">{videoInfo.author}</p>
                        </div>
                        <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                            <p><span className="font-semibold">Đường dẫn:</span> {projectPath}</p>
                            <p><span className="font-semibold">Video:</span> /original/video/{videoInfo.id}.mp4</p>
                            <p><span className="font-semibold">Audio:</span> /original/audio/{videoInfo.id}.mp3</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
