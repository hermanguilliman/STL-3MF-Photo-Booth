import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

import { scene } from "./scene.js";
import { state } from "./state.js";
import { HDR_FILES } from "./constants.js";
import { gridHelper, updateGridColor } from "./scene.js";

let currentEnvTexture = null;
const hdrLoader = new RGBELoader();
hdrLoader.setPath("img/hdri/");

export function updateBackgroundState() {
    if (state.bgMode === "hdri" && currentEnvTexture) {
        scene.background = currentEnvTexture;
        scene.backgroundBlurriness = state.bgBlur;
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
    } else {
        scene.background = new THREE.Color(state.bgColor);
        scene.backgroundBlurriness = 0;
        updateGridColor(state.bgColor);
    }
}

export function loadHDRI(key) {
    const fileName = HDR_FILES[key];
    if (!fileName) return;

    hdrLoader.load(fileName, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        currentEnvTexture = texture;
        scene.environment = texture;
        updateBackgroundState();

        const loaderEl = document.getElementById("loader");
        if (loaderEl) {
            loaderEl.style.opacity = 0;
            setTimeout(() => loaderEl.remove(), 600);
        }
    });
}

export function getCurrentEnvTexture() {
    return currentEnvTexture;
}
