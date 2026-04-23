import { BrowserWindow, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

const isDev = !app.isPackaged;
const BIN_DIR = isDev
    ? path.join(process.cwd(), 'bin')
    : path.join(app.getPath('userData'), 'bin');

const COOKIES_DIR = path.join(BIN_DIR, 'cookies');
const COOKIE_FILE = path.join(COOKIES_DIR, 'youtube_cookies.txt');

const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

/**
 * Get the path to the cookie file (used by yt-dlp --cookies)
 */
export const getCookieFilePath = (): string => COOKIE_FILE;

/**
 * Check if a valid cookie file exists
 */
export const hasCookieFile = (): boolean => {
    if (!fs.existsSync(COOKIE_FILE)) return false;
    try {
        const content = fs.readFileSync(COOKIE_FILE, 'utf-8');
        // Must contain at least one youtube.com cookie line
        return content.includes('.youtube.com');
    } catch {
        return false;
    }
};

/**
 * Convert Electron cookies to Netscape cookie file format
 * This is the format yt-dlp expects with --cookies
 */
const toNetscapeCookieFile = (cookies: Electron.Cookie[]): string => {
    const lines: string[] = [
        '# Netscape HTTP Cookie File',
        '# https://curl.haxx.se/rfc/cookie_spec.html',
        '# This is a generated file! Do not edit.',
        '',
    ];

    for (const cookie of cookies) {
        const domain = cookie.domain || '';
        const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
        const cookiePath = cookie.path || '/';
        const secure = cookie.secure ? 'TRUE' : 'FALSE';
        const expires = cookie.expirationDate
            ? Math.floor(cookie.expirationDate)
            : 0;
        const name = cookie.name || '';
        const value = cookie.value || '';

        lines.push(
            `${domain}\t${includeSubdomains}\t${cookiePath}\t${secure}\t${expires}\t${name}\t${value}`
        );
    }

    return lines.join('\n') + '\n';
};

/**
 * Open a browser window for YouTube login, then export cookies to file.
 * Returns a promise that resolves to true if cookies were saved successfully.
 */
export const loginAndExportCookies = (): Promise<boolean> => {
    return new Promise((resolve) => {
        // Use a dedicated partition so we don't interfere with the app's own session
        const partitionName = 'persist:youtube-cookies';
        const ses = session.fromPartition(partitionName);

        const loginWindow = new BrowserWindow({
            width: 1000,
            height: 700,
            title: 'Đăng nhập YouTube',
            autoHideMenuBar: true,
            webPreferences: {
                session: ses,
                nodeIntegration: false,
                contextIsolation: true,
            },
        });

        loginWindow.loadURL('https://accounts.google.com/ServiceLogin?continue=https://www.youtube.com/');

        let resolved = false;

        // Poll for successful login by checking cookies periodically
        const checkInterval = setInterval(async () => {
            try {
                const cookies = await ses.cookies.get({ domain: '.youtube.com' });
                // YouTube sets specific cookies after login
                const hasLoginCookie = cookies.some(
                    (c) => c.name === 'SID' || c.name === 'SSID' || c.name === '__Secure-1PSID'
                );

                if (hasLoginCookie) {
                    clearInterval(checkInterval);
                    if (!resolved) {
                        resolved = true;

                        // Get ALL google/youtube cookies for yt-dlp
                        const allCookies = await ses.cookies.get({});
                        const relevantCookies = allCookies.filter(
                            (c) =>
                                (c.domain && c.domain.includes('youtube.com')) ||
                                (c.domain && c.domain.includes('google.com'))
                        );

                        ensureDir(COOKIES_DIR);
                        const content = toNetscapeCookieFile(relevantCookies);
                        fs.writeFileSync(COOKIE_FILE, content, 'utf-8');
                        console.log(`YouTube cookies saved: ${relevantCookies.length} cookies`);

                        loginWindow.close();
                        resolve(true);
                    }
                }
            } catch (err) {
                // Window might be closed, ignore
            }
        }, 2000);

        // User closed window without logging in
        loginWindow.on('closed', () => {
            clearInterval(checkInterval);
            if (!resolved) {
                resolved = true;
                resolve(false);
            }
        });
    });
};

/**
 * Delete saved cookies
 */
export const clearCookies = (): boolean => {
    try {
        if (fs.existsSync(COOKIE_FILE)) {
            fs.unlinkSync(COOKIE_FILE);
        }
        return true;
    } catch {
        return false;
    }
};
