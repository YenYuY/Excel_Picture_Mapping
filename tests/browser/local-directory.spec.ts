import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';

test('opens a normal multi-file picker when directory access is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', { configurable: true, value: undefined });
  });
  await page.goto('/');
  await expect(page.locator('#folder-button')).toBeVisible();
  await expect(page.locator('input[webkitdirectory], #folder-input')).toHaveCount(0);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#folder-button').click();
  const fileChooser = await chooser;
  expect(fileChooser.isMultiple()).toBe(true);
  expect(await fileChooser.element().getAttribute('webkitdirectory')).toBeNull();
  await expect(page.locator('#message')).toContainText('此瀏覽器不支援直接讀取資料夾');
  await fileChooser.setFiles([
    { name: '旅遊照片.jiff', mimeType: 'image/jpeg', buffer: await readFile(new URL('../fixtures/sample.jpg', import.meta.url)) },
    { name: '另一張.jpg', mimeType: 'image/jpeg', buffer: await readFile(new URL('../fixtures/sample.jpg', import.meta.url)) },
  ]);
  await expect(page.locator('#selection')).toContainText('已選取 2 個檔案');
  await page.locator('#preview').click();
  await expect(page.locator('#preview-body .filename')).toHaveText(['旅遊照片.jiff', '另一張.jpg']);
  await expect(page.locator('#preview-body .photo-id')).toHaveText(['序號 1', '序號 2']);
  await expect(page.locator('#connection')).toContainText('瀏覽器');
  await expect(page.locator('#connection')).toContainText('不會上傳');
});

test('cancelling directory selection preserves the previous preview and import plan', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => { throw new DOMException('User cancelled', 'AbortError'); },
    });
  });
  await page.goto('/');
  await page.locator('#sample').click();
  await expect(page.locator('#selection')).toContainText('已選取 3 個檔案');
  await page.locator('#preview').click();
  const selection = await page.locator('#selection').textContent();
  const names = await page.locator('#preview-body .filename').allTextContents();
  await page.locator('#folder-button').click();
  await expect(page.locator('#controls')).toBeEnabled();
  await expect(page.locator('#selection')).toHaveText(selection!);
  await expect(page.locator('#preview-panel')).toBeVisible();
  await expect(page.locator('#preview-body .filename')).toHaveText(names);
  await expect(page.locator('#ready-count')).toHaveText('3 張可匯入');
  await expect(page.locator('#import')).toBeEnabled();
  await expect(page.locator('#message')).toBeHidden();
});

test('a denied directory permission reports a local read error and preserves the current plan', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); },
    });
  });
  await page.goto('/');
  await page.locator('#sample').click();
  await expect(page.locator('#selection')).toContainText('已選取 3 個檔案');
  await page.locator('#preview').click();
  const selection = await page.locator('#selection').textContent();
  const names = await page.locator('#preview-body .filename').allTextContents();
  await page.locator('#folder-button').click();
  await expect(page.locator('#message')).toContainText('無法讀取本機資料夾');
  await expect(page.locator('#message')).toContainText('Permission denied');
  await expect(page.locator('#message')).toHaveClass('error');
  await expect(page.locator('#selection')).toHaveText(selection!);
  await expect(page.locator('#preview-body .filename')).toHaveText(names);
  await expect(page.locator('#preview-panel')).toBeVisible();
  await expect(page.locator('#controls')).toBeEnabled();
  await expect(page.locator('#folder-button')).toBeEnabled();
  await expect(page.locator('#preview')).toBeEnabled();
  await expect(page.locator('#import')).toBeEnabled();
});

test('rejects an oversized directory without replacing the previous files with partial results', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => ({
        kind: 'directory', name: '太多照片',
        async *values() {
          for (let index = 0; index < 501; index++) {
            const name = `照片${index}.jpg`;
            yield { kind: 'file', name, getFile: async () => new File(['fixture'], name, { type: 'image/jpeg' }) };
          }
        },
      }),
    });
  });
  await page.goto('/');
  await page.locator('#sample').click();
  await expect(page.locator('#selection')).toContainText('已選取 3 個檔案');
  await page.locator('#preview').click();
  const selection = await page.locator('#selection').textContent();
  const names = await page.locator('#preview-body .filename').allTextContents();
  await page.locator('#folder-button').click();
  await expect(page.locator('#message')).toContainText('單次最多 500 個檔案');
  await expect(page.locator('#selection')).toHaveText(selection!);
  await expect(page.locator('#preview-body .filename')).toHaveText(names);
  await expect(page.locator('#ready-count')).toHaveText('3 張可匯入');
  await expect(page.locator('#controls')).toBeEnabled();
  await expect(page.locator('#import')).toBeEnabled();
  const downloaded = page.waitForEvent('download');
  await page.locator('#import').click();
  const workbookPath = testInfo.outputPath('preserved-after-limit.xlsx');
  await (await downloaded).saveAs(workbookPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  expect(workbook.worksheets[0].getImages()).toHaveLength(3);
  expect([2, 3, 4].map(row => workbook.worksheets[0].getCell(row, 1).value)).toEqual(['1', '2', '3']);
});

test('a revoked permission while reading a folder preserves selection and leaves controls usable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async () => ({
        kind: 'directory', name: '讀取中撤回權限',
        async *values() {
          yield { kind: 'file', name: '第一張.jpg', getFile: async () => new File(['fixture'], '第一張.jpg', { type: 'image/jpeg' }) };
          yield {
            kind: 'file', name: '第二張.jpg',
            getFile: async () => { throw new DOMException('Read permission revoked', 'NotAllowedError'); },
          };
        },
      }),
    });
  });
  await page.goto('/');
  await page.locator('#sample').click();
  await expect(page.locator('#selection')).toContainText('已選取 3 個檔案');
  await page.locator('#preview').click();
  const selection = await page.locator('#selection').textContent();
  const names = await page.locator('#preview-body .filename').allTextContents();
  await page.locator('#folder-button').click();
  await expect(page.locator('#message')).toContainText('無法讀取本機資料夾');
  await expect(page.locator('#message')).toContainText('Read permission revoked');
  await expect(page.locator('#selection')).toHaveText(selection!);
  await expect(page.locator('#preview-body .filename')).toHaveText(names);
  await expect(page.locator('#ready-count')).toHaveText('3 張可匯入');
  await expect(page.locator('#controls')).toBeEnabled();
  await expect(page.locator('#folder-button')).toBeEnabled();
  await expect(page.locator('#import')).toBeEnabled();
});
