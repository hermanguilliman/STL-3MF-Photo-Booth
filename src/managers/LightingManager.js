import * as THREE from "three";
import { sceneManager } from "./SceneManager.js";
import { isMobile, QualityManager } from "./QualityManager.js";

const deg = THREE.MathUtils.degToRad;

class LightingManager {
    #modes = {
        studio: () => this.#createStudio(),
        warm: () => this.#createWarm(),
        cyber: () => this.#createCyber(),
        soft: () => this.#createSoft(),
        contrast: () => this.#createContrast(),
        north: () => this.#createNorth(),
        ring: () => this.#createRing(),
        night: () => this.#createNight(),
    };

    setup(modeId) {
        const { lightGroup } = sceneManager;

        while (lightGroup.children.length) {
            const child = lightGroup.children[0];
            child.shadow?.map?.dispose();
            lightGroup.remove(child);
        }

        const create = this.#modes[modeId];
        if (!create) return console.warn(`Unknown lighting: ${modeId}`);

        lightGroup.add(...create());
        sceneManager.updateShadows();
    }

    #shadowLight(light) {
        const settings = QualityManager.instance?.settings || {
            shadowsEnabled: true,
            shadowMapSize: 1024,
        };
        if (!settings.shadowsEnabled) return light;

        light.castShadow = true;
        light.shadow.mapSize.setScalar(settings.shadowMapSize);
        light.shadow.bias = -0.0001;

        light.shadow.normalBias = 0.05;

        if (isMobile) light.shadow.radius = 2;
        return light;
    }

    #createStudio() {
        const key = this.#shadowLight(
            new THREE.DirectionalLight(0xffffff, 2.0)
        );
        key.position.set(50, 80, 50);

        const fill = new THREE.DirectionalLight(0xeef2ff, 0.8);
        fill.position.set(-50, 20, 20);

        const lights = [key, fill];
        if (!isMobile) {
            const rim = new THREE.SpotLight(0xffffff, 3.0);
            rim.position.set(0, 60, -80);
            lights.push(rim);
        }
        return lights;
    }

    #createWarm() {
        const sun = this.#shadowLight(
            new THREE.DirectionalLight(0xffaa77, 2.0)
        );
        sun.position.set(80, 40, 80);
        return [sun, new THREE.HemisphereLight(0xffccaa, 0x553322, 0.8)];
    }

    #createCyber() {
        const key = this.#shadowLight(
            new THREE.DirectionalLight(0x00d2ff, 2.0)
        );
        key.position.set(50, 80, 50);

        const rim = new THREE.SpotLight(0xff00ff, isMobile ? 4 : 8);
        rim.position.set(-50, 50, -50);
        return [key, rim];
    }

    #createSoft() {
        const dir = this.#shadowLight(
            new THREE.DirectionalLight(0xffffff, 0.8)
        );
        dir.position.set(10, 80, 20);
        return [new THREE.AmbientLight(0xffffff, 0.7), dir];
    }

    #createContrast() {
        const key = this.#shadowLight(
            new THREE.SpotLight(0xffffff, isMobile ? 3 : 4, 400, deg(25), 0.4)
        );
        key.position.set(120, 120, 40);

        const fill = new THREE.DirectionalLight(0x99aab5, 0.3);
        fill.position.set(-80, 30, -40);

        const lights = [key, fill];
        if (!isMobile) {
            const rim = new THREE.DirectionalLight(0xfff2d0, 1.4);
            rim.position.set(-40, 60, 140);
            lights.push(rim);
        }
        return lights;
    }

    #createNorth() {
        const sun = this.#shadowLight(
            new THREE.DirectionalLight(0xcbe3ff, 0.9)
        );
        sun.position.set(-30, 120, -60);

        const lights = [
            new THREE.HemisphereLight(0xd8ecff, 0x223344, 1.2),
            sun,
        ];
        if (!isMobile) {
            const bounce = new THREE.DirectionalLight(0x8ab6d6, 0.4);
            bounce.position.set(80, -20, 40);
            lights.push(bounce);
        }
        return lights;
    }

    #createRing() {
        const settings = QualityManager.instance?.settings || {
            shadowsEnabled: true,
            shadowMapSize: 1024,
        };

        const ring = new THREE.PointLight(0xffffff, 2.5, 400);
        ring.position.set(0, 40, 90);
        if (settings.shadowsEnabled) {
            ring.castShadow = true;
            ring.shadow.mapSize.setScalar(settings.shadowMapSize);
        }

        const top = new THREE.PointLight(0xfff6e5, 1.4, 500);
        top.position.set(0, 140, 0);

        const lights = [ring, top];
        if (!isMobile) {
            const floor = new THREE.SpotLight(0x77c0ff, 2.5, 350, deg(50), 0.6);
            floor.position.set(0, -60, 0);
            floor.target.position.set(0, 0, 0);
            lights.push(floor, floor.target);
        }
        return lights;
    }

    #createNight() {
        const neon1 = this.#shadowLight(
            new THREE.SpotLight(0x46c9ff, isMobile ? 3 : 5, 500, deg(35), 0.5)
        );
        neon1.position.set(80, 30, -80);

        const neon2 = new THREE.SpotLight(
            0xff5ef8,
            isMobile ? 2.5 : 4,
            500,
            deg(40),
            0.5
        );
        neon2.position.set(-70, 20, 90);

        const lights = [neon1, neon2];
        if (!isMobile) {
            const settings = QualityManager.instance?.settings;
            neon2.castShadow = true;
            neon2.shadow.mapSize.setScalar(settings?.shadowMapSize || 1024);

            const glow = new THREE.PointLight(0x2244ff, 0.8, 600);
            glow.position.set(0, 140, 0);
            lights.push(glow);
        }
        return lights;
    }
}

export const lightingManager = new LightingManager();
