/**
 * 第二輪補查：針對首輪未取得的關鍵資訊
 */

import { chromium } from "playwright";

const TIMEOUT = 45_000;

async function withPage(browser, url, label, fn) {
  const page = await browser.newPage();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${label}] ${url}`);
  console.log("=".repeat(60));
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
    // 給 SPA 額外渲染時間
    await page.waitForTimeout(5000);
    await fn(page);
  } catch (err) {
    console.log(`  ⚠ 錯誤: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function main() {
  console.log("第二輪補查");
  console.log(`執行時間: ${new Date().toISOString()}\n`);

  const browser = await chromium.launch({ headless: true });

  try {
    // ── TCMB OpenAPI 專區 ──
    await withPage(
      browser,
      "https://tcmb.culture.tw/zh-tw/openapi",
      "TCMB OpenAPI",
      async (page) => {
        const bodyText = await page.textContent("body");
        console.log(`  頁面文字（前 1500 字）:\n${bodyText.slice(0, 1500)}`);

        const links = await page.$$eval("a", (els) =>
          els
            .map((a) => ({ href: a.href, text: a.textContent.trim() }))
            .filter(
              (l) =>
                l.href.includes("api") ||
                l.text.includes("API") ||
                l.text.includes("swagger") ||
                l.text.includes("文件")
            )
        );
        if (links.length > 0) {
          console.log(`\n  API 相關連結:`);
          links.forEach((l) => console.log(`    - [${l.text}] ${l.href}`));
        }
      }
    );

    // ── TCMB 授權規範 ──
    await withPage(
      browser,
      "https://tcmb.culture.tw/zh-tw/cc_license",
      "TCMB 授權規範",
      async (page) => {
        const bodyText = await page.textContent("body");
        console.log(`  頁面文字（前 2000 字）:\n${bodyText.slice(0, 2000)}`);
      }
    );

    // ── TCMB 搜尋原住民（用不同搜尋路徑） ──
    await withPage(
      browser,
      "https://tcmb.culture.tw/zh-tw",
      "TCMB 站內搜尋原住民",
      async (page) => {
        // 嘗試找到搜尋框並輸入
        try {
          const searchInput = await page.$('input[type="search"], input[type="text"], input[placeholder*="搜尋"], input[name="query"], input[name="q"]');
          if (searchInput) {
            await searchInput.fill("原住民");
            await searchInput.press("Enter");
            await page.waitForTimeout(5000);

            const bodyText = await page.textContent("body");
            const countMatch = bodyText.match(
              /共\s*(\d[\d,]*)\s*筆|(\d[\d,]*)\s*筆|找到\s*(\d[\d,]*)|(\d[\d,]*)\s*件|(\d[\d,]*)\s*results/
            );
            if (countMatch) {
              const count = countMatch[1] || countMatch[2] || countMatch[3] || countMatch[4] || countMatch[5];
              console.log(`  搜尋「原住民」結果: ${count} 筆`);
            }

            // 抓分類
            const categories = await page.$$eval(
              ".facet, .filter, .category, [class*=filter], [class*=facet], [class*=category]",
              (els) => els.map((e) => e.textContent.trim().slice(0, 200))
            );
            if (categories.length > 0) {
              console.log(`  分類篩選:`);
              categories.forEach((c) => console.log(`    - ${c}`));
            }

            console.log(`  結果頁文字（前 1000 字）:\n${bodyText.slice(0, 1000)}`);
          } else {
            console.log("  找不到搜尋框");
          }
        } catch (err) {
          console.log(`  搜尋操作失敗: ${err.message}`);
        }
      }
    );

    // ── data.gov.tw — 用 domcontentloaded 策略 ──
    await withPage(
      browser,
      "https://data.gov.tw/datasets/search?qs=%E5%8E%9F%E4%BD%8F%E6%B0%91",
      "data.gov.tw 原住民搜尋 (重試)",
      async (page) => {
        await page.waitForTimeout(8000); // SPA 需要更多時間
        const bodyText = await page.textContent("body");

        const countMatch = bodyText.match(
          /共\s*(\d[\d,]*)\s*筆|找到\s*(\d[\d,]*)|(\d[\d,]*)\s*個資料集|搜尋結果\s*(\d[\d,]*)/
        );
        if (countMatch) {
          const count = countMatch[1] || countMatch[2] || countMatch[3] || countMatch[4];
          console.log(`  搜尋結果數量: ${count} 筆`);
        }

        // 抓取資料集標題
        const titles = await page.$$eval(
          "h3, h4, .dataset-item, [class*=dataset], [class*=title]",
          (els) =>
            els
              .map((e) => e.textContent.trim())
              .filter((t) => t.length > 5 && t.length < 100)
              .slice(0, 20)
        );
        if (titles.length > 0) {
          console.log(`  資料集標題:`);
          titles.forEach((t) => console.log(`    - ${t}`));
        }

        if (!countMatch && titles.length === 0) {
          console.log(`  頁面文字（前 1000 字）:\n${bodyText.slice(0, 1000)}`);
        }
      }
    );

    // ── 中研院：搜尋 TICD 相關 ──
    await withPage(
      browser,
      "https://www.google.com/search?q=site:sinica.edu.tw+%E5%8E%9F%E4%BD%8F%E6%B0%91%E9%83%A8%E8%90%BD%E8%B3%87%E6%96%99%E5%BA%AB+TICD",
      "Google 搜尋 TICD",
      async (page) => {
        await page.waitForTimeout(3000);
        const results = await page.$$eval("h3", (els) =>
          els.map((e) => e.textContent.trim()).slice(0, 10)
        );
        console.log(`  Google 搜尋結果:`);
        results.forEach((r) => console.log(`    - ${r}`));

        const links = await page.$$eval("#search a", (els) =>
          els
            .map((a) => ({ href: a.href, text: a.textContent.trim() }))
            .filter((l) => l.href.includes("sinica"))
            .slice(0, 10)
        );
        if (links.length > 0) {
          console.log(`  中研院相關連結:`);
          links.forEach((l) => console.log(`    - [${l.text}] ${l.href}`));
        }
      }
    );
  } finally {
    await browser.close();
  }

  console.log("\n" + "=".repeat(60));
  console.log("第二輪補查完成");
}

main().catch((err) => {
  console.error("腳本執行失敗:", err);
  process.exit(1);
});
