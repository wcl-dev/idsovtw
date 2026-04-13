#!/usr/bin/env node
/**
 * 編譯腳本：把 data/ 底下的 YAML 整合成 site/public/data/bundle.json
 *
 * 產出結構：
 * {
 *   generated_at: ISO timestamp,
 *   sources: { cip: {...full source yaml...}, ... },
 *   governance: { cip: {...scores + computed totals...}, ... },
 *   access: { cip: {...scores + total...}, ... },
 *   aggregates: {
 *     access_totals: { cip: 16, ... },
 *     governance_nonNone: { cip: 6, ... },  // 非 none 格數
 *     scatter_points: [{ id, name_zh, access_total, governance_nonNone }, ...]
 *   }
 * }
 *
 * 使用：node scripts/build-data.mjs
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SOURCES_DIR = join(ROOT, "data", "sources");
const MATRIX_PATH = join(ROOT, "data", "governance-matrix.yaml");
const ACCESS_PATH = join(ROOT, "data", "access-tiers.yaml");
// 寫入 src/ 而非 public/——讓 Vite 透過 ES module import 內嵌進最終 bundle
// 這樣可消除 file:// 協定下的 CORS 限制，讓 dist/ 真正可離線開啟
const OUT_DIR = join(ROOT, "site", "src", "data");
const OUT_PATH = join(OUT_DIR, "bundle.json");

const SOURCE_ORDER = ["cip", "data-gov-tw", "ticd", "ailt", "tcmb"];

function loadYaml(path) {
  return yaml.load(readFileSync(path, "utf8"));
}

// 計算治理矩陣的聚合：每個來源的非 none 格數、各等級格數
function computeGovernanceAggregates(governanceData) {
  const perSource = {};
  for (const id of SOURCE_ORDER) {
    const src = governanceData.sources[id];
    if (!src) continue;
    let none = 0,
      partial = 0,
      implemented = 0;
    for (const [_, framework] of Object.entries(src.scores)) {
      for (const [__, cell] of Object.entries(framework)) {
        if (cell.score === "none") none++;
        else if (cell.score === "partial") partial++;
        else if (cell.score === "implemented") implemented++;
      }
    }
    perSource[id] = {
      none,
      partial,
      implemented,
      nonNone: partial + implemented,
      total: none + partial + implemented,
    };
  }
  return perSource;
}

// 計算存取性分層的聚合：每個來源的總分
function computeAccessAggregates(accessData) {
  const perSource = {};
  for (const id of SOURCE_ORDER) {
    const src = accessData.sources[id];
    if (!src) continue;
    let total = 0;
    const dims = {};
    for (const [dim, cell] of Object.entries(src)) {
      total += cell.score;
      dims[dim] = cell.score;
    }
    perSource[id] = { total, dimensions: dims };
  }
  return perSource;
}

function main() {
  console.log("編譯資料 bundle...");

  // 1. 載入 5 個來源 YAML
  const sources = {};
  for (const id of SOURCE_ORDER) {
    const path = join(SOURCES_DIR, `${id}.yaml`);
    sources[id] = loadYaml(path);
    console.log(`  ✓ ${id}.yaml`);
  }

  // 2. 載入治理矩陣
  const governance = loadYaml(MATRIX_PATH);
  console.log(`  ✓ governance-matrix.yaml`);

  // 3. 載入存取性矩陣
  const access = loadYaml(ACCESS_PATH);
  console.log(`  ✓ access-tiers.yaml`);

  // 4. 計算聚合
  const govAgg = computeGovernanceAggregates(governance);
  const accAgg = computeAccessAggregates(access);

  // 5. 散點圖資料點（M3 總分 vs M2 非 none 格數）
  const scatterPoints = SOURCE_ORDER.map((id) => ({
    id,
    name_zh: sources[id].name_zh,
    name_en: sources[id].name_en,
    access_total: accAgg[id].total,
    governance_nonNone: govAgg[id].nonNone,
    governance_implemented: govAgg[id].implemented,
    governance_partial: govAgg[id].partial,
  }));

  // 6. 組合最終 bundle
  const bundle = {
    generated_at: new Date().toISOString(),
    meta: {
      source_order: SOURCE_ORDER,
      access_max_score: 18, // 6 維度 × 3
      governance_total_cells: 14, // 14 維度
      governance_frameworks: ["CARE", "OCAP", "TK_Labels", "localized"],
    },
    sources,
    governance: {
      schema_version: governance.schema_version,
      date_checked: governance.date_checked,
      methodology_ref: governance.methodology_ref,
      sources: governance.sources,
      aggregates: govAgg,
    },
    access: {
      schema_version: access.schema_version,
      date_checked: access.date_checked,
      methodology_ref: access.methodology_ref,
      sources: access.sources,
      aggregates: accAgg,
    },
    scatter: scatterPoints,
  };

  // 7. 輸出
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(bundle, null, 2), "utf8");

  const sizeKB = (readFileSync(OUT_PATH).length / 1024).toFixed(1);
  console.log(`\n輸出: ${OUT_PATH} (${sizeKB} KB)`);

  // 8. 摘要
  console.log("\nAccess 總分：");
  for (const id of SOURCE_ORDER) {
    console.log(`  ${id.padEnd(14)} ${accAgg[id].total}/18`);
  }
  console.log("\nGovernance 非 none 格數：");
  for (const id of SOURCE_ORDER) {
    const { implemented, partial, nonNone } = govAgg[id];
    console.log(
      `  ${id.padEnd(14)} ${nonNone}/14 (implemented: ${implemented}, partial: ${partial})`
    );
  }
}

main();
