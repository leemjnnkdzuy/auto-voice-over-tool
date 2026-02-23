import { create } from 'zustand';

interface HardwareState {
    hasNvidiaGpu: boolean;
    cpuName: string;
    totalRamGB: number;
    gpus: string[];
    isLoaded: boolean;
    fetchHardwareInfo: () => Promise<void>;
}

export const useHardwareStore = create<HardwareState>((set) => ({
    hasNvidiaGpu: false,
    cpuName: '',
    totalRamGB: 0,
    gpus: [],
    isLoaded: false,
    fetchHardwareInfo: async () => {
        try {
            const info = await window.api.getHardwareInfo();
            set({
                hasNvidiaGpu: info.hasNvidiaGpu,
                cpuName: info.cpuName,
                totalRamGB: info.totalRamGB,
                gpus: info.gpus,
                isLoaded: true
            });
        } catch (error) {
            console.error("Failed to fetch hardware info", error);
            set({ isLoaded: true });
        }
    }
}));
