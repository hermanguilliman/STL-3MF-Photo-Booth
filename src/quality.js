export const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
export const isLowEnd =
    isMobile &&
    (navigator.hardwareConcurrency <= 4 || !navigator.hardwareConcurrency);
export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

export const QUALITY_PRESETS = {
    high: {
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        shadowMapSize: 2048,
        shadowsEnabled: true,
        saoEnabled: true,
        saoIntensity: 0.03,
        saoScale: 50,
        fxaaEnabled: true,
        antialias: false,
        maxLights: 8,
    },
    medium: {
        pixelRatio: Math.min(window.devicePixelRatio, 1.5),
        shadowMapSize: 1024,
        shadowsEnabled: true,
        saoEnabled: true,
        saoIntensity: 0.02,
        saoScale: 30,
        fxaaEnabled: true,
        antialias: false,
        maxLights: 6,
    },
    low: {
        pixelRatio: 1,
        shadowMapSize: 512,
        shadowsEnabled: true,
        saoEnabled: false,
        saoIntensity: 0,
        saoScale: 0,
        fxaaEnabled: true,
        antialias: false,
        maxLights: 4,
    },
    ultralow: {
        pixelRatio: 0.75,
        shadowMapSize: 256,
        shadowsEnabled: false,
        saoEnabled: false,
        saoIntensity: 0,
        saoScale: 0,
        fxaaEnabled: false,
        antialias: false,
        maxLights: 2,
    },

    screenshot: {
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        shadowMapSize: 2048,
        shadowsEnabled: true,
        saoEnabled: true,
        saoIntensity: 0.03,
        saoScale: 50,
        fxaaEnabled: true,
        antialias: false,
        maxLights: 8,
    },
};

export function detectOptimalQuality() {
    if (isIOS) {
        return "low";
    }

    if (isLowEnd) {
        return "ultralow";
    }

    if (isMobile) {
        return "medium";
    }

    return "high";
}

export function getQualitySettings(quality = null) {
    const q = quality || detectOptimalQuality();
    return QUALITY_PRESETS[q] || QUALITY_PRESETS.medium;
}

export class AdaptiveQuality {
    constructor(renderer, composer, saoPass, fxaaPass, onQualityChange = null) {
        this.renderer = renderer;
        this.composer = composer;
        this.saoPass = saoPass;
        this.fxaaPass = fxaaPass;
        this.onQualityChange = onQualityChange;

        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 60;
        this.currentQuality = detectOptimalQuality();
        this.savedQuality = null;
        this.isEnabled = isMobile;

        this.fpsHistory = [];
        this.maxHistory = 30;
        this.checkInterval = 2000;
        this.lastCheck = performance.now();

        this.applyQuality(this.currentQuality);
    }

    update() {
        if (!this.isEnabled) return;

        this.frameCount++;
        const now = performance.now();

        if (now - this.lastTime >= 1000) {
            this.fps = this.frameCount;
            this.fpsHistory.push(this.fps);

            if (this.fpsHistory.length > this.maxHistory) {
                this.fpsHistory.shift();
            }

            this.frameCount = 0;
            this.lastTime = now;
        }

        if (now - this.lastCheck >= this.checkInterval && !this.savedQuality) {
            this.checkQuality();
            this.lastCheck = now;
        }
    }

    checkQuality() {
        if (this.fpsHistory.length < 5) return;

        const avgFps =
            this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
        const qualities = ["ultralow", "low", "medium", "high"];
        const currentIndex = qualities.indexOf(this.currentQuality);

        if (avgFps < 25 && currentIndex > 0) {
            this.applyQuality(qualities[currentIndex - 1]);
            this.fpsHistory = [];
        } else if (
            avgFps > 50 &&
            currentIndex < qualities.length - 1 &&
            !isMobile
        ) {
            this.applyQuality(qualities[currentIndex + 1]);
            this.fpsHistory = [];
        }
    }

    applyQuality(quality) {
        const settings = QUALITY_PRESETS[quality];
        if (!settings) return;

        this.currentQuality = quality;
        console.log(`[Quality] Applying: ${quality}`);

        this.renderer.setPixelRatio(settings.pixelRatio);
        this.renderer.shadowMap.enabled = settings.shadowsEnabled;

        if (this.saoPass) {
            this.saoPass.enabled = settings.saoEnabled;
            if (settings.saoEnabled) {
                this.saoPass.params.saoIntensity = settings.saoIntensity;
                this.saoPass.params.saoScale = settings.saoScale;
            }
        }

        if (this.fxaaPass) {
            this.fxaaPass.enabled = settings.fxaaEnabled;
        }

        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.setSize(w, h);
        this.composer.setSize(w, h);

        if (this.fxaaPass && settings.fxaaEnabled) {
            const pr = this.renderer.getPixelRatio();
            this.fxaaPass.material.uniforms["resolution"].value.set(
                1 / (w * pr),
                1 / (h * pr)
            );
        }

        if (this.onQualityChange) {
            this.onQualityChange(quality, settings);
        }
    }

    setQuality(quality) {
        this.applyQuality(quality);
        this.fpsHistory = [];
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
    }

    getFPS() {
        return this.fps;
    }

    getQuality() {
        return this.currentQuality;
    }

    boostForScreenshot() {
        if (this.savedQuality) return;

        this.savedQuality = this.currentQuality;
        this.applyQuality("screenshot");

        if (this.renderer.shadowMap.enabled) {
            this.renderer.shadowMap.needsUpdate = true;
        }
    }

    restoreAfterScreenshot() {
        if (!this.savedQuality) return;

        this.applyQuality(this.savedQuality);
        this.savedQuality = null;
    }
}

let globalAdaptiveQuality = null;

export function setGlobalAdaptiveQuality(aq) {
    globalAdaptiveQuality = aq;
}

export function getGlobalAdaptiveQuality() {
    return globalAdaptiveQuality;
}
