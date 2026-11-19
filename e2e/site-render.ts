import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Renderer của website (theme-sdk/rich.tsx) gói thành CommonJS để chạy trong Node; `next/navigation` (chỉ dùng ở trình duyệt) thay bằng khung rỗng. */
export async function loadSiteRenderer(): Promise<(content: unknown, ctx: unknown) => Promise<unknown>> {
  const dir = path.resolve(here, "../node_modules/.cache/parity");
  mkdirSync(dir, { recursive: true });
  const tag = `w${process.pid}`;
  const stub = path.join(dir, `next-stub-${tag}.cjs`);
  writeFileSync(stub, "const C = (p) => null; module.exports = { __esModule: true, default: C, usePathname: () => '/', useRouter: () => ({}), useSearchParams: () => new URLSearchParams(), useLinkStatus: () => ({ pending: false }) };");
  // next/link: vẽ <a> như Next.js; esbuild nạp CJS kiểu Node (default = module.exports) nên xuất chính component (theme-sdk dùng Link cho link nội bộ trong nội dung, nút, ảnh)
  const linkStub = path.join(dir, `next-link-stub-${tag}.cjs`);
  writeFileSync(linkStub, "const { createElement } = require('react'); const L = ({ prefetch, replace, scroll, ...p }) => createElement('a', p); L.useLinkStatus = () => ({ pending: false }); module.exports = L;");
  const out = path.join(dir, `rich-${tag}.cjs`);
  await build({ entryPoints: [path.resolve(here, "../../sdk/packages/theme-sdk/src/rich.tsx")], bundle: true, platform: "node", format: "cjs", outfile: out, jsx: "automatic",
    external: ["react", "react-dom"], alias: { "next/navigation": stub, "next/link": linkStub, "next/form": stub, "server-only": path.resolve(here, "../../sdk/node_modules/server-only/empty.js") }, logLevel: "error", nodePaths: [path.resolve(here, "../../sdk/node_modules")] });
  return (createRequire(import.meta.url)(out) as { renderContent: (c: unknown, x: unknown) => Promise<unknown> }).renderContent;
}

