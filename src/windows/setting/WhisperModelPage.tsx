import { Spinner } from '@/components/ui/spinner';
import { useState, useEffect, useCallback, useRef } from "react";
import { useModelDownloadStore } from "@/stores/ModelDownloadStore";
import { Button } from "@/components/ui/button";
import {
    Download,
    Trash2,
    CheckCircle2,
    
    HardDrive,
    MemoryStick,
    Star} from "lucide-react";

interface WhisperModel {
    id: string;
    name: string;
    fileName: string;
    disk: string;
    mem: string;
    downloaded: boolean;
    active: boolean;
}

export const WhisperModelPage = () => {
    const downloadingId = useModelDownloadStore((s) => s.downloadingId);
    const downloadPercent = useModelDownloadStore((s) => s.downloadPercent);
    const startDownload = useModelDownloadStore((s) => s.startDownload);

    const [models, setModels] = useState<WhisperModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadModels = useCallback(async () => {
        const data = await window.api.listWhisperModels();
        setModels(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadModels();
    }, [loadModels]);

    const prevRef = useRef(downloadingId);
    useEffect(() => {
        if (prevRef.current !== null && downloadingId === null) {
            loadModels();
        }
        prevRef.current = downloadingId;
    }, [downloadingId, loadModels]);

    const handleDownload = (modelId: string) => {
        startDownload(modelId);
    };

    const handleDelete = async (modelId: string) => {
        const downloadedCount = models.filter((m) => m.downloaded).length;
        if (downloadedCount <= 1) return;
        setDeletingId(modelId);
        await window.api.deleteWhisperModel(modelId);
        await loadModels();
        setDeletingId(null);
    };

    const handleSetActive = async (modelId: string) => {
        await window.api.setActiveWhisperModel(modelId);
        await loadModels();
    };

    const downloadedCount = models.filter((m) => m.downloaded).length;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold">Quản lý Model Whisper</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Tải, chọn hoặc xóa các model nhận dạng giọng nói. Model lớn hơn cho kết quả chính xác hơn nhưng cần nhiều RAM và thời gian xử lý hơn.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Spinner className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="border rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[1fr_90px_90px_140px] gap-2 px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b">
                        <div>Model</div>
                        <div className="text-center">Disk</div>
                        <div className="text-center">RAM</div>
                        <div className="text-right">Thao tác</div>
                    </div>

                    {models.map((model) => {
                        const isDownloading = downloadingId === model.id;
                        const isDeleting = deletingId === model.id;
                        const isLastDownloaded = downloadedCount <= 1 && model.downloaded;

                        return (
                            <div
                                key={model.id}
                                className={`grid grid-cols-[1fr_90px_90px_140px] gap-2 px-4 py-3 items-center border-b last:border-b-0 transition-colors ${model.active ? "bg-primary/5" : "hover:bg-muted/30"}`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium">{model.name}</span>
                                            {model.active && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary">
                                                    <Star className="w-3 h-3 fill-current" />
                                                    Đang dùng
                                                </span>
                                            )}
                                            {model.downloaded && !model.active && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    Đã tải
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[11px] text-muted-foreground truncate">
                                            {model.fileName}
                                        </span>
                                    </div>
                                </div>

                                <div className="text-center">
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                        <HardDrive className="w-3 h-3" />
                                        {model.disk}
                                    </span>
                                </div>

                                <div className="text-center">
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                        <MemoryStick className="w-3 h-3" />
                                        {model.mem}
                                    </span>
                                </div>

                                <div className="flex items-center justify-end gap-1.5">
                                    {!model.downloaded ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs gap-1"
                                            onClick={() => handleDownload(model.id)}
                                            disabled={isDownloading || downloadingId !== null}
                                        >
                                            {isDownloading ? (
                                                <>
                                                    <Spinner className="w-3 h-3 animate-spin" />
                                                    {downloadPercent}%
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="w-3 h-3" />
                                                    Tải
                                                </>
                                            )}
                                        </Button>
                                    ) : (
                                        <>
                                            {!model.active && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 text-xs gap-1"
                                                    onClick={() => handleSetActive(model.id)}
                                                >
                                                    <Star className="w-3 h-3" />
                                                    Dùng
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDelete(model.id)}
                                                disabled={isLastDownloaded || isDeleting}
                                                title={isLastDownloaded ? "Không thể xóa model cuối cùng" : `Xóa ${model.name}`}
                                            >
                                                {isDeleting ? (
                                                    <Spinner className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="rounded-lg border border-dashed p-4 space-y-1.5">
                <p className="text-xs text-muted-foreground">
                    <strong>Lưu ý:</strong> Phải luôn có ít nhất 1 model được tải xuống. Model <em>Base</em> được tải tự động khi cài đặt lần đầu.
                </p>
                <p className="text-xs text-muted-foreground">
                    Model được cung cấp bởi <a href="https://github.com/ggml-org/whisper.cpp" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">whisper.cpp</a> (định dạng GGML) từ <a href="https://huggingface.co/ggerganov/whisper.cpp" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">HuggingFace</a>.
                </p>
            </div>
        </div>
    );
};
