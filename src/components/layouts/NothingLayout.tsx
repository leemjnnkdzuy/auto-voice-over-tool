import type { ReactNode } from "react";

interface NothingLayoutProps {
    children?: ReactNode;
}

export const NothingLayout = ({ children }: NothingLayoutProps) => {
    return (
        <div className="w-full h-full min-h-screen bg-background text-foreground flex flex-col">
            {children}
        </div>
    );
};
