import { storage } from "../core/StorageManager.js";
import { globalEvents } from "../core/EventEmitter.js";
import { translations } from "./langs";

class LanguageManager {
    #currentLang = "ru";

    constructor() {
        this.detect();
    }

    get t() {
        return translations[this.#currentLang];
    }

    get lang() {
        return this.#currentLang;
    }

    detect() {
        const saved = storage.load().language;
        if (saved && translations[saved]) {
            return this.set(saved);
        }

        let code = navigator.language.slice(0, 2).toLowerCase();
        if (code === "zh") code = "cn";
        if (code === "ja") code = "jp";

        this.set(translations[code] ? code : "en");
    }

    set(lang) {
        if (!translations[lang]) return;

        this.#currentLang = lang;
        storage.save("language", lang);

        document.getElementById("langMenu")?.classList.remove("visible");

        const flag = document.getElementById("currentFlag");
        if (flag) flag.innerHTML = this.t.flag;

        document.querySelectorAll("[data-lang]").forEach((el) => {
            const key = el.getAttribute("data-lang");
            if (this.t[key]) el.innerText = this.t[key];
        });

        const loader = document.getElementById("loaderText");
        if (loader) loader.innerText = this.t.loading;

        globalEvents.emit("language:change", lang);
    }
}

export const i18n = new LanguageManager();

window.setLanguage = (lang) => i18n.set(lang);
