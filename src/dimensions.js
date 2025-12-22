import * as THREE from "three";
import { scene, camera } from "./scene.js";
import { state } from "./state.js";
import { getMesh } from "./meshStore.js";
import { checkModelFits } from "./bed.js";

let dimHelper = null;
export let dimBox = new THREE.Box3();

export const dimLabels = {
    container: document.getElementById("dimLabels"),
    x: document.getElementById("dimX"),
    y: document.getElementById("dimY"),
    z: document.getElementById("dimZ"),
};

let cachedSize = new THREE.Vector3();
let lastCameraPosition = new THREE.Vector3();
let lastCameraQuaternion = new THREE.Quaternion();
let needsFullUpdate = true;

export function hideDimHelper() {
    if (dimHelper) {
        dimHelper.visible = false;
    }
    if (dimLabels.container) {
        dimLabels.container.style.display = "none";
    }
}

export function showDimHelper() {
    if (dimHelper && state.showDimensions) {
        dimHelper.visible = true;
    }
    if (dimLabels.container && state.showDimensions) {
        dimLabels.container.style.display = "";
    }
}

export function markDimensionsForUpdate() {
    needsFullUpdate = true;
}

export function toggleDimensions() {
    state.showDimensions = !state.showDimensions;
    applyDimensionsState();
}

export function initDimensionsFromState() {
    if (state.showDimensions) {
        setTimeout(() => {
            applyDimensionsState();
        }, 300);
    }
}

function applyDimensionsState() {
    const btn = document.getElementById("dimBtn");

    if (state.showDimensions) {
        if (btn) btn.classList.add("active");
        if (dimLabels.container) dimLabels.container.classList.add("visible");

        if (dimHelper) {
            scene.remove(dimHelper);
            if (dimHelper.geometry) dimHelper.geometry.dispose();
            if (dimHelper.material) dimHelper.material.dispose();
            dimHelper = null;
        }

        needsFullUpdate = true;
        recalculateDimensions();

        if (dimBox && !dimBox.isEmpty()) {
            dimHelper = new THREE.Box3Helper(dimBox, 0x00b894);
            dimHelper.renderOrder = 999;
            scene.add(dimHelper);
            dimHelper.visible = true;
        }
    } else {
        if (btn) btn.classList.remove("active");
        if (dimLabels.container)
            dimLabels.container.classList.remove("visible");

        if (dimHelper) {
            dimHelper.visible = false;
            scene.remove(dimHelper);
            if (dimHelper.geometry) dimHelper.geometry.dispose();
            if (dimHelper.material) dimHelper.material.dispose();
            dimHelper = null;
        }
    }
}

function recalculateDimensions() {
    const currentMesh = getMesh();
    if (!currentMesh) return false;

    currentMesh.updateMatrixWorld(true);
    dimBox.setFromObject(currentMesh);

    if (dimBox.isEmpty()) return false;

    dimBox.getSize(cachedSize);

    if (dimLabels.x) dimLabels.x.innerText = `X: ${cachedSize.x.toFixed(1)} mm`;
    if (dimLabels.y) dimLabels.y.innerText = `Z: ${cachedSize.z.toFixed(1)} mm`;
    if (dimLabels.z) dimLabels.z.innerText = `Y: ${cachedSize.y.toFixed(1)} mm`;

    if (dimHelper) {
        dimHelper.box.copy(dimBox);
    }

    needsFullUpdate = false;

    if (state.bedActive) {
        checkModelFits(false);
    }

    return true;
}

function updateLabelPositions() {
    if (dimBox.isEmpty()) return;

    const posX = new THREE.Vector3(
        (dimBox.min.x + dimBox.max.x) / 2,
        dimBox.min.y - 3,
        dimBox.max.z + 5
    );
    const posY = new THREE.Vector3(
        dimBox.max.x + 5,
        dimBox.min.y - 3,
        (dimBox.min.z + dimBox.max.z) / 2
    );
    const posZ = new THREE.Vector3(
        dimBox.max.x + 5,
        (dimBox.min.y + dimBox.max.y) / 2,
        dimBox.min.z
    );

    projectLabel(dimLabels.x, posX);
    projectLabel(dimLabels.y, posY);
    projectLabel(dimLabels.z, posZ);
}

export function updateDimensions() {
    if (!state.showDimensions) return;

    const currentMesh = getMesh();
    if (!currentMesh) return;

    if (needsFullUpdate) {
        recalculateDimensions();

        if (!dimHelper && !dimBox.isEmpty()) {
            dimHelper = new THREE.Box3Helper(dimBox, 0x00b894);
            dimHelper.renderOrder = 999;
            scene.add(dimHelper);
        }
    }

    const cameraChanged =
        !camera.position.equals(lastCameraPosition) ||
        !camera.quaternion.equals(lastCameraQuaternion);

    if (cameraChanged || needsFullUpdate) {
        updateLabelPositions();
        lastCameraPosition.copy(camera.position);
        lastCameraQuaternion.copy(camera.quaternion);
    }
}

export function forceUpdateDimensions() {
    if (!state.showDimensions) return;

    needsFullUpdate = true;
    recalculateDimensions();

    if (dimHelper) {
        dimHelper.box.copy(dimBox);
    } else if (!dimBox.isEmpty()) {
        dimHelper = new THREE.Box3Helper(dimBox, 0x00b894);
        dimHelper.renderOrder = 999;
        scene.add(dimHelper);
    }

    updateLabelPositions();
}

function projectLabel(element, position) {
    if (!element) return;

    const vector = position.clone();
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(vector.y * 0.5) + 0.5) * window.innerHeight;

    if (Math.abs(vector.z) > 1) {
        element.style.display = "none";
    } else {
        element.style.display = "block";
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
    }
}
