import { exec } from "child_process";
import os from "os";

export type HardwareInfo = {
    cpuName: string;
    totalRamGB: number;
    gpus: string[];
    hasNvidiaGpu: boolean;
};

export const getHardwareInfo = (): Promise<HardwareInfo> => {
    return new Promise((resolve) => {
        const cpuName = os.cpus()[0]?.model || "Unknown CPU";
        const totalRamGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));

        // Detect GPUs on Windows using PowerShell
        if (process.platform === "win32") {
            exec("powershell -command \"Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name\"", (error, stdout) => {
                let gpus: string[] = [];
                let hasNvidiaGpu = false;

                if (!error && stdout) {
                    const lines = stdout.split('\n').map(line => line.trim()).filter(line => line.length > 0);
                    gpus = lines;
                    hasNvidiaGpu = lines.some(name => name.toLowerCase().includes("nvidia"));
                }

                resolve({
                    cpuName,
                    totalRamGB,
                    gpus,
                    hasNvidiaGpu
                });
            });
        } else {
            resolve({
                cpuName,
                totalRamGB,
                gpus: ["Unknown GPU"],
                hasNvidiaGpu: false
            });
        }
    });
};
