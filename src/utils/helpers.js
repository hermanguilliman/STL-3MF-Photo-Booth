import { PRINTERS } from "../core/constants.js";

let toastTimeout = null;

export function showToast(msg, duration = 2500, type = "success") {
    const el = document.getElementById("toast");
    if (!el) return;

    if (toastTimeout) clearTimeout(toastTimeout);

    el.style.cssText = "";
    el.className = `toast-${type}`;
    el.textContent = msg;
    el.style.opacity = "1";

    toastTimeout = setTimeout(() => {
        el.style.opacity = "0";
        toastTimeout = null;
    }, duration);
}

export function addDropdown(folder, target, prop, labelsMap, onChange) {
    const options = Object.fromEntries(
        Object.entries(labelsMap).map(([id, name]) => [name, id])
    );
    return folder.add(target, prop, options).onChange(onChange);
}

export function getPrinterOptions(t) {
    return {
        none: t.printerNone || "None",
        ...Object.fromEntries(
            Object.entries(PRINTERS)
                .filter(([id]) => id !== "none" && id !== "custom")
                .map(([id, data]) => [id, data.name])
        ),
        custom: t.printerCustom || "Custom Size",
    };
}
