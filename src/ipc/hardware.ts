import { ipcMain } from "electron";
import { getHardwareInfo } from "../services/HardwareService";

export const setupHardwareIpc = () => {
    ipcMain.handle("get-hardware-info", async () => {
        try {
            return await getHardwareInfo();
        } catch (error) {
            console.error("Error getting hardware info:", error);
            return {
                cpuName: "Unknown",
                totalRamGB: 0,
                gpus: [],
                hasNvidiaGpu: false
            };
        }
    });
};
