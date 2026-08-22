import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(resolve(here, "../dist"), { recursive: true });
copyFileSync(resolve(here, "../src/styles.css"), resolve(here, "../dist/styles.css"));
console.log("[copy-css] wrote dist/styles.css");
