# 資料來源勘查紀錄

> 勘查日期：2026-04-12
> 勘查工具：WebFetch（HTTP 靜態抓取）、Playwright 1.59.1（Chromium 瀏覽器自動化）、curl、Node.js 24.13.1
> 執行環境：Windows 11, bash shell

---

## 勘查方法論

本次盤點採用三階段遞進策略，模擬從「最低技術門檻」到「模擬人類操作」的存取路徑：

1. **第一階段：HTTP 靜態抓取**（WebFetch / curl）——直接 GET 目標 URL，解析回傳的 HTML
2. **第二階段：瀏覽器自動化**（Playwright headless Chromium）——等待 JavaScript 渲染後擷取 DOM
3. **第三階段：API 探測**——嘗試已知或推測的 API 端點，分析回傳結構

每個階段的失敗本身都是有意義的資料點：它揭示了該平台對程式化存取的實際門檻。

---

## 1. 原住民族委員會開放資料平台 (data.cip.gov.tw)

### 第一階段：HTTP 靜態抓取

| 嘗試 | URL | 方法 | 結果 |
|------|-----|------|------|
| 1 | `https://data.cip.gov.tw/` | WebFetch GET | 取得 HTML，但僅含導覽元素與 footer，無實質內容 |
| 2 | `https://data.cip.gov.tw/dataset` | WebFetch GET | **伺服器錯誤**（"Sorry! An error occurred"） |

**錯誤診斷**：第二次嘗試假設平台為 CKAN 架構（因為其他政府開放資料平台多用 CKAN），因此嘗試 `/dataset` 路徑。但此路徑在 ASP.NET 架構中不存在，回傳的是 ASP.NET 的通用錯誤頁。

### 第二階段：Playwright 瀏覽器自動化

| 嘗試 | 策略 | 結果 |
|------|------|------|
| 3 | headless Chromium, `waitUntil: "networkidle"` | 首頁載入成功，但頁面文字幾乎為空白（1093 字元，多為空白與排版字元）。連結文字未渲染出來（`text: ""`）。 |
| 4 | headless Chromium, 嘗試 `/dataset` | 同樣伺服器錯誤 |
| 5 | **非 headless + Edge channel** | 首頁正常載入，確認真實 URL 結構為 `/Home/Default.aspx`（302 重導向） |
| 6 | headless + 偽裝 User-Agent | 同樣正常載入 |
| 7 | headless + `--headless=new` 旗標 | 同樣正常載入 |

**關鍵發現**：策略 3 中連結文字為空（`text: ""`），是因為 ASP.NET 頁面的連結使用圖片而非文字。改用 `$$eval('a')` 抓取 `href` 屬性後，成功取得所有頁面路徑：

```
/Home/Default.aspx    — 首頁
/Home/DataMenu.aspx   — 依資料分類查詢
/Home/UnitMenu.aspx   — 依機關分類查詢
/Home/OtherMenu.aspx  — 其他
/Home/Copyright.aspx  — 使用規範
/Home/sub_menu.htm    — 子選單
```

### 第三階段：深入勘查

| 嘗試 | URL | 結果 |
|------|-----|------|
| 8 | `/Home/DataMenu.aspx`（Playwright） | **成功**。取得完整資料集清單：253 筆資料集，24 個分類。頁面使用 ASP.NET `__doPostBack` 機制（JavaScript postback）進行分類切換。 |
| 9 | `/Home/DataInfo.aspx?funno=114025`（Playwright） | **成功**。取得單筆資料集詳情頁，發現下載連結格式為 `/API/v1/dump/datastore/A53000000A-{funno}-{format}` |
| 10 | `/api/3/action/package_list`（curl） | **伺服器錯誤**。確認非 CKAN 架構。 |
| 11 | `/api/action/package_list`（curl） | **伺服器錯誤**。同上。 |

**結論**：
- 平台為 **ASP.NET WebForms** 架構，非 CKAN
- 分類選單使用 `__doPostBack` JavaScript postback，無法透過簡單 URL 存取各分類
- 但每筆資料集有 REST 風格的下載 API（`/API/v1/dump/datastore/`），提供 JSON/CSV/XML 三種格式，**免認證**
- 關鍵技術障礙：首頁連結使用圖片而非文字，導致 headless 抓取時「看不到」導覽結構

### 反自動化措施

未偵測到。headless Chromium（含原始 UA）可正常存取所有頁面。先前的失敗純粹是因為假設了錯誤的架構（CKAN）而存取了不存在的路徑。

---

## 2. 政府資料開放平臺 (data.gov.tw)

### 第一階段：HTTP 靜態抓取

| 嘗試 | URL | 結果 |
|------|-----|------|
| 1 | `https://data.gov.tw/` | WebFetch GET | 僅取得 CSS/HTML 框架代碼，無實質內容（SPA 架構） |
| 2 | `https://data.gov.tw/datasets/search?qs=原住民` | WebFetch GET | 同上，僅取得前端框架 |
| 3 | `https://data.gov.tw/dataset/8378` | WebFetch GET | 成功取得部分詮釋資料（標題、提供機關、格式），但為非原住民相關的示範資料集 |
| 4 | `https://data.gov.tw/dataset?qs=原住民` | WebFetch GET | **404 Not Found** |

### 第二階段：Playwright 瀏覽器自動化

| 嘗試 | 策略 | 結果 |
|------|------|------|
| 5 | headless, `waitUntil: "networkidle"`, 搜尋頁面 | **逾時**（30 秒）。頁面 network 活動持續未停止。 |
| 6 | headless, `waitUntil: "domcontentloaded"` + 8 秒等待 | 頁面載入但搜尋結果未渲染。僅取得框架元素（小幫手、高應用價值主題專區等靜態區塊）。 |

**診斷**：data.gov.tw 是重度 SPA（Angular 或類似框架），搜尋功能完全由前端 JavaScript 驅動。即使 Playwright 等待 DOM 穩定，搜尋結果的渲染可能依賴額外的用戶互動或更長的載入時間。

### 第三階段：API 探測

| 嘗試 | 端點 | 方法 | 結果 |
|------|------|------|------|
| 7 | `/api/front/dataset/list?query=原住民` | GET | **405 Method Not Allowed**（需 POST） |
| 8 | `/api/front/dataset/list` | POST `{"query":"原住民","rows":5}` | **回傳成功**，但 `search_count: 52914`——與全平台資料集總數相同 |
| 9 | `/api/front/dataset/list` | POST `{"query":"","rows":1}` | `search_count: 52914`——**確認 query 參數被忽略** |
| 10 | `/api/front/dataset/list` | POST `{"query":"*","rows":20,"agency_tid":[463]}` | `search_count: 0`——agency_tid 篩選無效（可能 ID 不正確或不支援） |
| 11 | `/api/front/dataset/list` | POST `{"query":"*","rows":20,"filters":{"agency_tid":[463]}}` | `search_count: 0`——filters 結構也無效 |
| 12 | `/api/front/dataset/search` | POST | **404 Not Found** |
| 13 | `/api/v2/rest/dataset?q=原住民` | GET | **405 Method Not Allowed** |

**結論（初步）**：
- 公開 API `/api/front/dataset/list` 的 `query` 參數**完全無效**，永遠回傳全部 52,914 筆資料集
- API 回傳的資料結構完整（50+ 欄位/筆），包含 `aggregations`（機關與主題分類的統計），但無法用於搜尋或篩選
- 前端搜尋功能可能使用不同的內部 API 端點，或透過其他機制（如 Elasticsearch proxy）運作

### 第四階段：前端搜尋攔截

為理解前端實際的搜尋機制，使用 Playwright 攔截 XHR/Fetch 請求：

| 嘗試 | 策略 | 結果 |
|------|------|------|
| 14 | Playwright + Edge（非 headless），模擬搜尋框輸入 | 搜尋框被語言選擇器下拉元件遮擋（`<span>Language</span>` intercepts pointer events），click 逾時 |
| 15 | Playwright，直接導覽至搜尋 URL `?qs=原住民`，等待 30 秒 | 框架載入但搜尋結果永遠不渲染。所有篩選區塊顯示「暫無資料」。 |
| 16 | Playwright，攔截所有 XHR 請求 | **成功攔截前端搜尋流程**。發現前端分兩步：(1) `GET /api/front/agency/listbytid/原住民` 取得機關 tid 清單（回傳 1,870 個 tid——實際上是全部機關）；(2) `POST /api/front/dataset/list` 帶 `filter: [{fields: "agency_tid", query: [...1870個tid]}]` 和 `bool: []`。由於 filter 包含所有機關 tid，等同無篩選。 |
| 17 | 直接呼叫 `/api/front/agency/listbytid/原住民` | 確認回傳 1,870 個 tid（全平台所有機關的 tid 清單），搜尋詞未生效 |

**前端搜尋機制診斷**：data.gov.tw 的搜尋架構為 Nuxt 3 + Pinia，搜尋流程看似設計為「先用搜尋詞篩選機關，再用機關 tid 篩選資料集」，但 `listbytid` 端點對搜尋詞不做篩選（回傳全部機關），導致搜尋結果等同無篩選。前端搜尋結果不渲染的原因可能是：回傳 52,914 筆資料導致渲染逾時或溢出。

### 第五階段：突破——CSV 匯出端點

使用者提供了 data.gov.tw 上的 API 相關資料集頁面（dataset/172819），從中發現了正式的 CSV 匯出端點。

| 嘗試 | 端點 | 結果 |
|------|------|------|
| 18 | `GET /api/v2/rest/dataset/export` | **成功**。下載完整 CSV 匯出檔（74,041 行），包含所有資料集的完整詮釋資料（22 個欄位） |
| 19 | 本地 CSV 篩選：`line.includes('原住民')` | **含「原住民」的資料集共 833 筆**，其中標題含「原住民」539 筆 |

**最終結論**：
- data.gov.tw 有三層 API：(1) `/api/front/dataset/list`（搜尋 API，名存實亡）；(2) `/api/front/agency/listbytid/`（機關查詢，不篩選）；(3) **`/api/v2/rest/dataset/export`（CSV 全量匯出，唯一有效的資料取得途徑）**
- 全平台含「原住民」關鍵字的資料集 **833 筆**，其中標題含「原住民」**539 筆**
- 原住民族委員會提供 **240 筆**（最大宗），其餘分散於臺南市社會局（32）、統計處（25）、臺南市民政局（24）、臺中市原民會（21）、臺北市原民會（19）等數十個機關
- 這意味著：在 data.gov.tw 上，**原住民族相關資料的 71% 不是由原民會提供的**——資料散布的程度比預期更嚴重

### 有價值的 API 回傳結構

雖然搜尋不可用，但 API 回傳揭示了平台的詮釋資料 schema：

```
每筆資料集欄位：
agency_name, agency_tid, title, content, license_name, license_tid,
category_name, category_tid, topic_name, topic_tid, updatefreq_desc,
all_file_format_name, all_file_format_tid, dataset_resource_description,
quality_badge_type, quality_check_status, liaison_displayname,
liaison_emails, liaison_phone, pubdate, changed, metadata_changed,
dataset_view_times, resource_download_times, ...共 50+ 欄位

aggregations 結構：
- topic_tid: 主題分類（含 doc_count）
- agency_tid: 提供機關（含 doc_count）
```

---

## 3. 中央研究院人文社會科學研究中心 / TICD

### 第一階段：HTTP 靜態抓取

| 嘗試 | URL | 結果 |
|------|-----|------|
| 1 | `https://www.rchss.sinica.edu.tw/` | WebFetch GET | 取得資料庫列表（學術調查、地圖典藏、歷史地圖等），但**無任何原住民或部落相關連結** |

### 第二階段：Playwright 瀏覽器自動化

| 嘗試 | URL | 結果 |
|------|-----|------|
| 2 | `https://www.rchss.sinica.edu.tw/`（Playwright） | 掃描全頁文字與連結，關鍵字搜尋（部落、TICD、原住民、Indigenous、tribe、community）均未命中 |
| 3 | `https://ianthro.tw/`（Playwright） | **DNS 解析失敗**（`ERR_NAME_NOT_RESOLVED`）。此域名已不存在。 |
| 4 | Google 搜尋 `site:sinica.edu.tw TICD 原住民部落資料庫`（Playwright） | 搜尋結果頁面載入但未取得有效結果（可能被 Google 反爬蟲攔截） |

### 第三階段：OSF 驗證（使用者提供線索）

使用者指出 TICD 可透過 `https://osf.io/esw67` 存取。

| 嘗試 | URL | 方法 | 結果 |
|------|-----|------|------|
| 5 | `https://osf.io/esw67` | WebFetch GET | 僅取得 CSS 與 JS 框架（SPA 架構） |
| 6 | `https://osf.io/esw67` | Playwright headless, 8 秒等待 | **成功**。取得完整專案資訊：標題、描述、貢獻者、授權、子專案、最新發表等 |

**結論（初步，2026-04-12 當日下午修正見第四階段）**：
- TICD 原址 ianthro.tw 已完全消失（DNS 不可解析）
- 中研院人社中心網站無任何導向 TICD 的連結——從機構的公開網頁上，TICD 是不可見的
- TICD 現以 OSF 專案形式存在，由原研究者個人維護

### 第四階段：更正——中研院保有正式轉址子域名

使用者指出「TICD 算好找，網站上有寫轉址網址」，遂進一步勘查：

| 嘗試 | URL / 方法 | 結果 |
|------|-----------|------|
| 7 | OSF API 查 TICD 專案檔案清單 | 發現兩個文字檔 `TICD_原住民部落基礎開放資料_正式網址.txt`（中）與 `TICD_TaiwanIndigenousCommunitiesOpenData_FromalURL.txt`（英）明載「TICD formal URL: TICD.RCHSS.sinica.edu.tw」 |
| 8 | `https://ticd.rchss.sinica.edu.tw/`（curl） | **HTTP 200**。內容為 104 bytes 的 HTML：`<html><head><meta http-equiv="refresh" content="0;url=https://osf.io/esw67/"></head><body></body></html>`——中研院正式子域名，保留為 meta refresh 自動轉址至 OSF |

**修正結論**：
- TICD 在中研院伺服器上保有正式轉址子域名 `ticd.rchss.sinica.edu.tw`，透過 HTML meta refresh 自動帶到 OSF 專案
- 先前「TICD 從機構網站完全消失」的結論是**錯誤的**——錯因是勘查範圍限於主站首頁與 Google 限域搜尋，未試子域名
- 真實情況是：**中研院在機構層面保留了轉址 URL 作為「正式網址」，內容實際由個人主導的 OSF 專案承擔**——這是機構治理與個人維運之間的折衷架構，不是完全的機構脫落
- **方法論教訓**：未來盤點類似的「消失」資料庫時，不能僅憑主站搜尋失敗下結論；應該同時檢查可能的子域名與 OSF／GitHub 等外部平台的檔案清單中是否有正式 URL 記載

---

## 4. 原住民族語言資料庫 (AILT)

### 第一階段：HTTP 靜態抓取

| 嘗試 | URL | 結果 |
|------|-----|------|
| 1 | `https://ailt.ilrdf.org.tw/` | WebFetch GET | 取得部分結構化資訊：口語語料、書面語料、典藏資料、學習者語料庫四大類型；16 族語；YouTube 嵌入影片；PDF 文件預覽 |
| 2 | `https://ailt.ilrdf.org.tw/about` | WebFetch GET | 取得關於頁面內容：任務說明、語料類型描述、分級存取制度提及 |

### 第二階段：Playwright 瀏覽器自動化

| 嘗試 | URL/操作 | 結果 |
|------|---------|------|
| 3 | 首頁（Playwright） | 掃描全頁關鍵字。「下載」僅出現在「族語輸入法全新上線！跨平台免費下載」（非語料下載）。「API」出現在語料文字中（阿美語語料內容），非功能描述。 |
| 4 | 語料頁面 `/ethnicity/search?lang=1`（Playwright） | 頁面載入成功。**無下載選項**。可用操作：登入、搜尋、進階搜尋。有登入對話框（含驗證碼）。 |
| 5 | 掃描所有 `<a>` 與 `<button>` 元素 | 找到「關於本站」連結。未找到任何含 download、API、export 的連結或按鈕。 |

**結論**：
- AILT 的設計定位是「展示與保存」，不是「資料再利用」
- 語料內容透過 YouTube 嵌入（影片）和 PDF 預覽（文件）呈現，無原始檔案下載
- 有登入系統（含驗證碼），但從公開頁面無法得知登入後是否開放額外功能
- 著作權保留聲明（「原住民族語言研究發展基金會© 版權所有」）明確排除了再利用的可能性
- **技術架構上的封閉性與授權條件上的封閉性一致**——這不是疏忽，是設計選擇

---

## 5. 國家文化記憶庫 2.0 (TCMB)

### 第一階段：HTTP 靜態抓取

| 嘗試 | URL | 結果 |
|------|-----|------|
| 1 | `https://tcmb.culture.tw/` | WebFetch GET | 僅取得 CSS/JS 框架（SPA 架構） |
| 2 | `https://tcmb.culture.tw/about` | WebFetch GET | **301 重導向至 /zh-tw/404**（路徑結構已變更） |
| 3 | `https://tcmb.culture.tw/zh-tw/cc_license` | WebFetch GET | **500 伺服器錯誤**（SPA 路徑不支援靜態 GET） |

### 第二階段：Playwright 瀏覽器自動化

| 嘗試 | URL/操作 | 結果 |
|------|---------|------|
| 4 | 首頁 `/zh-tw`（Playwright, `networkidle`） | **成功**。取得大量文字內容。關鍵發現：導覽列含「OpenAPI專區」連結；首頁出現 CC BY-SA 3.0 授權標示；統計數字（9,151 筆、10,832 筆等）。 |
| 5 | 搜尋頁面 `/zh-tw/search?query=原住民`（Playwright） | **失敗**。回傳「PAGE NOT FOUND」。搜尋路徑格式已變更。 |
| 6 | 首頁站內搜尋（Playwright 模擬操作） | **成功**。找到搜尋框，輸入「原住民」按 Enter，等待 5 秒後取得結果數：**約 8,000 筆**。 |
| 7 | OpenAPI 頁面 `/zh-tw/openapi`（小寫，Playwright） | 回傳「PAGE NOT FOUND」。 |
| 8 | OpenAPI 頁面 `/zh-tw/OpenApi`（大寫 A，WebFetch） | **成功**。取得完整 API 文件。 |
| 9 | 授權規範頁面 `/zh-tw/cc_license`（Playwright） | 回傳「PAGE NOT FOUND」。114 年底改版後舊路徑失效。 |
| 10 | API 頁面 `/zh-tw/api`（Playwright） | 回傳「PAGE NOT FOUND」。 |

**URL 大小寫敏感性**：TCMB 的路由系統對 URL 大小寫敏感。`/zh-tw/openapi` 失敗但 `/zh-tw/OpenApi` 成功。這在 SPA 框架中不常見，表示路由表使用了精確匹配。

### 第三階段：API 探測

| 嘗試 | URL | 結果 |
|------|-----|------|
| 11 | `https://tcmb.culture.tw/zh-tw/OpenApi`（WebFetch） | **成功**。取得完整 API 規格：端點為 `https://tcmbdata.culture.tw/opendata/openapi`（獨立子域名），GET 方法，JSON 回傳，需 API Key（透過 `Authorization` header），申請需提供固定 IP。Swagger UI 位於 `https://tcmbdata.culture.tw/swagger-ui/`。 |

**結論**：
- TCMB 是五個來源中**技術架構最現代但也最難以程式化存取**的平台
- 網站為 SPA（可能是 Nuxt.js 或 Next.js），HTML 回傳幾乎不含內容，所有資料都在客戶端渲染
- 114 年底改版後大量舊路徑失效（/about, /cc_license, /openapi 等），但新路徑（/OpenApi）未在顯眼位置標示
- OpenAPI 存在且文件完整，但申請門檻（固定 IP）對個人研究者或非機構使用者構成實質障礙
- API 端點使用獨立子域名（`tcmbdata.culture.tw` 而非 `tcmb.culture.tw`），增加發現難度
- 九大分類中有「族群與語言」，但無原住民族專屬子分類
- 維運單位為國立臺灣歷史博物館（非文化部本部），客服電話 02-2701-6880 #4035

---

## 6. 開放博物館 Open Museum (openmuseum.tw)

### 第一階段：WebFetch 靜態抓取

| 嘗試 | URL | 結果 |
|------|-----|------|
| 1 | `https://openmuseum.tw/howto` | **成功**。取得完整授權與使用說明頁文字——14 種授權／權利標示，分 4 大類（可自由使用 5 種、有條件的開放使用 4 種、僅能於本網站使用 2 種、僅能瀏覽 3 種） |
| 2 | `https://openmuseum.tw/about` | **成功**。取得機構說明：中央研究院數位文化中心營運，聯絡地址 115201 台北市南港區研究院路二段 128 號，TEL (02)2652-1885 #302 |
| 3 | `https://openmuseum.tw/` | **成功**。取得總量統計：**1,172,413 件典藏、77 個主題博物館、803 個主題展示** |

### 第二階段：API 探測（全 404）

| 嘗試 | URL | 結果 |
|------|-----|------|
| 4 | `/api`、`/api/v1`、`/api/v2`、`/api/objects`、`/api/search`、`/api/collections`、`/graphql` | 全部 **HTTP 404** |
| 5 | IIIF 探測：`/iiif`、`/manifest.json`、`/api/iiif` | 全部 **HTTP 404** |

**結論**：公開 API 端點不存在。雖然平台以「開放」為名，但無任何正式的程式化存取介面。

### 第三階段：搜尋機制勘查

| 嘗試 | URL／方法 | 結果 |
|------|----------|------|
| 6 | `/search?keyword=原住民` | **HTTP 404**（先前回 401 是 VPN IP 被封鎖所致，排除後確認為 404） |
| 7 | `/objects?keyword=原住民` | HTTP 200 但未篩選（仍顯示 1,172,413 件）——URL 參數不支援關鍵字篩選 |
| 8 | `/objects`（Playwright 非 headless） | 列出搜尋框但為 Drupal views exposed filter 機制；23 個可見 input 元素中只有 `_text_` 是搜尋欄位，無 `name=keyword` 或類似公開規格 |

**結論**：搜尋需透過頁面表單互動觸發，URL 不帶 keyword 參數。原住民族相關藏品的具體數量本次勘查**未能自動化確認**。

### 第四階段：追蹤與策展平台

| 嘗試 | URL | 結果 |
|------|-----|------|
| 9 | Playwright XHR 攔截 | 偵測到 **Google Analytics GA4 追蹤**（tid=G-08NVTPVTMS） |
| 10 | `https://plaza.openmuseum.tw/` | **HTTP 200**。策展平台分離於主站，需「登入／註冊」才能使用；訴求「公民科學協作」功能即將推出 |

### 第五階段：原住民族內容取樣

| 嘗試 | 結果 |
|------|------|
| 11 | 首頁列表中確認至少有「Ulay‧織男 烏來泰雅民族博物館」展覽；歷年博物館日專頁（2020-2025）有多個原住民族主題；連結有「原住民族事務委員會」相關頁面——但數量未能自動計數 |

**結論**：
- openmuseum 是規模最大的台灣文化典藏聚合平台（117 萬件），涵蓋數十家機構
- **技術架構為 Drupal**（`.views-row`、`_text_` 搜尋欄、`op` 隱藏 input 等特徵），非 SPA
- **無公開 API**——這是五個來源之外比較級的顯著缺口（連 TCMB 都有 API，即使門檻高）
- 授權架構為 **14 種權利／授權標示**，比 TCMB 的 10 種更複雜
- 中研院數位文化中心聲明「**不擁有任何藏品的智慧財產權**」，所有治理責任實質在貢獻機構
- 有 Google Analytics 追蹤——對一個以「開放」為名的平台是結構性矛盾
- 平台明文「一般大眾不需申請成為開放博物館會員，即可於平台瀏覽」——入口門檻極低
- 原住民族相關內容存在但**無獨立分類**，與 TCMB 的「族群與語言」分類相比少一層可見性

### 第六階段：個別展覽層級的勘查（2026-04-13 使用者指正後補查）

先前評估僅檢查平台層級文件（/howto、/about、API 路徑），漏掉個別展覽與策展人的實踐層級——使用者指出「開放博物館在原住民族合作上是業界領先」後，補查一個具體案例。

**展覽**：《「釀」在生活中「發酵」在祭儀裡——阿美族釀酒文化與祭儀的意涵》
URL: https://plaza.openmuseum.tw/muse/exhibition/8d272a6b65d187ae1fa2c0d48c6e94da

**關鍵發現**（誌謝頁原文）：
- **策展人身份**：Lunaw Lubang 施昭憶——**族人內部承擔者，sikawasay（阿美族祭司）家族傳承者**（「作者與奶奶同為 sikawasay 的記憶」）；長輩託付「你要記得，你要寫下來」
- **部落領袖核准／參與**：
  - Cipawkan 部落頭目 陳誠勇
  - Pukpuk 部落頭目 張健山
  - Pukpuk 部落 sikawasay 長者及其家人
  - Pukpuk 部落耆老 張文良
- **NGO 合作**：台灣花蓮原住民慢食-婦女傳統飲食文化推廣與傳承組織、社團法人花蓮縣原住民族公共事務促進會
- **機構共策**：中央研究院民族學研究所（而非僅數位文化中心）
- **文化敏感內容**：涉及祖靈祭 talatu'as、sikawasay 祭司祭儀知識——最敏感層級的文化知識

**方法論層級的啟示**：
- **平台層級**：openmuseum 無明文的諮商同意強制規則
- **實踐層級**：至少此案例顯示策展人自主採用了高標準的社群協作——部落頭目核准、祭司家族參與、耆老諮詢、族人主體性
- **兩者落差**的治理意涵：治理品質取決於個別策展人而非平台制度；族人策展時實踐水準高，但外部研究者策展時無強制保障

**評分調整**（基於此單一案例的證據，非平台級保障）：
- CARE 1.2 Authority to Control: none → partial
- CARE 1.3 Responsibility: none → partial
- CARE 1.4 Ethics: none → partial
- OCAP 2.2 Control: none → partial

所有評分的 rationale 中必須明示「**平台層級無強制規範；此評分基於個別展覽的實踐證據，品質因策展人而異**」的限定。

**勘查的證據範圍限制**：
- 本次僅檢查一個展覽——是否為常態還是例外仍待驗證
- 若未來檢查更多原住民族相關展覽並發現實踐品質不穩定，應反向將分數拉回 none 並明述
- 若檢查發現類似品質的一致實踐，可考慮升為 implemented，但仍需區分「平台強制」vs「實踐常態」

---

## 勘查方法的系統性觀察

### 靜態抓取 vs. 瀏覽器自動化的成功率

| 平台 | 靜態抓取 | Playwright headless | Playwright 非 headless |
|------|---------|--------------------|-----------------------|
| data.cip.gov.tw | 部分成功（框架可見但內容不完整） | 成功 | 成功 |
| data.gov.tw | 失敗（純 SPA） | 部分成功（框架載入但搜尋不渲染） | 未測試 |
| rchss.sinica.edu.tw | 成功 | 成功 | 未測試 |
| ailt.ilrdf.org.tw | 部分成功 | 成功 | 未測試 |
| tcmb.culture.tw | 失敗（純 SPA） | 成功（需正確路徑） | 未測試 |
| osf.io | 失敗（SPA） | 成功 | 未測試 |

### 失敗模式分類

| 失敗模式 | 出現次數 | 涉及平台 | 意義 |
|---------|---------|---------|------|
| SPA 空殼（HTML 不含內容） | 多次 | data.gov.tw, tcmb, osf.io | 現代前端框架對程式化存取天然不友善 |
| 錯誤的架構假設（如假設 CKAN） | 2 次 | data.cip.gov.tw | 政府平台的技術架構不透明 |
| URL 路徑失效（改版後） | 3 次 | tcmb.culture.tw | SPA 改版常導致路徑斷裂 |
| URL 大小寫敏感 | 1 次 | tcmb.culture.tw | 非標準行為，增加發現難度 |
| DNS 消失 | 1 次 | ianthro.tw (TICD) | 計畫結束後域名未續約 |
| API query 參數無效 | 1 次 | data.gov.tw | API 名存實亡 |
| 逾時 | 1 次 | data.gov.tw | SPA 的 network 活動可能永不結束 |

### 對專案設計的啟示

這次勘查本身就是「資料地景與治理揭露工具」的一次原型實踐。以下觀察應直接進入工具的設計考量：

1. **「可存取性」需要分層描述**：一個平台「有 API」不等於「API 可用」（data.gov.tw）。一個平台「有資料」不等於「資料可被發現」（TICD on OSF）。盤點表需要比「有/無」更細緻的存取性評估。

2. **平台的技術選擇本身就是治理決策**：AILT 選擇不提供下載、TCMB 的 API 需要固定 IP、data.cip.gov.tw 使用 ASP.NET postback——這些不是中性的技術決定，它們直接塑造了誰可以使用資料、以什麼方式使用。

3. **「斷裂」不只發生在資料之間，也發生在入口之間**：TICD 從機構域名消失、TCMB 改版後舊路徑失效、data.gov.tw 的 API 搜尋不運作——資料可能還在，但通往資料的路徑是脆弱的。

4. **自動化盤點的極限**：即使使用 Playwright 模擬真人瀏覽，仍有許多資訊無法取得（AILT 登入後功能、TCMB 詮釋資料填寫率、TICD 實際檔案內容）。完整的盤點最終需要人工介入。

---

## 附錄：勘查腳本清單

| 腳本 | 用途 | 結果 |
|------|------|------|
| `scripts/audit-sources.mjs` | 第一輪：五個來源全面掃描 | 取得 AILT 語料結構、TCMB 基本資訊；data.cip.gov.tw 和 data.gov.tw 失敗 |
| `scripts/audit-round2.mjs` | 第二輪：補查 TCMB OpenAPI、data.gov.tw 重試、Google 搜尋 TICD | 取得 TCMB 搜尋結果（~8000 筆）、OpenAPI URL；data.gov.tw 部分成功 |
| `scripts/audit-cip.mjs` | 第三輪：data.cip.gov.tw 反自動化測試（三種策略） | 確認無反自動化措施，找到正確 URL 結構 |
| 內嵌 Node.js 腳本 | data.cip.gov.tw DataMenu 完整抓取、OSF TICD 內容擷取、data.gov.tw API 分析 | 取得 CIP 253 筆資料集清單、TICD 專案詳情、data.gov.tw API 結構 |
