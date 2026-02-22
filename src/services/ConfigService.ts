import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const CONFIG_PATH = isDev
    ? path.join(process.cwd(), 'src/config/config.json')
    : path.join(app.getPath('userData'), 'config.json');

const readConfig = (): Record<string, any> => {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error reading config:", error);
    }
    return {};
};

const writeConfig = (updates: Record<string, any>): boolean => {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const existing = readConfig();
        const config = { ...existing, ...updates };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4), 'utf-8');
        return true;
    } catch (error) {
        console.error("Error writing config:", error);
        return false;
    }
};

export const getPinnedPath = (): string => {
    return readConfig().pinnedPath || "";
};

export const setPinnedPath = (pinnedPath: string): boolean => {
    return writeConfig({ pinnedPath });
};

export const getApiKey = (provider: string): string => {
    const config = readConfig();
    return config.apiKeys?.[provider] || "";
};

export const setApiKey = (provider: string, key: string): boolean => {
    const config = readConfig();
    const apiKeys = { ...(config.apiKeys || {}), [provider]: key };
    return writeConfig({ apiKeys });
};

export const createProjectFolder = (basePath: string, projectName: string): boolean => {
    try {
        const targetDir = path.join(basePath, projectName);

        if (fs.existsSync(targetDir)) {
            return false;
        }

        fs.mkdirSync(targetDir, { recursive: true });

        const metadata = {
            id: Date.now().toString(), // Simple ID, or passed from DB?
            name: projectName,
            createdAt: new Date().toISOString(),
            status: 'created'
        };

        const configFile = path.join(targetDir, 'project.json');
        fs.writeFileSync(configFile, JSON.stringify(metadata, null, 4), 'utf-8');

        return true;
    } catch (error) {
        console.error("Error creating project folder:", error);
        return false;
    }
};

export const deleteProjectFolder = (projectPath: string): boolean => {
    try {
        if (fs.existsSync(projectPath)) {
            fs.rmSync(projectPath, { recursive: true, force: true });
        }
        return true;
    } catch (error) {
        console.error("Error deleting project folder:", error);
        return false;
    }
};

export const getProjectMetadata = (projectPath: string): any => {
    try {
        const configFile = path.join(projectPath, 'project.json');
        if (fs.existsSync(configFile)) {
            const data = fs.readFileSync(configFile, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error("Error reading project metadata:", error);
    }
    return null;
};

export const saveProjectMetadata = (projectPath: string, metadata: any): boolean => {
    try {
        const configFile = path.join(projectPath, 'project.json');

        let existing = {};
        if (fs.existsSync(configFile)) {
            try {
                existing = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            } catch (e) { }
        }

        const updated = { ...existing, ...metadata, updatedAt: new Date().toISOString() };
        fs.writeFileSync(configFile, JSON.stringify(updated, null, 4), 'utf-8');
        return true;
    } catch (error) {
        console.error("Error writing project metadata:", error);
        return false;
    }
};

export interface TranslatePrompt {
    id: string;
    name: string;
    systemPrompt: string;
    isDefault?: boolean;
}

const DEFAULT_PROMPT: TranslatePrompt = {
    id: "minecraft-default",
    name: "Minecraft Video",
    systemPrompt: `You are a professional Minecraft subtitle translator.

STYLE RULES:
- Use official Minecraft terminology for the target language
- Keep translations natural, conversational, and suitable for voice-over dubbing
- Keep proper nouns (player names, server names) unchanged
- Translations should be concise and match subtitle timing

MINECRAFT GLOSSARY:
Use the correct official translations for these Minecraft terms:

Mobs: Creeper, Zombie, Skeleton, Spider, Enderman, Blaze, Ghast, Wither, Ender Dragon, Piglin, Hoglin, Zoglin, Warden, Allay, Villager, Iron Golem, Snow Golem, Phantom, Drowned, Husk, Stray, Witch, Pillager, Ravager, Vex, Evoker, Vindicator, Shulker, Guardian, Elder Guardian, Silverfish, Endermite, Slime, Magma Cube, Bee, Wolf, Cat, Fox, Axolotl, Frog, Sniffer, Camel, Breeze, Bogged, Wither Skeleton

Items/Blocks: Diamond, Netherite, Obsidian, Bedrock, Redstone, Glowstone, End Stone, Nether Brick, Deepslate, Copper, Amethyst, Sculk, Anvil, Enchanting Table, Brewing Stand, Beacon, Conduit, Lodestone, Respawn Anchor, Shulker Box, Ender Chest, Barrel, Blast Furnace, Smoker, Composter, Lectern, Cartography Table, Smithing Table, Stonecutter, Grindstone, Loom, Campfire, Soul Campfire, Lantern, Soul Lantern, Chain, Candle, Tinted Glass, Spyglass, Bundle, Brush, Elytra, Trident, Totem of Undying, Shield, Crossbow, Firework Rocket

Biomes/Dimensions: Overworld, Nether, The End, Deep Dark, Ancient City, Stronghold, Nether Fortress, Bastion Remnant, End City, Ocean Monument, Woodland Mansion, Trial Chamber, Plains, Forest, Desert, Taiga, Jungle, Swamp, Badlands, Mushroom Island, Cherry Grove, Mangrove Swamp, Lush Cave, Dripstone Cave, Frozen Ocean, Warm Ocean, Meadow, Snowy Slopes, Stony Peaks

Gameplay: Survival, Creative, Hardcore, Adventure, Spectator, Enchantment, Potion, Splash Potion, Lingering Potion, Experience (XP), Level, Hunger, Health, Hearts, Armor, Durability, Crafting, Smelting, Brewing, Farming, Mining, Speedrun, Speedrunning, PvP, PvE, Mob farm, XP farm, Iron farm, Gold farm, Raid farm, Chunk, Spawn, Respawn, Portal, Nether Portal, End Portal, Ender Eye, Blaze Rod, Ender Pearl, Nether Star, Dragon Egg, Wither Rose, Trading, Villager Trading, Emerald, Loot, Chest loot, Structure, Generated structure

Redstone/Technical: Redstone, Piston, Sticky Piston, Observer, Comparator, Repeater, Hopper, Dropper, Dispenser, TNT, Minecart, Rail, Powered Rail, Detector Rail, Activator Rail, Daylight Detector, Target Block, Sculk Sensor, Calibrated Sculk Sensor, Tripwire Hook, Pressure Plate, Button, Lever, Trapdoor, Fence Gate, Note Block, Jukebox, Bell

Enchantments: Sharpness, Smite, Bane of Arthropods, Knockback, Fire Aspect, Looting, Sweeping Edge, Unbreaking, Mending, Efficiency, Fortune, Silk Touch, Protection, Blast Protection, Fire Protection, Projectile Protection, Feather Falling, Respiration, Aqua Affinity, Depth Strider, Frost Walker, Soul Speed, Swift Sneak, Thorns, Power, Punch, Flame, Infinity, Loyalty, Riptide, Channeling, Impaling, Multishot, Piercing, Quick Charge, Luck of the Sea, Lure, Curse of Vanishing, Curse of Binding, Wind Burst, Breach, Density

Status Effects: Speed, Slowness, Haste, Mining Fatigue, Strength, Instant Health, Instant Damage, Jump Boost, Nausea, Regeneration, Resistance, Fire Resistance, Water Breathing, Invisibility, Blindness, Night Vision, Hunger, Weakness, Poison, Wither, Health Boost, Absorption, Saturation, Glowing, Levitation, Luck, Bad Luck, Slow Falling, Conduit Power, Hero of the Village, Darkness, Wind Charged, Weaving, Oozing, Infested, Raid Omen, Trial Omen`,
    isDefault: true,
};

export const getPrompts = (): TranslatePrompt[] => {
    const config = readConfig();
    if (!config.translatePrompts || config.translatePrompts.length === 0) {
        writeConfig({ translatePrompts: [DEFAULT_PROMPT] });
        return [DEFAULT_PROMPT];
    }
    return config.translatePrompts;
};

export const savePrompts = (prompts: TranslatePrompt[]): boolean => {
    return writeConfig({ translatePrompts: prompts });
};

export const getActivePromptId = (): string => {
    const config = readConfig();
    return config.activePromptId || "minecraft-default";
};

export const setActivePromptId = (id: string): boolean => {
    return writeConfig({ activePromptId: id });
};

