import { i18n } from "../i18n/LanguageManager.js";

class ProgressManager {
    #overlay = null;
    #fill = null;
    #text = null;
    #title = null;
    #isVisible = false;

    constructor() {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => this.#init());
        } else {
            this.#init();
        }
    }

    #init() {
        this.#overlay = document.getElementById("progressOverlay");
        this.#fill = document.getElementById("progressFill");
        this.#text = document.getElementById("progressText");
        this.#title = this.#overlay?.querySelector(".progress-title");
    }

    show(filename = "") {
        if (!this.#overlay) this.#init();
        if (!this.#overlay) return;

        const t = i18n.t;
        const displayName = filename
            ? `${t.loading || "Loading"} ${this.#truncate(filename, 30)}`
            : t.loading || "Loading...";

        if (this.#title) this.#title.textContent = displayName;
        if (this.#fill) {
            this.#fill.style.width = "0%";
            this.#fill.classList.remove("indeterminate");
        }
        if (this.#text) this.#text.textContent = "0%";

        this.#overlay.classList.add("visible");
        this.#isVisible = true;
    }

    update(progress, stage = "") {
        if (!this.#isVisible) return;

        const percent = Math.min(100, Math.max(0, Math.round(progress)));

        if (this.#fill) {
            this.#fill.classList.remove("indeterminate");
            this.#fill.style.width = `${percent}%`;
        }

        if (this.#text) {
            const stageText = stage ? ` — ${stage}` : "";
            this.#text.textContent = `${percent}%${stageText}`;
        }
    }

    setIndeterminate(stage = "") {
        if (!this.#isVisible) return;

        if (this.#fill) {
            this.#fill.classList.add("indeterminate");
        }

        if (this.#text) {
            this.#text.textContent = stage || "Processing...";
        }
    }

    hide() {
        if (!this.#overlay) return;

        if (this.#fill) {
            this.#fill.classList.remove("indeterminate");
            this.#fill.style.width = "100%";
        }
        if (this.#text) this.#text.textContent = "100%";

        setTimeout(() => {
            this.#overlay.classList.remove("visible");
            this.#isVisible = false;
        }, 300);
    }

    hideImmediately() {
        if (!this.#overlay) return;
        this.#overlay.classList.remove("visible");
        this.#isVisible = false;
    }

    #truncate(str, maxLength) {
        if (str.length <= maxLength) return str;
        const ext = str.slice(str.lastIndexOf("."));
        const name = str.slice(0, str.lastIndexOf("."));
        const available = maxLength - ext.length - 3;
        return name.slice(0, available) + "..." + ext;
    }
}

export const progressManager = new ProgressManager();
