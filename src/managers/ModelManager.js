import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

import { sceneManager } from "./SceneManager.js";
import { materialManager } from "./MaterialManager.js";
import { state } from "../core/StateManager.js";
import { globalEvents } from "../core/EventEmitter.js";

class ModelManager {
    #mesh = null;
    #loaderSTL = new STLLoader();
    #loader3MF = new ThreeMFLoader();

    get mesh() {
        return this.#mesh;
    }

    set mesh(value) {
        this.#disposeCurrentModel();

        this.#mesh = value;
        sceneManager.scene.add(value);
        globalEvents.emit("mesh:change", value);
    }

    #disposeCurrentModel() {
        if (!this.#mesh) return;

        sceneManager.scene.remove(this.#mesh);

        this.#mesh.traverse((node) => {
            if (node.isMesh) {
                node.geometry?.dispose();

                if (
                    node.material &&
                    node.material !== materialManager.material
                ) {
                    if (Array.isArray(node.material)) {
                        node.material.forEach((m) => m.dispose());
                    } else {
                        node.material.dispose();
                    }
                }
            }
        });

        this.#mesh = null;
    }

    placeOnFloor() {
        if (!this.#mesh) return;

        this.#mesh.position.y = 0;
        this.#mesh.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(this.#mesh);

        if (isFinite(box.min.y)) {
            this.#mesh.position.y = -box.min.y;
        }
    }

    applyRotation() {
        if (!this.#mesh) return;

        const { x, y, z } = state.rotation;
        this.#mesh.rotation.set(
            THREE.MathUtils.degToRad(x),
            THREE.MathUtils.degToRad(y),
            THREE.MathUtils.degToRad(z)
        );

        this.placeOnFloor();
        sceneManager.updateShadows();
        globalEvents.emit("model:transformed");
    }

    fitCamera(controls, setViewFn) {
        if (!this.#mesh) return;

        const box = new THREE.Box3().setFromObject(this.#mesh);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        if (maxDim === 0) return;

        const { camera, saoPass, lightGroup } = sceneManager;

        camera.near = maxDim / 100;
        camera.far = maxDim * 100;
        camera.updateProjectionMatrix();

        if (saoPass) {
            saoPass.params.saoScale = maxDim * 1.5;
            saoPass.params.saoKernelRadius = maxDim / 8;
        }

        setViewFn("iso", center, maxDim);

        lightGroup.children.forEach((light) => {
            if (!light.isDirectionalLight && !light.isSpotLight) return;

            light.target.position.copy(center);
            const offset = light.position
                .clone()
                .normalize()
                .multiplyScalar(maxDim * 2.5);
            light.position.copy(center.clone().add(offset));

            if (light.isDirectionalLight) {
                const shadowSize = maxDim * 1.5;
                Object.assign(light.shadow.camera, {
                    left: -shadowSize,
                    right: shadowSize,
                    top: shadowSize,
                    bottom: -shadowSize,
                    near: 0.1,
                    far: maxDim * 5,
                });
                light.shadow.bias = -0.0005;
            }
            light.shadow.camera.updateProjectionMatrix();
        });

        setTimeout(() => globalEvents.emit("model:transformed"), 100);
    }

    async loadFile(file, controls, setViewFn, t) {
        const ext = file.name.toLowerCase().split(".").pop();

        if (!["stl", "3mf"].includes(ext)) {
            throw new Error(t.toastErr);
        }

        const buffer = await this.#readFile(file);

        const newMesh =
            ext === "stl" ? this.#parseSTL(buffer) : this.#parse3MF(buffer);

        if (!newMesh) throw new Error("Empty model");

        state.setRotation(0, 0, 0);
        state.saveRotation();

        this.mesh = newMesh;

        this.applyRotation();
        this.fitCamera(controls, setViewFn);

        return file.name;
    }

    #readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    #parseSTL(buffer) {
        const geometry = this.#loaderSTL.parse(buffer);

        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, materialManager.material);
        mesh.castShadow = mesh.receiveShadow = true;

        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        mesh.geometry.translate(-center.x, -center.y, -center.z);

        return mesh;
    }

    #parse3MF(buffer) {
        const group = this.#loader3MF.parse(buffer);
        if (!group?.traverse) throw new Error("Invalid 3MF");

        group.rotation.x = -Math.PI / 2;
        group.updateMatrixWorld();

        group.traverse((child) => {
            if (!child.isMesh) return;
            child.material = materialManager.material;
            child.castShadow = child.receiveShadow = true;
            if (child.geometry) {
                child.geometry.deleteAttribute("normal");
                child.geometry.computeVertexNormals();
            }
        });

        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());

        const wrapper = new THREE.Group();
        wrapper.add(group);

        group.position.set(-center.x, 0, -center.z);

        return wrapper;
    }
}

export const modelManager = new ModelManager();
