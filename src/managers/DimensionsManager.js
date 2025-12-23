import * as THREE from "three";
import { sceneManager } from "./SceneManager.js";
import { modelManager } from "./ModelManager.js";
import { state } from "../core/StateManager.js";
import { globalEvents } from "../core/EventEmitter.js";

class DimensionsManager {
    #helper = null;
    #box = new THREE.Box3();
    #size = new THREE.Vector3();
    #labels = {
        container: null,
        x: null,
        y: null,
        z: null,
    };
    #lastCamera = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
    #needsUpdate = true;

    constructor() {
        globalEvents.on("mesh:change", () => {
            this.#needsUpdate = true;
            if (state.get("showDimensions")) {
                setTimeout(() => this.forceUpdate(), 50);
            }
        });

        globalEvents.on("model:transformed", () => {
            this.#needsUpdate = true;
        });
    }

    #ensureLabelsRef() {
        if (!this.#labels.container) {
            this.#labels.container = document.getElementById("dimLabels");
            this.#labels.x = document.getElementById("dimX");
            this.#labels.y = document.getElementById("dimY");
            this.#labels.z = document.getElementById("dimZ");
        }
    }

    markForUpdate() {
        this.#needsUpdate = true;
    }

    toggle() {
        state.set("showDimensions", !state.get("showDimensions"));
        this.#apply();
    }

    init() {
        this.#ensureLabelsRef();

        if (state.get("showDimensions")) {
            setTimeout(() => this.#apply(), 100);
        }
    }

    hide() {
        this.#ensureLabelsRef();

        if (this.#helper) {
            this.#helper.visible = false;
        }

        this.#labels.container?.classList.remove("visible");
    }

    show() {
        this.#ensureLabelsRef();

        if (!state.get("showDimensions")) return;

        if (this.#helper) {
            this.#helper.visible = true;
        }

        this.#labels.container?.classList.add("visible");

        this.#updateLabelPositions();
    }

    update() {
        if (!state.get("showDimensions")) return;
        if (!modelManager.mesh) return;

        this.#ensureLabelsRef();

        if (this.#needsUpdate) {
            const success = this.#recalculate();
            if (success) {
                this.#ensureHelper();
            }
        }

        const { camera } = sceneManager;
        const cameraChanged =
            !camera.position.equals(this.#lastCamera.pos) ||
            !camera.quaternion.equals(this.#lastCamera.quat);

        if (cameraChanged || this.#needsUpdate) {
            this.#updateLabelPositions();
            this.#lastCamera.pos.copy(camera.position);
            this.#lastCamera.quat.copy(camera.quaternion);
            this.#needsUpdate = false;
        }
    }

    forceUpdate() {
        if (!state.get("showDimensions")) return;

        this.#ensureLabelsRef();
        this.#needsUpdate = true;

        const success = this.#recalculate();

        if (success) {
            this.#ensureHelper();
            if (this.#helper) {
                this.#helper.visible = true;
            }
            this.#labels.container?.classList.add("visible");
        }

        this.#updateLabelPositions();
    }

    #apply() {
        this.#ensureLabelsRef();

        const btn = document.getElementById("dimBtn");
        const show = state.get("showDimensions");

        btn?.classList.toggle("active", show);

        if (show) {
            this.#disposeHelper();
            this.#needsUpdate = true;

            if (!modelManager.mesh) {
                this.#labels.container?.classList.add("visible");
                return;
            }

            const success = this.#recalculate();

            if (success) {
                this.#ensureHelper();
                if (this.#helper) {
                    this.#helper.visible = true;
                }
            }

            this.#labels.container?.classList.add("visible");
            this.#updateLabelPositions();
        } else {
            this.#labels.container?.classList.remove("visible");
            this.#disposeHelper();
        }
    }

    #recalculate() {
        const mesh = modelManager.mesh;
        if (!mesh) {
            return false;
        }

        mesh.updateMatrixWorld(true);
        this.#box.setFromObject(mesh);

        if (this.#box.isEmpty()) {
            return false;
        }

        this.#box.getSize(this.#size);

        if (this.#labels.x) {
            this.#labels.x.innerText = `X: ${this.#size.x.toFixed(1)} mm`;
        }
        if (this.#labels.y) {
            this.#labels.y.innerText = `Z: ${this.#size.z.toFixed(1)} mm`;
        }
        if (this.#labels.z) {
            this.#labels.z.innerText = `Y: ${this.#size.y.toFixed(1)} mm`;
        }

        if (this.#helper) {
            this.#helper.box.copy(this.#box);
        }

        if (state.get("bedActive")) {
            globalEvents.emit("dimensions:updated");
        }

        return true;
    }

    #ensureHelper() {
        if (this.#box.isEmpty()) return;

        if (!this.#helper) {
            this.#helper = new THREE.Box3Helper(this.#box, 0x00b894);
            this.#helper.renderOrder = 999;
            sceneManager.scene.add(this.#helper);
        } else {
            this.#helper.box.copy(this.#box);
        }

        this.#helper.visible = state.get("showDimensions");
    }

    #disposeHelper() {
        if (this.#helper) {
            this.#helper.visible = false;
            sceneManager.scene.remove(this.#helper);
            this.#helper.geometry?.dispose();
            this.#helper.material?.dispose();
            this.#helper = null;
        }
    }

    #updateLabelPositions() {
        this.#ensureLabelsRef();

        if (this.#box.isEmpty()) {
            ["x", "y", "z"].forEach((axis) => {
                if (this.#labels[axis]) {
                    this.#labels[axis].style.left = "-9999px";
                }
            });
            return;
        }

        const { min, max } = this.#box;
        const positions = {
            x: new THREE.Vector3((min.x + max.x) / 2, min.y - 3, max.z + 5),
            y: new THREE.Vector3(max.x + 5, min.y - 3, (min.z + max.z) / 2),
            z: new THREE.Vector3(max.x + 5, (min.y + max.y) / 2, min.z),
        };

        ["x", "y", "z"].forEach((axis) =>
            this.#projectLabel(this.#labels[axis], positions[axis])
        );
    }

    #projectLabel(el, pos) {
        if (!el) return;

        const v = pos.clone().project(sceneManager.camera);

        if (v.z > 1 || v.z < -1) {
            el.style.left = "-9999px";
        } else {
            const x = (v.x * 0.5 + 0.5) * window.innerWidth;
            const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
        }
    }
}

export const dimensionsManager = new DimensionsManager();
