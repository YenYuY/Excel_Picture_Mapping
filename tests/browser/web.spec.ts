import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';

test('downloads actual A/B workbooks and preserves original photos without external requests',async({page},testInfo)=>{
  const errors:string[]=[],remote:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.url().startsWith('http')&&!request.url().startsWith('http://127.0.0.1:3000'))remote.push(request.url());});
  await page.goto('/');await expect(page.locator('#connection')).toContainText('純本機處理');
  await page.locator('#sample').click();await page.locator('#preview').click();
  await expect(page.locator('#ready-count')).toHaveText('3 張可匯入');
  const aDownload=page.waitForEvent('download');await page.locator('#import').click();const a=await aDownload;
  const aPath=testInfo.outputPath('A.xlsx');await a.saveAs(aPath);
  const aBook=new ExcelJS.Workbook();await aBook.xlsx.readFile(aPath);
  expect(aBook.worksheets[0].getCell('A2').value).toBe('001');expect(aBook.worksheets[0].getImages()).toHaveLength(3);
  await page.locator('#mode-b').click();await page.locator('#workbook-input').setInputFiles(aPath);
  await expect(page.locator('#workbook-status')).toContainText('A.xlsx');
  await page.locator('#sample').click();await page.locator('#preview').click();
  await expect(page.locator('#ready-count')).toHaveText('2 張可匯入');
  await expect(page.locator('#preview-body tr').nth(1)).toContainText('C4');
  await expect(page.locator('#preview-body tr').last()).toContainText('A 欄找不到編號');
  await page.screenshot({path:'artifacts/web-mobile.png',fullPage:true});
  await page.setViewportSize({width:1200,height:900});await page.screenshot({path:'artifacts/web-desktop.png',fullPage:true});
  const bDownload=page.waitForEvent('download');await page.locator('#import').click();const b=await bDownload;
  const bPath=testInfo.outputPath('B.xlsx');await b.saveAs(bPath);
  const bBook=new ExcelJS.Workbook();await bBook.xlsx.readFile(bPath);
  expect(bBook.worksheets[0].getImages()).toHaveLength(5);
  expect(bBook.worksheets[0].getImages().slice(3).map(i=>[i.range.tl.nativeCol,i.range.tl.nativeRow])).toEqual([[2,1],[2,3]]);
  await page.locator('#use-last').click();await expect(page.locator('#workbook-status')).toContainText('補圖.xlsx');
  await page.locator('#preview').click();await expect(page.locator('#ready-count')).toHaveText('0 張可匯入');
  await expect(page.locator('#import')).toBeDisabled();
  expect((await readFile(aPath)).length).toBeGreaterThan(1000);expect(errors).toEqual([]);expect(remote).toEqual([]);
  await page.setViewportSize({width:320,height:700});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('blocks duplicates and corrupt images, invalidates preview and rejects bad workbooks',async({page})=>{
  await page.goto('/');
  await page.locator('#files-input').setInputFiles([{name:'001.jpg',mimeType:'image/jpeg',buffer:Buffer.from('broken')},{name:'1.png',mimeType:'image/png',buffer:Buffer.from('broken')}]);
  await page.locator('#preview').click();await expect(page.locator('#summary')).toContainText('重複編號');await expect(page.locator('#import')).toBeDisabled();
  await page.locator('#files-input').setInputFiles([{name:'002.jpg',mimeType:'image/jpeg',buffer:Buffer.from('broken')}]);
  await page.locator('#preview').click();await page.locator('#sheet-name').fill('新照片');await expect(page.locator('#preview-panel')).toBeHidden();
  await page.locator('#preview').click();await page.locator('#import').click();await expect(page.locator('#message')).toContainText('無法讀取');await expect(page.locator('#download-panel')).toBeHidden();
  await page.locator('#mode-b').click();await page.locator('#sample').click();await expect(page.locator('#preview')).toBeDisabled();
  await page.locator('#workbook-input').setInputFiles([{name:'bad.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from('broken')}]);
  await expect(page.locator('#message')).toContainText('有效的');await expect(page.locator('#preview')).toBeDisabled();
});
