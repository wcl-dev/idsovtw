/**
 * 資料來源盤點腳本
 * 使用 Playwright 模擬瀏覽器，抓取動態渲染網站的實際內容
 *
 * 待確認項目：
 * 1. data.cip.gov.tw — 資料集列表與數量
 * 2. data.gov.tw — 搜尋「原住民」的資料集數量與涵蓋範圍
 * 3. 中研院 TICD 現行狀態
 * 4. AILT — 下載或 API 存取方式
 * 5. TCMB — API 文件、原住民族相關典藏規模
 * 6. 各平台 metadata 欄位實際填寫狀態
 */

import { chromium } from "playwright";

const TIMEOUT = 30_000;

async function withPage(browser, url, label, fn) {
  const page = await browser.newPage();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[${label}] ${url}`);
  console.log("=".repeat(60));
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: TIMEOUT });
    await fn(page);
  } catch (err) {
    console.log(`  ⚠ 錯誤: ${err.message}`);
  } finally {
    await page.close();
  }
}

async function auditCIP(browser) {
  // 1. 原住民族開放資料平台 — 資料集列表
  await withPage(
    browser,
    "https://data.cip.gov.tw/",
    "原民會開放資料",
    async (page) => {
      // 嘗試找到資料集列表或搜尋入口
      const title = await page.title();
      console.log(`  頁面標題: ${title}`);

      // 嘗試取得主頁上的資料集數量或分類
      const bodyText = await page.textContent("body");
      // 找數字相關的統計資訊
      const statsMatch = bodyText.match(/共\s*(\d[\d,]*)\s*筆/);
      if (statsMatch) {
        console.log(`  資料集數量: ${statsMatch[1]} 筆`);
      }

      // 嘗試導覽到資料集列表頁
      const links = await page.$$eval("a", (els) =>
        els
          .map((a) => ({ href: a.href, text: a.textContent.trim() }))
          .filter(
            (l) =>
              l.text.includes("資料") ||
              l.text.includes("dataset") ||
              l.text.includes("查詢")
          )
      );
      console.log(
        `  相關連結: ${JSON.stringify(links.slice(0, 10), null, 2)}`
      );

      // 嘗試直接到資料集列表頁
      try {
        await page.goto("https://data.cip.gov.tw/dataset", {
          waitUntil: "networkidle",
          timeout: TIMEOUT,
        });
        const listText = await page.textContent("body");
        const listStats = listText.match(/共\s*(\d[\d,]*)\s*筆/);
        if (listStats) {
          console.log(`  資料集列表頁數量: ${listStats[1]} 筆`);
        }

        // 嘗試抓取前幾筆資料集名稱
        const datasets = await page.$$eval(
          ".dataset-heading, .dataset-item, h3 a, .title a",
          (els) => els.slice(0, 15).map((e) => e.textContent.trim())
        );
        if (datasets.length > 0) {
          console.log(`  前 ${datasets.length} 筆資料集:`);
          datasets.forEach((d) => console.log(`    - ${d}`));
        } else {
          // 備用：抓取所有 h3 或有意義的文字
          const headings = await page.$$eval("h3, h4, .card-title", (els) =>
            els.slice(0, 15).map((e) => e.textContent.trim())
          );
          if (headings.length > 0) {
            console.log(`  頁面標題元素:`);
            headings.forEach((h) => console.log(`    - ${h}`));
          }
          console.log(`  頁面文字片段: ${listText.slice(0, 500)}`);
        }
      } catch (err) {
        console.log(`  ⚠ 資料集列表頁存取失敗: ${err.message}`);
      }
    }
  );
}

async function auditDataGov(browser) {
  // 2. 政府資料開放平臺 — 搜尋「原住民」
  await withPage(
    browser,
    "https://data.gov.tw/datasets/search?qs=%E5%8E%9F%E4%BD%8F%E6%B0%91",
    "data.gov.tw 原住民搜尋",
    async (page) => {
      const title = await page.title();
      console.log(`  頁面標題: ${title}`);

      // 等待搜尋結果渲染
      await page.waitForTimeout(3000);

      const bodyText = await page.textContent("body");

      // 找搜尋結果數量
      const countMatch = bodyText.match(
        /共\s*(\d[\d,]*)\s*筆|找到\s*(\d[\d,]*)\s*筆|(\d[\d,]*)\s*個資料集|(\d[\d,]*)\s*results?/
      );
      if (countMatch) {
        const count = countMatch[1] || countMatch[2] || countMatch[3] || countMatch[4];
        console.log(`  搜尋「原住民」結果數量: ${count} 筆`);
      }

      // 抓取前幾筆搜尋結果
      const results = await page.$$eval(
        ".dataset-item h3, .dataset-item .title, .dataset-heading a, h3 a",
        (els) => els.slice(0, 15).map((e) => e.textContent.trim())
      );
      if (results.length > 0) {
        console.log(`  前 ${results.length} 筆搜尋結果:`);
        results.forEach((r) => console.log(`    - ${r}`));
      }

      // 抓取提供機關資訊
      const agencies = await page.$$eval(
        ".agency, .provider, .organization",
        (els) => [...new Set(els.map((e) => e.textContent.trim()))]
      );
      if (agencies.length > 0) {
        console.log(`  涉及機關: ${agencies.join(", ")}`);
      }

      // 抓取格式標籤
      const formats = await page.$$eval(".format, .tag, .badge", (els) =>
        [...new Set(els.map((e) => e.textContent.trim()))].filter((t) =>
          /csv|json|xml|api|xls/i.test(t)
        )
      );
      if (formats.length > 0) {
        console.log(`  資料格式: ${formats.join(", ")}`);
      }

      // 如果上面都沒抓到，輸出頁面前段文字供分析
      if (!countMatch && results.length === 0) {
        console.log(`  頁面文字片段: ${bodyText.slice(0, 800)}`);
      }
    }
  );
}

async function auditTICD(browser) {
  // 3. 中研院 TICD — 嘗試找到部落資料庫入口
  const urls = [
    "https://www.rchss.sinica.edu.tw/",
    "https://ianthro.tw/",
  ];

  for (const url of urls) {
    await withPage(browser, url, "中研院 TICD 搜尋", async (page) => {
      const title = await page.title();
      console.log(`  頁面標題: ${title}`);

      const bodyText = await page.textContent("body");
      // 搜尋關鍵字
      const keywords = ["部落", "TICD", "原住民", "Indigenous", "tribe", "community"];
      for (const kw of keywords) {
        if (bodyText.includes(kw)) {
          const idx = bodyText.indexOf(kw);
          console.log(
            `  找到「${kw}」: ...${bodyText.slice(Math.max(0, idx - 30), idx + 50).replace(/\s+/g, " ")}...`
          );
        }
      }

      // 找相關連結
      const links = await page.$$eval("a", (els) =>
        els
          .map((a) => ({ href: a.href, text: a.textContent.trim() }))
          .filter(
            (l) =>
              l.text.includes("部落") ||
              l.text.includes("原住民") ||
              l.text.includes("TICD") ||
              l.text.includes("Indigenous") ||
              l.href.includes("indigenous") ||
              l.href.includes("ticd")
          )
      );
      if (links.length > 0) {
        console.log(`  相關連結:`);
        links.forEach((l) => console.log(`    - [${l.text}] ${l.href}`));
      } else {
        console.log(`  未找到原住民/部落相關連結`);
      }
    });
  }
}

async function auditAILT(browser) {
  // 4. AILT — 下載與 API 存取方式
  await withPage(
    browser,
    "https://ailt.ilrdf.org.tw/",
    "AILT 語言資料庫",
    async (page) => {
      const title = await page.title();
      console.log(`  頁面標題: ${title}`);

      const bodyText = await page.textContent("body");

      // 搜尋下載/API 相關關鍵字
      const keywords = ["下載", "download", "API", "匯出", "export", "授權", "使用條款", "開放", "申請"];
      for (const kw of keywords) {
        if (bodyText.toLowerCase().includes(kw.toLowerCase())) {
          const idx = bodyText.toLowerCase().indexOf(kw.toLowerCase());
          console.log(
            `  找到「${kw}」: ...${bodyText.slice(Math.max(0, idx - 40), idx + 60).replace(/\s+/g, " ")}...`
          );
        }
      }

      // 找所有導覽連結
      const navLinks = await page.$$eval("a, button", (els) =>
        els
          .map((e) => ({
            tag: e.tagName,
            href: e.href || "",
            text: e.textContent.trim(),
          }))
          .filter(
            (l) =>
              l.text.includes("下載") ||
              l.text.includes("API") ||
              l.text.includes("使用") ||
              l.text.includes("條款") ||
              l.text.includes("授權") ||
              l.text.includes("關於") ||
              l.text.includes("about") ||
              l.href.includes("api") ||
              l.href.includes("download") ||
              l.href.includes("terms") ||
              l.href.includes("about")
          )
      );
      console.log(`  相關連結與按鈕:`);
      navLinks.forEach((l) =>
        console.log(`    - [${l.tag}] ${l.text} → ${l.href}`)
      );

      // 進入典藏資料頁面看看有沒有下載選項
      try {
        await page.goto("https://ailt.ilrdf.org.tw/ethnicity/search?lang=1", {
          waitUntil: "networkidle",
          timeout: TIMEOUT,
        });
        await page.waitForTimeout(2000);

        const detailText = await page.textContent("body");
        const hasDownload = /下載|download|匯出|export/i.test(detailText);
        console.log(`  語料頁面是否有下載選項: ${hasDownload ? "是" : "否"}`);

        // 看看個別語料項目的操作選項
        const actions = await page.$$eval(
          "button, a.btn, .action, .download",
          (els) => els.map((e) => e.textContent.trim()).filter(Boolean)
        );
        if (actions.length > 0) {
          console.log(`  可用操作: ${actions.slice(0, 20).join(", ")}`);
        }
      } catch (err) {
        console.log(`  ⚠ 語料頁面存取失敗: ${err.message}`);
      }
    }
  );
}

async function auditTCMB(browser) {
  // 5. TCMB — API 文件、原住民族相關典藏規模
  await withPage(
    browser,
    "https://tcmb.culture.tw/zh-tw",
    "國家文化記憶庫",
    async (page) => {
      const title = await page.title();
      console.log(`  頁面標題: ${title}`);

      await page.waitForTimeout(3000);
      const bodyText = await page.textContent("body");

      // 搜尋 API / 開放資料相關
      const keywords = ["API", "開放", "下載", "授權", "Creative Commons", "CC BY", "著作權"];
      for (const kw of keywords) {
        if (bodyText.includes(kw)) {
          const idx = bodyText.indexOf(kw);
          console.log(
            `  找到「${kw}」: ...${bodyText.slice(Math.max(0, idx - 40), idx + 60).replace(/\s+/g, " ")}...`
          );
        }
      }

      // 抓取頁面上的統計數字
      const numbers = bodyText.match(/(\d[\d,]{2,})\s*筆|(\d[\d,]{2,})\s*件|共\s*(\d[\d,]*)/g);
      if (numbers) {
        console.log(`  統計數字: ${numbers.join(", ")}`);
      }
    }
  );

  // 搜尋「原住民」看有多少結果
  await withPage(
    browser,
    "https://tcmb.culture.tw/zh-tw/search?query=%E5%8E%9F%E4%BD%8F%E6%B0%91",
    "TCMB 原住民搜尋",
    async (page) => {
      await page.waitForTimeout(5000);
      const bodyText = await page.textContent("body");

      const countMatch = bodyText.match(
        /共\s*(\d[\d,]*)\s*筆|(\d[\d,]*)\s*筆結果|找到\s*(\d[\d,]*)|(\d[\d,]*)\s*件/
      );
      if (countMatch) {
        const count = countMatch[1] || countMatch[2] || countMatch[3] || countMatch[4];
        console.log(`  搜尋「原住民」結果數量: ${count}`);
      }

      // 抓取前幾筆結果
      const results = await page.$$eval(
        ".search-result h3, .card-title, .item-title, h3, h4",
        (els) => els.slice(0, 10).map((e) => e.textContent.trim()).filter(Boolean)
      );
      if (results.length > 0) {
        console.log(`  前 ${results.length} 筆結果:`);
        results.forEach((r) => console.log(`    - ${r}`));
      }

      // 看看有沒有分類/facet
      const facets = await page.$$eval(
        ".facet, .filter-group, .category",
        (els) => els.map((e) => e.textContent.trim().slice(0, 100))
      );
      if (facets.length > 0) {
        console.log(`  分類/篩選:`);
        facets.forEach((f) => console.log(`    - ${f}`));
      }

      if (!countMatch && results.length === 0) {
        console.log(`  頁面文字片段: ${bodyText.slice(0, 800)}`);
      }
    }
  );

  // 嘗試找 API 文件
  await withPage(
    browser,
    "https://tcmb.culture.tw/zh-tw/api",
    "TCMB API 頁面",
    async (page) => {
      const title = await page.title();
      const bodyText = await page.textContent("body");
      console.log(`  頁面標題: ${title}`);
      console.log(`  頁面文字片段: ${bodyText.slice(0, 500)}`);
    }
  );
}

// ── 主程式 ──

async function main() {
  console.log("台灣原住民族資料來源盤點 — Playwright 自動勘查");
  console.log(`執行時間: ${new Date().toISOString()}\n`);

  const browser = await chromium.launch({ headless: true });

  try {
    await auditCIP(browser);
    await auditDataGov(browser);
    await auditTICD(browser);
    await auditAILT(browser);
    await auditTCMB(browser);
  } finally {
    await browser.close();
  }

  console.log("\n" + "=".repeat(60));
  console.log("盤點完成");
}

main().catch((err) => {
  console.error("腳本執行失敗:", err);
  process.exit(1);
});
