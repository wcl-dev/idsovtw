# 台灣原住民族資料地景 — 治理揭露工具

> 倡議型基礎設施探針——以詮釋資料揭露五個原住民族相關資料來源之間的斷裂、可及性差異與治理空白。

## 這是什麼

本工具不整合資料、不做搜尋、不對接 API。它只呈現既有資料地景的結構問題，供研究者、非營利組織、資助方、政策單位與原住民族社群共同參照討論。

涵蓋資料源（依評分由高至低）：

- 原住民族委員會開放資料平台（CIP）
- 政府資料開放平臺（data.gov.tw）
- 台灣原住民族部落開放資料庫（TICD，OSF 託管）
- 國家文化記憶庫 2.0（TCMB）
- 原住民族語言資料庫（AILT）

## 如何使用

### 線上瀏覽

如果你拿到的是已 build 的版本：

1. 解壓縮 zip
2. 直接雙擊 `dist/index.html`
3. 任何現代瀏覽器（Chrome / Firefox / Edge）皆可

無需網路、無需伺服器。整個工具是單一 HTML 檔（約 143KB），CSS、JS 與資料皆內嵌。

### 從原始碼建置

需要 Node.js 18 以上：

```bash
npm install
npm run build       # 同步驗證 + 編譯資料 + 打包前端
```

產物在 `dist/index.html`。

開發模式：

```bash
npm run dev         # 本地伺服器 http://localhost:5173
```

## 工具的四個視圖

| 視圖 | 內容 | 衡量什麼 |
|------|------|---------|
| **可及性** | 5 來源 × 6 維度評分（0-3 分） | 對外部使用者的可取用程度 |
| **治理落差矩陣** | 5 來源 × 14 維度評分（none/partial/implemented） | 對原住民族社群的權利回應 |
| **抽取 × 治理** | 2D 散點圖 | 兩個分析軸的交叉位置 |
| **資料單位對應** | 5 來源 × 5 種單位類型 | 跨來源串聯的結構基礎 |

### 框架警示（重要）

工具有兩個**獨立**的分析軸：

- **可及性**衡量資料對外部使用者的可取用程度——高分代表資料易被抽取
- **治理落差矩陣**衡量資料對原住民族社群的權利回應——高分代表尊重集體權利

兩者不等同。一個資料庫可以同時「極易被外人抽取」且「完全不回應社群」。
**任何單看一個視圖的解讀都會誤導**——請搭配閱讀。

## 資料來源（評分依據）

所有評分有可追溯的證據鏈：

- `data/sources/*.yaml` — 五個來源的結構化詮釋資料
- `data/governance-matrix.yaml` — 14 維度治理評分（70 格）
- `data/access-tiers.yaml` — 6 維度可及性評分（30 格）
- `data-source-inventory.md` — 人類可讀的盤點報告
- `audit-log.md` — 勘查過程紀錄（含失敗模式分類）
- `docs/governance-dimensions.md` — 治理 14 維度的評分標準
- `docs/access-methodology.md` — 可及性 6 維度的評分方法

每個 YAML 中的 partial 與 implemented 評分皆附 `evidence_refs` 指向具體段落（行範圍）。可透過 `npm run validate` 驗證所有引用是否仍指向有效內容。

## 引用本工具

引用格式（建議 APA 7th）：

> 台灣原住民族資料地景治理揭露工具（2026 年版）。
> 五個資料來源的可及性與治理落差評估。
> 資料盤點日期：2026-04-13。

## 授權

工具本身採 **CC BY-SA 4.0**（與倡議定位一致）。

引用之資料來源各有自身授權，詳見各來源的 YAML 檔案 `license` 欄位。

## 技術細節

- 前端：純靜態 HTML + vanilla JS + D3.js v7
- 建置：Vite + vite-plugin-singlefile（單檔輸出）
- 資料：YAML 撰寫、ajv 驗證、編譯為 JSON 後內嵌
- 無追蹤、無外部 CDN、無 Cookie
- 完全離線可運作

## 開發者文件

- `npm run validate` — 驗證所有 YAML 與 evidence 引用
- `npm run build-data` — 編譯 YAML 為 bundle.json
- `npm run dev` — 啟動開發伺服器
- `npm run build` — 完整建置（驗證 + 編譯 + 打包）
- `node scripts/test-offline.mjs` — 測試 file:// 離線開啟
- `node scripts/test-a11y.mjs` — 可及性檢查
