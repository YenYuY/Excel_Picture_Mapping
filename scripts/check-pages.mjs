import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';
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
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
    res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  } catch {res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  await page.goto(`http://127.0.0.1:${server.address().port}/photo-tool/`);
  await page.locator('#sample').click();await page.locator('#preview').click();
  assert.equal(await page.locator('#ready-count').textContent(),'3 張可匯入');
  const pending=page.waitForEvent('download');await page.locator('#import').click();const download=await pending;
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(await download.path());
  assert.equal(workbook.worksheets[0].getImages().length,3);
  assert.deepEqual(errors,[]);
  console.log('PASS: production assets and Excel download work under /photo-tool/.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
