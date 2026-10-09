import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';

const { version } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

test('keeps the preview current and explains the workbook requirement when switching modes', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.version[data-app-version]')).toHaveText(`v${version}`);
  await expect(page.locator('#mode-description')).toHaveText('A 欄序號 / B 欄照片 / C 欄預留');
  await expect(page.locator('#preview-empty')).toBeVisible();
  await expect(page.locator('#preview-panel')).toBeHidden();
  await expect(page.locator('.sheet-example')).toBeVisible();
  await expect(page.locator('.sheet-example-columns span')).toHaveText(['A', 'B', 'C']);
  await expect(page.locator('#empty-cell-b')).toBeVisible();
  await expect(page.locator('#empty-cell-c')).toBeVisible();
  await expect(page.locator('#empty-cell-b')).toHaveText('照片依序放入');
  await expect(page.locator('#empty-cell-c')).toHaveText('留給之後補圖');
  const initialDescription = await page.locator('#empty-description').textContent();

  await page.locator('#sample').click();
  await expect(page.locator('#selection')).toContainText('已選取 3 個檔案');
  await expect(page.locator('#empty-description')).not.toHaveText(initialDescription!);
  await expect(page.locator('#preview-empty')).toBeVisible();
  await page.locator('#preview').click();
  await expect(page.locator('#preview-panel')).toBeVisible();
  await expect(page.locator('#preview-empty')).toBeHidden();
  await expect(page.locator('#ready-count')).toHaveText('3 張可匯入');
  await expect(page.locator('#import')).toBeEnabled();

  await page.locator('#sheet-name').fill('現場巡檢');
  await expect(page.locator('#preview-panel')).toBeHidden();
  await expect(page.locator('#preview-empty')).toBeVisible();
  await expect(page.locator('#import')).toBeDisabled();
  await page.locator('#preview').click();
  await expect(page.locator('#preview-panel')).toBeVisible();
  await expect(page.locator('#destination')).toContainText('現場巡檢');

  await page.locator('#mode-b').click();
  await expect(page.locator('#mode-description')).toHaveText('A 欄編號 / C 欄照片 / 另存新檔');
  await expect(page.locator('#preview-panel')).toBeHidden();
  await expect(page.locator('#preview-empty')).toBeVisible();
  await expect(page.locator('#empty-cell-b')).toHaveText('保留原有照片');
  await expect(page.locator('#empty-cell-c')).toHaveText('依編號補入照片');
  await expect(page.locator('#selection')).toHaveText('尚未選取照片');
  await expect(page.locator('#preview')).toBeDisabled();

  await page.locator('#sample').click();
  await expect(page.locator('#selection')).toContainText('已選取 3 個檔案');
  await expect(page.locator('#empty-description')).toContainText('Excel');
  await expect(page.locator('#preview')).toBeDisabled();

  const source = new ExcelJS.Workbook();
  const sheet = source.addWorksheet('來源巡檢');
  sheet.addRow(['編號', '原有照片', '對照照片']);
  sheet.addRow(['001']);
  sheet.addRow(['003']);
  sheet.getColumn(3).width = 30;
  sheet.getRow(2).height = 150;
  sheet.getRow(3).height = 150;
  await page.locator('#workbook-input').setInputFiles({
    name: '巡檢來源.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from(await source.xlsx.writeBuffer()),
  });
  await expect(page.locator('#workbook-status')).toContainText('巡檢來源.xlsx');
  await expect(page.locator('#preview')).toBeEnabled();
  await page.locator('#preview').click();
  await expect(page.locator('#preview-empty')).toBeHidden();
  await expect(page.locator('#preview-panel')).toBeVisible();
  await expect(page.locator('#destination')).toContainText('來源巡檢');
  await expect(page.locator('#ready-count')).toHaveText('2 張可匯入');
  await expect(page.locator('#preview-body tr').last()).toContainText('A 欄找不到編號');
});

test('keeps the workbench and its actions reachable on mobile, tablet and desktop', async ({ page }) => {
  for (const width of [320, 380, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    for (const id of ['mode-a', 'mode-b', 'folder-button', 'files-button', 'sample', 'preview']) {
      const action = page.locator(`#${id}`);
      await expect(action).toBeVisible();
      await action.scrollIntoViewIfNeeded();
      const bounds = await action.boundingBox();
      expect(bounds, `${id} has a layout at ${width}px`).not.toBeNull();
      expect(bounds!.x, `${id} starts inside the viewport at ${width}px`).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width, `${id} fits inside the viewport at ${width}px`).toBeLessThanOrEqual(width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `initial page fits at ${width}px`).toBe(true);

    await page.locator('#mode-a').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#mode-b')).toBeFocused();
    const focus = await page.locator('#mode-b').evaluate(element => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(focus.style, `keyboard focus is visible at ${width}px`).not.toBe('none');
    expect(focus.width, `keyboard focus has a visible outline at ${width}px`).toBeGreaterThan(0);

    await page.locator('#sample').click();
    await page.locator('#preview').click();
    await expect(page.locator('#preview-panel')).toBeVisible();
    await page.locator('#import').scrollIntoViewIfNeeded();
    await expect(page.locator('#import')).toBeVisible();
    await expect(page.locator('#import')).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `preview fits at ${width}px`).toBe(true);
  }
});
