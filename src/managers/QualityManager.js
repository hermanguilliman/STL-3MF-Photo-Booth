import { QUALITY_PRESETS } from "../core/constants.js";

export const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
export const isLowEnd =
    isMobile &&
    (navigator.hardwareConcurrency <= 4 || !navigator.hardwareConcurrency);

export function getInitialQuality() {
    let quality = "high";
    if (isIOS) quality = "low";
    else if (isLowEnd) quality = "ultralow";
    else if (isMobile) quality = "medium";

    return QUALITY_PRESETS[quality];
}

export class QualityManager {
    #renderer;
    #composer;
    #saoPass;
    #fxaaPass;
    #currentQuality;
    #savedQuality = null;
    #savedSaoParams = null;
    #fpsHistory = [];
    #frameCount = 0;
    #lastTime = performance.now();
    #lastCheck = performance.now();
    #isEnabled;

    static instance = null;

    constructor(renderer, composer, saoPass, fxaaPass) {
        this.#renderer = renderer;
        this.#composer = composer;
        this.#saoPass = saoPass;
        this.#fxaaPass = fxaaPass;
        this.#isEnabled = isMobile;
        this.#currentQuality = this.#detectOptimal();

        if (renderer) {
            this.apply(this.#currentQuality);
        }

        QualityManager.instance = this;
    }

    #detectOptimal() {
        if (isIOS) return "low";
        if (isLowEnd) return "ultralow";
        if (isMobile) return "medium";
        return "high";
    }

    get current() {
        return this.#currentQuality;
    }

    get settings() {
        return QUALITY_PRESETS[this.#currentQuality];
    }

    update() {
        if (!this.#isEnabled || !this.#renderer) return;

        this.#frameCount++;
        const now = performance.now();

        if (now - this.#lastTime >= 1000) {
            this.#fpsHistory.push(this.#frameCount);
            if (this.#fpsHistory.length > 30) this.#fpsHistory.shift();
            this.#frameCount = 0;
            this.#lastTime = now;
        }

        if (now - this.#lastCheck >= 2000 && !this.#savedQuality) {
            this.#autoAdjust();
            this.#lastCheck = now;
        }
    }

    #autoAdjust() {
        if (this.#fpsHistory.length < 5) return;

        const avgFps =
            this.#fpsHistory.reduce((a, b) => a + b, 0) /
            this.#fpsHistory.length;
        const qualities = ["ultralow", "low", "medium", "high"];
        const idx = qualities.indexOf(this.#currentQuality);

        if (avgFps < 25 && idx > 0) {
            this.#applyWithoutSaoChange(qualities[idx - 1]);
            this.#fpsHistory = [];
        } else if (avgFps > 50 && idx < qualities.length - 1 && !isMobile) {
            this.#applyWithoutSaoChange(qualities[idx + 1]);
            this.#fpsHistory = [];
        }
    }

    apply(quality) {
        if (!this.#renderer) return;

        const s = QUALITY_PRESETS[quality];
        if (!s) return;

        this.#currentQuality = quality;
        this.#renderer.setPixelRatio(s.pixelRatio);
        this.#renderer.shadowMap.enabled = s.shadowsEnabled;

        if (this.#saoPass) {
            this.#saoPass.enabled = s.saoEnabled;

            if (s.saoEnabled && !this.#savedQuality) {
                this.#saoPass.params.saoIntensity = s.saoIntensity;
                this.#saoPass.params.saoScale = s.saoScale;
            }
        }

        if (this.#fxaaPass) {
            this.#fxaaPass.enabled = s.fxaaEnabled;
        }

        this.#resize();
    }

    #applyWithoutSaoChange(quality) {
        if (!this.#renderer) return;

        const s = QUALITY_PRESETS[quality];
        if (!s) return;

        const currentSaoParams = this.#saoPass
            ? {
                  saoScale: this.#saoPass.params.saoScale,
                  saoKernelRadius: this.#saoPass.params.saoKernelRadius,
                  saoIntensity: this.#saoPass.params.saoIntensity,
              }
            : null;

        this.#currentQuality = quality;
        this.#renderer.setPixelRatio(s.pixelRatio);
        this.#renderer.shadowMap.enabled = s.shadowsEnabled;

        if (this.#saoPass) {
            this.#saoPass.enabled = s.saoEnabled;

            if (currentSaoParams) {
                Object.assign(this.#saoPass.params, currentSaoParams);
            }
        }

        if (this.#fxaaPass) {
            this.#fxaaPass.enabled = s.fxaaEnabled;
        }

        this.#resize();
    }

    #resize() {
        if (!this.#renderer || !this.#composer) return;

        const { innerWidth: w, innerHeight: h } = window;
        this.#renderer.setSize(w, h);
        this.#composer.setSize(w, h);

        if (this.#fxaaPass?.enabled) {
            const pr = this.#renderer.getPixelRatio();
            this.#fxaaPass.material.uniforms.resolution.value.set(
                1 / (w * pr),
                1 / (h * pr)
            );
        }
    }

    boostForScreenshot() {
        if (this.#savedQuality || !this.#renderer) return;

        this.#savedQuality = this.#currentQuality;

        if (this.#saoPass) {
            this.#savedSaoParams = {
                saoScale: this.#saoPass.params.saoScale,
                saoKernelRadius: this.#saoPass.params.saoKernelRadius,
                saoIntensity: this.#saoPass.params.saoIntensity,
            };
        }

        this.apply("screenshot");

        if (this.#saoPass && this.#savedSaoParams) {
            Object.assign(this.#saoPass.params, this.#savedSaoParams);
        }

        if (this.#renderer.shadowMap.enabled) {
            this.#renderer.shadowMap.needsUpdate = true;
        }
    }

    restoreAfterScreenshot() {
        if (!this.#savedQuality) return;

        const savedSaoParams = this.#savedSaoParams;
        const savedQuality = this.#savedQuality;

        this.#savedQuality = null;
        this.#savedSaoParams = null;

        this.apply(savedQuality);

        if (this.#saoPass && savedSaoParams) {
            Object.assign(this.#saoPass.params, savedSaoParams);
        }
    }

    get fps() {
        return this.#fpsHistory[this.#fpsHistory.length - 1] || 60;
    }
}
