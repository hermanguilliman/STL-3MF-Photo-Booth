import { GUI } from "lil-gui";

import { state } from "../core/StateManager.js";
import { globalEvents } from "../core/EventEmitter.js";
import { PRINTERS } from "../core/constants.js";
import { materialManager } from "../managers/MaterialManager.js";
import { lightingManager } from "../managers/LightingManager.js";
import { environmentManager } from "../managers/EnvironmentManager.js";
import { bedManager } from "../managers/BedManager.js";
import { modelManager } from "../managers/ModelManager.js";
import { sceneManager } from "../managers/SceneManager.js";
import { i18n } from "../i18n/LanguageManager.js";
import { storage } from "../core/StorageManager.js";
import { addDropdown, showToast, getPrinterOptions } from "../utils/helpers.js";

let gui = null;
let rotationControllers = { x: null, y: null, z: null };

export function getGui() {
    return gui;
}

export function updateOrientationDisplay() {
    Object.values(rotationControllers).forEach((c) => c?.updateDisplay());
}

export function buildGui(controls, app) {
    if (gui) {
        gui.destroy();
        gui = null;
    }

    rotationControllers = { x: null, y: null, z: null };
    const t = i18n.t;

    const s = state.getAll();

    gui = new GUI({ title: t.guiTitle, width: 260 });

    buildMaterialFolder(t, s);
    buildPrintFolder(t, s);
    buildBedFolder(t, s);
    buildEnvironmentFolder(t, s, controls);
    buildSceneFolder(t, s, controls);
    buildOrientationFolder(t, app);
    buildSettingsFolder(t);

    setupStateSync(s);

    if (window.innerWidth > 600) {
        gui.folders[0]?.open();
    } else {
        gui.close();
    }

    return gui;
}

function setupStateSync(localState) {
    const syncCallback = ({ key, value }) => {
        localState[key] = value;

        const updateRecursive = (parent) => {
            parent.controllers.forEach((c) => {
                if (c.property === key) c.updateDisplay();
            });
            parent.folders.forEach((f) => updateRecursive(f));
        };

        if (gui) updateRecursive(gui);
    };

    const unsubscribe = globalEvents.on("change", syncCallback);

    const originalDestroy = gui.destroy.bind(gui);
    gui.destroy = () => {
        unsubscribe();
        originalDestroy();
    };
}

function buildMaterialFolder(t, s) {
    const folder = gui.addFolder(t.fMat);

    addDropdown(folder, s, "preset", t.presets, (v) => {
        materialManager.applyPreset(v);
    }).name(t.pPreset);

    folder
        .addColor(s, "color")
        .name(t.pColor)
        .onChange((v) => {
            materialManager.setColor(v);
        });

    const props = [
        ["roughness", t.pRough],
        ["metalness", t.pMetal],
        ["clearcoat", t.pClear],
        ["clearcoatRoughness", t.pClearR],
    ];

    props.forEach(([prop, name]) => {
        folder
            .add(s, prop, 0, 1)
            .name(name)
            .onChange((v) => {
                materialManager.setProperty(prop, v);
            });
    });
}

function buildPrintFolder(t, s) {
    const folder = gui.addFolder(t.fPrint);

    folder
        .add(s, "layerActive")
        .name(t.lLayerEnable)
        .onChange((v) => {
            state.updateLayerUniform("uLayerActive", v);
            state.set("layerActive", v);
        });

    const heights = [0.08, 0.12, 0.16, 0.2, 0.24, 0.28];
    folder
        .add(s, "layerHeight", heights)
        .name(t.lLayerHeight)
        .onChange((v) => {
            const val = parseFloat(v);
            state.updateLayerUniform("uLayerHeight", val);
            state.set("layerHeight", val);
        });

    folder
        .add(s, "layerStrength", 0.1, 1.0)
        .name(t.lLayerStr)
        .onChange((v) => {
            state.updateLayerUniform("uLayerStrength", v);
            state.set("layerStrength", v);
        });

    folder.open();
}

function buildBedFolder(t, s) {
    const folder = gui.addFolder(t.fBed);
    let bedNameCtrl;

    const printerOptions = getPrinterOptions(t);

    addDropdown(folder, s, "bedPreset", printerOptions, (v) => {
        const active = v !== "none";
        state.set("bedActive", active);
        state.set("bedPreset", v);

        if (v !== "none") {
            state.set("lastActiveBedPreset", v);
        }

        if (v !== "custom" && v !== "none") {
            const preset = PRINTERS[v];

            state.setMultiple({
                bedX: preset.x,
                bedY: preset.y,
                bedZ: preset.z,
            });
        }

        bedNameCtrl?.show(v === "custom");
        bedManager.update();

        document.getElementById("bedBtn")?.classList.toggle("active", active);

        if (active) {
            setTimeout(() => bedManager.checkFit(true), 100);
        }
    }).name(t.bedPreset);

    const bedSizeChange = (prop) => (v) => {
        const updates = { [prop]: v };
        if (state.get("bedPreset") !== "custom") {
            updates.bedPreset = "custom";
            updates.lastActiveBedPreset = "custom";
        }
        state.setMultiple(updates);
        bedManager.update();
        bedManager.checkFit(true);
    };

    folder
        .add(s, "bedX", 50, 500, 1)
        .name(t.bedX)
        .onChange(bedSizeChange("bedX"));
    folder
        .add(s, "bedY", 50, 500, 1)
        .name(t.bedY)
        .onChange(bedSizeChange("bedY"));
    folder
        .add(s, "bedZ", 50, 500, 1)
        .name(t.bedZ)
        .onChange(bedSizeChange("bedZ"));

    bedNameCtrl = folder
        .add(s, "bedCustomName")
        .name(t.bedCustomName)
        .onChange((v) => {
            state.set("bedCustomName", v);
            bedManager.update();
        });
    bedNameCtrl.show(s.bedPreset === "custom");

    folder
        .add(s, "showBedLabel")
        .name(t.bedShowLabel)
        .onChange((v) => {
            state.set("showBedLabel", v);
            bedManager.setLabelVisible(v);
        });
}

function buildEnvironmentFolder(t, s, controls) {
    const folder = gui.addFolder(t.fEnv);

    addDropdown(folder, s, "lighting", t.lights, (v) => {
        state.set("lighting", v);
        lightingManager.setup(v);
    }).name(t.lScheme);

    addDropdown(folder, s, "hdri", t.hdris, (v) => {
        state.set("hdri", v);
        environmentManager.loadHDRI(v);
    }).name(t.lHdri);

    const bgOptions = {
        [t.vColor]: "color",
        [t.vHdri]: "hdri",
    };

    let blurCtrl, colorCtrl;

    folder
        .add(s, "bgMode", bgOptions)
        .name(t.lBgType)
        .onChange((v) => {
            state.set("bgMode", v);
            environmentManager.updateBackground();
            blurCtrl.show(v === "hdri");
            colorCtrl.show(v === "color");
        });

    blurCtrl = folder
        .add(s, "bgBlur", 0, 1)
        .name(t.lBgBlur)
        .onChange((v) => {
            sceneManager.scene.backgroundBlurriness = v;
            state.set("bgBlur", v);
        });
    blurCtrl.show(s.bgMode === "hdri");

    colorCtrl = folder
        .addColor(s, "bgColor")
        .name(t.lBgCol)
        .onChange((v) => {
            state.set("bgColor", v);
            if (state.get("bgMode") === "color") {
                environmentManager.updateBackground();
            }
        });
    colorCtrl.show(s.bgMode === "color");
}

function buildSceneFolder(t, s, controls) {
    const folder = gui.addFolder(t.fScene);

    folder
        .add(s, "grid")
        .name(t.sGrid)
        .onChange((v) => {
            sceneManager.gridHelper.visible = v;
            state.set("grid", v);
        });

    folder
        .add(s, "shadows")
        .name(t.sShadow)
        .onChange((v) => {
            sceneManager.shadowPlane.visible = v;
            state.set("shadows", v);
        });

    folder
        .add(s, "autoRotate")
        .name(t.sAuto)
        .onChange((v) => {
            if (controls) controls.autoRotate = v;
            state.set("autoRotate", v);
        });
}

function buildOrientationFolder(t, app) {
    const folder = gui.addFolder(t.fOrient);
    const rot = state.rotation;

    const applyRot = () => modelManager.applyRotation();

    rotationControllers.x = folder
        .add(rot, "x", -180, 180, 5)
        .name("X°")
        .onChange(applyRot);
    rotationControllers.y = folder
        .add(rot, "y", -180, 180, 5)
        .name("Y°")
        .onChange(applyRot);
    rotationControllers.z = folder
        .add(rot, "z", -180, 180, 5)
        .name("Z°")
        .onChange(applyRot);

    const actions = {
        reset: () => {
            state.setRotation(0, 0, 0);
            updateOrientationDisplay();
            modelManager.applyRotation();
        },
        zUp: () => {
            const rot = state.rotation;
            const isZUp = rot.x === -90 && rot.y === 0 && rot.z === 0;

            if (isZUp) {
                state.restoreRotation();
            } else {
                state.saveRotation();
                state.setRotation(-90, 0, 0);
            }
            updateOrientationDisplay();
            modelManager.applyRotation();
        },
    };

    folder.add(actions, "reset").name(t.oReset);
    folder.add(actions, "zUp").name(t.oZUp);
}

function buildSettingsFolder(t) {
    const folder = gui.addFolder(t.fSettings);

    const actions = {
        resetAll: () => {
            if (confirm(t.confirmReset)) {
                storage.reset();
                showToast(t.toastReset, 2000, "success");
                setTimeout(() => window.location.reload(), 1500);
            }
        },
    };

    folder.add(actions, "resetAll").name(t.btnReset);
}
