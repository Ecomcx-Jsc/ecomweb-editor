// Chặn phát hành khi gói phụ thuộc đường dẫn máy cục bộ (file:, link:, workspace:) — người cài từ npm sẽ không cài được.
// Link cục bộ chỉ được nằm trong devDependencies (không đi theo gói khi phát hành).
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const bad = [];
for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
  for (const [name, range] of Object.entries(pkg[field] ?? {})) {
    if (/^(file|link|workspace|portal):|^\.{0,2}\//.test(String(range))) bad.push(`${field}.${name} = ${range}`);
  }
}
if (bad.length) {
  console.error(`Cannot publish ${pkg.name}: local path dependencies found:\n  ${bad.join("\n  ")}\nUse a semver range (e.g. "^1.15.0").`);
  process.exit(1);
}
console.log(`${pkg.name}: dependencies OK for publishing.`);
