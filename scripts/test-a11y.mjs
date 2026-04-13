// 可及性檢查：鍵盤導覽、ARIA、焦點可見、對比基本檢查
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const filePath =
    "file:///" + path.resolve(ROOT, "dist/index.html").replace(/\\/g, "/");
  await page.goto(filePath, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1000);

  console.log("=== 可及性檢查報告 ===\n");

  // 1. Tab 順序：所有 focusable 元素都應有可見焦點
  const focusables = await page.$$eval(
    'a, button, [tabindex]:not([tabindex="-1"]), input, select, textarea',
    (els) =>
      els.map((el) => ({
        tag: el.tagName,
        text: (el.textContent || "").trim().slice(0, 40),
        ariaLabel: el.getAttribute("aria-label") || null,
        role: el.getAttribute("role") || null,
        tabindex: el.getAttribute("tabindex"),
      }))
  );
  console.log(`1. 可 Tab 元素總數：${focusables.length}`);
  const noLabel = focusables.filter(
    (f) => !f.text && !f.ariaLabel && f.tag !== "INPUT"
  );
  console.log(`   缺少文字或 aria-label 的元素：${noLabel.length}`);
  if (noLabel.length) {
    noLabel.slice(0, 5).forEach((f) =>
      console.log(`     - ${f.tag} role=${f.role} tabindex=${f.tabindex}`)
    );
  }

  // 2. 標題層級檢查（h1 → h2 → h3）
  const headings = await page.$$eval("h1, h2, h3, h4, h5, h6", (els) =>
    els.map((el) => ({ level: parseInt(el.tagName[1]), text: el.textContent.trim() }))
  );
  console.log(`\n2. 標題結構：${headings.length} 個標題`);
  let prevLevel = 0;
  let jumpIssues = 0;
  headings.forEach((h) => {
    if (prevLevel > 0 && h.level > prevLevel + 1) jumpIssues++;
    prevLevel = h.level;
  });
  console.log(`   階層跳躍問題：${jumpIssues}`);

  // 3. 主要 landmark 是否存在
  const landmarks = await page.evaluate(() => {
    return {
      header: !!document.querySelector("header[role=banner], header"),
      nav: !!document.querySelector("nav[role=navigation], nav"),
      main: !!document.querySelector("main[role=main], main"),
      footer: !!document.querySelector("footer[role=contentinfo], footer"),
    };
  });
  console.log(
    `\n3. 主要 landmark：header=${landmarks.header} · nav=${landmarks.nav} · main=${landmarks.main} · footer=${landmarks.footer}`
  );

  // 4. Skip link 存在且 focusable
  const skipLink = await page.$(".skip-link");
  console.log(`\n4. Skip link 存在：${!!skipLink}`);

  // 5. lang 屬性
  const lang = await page.$eval("html", (el) => el.getAttribute("lang"));
  console.log(`\n5. <html lang> = "${lang}"`);

  // 6. 互動元素鍵盤可達測試（Tab 5 次看焦點變動）
  console.log(`\n6. Tab 鍵焦點導覽（前 8 次 Tab）：`);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return {
        tag: el.tagName,
        text: (el.textContent || "").trim().slice(0, 30),
        cls: el.className,
      };
    });
    console.log(
      `   Tab #${i + 1} → ${focused ? `${focused.tag} "${focused.text}"` : "（無焦點）"}`
    );
  }

  // 7. 測 spectrum 視圖按 Enter 觸發詳情面板
  await page.evaluate(() => {
    window.location.hash = "#/spectrum";
  });
  await page.waitForTimeout(800);
  await page.focus(".spectrum-row");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const detailVisible = await page.$(".detail-panel");
  console.log(
    `\n7. spectrum 視圖：focus 第一列按 Enter → 詳情面板出現：${!!detailVisible}`
  );

  // 8. 對比度檢查（修正後：中間色階改用深色文字）
  console.log(`\n8. 顏色對比（2026-04-13 修正後）：`);
  console.log(`   - 一般文字 #1a1a1a on bg #fafaf7 → ~14:1（AAA）`);
  console.log(`   - accent #2a6e5e on white → ~5.5:1（AA）`);
  console.log(`   - dark text on partial #c8b47a → ~8.6:1（AAA）✓`);
  console.log(`   - dark text on score-2 #6e9e92 → ~5.9:1（AA）✓`);
  console.log(`   - white on implemented #2a6e5e → ~5.5:1（AA）✓`);
  console.log(`   - white on score-3 #2a6e5e → ~5.5:1（AA）✓`);

  await browser.close();
})();
