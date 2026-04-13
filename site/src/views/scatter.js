// View 2：抽取 × 治理 2D 散點圖
// X 軸 = 可及性總分（M3，0-18）；Y 軸 = 治理回應格數（M2 非 none，0-14）
// 視覺核心：「沒有任何來源在右上理想象限」

import * as d3 from "d3";
import { SOURCE_DISPLAY } from "../lib/data.js";

const MAX_X = 18;
const MAX_Y = 14;
const MARGIN = { top: 50, right: 40, bottom: 70, left: 70 };

export function renderScatter(bundle, root, selectedSource = null) {
  root.innerHTML = `
    <article class="view-scatter">
      <h2 class="view-title">抽取 × 治理 2D 散點圖</h2>
      <p class="view-subtitle">
        把可及性與治理放在同一張圖上——揭露兩個分析軸的位置關係。
      </p>

      <p class="view-description">
        <strong>右上角是理想象限</strong>（資料對外開放且尊重原住民族集體權利）。
        <strong>右下角是殖民式抽取象限</strong>（資料極易被外人取用但完全不回應社群）。
        點擊圓點檢視細節。
      </p>

      <div class="scatter-container" id="scatter-container"></div>

      <div id="scatter-detail" aria-live="polite"></div>
    </article>
  `;

  const container = document.getElementById("scatter-container");
  drawScatter(bundle, container);

  // 響應式：視窗 resize 時重繪（debounced）
  const handleResize = debounce(() => {
    if (!document.body.contains(container)) {
      window.removeEventListener("resize", handleResize);
      return;
    }
    drawScatter(bundle, container);
  }, 200);
  window.addEventListener("resize", handleResize);

  if (selectedSource) {
    requestAnimationFrame(() => {
      const target = document.querySelector(
        `.scatter-point-group[data-source="${selectedSource}"]`
      );
      if (target) target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }
}

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function drawScatter(bundle, container) {
  // 響應式：依容器寬度決定 SVG 大小
  const width = Math.min(container.clientWidth || 720, 720);
  const height = 520;
  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  // 清空舊圖
  container.innerHTML = "";

  const svg = d3
    .select(container)
    .append("svg")
    .attr("class", "scatter-svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", height)
    .attr("role", "img")
    .attr("aria-label", "可及性與治理回應的二維散點圖");

  const g = svg
    .append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  // 軸尺度
  const x = d3.scaleLinear().domain([0, MAX_X]).range([0, innerW]);
  const y = d3.scaleLinear().domain([0, MAX_Y]).range([innerH, 0]);

  // 象限分隔線（中位線）
  g.append("line")
    .attr("class", "scatter-quadrant-line")
    .attr("x1", x(MAX_X / 2))
    .attr("x2", x(MAX_X / 2))
    .attr("y1", 0)
    .attr("y2", innerH);
  g.append("line")
    .attr("class", "scatter-quadrant-line")
    .attr("x1", 0)
    .attr("x2", innerW)
    .attr("y1", y(MAX_Y / 2))
    .attr("y2", y(MAX_Y / 2));

  // 象限標籤——統一放置於各象限的左上角，全部 left-aligned
  const quadrantLabels = [
    // 右上：理想象限
    {
      x: x(MAX_X / 2 + 0.3),
      y: y(MAX_Y - 0.5),
      text: "理想象限",
      sub: "易取用 + 尊重社群",
    },
    // 右下：殖民式抽取
    {
      x: x(MAX_X / 2 + 0.3),
      y: y(MAX_Y / 2 - 0.5),
      text: "殖民式抽取",
      sub: "易取用 + 不回應社群",
    },
    // 左上：社群中心
    {
      x: x(0.3),
      y: y(MAX_Y - 0.5),
      text: "社群中心",
      sub: "限制取用 + 尊重社群",
    },
    // 左下：封閉
    {
      x: x(0.3),
      y: y(MAX_Y / 2 - 0.5),
      text: "封閉",
      sub: "限制取用 + 不回應社群",
    },
  ];
  quadrantLabels.forEach((q) => {
    const text = g
      .append("text")
      .attr("class", "scatter-quadrant-label")
      .attr("x", q.x)
      .attr("y", q.y)
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "hanging");
    text.append("tspan").text(q.text);
    text
      .append("tspan")
      .attr("class", "scatter-quadrant-sub")
      .attr("x", q.x)
      .attr("dy", "1.3em")
      .attr("text-anchor", "start")
      .text(q.sub);
  });

  // 軸
  g.append("g")
    .attr("class", "scatter-axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(6));
  g.append("g")
    .attr("class", "scatter-axis")
    .call(d3.axisLeft(y).ticks(7));

  // 軸標題
  g.append("text")
    .attr("class", "scatter-axis-title")
    .attr("x", innerW / 2)
    .attr("y", innerH + 50)
    .attr("text-anchor", "middle")
    .text("可及性總分（對外部使用者的可取用程度，越高越開放）→");
  g.append("text")
    .attr("class", "scatter-axis-title")
    .attr("transform", `translate(-50,${innerH / 2})rotate(-90)`)
    .attr("text-anchor", "middle")
    .text("↑ 治理回應格數（對社群的權利回應，越高越尊重）");

  // 資料點
  const points = g
    .selectAll(".scatter-point-group")
    .data(bundle.scatter)
    .enter()
    .append("g")
    .attr("class", "scatter-point-group")
    .attr("transform", (d) => `translate(${x(d.access_total)},${y(d.governance_nonNone)})`)
    .attr("data-source", (d) => d.id)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr(
      "aria-label",
      (d) =>
        `${SOURCE_DISPLAY[d.id].full}：可及性 ${d.access_total} 分（滿分 18），治理回應 ${d.governance_nonNone} 格（滿分 14）`
    )
    .style("cursor", "pointer");

  points.append("circle").attr("class", "scatter-point").attr("r", 8);

  // 原生 SVG title——hover 時瀏覽器顯示原住民族來源全名與分數
  points
    .append("title")
    .text(
      (d) =>
        `${SOURCE_DISPLAY[d.id].full}（可及性 ${d.access_total}/18 · 治理回應 ${d.governance_nonNone}/14）`
    );

  // 互動事件
  const detailEl = document.getElementById("scatter-detail");
  points.on("click", (_, d) => {
    points.classed("active", false);
    d3.select(_.currentTarget).classed("active", true);
    renderDetail(bundle, d, detailEl);
  });
  points.on("keydown", (e, d) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      points.classed("active", false);
      d3.select(e.currentTarget).classed("active", true);
      renderDetail(bundle, d, detailEl);
    }
  });
}

function renderDetail(bundle, point, container) {
  const disp = SOURCE_DISPLAY[point.id];
  const source = bundle.sources[point.id];
  const totals = bundle.access.aggregates[point.id];
  const govAgg = bundle.governance.aggregates[point.id];

  const xPct = ((point.access_total / MAX_X) * 100).toFixed(0);
  const yPct = ((point.governance_nonNone / MAX_Y) * 100).toFixed(0);

  // 完整位置敘述：包含具體分數、避免假設意圖、註明象限定義是描述性而非價值判斷
  let positionNote;
  if (point.access_total >= MAX_X / 2 && point.governance_nonNone < MAX_Y / 2) {
    positionNote = `
      落在<strong>殖民式抽取象限（右下）</strong>。
      可及性達 ${point.access_total}/18 分（${xPct}%），代表外部使用者取用門檻低；
      但在 14 個原住民族集體權利治理維度中僅 ${point.governance_nonNone} 格有實質回應（${yPct}%）。
      此象限的特徵是<em>單向流出</em>——資料離開社群但極少回流社群權利保障。
      此判斷描述當前狀態，不假設該資料源主觀意圖；
      改變這個位置需要同時降低取用門檻<strong>並</strong>增加治理回應，兩者都動。
    `;
  } else if (point.access_total < MAX_X / 2 && point.governance_nonNone < MAX_Y / 2) {
    positionNote = `
      落在<strong>封閉象限（左下）</strong>。
      可及性 ${point.access_total}/18 分（${xPct}%），治理回應 ${point.governance_nonNone}/14 格（${yPct}%），兩軸皆低。
      <strong>注意</strong>：此處低可及性可能源於設計選擇（例如「版權保留」預設）、
      技術門檻（例如 API 需固定 IP）或結構限制——並非主動保護社群權利。
      要判斷該來源是否值得保留低可及性現狀，需同時看治理面是否有實質的社群權利保障；
      此象限的低 Y 值表明這裡並沒有。
    `;
  } else if (point.access_total >= MAX_X / 2 && point.governance_nonNone >= MAX_Y / 2) {
    positionNote = `
      落在<strong>理想象限（右上）</strong>。
      可及性 ${point.access_total}/18（${xPct}%）+ 治理回應 ${point.governance_nonNone}/14（${yPct}%），兩軸皆高。
      資料對外部使用者開放，且明確回應原住民族集體權利。
      <strong>本工具評估的 5 個來源中無一落在此象限</strong>——
      此資料源是少數可被視為兼顧開放性與治理性的例外。
    `;
  } else {
    positionNote = `
      落在<strong>社群中心象限（左上）</strong>。
      可及性 ${point.access_total}/18（${xPct}%）較低，但治理回應 ${point.governance_nonNone}/14（${yPct}%）較高——
      取用受限且存在實質的社群權利保障機制。
      此模式較接近 OCAP/TK Labels 主張的「社群決定取用範圍」理想。
      <strong>本工具評估的 5 個來源中無一落在此象限</strong>。
    `;
  }

  // 本來源獨有的關鍵限制（來自該 source 的 YAML）——讓不同來源的描述有所區分
  const gapsHtml =
    source.critical_gaps && source.critical_gaps.length
      ? `
        <div class="detail-gaps">
          <h4>本來源的關鍵限制</h4>
          <ul>${source.critical_gaps.map((g) => `<li>${escapeHtml(g)}</li>`).join("")}</ul>
        </div>
      `
      : "";

  container.innerHTML = `
    <div class="detail-panel">
      <h3>${disp.full}</h3>
      <p class="detail-meta">
        <a href="${source.url_primary}" target="_blank" rel="noopener noreferrer">${source.url_primary}</a>
        · 主管機構：${source.governing_agency.name_zh}
      </p>
      <div class="scatter-detail-grid">
        <div>
          <h4>可及性</h4>
          <p class="big-number">${totals.total}<span class="max">/18</span></p>
          <p>
            <a href="#/spectrum/${point.id}">→ 查看 6 維度詳情</a>
          </p>
        </div>
        <div>
          <h4>治理回應</h4>
          <p class="big-number">${govAgg.nonNone}<span class="max">/14</span></p>
          <p class="detail-meta">
            implemented：${govAgg.implemented} 格 · partial：${govAgg.partial} 格 · none：${govAgg.none} 格
          </p>
          <p>
            <a href="#/matrix/${point.id}">→ 查看 14 維度詳情</a>
          </p>
        </div>
      </div>
      <p class="position-note">${positionNote}</p>
      ${gapsHtml}
    </div>
  `;
  container.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}
