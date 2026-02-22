import { useState, useEffect } from "react";
import { Plus, Folder, Pin, Trash, Settings } from "lucide-react";
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

    useEffect(() => {
        loadProjects();
    }, []);

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
        const success = await window.api.createProjectFolder(projectPath, projectName);
        if (!success) {
            alert("Không thể tạo thư mục project! (Có thể thư mục đã tồn tại)");
            return;
        }

        const fullPath = `${projectPath.replace(/\/$/, '')}\\${projectName}`;

        const newProject = {
            id: crypto.randomUUID(),
            name: projectName,
            path: fullPath,
        };

        const created = await window.api.addProject(newProject);
        if (created) {
            loadProjects();
            setProjectName("");
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
            await window.api.setPinnedPath("");
            setIsPinned(false);
        } else {
            if (projectPath) {
                await window.api.setPinnedPath(projectPath);
                setIsPinned(true);
            }
        }
    };

    return (
        <div className="p-8">
            {}
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

                <Button variant="outline" className="gap-2" onClick={() => window.api.openSettingsWindow()}>
                    <Settings className="w-4 h-4" />
                    Cài đặt
                </Button>
            </div>

            {}
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
