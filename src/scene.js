import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { SAOPass } from "three/examples/jsm/postprocessing/SAOPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { FXAAShader } from "three/examples/jsm/shaders/FXAAShader.js";

import { state } from "./state.js";
import { getQualitySettings, isMobile } from "./quality.js";

const qualitySettings = getQualitySettings();
console.log("[Scene] Quality settings:", qualitySettings);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(state.bgColor);

export const camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
);
camera.position.set(50, 50, 80);

export const renderer = new THREE.WebGLRenderer({
    antialias: qualitySettings.antialias,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: isMobile ? "low-power" : "high-performance",
    logarithmicDepthBuffer: !isMobile,
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(qualitySettings.pixelRatio);
renderer.shadowMap.enabled = qualitySettings.shadowsEnabled;
renderer.shadowMap.type = isMobile
    ? THREE.BasicShadowMap
    : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

if (isMobile) {
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
}

document.body.appendChild(renderer.domElement);

export const lightGroup = new THREE.Group();
scene.add(lightGroup);

const cameraLight = new THREE.PointLight(0xffffff, 0.15);
camera.add(cameraLight);
scene.add(camera);

export const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

export const saoPass = new SAOPass(scene, camera, false, true);
saoPass.enabled = qualitySettings.saoEnabled;
Object.assign(saoPass.params, {
    saoBias: 0.5,
    saoIntensity: qualitySettings.saoIntensity,
    saoScale: qualitySettings.saoScale,
    saoKernelRadius: isMobile ? 10 : 20,
    saoBlurRadius: isMobile ? 4 : 8,
});
composer.addPass(saoPass);

export const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.enabled = qualitySettings.fxaaEnabled;
const pixelRatio = renderer.getPixelRatio();
fxaaPass.material.uniforms["resolution"].value.set(
    1 / (window.innerWidth * pixelRatio),
    1 / (window.innerHeight * pixelRatio)
);
composer.addPass(fxaaPass);

composer.addPass(new OutputPass());

export let gridHelper = new THREE.GridHelper(
    2000,
    isMobile ? 50 : 100,
    0x888888,
    0x444444
);
gridHelper.position.y = 0;
gridHelper.renderOrder = 1;
scene.add(gridHelper);

export const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.ShadowMaterial({
        opacity: isMobile ? 0.1 : 0.15,
        color: 0x000000,
    })
);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -0.01;
plane.receiveShadow = qualitySettings.shadowsEnabled;
plane.renderOrder = 0;
scene.add(plane);

export function updateGridColor(bgColor) {
    const col = new THREE.Color(bgColor);
    const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
    scene.remove(gridHelper);

    const divisions = isMobile ? 50 : 100;
    if (lum < 0.5) {
        gridHelper = new THREE.GridHelper(2000, divisions, 0x888888, 0x444444);
    } else {
        gridHelper = new THREE.GridHelper(2000, divisions, 0xaaaaaa, 0xdddddd);
    }
    gridHelper.position.y = 0;
    gridHelper.visible = state.grid;
    gridHelper.renderOrder = 1;
    scene.add(gridHelper);
}

export function handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);

    if (fxaaPass.enabled) {
        const pr = renderer.getPixelRatio();
        fxaaPass.material.uniforms["resolution"].value.set(
            1 / (w * pr),
            1 / (h * pr)
        );
    }
}

export function updateShadows() {
    if (isMobile && renderer.shadowMap.enabled) {
        renderer.shadowMap.needsUpdate = true;
    }
}
