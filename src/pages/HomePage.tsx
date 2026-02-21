import { useState, useEffect } from "react";
import { Plus, Folder, Pin, Trash, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ApiKeyManagerPopup } from "@/components/common/ApiKeyManagerPopup";

interface Project {
    id: string;
    name: string;
    path: string;
    createdAt: string;
    pinned?: boolean;
}

import { useNavigate } from "react-router-dom";

export const HomePage = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [projectName, setProjectName] = useState("");
    const [projectPath, setProjectPath] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);

    useEffect(() => {
        loadProjects();
    }, []);

    // Check if the current path matches the pinned path whenever it changes
    useEffect(() => {
        checkPinnedStatus();
    }, [projectPath, isDialogOpen]);

    const checkPinnedStatus = async () => {
        const pinnedPath = await window.api.getPinnedPath();
        if (isDialogOpen && !projectPath && pinnedPath) {
            setProjectPath(pinnedPath);
        }
        setIsPinned(pinnedPath === projectPath && projectPath !== "");
    };

    const loadProjects = async () => {
        const data = await window.api.getProjects();
        setProjects(data);
    };

    const handleCreateProject = async () => {
        // 1. Create the physical folder structure
        const success = await window.api.createProjectFolder(projectPath, projectName);
        if (!success) {
            alert("Không thể tạo thư mục project! (Có thể thư mục đã tồn tại)");
            return;
        }

        // 2. The full path is now the base path + project name
        // We might want to store the full path in the DB, or keep them separate.
        // Usually "path" in DB means "where is this project located".
        // Let's assume standard behavior: user picks "C:\Projects", names "MyApp", 
        // real path is "C:\Projects\MyApp".
        // BUT, currently the UI says "Đường dẫn" (Path) and inputs a base path.
        // Let's update the path stored in DB to be the full path.
        // Wait, standard Windows path joining...
        // Use a simple string concatenation with separator derived from OS? 
        // Or just let the backend handle path joining? 
        // Ideally backend returns the full path. 
        // For now, let's assume `path` input IS the parent folder.
        // We will construct the display path as `projectPath` (parent) + `\` + `projectName`.
        // Or better, let's just leave the path in DB as "C:\Parent\ProjectName".
        // But `createProjectFolder` took (base, name).

        // Let's make sure we construct the path correctly for DB storage.
        // Since we don't have 'path' module in renderer, we can guess separator or just store the base.
        // However, user usually wants to see the full path.

        // Actually, let's just store what we have. "c:\Users\..." + "\" + "Name".
        // To be safe, let's assume Windows backslash since user OS is Windows.
        const fullPath = `${projectPath.replace(/\/$/, '')}\\${projectName}`;

        const newProject = {
            id: crypto.randomUUID(),
            name: projectName,
            path: fullPath,
            // pinned status is no longer saved per project in the DB
        };

        const created = await window.api.addProject(newProject);
        if (created) {
            loadProjects();
            setProjectName("");
            // keep projectPath if it's pinned? yes the logic handles that.
            setIsDialogOpen(false);
            setIsPinned(false);
        }
    };

    const handleDeleteProject = async (id: string) => {
        if (confirm("Bạn có chắc chắn muốn xóa project này không?")) {
            await window.api.deleteProject(id);
            loadProjects();
        }
    };

    const handlePinClick = async () => {
        if (isPinned) {
            // Unpin
            await window.api.setPinnedPath("");
            setIsPinned(false);
        } else {
            // Pin current path
            if (projectPath) {
                await window.api.setPinnedPath(projectPath);
                setIsPinned(true);
            }
        }
    };

    return (
        <div className="p-8">
            {/* Top Left Buttons */}
            <div className="mb-8 flex items-center gap-3">
                <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <AlertDialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            Tạo Project
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Tạo Project Mới</AlertDialogTitle>
                            <AlertDialogDescription>
                                Nhập tên và đường dẫn cho project mới của bạn.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <label htmlFor="name" className="text-sm font-medium">
                                    Tên Project
                                </label>
                                <Input
                                    id="name"
                                    placeholder="Ví dụ: My App"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                />
                            </div>
                            <div className="grid gap-2">
                                <label htmlFor="path" className="text-sm font-medium">
                                    Đường dẫn
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        id="path"
                                        placeholder="C:\Projects\My App"
                                        value={projectPath}
                                        onChange={(e) => setProjectPath(e.target.value)}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        title={isPinned ? "Bỏ ghim" : "Ghim đường dẫn"}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handlePinClick();
                                        }}
                                        className={isPinned ? "border-primary text-primary" : ""}
                                    >
                                        <Pin className={`w-4 h-4 transition-all ${isPinned ? "rotate-45 fill-current" : ""}`} />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        title="Chọn thư mục"
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            const path = await window.api.selectDirectory();
                                            if (path) {
                                                setProjectPath(path);
                                            }
                                        }}
                                    >
                                        <Folder className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e: React.MouseEvent) => {
                                    if (!projectName || !projectPath) {
                                        e.preventDefault();
                                        // Optional: Show error or toast
                                        return;
                                    }
                                    handleCreateProject();
                                }}
                            >
                                Tạo
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                <Button variant="outline" className="gap-2" onClick={() => setIsApiKeyOpen(true)}>
                    <Key className="w-4 h-4" />
                    API Key
                </Button>

                <ApiKeyManagerPopup open={isApiKeyOpen} onOpenChange={setIsApiKeyOpen} />
            </div>

            {/* Project List */}
            <div className="space-y-4">
                <h2 className="text-2xl font-bold tracking-tight">Danh sách Project</h2>
                {projects.length === 0 ? (
                    <div className="text-muted-foreground text-sm">
                        Chưa có project nào được tạo.
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {projects.map((project) => (
                            <div
                                key={project.id}
                                className="group relative rounded-lg border bg-card text-card-foreground shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => navigate(`/project/${project.id}`)}
                            >
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteProject(project.id);
                                    }}
                                >
                                    <Trash className="w-4 h-4" />
                                </Button>
                                <div className="flex flex-col space-y-1.5 pr-8">
                                    <h3 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
                                        {project.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground break-all">
                                        {project.path}
                                    </p>
                                </div>
                                <div className="mt-4 text-xs text-muted-foreground">
                                    Được tạo: {new Date(project.createdAt).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
