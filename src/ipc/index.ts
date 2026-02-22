import { setupProjectIpc } from "./project";
import { setupVideoIpc } from "./video";
import { setupEnvironmentIpc } from "./environment";
import { setupAudioIpc } from "./audio";
import { setupSystemIpc } from "./system";

export const setupIpcHandlers = () => {
    setupProjectIpc();
    setupVideoIpc();
    setupEnvironmentIpc();
    setupAudioIpc();
    setupSystemIpc();
};
