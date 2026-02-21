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
    getVideoInfo: (url: string) => ipcRenderer.invoke('get-video-info', url),
    downloadVideo: (url: string, projectPath: string) => ipcRenderer.send('download-video', url, projectPath),
    onDownloadProgress: (callback: (progress: { video: number; audio: number }) => void) => ipcRenderer.on('download-progress', (_, progress) => callback(progress)),
    onDownloadComplete: (callback: (success: boolean) => void) => ipcRenderer.on('download-complete', (_, success) => callback(success)),
    removeDownloadListeners: () => {
        ipcRenderer.removeAllListeners('download-progress');
        ipcRenderer.removeAllListeners('download-complete');
    },

    // Environment setup
    checkEnvironment: () => ipcRenderer.invoke('check-environment'),
    setupEnvironment: () => ipcRenderer.send('setup-environment'),
    onSetupProgress: (callback: (progress: any) => void) => ipcRenderer.on('setup-progress', (_, progress) => callback(progress)),
    removeSetupListeners: () => {
        ipcRenderer.removeAllListeners('setup-progress');
    },

    // Transcription
    getExistingSrt: (projectPath: string) => ipcRenderer.invoke('get-existing-srt', projectPath),
    transcribeAudio: (projectPath: string, engine?: string) => ipcRenderer.send('transcribe-audio', projectPath, engine),
    onTranscriptProgress: (callback: (progress: any) => void) => ipcRenderer.on('transcript-progress', (_, progress) => callback(progress)),
    onTranscriptComplete: (callback: (result: any) => void) => ipcRenderer.on('transcript-complete', (_, result) => callback(result)),
    removeTranscriptListeners: () => {
        ipcRenderer.removeAllListeners('transcript-progress');
        ipcRenderer.removeAllListeners('transcript-complete');
    },

    // Audio playback
    readAudioFile: (projectPath: string) => ipcRenderer.invoke('read-audio-file', projectPath),

    // Engine check
    checkWhisperEngine: (engine: string) => ipcRenderer.invoke('check-whisper-engine', engine),

    // SRT optimization
    optimizeSrt: (srtPath: string) => ipcRenderer.invoke('optimize-srt', srtPath),

    // Translation
    saveTranslatedSrt: (projectPath: string, lang: string, content: string) => ipcRenderer.invoke('save-translated-srt', projectPath, lang, content),
    getTranslatedSrt: (projectPath: string, lang: string) => ipcRenderer.invoke('get-translated-srt', projectPath, lang),

    // Edge TTS
    generateAudio: (projectPath: string, lang: string) => ipcRenderer.send('generate-audio', projectPath, lang),
    generateSingleAudio: (projectPath: string, lang: string, targetIndex: number) => ipcRenderer.invoke('generate-single-audio', projectPath, lang, targetIndex),
    onAudioGenerateProgress: (callback: (progress: any) => void) => ipcRenderer.on('audio-generate-progress', (event, progress) => callback(progress)),
    removeAudioGenerateListeners: () => ipcRenderer.removeAllListeners('audio-generate-progress'),
    listGeneratedAudio: (projectPath: string) => ipcRenderer.invoke('list-generated-audio', projectPath),
    readGeneratedAudio: (filePath: string) => ipcRenderer.invoke('read-generated-audio', filePath),
    readVideoFile: (filePath: string) => ipcRenderer.invoke('read-video-file', filePath),

    // Final Video
    checkFinalVideoReady: (projectPath: string) => ipcRenderer.invoke('check-final-video-ready', projectPath),
    createFinalVideo: (projectPath: string) => ipcRenderer.send('create-final-video', projectPath),
    onFinalVideoProgress: (callback: (progress: any) => void) => ipcRenderer.on('final-video-progress', (_, progress) => callback(progress)),
    removeFinalVideoListeners: () => ipcRenderer.removeAllListeners('final-video-progress'),
    openInExplorer: (filePath: string) => ipcRenderer.invoke('open-in-explorer', filePath),
    openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
});
