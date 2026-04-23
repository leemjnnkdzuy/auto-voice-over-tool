import { ipcMain } from 'electron';
import { loginAndExportCookies, hasCookieFile, clearCookies } from '../services/CookieService';

export const setupCookieIpc = () => {
    ipcMain.handle('youtube-login', async () => {
        const success = await loginAndExportCookies();
        return success;
    });

    ipcMain.handle('has-youtube-cookies', () => {
        return hasCookieFile();
    });

    ipcMain.handle('clear-youtube-cookies', () => {
        return clearCookies();
    });
};
