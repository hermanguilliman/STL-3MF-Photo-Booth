import { PRINTER_NAMES } from "./constants.js";

let toastTimeoutId = null;

export function showToast(msg, duration = 2500, type = "success") {
    const t = document.getElementById("toast");
    if (!t) return;

    if (toastTimeoutId !== null) {
        clearTimeout(toastTimeoutId);
        toastTimeoutId = null;
    }

    t.style.cssText = "";
    t.classList.remove("toast-success", "toast-error", "toast-info");
    t.classList.add(`toast-${type}`);
    t.textContent = msg;
    t.style.opacity = "1";

    toastTimeoutId = setTimeout(() => {
        t.style.opacity = "0";
        toastTimeoutId = null;
    }, duration);
}

export function addDropdown(folder, target, prop, labelsMap, onChange) {
    const guiOptions = {};
    for (const [id, name] of Object.entries(labelsMap)) {
        guiOptions[name] = id;
    }
    return folder.add(target, prop, guiOptions).onChange(onChange);
}

export function getPrinterOptions(translations) {
    const options = {
        none: translations.printerNone || "None",
    };

    for (const [id, name] of Object.entries(PRINTER_NAMES)) {
        options[id] = name;
    }

    options.custom = translations.printerCustom || "Custom Size";

    return options;
}
