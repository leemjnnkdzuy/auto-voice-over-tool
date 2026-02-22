import { ReactNode } from "react";
import { Header } from "@/components/common/Header";
import { ProcessProvider } from "@/stores/ProcessStore";
import { AutoPipelineProvider } from "@/stores/AutoPipelineStore";

interface HeaderLayoutProps {
    children: ReactNode;
}

export const HeaderLayout = ({ children }: HeaderLayoutProps) => {
    return (
        <ProcessProvider>
            <AutoPipelineProvider>
                <div className="flex flex-col h-screen bg-background text-foreground">
                    <Header />
                    <main className="flex-1 overflow-auto flex flex-col">
                        {children}
                    </main>
                </div>
            </AutoPipelineProvider>
        </ProcessProvider>
    );
};
