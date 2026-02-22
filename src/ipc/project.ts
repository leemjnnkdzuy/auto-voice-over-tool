import { ipcMain, dialog } from "electron";
import {
    getProjects,
    addProject,
    deleteProject,
    updateProjectPin,
} from "../services/DatabaseService";
import {
    getPinnedPath,
    setPinnedPath,
    createProjectFolder,
    deleteProjectFolder,
    getProjectMetadata,
    saveProjectMetadata,
} from "../services/ConfigService";
import { closeStreamsForPath } from "../services/VideoServerService";

export const setupProjectIpc = () => {
    ipcMain.handle("get-projects", () => {
        return getProjects();
    });

    ipcMain.handle("add-project", (_event, project) => {
        return addProject(project);
    });

    ipcMain.handle("delete-project", async (_event, id) => {
        const projects = getProjects();
        const project = projects.find((p: any) => p.id === id);
        if (project) {
            closeStreamsForPath(project.path);
            await new Promise((r) => setTimeout(r, 300));
            deleteProjectFolder(project.path);
        }
        return deleteProject(id);
    });

    ipcMain.handle("update-project-pin", (_event, id, pinned) => {
        return updateProjectPin(id, pinned);
    });

    ipcMain.handle("select-directory", async () => {
        const result = await dialog.showOpenDialog({
            properties: ["openDirectory"],
        });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle("get-pinned-path", () => {
        return getPinnedPath();
    });

    ipcMain.handle("set-pinned-path", (_event, path) => {
        return setPinnedPath(path);
    });

    ipcMain.handle("create-project-folder", (_event, basePath, projectName) => {
        return createProjectFolder(basePath, projectName);
    });

    ipcMain.handle("get-project-metadata", (_event, projectPath) => {
        return getProjectMetadata(projectPath);
    });

    ipcMain.handle("save-project-metadata", (_event, projectPath, metadata) => {
        return saveProjectMetadata(projectPath, metadata);
    });

    ipcMain.handle("reset-project-data", (_event, projectPath: string) => {
        const fs = require("fs");
        const path = require("path");

        const foldersToDelete = ["original", "transcript", "translate", "audio_gene", "final"];

        for (const folder of foldersToDelete) {
            const fullPath = path.join(projectPath, folder);
            if (fs.existsSync(fullPath)) {
                fs.rmSync(fullPath, { recursive: true, force: true });
            }
        }

        // Reset project.json
        const configFile = path.join(projectPath, "project.json");
        if (fs.existsSync(configFile)) {
            try {
                const meta = JSON.parse(fs.readFileSync(configFile, "utf-8"));
                // Keep only project name, clear everything else
                const cleaned: any = {};
                if (meta.name) cleaned.name = meta.name;
                fs.writeFileSync(configFile, JSON.stringify(cleaned, null, 2), "utf-8");
            } catch {
                fs.writeFileSync(configFile, "{}", "utf-8");
            }
        }

        return true;
    });
};
