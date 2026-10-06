# 驗證紀錄

日期：2026-10-06。純前端版本使用 ExcelJS 4.4.0、JSZip 3.10.1、ImageMagick WASM 0.0.44。

## 自動化

- `pnpm test`：16 項順序／配對測試、8 項真實 xlsx 寫入與讀回測試，以及 2 項本機資料夾讀取測試；包含 A 模式任意檔名、保留選入順序、自動連續序號、重複數字前綴不擋匯入，以及 JIFF/JFIF、空白／通用 MIME 類型、GIF 副檔名／MIME 排除。B 模式維持前導零正規化、數字編號排序與重複編號阻擋。
- Excel 往返包含：A 欄自動文字序號、B2/B3/B4 圖片、B 模式缺號時 C2/C4 配對、原有 B 圖片、公式、格式、合併範圍、其他工作表、重試不累積、取消不更動來源、已佔用目標與不支援檔案。
- `pnpm run test:browser`：10 項 Microsoft Edge 測試通過。真實下載 A.xlsx，再透過檔案選取載入、補圖並下載 B.xlsx；重新讀取下載內容驗證圖片數及位置。檢查沒有外部 HTTP 請求，並測試 A 重複數字前綴可匯入、B 重複編號阻擋、損壞檔、預覽失效與 320 px 不橫向溢出。
- 資料夾測試使用瀏覽器真實的 FileSystemDirectoryHandle 合成素材，僅替代原生選取器回傳結果；包含巢狀資料夾、JIFF、TIFF 與 GIF，確認按資料夾走訪順序顯示與匯出，略過 GIF 後 A 欄序號保持連續。網站程式只要求 `mode: 'read'`、讀取檔案，不保存 handle 或寫入資料夾。測試素材的建立與清除僅存在測試程式。
- 確認頁面沒有 `webkitdirectory` 或舊式資料夾上傳輸入；不支援時使用普通多選檔案選擇器。取消、授權拒絕或超過 500 個檔案時保留先前選取與預覽，不替換成部分資料夾內容。資料夾與圖片流程的 HTTP 請求僅允許本站 GET／HEAD 程式資源，不傳送照片或 Excel。
- 新增格式測試驗證 JIFF、JFIF、WebP、SVG、BMP、AVIF、TIFF、HEIC、PSD、TGA、JXL 共 11 種輸入的真實縮圖與 Excel 匯出；使用任意檔名和重複數字前綴，確認保留選入順序與自動序號，並逐張檢查嵌入的 JPEG 尺寸及圖片定位。另以真實 GIF 測試副檔名、MIME 與改名成 PNG 的內容檢查，確認不產生下載。
- `pnpm run build`：TypeScript 檢查及 Vite 正式建置。
- `pnpm run test:pages`：將正式 `dist/` 掛在 `/photo-tool/` 子路徑，檢查正式 CSS、桌面／手機排版、A 與 B 的 Excel 下載、既有圖片保留、缺號不錯列與重複補圖阻擋；另以 TIFF 驗證按需載入的 WASM 資源與正式建置的縮圖／Excel 轉檔。GitHub Actions 在部署前執行此檢查，CI 使用 Chromium；本機使用 Microsoft Edge。
- `pnpm run test:pages <網站網址>`：可對已部署網站執行相同功能檢查，僅使用程式生成的範例圖片，檔案在瀏覽器處理及本機下載，不上傳到網站。這是驗證指令的用法，不代表已確認遠端網站。

瀏覽器測試需有 Microsoft Edge，使用本機 3000 埠，輸出檔案與截圖位於 `artifacts/`，不提交 Git。測試素材 `tests/fixtures/sample.jpg` 是程式生成的 001 色塊，非個人照片，可隨原始碼提交。可用 `node scripts/generate-test-fixture.mjs` 重建。

其他格式素材均為合成圖片，可用 `node scripts/generate-image-fixtures.mjs` 重建；HEIC 編碼使用 macOS 的 `sips`，其他平台沿用已附的 HEIC 測試素材。這些素材（含驗證排除行為的 GIF）是測試所需，清理時應保留。

`dist/`、瀏覽器測試產生的 XLSX 與截圖都是可重新產生的輸出。清理套件安裝目錄後，先執行 `pnpm install --frozen-lockfile`；正式建置驗證前須先執行 `pnpm run build`。保留的部署包 `artifacts/github-pages.zip` 可直接解壓使用。

## 尚需使用者環境驗收

- 本次以 ExcelJS 讀回及檔案內 XML／影像檢查輸出，未在 Microsoft Excel 桌面版實際開啟檢查視覺效果。請用代表性公司照片表確認顯示、字型、列高與儲存後結果。
- 網頁不能完整保留所有 Excel 進階功能。已知不支援結構會拒絕；一般檔案的輸出仍應檢查。永遠以新檔下載，保留來源檔。
- 測試公司允許的瀏覽器是否支援資料夾選取與下載；若資料夾按鈕不可用，改用多選照片。
- 自動化不操作作業系統的原生資料夾視窗。瀏覽器必要的唯讀存取授權仍可能出現，網站無法關閉；本次移除的是觸發「上傳 xx 個檔案」確認的舊式資料夾上傳流程。
- 大量照片仍受瀏覽器記憶體限制，依實際照片大小調整批次數量。一次 500 個是上限，不是任何裝置的效能保證。
- GitHub Pages 已使用 GitHub Actions 部署。更新是否成功，須確認對應提交的 Actions 結果，以及正式網站的實際版本。

ExcelJS 功能文件：[圖片與瀏覽器使用](https://github.com/exceljs/exceljs#images)。
