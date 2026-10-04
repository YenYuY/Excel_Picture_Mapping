# GitHub Pages 部署與使用

## 使用方式

**建立新檔**：A 模式 → 選資料夾或多選照片 → 調整列高／欄寬 → 預覽 → 產生並下載 Excel。

**補入照片**：B 模式 → 選照片 → 選取既有 `.xlsx` → 選工作表 → 預覽配對 → 下載新檔。也可以使用上次產生的 Excel，不必重新選檔。

資料夾選取包含子資料夾，因此不同子資料夾出現相同編號時仍視為重複。圖片以檔名開頭數字配對；既有 A 欄須是非負整數或純數字文字。公式編號使用檔案中快取的結果，網頁不重新計算公式；必要時先由 Excel 計算並存檔。

補圖時不改列高與欄寬。若 C 欄太窄或列高不足，可先在 Excel 調整並存檔後重選。程式不覆蓋已有文字或圖片；要換圖請先刪除舊圖。原始檔保留，輸出另存下載。

## 方式一：上傳原始碼，自動建置

1. 在 GitHub 建立 repository，將本專案原始碼推送到 `main` 或 `master`。
2. 確認 `.github/workflows/deploy.yml`、`package.json`、`pnpm-lock.yaml`、`tests/fixtures/sample.jpg` 等已一併提交；檔案總清單可用 `git status --short` 檢查。
3. 在 repository 的 **Settings → Pages**，把 **Build and deployment → Source** 設為 **GitHub Actions**。
   **不要選 main / (root) 直接部署原始碼**：根目錄的 `index.html` 是開發入口，這會使 CSS 與 JavaScript 無法載入。自動部署會使用建置後的 `dist/`。
4. 到 **Actions → Deploy website to GitHub Pages**；首次上傳已觸發時等待完成，否則按 **Run workflow**。
5. 成功後 Settings → Pages 會顯示網站網址。後續推送上述分支會自動更新。

流程用 Node.js 24、pnpm 11.19.0，先跑單元與 Excel 往返測試、TypeScript 檢查，再建置 `dist/`。接著以 Chromium 檢查正式 CSS、手機排版、A/B 檔案下載與既有圖片保留，通過後才部署。沒有 GitHub Token 寫在原始碼內；使用工作流程內建的 Pages 權限。

若 repository 的 Pages 功能或 Actions 被帳號／組織政策限制，需要在 GitHub 允許對應功能。專案目前僅提供部署設定，未替你建立或推送遠端 repository。

## 方式二：只上傳建置後網站

本機執行 `pnpm install --frozen-lockfile`、`pnpm run build`。把 `dist/` **內部的全部內容**放到專用部署分支的根目錄（不是把整個 dist 資料夾再包一層），在 Pages 選擇 **Deploy from a branch** 並指定該分支與 `/ (root)`。

如果使用提供的 `artifacts/github-pages.zip`，先解壓，再上傳裡面的 `index.html`、`assets/`、`icon.svg`、`.nojekyll` 等。GitHub Pages 不會自動解壓 zip。每次改程式都要重新建置再上傳。

不要直接把開發用的根目錄 `index.html` 當成靜態成品，它引用 TypeScript 原始碼，須經建置才可使用。

## 路徑與本機預覽

`vite.config.ts` 的 `base: './'` 讓打包後的資源使用相對路徑，適用 repository 子路徑和根網域。沒有前端路由，因此無需額外 404 導頁。

```powershell
pnpm run build
pnpm run preview
```

以指令顯示的 HTTP 網址預覽，不要雙擊 `index.html` 用 `file://` 開啟。正式網站由 GitHub Pages 提供 HTTPS；不需要本機開發憑證或任何 Office 設定。

[Vite 官方 GitHub Pages 部署指引](https://vite.dev/guide/static-deploy.html#github-pages)
