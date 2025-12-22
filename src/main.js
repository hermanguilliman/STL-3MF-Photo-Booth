import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
    scene,
    camera,
    renderer,
    composer,
    handleResize,
    gridHelper,
    plane,
    saoPass,
    fxaaPass,
    updateShadows,
} from "./scene.js";
import {
    state,
    rotationState,
    savedRotationState,
    setSavedRotationState,
    updateState,
} from "./state.js";
import { setupLighting } from "./lighting.js";
import { loadHDRI, updateBackgroundState } from "./environment.js";
import { material } from "./materials.js";
import {
    handleFile,
    getCurrentMesh,
    setCurrentMesh,
    placeOnFloor,
    fitCamera,
    applyRotation,
} from "./model.js";
import {
    updateBedVisual,
    checkModelFits,
    bedGroup,
    setBedLabelVisible,
} from "./bed.js";
import {
    toggleDimensions,
    updateDimensions,
    forceUpdateDimensions,
    initDimensionsFromState,
} from "./dimensions.js";
import { screenshotScene, screenshotModel } from "./screenshot.js";
import { buildGui, updateOrientationDisplay } from "./gui.js";

import {
    detectLanguage,
    setBuildGuiCallback,
    translations,
    getCurLang,
} from "./language.js";
import { showToast } from "./utils.js";
import { PRINTER_PRESETS } from "./constants.js";
import { setMesh } from "./meshStore.js";
import {
    AdaptiveQuality,
    isMobile,
    setGlobalAdaptiveQuality,
} from "./quality.js";

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = isMobile ? 0.1 : 0.08;
controls.autoRotate = state.autoRotate;
controls.autoRotateSpeed = isMobile ? 1.0 : 2.0;

if (isMobile) {
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 0.8;
}

const adaptiveQuality = new AdaptiveQuality(
    renderer,
    composer,
    saoPass,
    fxaaPass,
    (quality, settings) => {
        console.log(`Quality changed to: ${quality}`);
    }
);

setGlobalAdaptiveQuality(adaptiveQuality);

setupLighting(state.lighting);
loadHDRI(state.hdri);
gridHelper.visible = state.grid;
plane.visible = state.shadows;

if (state.bedActive && state.bedPreset !== "none") {
    updateBedVisual();
    const bedBtn = document.getElementById("bedBtn");
    if (bedBtn) bedBtn.classList.add("active");
}

if (state.showDimensions) {
    setTimeout(() => {
        const dimBtn = document.getElementById("dimBtn");
        if (dimBtn) dimBtn.classList.add("active");
        const dimLabels = document.getElementById("dimLabels");
        if (dimLabels) dimLabels.classList.add("visible");
    }, 100);
}

function setView(type, centerOverride = null, dimOverride = null) {
    const currentMesh = getCurrentMesh();
    let center = centerOverride;
    let dim = dimOverride;

    if (!center || !dim) {
        if (!currentMesh) return;
        const box = new THREE.Box3().setFromObject(currentMesh);
        center = box.getCenter(new THREE.Vector3());
        dim = Math.max(
            box.max.x - box.min.x,
            box.max.y - box.min.y,
            box.max.z - box.min.z
        );
    }

    const dist = dim * 1.8;
    controls.target.copy(center);
    const pos = center.clone();

    switch (type) {
        case "iso":
            pos.add(new THREE.Vector3(dist, dist * 0.6, dist));
            break;
        case "front":
            pos.add(new THREE.Vector3(0, 0, dist));
            break;
        case "top":
            pos.add(new THREE.Vector3(0, dist, 0));
            break;
        case "side":
            pos.add(new THREE.Vector3(dist, 0, 0));
            break;
    }

    camera.position.copy(pos);
    camera.lookAt(center);

    updateShadows();
}

window.setView = setView;

window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "1") setView("iso");
    if (e.key === "2") setView("front");
    if (e.key === "3") setView("top");
    if (e.key === "4") setView("side");
});

const dropZone = document.getElementById("drop-zone");
window.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("active");
});
window.addEventListener("dragleave", () => dropZone.classList.remove("active"));
window.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("active");
    if (e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0], controls, setView);
    }
});

document.getElementById("fileInput").addEventListener("change", (e) => {
    if (e.target.files[0]) {
        handleFile(e.target.files[0], controls, setView);
    }
});

document
    .getElementById("screenshotSceneBtn")
    .addEventListener("click", screenshotScene);
document
    .getElementById("screenshotModelBtn")
    .addEventListener("click", screenshotModel);

document.getElementById("dimBtn").addEventListener("click", () => {
    toggleDimensions();
    updateState("showDimensions", state.showDimensions);
});

document.getElementById("bedBtn").addEventListener("click", () => {
    state.bedActive = !state.bedActive;
    updateState("bedActive", state.bedActive);

    const btn = document.getElementById("bedBtn");
    btn.classList.toggle("active", state.bedActive);

    if (state.bedActive) {
        const presetToUse = state.lastActiveBedPreset || "ender3";
        const finalPreset = PRINTER_PRESETS[presetToUse]
            ? presetToUse
            : "ender3";

        state.bedPreset = finalPreset;
        const preset = PRINTER_PRESETS[finalPreset];

        if (finalPreset !== "custom") {
            state.bedX = preset.x;
            state.bedY = preset.y;
            state.bedZ = preset.z;
            updateState("bedX", preset.x);
            updateState("bedY", preset.y);
            updateState("bedZ", preset.z);
        }

        updateState("bedPreset", finalPreset);
        buildGui(controls);
        updateBedVisual();

        setTimeout(() => {
            checkModelFits(true);
        }, 100);
    } else {
        state.bedPreset = "none";
        updateState("bedPreset", "none");
        buildGui(controls);
        updateBedVisual();
    }
});

const mobileZUp = document.getElementById("mobileZUp");
if (mobileZUp) {
    mobileZUp.addEventListener("click", () => {
        const isZUp =
            rotationState.x === -90 &&
            rotationState.y === 0 &&
            rotationState.z === 0;

        if (isZUp) {
            rotationState.x = savedRotationState.x;
            rotationState.y = savedRotationState.y;
            rotationState.z = savedRotationState.z;
            applyRotation();
            updateOrientationDisplay();
            showToast(translations[getCurLang()].toastZReset, 2000, "success");
        } else {
            setSavedRotationState(
                rotationState.x,
                rotationState.y,
                rotationState.z
            );
            rotationState.x = -90;
            rotationState.y = 0;
            rotationState.z = 0;
            applyRotation();
            updateOrientationDisplay();
            showToast(translations[getCurLang()].toastZ, 2000, "success");
        }
    });
}

const helpBtn = document.getElementById("helpBtn");
const helpContent = document.getElementById("helpContent");
const langMenu = document.getElementById("langMenu");

helpBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    helpContent.classList.toggle("visible");
    langMenu.classList.remove("visible");
});

document.addEventListener("click", () => {
    helpContent.classList.remove("visible");
    langMenu.classList.remove("visible");
});

setBuildGuiCallback(() => buildGui(controls));
window.buildGui = () => buildGui(controls);

let lastDimensionUpdate = 0;
const dimensionUpdateInterval = isMobile ? 100 : 16;

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    adaptiveQuality.update();

    const now = performance.now();
    if (now - lastDimensionUpdate >= dimensionUpdateInterval) {
        updateDimensions();
        lastDimensionUpdate = now;
    }

    composer.render();
}

window.addEventListener("resize", handleResize);

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        controls.autoRotate = false;
    } else {
        controls.autoRotate = state.autoRotate;
    }
});

detectLanguage();
buildGui(controls);
animate();

const segments = isMobile ? 100 : 150;
const radialSegments = isMobile ? 16 : 24;
const testGeo = new THREE.TorusKnotGeometry(10, 2.5, segments, radialSegments);
const testMesh = new THREE.Mesh(testGeo, material);
testMesh.castShadow = true;
testMesh.receiveShadow = true;
scene.add(testMesh);
setMesh(testMesh);
setCurrentMesh(testMesh);
placeOnFloor();
fitCamera(testMesh, controls, setView);

if (state.bedActive) {
    setTimeout(() => {
        checkModelFits(true);
    }, 500);
}

initDimensionsFromState();
