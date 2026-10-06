import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
const root=resolve('dist');
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(!url.pathname.startsWith('/photo-tool/')){res.writeHead(404).end();return;}
    const relative=decodeURIComponent(url.pathname.slice('/photo-tool/'.length))||'index.html';
    const file=resolve(root,relative);
    if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.wasm':'application/wasm'};
    res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  } catch {res.writeHead(404).end();}
});
const liveUrl=process.argv[2];
if(liveUrl && !/^https?:\/\//.test(liveUrl)) throw new Error('Pass a complete HTTP(S) website URL.');
if(!liveUrl) await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:process.env.CI ? undefined : 'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1200,height:900}});const errors=[];
  const target=liveUrl || `http://127.0.0.1:${server.address().port}/photo-tool/`;
  const origin=new URL(target).origin;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  page.on('requestfailed',request=>errors.push(`${request.failure()?.errorText} ${request.url()}`));
  page.on('request',request=>{
    if(request.url().startsWith('http') && (new URL(request.url()).origin!==origin || !['GET','HEAD'].includes(request.method()))) errors.push(`Unexpected network request: ${request.method()} ${request.url()}`);
  });
  await page.goto(target);
  assert.equal(await page.locator('script[src*="/src/"]').count(),0,'Unbuilt source index.html was deployed. Publish dist/ using GitHub Actions.');
  assert.ok(await page.locator('link[rel="stylesheet"]').count()>0,'Built CSS link is missing.');
  await expect(page.locator('#preview')).toHaveCSS('background-color','rgb(23, 105, 75)');
  await expect(page.locator('#controls')).toHaveCSS('display','grid');
  await page.screenshot({path:'artifacts/pages-desktop.png',fullPage:true});
  await page.locator('#sample').click();await page.locator('#preview').click();
  assert.equal(await page.locator('#ready-count').textContent(),'3 張可匯入');
  const pending=page.waitForEvent('download');await page.locator('#import').click();const download=await pending;
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(await download.path());
  assert.equal(workbook.worksheets[0].getImages().length,3);
  assert.deepEqual(['A2','A3','A4'].map(address=>workbook.worksheets[0].getCell(address).value),['1','2','3']);
  const original=await readFile(await download.path());
  await page.locator('#mode-b').click();
  await page.locator('#workbook-input').setInputFiles({name:'source.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:original});
  await expect(page.locator('#workbook-status')).toContainText('source.xlsx');
  await page.locator('#sample').click();await page.locator('#preview').click();
  await expect(page.locator('#ready-count')).toHaveText('2 張可匯入');
  await expect(page.locator('#preview-body tr').nth(1)).toContainText('C4');
  await expect(page.locator('#preview-body tr').last()).toContainText('A 欄找不到編號');
  const pendingB=page.waitForEvent('download');await page.locator('#import').click();const downloadB=await pendingB;
  const updated=new ExcelJS.Workbook();await updated.xlsx.readFile(await downloadB.path());
  assert.equal(updated.worksheets[0].getImages().length,5);
  assert.deepEqual(updated.worksheets[0].getImages().map(image=>[image.range.tl.nativeCol,image.range.tl.nativeRow]),[[1,1],[1,2],[1,3],[2,1],[2,3]]);
  await page.locator('#use-last').click();await expect(page.locator('#workbook-status')).toContainText('_補圖.xlsx');
  await page.locator('#preview').click();await expect(page.locator('#ready-count')).toHaveText('0 張可匯入');
  await expect(page.locator('#import')).toBeDisabled();
  // Exercise the lazy decoder in the built site, including its WASM asset at a Pages subpath.
  await page.locator('#mode-a').click();
  await page.locator('#files-input').setInputFiles({name:'001.tiff',mimeType:'image/tiff',buffer:await readFile(new URL('../tests/fixtures/sample.tiff',import.meta.url))});
  await page.locator('#preview').click();
  await expect(page.locator('#ready-count')).toHaveText('1 張可匯入');
  const thumb=page.locator('#preview-body img.thumb');
  await expect(thumb).toBeVisible({timeout:30000});
  await expect(thumb).toHaveJSProperty('naturalWidth',120);
  const pendingTiff=page.waitForEvent('download');await page.locator('#import').click();const tiffDownload=await pendingTiff;
  const converted=new ExcelJS.Workbook();await converted.xlsx.readFile(await tiffDownload.path());
  assert.equal(converted.worksheets[0].getImages().length,1);
  assert.equal(converted.getImage(Number(converted.worksheets[0].getImages()[0].imageId)).extension,'jpeg');
  await page.setViewportSize({width:320,height:700});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile layout overflows.');
  await page.screenshot({path:'artifacts/pages-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(`PASS: CSS, responsive layout, A/B Excel downloads, image preservation, duplicate prevention and TIFF/WASM conversion at ${target}`);
} finally {await browser.close();if(!liveUrl)await new Promise(resolve=>server.close(resolve));}
