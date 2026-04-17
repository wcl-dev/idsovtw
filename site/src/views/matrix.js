// View 3：治理落差矩陣
// 5 來源 × 14 維度 = 70 格 heatmap，分為 4 框架類別
// 點選任一 cell 顯示完整 rationale 與 evidence

import { SOURCE_DISPLAY, escapeAndFormat } from "../lib/data.js";

// 4 框架與其維度（順序與 governance-matrix.yaml 一致）
const FRAMEWORKS = [
  {
    key: "CARE",
    label: "CARE 原則",
    dims: [
      { key: "collective_benefit", label: "集體利益" },
      { key: "authority_to_control", label: "控制權" },
      { key: "responsibility", label: "責任" },
      { key: "ethics", label: "倫理" },
    ],
  },
  {
    key: "OCAP",
    label: "OCAP",
    dims: [
      { key: "ownership", label: "所有權" },
      { key: "control", label: "控制" },
      { key: "access", label: "取用權" },
      { key: "possession", label: "持有" },
    ],
  },
  {
    key: "TK_Labels",
    label: "TK Labels",
    dims: [
      { key: "provenance", label: "文化來源" },
      { key: "protocol", label: "存取規範" },
      { key: "permission", label: "使用權限" },
    ],
  },
  {
    key: "localized",
    label: "在地化條款",
    dims: [
      { key: "consultation_consent", label: "諮商同意" },
      { key: "traditional_knowledge_protection", label: "傳統創作" },
      { key: "rights_respect_clause", label: "權益尊重" },
    ],
  },
];

// 分數的視覺與文字標示
const SCORE_DISPLAY = {
  none: { symbol: "·", label: "無" },
  partial: { symbol: "◐", label: "部分" },
  implemented: { symbol: "●", label: "實作" },
};

export function renderMatrix(bundle, root, selectedSource = null) {
  root.innerHTML = `
    <article class="view-matrix">
      <h2 class="view-title">治理落差矩陣</h2>
      <p class="view-subtitle">
        5 個資料來源 × 14 個原住民族集體權利治理維度的評估。點擊任一格子查看評分理由與依據。
      </p>

      <p class="view-description">
        本視圖衡量「這些資料來源對原住民族社群的集體權利回應到何程度」——
        不是衡量資料能不能拿（那是<a href="#/spectrum">可及性</a>視圖在做的事）。
        14 個維度來自四大框架：CARE 原則、OCAP、TK Labels，以及台灣<strong>在地化集體權利條款</strong>。
      </p>

      <div class="matrix-legend" role="note" aria-label="評分圖例">
        <span>評分：</span>
        <span class="matrix-legend-item">
          <span class="matrix-cell-mini" data-score="none">${SCORE_DISPLAY.none.symbol}</span>
          <span>無：完全沒有相關機制</span>
        </span>
        <span class="matrix-legend-item">
          <span class="matrix-cell-mini" data-score="partial">${SCORE_DISPLAY.partial.symbol}</span>
          <span>部分：有類似機制但未明確套用該框架</span>
        </span>
        <span class="matrix-legend-item">
          <span class="matrix-cell-mini" data-score="implemented">${SCORE_DISPLAY.implemented.symbol}</span>
          <span>實作：明確採用該框架</span>
        </span>
      </div>

      <div class="matrix-scroll">
        ${renderTable(bundle)}
      </div>

      <div id="matrix-detail" aria-live="polite"></div>
    </article>
  `;

  attachInteractions(bundle, root);

  // 由跨視圖連結帶 source 進來時：高亮整列並捲到該列
  if (selectedSource) {
    requestAnimationFrame(() => {
      const row = root.querySelector(
        `tr[data-source-row="${selectedSource}"]`
      );
      if (row) {
        row.classList.add("source-row-highlighted");
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }
}

function renderTable(bundle) {
  // 來源排序：依治理回應格數由高至低
  const sortedSources = [...bundle.meta.source_order].sort(
    (a, b) =>
      bundle.governance.aggregates[b].nonNone -
      bundle.governance.aggregates[a].nonNone
  );

  // 表頭：兩層——框架類別 + 維度名
  const frameworkHeaderCells = FRAMEWORKS.map(
    (fw) =>
      `<th class="matrix-fw-header" colspan="${fw.dims.length}" data-framework="${fw.key}">${fw.label}</th>`
  ).join("");

  const dimHeaderCells = FRAMEWORKS.flatMap((fw) =>
    fw.dims.map(
      (d) =>
        `<th class="matrix-dim-header" data-framework="${fw.key}" title="${fw.label}：${d.label}">${d.label}</th>`
    )
  ).join("");

  // 主體：每來源一列
  const bodyRows = sortedSources
    .map((id) => {
      const disp = SOURCE_DISPLAY[id];
      const agg = bundle.governance.aggregates[id];
      const cells = FRAMEWORKS.flatMap((fw) =>
        fw.dims.map((d) => {
          const cell = bundle.governance.sources[id].scores[fw.key][d.key];
          const score = cell.score;
          return `<td class="matrix-cell" data-source="${id}" data-framework="${fw.key}" data-dim="${d.key}" data-score="${score}" tabindex="0" role="button" aria-label="${disp.full}：${fw.label}-${d.label}：${SCORE_DISPLAY[score].label}">${SCORE_DISPLAY[score].symbol}</td>`;
        })
      ).join("");
      return `
        <tr data-source-row="${id}">
          <th class="matrix-source-cell" scope="row">
            <span class="source-name">${disp.full}</span>
            <span class="source-tally">${agg.nonNone}/14</span>
          </th>
          ${cells}
        </tr>
      `;
    })
    .join("");

  return `
    <table class="matrix-table">
      <thead>
        <tr>
          <th rowspan="2" class="matrix-corner">資料來源 <span class="dim-axis-hint">→ 治理維度</span></th>
          ${frameworkHeaderCells}
        </tr>
        <tr>
          ${dimHeaderCells}
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `;
}

function attachInteractions(bundle, root) {
  const detail = root.querySelector("#matrix-detail");
  root.querySelectorAll(".matrix-cell").forEach((cell) => {
    const select = () => {
      root.querySelectorAll(".matrix-cell.active").forEach((c) =>
        c.classList.remove("active")
      );
      cell.classList.add("active");
      renderDetail(bundle, cell.dataset, detail);
    };
    cell.addEventListener("click", select);
    cell.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        select();
      }
    });
  });
}

function renderDetail(bundle, dataset, container) {
  const { source, framework, dim, score } = dataset;
  const disp = SOURCE_DISPLAY[source];
  const fw = FRAMEWORKS.find((f) => f.key === framework);
  const d = fw.dims.find((x) => x.key === dim);
  const cell = bundle.governance.sources[source].scores[framework][dim];

  const evidenceHtml = cell.evidence_refs && cell.evidence_refs.length
    ? cell.evidence_refs.map((ref) => `<code>${escapeAndFormat(ref)}</code>`).join(" · ")
    : "（此格為「無」評分，無需附證據；前提是已實際檢查過該來源相關文件）";

  container.innerHTML = `
    <div class="detail-panel">
      <h3>${disp.full}</h3>
      <p class="detail-meta">
        ${fw.label} · <strong>${d.label}</strong>
        <span class="detail-dim-score" data-score="${score}">${SCORE_DISPLAY[score].symbol} ${SCORE_DISPLAY[score].label}</span>
      </p>
      <p class="detail-rationale">${escapeAndFormat(cell.rationale || "（未提供理由）")}</p>
      <p class="detail-evidence">證據：${evidenceHtml}</p>
      <p class="detail-cross-links">
        <a href="#/spectrum/${source}">→ 查看可及性詳情</a> ·
        <a href="#/scatter/${source}">→ 在散點圖中定位</a> ·
        <a href="#/units/${source}">→ 查看資料單位</a>
      </p>
    </div>
  `;
  container.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
