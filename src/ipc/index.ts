import { setupProjectIpc } from "./project";
import { setupVideoIpc } from "./video";
import { setupEnvironmentIpc } from "./environment";
import { setupAudioIpc } from "./audio";
import { setupSystemIpc } from "./system";
import { setupHardwareIpc } from "./hardware";
import { setupCookieIpc } from "./cookie";

export const setupIpcHandlers = () => {
    setupProjectIpc();
    setupVideoIpc();
    setupEnvironmentIpc();
    setupAudioIpc();
    setupSystemIpc();
    setupHardwareIpc();
    setupCookieIpc();
};
