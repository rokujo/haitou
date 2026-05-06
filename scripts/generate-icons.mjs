// PWA 用アイコン (192/512) を SVG から生成。
// 実行: node scripts/generate-icons.mjs
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const svg = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1e293b"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#059669"/>
      <stop offset="1" stop-color="#34d399"/>
    </linearGradient>
  </defs>

  <!-- 背景 -->
  <rect width="512" height="512" fill="url(#bg)" rx="96"/>

  <!-- 円記号 (¥) -->
  <g stroke="#fbbf24" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M 168 110 L 256 240 L 344 110"/>
    <line x1="256" y1="240" x2="256" y2="408"/>
    <line x1="172" y1="290" x2="340" y2="290"/>
    <line x1="172" y1="350" x2="340" y2="350"/>
  </g>

  <!-- 上昇トレンドのバーチャート -->
  <g fill="url(#bar)">
    <rect x="60"  y="455" width="32" height="22" rx="4"/>
    <rect x="100" y="438" width="32" height="39" rx="4"/>
    <rect x="140" y="416" width="32" height="61" rx="4"/>
    <rect x="180" y="390" width="32" height="87" rx="4"/>
  </g>
  <g fill="url(#bar)" opacity="0.55">
    <rect x="340" y="445" width="32" height="32" rx="4"/>
    <rect x="380" y="430" width="32" height="47" rx="4"/>
    <rect x="420" y="408" width="32" height="69" rx="4"/>
  </g>
</svg>`;

const outDir = path.join(root, "public");
fs.mkdirSync(outDir, { recursive: true });

await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(path.join(outDir, "icon-192.png"));
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(outDir, "icon-512.png"));

console.log("[generate-icons] public/icon-192.png, icon-512.png を生成しました");
