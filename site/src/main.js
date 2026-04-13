// 主入口：載入 bundle、初始化路由、渲染對應視圖

import { loadBundle } from "./lib/data.js";
import { renderSpectrum } from "./views/spectrum.js";
import { renderScatter } from "./views/scatter.js";
import { renderMatrix } from "./views/matrix.js";
import { renderUnits } from "./views/units.js";

const VIEW_RENDERERS = {
  "": renderLanding,
  spectrum: renderSpectrum,
  scatter: renderScatter,
  matrix: renderMatrix,
  units: renderUnits,
};

async function main() {
  try {
    const bundle = await loadBundle();
    updateBundleMeta(bundle);
    const viewRoot = document.getElementById("view-root");
    const renderCurrent = () => {
      const { view, selectedSource } = parseHash();
      markActiveNav(view);
      const renderer = VIEW_RENDERERS[view] || VIEW_RENDERERS[""];
      // 清空舊內容（避免上一視圖的詳情面板殘留）
      viewRoot.innerHTML = "";
      // 各視圖自行決定如何處理 selectedSource（auto-click 或高亮整列等）
      renderer(bundle, viewRoot, selectedSource);
    };
    window.addEventListener("hashchange", renderCurrent);
    renderCurrent();
  } catch (err) {
    console.error(err);
    document.getElementById("view-root").innerHTML = `
      <p class="loading" role="alert">
        載入失敗：${err.message}<br>
        請確認 site/public/data/bundle.json 已產生（<code>npm run build-data</code>）。
      </p>
    `;
  }
}

/**
 * 解析 hash 為 { view, selectedSource }
 * 支援格式：
 *   #/                  → 首頁
 *   #/spectrum          → spectrum 視圖、無預選來源
 *   #/spectrum/cip      → spectrum 視圖、預選 CIP
 */
function parseHash() {
  const hash = window.location.hash || "";
  const cleaned = hash.replace(/^#\/?/, "");
  const [view, selectedSource] = cleaned.split("/");
  return { view: view || "", selectedSource: selectedSource || null };
}

function markActiveNav(view) {
  document.querySelectorAll(".main-nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === view);
  });
}

function updateBundleMeta(bundle) {
  const el = document.getElementById("bundle-generated");
  if (!el) return;
  const d = new Date(bundle.generated_at);
  const formatted = d.toISOString().slice(0, 10);
  el.textContent = `資料更新時間：${formatted}`;
}

function renderLanding(bundle, root) {
  const totalSources = bundle.meta.source_order.length;
  root.innerHTML = `
    <article class="landing">
      <h2>這是什麼</h2>
      <p class="landing-intro">
        台灣原住民族相關資料散布於多個平台與機構，它們的可及性條件、治理機制、社群回應度
        高度不一致。本工具是一個<strong>倡議型基礎設施探針</strong>——以詮釋資料為核心，
        揭露 ${totalSources} 個主要資料來源之間的斷裂、技術門檻差異與治理空白。
      </p>
      <p>
        本工具<strong>不整合資料</strong>、不做搜尋、也不對接 API——它僅呈現既有資料地景的
        結構問題，供研究者、非營利組織、資助方、政策單位與原住民族社群共同參照討論。
      </p>

      <h3 style="margin-top:2em;">四個視圖</h3>
      <div class="landing-cards">
        <a class="landing-card" href="#/spectrum">
          <h3>可及性</h3>
          <p>6 維度評分——對外部使用者的可取用程度</p>
        </a>
        <a class="landing-card" href="#/matrix">
          <h3>治理落差矩陣</h3>
          <p>14 維度評分——對原住民族社群的權利回應</p>
        </a>
        <a class="landing-card" href="#/scatter">
          <h3>抽取 × 治理</h3>
          <p>2D 散點圖——兩個分析軸的交叉位置</p>
        </a>
        <a class="landing-card" href="#/units">
          <h3>資料單位對應</h3>
          <p>行政區、部落、族群、典藏物件等單位間的不可對應性</p>
        </a>
      </div>
    </article>
  `;
}

function renderTodo(name) {
  return (_bundle, root) => {
    root.innerHTML = `
      <article>
        <h2 class="view-title">${name}</h2>
        <p class="view-subtitle">此視圖尚未實作，預計於後續階段交付。</p>
        <p><a href="#/">← 回首頁</a></p>
      </article>
    `;
  };
}

main();
