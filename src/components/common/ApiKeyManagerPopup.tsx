import { useState, useEffect } from "react";
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
} from "@/components/ui/alert-dialog";
import { Key, Eye, EyeOff, Check, Loader2 } from "lucide-react";

interface ApiKeyManagerPopupProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const PROVIDERS = [
    {
        id: "deepseek",
        name: "DeepSeek",
        description: "Dùng để dịch phụ đề sang các ngôn ngữ khác",
        placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    },
];

export const ApiKeyManagerPopup = ({ open, onOpenChange }: ApiKeyManagerPopupProps) => {
    const [keys, setKeys] = useState<Record<string, string>>({});
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [saved, setSaved] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (open) {
            loadKeys();
        }
    }, [open]);

    const loadKeys = async () => {
        const loadedKeys: Record<string, string> = {};
        for (const provider of PROVIDERS) {
            loadedKeys[provider.id] = await window.api.getApiKey(provider.id);
        }
        setKeys(loadedKeys);
    };

    const handleSave = async (providerId: string) => {
        setSaving(prev => ({ ...prev, [providerId]: true }));
        const success = await window.api.setApiKey(providerId, keys[providerId] || "");
        setSaving(prev => ({ ...prev, [providerId]: false }));

        if (success) {
            setSaved(prev => ({ ...prev, [providerId]: true }));
            setTimeout(() => {
                setSaved(prev => ({ ...prev, [providerId]: false }));
            }, 2000);
        }
    };

    const toggleShowKey = (providerId: string) => {
        setShowKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }));
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5" />
                        Quản lý API Key
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Cấu hình API key cho các dịch vụ dịch thuật.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="space-y-6 py-4">
                    {PROVIDERS.map(provider => (
                        <div key={provider.id} className="space-y-3">
                            <div>
                                <h3 className="text-sm font-semibold">{provider.name}</h3>
                                <p className="text-xs text-muted-foreground">{provider.description}</p>
                            </div>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        type={showKeys[provider.id] ? "text" : "password"}
                                        placeholder={provider.placeholder}
                                        value={keys[provider.id] || ""}
                                        onChange={(e) => setKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                        className="pr-10 font-mono text-sm"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                        onClick={() => toggleShowKey(provider.id)}
                                    >
                                        {showKeys[provider.id] ? (
                                            <EyeOff className="w-4 h-4 text-muted-foreground" />
                                        ) : (
                                            <Eye className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </Button>
                                </div>
                                <Button
                                    variant={saved[provider.id] ? "default" : "outline"}
                                    onClick={() => handleSave(provider.id)}
                                    disabled={saving[provider.id]}
                                    className="shrink-0"
                                >
                                    {saving[provider.id] ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : saved[provider.id] ? (
                                        <Check className="w-4 h-4" />
                                    ) : (
                                        "Lưu"
                                    )}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel>Đóng</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};
