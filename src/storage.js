const STORAGE_KEY = "stl-viewer-settings";
const STORAGE_VERSION = 4;

export const DEFAULT_SETTINGS = {
    version: STORAGE_VERSION,

    language: null,

    color: "#bdc3c7",
    preset: "basic",
    roughness: 0.65,
    metalness: 0.0,
    clearcoat: 0.05,
    clearcoatRoughness: 0.8,
    sheen: 0.1,
    sheenRoughness: 0.7,
    transmission: 0.0,
    thickness: 0.0,
    ior: 1.45,

    layerActive: false,
    layerHeight: 0.2,
    layerStrength: 0.35,

    lighting: "studio",
    hdri: "lobe",
    bgMode: "color",
    bgColor: "#2a2a2a",
    bgBlur: 0.0,

    grid: true,
    autoRotate: false,
    shadows: true,

    bedActive: false,
    bedPreset: "none",
    bedX: 220,
    bedY: 220,
    bedZ: 250,
    bedCustomName: "My Printer",
    lastActiveBedPreset: "ender3",
    showBedLabel: true,

    showDimensions: false,
};

export function loadSettings() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return { ...DEFAULT_SETTINGS };
        }

        const parsed = JSON.parse(stored);

        if (!parsed.version || parsed.version < STORAGE_VERSION) {
            console.log("Settings version mismatch, migrating...");
            return migrateSettings(parsed);
        }

        return { ...DEFAULT_SETTINGS, ...parsed };
    } catch (e) {
        console.warn("Failed to load settings from localStorage:", e);
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveSettings(settings) {
    try {
        const toSave = {
            ...settings,
            version: STORAGE_VERSION,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.warn("Failed to save settings to localStorage:", e);
    }
}

export function saveSetting(key, value) {
    const settings = loadSettings();
    settings[key] = value;
    saveSettings(settings);
}

export function resetSettings() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.warn("Failed to reset settings:", e);
    }
}

function migrateSettings(oldSettings) {
    const newSettings = { ...DEFAULT_SETTINGS };

    const keysToMigrate = [
        "language",

        "color",
        "preset",
        "roughness",
        "metalness",
        "clearcoat",
        "clearcoatRoughness",
        "sheen",
        "sheenRoughness",
        "transmission",
        "thickness",
        "ior",

        "layerActive",
        "layerHeight",
        "layerStrength",

        "lighting",
        "hdri",
        "bgMode",
        "bgColor",
        "bgBlur",

        "grid",
        "autoRotate",
        "shadows",

        "bedActive",
        "bedPreset",
        "bedX",
        "bedY",
        "bedZ",
        "bedCustomName",
        "lastActiveBedPreset",
        "showBedLabel",

        "showDimensions",
    ];

    keysToMigrate.forEach((key) => {
        if (oldSettings[key] !== undefined) {
            newSettings[key] = oldSettings[key];
        }
    });

    saveSettings(newSettings);

    return newSettings;
}

export function exportSettings() {
    const settings = loadSettings();
    return JSON.stringify(settings, null, 2);
}

export function importSettings(jsonString) {
    try {
        const parsed = JSON.parse(jsonString);
        const merged = {
            ...DEFAULT_SETTINGS,
            ...parsed,
            version: STORAGE_VERSION,
        };
        saveSettings(merged);
        return true;
    } catch (e) {
        console.error("Failed to import settings:", e);
        return false;
    }
}
