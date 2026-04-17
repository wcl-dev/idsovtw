// 資料載入：靜態 import bundle.json 讓 Vite 在 build 時內嵌進 JS bundle
// 這樣產出的單一 HTML 可在 file:// 協定下完整離線運作（無 CORS 限制）
import bundleData from "../data/bundle.json";

export function loadBundle() {
  // 保留 async 介面以維持呼叫端相容
  return Promise.resolve(bundleData);
}

// 方便工具：依 id 取得來源詮釋資料
export function getSource(bundle, id) {
  return bundle.sources[id];
}

// 可及性六個維度的順序與顯示標籤
export const ACCESS_DIMENSIONS = [
  { key: "discoverability", label: "可發現性", short: "發現" },
  { key: "technical_barrier", label: "技術門檻", short: "技術" },
  { key: "authorization_barrier", label: "授權門檻", short: "授權" },
  { key: "license_clarity", label: "授權清晰度", short: "清晰" },
  { key: "institutional_stability", label: "機構穩定性", short: "穩定" },
  { key: "reusability", label: "可再利用性", short: "再利" },
];

// 來源顯示名稱（簡短版）
export const SOURCE_DISPLAY = {
  cip: { short: "CIP", full: "原住民族委員會開放資料平台" },
  "data-gov-tw": { short: "data.gov.tw", full: "政府資料開放平臺" },
  ticd: { short: "TICD", full: "台灣原住民族部落開放資料庫" },
  ailt: { short: "AILT", full: "原住民族語言資料庫" },
  tcmb: { short: "TCMB", full: "國家文化記憶庫 2.0" },
  openmuseum: { short: "openmuseum", full: "開放博物館" },
};
