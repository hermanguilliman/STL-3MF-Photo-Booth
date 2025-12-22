import * as THREE from "three";
import { sceneManager } from "./SceneManager.js";
import { modelManager } from "./ModelManager.js";
import { state } from "../core/StateManager.js";
import { globalEvents } from "../core/EventEmitter.js";
import { PRINTERS } from "../core/constants.js";

class BedManager {
    #group = new THREE.Group();
    #labelMesh = null;
    #labelTexture = null;
    #lastFitState = true;

    constructor() {
        this.#group.visible = false;
        this.#group.renderOrder = 10;
        sceneManager.scene.add(this.#group);
    }

    get group() {
        return this.#group;
    }

    get fits() {
        return this.#lastFitState;
    }

    update() {
        this.#clear();

        if (!state.get("bedActive") || state.get("bedPreset") === "none") {
            this.#group.visible = false;
            return;
        }

        const [x, y, z] = ["bedX", "bedY", "bedZ"].map((k) => state.get(k));
        if (x <= 0 || y <= 0 || z <= 0) {
            this.#group.visible = false;
            return;
        }

        const color = 0x00ff99;
        this.#createGrid(x, y, color);
        this.#createVolumeFrame(x, y, z, color);
        this.#createBase(x, y, color);

        this.#group.visible = true;

        if (state.get("showBedLabel")) {
            this.#updateLabel();
        }
    }

    #clear() {
        while (this.#group.children.length) {
            const child = this.#group.children[0];
            this.#group.remove(child);
            child.geometry?.dispose();
            const mats = Array.isArray(child.material)
                ? child.material
                : [child.material];
            mats.forEach((m) => m?.dispose());
        }
        this.#labelMesh = null;
        this.#labelTexture?.dispose();
        this.#labelTexture = null;
    }

    #createGrid(x, y, color) {
        const maxDim = Math.max(x, y);
        const divisions = Math.max(Math.floor(maxDim / 10), 10);

        const grid = new THREE.GridHelper(maxDim, divisions, color, color);
        grid.material.opacity = 0.6;
        grid.material.transparent = true;
        grid.material.depthWrite = false;
        grid.position.set(0, 0.3, 0);
        grid.scale.set(x / maxDim, 1, y / maxDim);
        grid.renderOrder = 11;
        this.#group.add(grid);
    }

    #createVolumeFrame(x, y, z, color) {
        const geometry = new THREE.BoxGeometry(x, z, y);
        const edges = new THREE.EdgesGeometry(geometry);
        const material = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9,
            linewidth: 2,
        });

        const frame = new THREE.LineSegments(edges, material);
        frame.position.set(0, z / 2 + 0.3, 0);
        frame.renderOrder = 50;
        this.#group.add(frame);
    }

    #createBase(x, y, color) {
        const geometry = new THREE.PlaneGeometry(x, y);
        const material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        const base = new THREE.Mesh(geometry, material);
        base.rotation.x = -Math.PI / 2;
        base.position.set(0, 0.2, 0);
        base.renderOrder = 10;
        this.#group.add(base);
    }

    #updateLabel() {
        if (this.#labelMesh) {
            this.#group.remove(this.#labelMesh);
            this.#labelMesh.geometry?.dispose();
            this.#labelMesh.material?.dispose();
            this.#labelTexture?.dispose();
        }

        if (
            !state.get("showBedLabel") ||
            !state.get("bedActive") ||
            state.get("bedPreset") === "none"
        ) {
            return;
        }

        const [x, y, z] = ["bedX", "bedY", "bedZ"].map((k) => state.get(k));
        const name = this.#getDisplayName();
        const sizeText = `${x} × ${y} × ${z} mm`;

        const planeWidth = x / 3;
        const planeHeight = planeWidth * 0.35;

        const canvas = this.#createLabelCanvas(
            name,
            sizeText,
            this.#lastFitState,
            planeWidth,
            planeHeight
        );

        this.#labelTexture = new THREE.CanvasTexture(canvas);
        this.#labelTexture.minFilter = this.#labelTexture.magFilter =
            THREE.LinearFilter;

        const material = new THREE.MeshBasicMaterial({
            map: this.#labelTexture,
            transparent: true,
            side: THREE.DoubleSide,
            depthTest: true,
            depthWrite: false,
        });

        this.#labelMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(planeWidth, planeHeight),
            material
        );
        this.#labelMesh.rotation.x = -Math.PI / 2;
        this.#labelMesh.position.set(
            x / 2 - planeWidth / 2,
            0.5,
            y / 2 + planeHeight / 2 + 2
        );
        this.#labelMesh.renderOrder = 100;

        this.#group.add(this.#labelMesh);
    }

    #getDisplayName() {
        const preset = state.get("bedPreset");
        if (preset === "custom") return state.get("bedCustomName") || "Custom";
        if (preset === "none") return "";
        return PRINTERS[preset]?.name || preset;
    }

    #createLabelCanvas(name, sizeText, fits, w, h) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const ratio = 4;

        canvas.width = w * ratio;
        canvas.height = h * ratio;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const color = fits ? "#00ff99" : "#ff4466";
        const padding = canvas.height * 0.1;
        let fontSize1 = (canvas.height - padding * 2) * 0.5;
        let fontSize2 = fontSize1 * 0.7;

        ctx.font = `bold ${fontSize1}px Arial, sans-serif`;
        while (
            ctx.measureText(name).width > canvas.width - padding * 2 &&
            fontSize1 > 10
        ) {
            fontSize1 -= 2;
            ctx.font = `bold ${fontSize1}px Arial, sans-serif`;
        }

        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 4 * ratio;
        ctx.shadowOffsetX = ctx.shadowOffsetY = ratio;

        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(name, canvas.width / 2, padding + fontSize1 * 0.8);

        ctx.font = `${fontSize2}px Arial, sans-serif`;
        ctx.fillText(
            sizeText,
            canvas.width / 2,
            padding + fontSize1 * 0.8 + canvas.height * 0.1 + fontSize2 * 0.8
        );

        return canvas;
    }

    checkFit(showNotification = true) {
        const mesh = modelManager.mesh;

        if (
            !mesh ||
            !state.get("bedActive") ||
            state.get("bedPreset") === "none"
        ) {
            this.#lastFitState = true;
            return true;
        }

        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());

        const fits =
            size.x <= state.get("bedX") &&
            size.z <= state.get("bedY") &&
            size.y <= state.get("bedZ");

        const changed = this.#lastFitState !== fits;
        this.#lastFitState = fits;

        const color = new THREE.Color(fits ? 0x00ff99 : 0xff4466);
        this.#group.children.forEach((child) => {
            if (child !== this.#labelMesh && child.material?.color) {
                child.material.color.copy(color);
            }
        });

        if (changed && state.get("showBedLabel")) {
            this.#updateLabel();
        }

        if (showNotification && (changed || !fits)) {
            globalEvents.emit("bed:fitChanged", { fits, changed });
        }

        return fits;
    }

    setLabelVisible(visible) {
        if (visible && state.get("bedActive") && state.get("showBedLabel")) {
            this.#updateLabel();
        } else if (this.#labelMesh) {
            this.#group.remove(this.#labelMesh);
            this.#labelMesh.geometry?.dispose();
            this.#labelMesh.material?.dispose();
            this.#labelTexture?.dispose();
            this.#labelMesh = null;
            this.#labelTexture = null;
        }
    }
}

export const bedManager = new BedManager();
