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
        container: document.getElementById("dimLabels"),
        x: document.getElementById("dimX"),
        y: document.getElementById("dimY"),
        z: document.getElementById("dimZ"),
    };
    #lastCamera = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
    #needsUpdate = true;

    markForUpdate() {
        this.#needsUpdate = true;
    }

    toggle() {
        state.set("showDimensions", !state.get("showDimensions"));
        this.#apply();
    }

    init() {
        if (state.get("showDimensions")) {
            setTimeout(() => this.#apply(), 300);
        }
    }

    hide() {
        if (this.#helper) this.#helper.visible = false;
        if (this.#labels.container)
            this.#labels.container.style.display = "none";
    }

    show() {
        if (this.#helper && state.get("showDimensions"))
            this.#helper.visible = true;
        if (this.#labels.container && state.get("showDimensions"))
            this.#labels.container.style.display = "";
    }

    update() {
        if (!state.get("showDimensions")) return;
        if (!modelManager.mesh) return;

        if (this.#needsUpdate) {
            this.#recalculate();
            this.#ensureHelper();
        }

        const { camera } = sceneManager;
        const cameraChanged =
            !camera.position.equals(this.#lastCamera.pos) ||
            !camera.quaternion.equals(this.#lastCamera.quat);

        if (cameraChanged || this.#needsUpdate) {
            this.#updateLabelPositions();
            this.#lastCamera.pos.copy(camera.position);
            this.#lastCamera.quat.copy(camera.quaternion);
        }
    }

    forceUpdate() {
        if (!state.get("showDimensions")) return;
        this.#needsUpdate = true;
        this.#recalculate();
        this.#ensureHelper();
        this.#updateLabelPositions();
    }

    #apply() {
        const btn = document.getElementById("dimBtn");
        const show = state.get("showDimensions");

        btn?.classList.toggle("active", show);
        this.#labels.container?.classList.toggle("visible", show);

        if (show) {
            this.#disposeHelper();
            this.#needsUpdate = true;
            this.#recalculate();
            this.#ensureHelper();
        } else {
            this.#disposeHelper();
        }
    }

    #recalculate() {
        const mesh = modelManager.mesh;
        if (!mesh) return false;

        mesh.updateMatrixWorld(true);
        this.#box.setFromObject(mesh);
        if (this.#box.isEmpty()) return false;

        this.#box.getSize(this.#size);

        if (this.#labels.x)
            this.#labels.x.innerText = `X: ${this.#size.x.toFixed(1)} mm`;
        if (this.#labels.y)
            this.#labels.y.innerText = `Z: ${this.#size.z.toFixed(1)} mm`;
        if (this.#labels.z)
            this.#labels.z.innerText = `Y: ${this.#size.y.toFixed(1)} mm`;

        if (this.#helper) this.#helper.box.copy(this.#box);
        this.#needsUpdate = false;

        if (state.get("bedActive")) {
            globalEvents.emit("dimensions:updated");
        }

        return true;
    }

    #ensureHelper() {
        if (!this.#helper && !this.#box.isEmpty()) {
            this.#helper = new THREE.Box3Helper(this.#box, 0x00b894);
            this.#helper.renderOrder = 999;
            sceneManager.scene.add(this.#helper);
        }
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
        if (this.#box.isEmpty()) return;

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

        if (Math.abs(v.z) > 1) {
            el.style.display = "none";
        } else {
            el.style.display = "block";
            el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`;
            el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`;
        }
    }
}

export const dimensionsManager = new DimensionsManager();
