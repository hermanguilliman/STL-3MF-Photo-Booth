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

class StorageManager {
    #cache = null;

    load() {
        if (this.#cache) return this.#cache;

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return (this.#cache = { ...DEFAULT_SETTINGS });

            const parsed = JSON.parse(stored);
            if (!parsed.version || parsed.version < STORAGE_VERSION) {
                return (this.#cache = this.#migrate(parsed));
            }
            return (this.#cache = { ...DEFAULT_SETTINGS, ...parsed });
        } catch {
            return (this.#cache = { ...DEFAULT_SETTINGS });
        }
    }

    save(key, value) {
        const settings = this.load();
        settings[key] = value;
        this.#persist(settings);
    }

    saveMultiple(updates) {
        const settings = { ...this.load(), ...updates };
        this.#persist(settings);
    }

    reset() {
        localStorage.removeItem(STORAGE_KEY);
        this.#cache = null;
    }

    export() {
        return JSON.stringify(this.load(), null, 2);
    }

    import(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            this.#persist({
                ...DEFAULT_SETTINGS,
                ...parsed,
                version: STORAGE_VERSION,
            });
            return true;
        } catch {
            return false;
        }
    }

    #persist(settings) {
        try {
            this.#cache = { ...settings, version: STORAGE_VERSION };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#cache));
        } catch (e) {
            console.warn("Failed to save settings:", e);
        }
    }

    #migrate(old) {
        const migrated = { ...DEFAULT_SETTINGS };
        Object.keys(DEFAULT_SETTINGS).forEach((key) => {
            if (old[key] !== undefined) migrated[key] = old[key];
        });
        this.#persist(migrated);
        return migrated;
    }
}

export const storage = new StorageManager();
