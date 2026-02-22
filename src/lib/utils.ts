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

export const WHISPER_LANGUAGES = [
  { code: "auto", name: "Tự động nhận diện" },
  { code: "en", name: "English" },
  { code: "zh", name: "Chinese" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "ru", name: "Russian" },
  { code: "ko", name: "Korean" },
  { code: "fr", name: "French" },
  { code: "ja", name: "Japanese" },
  { code: "pt", name: "Portuguese" },
  { code: "tr", name: "Turkish" },
  { code: "pl", name: "Polish" },
  { code: "ca", name: "Catalan" },
  { code: "nl", name: "Dutch" },
  { code: "ar", name: "Arabic" },
  { code: "sv", name: "Swedish" },
  { code: "it", name: "Italian" },
  { code: "id", name: "Indonesian" },
  { code: "hi", name: "Hindi" },
  { code: "fi", name: "Finnish" },
  { code: "vi", name: "Vietnamese" },
  { code: "he", name: "Hebrew" },
  { code: "uk", name: "Ukrainian" },
  { code: "el", name: "Greek" },
  { code: "ms", name: "Malay" },
  { code: "cs", name: "Czech" },
  { code: "ro", name: "Romanian" },
  { code: "da", name: "Danish" },
  { code: "hu", name: "Hungarian" },
  { code: "ta", name: "Tamil" },
  { code: "no", name: "Norwegian" },
  { code: "th", name: "Thai" },
  { code: "ur", name: "Urdu" },
  { code: "hr", name: "Croatian" },
  { code: "bg", name: "Bulgarian" },
  { code: "lt", name: "Lithuanian" },
  { code: "la", name: "Latin" },
  { code: "mi", name: "Maori" },
  { code: "ml", name: "Malayalam" },
  { code: "cy", name: "Welsh" },
  { code: "sk", name: "Slovak" },
  { code: "te", name: "Telugu" },
  { code: "fa", name: "Persian" },
  { code: "lv", name: "Latvian" },
  { code: "bn", name: "Bengali" },
  { code: "sr", name: "Serbian" },
  { code: "az", name: "Azerbaijani" },
  { code: "sl", name: "Slovenian" },
  { code: "kn", name: "Kannada" },
  { code: "et", name: "Estonian" },
  { code: "mk", name: "Macedonian" },
  { code: "br", name: "Breton" },
  { code: "eu", name: "Basque" },
  { code: "is", name: "Icelandic" },
  { code: "hy", name: "Armenian" },
  { code: "ne", name: "Nepali" },
  { code: "mn", name: "Mongolian" },
  { code: "bs", name: "Bosnian" },
  { code: "kk", name: "Kazakh" },
  { code: "sq", name: "Albanian" },
  { code: "sw", name: "Swahili" },
  { code: "gl", name: "Galician" },
  { code: "mr", name: "Marathi" },
  { code: "pa", name: "Punjabi" },
  { code: "si", name: "Sinhala" },
  { code: "km", name: "Khmer" },
  { code: "sn", name: "Shona" },
  { code: "yo", name: "Yoruba" },
  { code: "so", name: "Somali" },
  { code: "af", name: "Afrikaans" },
  { code: "oc", name: "Occitan" },
  { code: "ka", name: "Georgian" },
  { code: "be", name: "Belarusian" },
  { code: "tg", name: "Tajik" },
  { code: "sd", name: "Sindhi" },
  { code: "gu", name: "Gujarati" },
  { code: "am", name: "Amharic" },
  { code: "yi", name: "Yiddish" },
  { code: "lo", name: "Lao" },
  { code: "uz", name: "Uzbek" },
  { code: "fo", name: "Faroese" },
  { code: "ht", name: "Haitian Creole" },
  { code: "ps", name: "Pashto" },
  { code: "tk", name: "Turkmen" },
  { code: "nn", name: "Nynorsk" },
  { code: "mt", name: "Maltese" },
  { code: "sa", name: "Sanskrit" },
  { code: "lb", name: "Luxembourgish" },
  { code: "my", name: "Myanmar" },
  { code: "bo", name: "Tibetan" },
  { code: "tl", name: "Tagalog" },
  { code: "mg", name: "Malagasy" },
  { code: "as", name: "Assamese" },
  { code: "tt", name: "Tatar" },
  { code: "haw", name: "Hawaiian" },
  { code: "ln", name: "Lingala" },
  { code: "ha", name: "Hausa" },
  { code: "ba", name: "Bashkir" },
  { code: "jw", name: "Javanese" },
  { code: "su", name: "Sundanese" },
  { code: "yue", name: "Cantonese" },
];

export const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  en: "US", zh: "CN", ja: "JP", ko: "KR", vi: "VN", de: "DE", es: "ES",
  ru: "RU", fr: "FR", pt: "PT", tr: "TR", pl: "PL", ca: "ES", nl: "NL",
  ar: "SA", sv: "SE", it: "IT", id: "ID", hi: "IN", fi: "FI", he: "IL",
  uk: "UA", el: "GR", ms: "MY", cs: "CZ", ro: "RO", da: "DK", hu: "HU",
  ta: "IN", no: "NO", th: "TH", ur: "PK", hr: "HR", bg: "BG", lt: "LT",
  la: "VA", mi: "NZ", ml: "IN", cy: "GB", sk: "SK", te: "IN", fa: "IR",
  lv: "LV", bn: "BD", sr: "RS", az: "AZ", sl: "SI", kn: "IN", et: "EE",
  mk: "MK", br: "FR", eu: "ES", is: "IS", hy: "AM", ne: "NP", mn: "MN",
  bs: "BA", kk: "KZ", sq: "AL", sw: "KE", gl: "ES", mr: "IN", pa: "IN",
  si: "LK", km: "KH", sn: "ZW", yo: "NG", so: "SO", af: "ZA", oc: "FR",
  ka: "GE", be: "BY", tg: "TJ", sd: "PK", gu: "IN", am: "ET", yi: "IL",
  lo: "LA", uz: "UZ", fo: "FO", ht: "HT", ps: "AF", tk: "TM", nn: "NO",
  mt: "MT", sa: "IN", lb: "LU", my: "MM", bo: "CN", tl: "PH", mg: "MG",
  as: "IN", tt: "RU", haw: "US", ln: "CD", ha: "NG", ba: "RU", jw: "ID",
  su: "ID", yue: "HK"
};

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

