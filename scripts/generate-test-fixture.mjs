import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage();
  const base64=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=120;canvas.height=80;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#17694b';ctx.fillRect(0,0,120,80);
    ctx.fillStyle='#fff';ctx.font='24px sans-serif';ctx.fillText('001',36,50);
    return canvas.toDataURL('image/jpeg',.85).split(',')[1];
  });
  await mkdir('tests/fixtures',{recursive:true});
  await writeFile('tests/fixtures/sample.jpg',Buffer.from(base64,'base64'));
} finally { await browser.close(); }
