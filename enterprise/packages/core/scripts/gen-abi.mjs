/**
 * Generates src/abi.ts from the Foundry artifact.
 *
 * An ABI is never hand-written or pasted. Importing the artifact directly would
 * drag the bytecode and embedded sources into every consumer's bundle, and a JSON
 * import widens to any[] so viem loses all type inference. A generated const array
 * gets one source of truth and full inference.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ARTIFACT = resolve(here, "../../../contracts/out/NoShowRegistry.sol/NoShowRegistry.json");
const OUT = resolve(here, "../src/abi.ts");

let artifact;
try {
  artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
} catch {
  console.error(`[gen-abi] Cannot read ${ARTIFACT}\n          Run \`cd enterprise/contracts && forge build\` first.`);
  process.exit(1);
}
if (!Array.isArray(artifact.abi) || artifact.abi.length === 0) {
  console.error("[gen-abi] artifact has no abi array");
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `// GENERATED FILE - DO NOT EDIT.\n// Source: contracts/out/NoShowRegistry.sol/NoShowRegistry.json\n// Regenerate: npm run abi\n\nexport const noShowRegistryAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`,
);

const n = (t) => artifact.abi.filter((x) => x.type === t).length;
console.log(`[gen-abi] wrote src/abi.ts - ${n("function")} functions, ${n("event")} events, ${n("error")} errors`);
