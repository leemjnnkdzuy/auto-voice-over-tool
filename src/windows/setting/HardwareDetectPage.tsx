import { useEffect, useState } from "react";
import { useHardwareStore } from "@/stores/HardwareStore";
import { Cpu, Server, Monitor, Zap, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

export const HardwareDetectPage = () => {
    const {
        hasNvidiaGpu,
        cpuName,
        totalRamGB,
        gpus,
        isLoaded,
        fetchHardwareInfo
    } = useHardwareStore();

    const [isRefreshing, setIsRefreshing] = useState(false);

    // Initial load
    useEffect(() => {
        if (!isLoaded) {
            fetchHardwareInfo();
        }
    }, [isLoaded, fetchHardwareInfo]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchHardwareInfo();
        setIsRefreshing(false);
    };

    if (!isLoaded && !isRefreshing) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Spinner className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">Thông tin Thiết bị</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Chi tiết cấu hình phần cứng phát hiện được trên máy tính của bạn.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="gap-2"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                    Quét lại
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* CPU Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vi xử lý (CPU)</CardTitle>
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold truncate" title={cpuName || "Đang tải..."}>
                            {cpuName || "Đang tải..."}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Hiệu suất cơ bản
                        </p>
                    </CardContent>
                </Card>

                {/* RAM Card */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Bộ nhớ (RAM)</CardTitle>
                        <Server className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {totalRamGB ? `${totalRamGB} GB` : "Đang tải..."}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Tổng dung lượng
                        </p>
                    </CardContent>
                </Card>

                {/* Status Card */}
                <Card className={hasNvidiaGpu ? "border-green-500/50 bg-green-500/5" : "border-amber-500/50 bg-amber-500/5"}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Whisper GPU</CardTitle>
                        <Zap className={`h-4 w-4 ${hasNvidiaGpu ? 'text-green-500' : 'text-amber-500'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            {hasNvidiaGpu ? (
                                <>
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                    <span className="text-sm font-semibold text-green-600 dark:text-green-500">
                                        Đã sẵn sàng
                                    </span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-5 h-5 text-amber-500" />
                                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-500">
                                        Không hỗ trợ
                                    </span>
                                </>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                            {hasNvidiaGpu
                                ? "Máy tính hỗ trợ tăng tốc bằng NVIDIA CUDA."
                                : "Cần card NVIDIA để sử dụng tính năng này."}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* GPUs Detail List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-primary" />
                        Danh sách Card Đồ họa (GPU)
                    </CardTitle>
                    <CardDescription>
                        Các bộ xử lý đồ họa được hệ thống nhận diện.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {gpus && gpus.length > 0 ? (
                        <div className="space-y-4">
                            {gpus.map((gpu, idx) => (
                                <div key={idx} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                            <Monitor className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{gpu}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {gpu.toLowerCase().includes("nvidia")
                                                    ? "Hỗ trợ CUDA Acceleration"
                                                    : "GPU Tích hợp / Khác"}
                                            </p>
                                        </div>
                                    </div>
                                    {gpu.toLowerCase().includes("nvidia") && (
                                        <span className="text-xs bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-1 rounded-full font-medium">
                                            NVIDIA
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic text-center py-4">
                            Không phát hiện được GPU nào.
                        </p>
                    )}
                </CardContent>
            </Card>

        </div>
    );
};
