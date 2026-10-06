import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { ImageMagick, initializeImageMagick } from '@imagemagick/magick-wasm';

const fixtures = new URL('../fixtures/', import.meta.url);
const formats = [
  { name: '旅遊照片.jiff', fixture: 'jpg', mimeType: '' },
  { name: '未編號.JFIF', fixture: 'jpg', mimeType: 'application/octet-stream' },
  { name: '010-現場.webp', fixture: 'webp', mimeType: 'image/webp' },
  { name: '010_補拍.svg', fixture: 'svg', mimeType: 'image/svg+xml' },
  { name: '005.bmp', fixture: 'bmp', mimeType: 'image/bmp' },
  { name: '006.avif', fixture: 'avif', mimeType: 'image/avif' },
  { name: '007.tiff', fixture: 'tiff', mimeType: 'image/tiff' },
  { name: '008.heic', fixture: 'heic', mimeType: 'image/heic' },
  { name: '009.psd', fixture: 'psd', mimeType: 'application/octet-stream' },
  { name: 'backyard.tga', fixture: 'tga', mimeType: '' },
  { name: '011.jxl', fixture: 'jxl', mimeType: 'image/jxl' },
];

test('preserves supplied image order and exports arbitrary and duplicate-prefix filenames in all supported formats', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const externalRequests: string[] = [];
  const nonReadRequests: string[] = [];
  const wasmRequests: string[] = [];
  const errors: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:3000') {
      externalRequests.push(request.url());
    }
    if (['http:', 'https:'].includes(url.protocol) && !['GET', 'HEAD'].includes(request.method())) {
      nonReadRequests.push(`${request.method()} ${request.url()}`);
    }
    if (url.pathname.endsWith('.wasm')) wasmRequests.push(request.url());
  });
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('/');
  await page.locator('#files-input').setInputFiles(await Promise.all(formats.map(async item => ({
    name: item.name,
    mimeType: item.mimeType,
    buffer: await readFile(new URL(`sample.${item.fixture}`, fixtures)),
  }))));
  await page.locator('#preview').click();
  await expect(page.locator('#ready-count')).toHaveText(`${formats.length} 張可匯入`);

  await expect(page.locator('#preview-body .filename')).toHaveText(formats.map(item => item.name));
  await expect(page.locator('#preview-body .photo-id')).toHaveText(formats.map((_, index) => `序號 ${index + 1}`));
  for (let index = 0; index < formats.length; index++) {
    const thumbnail = page.locator('#preview-body tr').nth(index).locator('img.thumb');
    await expect(thumbnail).toBeVisible({ timeout: 5_000 });
    await thumbnail.scrollIntoViewIfNeeded();
    await expect(thumbnail).toHaveJSProperty('naturalWidth', 120);
    await expect(thumbnail).toHaveJSProperty('naturalHeight', 80);
  }

  const downloaded = page.waitForEvent('download');
  await page.locator('#import').click();
  const workbookPath = testInfo.outputPath('image-formats.xlsx');
  await (await downloaded).saveAs(workbookPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const sheet = workbook.worksheets[0];
  expect(formats.map((_, index) => sheet.getCell(index + 2, 1).value)).toEqual(formats.map((_, index) => String(index + 1)));
  const embedded = sheet.getImages();
  expect(embedded).toHaveLength(formats.length);

  await initializeImageMagick(await readFile(new URL(import.meta.resolve('@imagemagick/magick-wasm/magick.wasm'))));
  for (let index = 0; index < embedded.length; index++) {
    const image = workbook.getImage(Number(embedded[index].imageId));
    expect(image.extension).toBe('jpeg');
    const bytes = image.buffer ? Buffer.from(image.buffer) : Buffer.from(image.base64!.split(',').pop()!, 'base64');
    expect(bytes.length).toBeGreaterThan(100);
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    ImageMagick.read(bytes, decoded => {
      expect(decoded.format).toBe('JPEG');
      expect(decoded.width).toBe(120);
      expect(decoded.height).toBe(80);
    });
    expect(embedded[index].range.tl.nativeCol).toBe(1);
    expect(embedded[index].range.tl.nativeRow).toBe(index + 1);
  }
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
  expect(nonReadRequests).toEqual([]);
  expect(wasmRequests.length).toBeGreaterThan(0);
});

test('rejects GIF extensions, GIF MIME types and GIF bytes hidden behind an accepted extension', async ({ page }) => {
  const gif = await readFile(new URL('sample.gif', fixtures));
  const downloads: string[] = [];
  page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.goto('/');
  await page.locator('#files-input').setInputFiles([
    { name: '001.GIF', mimeType: '', buffer: gif },
    { name: '002.jpg', mimeType: 'image/gif', buffer: gif },
    { name: 'unnumbered.gif', mimeType: 'image/gif', buffer: gif },
  ]);
  await page.locator('#preview').click();
  await expect(page.locator('#ready-count')).toHaveText('0 張可匯入');
  await expect(page.locator('#preview-body td.skip')).toHaveText(['不支援 GIF 格式', '不支援 GIF 格式', '不支援 GIF 格式']);
  await expect(page.locator('#import')).toBeDisabled();
  await expect(page.locator('#download-panel')).toBeHidden();

  await page.locator('#files-input').setInputFiles({ name: '003.png', mimeType: 'image/png', buffer: gif });
  await page.locator('#preview').click();
  await expect(page.locator('#ready-count')).toHaveText('1 張可匯入');
  await page.locator('#import').click();
  await expect(page.locator('#message')).toContainText('GIF');
  await expect(page.locator('#progress-text')).toContainText('作業已停止');
  await expect(page.locator('#download-panel')).toBeHidden();
  await expect(page.locator('#import')).toBeDisabled();
  expect(downloads).toEqual([]);
});

test('reads actual directory handles recursively in their supplied order and exports consecutive photo rows', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const directoryFiles = await Promise.all([
    { name: 'z現場.jiff', fixture: 'jpg' },
    { name: 'a參考.svg', fixture: 'svg' },
    { name: '001.jpg', fixture: 'jpg' },
    { name: '子資料夾/任意照片.tiff', fixture: 'tiff' },
    { name: '子資料夾/1.jpg', fixture: 'jpg' },
    { name: 'middle.gif', fixture: 'gif' },
  ].map(async file => ({ name: file.name, bytes: [...await readFile(new URL(`sample.${file.fixture}`, fixtures))] })));
  await page.goto('/');
  const supplied = await page.evaluate(async entries => {
    // Fixtures live in OPFS solely to obtain real browser directory/file handles.
    // The application receives the handle through the same picker API it uses for disk folders.
    type Directory = FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemDirectoryHandle | FileSystemFileHandle> };
    const storage = await navigator.storage.getDirectory();
    const chosen = await storage.getDirectoryHandle('照片資料夾', { create: true });
    for (const entry of entries) {
      const parts = entry.name.split('/');
      let directory = chosen;
      for (const name of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(name, { create: true });
      const handle = await directory.getFileHandle(parts.at(-1)!, { create: true });
      const writable = await handle.createWritable();
      await writable.write(new Uint8Array(entry.bytes));
      await writable.close();
    }
    const paths: string[] = [];
    const walk = async (directory: Directory, prefix: string): Promise<void> => {
      for await (const handle of directory.values()) {
        const path = `${prefix}/${handle.name}`;
        if (handle.kind === 'directory') await walk(handle as Directory, path);
        else paths.push(path);
      }
    };
    await walk(chosen as Directory, chosen.name);
    const state = window as unknown as { pickerOptions: unknown[]; pickerHadUserGesture: boolean[] };
    state.pickerOptions = [];
    state.pickerHadUserGesture = [];
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: async (options: unknown) => {
        state.pickerOptions.push(options);
        state.pickerHadUserGesture.push(navigator.userActivation.isActive);
        return chosen;
      },
    });
    return paths;
  }, directoryFiles);
  expect(supplied).toHaveLength(6);
  expect(supplied).toContain('照片資料夾/子資料夾/任意照片.tiff');
  const accepted = supplied.filter(name => !/\.gif$/i.test(name));
  await page.locator('#folder-button').click();
  await expect(page.locator('#selection')).toContainText('已選取 6 個檔案');
  await expect(page.locator('input[webkitdirectory], #folder-input')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { pickerOptions: unknown[] }).pickerOptions)).toEqual([{ mode: 'read' }]);
  expect(await page.evaluate(() => (window as unknown as { pickerHadUserGesture: boolean[] }).pickerHadUserGesture)).toEqual([true]);
  await page.locator('#preview').click();
  await expect(page.locator('#ready-count')).toHaveText('5 張可匯入');
  await expect(page.locator('#preview-body .filename')).toHaveText(supplied);
  const readyRows = page.locator('#preview-body tr').filter({ has: page.locator('td.ready') });
  await expect(readyRows.locator('.filename')).toHaveText(accepted);
  await expect(readyRows.locator('.photo-id')).toHaveText(accepted.map((_, index) => `序號 ${index + 1}`));

  const downloaded = page.waitForEvent('download');
  await page.locator('#import').click();
  const workbookPath = testInfo.outputPath('folder-order.xlsx');
  await (await downloaded).saveAs(workbookPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  expect(accepted.map((_, index) => workbook.worksheets[0].getCell(index + 2, 1).value)).toEqual(['1', '2', '3', '4', '5']);
  expect(workbook.worksheets[0].getImages()).toHaveLength(5);
});
