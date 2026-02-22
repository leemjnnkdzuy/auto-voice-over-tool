import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Check, X, Star, Info } from "lucide-react";

interface TranslatePrompt {
    id: string;
    name: string;
    systemPrompt: string;
    isDefault?: boolean;
}

export const PromptTranslateManagerPage = () => {
    const [prompts, setPrompts] = useState<TranslatePrompt[]>([]);
    const [activePromptId, setActivePromptId] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editPrompt, setEditPrompt] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState("");
    const [newPrompt, setNewPrompt] = useState("");

    const loadData = async () => {
        const loaded = await window.api.getPrompts();
        setPrompts(loaded);
        const activeId = await window.api.getActivePromptId();
        setActivePromptId(activeId);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSetActive = async (id: string) => {
        await window.api.setActivePromptId(id);
        setActivePromptId(id);
    };

    const handleAdd = async () => {
        if (!newName.trim() || !newPrompt.trim()) return;
        const newItem: TranslatePrompt = {
            id: `prompt-${Date.now()}`,
            name: newName.trim(),
            systemPrompt: newPrompt.trim(),
        };
        const updated = [...prompts, newItem];
        await window.api.savePrompts(updated);
        setPrompts(updated);
        setIsAdding(false);
        setNewName("");
        setNewPrompt("");
    };

    const handleStartEdit = (prompt: TranslatePrompt) => {
        setEditingId(prompt.id);
        setEditName(prompt.name);
        setEditPrompt(prompt.systemPrompt);
    };

    const handleSaveEdit = async () => {
        if (!editingId || !editName.trim() || !editPrompt.trim()) return;
        const updated = prompts.map(p =>
            p.id === editingId ? { ...p, name: editName.trim(), systemPrompt: editPrompt.trim() } : p
        );
        await window.api.savePrompts(updated);
        setPrompts(updated);
        setEditingId(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Bạn chắc chắn muốn xóa prompt này?")) return;
        const updated = prompts.filter(p => p.id !== id);
        await window.api.savePrompts(updated);
        setPrompts(updated);
        if (activePromptId === id && updated.length > 0) {
            await handleSetActive(updated[0].id);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold">Quản lý Prompt dịch</h2>
                <p className="text-sm text-muted-foreground mt-1">
                    Tạo và quản lý các prompt dịch cho từng loại video khác nhau.
                </p>
            </div>

            <div className="bg-muted/50 border rounded-lg p-3 flex items-start gap-2 text-sm">
                <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="space-y-1 text-muted-foreground">
                    <p>Prompt chỉ cần mô tả <strong>phong cách/chủ đề</strong> dịch (ví dụ: thuật ngữ Minecraft, giọng vlog...). Chương trình sẽ <strong>tự động</strong> thêm ngôn ngữ đích và quy tắc format.</p>
                    <p>Prompt đang được chọn (có <Star className="inline w-3 h-3 text-yellow-500" />) sẽ được dùng khi dịch phụ đề.</p>
                </div>
            </div>

            <div className="space-y-3">
                {prompts.map(prompt => (
                    <div
                        key={prompt.id}
                        className={`border rounded-xl p-4 transition-all ${activePromptId === prompt.id
                            ? "border-primary/50 bg-primary/5 shadow-sm"
                            : "bg-card hover:border-primary/20"
                            }`}
                    >
                        {editingId === prompt.id ? (
                            <div className="space-y-3">
                                <Input
                                    value={editName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                                    placeholder="Tên prompt..."
                                    className="font-medium"
                                />
                                <Textarea
                                    value={editPrompt}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditPrompt(e.target.value)}
                                    placeholder="System prompt..."
                                    rows={8}
                                    className="text-sm font-mono"
                                />
                                <div className="flex gap-2 justify-end">
                                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                                        <X className="w-3.5 h-3.5 mr-1" /> Hủy
                                    </Button>
                                    <Button size="sm" onClick={handleSaveEdit}>
                                        <Check className="w-3.5 h-3.5 mr-1" /> Lưu
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-sm">{prompt.name}</h3>
                                        {activePromptId === prompt.id && (
                                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                        )}
                                        {prompt.isDefault && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">Mặc định</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                                        {prompt.systemPrompt.slice(0, 150)}...
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {activePromptId !== prompt.id && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleSetActive(prompt.id)}
                                            title="Chọn làm prompt hoạt động"
                                        >
                                            <Star className="w-3.5 h-3.5" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleStartEdit(prompt)}
                                        title="Sửa"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    {!prompt.isDefault && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(prompt.id)}
                                            title="Xóa"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {isAdding ? (
                <div className="border rounded-xl p-4 space-y-3 bg-card">
                    <Input
                        value={newName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
                        placeholder="Tên prompt (vd: Gaming Video, Vlog du lịch...)"
                        className="font-medium"
                    />
                    <Textarea
                        value={newPrompt}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewPrompt(e.target.value)}
                        placeholder={`Mô tả phong cách/chủ đề dịch...

Ví dụ: You are a professional gaming subtitle translator.
- Use official game terminology
- Keep translations natural and suitable for voice-over
- Keep proper nouns unchanged`}
                        rows={8}
                        className="text-sm font-mono"
                    />
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => { setIsAdding(false); setNewName(""); setNewPrompt(""); }}>
                            <X className="w-3.5 h-3.5 mr-1" /> Hủy
                        </Button>
                        <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || !newPrompt.trim()}>
                            <Check className="w-3.5 h-3.5 mr-1" /> Thêm
                        </Button>
                    </div>
                </div>
            ) : (
                <Button variant="outline" className="w-full gap-2" onClick={() => setIsAdding(true)}>
                    <Plus className="w-4 h-4" />
                    Thêm prompt mới
                </Button>
            )}
        </div>
    );
};
