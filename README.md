# 照片批次匯入 Excel｜純前端網頁

只讀取你選取的本機照片與 Excel，**所有處理都在瀏覽器記憶體完成，不會上傳或存放於網站伺服器、GitHub**。不需要帳號、後端或 Excel 增益集。

重新整理或關閉頁面會清除此頁暫存的選取檔案與匯出資料；已下載的 Excel 保留在你的裝置。網站仍會以 GET／HEAD 下載網頁、CSS、JavaScript 與按需載入的 WASM 等靜態資源，這些請求不包含選取的照片或 Excel。不使用 CDN 或分析追蹤。

## 兩種模式

| 模式 | 照片規則 | Excel 結果 |
| --- | --- | --- |
| A：建立新 Excel | 檔名不限，保留瀏覽器提供的檔案順序 | A 欄自動產生 1、2、3… 序號，B2 起依序放照片，C 欄預留 |
| B：既有 Excel 補圖 | 檔名須以數字開頭，依編號配對 | 對照 A 欄編號放入 C 欄，另存 `_補圖.xlsx` |

A 模式可使用 `現場.jiff`、`IMG_20261006.png` 等任意檔名，相同數字前綴或同名照片也可匯入；略過的檔案不佔序號。資料夾包含子資料夾，實際順序以匯入預覽為準。網頁無法讀取 Finder／檔案總管的排序設定。

B 模式取檔名開頭的連續數字，例如 `001_現場.jpg`；`001` 與 `1` 視為同一編號。照片編號重複會擋下整批；A 欄編號重複、找不到編號或 C 欄位置已佔用會略過。若 A2／A3／A4 為 1／2／3，只選 `001.jpg` 與 `003.jpg`，會放入 C2／C4，C3 留白。使用 A 模式建立的表格時，補圖檔名須對應自動產生的 A 欄序號。

## 圖片與本機資料夾

- 接受 GIF 以外的圖片格式，包括 JPG／JPEG／**JIFF／JFIF**、PNG、WebP、AVIF、BMP、SVG、HEIC／HEIF、TIFF、PSD、TGA、JXL 等。GIF 會略過，改副檔名的 GIF 內容也會拒絕匯入。少數特殊格式取決於解碼器，無法解碼時會顯示錯誤。
- 一般圖片由瀏覽器解碼；其他格式使用隨網站打包的 ImageMagick WASM。第一次處理特殊格式時可能需要等待程式資源載入，照片仍只在本機轉換。多頁、多影格或分層格式只匯入解碼器讀取的第一張影像。
- 匯出圖片等比例縮為 JPEG，長邊最多 1280 px、品質 85%，透明背景轉白色。圖片是 Excel 的浮動圖片；在 Excel 排序或調整尺寸後，請檢查位置。

「讀取本機資料夾」使用支援瀏覽器的唯讀資料夾選取功能，不使用舊式資料夾上傳介面。不支援的瀏覽器（例如 Firefox、Safari）會改開普通的「多選照片」視窗。瀏覽器仍可能要求允許讀取本機資料夾，這項權限提示由瀏覽器控制，網站無法移除；允許讀取不會把檔案上傳。

## 使用方式與限制

1. 選 A 或 B 模式，再讀取資料夾或多選照片。也可按「試用範例照片」。
2. A 模式可設定工作表名稱、列高與欄寬；B 模式須選既有 `.xlsx` 和工作表，也可按「使用上次產生的 Excel」。
3. 按「預覽順序與配對」確認檔名、序號／編號、位置及略過原因，再產生並下載 Excel。

原始照片與 Excel 不會被修改。B 模式保留列高與欄寬，合併、隱藏、已有內容／公式／圖片或尺寸不足的位置不插圖；取消或失敗不下載部分完成的檔案。

每批最多 **500 個檔案**，資料夾內非圖片檔也計入上限；圖片單檔最多 40 MB，縮圖 Base64 合計最多 100 MB。Excel 最多 50 MB，B 模式配對至第 10,000 列。僅支援 `.xlsx`，不支援 `.xls`、`.xlsm` 或開啟密碼保護檔。圖表、巨集、樞紐分析等複雜 Excel 功能可能被拒絕，下載後請檢查結果。詳見[使用與部署說明](docs/SETUP.md)。

## 本機啟動與 GitHub Pages 部署

需要 Node.js 22.12+ 或 24，以及 pnpm。首次使用或 `node_modules/` 已清除時，先安裝依賴：

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

開啟 <http://127.0.0.1:3000/>。

本 repository 已啟用 GitHub Pages，**Settings → Pages → Build and deployment → Source** 使用 **GitHub Actions**。網站網址：[照片批次匯入 Excel](https://yenyuy.github.io/Excel_Picture_Mapping/)。

已附 [GitHub Pages 工作流程](.github/workflows/deploy.yml)：推送到 `main` 或 `master` 後，自動安裝鎖定依賴、執行單元測試、建置網站，再以 Chromium 驗證正式網站的 CSS 與 Excel 匯出，通過後部署 `dist/`。流程使用 Node.js 24、pnpm 11.19.0；也可在 GitHub 的 **Actions → Deploy website to GitHub Pages → Run workflow** 手動觸發。每次修改後推送原始碼即可更新網站，詳見[部署說明](docs/SETUP.md)。

若需要手動部署 ZIP 作為備選，本機執行：

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm run test:pages
pnpm run package:pages
```

`dist/` 是建置後的靜態網站，專案內附的 `artifacts/github-pages.zip` 是可部署壓縮包，可直接下載使用。將 ZIP **解壓後的全部內容**放到 GitHub repository 的專用部署分支根目錄，包含 `index.html`、`assets/`（含 `.wasm`）、`licenses/`、`icon.svg`、`.nojekyll`。GitHub Pages 不會自動解壓 ZIP。

若改用手動分支部署，在 repository 的 **Settings → Pages → Build and deployment** 選 **Deploy from a branch**，指定部署分支與 `/ (root)`。開發用的專案根目錄 `index.html` 引用 TypeScript，必須先建置，不能直接作為 Pages 成品。手動部署每次修改都須重新建置、驗證與打包；相對資源路徑支援根網域及 repository 子路徑。

`pnpm run preview` 可用 HTTP 預覽已建置的 `dist/`；請使用指令顯示的網址，勿雙擊 HTML 以 `file://` 開啟。瀏覽器驗證指令在本機使用 Microsoft Edge。

## 開發檔案與可重建資料

```sh
pnpm test
pnpm run check
pnpm run test:browser
```

測試包含順序／配對、真實 Excel 往返、格式轉換、本機資料夾與下載流程，紀錄見[驗證說明](docs/TESTING.md)。

| 路徑 | 用途 |
| --- | --- |
| `src/`、根目錄 `index.html` | 網頁、資料夾讀取、格式解碼、排序／配對及 Excel 程式 |
| `public/` | 圖示、`.nojekyll` 與 ImageMagick 授權／NOTICE，部署時須保留 |
| `tests/` | 單元與瀏覽器測試；`fixtures/` 是合成圖片素材，須保留 |
| `scripts/` | 素材產生、正式網站驗證與部署 ZIP 打包 |
| `docs/` | 使用、部署與驗證紀錄 |
| `.github/workflows/deploy.yml` | 推送到 `main`／`master` 時驗證、建置並自動部署 GitHub Pages |
| `package.json`、`pnpm-lock.yaml`、設定檔 | 依賴、指令與建置／測試設定 |
| `artifacts/github-pages.zip` | 隨專案提交的部署成品；網站程式修改後需重新產生 |

`node_modules/` 是可由 `pnpm install --frozen-lockfile` 重建的依賴；`dist/` 由 `pnpm run build` 重建。`artifacts/` 內的測試截圖、測試 Excel 和執行紀錄可清除，執行測試會重新產生；保留最新的部署 ZIP 即可。`.DS_Store` 與空的佔位檔不屬於程式必需檔案。
