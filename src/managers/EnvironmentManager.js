import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { sceneManager } from "./SceneManager.js";
import { state } from "../core/StateManager.js";
import { HDR_FILES } from "../core/constants.js";

class EnvironmentManager {
    #loader = new HDRLoader().setPath("img/hdri/");
    #currentTexture = null;
    #loading = false;

    loadHDRI(key) {
        const fileName = HDR_FILES[key];
        if (!fileName || this.#loading) return;

        this.#loading = true;

        this.#loader.load(
            fileName,
            (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;

                if (this.#currentTexture) {
                    this.#currentTexture.dispose();
                }

                this.#currentTexture = texture;
                sceneManager.scene.environment = texture;
                this.updateBackground();

                const loader = document.getElementById("loader");
                if (loader) {
                    loader.style.opacity = "0";
                    setTimeout(() => loader.remove(), 600);
                }

                this.#loading = false;
            },
            undefined,
            (error) => {
                console.warn("Failed to load HDRI:", error);
                this.#loading = false;
            }
        );
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
