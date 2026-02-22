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
        id: "openai",
        name: "OpenAI",
        description: "Dùng để dịch phụ đề sang các ngôn ngữ khác",
        placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        urlPlaceholder: "https://api.openai.com/v1",
        modelPlaceholder: "grok-3",
        promptPlaceholder: "Optional: Custom system prompt for translation...",
    },
];

export const ApiKeyManagerPopup = ({ open, onOpenChange }: ApiKeyManagerPopupProps) => {
    const [keys, setKeys] = useState<Record<string, string>>({});
    const [urls, setUrls] = useState<Record<string, string>>({});
    const [models, setModels] = useState<Record<string, string>>({});
    const [prompts, setPrompts] = useState<Record<string, string>>({});
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});
    const [saved, setSaved] = useState<Record<string, boolean>>({});
    const [testing, setTesting] = useState<Record<string, boolean>>({});
    const [testResult, setTestResult] = useState<Record<string, { success: boolean; message: string }>>({});

    useEffect(() => {
        if (open) {
            loadKeys();
        }
    }, [open]);

    const loadKeys = async () => {
        const loadedKeys: Record<string, string> = {};
        const loadedUrls: Record<string, string> = {};
        const loadedModels: Record<string, string> = {};
        const loadedPrompts: Record<string, string> = {};
        for (const provider of PROVIDERS) {
            loadedKeys[provider.id] = await window.api.getApiKey(provider.id);
            loadedUrls[provider.id] = await window.api.getApiKey(`${provider.id}_url`); // Use getApiKey for url as well for now
            loadedModels[provider.id] = await window.api.getApiKey(`${provider.id}_model`);
            loadedPrompts[provider.id] = await window.api.getApiKey(`${provider.id}_prompt`);
        }
        setKeys(loadedKeys);
        setUrls(loadedUrls);
        setModels(loadedModels);
        setPrompts(loadedPrompts);
    };

    const handleSave = async (providerId: string) => {
        setSaving(prev => ({ ...prev, [providerId]: true }));
        const successKey = await window.api.setApiKey(providerId, keys[providerId] || "");
        const successUrl = await window.api.setApiKey(`${providerId}_url`, urls[providerId] || "");
        const successModel = await window.api.setApiKey(`${providerId}_model`, models[providerId] || "");
        const successPrompt = await window.api.setApiKey(`${providerId}_prompt`, prompts[providerId] || "");

        setSaving(prev => ({ ...prev, [providerId]: false }));

        if (successKey && successUrl && successModel && successPrompt) {
            setSaved(prev => ({ ...prev, [providerId]: true }));
            setTimeout(() => {
                setSaved(prev => ({ ...prev, [providerId]: false }));
            }, 2000);
        }
    };

    const handleTest = async (providerId: string) => {
        setTesting(prev => ({ ...prev, [providerId]: true }));
        setTestResult(prev => ({ ...prev, [providerId]: { success: false, message: "" } })); // clear previous

        try {
            const baseUrl = urls[providerId] || "https://api.openai.com/v1";
            const apiKey = keys[providerId] || "";
            const modelName = models[providerId] || "grok-3";

            if (!apiKey) {
                throw new Error("Vui lòng nhập API Key");
            }

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [{ role: "user", content: "你好呀!" }],
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(await response.text() || "Kết nối thất bại");
            }

            const data = await response.json();
            const reply = data.choices?.[0]?.message?.content || "Không có phản hồi";

            setTestResult(prev => ({ ...prev, [providerId]: { success: true, message: `Kết nối thành công! AI: ${reply}` } }));
        } catch (error: any) {
            setTestResult(prev => ({ ...prev, [providerId]: { success: false, message: error.message || "Lỗi kết nối" } }));
        } finally {
            setTesting(prev => ({ ...prev, [providerId]: false }));
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
                            <div className="flex flex-col gap-2">
                                <Input
                                    type="text"
                                    placeholder={provider.urlPlaceholder}
                                    value={urls[provider.id] || ""}
                                    onChange={(e) => setUrls(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                    className="font-mono text-sm"
                                />
                                <Input
                                    type="text"
                                    placeholder={provider.modelPlaceholder}
                                    value={models[provider.id] || ""}
                                    onChange={(e) => setModels(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                    className="font-mono text-sm"
                                />
                                <textarea
                                    placeholder={provider.promptPlaceholder}
                                    value={prompts[provider.id] || ""}
                                    onChange={(e) => setPrompts(prev => ({ ...prev, [provider.id]: e.target.value }))}
                                    className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono resize-y mb-2"
                                    rows={2}
                                />
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
                                        variant="outline"
                                        onClick={() => handleTest(provider.id)}
                                        disabled={testing[provider.id] || !keys[provider.id]}
                                        className="shrink-0"
                                    >
                                        {testing[provider.id] ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            "Test API"
                                        )}
                                    </Button>
                                    <Button
                                        variant={saved[provider.id] ? "default" : "outline"}
                                        onClick={() => handleSave(provider.id)}
                                        disabled={saving[provider.id]}
                                        className="shrink-0 w-20"
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
                                {testResult[provider.id] && (
                                    <div className={`text-xs mt-1 ${testResult[provider.id].success ? 'text-green-500' : 'text-red-500'}`}>
                                        {testResult[provider.id].message}
                                    </div>
                                )}
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
