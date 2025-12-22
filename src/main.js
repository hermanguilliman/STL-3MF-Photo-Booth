import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { state } from "./core/StateManager.js";
import { globalEvents } from "./core/EventEmitter.js";
import { sceneManager } from "./managers/SceneManager.js";
import { materialManager } from "./managers/MaterialManager.js";
import { modelManager } from "./managers/ModelManager.js";
import { lightingManager } from "./managers/LightingManager.js";
import { environmentManager } from "./managers/EnvironmentManager.js";
import { bedManager } from "./managers/BedManager.js";
import { dimensionsManager } from "./managers/DimensionsManager.js";
import { screenshotManager } from "./managers/ScreenshotManager.js";
import { QualityManager, isMobile } from "./managers/QualityManager.js";
import { i18n } from "./i18n/LanguageManager.js";
import { showToast } from "./utils/helpers.js";
import { buildGui, updateOrientationDisplay } from "./gui/GUIBuilder.js";

class App {
    controls;
    #qualityManager;
    #lastDimUpdate = 0;
    #dimUpdateInterval;
    #isInitialized = false;

    constructor() {
        this.#dimUpdateInterval = isMobile ? 100 : 50;

        this.#setupControls();
        this.#setupQuality();

        requestAnimationFrame(() => {
            this.#setupEventListeners();
            this.#initScene();
            this.#createTestModel();
            this.#isInitialized = true;
            this.#animate();
        });
    }

    #setupControls() {
        const { camera, renderer } = sceneManager;

        this.controls = new OrbitControls(camera, renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = isMobile ? 0.1 : 0.08;
        this.controls.autoRotate = state.get("autoRotate");
        this.controls.autoRotateSpeed = isMobile ? 1 : 2;

        if (isMobile) {
            this.controls.rotateSpeed = 0.8;
            this.controls.zoomSpeed = 0.8;
            this.controls.panSpeed = 0.8;
        }
    }

    #setupQuality() {
        const { renderer, composer, saoPass, fxaaPass } = sceneManager;
        this.#qualityManager = new QualityManager(
            renderer,
            composer,
            saoPass,
            fxaaPass
        );
        sceneManager.setQualityManager(this.#qualityManager);
    }

    #initScene() {
        lightingManager.setup(state.get("lighting"));
        environmentManager.loadHDRI(state.get("hdri"));

        if (state.get("bedActive") && state.get("bedPreset") !== "none") {
            bedManager.update();
            document.getElementById("bedBtn")?.classList.add("active");
        }

        if (state.get("showDimensions")) {
            document.getElementById("dimBtn")?.classList.add("active");
            document.getElementById("dimLabels")?.classList.add("visible");
        }

        buildGui(this.controls, this);
    }

    #setupEventListeners() {
        const dropZone = document.getElementById("drop-zone");
        if (dropZone) {
            window.addEventListener("dragover", (e) => {
                e.preventDefault();
                dropZone.classList.add("active");
            });
            window.addEventListener("dragleave", () =>
                dropZone.classList.remove("active")
            );
            window.addEventListener("drop", (e) => {
                e.preventDefault();
                dropZone.classList.remove("active");
                if (e.dataTransfer.files[0])
                    this.#handleFile(e.dataTransfer.files[0]);
            });
        }

        document
            .getElementById("fileInput")
            ?.addEventListener("change", (e) => {
                if (e.target.files[0]) this.#handleFile(e.target.files[0]);
            });

        document
            .getElementById("screenshotSceneBtn")
            ?.addEventListener("click", () => screenshotManager.captureScene());
        document
            .getElementById("screenshotModelBtn")
            ?.addEventListener("click", () => screenshotManager.captureModel());
        document
            .getElementById("dimBtn")
            ?.addEventListener("click", () => dimensionsManager.toggle());
        document
            .getElementById("bedBtn")
            ?.addEventListener("click", () => this.#toggleBed());

        const helpBtn = document.getElementById("helpBtn");
        const helpContent = document.getElementById("helpContent");
        const langMenu = document.getElementById("langMenu");

        helpBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            helpContent?.classList.toggle("visible");
            langMenu?.classList.remove("visible");
        });

        document.addEventListener("click", () => {
            helpContent?.classList.remove("visible");
            langMenu?.classList.remove("visible");
        });

        document
            .getElementById("mobileZUp")
            ?.addEventListener("click", () => this.#toggleZUp());

        window.addEventListener("keydown", (e) => {
            if (e.target.tagName === "INPUT") return;
            const views = { 1: "iso", 2: "front", 3: "top", 4: "side" };
            if (views[e.key]) this.setView(views[e.key]);
        });

        globalEvents.on("model:transformed", () => {
            dimensionsManager.forceUpdate();
            if (state.get("bedActive")) bedManager.checkFit(false);
        });

        globalEvents.on("bed:fitChanged", ({ fits, changed }) => {
            const t = i18n.t;
            if (!fits) showToast(t.toastNoFit, 4000, "error");
            else if (changed) showToast(t.toastFits, 2000, "success");
        });

        globalEvents.on("language:change", () => buildGui(this.controls, this));

        document.addEventListener("visibilitychange", () => {
            this.controls.autoRotate = document.hidden
                ? false
                : state.get("autoRotate");
        });

        let resizeTimeout;
        window.addEventListener("resize", () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => sceneManager.handleResize(), 100);
        });
    }

    #toggleZUp() {
        const rot = state.rotation;
        const isZUp = rot.x === -90 && rot.y === 0 && rot.z === 0;
        const t = i18n.t;

        if (isZUp) {
            state.restoreRotation();
            showToast(t.toastZReset, 2000, "success");
        } else {
            state.saveRotation();
            state.setRotation(-90, 0, 0);
            showToast(t.toastZ, 2000, "success");
        }

        modelManager.applyRotation();
        updateOrientationDisplay();
    }

    async #handleFile(file) {
        const t = i18n.t;
        showToast(t.loading, 10000, "info");

        try {
            const name = await modelManager.loadFile(
                file,
                this.controls,
                this.setView.bind(this),
                t
            );
            showToast(`${t.toastLoaded}: ${name}`, 2500, "success");

            if (state.get("bedActive")) {
                setTimeout(() => bedManager.checkFit(true), 300);
            }
        } catch (e) {
            console.error(e);
            showToast(t.toastErr || e.message, 5000, "error");
        }
    }

    #toggleBed() {
        const active = !state.get("bedActive");
        state.set("bedActive", active);
        document.getElementById("bedBtn")?.classList.toggle("active", active);

        if (active) {
            const preset = state.get("lastActiveBedPreset") || "ender3";
            state.set("bedPreset", preset);
            bedManager.update();
            setTimeout(() => bedManager.checkFit(true), 100);
        } else {
            state.set("bedPreset", "none");
            bedManager.update();
        }

        buildGui(this.controls, this);
    }

    #createTestModel() {
        const segments = isMobile ? 100 : 150;
        const radial = isMobile ? 16 : 24;
        const geometry = new THREE.TorusKnotGeometry(10, 2.5, segments, radial);
        const mesh = new THREE.Mesh(geometry, materialManager.material);
        mesh.castShadow = mesh.receiveShadow = true;

        sceneManager.scene.add(mesh);
        modelManager.mesh = mesh;
        modelManager.placeOnFloor();
        modelManager.fitCamera(this.controls, this.setView.bind(this));

        if (state.get("bedActive")) {
            setTimeout(() => bedManager.checkFit(true), 500);
        }

        dimensionsManager.init();
    }

    setView(type, center = null, dim = null) {
        const mesh = modelManager.mesh;

        if (!center || !dim) {
            if (!mesh) return;
            const box = new THREE.Box3().setFromObject(mesh);
            center = box.getCenter(new THREE.Vector3());
            dim = Math.max(...box.getSize(new THREE.Vector3()).toArray());
        }

        const dist = dim * 1.8;
        this.controls.target.copy(center);
        const pos = center.clone();

        const offsets = {
            iso: new THREE.Vector3(dist, dist * 0.6, dist),
            front: new THREE.Vector3(0, 0, dist),
            top: new THREE.Vector3(0, dist, 0),
            side: new THREE.Vector3(dist, 0, 0),
        };

        pos.add(offsets[type] || offsets.iso);
        sceneManager.camera.position.copy(pos);
        sceneManager.camera.lookAt(center);
        sceneManager.updateShadows();
    }

    #animate() {
        requestAnimationFrame(() => this.#animate());

        this.controls.update();
        this.#qualityManager.update();

        const now = performance.now();
        if (now - this.#lastDimUpdate >= this.#dimUpdateInterval) {
            dimensionsManager.update();
            this.#lastDimUpdate = now;
        }

        sceneManager.render();
    }
}

const app = new App();

window.app = app;
window.setView = (type) => app.setView(type);
window.buildGui = () => buildGui(app.controls, app);
