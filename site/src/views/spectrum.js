// View 1：可及性（內部 ID：spectrum；對應資料 access-tiers.yaml）
// 5 來源 × 6 維度的 stacked 條狀矩陣；點選展開詳情

import { ACCESS_DIMENSIONS, SOURCE_DISPLAY, escapeAndFormat } from "../lib/data.js";

export function renderSpectrum(bundle, root, selectedSource = null) {
  const sortedSources = [...bundle.meta.source_order].sort(
    (a, b) =>
      bundle.access.aggregates[b].total - bundle.access.aggregates[a].total
  );

  const html = `
    <article class="view-spectrum">
      <h2 class="view-title">可及性</h2>
      <p class="view-subtitle">
        5 個資料來源 × 6 個可及性維度的評分。單點格子或整列查看評分依據。
      </p>

      <p class="view-description">
        本視圖衡量「外部使用者能多容易取用資料」——高分代表技術上開放。
        <strong>但高分不代表對原住民族社群友善</strong>。若想了解社群權利回應度，請同時查看
        <a href="#/matrix">治理落差</a>與
        <a href="#/scatter">抽取 × 治理 2D 散點圖</a>。
      </p>

      <div class="spectrum-legend" role="note" aria-label="分數圖例">
        <span>分數：</span>
        <span class="spectrum-legend-item">
          <span class="spectrum-legend-swatch" style="background:var(--score-0)"></span>
          <span>0 最嚴重障礙</span>
        </span>
        <span class="spectrum-legend-item">
          <span class="spectrum-legend-swatch" style="background:var(--score-1)"></span>
          <span>1 明顯障礙</span>
        </span>
        <span class="spectrum-legend-item">
          <span class="spectrum-legend-swatch" style="background:var(--score-2)"></span>
          <span>2 一般門檻</span>
        </span>
        <span class="spectrum-legend-item">
          <span class="spectrum-legend-swatch" style="background:var(--score-3)"></span>
          <span>3 無障礙</span>
        </span>
      </div>

      <div class="spectrum-axis-header" aria-hidden="true">
        <span>來源</span>
        <div class="dims">
          ${ACCESS_DIMENSIONS.map((d) => `<span>${d.short}</span>`).join("")}
        </div>
        <span>總分 /18</span>
      </div>

      <div class="spectrum-table" role="table" aria-label="可及性矩陣">
        ${sortedSources.map((id) => renderRow(bundle, id)).join("")}
      </div>

      <div id="spectrum-detail" aria-live="polite"></div>
    </article>
  `;

  root.innerHTML = html;

  // 事件：點選列展開詳情
  root.querySelectorAll(".spectrum-row").forEach((row) => {
    row.addEventListener("click", () => {
      const sourceId = row.dataset.source;
      root.querySelectorAll(".spectrum-row.active").forEach((r) =>
        r.classList.remove("active")
      );
      row.classList.add("active");
      renderDetail(bundle, sourceId, root.querySelector("#spectrum-detail"));
    });
    // 鍵盤支援
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        row.click();
      }
    });
  });

  // 若由跨視圖連結帶 source 進來，自動展開
  if (selectedSource) {
    requestAnimationFrame(() => {
      const target = root.querySelector(
        `.spectrum-row[data-source="${selectedSource}"]`
      );
      if (target) target.click();
    });
  }
}

function renderRow(bundle, id) {
  const agg = bundle.access.aggregates[id];
  const scores = bundle.access.sources[id];
  const disp = SOURCE_DISPLAY[id];

  const cells = ACCESS_DIMENSIONS.map((d) => {
    const score = scores[d.key].score;
    return `<span class="spectrum-cell" data-score="${score}" title="${d.label}：${score}/3">${score}</span>`;
  }).join("");

  return `
    <div class="spectrum-row" data-source="${id}" role="row" tabindex="0" aria-label="${disp.full} 展開詳情">
      <div class="spectrum-label">
        ${disp.full}
        <span class="source-id">${disp.short}</span>
      </div>
      <div class="spectrum-bar">${cells}</div>
      <div class="spectrum-total">${agg.total}<span class="max">/18</span></div>
    </div>
  `;
}

function renderDetail(bundle, id, container) {
  const scores = bundle.access.sources[id];
  const disp = SOURCE_DISPLAY[id];
  const source = bundle.sources[id];

  const dimsHtml = ACCESS_DIMENSIONS.map((d) => {
    const cell = scores[d.key];
    const evidenceHtml = cell.evidence_refs
      .map((ref) => `<code>${ref}</code>`)
      .join(" · ");
    return `
      <div class="detail-dim">
        <div class="detail-dim-header">
          <span class="detail-dim-name">${d.label}</span>
          <span class="detail-dim-score" data-score="${cell.score}">${cell.score} / 3</span>
        </div>
        <p class="detail-rationale">${escapeAndFormat(cell.rationale)}</p>
        <p class="detail-evidence">佐證：${evidenceHtml}</p>
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="detail-panel">
      <h3>${disp.full}</h3>
      <p class="detail-meta">
        <a href="${source.url_primary}" target="_blank" rel="noopener noreferrer">${source.url_primary}</a>
        · 主管機構：${source.governing_agency.name_zh}
      </p>
      <p class="detail-cross-links">
        <a href="#/scatter/${id}">→ 在散點圖中定位</a> ·
        <a href="#/matrix/${id}">→ 查看治理落差</a>
      </p>
      <div class="detail-dims">${dimsHtml}</div>
    </div>
  `;
  container.scrollIntoView({ behavior: "smooth", block: "start" });
}
