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
        clearProjectData: (projectPath: string) => Promise<boolean>;
        getVideoInfo: (url: string) => Promise<any>;
        downloadVideo: (url: string, projectPath: string) => void;
        onDownloadProgress: (callback: (progress: { video: number; audio: number }) => void) => void;
        onDownloadComplete: (callback: (success: boolean) => void) => void;
        selectVideoFile: () => Promise<string | null>;
        importLocalVideo: (sourcePath: string, projectPath: string) => void;
        onImportLocalComplete: (callback: (videoInfo: any) => void) => void;
        removeDownloadListeners: () => void;

        // Environment
        checkEnvironment: () => Promise<boolean>;
        setupEnvironment: () => void;
        onSetupProgress: (callback: (progress: any) => void) => void;
        removeSetupListeners: () => void;

        // Transcription
        getExistingSrt: (projectPath: string, videoId: string) => Promise<{ srtPath: string; srtContent: string } | null>;
        transcribeAudio: (projectPath: string, videoId: string) => void;
        onTranscriptProgress: (callback: (progress: any) => void) => void;
        onTranscriptComplete: (callback: (result: any) => void) => void;
        removeTranscriptListeners: () => void;

        // Audio playback
        readAudioFile: (projectPath: string, videoId: string) => Promise<{ buffer: ArrayBuffer; mimeType: string } | null>;

        // Engine check
        checkWhisperEngine: (engine: string) => Promise<boolean>;
        checkWhisperTurboModelReady: () => Promise<boolean>;

        // SRT optimization
        optimizeSrt: (srtPath: string) => Promise<{ srtContent: string } | null>;
        saveSrt: (srtPath: string, content: string) => Promise<boolean>;

        // Translation
        saveTranslatedSrt: (projectPath: string, videoId: string, lang: string, content: string) => Promise<string | null>;
        getTranslatedSrt: (projectPath: string, videoId: string, lang: string) => Promise<string | null>;

        // Edge TTS
        generateAudio: (projectPath: string, videoId: string, lang: string, concurrency: number, voiceName?: string) => void;
        generateSingleAudio: (projectPath: string, videoId: string, lang: string, targetIndex: number, voiceName?: string) => Promise<boolean>;
        onAudioGenerateProgress: (callback: (progress: any) => void) => void;
        removeAudioGenerateListeners: () => void;
        listGeneratedAudio: (projectPath: string, videoId: string) => Promise<{ name: string; path: string }[]>;
        readGeneratedAudio: (filePath: string) => Promise<string | null>;
        getEdgeVoices: () => Promise<any[]>;
        previewEdgeVoice: (voiceName: string, text: string) => Promise<string | null>;
        readVideoFile: (filePath: string) => Promise<string | null>;

        // Final Video
        checkFinalVideoReady: (projectPath: string, videoId: string) => Promise<{ ready: boolean; missing?: string; existingFinal?: string | null }>;
        createFinalVideo: (projectPath: string, videoId: string) => void;
        onFinalVideoProgress: (callback: (progress: any) => void) => void;
        removeFinalVideoListeners: () => void;
        openInExplorer: (filePath: string) => Promise<boolean>;
        openFile: (filePath: string) => Promise<boolean>;
        exportSubtitle: (content: string, defaultName: string, extensions: string[]) => Promise<boolean>;
    };
}
