export { };

declare global {
    interface Window {
        api: {
            getProjects: () => Promise<any[]>;
            addProject: (project: { id: string; name: string; path: string; pinned?: boolean }) => Promise<any>;
            deleteProject: (id: string) => Promise<boolean>;
            updateProjectPin: (id: string, pinned: boolean) => Promise<boolean>;
            selectDirectory: () => Promise<string | null>;
            getPinnedPath: () => Promise<string>;
            setPinnedPath: (path: string) => Promise<boolean>;
        };
    }
}
