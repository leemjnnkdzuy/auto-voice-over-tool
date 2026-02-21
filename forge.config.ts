import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import path from 'path';
import fs from 'fs';

// Native modules that need to be copied into the packaged app
const nativeModules = ['better-sqlite3', 'bindings', 'file-uri-to-path'];

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: '**/{better-sqlite3,bindings,file-uri-to-path}/**',
    },
    afterCopy: [
      (buildPath: string, _electronVersion: string, _platform: string, _arch: string, callback: (err?: Error) => void) => {
        try {
          const nodeModulesSrc = path.resolve(__dirname, 'node_modules');
          const nodeModulesDst = path.join(buildPath, 'node_modules');

          for (const mod of nativeModules) {
            const src = path.join(nodeModulesSrc, mod);
            const dst = path.join(nodeModulesDst, mod);

            if (fs.existsSync(src)) {
              fs.cpSync(src, dst, { recursive: true });
              console.log(`[afterCopy] Copied ${mod}`);
            } else {
              console.warn(`[afterCopy] Module not found: ${mod}`);
            }
          }

          callback();
        } catch (err) {
          callback(err as Error);
        }
      },
    ],
  },
  rebuildConfig: {
    onlyModules: ['better-sqlite3'],
  },
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
