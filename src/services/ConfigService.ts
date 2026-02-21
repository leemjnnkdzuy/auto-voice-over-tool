import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const CONFIG_PATH = isDev
    ? path.join(process.cwd(), 'src/config/config.json')
    : path.join(app.getPath('userData'), 'config.json');

const readConfig = (): Record<string, any> => {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error reading config:", error);
    }
    return {};
};

const writeConfig = (updates: Record<string, any>): boolean => {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const existing = readConfig();
        const config = { ...existing, ...updates };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4), 'utf-8');
        return true;
    } catch (error) {
        console.error("Error writing config:", error);
        return false;
    }
};

export const getPinnedPath = (): string => {
    return readConfig().pinnedPath || "";
};

export const setPinnedPath = (pinnedPath: string): boolean => {
    return writeConfig({ pinnedPath });
};

export const getApiKey = (provider: string): string => {
    const config = readConfig();
    return config.apiKeys?.[provider] || "";
};

export const setApiKey = (provider: string, key: string): boolean => {
    const config = readConfig();
    const apiKeys = { ...(config.apiKeys || {}), [provider]: key };
    return writeConfig({ apiKeys });
};

export const createProjectFolder = (basePath: string, projectName: string): boolean => {
    try {
        const targetDir = path.join(basePath, projectName);

        if (fs.existsSync(targetDir)) {
            return false;
        }

        fs.mkdirSync(targetDir, { recursive: true });

        // Create initial project.json
        const metadata = {
            id: Date.now().toString(), // Simple ID, or passed from DB?
            name: projectName,
            createdAt: new Date().toISOString(),
            status: 'created'
        };

        const configFile = path.join(targetDir, 'project.json');
        fs.writeFileSync(configFile, JSON.stringify(metadata, null, 4), 'utf-8');

        return true;
    } catch (error) {
        console.error("Error creating project folder:", error);
        return false;
    }
};

export const deleteProjectFolder = (projectPath: string): boolean => {
    try {
        if (fs.existsSync(projectPath)) {
            fs.rmSync(projectPath, { recursive: true, force: true });
        }
        return true;
    } catch (error) {
        console.error("Error deleting project folder:", error);
        return false;
    }
};

export const getProjectMetadata = (projectPath: string): any => {
    try {
        const configFile = path.join(projectPath, 'project.json');
        if (fs.existsSync(configFile)) {
            const data = fs.readFileSync(configFile, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error reading project metadata:", error);
    }
    return null;
};

export const saveProjectMetadata = (projectPath: string, metadata: any): boolean => {
    try {
        const configFile = path.join(projectPath, 'project.json');

        // Merge with existing if possible
        let existing = {};
        if (fs.existsSync(configFile)) {
            try {
                existing = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            } catch (e) { }
        }

        const updated = { ...existing, ...metadata, updatedAt: new Date().toISOString() };
        fs.writeFileSync(configFile, JSON.stringify(updated, null, 4), 'utf-8');
        return true;
    } catch (error) {
        console.error("Error writing project metadata:", error);
        return false;
    }
};
