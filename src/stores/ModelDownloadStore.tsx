import { create } from "zustand";

interface ModelDownloadState {
    downloadingId: string | null;
    downloadPercent: number;
    startDownload: (modelId: string) => void;
}

export const useModelDownloadStore = create<ModelDownloadState>((set) => ({
    downloadingId: null,
    downloadPercent: 0,

    startDownload: (modelId: string) => {
        set({ downloadingId: modelId, downloadPercent: 0 });
        window.api.downloadWhisperModel(modelId);
    },
}));

const poll = async () => {
    try {
        const status = await window.api.getWhisperDownloadStatus();
        const state = useModelDownloadStore.getState();

        if (status.modelId) {
            if (state.downloadingId !== status.modelId || state.downloadPercent !== status.percent) {
                useModelDownloadStore.setState({
                    downloadingId: status.modelId,
                    downloadPercent: status.percent,
                });
            }
        } else if (state.downloadingId !== null) {
            useModelDownloadStore.setState({ downloadingId: null, downloadPercent: 0 });
        }
    } catch {  }
};

if (typeof window !== "undefined" && window.api) {
    poll();
    setInterval(poll, 500);
}
