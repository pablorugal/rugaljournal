// Copia functions/src/calculations.ts → src/calculations.ts
// Uso:
//   npm run sync:calc          (copia)
//   npm run sync:calc:check    (solo comprueba; falla si están desincronizados)
import {readFileSync, writeFileSync, existsSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "functions/src/calculations.ts");
const target = resolve(root, "src/calculations.ts");

const HEADER = [
  "/* =====================================================================",
  " * ARCHIVO GENERADO — NO EDITAR.",
  " * Fuente única de verdad: functions/src/calculations.ts",
  " * Para actualizar este archivo: npm run sync:calc (desde la raíz)",
  " * ===================================================================== */",
  "",
  "",
].join("\n");

const expected = HEADER + readFileSync(source, "utf8");

if (process.argv.includes("--check")) {
  const current = existsSync(target) ? readFileSync(target, "utf8") : "";
  if (current !== expected) {
    console.error("✖ src/calculations.ts está desincronizado. Ejecuta: npm run sync:calc");
    process.exit(1);
  }
  console.log("✔ src/calculations.ts está sincronizado.");
} else {
  writeFileSync(target, expected);
  console.log("✔ src/calculations.ts regenerado desde functions/src/calculations.ts");
}