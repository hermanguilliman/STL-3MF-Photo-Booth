import * as THREE from "three";
import { scene } from "./scene.js";
import { state } from "./state.js";
import { translations, getCurLang } from "./language.js";
import { PRINTER_NAMES } from "./constants.js";
import { showToast } from "./utils.js";
import { getMesh } from "./meshStore.js";

export const bedGroup = new THREE.Group();
let bedGridHelper = null;
let bedVolumeFrame = null;
let lastFitState = true;

let bedLabelMesh = null;
let bedLabelTexture = null;

scene.add(bedGroup);
bedGroup.visible = false;
bedGroup.renderOrder = 10;

function getPrinterDisplayName() {
    const t = translations[getCurLang()];

    if (state.bedPreset === "custom") {
        return state.bedCustomName || t.printerCustom;
    }

    if (state.bedPreset === "none") {
        return "";
    }

    return PRINTER_NAMES[state.bedPreset] || state.bedPreset;
}

function createLabelTexture(name, sizeText, fits, targetWidth, targetHeight) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const pixelRatio = 4;
    const canvasWidth = targetWidth * pixelRatio;
    const canvasHeight = targetHeight * pixelRatio;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const textColor = fits ? "#00ff99" : "#ff4466";

    const padding = canvasHeight * 0.1;
    const availableHeight = canvasHeight - padding * 2;
    const availableWidth = canvasWidth - padding * 2;

    let fontSize1 = availableHeight * 0.5;
    let fontSize2 = availableHeight * 0.35;

    ctx.font = `bold ${fontSize1}px Arial, sans-serif`;
    let nameWidth = ctx.measureText(name).width;
    while (nameWidth > availableWidth && fontSize1 > 10) {
        fontSize1 -= 2;
        ctx.font = `bold ${fontSize1}px Arial, sans-serif`;
        nameWidth = ctx.measureText(name).width;
    }

    let displayName = name;
    if (nameWidth > availableWidth) {
        while (
            ctx.measureText(displayName + "...").width > availableWidth &&
            displayName.length > 0
        ) {
            displayName = displayName.slice(0, -1);
        }
        displayName += "...";
    }

    const gap = availableHeight * 0.1;
    const line1Y = padding + fontSize1 * 0.8;
    const line2Y = line1Y + gap + fontSize2 * 0.8;

    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 4 * pixelRatio;
    ctx.shadowOffsetX = 1 * pixelRatio;
    ctx.shadowOffsetY = 1 * pixelRatio;

    ctx.fillStyle = textColor;
    ctx.font = `bold ${fontSize1}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(displayName, canvasWidth / 2, line1Y);

    ctx.font = `${fontSize2}px Arial, sans-serif`;
    ctx.fillText(sizeText, canvasWidth / 2, line2Y);

    return canvas;
}

function updateBedLabel() {
    if (bedLabelMesh) {
        bedGroup.remove(bedLabelMesh);
        if (bedLabelMesh.geometry) bedLabelMesh.geometry.dispose();
        if (bedLabelMesh.material) bedLabelMesh.material.dispose();
        if (bedLabelTexture) bedLabelTexture.dispose();
        bedLabelMesh = null;
        bedLabelTexture = null;
    }

    if (!state.showBedLabel || !state.bedActive || state.bedPreset === "none") {
        return;
    }

    const name = getPrinterDisplayName();
    const sizeText = `${state.bedX} × ${state.bedY} × ${state.bedZ} mm`;

    const planeWidth = state.bedX / 3;
    const planeHeight = planeWidth * 0.35;

    const canvas = createLabelTexture(
        name,
        sizeText,
        lastFitState,
        planeWidth,
        planeHeight
    );

    bedLabelTexture = new THREE.CanvasTexture(canvas);
    bedLabelTexture.minFilter = THREE.LinearFilter;
    bedLabelTexture.magFilter = THREE.LinearFilter;

    const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

    const material = new THREE.MeshBasicMaterial({
        map: bedLabelTexture,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: false,
    });

    bedLabelMesh = new THREE.Mesh(geometry, material);
    bedLabelMesh.rotation.x = -Math.PI / 2;

    bedLabelMesh.position.set(
        state.bedX / 2 - planeWidth / 2,
        0.5,
        state.bedY / 2 + planeHeight / 2 + 2
    );

    bedLabelMesh.renderOrder = 100;
    bedGroup.add(bedLabelMesh);
}

export function updateBedLabelPosition() {}

export function setBedLabelVisible(visible) {
    if (visible && state.bedActive && state.showBedLabel) {
        updateBedLabel();
    } else if (bedLabelMesh) {
        bedGroup.remove(bedLabelMesh);
        if (bedLabelMesh.geometry) bedLabelMesh.geometry.dispose();
        if (bedLabelMesh.material) bedLabelMesh.material.dispose();
        if (bedLabelTexture) bedLabelTexture.dispose();
        bedLabelMesh = null;
        bedLabelTexture = null;
    }
}

export function updateBedVisual() {
    while (bedGroup.children.length > 0) {
        const child = bedGroup.children[0];
        bedGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
            } else {
                child.material.dispose();
            }
        }
    }

    bedLabelMesh = null;
    bedLabelTexture = null;

    if (!state.bedActive || state.bedPreset === "none") {
        bedGroup.visible = false;
        return;
    }

    const x = state.bedX;
    const y = state.bedY;
    const z = state.bedZ;

    if (x <= 0 || y <= 0 || z <= 0) {
        bedGroup.visible = false;
        return;
    }

    const bedColor = 0x00ff99;

    const maxDim = Math.max(x, y);
    const divisions = Math.max(Math.floor(maxDim / 10), 10);
    bedGridHelper = new THREE.GridHelper(maxDim, divisions, bedColor, bedColor);
    bedGridHelper.material.opacity = 0.6;
    bedGridHelper.material.transparent = true;
    bedGridHelper.material.depthWrite = false;
    bedGridHelper.material.fog = false;
    bedGridHelper.position.set(0, 0.3, 0);
    bedGridHelper.scale.set(x / maxDim, 1, y / maxDim);
    bedGridHelper.renderOrder = 11;
    bedGroup.add(bedGridHelper);

    const volumeGeometry = new THREE.BoxGeometry(x, z, y);
    const volumeEdges = new THREE.EdgesGeometry(volumeGeometry);
    const volumeMaterial = new THREE.LineBasicMaterial({
        color: bedColor,
        transparent: true,
        opacity: 0.9,
        fog: false,
        linewidth: 2,
    });
    bedVolumeFrame = new THREE.LineSegments(volumeEdges, volumeMaterial);
    bedVolumeFrame.position.set(0, z / 2 + 0.3, 0); // Поднимаем выше
    bedVolumeFrame.renderOrder = 50;
    bedGroup.add(bedVolumeFrame);

    const baseGeometry = new THREE.PlaneGeometry(x, y);
    const baseMaterial = new THREE.MeshBasicMaterial({
        color: bedColor,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        fog: false,
        depthWrite: false,
    });
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.rotation.x = -Math.PI / 2;
    baseMesh.position.set(0, 0.2, 0);
    baseMesh.renderOrder = 10;
    bedGroup.add(baseMesh);

    bedGroup.visible = true;

    if (state.showBedLabel) {
        updateBedLabel();
    }
}

export function checkModelFits(showNotification = true) {
    const currentMesh = getMesh();

    if (!currentMesh) {
        lastFitState = true;
        return true;
    }

    if (!state.bedActive || state.bedPreset === "none") {
        lastFitState = true;
        return true;
    }

    const box = new THREE.Box3().setFromObject(currentMesh);
    const size = box.getSize(new THREE.Vector3());

    const modelX = size.x;
    const modelY = size.z;
    const modelZ = size.y;

    const fits =
        modelX <= state.bedX && modelY <= state.bedY && modelZ <= state.bedZ;

    const stateChanged = lastFitState !== fits;
    lastFitState = fits;

    const newColor = new THREE.Color(fits ? 0x00ff99 : 0xff4466);

    bedGroup.children.forEach((child) => {
        if (child === bedLabelMesh) return;
        if (child.material && child.material.color) {
            child.material.color.copy(newColor);
        }
    });

    if (stateChanged && state.showBedLabel) {
        updateBedLabel();
    }

    if (showNotification && (stateChanged || !fits)) {
        const t = translations[getCurLang()];
        if (!fits) {
            showToast(t.toastNoFit, 4000, "error");
        } else if (stateChanged) {
            showToast(t.toastFits, 2000, "success");
        }
    }

    return fits;
}

export function centerModelOnBed() {
    const currentMesh = getMesh();
    if (!currentMesh || !state.bedActive) return;

    const box = new THREE.Box3().setFromObject(currentMesh);
    const center = box.getCenter(new THREE.Vector3());

    currentMesh.position.x -= center.x;
    currentMesh.position.z -= center.z;
}
