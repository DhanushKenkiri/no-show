/**
 * Generates lib/abi/noShow.ts from the Foundry artifact.
 *
 * CLAUDE.md forbids hand-writing or pasting an ABI, but importing the artifact
 * directly drags 76KB of bytecode and embedded sources into the client bundle, and
 * a JSON import widens to `any[]` so viem loses every bit of type inference.
 * Generating a `const` array gets both: one source of truth, full inference.
 *
 * Runs automatically via the `prebuild` npm script. Re-run it after every
 * `forge build`, or the ABI and the deployed bytecode drift apart.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const ARTIFACT = "contracts/out/NoShow.sol/NoShow.json";
const OUT = "lib/abi/noShow.ts";

let artifact;
try {
  artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
} catch {
  console.error(
    `[gen-abi] Cannot read ${ARTIFACT}.\n` +
      `          Run \`cd contracts && forge build\` first.`,
  );
  process.exit(1);
}

if (!Array.isArray(artifact.abi) || artifact.abi.length === 0) {
  console.error(`[gen-abi] ${ARTIFACT} has no abi array.`);
  process.exit(1);
}

const banner = `// GENERATED FILE - DO NOT EDIT.
// Source: ${ARTIFACT}
// Regenerate: npm run abi
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `${banner}\nexport const noShowAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;\n`,
);

const fns = artifact.abi.filter((x) => x.type === "function").length;
const evs = artifact.abi.filter((x) => x.type === "event").length;
const errs = artifact.abi.filter((x) => x.type === "error").length;
console.log(`[gen-abi] wrote ${OUT} - ${fns} functions, ${evs} events, ${errs} errors`);
