import * as THREE from "three";
import { state } from "../core/StateManager.js";
import { MATERIAL_PRESETS } from "../core/constants.js";

class MaterialManager {
    material;
    #materialProps = [
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

    constructor() {
        this.material = new THREE.MeshPhysicalMaterial({
            color: state.get("color"),
            roughness: state.get("roughness"),
            metalness: state.get("metalness"),
            clearcoat: state.get("clearcoat"),
            clearcoatRoughness: state.get("clearcoatRoughness"),
            transmission: state.get("transmission"),
            thickness: state.get("thickness"),
            ior: state.get("ior"),
            sheen: state.get("sheen"),
            sheenRoughness: state.get("sheenRoughness"),
            side: THREE.DoubleSide,
            transparent: true,
        });

        this.#injectLayerShader();
    }

    #injectLayerShader() {
        const uniforms = state.layerUniforms;

        this.material.onBeforeCompile = (shader) => {
            shader.uniforms.uLayerActive = uniforms.uLayerActive;
            shader.uniforms.uLayerHeight = uniforms.uLayerHeight;
            shader.uniforms.uLayerStrength = uniforms.uLayerStrength;

            shader.vertexShader = shader.vertexShader
                .replace(
                    "#include <common>",
                    `#include <common>\nvarying float vWorldY;`
                )
                .replace(
                    "#include <worldpos_vertex>",
                    `#include <worldpos_vertex>\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;`
                );

            shader.fragmentShader = shader.fragmentShader
                .replace(
                    "#include <common>",
                    `#include <common>
                    uniform bool uLayerActive;
                    uniform float uLayerHeight;
                    uniform float uLayerStrength;
                    varying float vWorldY;`
                )
                .replace(
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
    }

    applyPreset(id) {
        const preset = MATERIAL_PRESETS[id];
        if (!preset) return;

        if (preset.color) this.material.color.set(preset.color);

        const updates = { preset: id };
        if (preset.color) updates.color = preset.color;

        this.#materialProps.forEach((prop) => {
            if (preset[prop] !== undefined) {
                this.material[prop] = preset[prop];
                updates[prop] = preset[prop];
            }
        });

        state.setMultiple(updates);
        this.#updateTransparency();
    }

    setProperty(prop, value) {
        if (prop in this.material) {
            this.material[prop] = value;
            state.set(prop, value);
            this.#updateTransparency();
        }
    }

    setColor(color) {
        this.material.color.set(color);
        state.set("color", color);
    }

    #updateTransparency() {
        this.material.transparent =
            this.material.transmission > 0.01 || this.material.opacity < 1;
        this.material.needsUpdate = true;
    }
}

export const materialManager = new MaterialManager();
