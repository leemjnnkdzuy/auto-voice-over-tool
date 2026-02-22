import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
    getProjects: () => ipcRenderer.invoke('get-projects'),
    addProject: (project: any) => ipcRenderer.invoke('add-project', project),
    deleteProject: (id: string) => ipcRenderer.invoke('delete-project', id),
    updateProjectPin: (id: string, pinned: boolean) => ipcRenderer.invoke('update-project-pin', id, pinned),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),

    // Config
    getPinnedPath: () => ipcRenderer.invoke('get-pinned-path'),
    setPinnedPath: (path: string) => ipcRenderer.invoke('set-pinned-path', path),

    // API Key management
    getApiKey: (provider: string) => ipcRenderer.invoke('get-api-key', provider),
    setApiKey: (provider: string, key: string) => ipcRenderer.invoke('set-api-key', provider, key),
    createProjectFolder: (basePath: string, projectName: string) => ipcRenderer.invoke('create-project-folder', basePath, projectName),
    getProjectMetadata: (projectPath: string) => ipcRenderer.invoke('get-project-metadata', projectPath),
    saveProjectMetadata: (projectPath: string, metadata: any) => ipcRenderer.invoke('save-project-metadata', projectPath, metadata),
    clearProjectData: (projectPath: string) => ipcRenderer.invoke('clear-project-data', projectPath),
    getVideoInfo: (url: string) => ipcRenderer.invoke('get-video-info', url),
    downloadVideo: (url: string, projectPath: string) => ipcRenderer.send('download-video', url, projectPath),
    onDownloadProgress: (callback: (progress: { video: number; audio: number }) => void) => ipcRenderer.on('download-progress', (_, progress) => callback(progress)),
    onDownloadComplete: (callback: (success: boolean) => void) => ipcRenderer.on('download-complete', (_, success) => callback(success)),
    selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
    importLocalVideo: (sourcePath: string, projectPath: string) => ipcRenderer.send('import-local-video', sourcePath, projectPath),
    onImportLocalComplete: (callback: (videoInfo: any) => void) => ipcRenderer.on('import-local-complete', (_, videoInfo) => callback(videoInfo)),
    removeDownloadListeners: () => {
        ipcRenderer.removeAllListeners('download-progress');
        ipcRenderer.removeAllListeners('download-complete');
        ipcRenderer.removeAllListeners('import-local-complete');
    },

    // Environment setup
    checkEnvironment: () => ipcRenderer.invoke('check-environment'),
    setupEnvironment: () => ipcRenderer.send('setup-environment'),
    onSetupProgress: (callback: (progress: any) => void) => ipcRenderer.on('setup-progress', (_, progress) => callback(progress)),
    removeSetupListeners: () => {
        ipcRenderer.removeAllListeners('setup-progress');
    },

    // Transcription
    getExistingSrt: (projectPath: string, videoId: string) => ipcRenderer.invoke('get-existing-srt', projectPath, videoId),
    transcribeAudio: (projectPath: string, videoId: string) => ipcRenderer.send('transcribe-audio', projectPath, videoId),
    onTranscriptProgress: (callback: (progress: any) => void) => ipcRenderer.on('transcript-progress', (_, progress) => callback(progress)),
    onTranscriptComplete: (callback: (result: any) => void) => ipcRenderer.on('transcript-complete', (_, result) => callback(result)),
    removeTranscriptListeners: () => {
        ipcRenderer.removeAllListeners('transcript-progress');
        ipcRenderer.removeAllListeners('transcript-complete');
    },

    // Audio playback
    readAudioFile: (projectPath: string, videoId: string) => ipcRenderer.invoke('read-audio-file', projectPath, videoId),

    // Engine check
    checkWhisperEngine: (engine: string) => ipcRenderer.invoke('check-whisper-engine', engine),
    checkWhisperTurboModelReady: () => ipcRenderer.invoke('check-whisper-turbo-model-ready'),

    // SRT optimization
    optimizeSrt: (srtPath: string) => ipcRenderer.invoke('optimize-srt', srtPath),
    saveSrt: (srtPath: string, content: string) => ipcRenderer.invoke('save-srt', srtPath, content),

    // Translation
    saveTranslatedSrt: (projectPath: string, videoId: string, lang: string, content: string) => ipcRenderer.invoke('save-translated-srt', projectPath, videoId, lang, content),
    getTranslatedSrt: (projectPath: string, videoId: string, lang: string) => ipcRenderer.invoke('get-translated-srt', projectPath, videoId, lang),

    // Edge TTS
    generateAudio: (projectPath: string, videoId: string, lang: string, concurrency: number, voiceName?: string) => ipcRenderer.send('generate-audio', projectPath, videoId, lang, concurrency, voiceName),
    generateSingleAudio: (projectPath: string, videoId: string, lang: string, targetIndex: number, voiceName?: string) => ipcRenderer.invoke('generate-single-audio', projectPath, videoId, lang, targetIndex, voiceName),
    onAudioGenerateProgress: (callback: (progress: any) => void) => ipcRenderer.on('audio-generate-progress', (event, progress) => callback(progress)),
    removeAudioGenerateListeners: () => ipcRenderer.removeAllListeners('audio-generate-progress'),
    listGeneratedAudio: (projectPath: string, videoId: string) => ipcRenderer.invoke('list-generated-audio', projectPath, videoId),
    readGeneratedAudio: (filePath: string) => ipcRenderer.invoke('read-generated-audio', filePath),
    readVideoFile: (filePath: string) => ipcRenderer.invoke('read-video-file', filePath),
    getEdgeVoices: () => ipcRenderer.invoke('get-edge-voices'),
    previewEdgeVoice: (voiceName: string, text: string) => ipcRenderer.invoke('preview-edge-voice', voiceName, text),

    // Final Video
    checkFinalVideoReady: (projectPath: string, videoId: string) => ipcRenderer.invoke('check-final-video-ready', projectPath, videoId),
    createFinalVideo: (projectPath: string, videoId: string) => ipcRenderer.send('create-final-video', projectPath, videoId),
    onFinalVideoProgress: (callback: (progress: any) => void) => ipcRenderer.on('final-video-progress', (_, progress) => callback(progress)),
    removeFinalVideoListeners: () => ipcRenderer.removeAllListeners('final-video-progress'),
    openInExplorer: (filePath: string) => ipcRenderer.invoke('open-in-explorer', filePath),
    openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
    exportSubtitle: (content: string, defaultName: string, extensions: string[]) => ipcRenderer.invoke('export-subtitle', content, defaultName, extensions),
});
