import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface SrtEntry {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

export const parseSrt = (content: string): SrtEntry[] => {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const entries: SrtEntry[] = [];

  const blocks = normalized.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length >= 2) {
      const indexLine = lines[0].trim();
      const timeLine = lines[1].trim();

      const index = parseInt(indexLine, 10);
      if (isNaN(index)) continue;

      const timeMatch = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);

      if (timeMatch) {
        const text = lines.slice(2).join('\n').trim();
        entries.push({
          index,
          startTime: timeMatch[1],
          endTime: timeMatch[2],
          text,
        });
      }
    }
  }

  return entries;
};

export const formatTimeShort = (time: string): string => {
  if (!time) return "00:00";

  const parts = time.split(',')[0].split(':');
  if (parts.length === 3) {
    if (parts[0] === '00') {
      return `${parts[1]}:${parts[2]}`;
    }
    return `${parts[0]}:${parts[1]}:${parts[2]}`;
  }
  return time;
};

export const timeToSeconds = (time: string): number => {
  if (!time) return 0;

  const [hms, ms] = time.replace(',', '.').split('.');
  const parts = hms.split(':').map(Number);

  let seconds = 0;
  if (parts.length === 3) {
    seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    seconds = parts[0] * 60 + parts[1];
  }

  const milliseconds = ms ? parseFloat(`0.${ms}`) : 0;

  return seconds + milliseconds;
};

export const stringifySrt = (entries: SrtEntry[]): string => {
  return entries.map(entry => {
    return `${entry.index}\n${entry.startTime} --> ${entry.endTime}\n${entry.text}\n`;
  }).join('\n');
};

export const MINECRAFT_GLOSSARY = (langName: string) => `MINECRAFT GLOSSARY (English → ${langName}):
Use the correct official translations for these Minecraft terms:

Mobs: Creeper, Zombie, Skeleton, Spider, Enderman, Blaze, Ghast, Wither, Ender Dragon, Piglin, Hoglin, Zoglin, Warden, Allay, Villager, Iron Golem, Snow Golem, Phantom, Drowned, Husk, Stray, Witch, Pillager, Ravager, Vex, Evoker, Vindicator, Shulker, Guardian, Elder Guardian, Silverfish, Endermite, Slime, Magma Cube, Bee, Wolf, Cat, Fox, Axolotl, Frog, Sniffer, Camel, Breeze, Bogged, Wither Skeleton

Items/Blocks: Diamond, Netherite, Obsidian, Bedrock, Redstone, Glowstone, End Stone, Nether Brick, Deepslate, Copper, Amethyst, Sculk, Anvil, Enchanting Table, Brewing Stand, Beacon, Conduit, Lodestone, Respawn Anchor, Shulker Box, Ender Chest, Barrel, Blast Furnace, Smoker, Composter, Lectern, Cartography Table, Smithing Table, Stonecutter, Grindstone, Loom, Campfire, Soul Campfire, Lantern, Soul Lantern, Chain, Candle, Tinted Glass, Spyglass, Bundle, Brush, Elytra, Trident, Totem of Undying, Shield, Crossbow, Firework Rocket

Biomes/Dimensions: Overworld, Nether, The End, Deep Dark, Ancient City, Stronghold, Nether Fortress, Bastion Remnant, End City, Ocean Monument, Woodland Mansion, Trial Chamber, Plains, Forest, Desert, Taiga, Jungle, Swamp, Badlands, Mushroom Island, Cherry Grove, Mangrove Swamp, Lush Cave, Dripstone Cave, Frozen Ocean, Warm Ocean, Meadow, Snowy Slopes, Stony Peaks

Gameplay: Survival, Creative, Hardcore, Adventure, Spectator, Enchantment, Potion, Splash Potion, Lingering Potion, Experience (XP), Level, Hunger, Health, Hearts, Armor, Durability, Crafting, Smelting, Brewing, Farming, Mining, Speedrun, Speedrunning, PvP, PvE, Mob farm, XP farm, Iron farm, Gold farm, Raid farm, Chunk, Spawn, Respawn, Portal, Nether Portal, End Portal, Ender Eye, Blaze Rod, Ender Pearl, Nether Star, Dragon Egg, Wither Rose, Trading, Villager Trading, Emerald, Loot, Chest loot, Structure, Generated structure

Redstone/Technical: Redstone, Piston, Sticky Piston, Observer, Comparator, Repeater, Hopper, Dropper, Dispenser, TNT, Minecart, Rail, Powered Rail, Detector Rail, Activator Rail, Daylight Detector, Target Block, Sculk Sensor, Calibrated Sculk Sensor, Tripwire Hook, Pressure Plate, Button, Lever, Trapdoor, Fence Gate, Note Block, Jukebox, Bell

Enchantments: Sharpness, Smite, Bane of Arthropods, Knockback, Fire Aspect, Looting, Sweeping Edge, Unbreaking, Mending, Efficiency, Fortune, Silk Touch, Protection, Blast Protection, Fire Protection, Projectile Protection, Feather Falling, Respiration, Aqua Affinity, Depth Strider, Frost Walker, Soul Speed, Swift Sneak, Thorns, Power, Punch, Flame, Infinity, Loyalty, Riptide, Channeling, Impaling, Multishot, Piercing, Quick Charge, Luck of the Sea, Lure, Curse of Vanishing, Curse of Binding, Wind Burst, Breach, Density

Status Effects: Speed, Slowness, Haste, Mining Fatigue, Strength, Instant Health, Instant Damage, Jump Boost, Nausea, Regeneration, Resistance, Fire Resistance, Water Breathing, Invisibility, Blindness, Night Vision, Hunger, Weakness, Poison, Wither, Health Boost, Absorption, Saturation, Glowing, Levitation, Luck, Bad Luck, Slow Falling, Conduit Power, Hero of the Village, Darkness, Wind Charged, Weaving, Oozing, Infested, Raid Omen, Trial Omen`;

export const TARGET_LANGUAGES = [
  { code: "vi", name: "Tiếng Việt", flag: "VN" },
  { code: "zh", name: "Tiếng Trung", flag: "CN" },
  { code: "ja", name: "Tiếng Nhật", flag: "JP" },
  { code: "ko", name: "Tiếng Hàn", flag: "KR" },
  { code: "fr", name: "Tiếng Pháp", flag: "FR" },
  { code: "de", name: "Tiếng Đức", flag: "DE" },
  { code: "es", name: "Tiếng Tây Ban Nha", flag: "ES" },
  { code: "pt", name: "Tiếng Bồ Đào Nha", flag: "BR" },
  { code: "ru", name: "Tiếng Nga", flag: "RU" },
  { code: "th", name: "Tiếng Thái", flag: "TH" },
  { code: "en", name: "English", flag: "US" },
];

