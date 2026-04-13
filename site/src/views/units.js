// View 4：資料單位對應
// 5 來源 × 5 單位類型表格——揭示「沒有共同骨架」的資料地景

import { SOURCE_DISPLAY } from "../lib/data.js";

// 單位類型順序與顯示
const UNIT_TYPES = [
  {
    key: "行政區",
    label: "行政區",
    desc: "縣市／鄉鎮市區／村里等政府劃定之空間單位",
  },
  {
    key: "部落",
    label: "部落",
    desc: "原住民族社群空間單位；對應族群自治與生活的基本單元",
  },
  {
    key: "族群",
    label: "族群",
    desc: "16 族官方認定之原住民族族群（如阿美族、泰雅族）",
  },
  {
    key: "語料單元",
    label: "語料單元",
    desc: "單筆口語紀錄、書寫文本、詞彙等語言學單位",
  },
  {
    key: "典藏物件",
    label: "典藏物件",
    desc: "單筆典藏素材（圖像、影音、文件、3D 模型等）",
  },
];

export function renderUnits(bundle, root, selectedSource = null) {
  // 統計每個單位被哪些來源採用
  const usageBySources = {};
  UNIT_TYPES.forEach((u) => {
    usageBySources[u.key] = bundle.meta.source_order.filter((sid) =>
      bundle.sources[sid].data_unit.includes(u.key)
    );
  });

  // 統計訊號
  const sharedUnits = UNIT_TYPES.filter(
    (u) => usageBySources[u.key].length >= 2
  );
  const soloUnits = UNIT_TYPES.filter(
    (u) => usageBySources[u.key].length === 1
  );
  const emptyUnits = UNIT_TYPES.filter(
    (u) => usageBySources[u.key].length === 0
  );

  root.innerHTML = `
    <article class="view-units">
      <h2 class="view-title">資料單位對應</h2>
      <p class="view-subtitle">
        5 個資料來源 × 5 種資料單位類型——揭示跨來源串聯的結構基礎（或缺乏基礎）。
      </p>

      <p class="view-description">
        資料單位是資料的「基本記錄維度」。
        如果兩個來源用同樣的單位，跨來源比較與串聯有結構基礎；
        如果各用各的單位，就需要建立對應表（mapping table）才能比較——而對應表本身常常不存在。
      </p>

      <div class="units-stats">
        <div class="units-stat">
          <span class="units-stat-num">${sharedUnits.length}</span>
          <span class="units-stat-label">種單位被 2+ 來源共用</span>
          <span class="units-stat-detail">${sharedUnits.length === 0 ? "—" : sharedUnits.map((u) => u.label).join("、")}</span>
        </div>
        <div class="units-stat">
          <span class="units-stat-num">${soloUnits.length}</span>
          <span class="units-stat-label">種單位僅 1 個來源使用</span>
          <span class="units-stat-detail">${soloUnits.length === 0 ? "—" : soloUnits.map((u) => u.label).join("、")}</span>
        </div>
        <div class="units-stat">
          <span class="units-stat-num">${emptyUnits.length}</span>
          <span class="units-stat-label">種單位完全沒有來源使用</span>
          <span class="units-stat-detail">${emptyUnits.length === 0 ? "—" : emptyUnits.map((u) => u.label).join("、")}</span>
        </div>
      </div>

      <div class="units-scroll">
        ${renderTable(bundle, usageBySources)}
      </div>

      <div id="units-detail" aria-live="polite"></div>

      <div class="units-narrative">
        <h3>讀這張圖的方式</h3>
        <ul>
          <li>
            <strong>共用欄位（柱狀越高越能跨來源比較）</strong>：
            ${
              sharedUnits.length === 0
                ? "目前無任何單位被 3 個以上來源共用——意味著三個以上來源之間無共同分析骨架"
                : sharedUnits
                    .map(
                      (u) =>
                        `「${u.label}」被 ${usageBySources[u.key].length} 個來源共用`
                    )
                    .join("；")
            }
          </li>
          <li>
            <strong>獨佔欄位（這個來源是該單位的唯一持有者）</strong>：
            ${soloUnits
              .map(
                (u) =>
                  `「${u.label}」僅 ${SOURCE_DISPLAY[usageBySources[u.key][0]].full} 採用`
              )
              .join("；")}
          </li>
          ${
            emptyUnits.length > 0
              ? `<li>
                  <strong>缺席欄位</strong>：
                  ${emptyUnits
                    .map((u) => `「${u.label}」無來源採用`)
                    .join("；")}——這個維度的資料在現行五個平台中無法直接抽取。
                </li>`
              : ""
          }
        </ul>
      </div>
    </article>
  `;

  attachInteractions(bundle, root, usageBySources);

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

function renderTable(bundle, usageBySources) {
  const headerCells = UNIT_TYPES.map(
    (u) =>
      `<th class="units-th" data-unit="${u.key}" title="${u.desc}">${u.label}<br><span class="units-th-count">${usageBySources[u.key].length} 來源</span></th>`
  ).join("");

  const bodyRows = bundle.meta.source_order
    .map((sid) => {
      const disp = SOURCE_DISPLAY[sid];
      const cells = UNIT_TYPES.map((u) => {
        const used = bundle.sources[sid].data_unit.includes(u.key);
        return `<td class="units-cell" data-source="${sid}" data-unit="${u.key}" data-used="${used}" tabindex="${used ? 0 : -1}" role="${used ? "button" : ""}" aria-label="${disp.full} ${used ? "採用" : "未採用"} ${u.label} 為單位">${used ? "●" : ""}</td>`;
      }).join("");
      return `
        <tr data-source-row="${sid}">
          <th class="units-source-cell" scope="row">${disp.full}</th>
          ${cells}
        </tr>
      `;
    })
    .join("");

  return `
    <table class="units-table">
      <thead>
        <tr>
          <th class="units-corner">資料來源 <span class="dim-axis-hint">→ 採用之單位類型</span></th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
}

function attachInteractions(bundle, root, usageBySources) {
  const detail = root.querySelector("#units-detail");
  root.querySelectorAll(".units-cell[data-used='true']").forEach((cell) => {
    const select = () => {
      root.querySelectorAll(".units-cell.active").forEach((c) =>
        c.classList.remove("active")
      );
      cell.classList.add("active");
      renderDetail(bundle, cell.dataset, usageBySources, detail);
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

function renderDetail(bundle, dataset, usageBySources, container) {
  const { source: sid, unit } = dataset;
  const disp = SOURCE_DISPLAY[sid];
  const source = bundle.sources[sid];
  const unitInfo = UNIT_TYPES.find((u) => u.key === unit);
  const otherSources = usageBySources[unit].filter((id) => id !== sid);

  const sharedHtml = otherSources.length
    ? `<p>同樣採用「${unitInfo.label}」為單位的其他來源：<strong>${otherSources.map((id) => SOURCE_DISPLAY[id].full).join("、")}</strong>——這些來源之間有結構性串聯基礎。</p>`
    : `<p><strong>${disp.full}</strong> 是唯一以「${unitInfo.label}」為基本記錄單位的來源——其它來源無法直接以此維度與之串聯。</p>`;

  container.innerHTML = `
    <div class="detail-panel">
      <h3>${disp.full} × ${unitInfo.label}</h3>
      <p class="detail-meta">
        <a href="${source.url_primary}" target="_blank" rel="noopener noreferrer">${source.url_primary}</a>
        · 主管機構：${source.governing_agency.name_zh}
      </p>
      <p><strong>${unitInfo.label}</strong>：${unitInfo.desc}</p>
      ${sharedHtml}
      <p class="detail-cross-links">
        <a href="#/spectrum/${sid}">→ 查看可及性詳情</a> ·
        <a href="#/matrix/${sid}">→ 查看治理落差</a> ·
        <a href="#/scatter/${sid}">→ 在散點圖中定位</a>
      </p>
    </div>
  `;
  container.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
