import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { ThreeMFLoader } from "three/examples/jsm/loaders/3MFLoader.js";

import { scene, camera, lightGroup, saoPass, updateShadows } from "./scene.js";
import { state, rotationState, setSavedRotationState } from "./state.js";
import { material } from "./materials.js";
import { showToast } from "./utils.js";
import { translations, getCurLang } from "./language.js";
import { getMesh, setMesh } from "./meshStore.js";
import { checkModelFits } from "./bed.js";
import { forceUpdateDimensions } from "./dimensions.js";

const loaderSTL = new STLLoader();
const loader3MF = new ThreeMFLoader();

export function getCurrentMesh() {
    return getMesh();
}

export function setCurrentMesh(mesh) {
    setMesh(mesh);
}

export function placeOnFloor() {
    const currentMesh = getMesh();
    if (!currentMesh) return;

    currentMesh.position.y = 0;
    currentMesh.updateMatrixWorld(true);

    let minY = Infinity;

    currentMesh.traverse((child) => {
        if (child.isMesh && child.geometry) {
            child.updateMatrixWorld(true);

            const positionAttribute = child.geometry.attributes.position;
            const vertex = new THREE.Vector3();

            for (let i = 0; i < positionAttribute.count; i++) {
                vertex.fromBufferAttribute(positionAttribute, i);
                vertex.applyMatrix4(child.matrixWorld);

                if (vertex.y < minY) {
                    minY = vertex.y;
                }
            }
        }
    });

    if (!isFinite(minY)) {
        const box = new THREE.Box3().setFromObject(currentMesh);
        if (isFinite(box.min.y)) {
            minY = box.min.y;
        } else {
            return;
        }
    }

    currentMesh.position.y = -minY;
}

export function applyRotation() {
    const currentMesh = getMesh();
    if (!currentMesh) return;

    currentMesh.rotation.set(
        THREE.MathUtils.degToRad(rotationState.x),
        THREE.MathUtils.degToRad(rotationState.y),
        THREE.MathUtils.degToRad(rotationState.z)
    );

    placeOnFloor();

    if (typeof updateShadows === "function") {
        updateShadows();
    }

    forceUpdateDimensions();

    if (state.bedActive) {
        checkModelFits(false);
    }
}

export function fitCamera(object, controls, setViewFn) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim === 0) return;

    camera.near = maxDim / 100;
    camera.far = maxDim * 100;
    camera.updateProjectionMatrix();

    if (saoPass) {
        saoPass.params.saoScale = maxDim * 1.5;
        saoPass.params.saoKernelRadius = maxDim / 8;
    }

    setViewFn("iso", center, maxDim);

    lightGroup.children.forEach((light) => {
        if (light.isDirectionalLight || light.isSpotLight) {
            light.target.position.copy(center);
            const offset = light.position
                .clone()
                .normalize()
                .multiplyScalar(maxDim * 2.5);
            light.position.copy(center.clone().add(offset));

            if (light.isDirectionalLight) {
                const shadowSize = maxDim * 1.5;
                light.shadow.camera.left = -shadowSize;
                light.shadow.camera.right = shadowSize;
                light.shadow.camera.top = shadowSize;
                light.shadow.camera.bottom = -shadowSize;
                light.shadow.camera.near = 0.1;
                light.shadow.camera.far = maxDim * 5;
                light.shadow.bias = -0.0005;
            }
            light.shadow.camera.updateProjectionMatrix();
        }
    });

    setTimeout(() => {
        forceUpdateDimensions();
    }, 100);
}

export function handleFile(file, controls, setViewFn) {
    const reader = new FileReader();
    const is3MF = file.name.toLowerCase().endsWith(".3mf");
    const isSTL = file.name.toLowerCase().endsWith(".stl");
    const t = translations[getCurLang()];

    if (!is3MF && !isSTL) {
        showToast(t.toastErr, 5000, "error");
        return;
    }
    showToast(t.loading, 10000, "info");

    reader.onload = (ev) => {
        const buffer = ev.target && ev.target.result;

        try {
            const oldMesh = getMesh();
            if (oldMesh) {
                scene.remove(oldMesh);
                if (oldMesh.geometry) oldMesh.geometry.dispose();
            }

            let newMesh = null;

            if (isSTL) {
                const geometry = loaderSTL.parse(buffer);
                geometry.center();
                geometry.computeVertexNormals();
                newMesh = new THREE.Mesh(geometry, material);
            } else if (is3MF) {
                const group = loader3MF.parse(buffer);

                if (!group || typeof group.traverse !== "function") {
                    throw new Error("3MF parse returned invalid object");
                }

                group.rotation.x = -Math.PI / 2;
                group.updateMatrixWorld();
                group.traverse((child) => {
                    if (child.isMesh) {
                        child.material = material;
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.geometry) {
                            child.geometry.deleteAttribute("normal");
                            child.geometry.computeVertexNormals();
                        }
                    }
                });

                const box = new THREE.Box3().setFromObject(group);
                const center = box.getCenter(new THREE.Vector3());
                group.position.x = -center.x;
                group.position.y = 0;
                group.position.z = -center.z;

                const wrapper = new THREE.Group();
                wrapper.add(group);
                newMesh = wrapper;
            }

            if (!newMesh) {
                throw new Error("Empty model after parsing");
            }

            if (newMesh.isMesh) {
                newMesh.castShadow = true;
                newMesh.receiveShadow = true;
            }

            rotationState.x = 0;
            rotationState.y = 0;
            rotationState.z = 0;
            setSavedRotationState(0, 0, 0);

            scene.add(newMesh);
            setMesh(newMesh);

            applyRotation();
            fitCamera(newMesh, controls, setViewFn);

            showToast(`${t.toastLoaded}: ${file.name}`, 2500, "success");

            if (state.bedActive) {
                setTimeout(() => {
                    checkModelFits(true);
                }, 300);
            }
        } catch (err) {
            console.error("Error while parsing model file:", err);
            showToast(t.toastFileError || t.toastErr, 7000, "error");
        }
    };
    reader.readAsArrayBuffer(file);
}
