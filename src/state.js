import { loadSettings, saveSetting, DEFAULT_SETTINGS } from "./storage.js";

const savedSettings = loadSettings();

export const state = {
    color: savedSettings.color,
    preset: savedSettings.preset,
    roughness: savedSettings.roughness,
    metalness: savedSettings.metalness,
    clearcoat: savedSettings.clearcoat,
    clearcoatRoughness: savedSettings.clearcoatRoughness,
    sheen: savedSettings.sheen,
    sheenRoughness: savedSettings.sheenRoughness,
    transmission: savedSettings.transmission,
    thickness: savedSettings.thickness,
    ior: savedSettings.ior,

    lighting: savedSettings.lighting,
    hdri: savedSettings.hdri,
    bgMode: savedSettings.bgMode,
    bgColor: savedSettings.bgColor,
    bgBlur: savedSettings.bgBlur,

    grid: savedSettings.grid,
    autoRotate: savedSettings.autoRotate,
    shadows: savedSettings.shadows,

    layerActive: savedSettings.layerActive,
    layerHeight: savedSettings.layerHeight,
    layerStrength: savedSettings.layerStrength,

    bedActive: savedSettings.bedActive,
    bedPreset: savedSettings.bedPreset,
    bedX: savedSettings.bedX,
    bedY: savedSettings.bedY,
    bedZ: savedSettings.bedZ,
    bedCustomName: savedSettings.bedCustomName,
    lastActiveBedPreset: savedSettings.lastActiveBedPreset || "ender3",
    showBedLabel:
        savedSettings.showBedLabel !== undefined
            ? savedSettings.showBedLabel
            : true,

    showDimensions: savedSettings.showDimensions,
};

export const layerUniforms = {
    uLayerActive: { value: state.layerActive },
    uLayerHeight: { value: state.layerHeight },
    uLayerStrength: { value: state.layerStrength },
};

export const rotationState = { x: 0, y: 0, z: 0 };
export let savedRotationState = { x: 0, y: 0, z: 0 };

export function setSavedRotationState(x, y, z) {
    savedRotationState.x = x;
    savedRotationState.y = y;
    savedRotationState.z = z;
}

export function updateState(key, value) {
    if (key in state) {
        state[key] = value;
        saveSetting(key, value);
    }
}

export function updateStateMultiple(updates) {
    for (const [key, value] of Object.entries(updates)) {
        if (key in state) {
            state[key] = value;
        }
    }

    const settings = { ...state };
    saveSetting("_batch", null);
    for (const [key, value] of Object.entries(updates)) {
        saveSetting(key, value);
    }
}

export function getSavedLanguage() {
    return savedSettings.language;
}

export function getDefaultSettings() {
    return DEFAULT_SETTINGS;
}
