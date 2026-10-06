# GitHub Pages 部署與使用

## 使用方式

**建立新檔**：A 模式 → 選資料夾或多選照片 → 調整列高／欄寬 → 預覽 → 產生並下載 Excel。

**補入照片**：B 模式 → 選照片 → 選取既有 `.xlsx` → 選工作表 → 預覽配對 → 下載新檔。也可以使用上次產生的 Excel，不必重新選檔。

「讀取本機資料夾」只要求唯讀存取，不使用舊式資料夾上傳選取流程；不支援的瀏覽器會改開普通多選檔案視窗。瀏覽器仍可能顯示必要的資料夾讀取授權，網站無法關閉這項提示。

照片與 Excel 不會上傳或存放在伺服器，僅在你的電腦瀏覽器記憶體處理。網站只下載網頁與程式資源，這些請求不包含選取的照片或 Excel。重新整理或關閉頁面會清除此頁暫存；已下載的 Excel 留在你的裝置。

資料夾選取包含子資料夾。A 模式不限圖片檔名，也不會因數字前綴重複而擋住匯入；依瀏覽器提供的檔案順序放入 B 欄，A 欄自動產生 1、2、3… 序號。網頁無法取得 Finder／檔案總管的排序設定，實際順序以預覽為準。

B 模式仍以檔名開頭數字配對；不同子資料夾出現相同編號時視為重複。既有 A 欄須是非負整數或純數字文字。公式編號使用檔案中快取的結果，網頁不重新計算公式；必要時先由 Excel 計算並存檔。若使用 A 模式剛建立的表格，補圖檔名的編號需對應自動產生的 A 欄序號。

補圖時不改列高與欄寬。若 C 欄太窄或列高不足，可先在 Excel 調整並存檔後重選。程式不覆蓋已有文字或圖片；要換圖請先刪除舊圖。原始檔保留，輸出另存下載。

## 自動部署到 GitHub Pages

本專案附有 `.github/workflows/deploy.yml`。推送到 `main` 或 `master` 時會自動安裝套件、執行單元測試、建置網站，再以 Chromium 驗證正式網站的 CSS、圖片轉換與 Excel 匯出；通過後才部署到 GitHub Pages。也可在 **Actions → Deploy website to GitHub Pages → Run workflow** 手動執行。

1. 將完整原始碼提交到 GitHub，包含 `.github/`、`public/`、`src/`、`tests/`、`scripts/` 與 `pnpm-lock.yaml`。`node_modules/`、`dist/`、測試輸出和本機資料由 `.gitignore` 排除。
2. Repository → **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。此 repository 已使用這個設定。
3. 推送後，在 Actions 確認測試與部署結果，完成後開啟 [網站](https://yenyuy.github.io/Excel_Picture_Mapping/)。

工作流程使用 Node.js 24 與 pnpm 11.19.0。部署的是建置後的 `dist/`，不會把開發入口直接當成網站發布。GitHub 上保存的是程式碼與合成測試素材，使用者選取的照片及 Excel 仍只在瀏覽器處理。

## 本機建置與打包

準備 Node.js 22.12 以上或 Node.js 24，以及 pnpm。首次開發或清理 `node_modules/` 後，先安裝套件：

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run build
pnpm run test:pages
pnpm run package:pages
```

`dist/` 是建置結果，`artifacts/github-pages.zip` 是可供部署的完整壓縮包。`test:pages` 會在本機檢查正式建置的資源、排版與 Excel 匯出；本機需要 Microsoft Edge。這些本機指令不會發布網站。

## 備選：手動部署建置後網站

若使用自動部署，保留上述 **GitHub Actions** 設定即可。需要自行發布部署包時，再改用以下分支部署方式：

1. 在 GitHub 建立或使用既有 repository，準備專用部署分支，例如 `gh-pages`。
2. 解壓 `artifacts/github-pages.zip`，將**裡面的全部內容**放到部署分支的根目錄；也可以直接使用 `dist/` 的內容。須包含 `index.html`、`assets/`（含 `.wasm`）、`licenses/`、`icon.svg` 及隱藏檔 `.nojekyll`。
3. Repository → **Settings → Pages** → **Build and deployment → Source** 選擇 **Deploy from a branch**，指定部署分支與 **/ (root)**，再儲存。
4. 等待部署完成後，使用 Pages 顯示的網址開啟網站。每次改程式，都須重新建置並更新部署分支的內容。

GitHub Pages 不會自動解壓 ZIP。請發布建置結果；開發用的根目錄 `index.html` 引用 TypeScript 原始碼，直接發布會無法正常使用。不要把整個 `dist/` 資料夾再包一層，或只更新 HTML 而遺漏對應的 `assets/`。

## 路徑與本機預覽

`vite.config.ts` 的 `base: './'` 讓打包後的資源使用相對路徑，適用 repository 子路徑和根網域。沒有前端路由，因此無需額外 404 導頁。

```sh
pnpm run build
pnpm run preview
```

以指令顯示的 HTTP 網址預覽，不要雙擊 `index.html` 用 `file://` 開啟。正式網站由 GitHub Pages 提供 HTTPS；不需要本機開發憑證或任何 Office 設定。

相關官方說明：[GitHub Pages 發布來源設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)、[Vite 靜態網站建置與預覽](https://vite.dev/guide/static-deploy.html#building-the-app)。
