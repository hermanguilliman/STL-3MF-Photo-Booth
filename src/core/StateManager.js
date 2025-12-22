import { EventEmitter } from "./EventEmitter.js";
import { storage, DEFAULT_SETTINGS } from "./StorageManager.js";

class StateManager extends EventEmitter {
    #state;
    #layerUniforms;
    #rotation = { x: 0, y: 0, z: 0 };
    #savedRotation = { x: 0, y: 0, z: 0 };

    constructor() {
        super();
        const saved = storage.load();
        this.#state = { ...saved };
        this.#layerUniforms = {
            uLayerActive: { value: this.#state.layerActive },
            uLayerHeight: { value: this.#state.layerHeight },
            uLayerStrength: { value: this.#state.layerStrength },
        };
    }

    get(key) {
        return this.#state[key];
    }

    getAll() {
        return { ...this.#state };
    }

    set(key, value, save = true) {
        if (!(key in this.#state)) return;

        const oldValue = this.#state[key];
        this.#state[key] = value;

        if (save) storage.save(key, value);
        this.emit("change", { key, value, oldValue });
        this.emit(`change:${key}`, { value, oldValue });
    }

    setMultiple(updates, save = true) {
        Object.entries(updates).forEach(([key, value]) => {
            if (key in this.#state) this.#state[key] = value;
        });
        if (save) storage.saveMultiple(updates);
        this.emit("change:multiple", updates);
    }

    get layerUniforms() {
        return this.#layerUniforms;
    }

    updateLayerUniform(key, value) {
        if (this.#layerUniforms[key]) {
            this.#layerUniforms[key].value = value;
        }
    }

    get rotation() {
        return this.#rotation;
    }

    setRotation(x, y, z) {
        Object.assign(this.#rotation, { x, y, z });
        this.emit("rotation:change", this.#rotation);
    }

    get savedRotation() {
        return { ...this.#savedRotation };
    }

    saveRotation() {
        Object.assign(this.#savedRotation, this.#rotation);
    }

    restoreRotation() {
        Object.assign(this.#rotation, this.#savedRotation);
        this.emit("rotation:change", this.#rotation);
    }

    get defaults() {
        return DEFAULT_SETTINGS;
    }
}

export const state = new StateManager();
