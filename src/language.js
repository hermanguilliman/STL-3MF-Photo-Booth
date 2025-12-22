import { translations } from "./translations.js";
import { saveSetting, loadSettings } from "./storage.js";

let CUR_LANG = "ru";
let buildGuiCallback = null;

export { translations };

export function getCurLang() {
    return CUR_LANG;
}

export function setBuildGuiCallback(callback) {
    buildGuiCallback = callback;
}

export function setLanguage(lang) {
    if (!translations[lang]) return;
    CUR_LANG = lang;

    saveSetting("language", lang);

    const menu = document.getElementById("langMenu");
    if (menu) menu.classList.remove("visible");

    const t = translations[CUR_LANG];
    const currentFlag = document.getElementById("currentFlag");
    if (currentFlag) currentFlag.innerHTML = t.flag;

    document.querySelectorAll("[data-lang]").forEach((el) => {
        const key = el.getAttribute("data-lang");
        if (t[key]) el.innerText = t[key];
    });

    const loaderText = document.getElementById("loaderText");
    if (loaderText) loaderText.innerText = t.loading;

    if (buildGuiCallback) {
        buildGuiCallback();
    }
}

export function detectLanguage() {
    const savedSettings = loadSettings();
    if (savedSettings.language && translations[savedSettings.language]) {
        setLanguage(savedSettings.language);
        return;
    }

    let code = navigator.language.slice(0, 2).toLowerCase();
    if (code === "zh") code = "cn";
    if (code === "ja") code = "jp";

    if (translations[code]) {
        setLanguage(code);
    } else {
        setLanguage("en");
    }
}

window.setLanguage = setLanguage;
