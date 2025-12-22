import * as THREE from "three";
import {
    state,
    layerUniforms,
    updateState,
    updateStateMultiple,
} from "./state.js";
import { PRESETS_DATA } from "./constants.js";

export const material = new THREE.MeshPhysicalMaterial({
    color: state.color,
    roughness: state.roughness,
    metalness: state.metalness,
    clearcoat: state.clearcoat,
    clearcoatRoughness: state.clearcoatRoughness,
    transmission: state.transmission,
    thickness: state.thickness,
    ior: state.ior,
    sheen: state.sheen,
    sheenRoughness: state.sheenRoughness,
    side: THREE.DoubleSide,
    transparent: true,
});

material.onBeforeCompile = (shader) => {
    shader.uniforms.uLayerActive = layerUniforms.uLayerActive;
    shader.uniforms.uLayerHeight = layerUniforms.uLayerHeight;
    shader.uniforms.uLayerStrength = layerUniforms.uLayerStrength;

    shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
        varying float vWorldY;`
    );
    shader.vertexShader = shader.vertexShader.replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vWorldY = (modelMatrix * vec4(transformed, 1.0)).y;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
        uniform bool uLayerActive;
        uniform float uLayerHeight;
        uniform float uLayerStrength;
        varying float vWorldY;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        if (uLayerActive) {
            float k = 6.2831853 / uLayerHeight;
            float dys = cos(vWorldY * k); 
            float verticalFactor = 1.0 - abs(normal.y); 
            normal.y += dys * uLayerStrength * verticalFactor;
            normal = normalize(normal);
        }`
    );
};

export function applyPreset(id, gui = null) {
    const preset = PRESETS_DATA[id];
    if (!preset) return;

    if (preset.color) {
        material.color.set(preset.color);
    }

    const { color, ...presetProps } = preset;
    Object.assign(material, presetProps);

    const stateUpdates = {
        preset: id,
    };

    if (preset.color) {
        stateUpdates.color = preset.color;
    }

    const materialProps = [
        "roughness",
        "metalness",
        "clearcoat",
        "clearcoatRoughness",
        "sheen",
        "sheenRoughness",
        "transmission",
        "thickness",
        "ior",
    ];

    materialProps.forEach((prop) => {
        if (preset[prop] !== undefined) {
            stateUpdates[prop] = preset[prop];
        }
    });

    for (const [key, value] of Object.entries(stateUpdates)) {
        updateState(key, value);
    }

    if (gui) {
        const controllers = gui.controllersRecursive();
        controllers.forEach((c) => {
            if (c.object === state || c.object === material) {
                c.updateDisplay();
            }
        });
    }

    material.transparent = material.transmission > 0.01 || material.opacity < 1;
    material.needsUpdate = true;
}

export function updateMaterialProperty(property, value) {
    if (property in material) {
        material[property] = value;
        updateState(property, value);

        if (property === "transmission" || property === "opacity") {
            material.transparent =
                material.transmission > 0.01 || material.opacity < 1;
        }

        material.needsUpdate = true;
    }
}

export function syncMaterialWithState() {
    material.color.set(state.color);
    material.roughness = state.roughness;
    material.metalness = state.metalness;
    material.clearcoat = state.clearcoat;
    material.clearcoatRoughness = state.clearcoatRoughness;
    material.sheen = state.sheen;
    material.sheenRoughness = state.sheenRoughness;
    material.transmission = state.transmission;
    material.thickness = state.thickness;
    material.ior = state.ior;

    material.transparent = material.transmission > 0.01 || material.opacity < 1;
    material.needsUpdate = true;
}
