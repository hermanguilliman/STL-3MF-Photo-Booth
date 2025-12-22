import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { sceneManager } from "./SceneManager.js";
import { state } from "../core/StateManager.js";
import { HDR_FILES } from "../core/constants.js";

class EnvironmentManager {
    #loader = new RGBELoader().setPath("img/hdri/");
    #currentTexture = null;

    loadHDRI(key) {
        const fileName = HDR_FILES[key];
        if (!fileName) return;

        this.#loader.load(fileName, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.#currentTexture = texture;
            sceneManager.scene.environment = texture;
            this.updateBackground();

            const loader = document.getElementById("loader");
            if (loader) {
                loader.style.opacity = "0";
                setTimeout(() => loader.remove(), 600);
            }
        });
    }

    updateBackground() {
        const { scene, gridHelper } = sceneManager;
        const bgMode = state.get("bgMode");

        if (bgMode === "hdri" && this.#currentTexture) {
            scene.background = this.#currentTexture;
            scene.backgroundBlurriness = state.get("bgBlur");
            gridHelper.material.opacity = 0.2;
            gridHelper.material.transparent = true;
        } else {
            const color = state.get("bgColor");
            scene.background = new THREE.Color(color);
            scene.backgroundBlurriness = 0;
            sceneManager.updateGridColor(color);
        }
    }

    get currentTexture() {
        return this.#currentTexture;
    }
}

export const environmentManager = new EnvironmentManager();
