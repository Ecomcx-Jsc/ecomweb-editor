// Architecture guard (runs with `npm test`): file naming + dependency direction between layers.
//   v2 layers (low → high): core → text → canvas → ui → blocks → editor. A layer may import (at runtime) only from
//   lower layers or the v2 foundation files (context, prefs, labels). `import type` may point anywhere except
//   that core stays framework-free (no React / ProseMirror / DOM UI libraries, not even as types... except React types in registry).
//   shared/ must not import legacy/ or v2/; legacy/ must not import v2/.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";

const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const src = join(root, "src");
const ORDER = ["core", "text", "canvas", "ui", "blocks"];
const FOUNDATION = new Set(["v2/context.tsx", "v2/prefs.ts", "v2/labels.ts"]);
const CORE_BANNED = /^(react|react-dom|prosemirror-[a-z]+|lucide-react|@tiptap\/.*)$/;
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*\.(ts|tsx|css)$/;

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(src).filter((f) => /\.(tsx?|css)$/.test(f));
const errors = [];
const layerOf = (rel) => {
  if (rel.startsWith("legacy/")) return { area: "legacy" };
  if (rel.startsWith("shared/")) return { area: "shared" };
  if (rel.startsWith("v2/")) {
    const seg = rel.split("/")[1];
    const i = ORDER.indexOf(seg);
    if (i >= 0) return { area: "v2", level: i, name: seg };
    if (FOUNDATION.has(rel)) return { area: "v2", level: -1, name: "foundation" };
    return { area: "v2", level: ORDER.length, name: "editor" }; // editor.tsx, index.ts
  }
  return { area: "entry" };
};
const IMPORT = /^\s*(import|export)\s+(type\s+)?[^"']*?from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm;

for (const file of files) {
  const rel = relative(src, file);
  const base = rel.split("/").pop();
  if (!NAME.test(base)) errors.push(`${rel}: file name must be kebab-case (e.g. "block-list.tsx")`);
  if (!/\.tsx?$/.test(file)) continue;
  const me = layerOf(rel);
  for (const m of readFileSync(file, "utf8").matchAll(IMPORT)) {
    const typeOnly = !!m[2];
    const spec = m[3] ?? m[4];
    if (me.name === "core" && CORE_BANNED.test(spec) && !(typeOnly && spec === "react" && rel === "v2/core/registry.ts")) {
      errors.push(`${rel}: core must not import "${spec}"`);
      continue;
    }
    if (!spec.startsWith(".")) continue;
    const target = relative(src, resolve(dirname(file), spec));
    const withExt = [target, `${target}.ts`, `${target}.tsx`, `${target}/index.ts`].find((t) => existsSync(join(src, t)) && statSync(join(src, t)).isFile()) ?? target;
    const them = layerOf(withExt);
    if (me.area === "shared" && (them.area === "legacy" || them.area === "v2")) errors.push(`${rel}: shared/ must not import ${target}`);
    if (me.area === "legacy" && them.area === "v2") errors.push(`${rel}: legacy/ must not import ${target}`);
    if (me.area === "v2" && them.area === "v2" && !typeOnly && them.level > me.level && me.level >= 0)
      errors.push(`${rel}: ${me.name} must not import higher layer ${them.name} (${target}) — move the code down or pass it in`);
    if (me.name === "core" && them.area === "v2" && them.name === "foundation" && !typeOnly) errors.push(`${rel}: core must not import ${target} at runtime`);
  }
}
if (errors.length) { console.error(`Architecture check failed (${errors.length}):\n  ${errors.join("\n  ")}`); process.exit(1); }
console.log(`Architecture check OK (${files.length} files).`);
