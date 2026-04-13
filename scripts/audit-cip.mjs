/**
 * 針對 data.cip.gov.tw 的反自動化偵測測試
 */
import { chromium } from "playwright";

async function main() {
  // 嘗試不同策略
  const strategies = [
    {
      name: "策略1: 真實 User-Agent + 非 headless",
      launch: { headless: false, channel: "msedge" },
      ua: null,
    },
    {
      name: "策略2: headless + 偽裝 UA",
      launch: { headless: true },
      ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    {
      name: "策略3: headless: new (新版 headless)",
      launch: { headless: true, args: ["--headless=new"] },
      ua: null,
    },
  ];

  for (const strat of strategies) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(strat.name);
    console.log("=".repeat(50));

    let browser;
    try {
      browser = await chromium.launch(strat.launch);
      const context = await browser.newContext(
        strat.ua ? { userAgent: strat.ua } : {}
      );
      const page = await context.newPage();

      // 監聽 response 狀態碼
      page.on("response", (response) => {
        if (response.url().includes("cip.gov.tw")) {
          console.log(`  [Response] ${response.status()} ${response.url().slice(0, 80)}`);
        }
      });

      await page.goto("https://data.cip.gov.tw/", {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(5000);

      const title = await page.title();
      const bodyText = await page.textContent("body");
      const hasError = bodyText.includes("error") || bodyText.includes("Error") || bodyText.includes("Sorry");

      console.log(`  標題: ${title}`);
      console.log(`  含錯誤訊息: ${hasError}`);
      console.log(`  頁面長度: ${bodyText.length} 字元`);

      if (!hasError && bodyText.length > 200) {
        console.log(`  頁面文字（前 800 字）:\n${bodyText.slice(0, 800)}`);

        // 嘗試找資料集
        const links = await page.$$eval("a", (els) =>
          els
            .map((a) => ({ href: a.href, text: a.textContent.trim() }))
            .filter((l) => l.text.length > 2)
            .slice(0, 20)
        );
        console.log(`\n  連結 (前 20):`);
        links.forEach((l) => console.log(`    - [${l.text}] ${l.href}`));
      } else {
        console.log(`  前 300 字: ${bodyText.slice(0, 300)}`);
      }

      await browser.close();
    } catch (err) {
      console.log(`  ⚠ 失敗: ${err.message}`);
      if (browser) await browser.close();
    }
  }
}

main();
