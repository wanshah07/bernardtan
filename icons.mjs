// Renders public/koko.svg into the PNG icons the manifest lists (192, 512, maskable 512 with safe padding) on a navy ground.
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
const svg = readFileSync("public/koko.svg", "utf8");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
for (const [name, size, pad] of [["icon-192.png", 192, 0.06], ["icon-512.png", 512, 0.06], ["icon-maskable-512.png", 512, 0.2]]) {
  await p.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - 2 * pad));
  await p.setContent(`<body style="margin:0;background:#0E1626;display:grid;place-items:center;width:${size}px;height:${size}px"><div style="width:${inner}px;height:${inner}px">${svg.replace('width="120" height="120"', `width="${inner}" height="${inner}"`)}</div></body>`);
  writeFileSync(`public/${name}`, await p.screenshot({ type: "png", clip: { x: 0, y: 0, width: size, height: size } }));
  console.log(name, "ok");
}
await b.close();
