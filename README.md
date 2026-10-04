# 照片批次匯入 Excel｜純前端網頁

選取本機照片，在瀏覽器建立 Excel 或補入對照照片，再下載 `.xlsx`。可以直接部署到 **GitHub Pages**，無後端、無帳號，也不需要安裝 Excel 增益集。

## 兩種用法

| 模式 | 輸入 | 輸出 |
| --- | --- | --- |
| 建立新 Excel | A 資料夾照片 | 依編號排序；A 欄文字編號、B2 起放照片，C 欄預留 |
| 既有 Excel 補圖 | 既有 `.xlsx`、工作表、B 資料夾照片 | 依 A 欄編號配對 C 欄，下載新的 `_補圖.xlsx` |

例如既有表 A2/A3/A4 為 001/002/010，B 資料夾只有 001 和 010：會放入 **C2、C4**，C3 留白。原始 Excel 不覆寫。也可使用「使用上次產生的 Excel」直接接續操作。

檔名取開頭連續數字，如 `001_現場.jpg`；`001` 與 `1` 比對時相同。重複照片編號擋下整批；A 欄重複、缺號或目標格已佔用會列為略過。

## 本機啟動

需要 Node.js 22.12+ 或 24 LTS。使用 pnpm 11.19.0：

```powershell
pnpm install --frozen-lockfile
pnpm run dev
```

開啟 <http://127.0.0.1:3000/>。按「試用範例照片」也能產生真正的 Excel 檔；不再有模擬模式。

若已安裝一般 Node.js/npm，可改用 `npm install`、`npm run dev`。GitHub 工作流程使用提交的 pnpm lockfile。

## 放到 GitHub Pages

已附 `.github/workflows/deploy.yml`，推送到 `main` 或 `master` 後自動測試、建置並部署。

1. 將專案原始碼上傳 GitHub，**包含 `.github/`、`public/`、`src/`、`tests/` 與 `pnpm-lock.yaml`**。不要上傳 `node_modules/`、`artifacts/` 或個人照片。
2. Repository → **Settings → Pages → Source：GitHub Actions**。
3. 推送程式碼，或到 Actions 手動執行 **Deploy website to GitHub Pages**。
4. 完成後從 Pages 設定查看網址。

已使用相對資源路徑，同時支援 `username.github.io/` 與 `username.github.io/repository/`。不需要把 repo 名稱寫死。完整操作見 [部署說明](docs/SETUP.md)。

## 資料與相容性

- 照片及活頁簿在瀏覽器記憶體處理，**不傳送到應用程式伺服器或 GitHub**。程式庫與網站一起打包，不從 CDN 載入程式、不加入分析追蹤。
- 支援 JPG / JPEG / PNG；長邊最多 1280 px、JPEG 品質 85%，透明背景轉白色。
- 圖片為浮動圖片，不是 Excel「儲存格內圖片」。在 Excel 排序或調整尺寸後需檢查位置；自訂字型可能讓估算欄寬稍有差異。
- B 模式保留現有列高、欄寬；合併／隱藏／已有值或公式／已有圖片的位置不插入。儲存格寬高需至少 24 點。
- 支援一般表格、照片及常見格式；**不保證任意 Excel 功能完整往返**。已知圖表、巨集、樞紐分析、複雜圖形、裁切／旋轉照片、舊式註解等檔案會拒絕處理。公司複雜範本請先轉為單純的照片表；下載後檢查結果。
- 不支援 `.xls`、`.xlsm`、開啟密碼保護的檔案。工作表保護不會被移除。
- 每批最多 500 個照片檔、單檔 40 MB、縮圖 Base64 合計 100 MB。Excel 最多 50 MB，ZIP 宣告解壓總量最多 250 MB；配對 A 欄編號最多到第 10,000 列。
- 取消或失敗不下載部分完成的新檔，也不改動來源。封裝期間取消可能需要等目前步驟結束。網頁重新整理後需重新選檔，請先下載結果。

## 開發驗證

```powershell
pnpm test
pnpm run build
pnpm run test:browser
pnpm run preview
```

瀏覽器測試需要已安裝 Microsoft Edge。`dist/` 是可部署的靜態網站；`preview` 在本機預覽正式建置。詳見 [驗證說明](docs/TESTING.md)。

核心程式：`src/planner.ts` 排序配對、`src/images.ts` 縮圖、`src/workbook.ts` ExcelJS 讀寫、`src/main.ts` 網頁操作。此前的 Office.js、manifest 與憑證安裝流程已移除。
