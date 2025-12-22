
import { defineConfig } from "vite";

export default defineConfig({
    server: {
        open: true, 
        port: 3000,
    },
    build: {
        minify: true,
        target: "es2015",
    },
});
