/// <reference types="vite/client" />

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

interface Window {
    api: {
        getProjects: () => Promise<any[]>;
        addProject: (project: { id: string; name: string; path: string }) => Promise<any>;
        deleteProject: (id: string) => Promise<boolean>;
        selectDirectory: () => Promise<string | null>;
        getPinnedPath: () => Promise<string>;
        setPinnedPath: (path: string) => Promise<boolean>;
        getHardwareInfo: () => Promise<{ cpuName: string; totalRamGB: number; gpus: string[]; hasNvidiaGpu: boolean }>;

        openSettingsWindow: () => Promise<void>;

        getApiKey: (provider: string) => Promise<string>;
        setApiKey: (provider: string, key: string) => Promise<boolean>;
        getPrompts: () => Promise<{ id: string; name: string; systemPrompt: string; isDefault?: boolean }[]>;
        savePrompts: (prompts: { id: string; name: string; systemPrompt: string; isDefault?: boolean }[]) => Promise<boolean>;
        getActivePromptId: () => Promise<string>;
        setActivePromptId: (id: string) => Promise<boolean>;
        createProjectFolder: (basePath: string, projectName: string) => Promise<boolean>;
        getProjectMetadata: (projectPath: string) => Promise<any>;
        saveProjectMetadata: (projectPath: string, metadata: any) => Promise<boolean>;
        resetProjectData: (projectPath: string) => Promise<boolean>;
        getVideoInfo: (url: string) => Promise<any>;
        downloadVideo: (url: string, projectPath: string) => void;
        onDownloadProgress: (callback: (progress: { video: number; audio: number }) => void) => void;
        onDownloadComplete: (callback: (success: boolean) => void) => void;
        removeDownloadListeners: () => void;

        selectVideoFile: () => Promise<string | null>;
        importLocalVideo: (filePath: string, projectPath: string) => void;
        onImportLocalProgress: (callback: (progress: { step: string; progress: number; detail: string }) => void) => void;
        onImportLocalComplete: (callback: (success: boolean) => void) => void;
        removeImportLocalListeners: () => void;

        checkEnvironment: () => Promise<boolean>;
        setupEnvironment: () => void;
        onSetupProgress: (callback: (progress: any) => void) => void;
        removeSetupListeners: () => void;

        getExistingSrt: (projectPath: string) => Promise<{ srtPath: string; srtContent: string } | null>;
        transcribeAudio: (projectPath: string, engine?: string, language?: string) => void;
        onTranscriptProgress: (callback: (progress: any) => void) => void;
        onTranscriptComplete: (callback: (result: any) => void) => void;
        removeTranscriptListeners: () => void;

        readAudioFile: (projectPath: string) => Promise<{ buffer: ArrayBuffer; mimeType: string } | null>;

        checkWhisperEngine: (engine: string) => Promise<boolean>;

        getWhisperDownloadStatus: () => Promise<{ modelId: string | null; percent: number }>;
        listWhisperModels: () => Promise<Array<{
            id: string;
            name: string;
            fileName: string;
            disk: string;
            mem: string;
            downloaded: boolean;
            active: boolean;
        }>>;
        downloadWhisperModel: (modelId: string) => void;
        onWhisperModelDownloadProgress: (callback: (progress: { modelId: string; percent: number; done?: boolean; success?: boolean }) => void) => void;
        removeWhisperModelListeners: () => void;
        deleteWhisperModel: (modelId: string) => Promise<boolean>;
        getActiveWhisperModel: () => Promise<string>;
        setActiveWhisperModel: (modelId: string) => Promise<boolean>;

        optimizeSrt: (srtPath: string) => Promise<{ srtContent: string } | null>;

        saveTranslatedSrt: (projectPath: string, lang: string, content: string) => Promise<string | null>;
        getTranslatedSrt: (projectPath: string, lang: string) => Promise<string | null>;

        generateAudio: (projectPath: string, lang: string) => void;
        generateSingleAudio: (projectPath: string, lang: string, targetIndex: number) => Promise<boolean>;
        onAudioGenerateProgress: (callback: (progress: any) => void) => void;
        removeAudioGenerateListeners: () => void;
        listGeneratedAudio: (projectPath: string) => Promise<{ name: string; path: string }[]>;
        readGeneratedAudio: (filePath: string) => Promise<string | null>;
        readVideoFile: (filePath: string) => Promise<string | null>;

        checkFinalVideoReady: (projectPath: string) => Promise<{ ready: boolean; missing?: string; existingFinal?: string | null }>;
        createFinalVideo: (projectPath: string) => void;
        onFinalVideoProgress: (callback: (progress: any) => void) => void;
        removeFinalVideoListeners: () => void;
        openInExplorer: (filePath: string) => Promise<boolean>;
        openFile: (filePath: string) => Promise<boolean>;
        checkProjectPhases: (projectPath: string) => Promise<{
            download: boolean;
            transcript: boolean;
            translate: boolean;
            audio: boolean;
            final: boolean;
        }>;
    };
}
