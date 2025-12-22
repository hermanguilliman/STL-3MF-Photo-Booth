export class EventEmitter {
    #listeners = new Map();

    on(event, callback) {
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, new Set());
        }
        this.#listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        this.#listeners.get(event)?.delete(callback);
    }

    emit(event, data) {
        this.#listeners.get(event)?.forEach((cb) => cb(data));
    }

    once(event, callback) {
        const wrapper = (data) => {
            callback(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
}

export const globalEvents = new EventEmitter();
