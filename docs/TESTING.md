# 驗證紀錄

日期：2026-10-04。純前端版本使用 ExcelJS 4.4.0、JSZip 3.10.1。

## 自動化

- `pnpm test`：13 項排序／配對測試，以及 8 項真實 xlsx 寫入與讀回測試。
- Excel 往返包含：文字前導零、B2/B3/B4 圖片、缺號時 C2/C4 配對、原有 B 圖片、公式、格式、合併範圍、其他工作表、重試不累積、取消不更動來源、已佔用目標與不支援檔案。
- `pnpm run test:browser`：Microsoft Edge 真實下載 A.xlsx，再透過檔案選取載入、補圖並下載 B.xlsx；重新讀取下載內容驗證圖片數及位置。檢查沒有外部 HTTP 請求，並測試重複、損壞檔、預覽失效與 320 px 不橫向溢出。
- `pnpm run build`：TypeScript 檢查及 Vite 正式建置。
- `pnpm run test:pages`：將正式 `dist/` 掛在 `/photo-tool/` 子路徑，檢查正式 CSS、桌面／手機排版、A 與 B 的 Excel 下載、既有圖片保留、缺號不錯列與重複補圖阻擋。此檢查也在 GitHub Actions 部署前執行（CI 使用 Chromium）。
- `pnpm run test:pages https://yenyuy.github.io/Excel_Picture_Mapping/`：對正式網站執行相同功能檢查，僅使用程式生成的範例圖片，檔案在瀏覽器處理及本機下載，不上傳到網站。

瀏覽器測試需有 Microsoft Edge，使用本機 3000 埠，輸出檔案與截圖位於 `artifacts/`，不提交 Git。測試素材 `tests/fixtures/sample.jpg` 是程式生成的 001 色塊，非個人照片，可隨原始碼提交。可用 `node scripts/generate-test-fixture.mjs` 重建。

## 尚需使用者環境驗收

- 本次以 ExcelJS 讀回及檔案內 XML／影像檢查輸出，未在 Microsoft Excel 桌面版實際開啟檢查視覺效果。請用代表性公司照片表確認顯示、字型、列高與儲存後結果。
- 網頁不能完整保留所有 Excel 進階功能。已知不支援結構會拒絕；一般檔案的輸出仍應檢查。永遠以新檔下載，保留來源檔。
- 測試公司允許的瀏覽器是否支援資料夾選取與下載；若資料夾按鈕不可用，改用多選照片。
- 大量照片仍受瀏覽器記憶體限制，依實際照片大小調整批次數量。一次 500 個是上限，不是任何裝置的效能保證。
- GitHub Actions / Pages 須在你的 repository 啟用後才能確認遠端部署；本次不宣稱已上線。

ExcelJS 功能文件：[圖片與瀏覽器使用](https://github.com/exceljs/exceljs#images)。
