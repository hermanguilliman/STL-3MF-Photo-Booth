import { sceneManager } from "./SceneManager.js";
import { dimensionsManager } from "./DimensionsManager.js";
import { bedManager } from "./BedManager.js";
import { state } from "../core/StateManager.js";
import { QualityManager, isMobile } from "./QualityManager.js";
import { showToast } from "../utils/helpers.js";
import { i18n } from "../i18n/LanguageManager.js";

class ScreenshotManager {
    async captureScene() {
        const t = i18n.t;
        showToast(t.loading || "Processing...", 5000, "info");

        await this.#delay(100);

        try {
            this.#boostQuality();

            const canvas = this.#renderToCanvas();
            this.#drawLabels(canvas.getContext("2d"));

            const blob = await this.#canvasToBlob(canvas);
            this.#restoreQuality();
            await this.#saveBlob(blob, "scene_render.png");
        } catch (e) {
            console.error("Screenshot error:", e);
            this.#restoreQuality();
            showToast("Error creating screenshot", 3000, "error");
        }
    }

    async captureModel() {
        const t = i18n.t;
        showToast(t.loading || "Processing...", 5000, "info");

        await this.#delay(100);

        const { scene, gridHelper, shadowPlane } = sceneManager;
        const prevState = {
            bg: scene.background,
            grid: gridHelper.visible,
            plane: shadowPlane.visible,
            bed: bedManager.group.visible,
        };

        try {
            scene.background = null;
            gridHelper.visible = false;
            shadowPlane.visible = false;
            bedManager.group.visible = false;
            dimensionsManager.hide();

            this.#boostQuality();

            const canvas = this.#renderToCanvas();
            const cropped = this.#trimCanvas(canvas);

            scene.background = prevState.bg;
            gridHelper.visible = prevState.grid;
            shadowPlane.visible = prevState.plane;
            bedManager.group.visible = prevState.bed;
            dimensionsManager.show();

            this.#restoreQuality();

            const blob = await this.#canvasToBlob(cropped);
            await this.#saveBlob(blob, "model_cutout.png");
        } catch (e) {
            console.error("Screenshot error:", e);
            scene.background = prevState.bg;
            gridHelper.visible = prevState.grid;
            shadowPlane.visible = prevState.plane;
            bedManager.group.visible = prevState.bed;
            dimensionsManager.show();
            this.#restoreQuality();
            showToast("Error creating screenshot", 3000, "error");
        }
    }

    #boostQuality() {
        QualityManager.instance?.boostForScreenshot();
        if (sceneManager.renderer.shadowMap.enabled) {
            sceneManager.renderer.shadowMap.needsUpdate = true;
        }
        sceneManager.render();
        sceneManager.render();
    }

    #restoreQuality() {
        QualityManager.instance?.restoreAfterScreenshot();

        if (sceneManager.renderer.shadowMap.enabled) {
            sceneManager.renderer.shadowMap.needsUpdate = true;
        }
        sceneManager.render();
        sceneManager.render();
    }

    #renderToCanvas() {
        const { domElement } = sceneManager.renderer;
        const canvas = document.createElement("canvas");
        canvas.width = domElement.width;
        canvas.height = domElement.height;
        canvas.getContext("2d").drawImage(domElement, 0, 0);
        return canvas;
    }

    #drawLabels(ctx) {
        if (!state.get("showDimensions")) return;

        const pr = sceneManager.renderer.getPixelRatio();
        const fontSize = 12 * pr;
        const paddingX = 6 * pr;
        const paddingY = 2 * pr;

        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";

        ["x", "y", "z"].forEach((axis) => {
            const el = document.getElementById(`dim${axis.toUpperCase()}`);
            if (!el || el.style.display === "none") return;

            const x = parseFloat(el.style.left) * pr;
            const y = parseFloat(el.style.top) * pr;
            const text = el.innerText;
            const metrics = ctx.measureText(text);
            const bgW = metrics.width + paddingX * 2;
            const bgH = fontSize + paddingY * 4;

            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(x - bgW / 2, y - bgH / 2, bgW, bgH);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
            ctx.lineWidth = pr;
            ctx.strokeRect(x - bgW / 2, y - bgH / 2, bgW, bgH);
            ctx.fillStyle = "#00b894";
            ctx.fillText(text, x, y);
        });
    }

    #trimCanvas(canvas) {
        const ctx = canvas.getContext("2d");
        const { width: w, height: h } = canvas;
        const { data } = ctx.getImageData(0, 0, w, h);

        let minX = w,
            minY = h,
            maxX = 0,
            maxY = 0;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (data[(y * w + x) * 4 + 3] > 0) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        if (maxX === 0) return canvas;

        const padding = 20;
        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(w, maxX + padding);
        maxY = Math.min(h, maxY + padding);

        const cut = document.createElement("canvas");
        cut.width = maxX - minX;
        cut.height = maxY - minY;
        cut.getContext("2d").drawImage(
            canvas,
            minX,
            minY,
            cut.width,
            cut.height,
            0,
            0,
            cut.width,
            cut.height
        );
        return cut;
    }

    async #saveBlob(blob, filename) {
        const t = i18n.t;
        try {
            await navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob }),
            ]);
            showToast(t.toastCopied, 2500, "success");
        } catch {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
            showToast(t.toastSaved, 2500, "success");
        }
    }

    #canvasToBlob(canvas) {
        return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    }

    #delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

export const screenshotManager = new ScreenshotManager();
