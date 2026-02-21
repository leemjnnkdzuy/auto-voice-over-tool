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

        // API Key management
        getApiKey: (provider: string) => Promise<string>;
        setApiKey: (provider: string, key: string) => Promise<boolean>;
        createProjectFolder: (basePath: string, projectName: string) => Promise<boolean>;
        getProjectMetadata: (projectPath: string) => Promise<any>;
        saveProjectMetadata: (projectPath: string, metadata: any) => Promise<boolean>;
        getVideoInfo: (url: string) => Promise<any>;
        downloadVideo: (url: string, projectPath: string) => void;
        onDownloadProgress: (callback: (progress: { video: number; audio: number }) => void) => void;
        onDownloadComplete: (callback: (success: boolean) => void) => void;
        removeDownloadListeners: () => void;

        // Environment
        checkEnvironment: () => Promise<boolean>;
        setupEnvironment: () => void;
        onSetupProgress: (callback: (progress: any) => void) => void;
        removeSetupListeners: () => void;

        // Transcription
        getExistingSrt: (projectPath: string) => Promise<{ srtPath: string; srtContent: string } | null>;
        transcribeAudio: (projectPath: string, engine?: string) => void;
        onTranscriptProgress: (callback: (progress: any) => void) => void;
        onTranscriptComplete: (callback: (result: any) => void) => void;
        removeTranscriptListeners: () => void;

        // Audio playback
        readAudioFile: (projectPath: string) => Promise<{ buffer: ArrayBuffer; mimeType: string } | null>;

        // Engine check
        checkWhisperEngine: (engine: string) => Promise<boolean>;

        // SRT optimization
        optimizeSrt: (srtPath: string) => Promise<{ srtContent: string } | null>;

        // Translation
        saveTranslatedSrt: (projectPath: string, lang: string, content: string) => Promise<string | null>;
        getTranslatedSrt: (projectPath: string, lang: string) => Promise<string | null>;

        // Edge TTS
        generateAudio: (projectPath: string, lang: string) => void;
        generateSingleAudio: (projectPath: string, lang: string, targetIndex: number) => Promise<boolean>;
        onAudioGenerateProgress: (callback: (progress: any) => void) => void;
        removeAudioGenerateListeners: () => void;
        listGeneratedAudio: (projectPath: string) => Promise<{ name: string; path: string }[]>;
        readGeneratedAudio: (filePath: string) => Promise<string | null>;
        readVideoFile: (filePath: string) => Promise<string | null>;

        // Final Video
        checkFinalVideoReady: (projectPath: string) => Promise<{ ready: boolean; missing?: string; existingFinal?: string | null }>;
        createFinalVideo: (projectPath: string) => void;
        onFinalVideoProgress: (callback: (progress: any) => void) => void;
        removeFinalVideoListeners: () => void;
        openInExplorer: (filePath: string) => Promise<boolean>;
        openFile: (filePath: string) => Promise<boolean>;
    };
}
