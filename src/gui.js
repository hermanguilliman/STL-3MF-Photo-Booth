import { GUI } from "lil-gui";

import {
    state,
    layerUniforms,
    rotationState,
    savedRotationState,
    setSavedRotationState,
    updateState,
} from "./state.js";
import { PRINTER_PRESETS } from "./constants.js";
import { translations, getCurLang } from "./language.js";
import { material, applyPreset, updateMaterialProperty } from "./materials.js";
import { setupLighting } from "./lighting.js";
import { loadHDRI, updateBackgroundState } from "./environment.js";
import { scene, gridHelper, plane } from "./scene.js";
import { updateBedVisual, checkModelFits, setBedLabelVisible } from "./bed.js";
import { applyRotation } from "./model.js";
import { addDropdown, showToast, getPrinterOptions } from "./utils.js";
import { resetSettings } from "./storage.js";

let gui = null;
let rotXCtrl = null;
let rotYCtrl = null;
let rotZCtrl = null;

export function getGui() {
    return gui;
}

export function updateOrientationDisplay() {
    if (rotXCtrl) rotXCtrl.updateDisplay();
    if (rotYCtrl) rotYCtrl.updateDisplay();
    if (rotZCtrl) rotZCtrl.updateDisplay();
}

export function buildGui(controls) {
    if (gui) {
        gui.destroy();
        gui = null;
    }

    rotXCtrl = null;
    rotYCtrl = null;
    rotZCtrl = null;

    const t = translations[getCurLang()];
    gui = new GUI({ title: t.guiTitle, width: 260 });

    const matFolder = gui.addFolder(t.fMat);

    addDropdown(matFolder, state, "preset", t.presets, (v) => {
        updateState("preset", v);
        applyPreset(v, gui);
    }).name(t.pPreset);

    matFolder
        .addColor(state, "color")
        .name(t.pColor)
        .onChange((v) => {
            material.color.set(v);
            updateState("color", v);
        });

    matFolder
        .add(state, "roughness", 0, 1)
        .name(t.pRough)
        .onChange((v) => updateMaterialProperty("roughness", v));

    matFolder
        .add(state, "metalness", 0, 1)
        .name(t.pMetal)
        .onChange((v) => updateMaterialProperty("metalness", v));

    matFolder
        .add(state, "clearcoat", 0, 1)
        .name(t.pClear)
        .onChange((v) => updateMaterialProperty("clearcoat", v));

    matFolder
        .add(state, "clearcoatRoughness", 0, 1)
        .name(t.pClearR)
        .onChange((v) => updateMaterialProperty("clearcoatRoughness", v));

    const printFolder = gui.addFolder(t.fPrint);
    printFolder
        .add(state, "layerActive")
        .name(t.lLayerEnable)
        .onChange((v) => {
            layerUniforms.uLayerActive.value = v;
            updateState("layerActive", v);
        });

    const layerHeights = [0.08, 0.12, 0.16, 0.2, 0.24, 0.28];
    printFolder
        .add(state, "layerHeight", layerHeights)
        .name(t.lLayerHeight)
        .onChange((v) => {
            const val = parseFloat(v);
            layerUniforms.uLayerHeight.value = val;
            updateState("layerHeight", val);
        });

    printFolder
        .add(state, "layerStrength", 0.1, 1.0)
        .name(t.lLayerStr)
        .onChange((v) => {
            layerUniforms.uLayerStrength.value = v;
            updateState("layerStrength", v);
        });

    printFolder.open();

    const bedFolder = gui.addFolder(t.fBed);
    let bedXCtrl, bedYCtrl, bedZCtrl, bedNameCtrl;

    const printerOptions = getPrinterOptions(t);

    addDropdown(bedFolder, state, "bedPreset", printerOptions, (v) => {
        state.bedActive = v !== "none";
        updateState("bedPreset", v);
        updateState("bedActive", state.bedActive);

        if (v !== "none") {
            state.lastActiveBedPreset = v;
            updateState("lastActiveBedPreset", v);
        }

        if (v !== "custom" && v !== "none") {
            const preset = PRINTER_PRESETS[v];
            state.bedX = preset.x;
            state.bedY = preset.y;
            state.bedZ = preset.z;
            updateState("bedX", preset.x);
            updateState("bedY", preset.y);
            updateState("bedZ", preset.z);
            if (bedXCtrl) bedXCtrl.updateDisplay();
            if (bedYCtrl) bedYCtrl.updateDisplay();
            if (bedZCtrl) bedZCtrl.updateDisplay();
        }

        if (bedNameCtrl) bedNameCtrl.show(v === "custom");
        updateBedVisual();

        const btn = document.getElementById("bedBtn");
        if (btn) btn.classList.toggle("active", state.bedActive);

        if (state.bedActive) {
            setTimeout(() => checkModelFits(true), 100);
        }
    }).name(t.bedPreset);

    bedXCtrl = bedFolder
        .add(state, "bedX", 50, 500, 1)
        .name(t.bedX)
        .onChange((v) => {
            if (state.bedPreset !== "custom") {
                state.bedPreset = "custom";
                updateState("bedPreset", "custom");
                state.lastActiveBedPreset = "custom";
                updateState("lastActiveBedPreset", "custom");
            }
            updateState("bedX", v);
            updateBedVisual();
            checkModelFits(true);
        });

    bedYCtrl = bedFolder
        .add(state, "bedY", 50, 500, 1)
        .name(t.bedY)
        .onChange((v) => {
            if (state.bedPreset !== "custom") {
                state.bedPreset = "custom";
                updateState("bedPreset", "custom");
                state.lastActiveBedPreset = "custom";
                updateState("lastActiveBedPreset", "custom");
            }
            updateState("bedY", v);
            updateBedVisual();
            checkModelFits(true);
        });

    bedZCtrl = bedFolder
        .add(state, "bedZ", 50, 500, 1)
        .name(t.bedZ)
        .onChange((v) => {
            if (state.bedPreset !== "custom") {
                state.bedPreset = "custom";
                updateState("bedPreset", "custom");
                state.lastActiveBedPreset = "custom";
                updateState("lastActiveBedPreset", "custom");
            }
            updateState("bedZ", v);
            updateBedVisual();
            checkModelFits(true);
        });

    bedNameCtrl = bedFolder
        .add(state, "bedCustomName")
        .name(t.bedCustomName)
        .onChange((v) => {
            updateState("bedCustomName", v);
            updateBedVisual();
        });
    bedNameCtrl.show(state.bedPreset === "custom");

    bedFolder
        .add(state, "showBedLabel")
        .name(t.bedShowLabel)
        .onChange((v) => {
            updateState("showBedLabel", v);
            setBedLabelVisible(v);
        });

    const envFolder = gui.addFolder(t.fEnv);

    addDropdown(envFolder, state, "lighting", t.lights, (v) => {
        updateState("lighting", v);
        setupLighting(v);
    }).name(t.lScheme);

    addDropdown(envFolder, state, "hdri", t.hdris, (v) => {
        updateState("hdri", v);
        loadHDRI(v);
    }).name(t.lHdri);

    const bgOptions = {};
    bgOptions[t.vColor] = "color";
    bgOptions[t.vHdri] = "hdri";

    envFolder
        .add(state, "bgMode", bgOptions)
        .name(t.lBgType)
        .onChange((v) => {
            updateState("bgMode", v);
            updateBackgroundState();
            blurCtrl.show(v === "hdri");
            colorCtrl.show(v === "color");
        });

    const blurCtrl = envFolder
        .add(state, "bgBlur", 0, 1)
        .name(t.lBgBlur)
        .onChange((v) => {
            scene.backgroundBlurriness = v;
            updateState("bgBlur", v);
        });
    blurCtrl.show(state.bgMode === "hdri");

    const colorCtrl = envFolder
        .addColor(state, "bgColor")
        .name(t.lBgCol)
        .onChange((v) => {
            updateState("bgColor", v);
            if (state.bgMode === "color") updateBackgroundState();
        });
    colorCtrl.show(state.bgMode === "color");

    const sceneFolder = gui.addFolder(t.fScene);

    sceneFolder
        .add(state, "grid")
        .name(t.sGrid)
        .onChange((v) => {
            gridHelper.visible = v;
            updateState("grid", v);
        });

    sceneFolder
        .add(state, "shadows")
        .name(t.sShadow)
        .onChange((v) => {
            plane.visible = v;
            updateState("shadows", v);
        });

    sceneFolder
        .add(state, "autoRotate")
        .name(t.sAuto)
        .onChange((v) => {
            if (controls) controls.autoRotate = v;
            updateState("autoRotate", v);
        });

    const orientFolder = gui.addFolder(t.fOrient);

    rotXCtrl = orientFolder
        .add(rotationState, "x", -180, 180, 5)
        .name("X°")
        .onChange(applyRotation);

    rotYCtrl = orientFolder
        .add(rotationState, "y", -180, 180, 5)
        .name("Y°")
        .onChange(applyRotation);

    rotZCtrl = orientFolder
        .add(rotationState, "z", -180, 180, 5)
        .name("Z°")
        .onChange(applyRotation);

    const actions = {
        reset: () => {
            rotationState.x = rotationState.y = rotationState.z = 0;
            updateOrientationDisplay();
            applyRotation();
        },
        zUp: () => {
            const isZUp =
                rotationState.x === -90 &&
                rotationState.y === 0 &&
                rotationState.z === 0;

            if (isZUp) {
                rotationState.x = savedRotationState.x;
                rotationState.y = savedRotationState.y;
                rotationState.z = savedRotationState.z;
            } else {
                setSavedRotationState(
                    rotationState.x,
                    rotationState.y,
                    rotationState.z
                );
                rotationState.x = -90;
                rotationState.y = 0;
                rotationState.z = 0;
            }
            updateOrientationDisplay();
            applyRotation();
        },
    };

    orientFolder.add(actions, "reset").name(t.oReset);
    orientFolder.add(actions, "zUp").name(t.oZUp);

    const settingsFolder = gui.addFolder(t.fSettings);
    const settingsActions = {
        resetAll: () => {
            if (confirm(t.confirmReset)) {
                resetSettings();
                showToast(t.toastReset, 2000, "success");
                setTimeout(() => window.location.reload(), 1500);
            }
        },
    };
    settingsFolder.add(settingsActions, "resetAll").name(t.btnReset);

    if (window.innerWidth > 600) {
        matFolder.open();
    } else {
        gui.close();
    }

    return gui;
}
