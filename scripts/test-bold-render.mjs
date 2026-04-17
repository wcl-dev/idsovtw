// 驗證 ** 能被渲染為 <strong>
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const file =
    "file:///" + path.resolve(ROOT, "dist/index.html").replace(/\\/g, "/");
  await page.goto(file, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    window.location.hash = "#/scatter/openmuseum";
  });
  await page.waitForTimeout(2500);

  const strongs = await page.$$eval("#scatter-detail strong", (els) =>
    els.map((e) => e.textContent.trim())
  );
  console.log("scatter/openmuseum 詳情 <strong> 元素數:", strongs.length);
  strongs.slice(0, 8).forEach((s) => console.log("  →", s));

  const detailText = await page.textContent("#scatter-detail");
  const leaked = (detailText || "").match(/\*\*/g);
  console.log("裸露 ** 出現次數:", leaked ? leaked.length : 0);

  await page.evaluate(() => {
    window.location.hash = "#/matrix";
  });
  await page.waitForTimeout(1200);
  await page.click('.matrix-cell[data-source="openmuseum"]');
  await page.waitForTimeout(500);

  const mStrongs = await page.$$eval("#matrix-detail strong", (els) =>
    els.map((e) => e.textContent.trim())
  );
  console.log("\nmatrix detail <strong> 元素數:", mStrongs.length);
  mStrongs.slice(0, 5).forEach((s) => console.log("  →", s));

  const mText = await page.textContent("#matrix-detail");
  const mLeaked = (mText || "").match(/\*\*/g);
  console.log("matrix 裸露 ** 出現次數:", mLeaked ? mLeaked.length : 0);

  await browser.close();
  process.exit(leaked || mLeaked ? 1 : 0);
})();
