import type { ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Settings, Cpu, Key, AudioLines, FileText } from "lucide-react";
import "@/stores/ModelDownloadStore";
import {
    SidebarProvider,
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarInset,
} from "@/components/ui/sidebar";
import { WhisperModelPage } from "@/windows/setting/WhisperModelPage";
import { DeepseekKeyPage } from "@/windows/setting/DeepseekKeyPage";
import { AssemblyaiKeyPage } from "@/windows/setting/AssemblyaiKeyPage";
import { PromptTranslateManagerPage } from "@/windows/setting/PromptTranslateManagerPage";

type SettingTab = "whisper-model" | "deepseek-key" | "assemblyai-key" | "prompt-translate";

interface TabConfig {
    id: SettingTab;
    label: string;
    icon: React.ElementType;
    component: React.ElementType;
}

export const TABS: TabConfig[] = [
    {
        id: "whisper-model",
        label: "Model Whisper",
        icon: Cpu,
        component: WhisperModelPage,
    },
    {
        id: "deepseek-key",
        label: "DeepSeek Key",
        icon: Key,
        component: DeepseekKeyPage,
    },
    {
        id: "assemblyai-key",
        label: "AssemblyAI Key",
        icon: AudioLines,
        component: AssemblyaiKeyPage,
    },
    {
        id: "prompt-translate",
        label: "Prompt Dịch",
        icon: FileText,
        component: PromptTranslateManagerPage,
    },
];

interface SettingWindowLayoutProps {
    children?: ReactNode;
}

export const SettingWindowLayout = ({ children }: SettingWindowLayoutProps) => {
    const { tab } = useParams<{ tab: string }>();
    const navigate = useNavigate();
    const activeTab = (tab as SettingTab) || "whisper-model";

    return (
        <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
            <SidebarProvider defaultOpen={true} className="flex-1 overflow-hidden min-h-0">
                <Sidebar collapsible="none" className="border-r">
                    <SidebarHeader className="px-4 py-4 border-b">
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-primary" />
                            <span className="font-semibold text-sm">Cài đặt</span>
                        </div>
                    </SidebarHeader>

                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupLabel>Cấu hình</SidebarGroupLabel>
                            <SidebarMenu>
                                {TABS.map((t) => (
                                    <SidebarMenuItem key={t.id}>
                                        <SidebarMenuButton
                                            isActive={activeTab === t.id}
                                            onClick={() => navigate(`/settings/${t.id}`)}
                                            tooltip={t.label}
                                        >
                                            <t.icon className="w-4 h-4" />
                                            <span>{t.label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroup>
                    </SidebarContent>
                </Sidebar>

                <SidebarInset className="min-h-0 overflow-hidden">
                    <main className="flex-1 flex flex-col h-full min-h-0 overflow-auto p-6">
                        {children}
                    </main>
                </SidebarInset>
            </SidebarProvider>
        </div>
    );
};

export const SettingPage = () => {
    const { tab } = useParams<{ tab: string }>();
    const activeTab = (tab as SettingTab) || "whisper-model";
    const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component ?? WhisperModelPage;

    return <ActiveComponent />;
};
