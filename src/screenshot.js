import { renderer, composer, scene, plane, gridHelper } from "./scene.js";
import { state } from "./state.js";
import { dimLabels, hideDimHelper, showDimHelper } from "./dimensions.js";
import { bedGroup } from "./bed.js";
import { showToast } from "./utils.js";
import { translations, getCurLang } from "./language.js";
import { getGlobalAdaptiveQuality, isMobile } from "./quality.js";

function drawLabelsOnCtx(ctx) {
    if (!state.showDimensions) return;

    const pixelRatio = renderer.getPixelRatio();

    const fontSize = 12 * pixelRatio;
    const paddingX = 6 * pixelRatio;
    const paddingY = 2 * pixelRatio;

    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";

    ["x", "y", "z"].forEach((axis) => {
        const el = dimLabels[axis];
        if (!el || el.style.display === "none") return;

        const x = parseFloat(el.style.left) * pixelRatio;
        const y = parseFloat(el.style.top) * pixelRatio;
        const text = el.innerText;
        const textMetrics = ctx.measureText(text);
        const bgWidth = textMetrics.width + paddingX * 2;
        const bgHeight = fontSize + paddingY * 4;

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1 * pixelRatio;
        ctx.strokeRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight);
        ctx.fillStyle = "#00b894";
        ctx.fillText(text, x, y);
    });
}

async function saveBlob(blob, filename) {
    const t = translations[getCurLang()];
    try {
        const item = new ClipboardItem({ "image/png": blob });
        await navigator.clipboard.write([item]);
        showToast(t.toastCopied, 2500, "success");
    } catch (e) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
        showToast(t.toastSaved, 2500, "success");
    }
}

function trimCanvas(c) {
    const ctx = c.getContext("2d");
    const w = c.width;
    const h = c.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let minX = w,
        minY = h,
        maxX = 0,
        maxY = 0;
    let found = false;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                found = true;
            }
        }
    }

    if (!found) return c;

    const padding = 20;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(w, maxX + padding);
    maxY = Math.min(h, maxY + padding);

    const cutW = maxX - minX;
    const cutH = maxY - minY;
    const cutCanvas = document.createElement("canvas");
    cutCanvas.width = cutW;
    cutCanvas.height = cutH;
    cutCanvas
        .getContext("2d")
        .drawImage(c, minX, minY, cutW, cutH, 0, 0, cutW, cutH);

    return cutCanvas;
}

function renderHighQuality() {
    const aq = getGlobalAdaptiveQuality();

    if (isMobile && aq) {
        aq.boostForScreenshot();
    }

    if (renderer.shadowMap.enabled) {
        renderer.shadowMap.needsUpdate = true;
    }

    composer.render();
    composer.render();
}

function restoreQuality() {
    const aq = getGlobalAdaptiveQuality();
    if (isMobile && aq) {
        aq.restoreAfterScreenshot();
    }
}

export function screenshotScene() {
    const t = translations[getCurLang()];
    showToast(t.loading || "Processing...", 5000, "info");

    setTimeout(() => {
        try {
            renderHighQuality();

            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = renderer.domElement.width;
            tempCanvas.height = renderer.domElement.height;
            const ctx = tempCanvas.getContext("2d");
            ctx.drawImage(renderer.domElement, 0, 0);
            drawLabelsOnCtx(ctx);

            tempCanvas.toBlob((blob) => {
                restoreQuality();
                if (blob) {
                    saveBlob(blob, "scene_render.png");
                }
            }, "image/png");
        } catch (e) {
            console.error("Screenshot error:", e);
            restoreQuality();
            showToast("Error creating screenshot", 3000, "error");
        }
    }, 100);
}

export function screenshotModel() {
    const t = translations[getCurLang()];
    showToast(t.loading || "Processing...", 5000, "info");

    setTimeout(() => {
        try {
            const prevBg = scene.background;
            const prevGrid = gridHelper.visible;
            const prevPlane = plane.visible;
            const prevBed = bedGroup.visible;

            scene.background = null;
            gridHelper.visible = false;
            plane.visible = false;
            bedGroup.visible = false;
            hideDimHelper();

            renderHighQuality();

            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = renderer.domElement.width;
            tempCanvas.height = renderer.domElement.height;
            const ctx = tempCanvas.getContext("2d");
            ctx.drawImage(renderer.domElement, 0, 0);

            scene.background = prevBg;
            gridHelper.visible = prevGrid;
            plane.visible = prevPlane;
            bedGroup.visible = prevBed;
            showDimHelper();

            composer.render();
            restoreQuality();

            const croppedCanvas = trimCanvas(tempCanvas);
            croppedCanvas.toBlob((blob) => {
                if (blob) {
                    saveBlob(blob, "model_cutout.png");
                }
            }, "image/png");
        } catch (e) {
            console.error("Screenshot error:", e);

            showDimHelper();
            restoreQuality();
            showToast("Error creating screenshot", 3000, "error");
        }
    }, 100);
}
