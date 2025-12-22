import * as THREE from "three";
import { lightGroup, updateShadows } from "./scene.js";
import { isMobile, getQualitySettings } from "./quality.js";

const qualitySettings = getQualitySettings();

function createShadowLight(light) {
    if (!qualitySettings.shadowsEnabled) return;

    light.castShadow = true;
    light.shadow.mapSize.set(
        qualitySettings.shadowMapSize,
        qualitySettings.shadowMapSize
    );
    light.shadow.bias = -0.0001;

    if (isMobile) {
        light.shadow.radius = 2;
    }
}

export function setupLighting(modeId) {
    while (lightGroup.children.length > 0) {
        const child = lightGroup.children[0];
        if (child.shadow && child.shadow.map) {
            child.shadow.map.dispose();
        }
        lightGroup.remove(child);
    }

    if (modeId === "studio") {
        const key = new THREE.DirectionalLight(0xffffff, 2.0);
        key.position.set(50, 80, 50);
        createShadowLight(key);

        const fill = new THREE.DirectionalLight(0xeef2ff, 0.8);
        fill.position.set(-50, 20, 20);

        if (!isMobile) {
            const rim = new THREE.SpotLight(0xffffff, 3.0);
            rim.position.set(0, 60, -80);
            lightGroup.add(rim);
        }

        lightGroup.add(key, fill);
    } else if (modeId === "warm") {
        const sun = new THREE.DirectionalLight(0xffaa77, 2.0);
        sun.position.set(80, 40, 80);
        createShadowLight(sun);

        const amb = new THREE.HemisphereLight(0xffccaa, 0x553322, 0.8);
        lightGroup.add(sun, amb);
    } else if (modeId === "cyber") {
        const key = new THREE.DirectionalLight(0x00d2ff, 2.0);
        key.position.set(50, 80, 50);
        createShadowLight(key);

        const rim = new THREE.SpotLight(0xff00ff, isMobile ? 4.0 : 8.0);
        rim.position.set(-50, 50, -50);

        lightGroup.add(key, rim);
    } else if (modeId === "soft") {
        const amb = new THREE.AmbientLight(0xffffff, 0.7);
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(10, 80, 20);
        createShadowLight(dir);

        lightGroup.add(amb, dir);
    } else if (modeId === "contrast") {
        const key = new THREE.SpotLight(
            0xffffff,
            isMobile ? 3.0 : 4.0,
            400,
            THREE.MathUtils.degToRad(25),
            0.4
        );
        key.position.set(120, 120, 40);
        createShadowLight(key);

        const fill = new THREE.DirectionalLight(0x99aab5, 0.3);
        fill.position.set(-80, 30, -40);

        lightGroup.add(key, fill);

        if (!isMobile) {
            const rim = new THREE.DirectionalLight(0xfff2d0, 1.4);
            rim.position.set(-40, 60, 140);
            lightGroup.add(rim);
        }
    } else if (modeId === "north") {
        const hemi = new THREE.HemisphereLight(0xd8ecff, 0x223344, 1.2);
        const sun = new THREE.DirectionalLight(0xcbe3ff, 0.9);
        sun.position.set(-30, 120, -60);
        createShadowLight(sun);

        lightGroup.add(hemi, sun);

        if (!isMobile) {
            const bounce = new THREE.DirectionalLight(0x8ab6d6, 0.4);
            bounce.position.set(80, -20, 40);
            lightGroup.add(bounce);
        }
    } else if (modeId === "ring") {
        const ring = new THREE.PointLight(0xffffff, 2.5, 400);
        ring.position.set(0, 40, 90);

        if (qualitySettings.shadowsEnabled) {
            ring.castShadow = true;
            ring.shadow.mapSize.set(
                qualitySettings.shadowMapSize,
                qualitySettings.shadowMapSize
            );
        }

        const top = new THREE.PointLight(0xfff6e5, 1.4, 500);
        top.position.set(0, 140, 0);

        lightGroup.add(ring, top);

        if (!isMobile) {
            const floor = new THREE.SpotLight(
                0x77c0ff,
                2.5,
                350,
                THREE.MathUtils.degToRad(50),
                0.6
            );
            floor.position.set(0, -60, 0);
            floor.target.position.set(0, 0, 0);
            lightGroup.add(floor, floor.target);
        }
    } else if (modeId === "night") {
        const neon1 = new THREE.SpotLight(
            0x46c9ff,
            isMobile ? 3.0 : 5.0,
            500,
            THREE.MathUtils.degToRad(35),
            0.5
        );
        neon1.position.set(80, 30, -80);
        createShadowLight(neon1);

        const neon2 = new THREE.SpotLight(
            0xff5ef8,
            isMobile ? 2.5 : 4.0,
            500,
            THREE.MathUtils.degToRad(40),
            0.5
        );
        neon2.position.set(-70, 20, 90);

        lightGroup.add(neon1, neon2);

        if (!isMobile) {
            neon2.castShadow = true;
            neon2.shadow.mapSize.set(
                qualitySettings.shadowMapSize,
                qualitySettings.shadowMapSize
            );

            const glow = new THREE.PointLight(0x2244ff, 0.8, 600);
            glow.position.set(0, 140, 0);
            lightGroup.add(glow);
        }
    }

    updateShadows();
}
