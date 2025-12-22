import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SAOPass } from "three/examples/jsm/postprocessing/SAOPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

import { state } from "../core/StateManager.js";
import { getInitialQuality, isMobile } from "./QualityManager.js";

class SceneManager {
    scene;
    camera;
    renderer;
    composer;
    saoPass;
    fxaaPass;
    lightGroup;
    gridHelper;
    shadowPlane;
    #qualityManager = null;

    constructor() {
        const quality = getInitialQuality();

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(state.get("bgColor"));

        this.camera = new THREE.PerspectiveCamera(
            40,
            innerWidth / innerHeight,
            0.1,
            10000
        );
        this.camera.position.set(50, 50, 80);

        this.renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: isMobile ? "low-power" : "high-performance",
            logarithmicDepthBuffer: !isMobile,
        });

        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.setPixelRatio(quality.pixelRatio);
        this.renderer.shadowMap.enabled = quality.shadowsEnabled;
        this.renderer.shadowMap.type = isMobile
            ? THREE.BasicShadowMap
            : THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;

        if (isMobile) {
            this.renderer.shadowMap.autoUpdate = false;
            this.renderer.shadowMap.needsUpdate = true;
        }

        document.body.appendChild(this.renderer.domElement);

        this.#setupLightGroup();
        this.#setupPostProcessing(quality);
        this.#setupGrid();
        this.#setupShadowPlane(quality);
        this.#setupCameraLight();

        window.addEventListener("resize", () => this.handleResize());
    }

    #setupLightGroup() {
        this.lightGroup = new THREE.Group();
        this.scene.add(this.lightGroup);
    }

    #setupPostProcessing(quality) {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        this.saoPass = new SAOPass(this.scene, this.camera, false, true);
        this.saoPass.enabled = quality.saoEnabled;
        Object.assign(this.saoPass.params, {
            saoBias: 0.5,
            saoIntensity: quality.saoIntensity || 0.03,
            saoScale: quality.saoScale || 50,
            saoKernelRadius: isMobile ? 10 : 20,
            saoBlurRadius: isMobile ? 4 : 8,
        });
        this.composer.addPass(this.saoPass);

        this.fxaaPass = new ShaderPass(FXAAShader);
        this.fxaaPass.enabled = quality.fxaaEnabled;
        const pr = this.renderer.getPixelRatio();
        this.fxaaPass.material.uniforms.resolution.value.set(
            1 / (innerWidth * pr),
            1 / (innerHeight * pr)
        );
        this.composer.addPass(this.fxaaPass);

        this.composer.addPass(new OutputPass());
    }

    #setupGrid() {
        const divisions = isMobile ? 50 : 100;
        this.gridHelper = new THREE.GridHelper(
            2000,
            divisions,
            0x888888,
            0x444444
        );
        this.gridHelper.position.y = 0;
        this.gridHelper.renderOrder = 1;
        this.gridHelper.visible = state.get("grid");
        this.scene.add(this.gridHelper);
    }

    #setupShadowPlane(quality) {
        this.shadowPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(4000, 4000),
            new THREE.ShadowMaterial({
                opacity: isMobile ? 0.1 : 0.15,
                color: 0x000000,
            })
        );
        this.shadowPlane.rotation.x = -Math.PI / 2;
        this.shadowPlane.position.y = -0.01;
        this.shadowPlane.receiveShadow = quality.shadowsEnabled;
        this.shadowPlane.renderOrder = 0;
        this.shadowPlane.visible = state.get("shadows");
        this.scene.add(this.shadowPlane);
    }

    #setupCameraLight() {
        const light = new THREE.PointLight(0xffffff, 0.15);
        this.camera.add(light);
        this.scene.add(this.camera);
    }

    setQualityManager(qm) {
        this.#qualityManager = qm;
    }

    handleResize() {
        const { innerWidth: w, innerHeight: h } = window;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.composer.setSize(w, h);

        if (this.fxaaPass.enabled) {
            const pr = this.renderer.getPixelRatio();
            this.fxaaPass.material.uniforms.resolution.value.set(
                1 / (w * pr),
                1 / (h * pr)
            );
        }
    }

    updateGridColor(bgColor) {
        const col = new THREE.Color(bgColor);
        const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;

        this.scene.remove(this.gridHelper);
        const divisions = isMobile ? 50 : 100;
        const colors = lum < 0.5 ? [0x888888, 0x444444] : [0xaaaaaa, 0xdddddd];

        this.gridHelper = new THREE.GridHelper(2000, divisions, ...colors);
        this.gridHelper.position.y = 0;
        this.gridHelper.visible = state.get("grid");
        this.gridHelper.renderOrder = 1;
        this.scene.add(this.gridHelper);
    }

    updateShadows() {
        if (isMobile && this.renderer.shadowMap.enabled) {
            this.renderer.shadowMap.needsUpdate = true;
        }
    }

    render() {
        this.composer.render();
    }
}

export const sceneManager = new SceneManager();
