import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

let db: Database.Database | null = null;

export interface Project {
    id: string;
    name: string;
    path: string;
    createdAt?: string;
    pinned?: boolean;
}

interface ProjectRow extends Omit<Project, 'pinned'> {
    pinned: number;
}

export const connectDB = () => {
    if (db) return db;

    const dbPath = path.join(app.getPath('userData'), 'projects.db');

    try {
        db = new Database(dbPath, {
            verbose: console.log
        });

        db.exec(`
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                path TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                pinned INTEGER DEFAULT 0
            )
        `);

        try {
            db.exec('ALTER TABLE projects ADD COLUMN pinned INTEGER DEFAULT 0');
        } catch (error) {
            // Ignore if the column already exists from a previous schema version.
            console.debug('Skipping pinned column migration:', error);
        }

        return db;
    } catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
    }
};

export const getProjects = (): Project[] => {
    if (!db) connectDB();
    const result = db
        .prepare('SELECT * FROM projects ORDER BY pinned DESC, createdAt DESC')
        .all() as ProjectRow[];
    return result.map((p) => ({ ...p, pinned: !!p.pinned }));
};

export const addProject = (project: Omit<Project, 'createdAt'>): Project | null => {
    if (!db) connectDB();
    try {
        const insert = db.prepare('INSERT INTO projects (id, name, path, pinned) VALUES (@id, @name, @path, @pinned)');
        insert.run({ ...project, pinned: project.pinned ? 1 : 0 });
        return db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id) as Project;
    } catch (error) {
        console.error('Error adding project:', error);
        return null;
    }
};

export const updateProjectPin = (id: string, pinned: boolean): boolean => {
    if (!db) connectDB();
    try {
        const stmt = db.prepare('UPDATE projects SET pinned = ? WHERE id = ?');
        const info = stmt.run(pinned ? 1 : 0, id);
        return info.changes > 0;
    } catch (error) {
        console.error('Error updating project pin:', error);
        return false;
    }
};

export const deleteProject = (id: string): boolean => {
    if (!db) connectDB();
    try {
        const info = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        return info.changes > 0;
    } catch (error) {
        console.error('Error deleting project:', error);
        return false;
    }
};
