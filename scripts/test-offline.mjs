// 測試 dist/ 在 file:// 協定下是否可運作
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push("[console] " + msg.text());
  });
  page.on("pageerror", (err) => errors.push("[pageerror] " + err.message));

  const filePath =
    "file:///" + path.resolve(ROOT, "dist/index.html").replace(/\\/g, "/");
  console.log("開啟:", filePath);

  await page.goto(filePath, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(2500);

  const heading = await page
    .$eval(".title-main", (el) => el.textContent.trim())
    .catch(() => null);
  console.log("首頁標題:", heading);

  for (const view of ["spectrum", "matrix", "scatter", "units"]) {
    await page.evaluate((v) => {
      window.location.hash = "#/" + v;
    }, view);
    await page.waitForTimeout(1000);
    const title = await page
      .$eval(".view-title", (el) => el.textContent.trim())
      .catch(() => "（找不到 .view-title）");
    console.log("  " + view + " →", title);
  }

  await page.evaluate(() => {
    window.location.hash = "#/spectrum/cip";
  });
  await page.waitForTimeout(1500);
  const activeRow = await page.$(".spectrum-row.active");
  console.log("\n深連結 #/spectrum/cip → CIP 列自動展開:", !!activeRow);

  await page.evaluate(() => {
    window.location.hash = "#/scatter/ailt";
  });
  await page.waitForTimeout(1500);
  const activePoint = await page.$(".scatter-point-group.active");
  console.log("深連結 #/scatter/ailt → AILT 點自動選取:", !!activePoint);

  await page.evaluate(() => {
    window.location.hash = "#/matrix/cip";
  });
  await page.waitForTimeout(1500);
  const highlighted = await page.$("tr.source-row-highlighted");
  console.log("深連結 #/matrix/cip → CIP 列高亮:", !!highlighted);

  console.log("\n=== Console / 頁面錯誤（" + errors.length + " 條）===");
  errors.forEach((e) => console.log("  " + e));

  await browser.close();
  process.exit(errors.length > 0 ? 1 : 0);
})();
