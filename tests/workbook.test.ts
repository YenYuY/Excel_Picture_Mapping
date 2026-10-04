import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { exportWorkbook, inspectWorksheet, loadWorkbook, type ExportOptions } from '../src/workbook';
import { makePlan, readyEntries } from '../src/planner';

const jpeg=readFileSync(new URL('./fixtures/sample.jpg',import.meta.url));
function photos(names=['010.jpg','002.jpg','001.jpg']) {return names.map(name=>new File([jpeg],name,{type:'image/jpeg'}));}
function request(files=photos()): ExportOptions {
  return {entries:readyEntries(makePlan(files,'a')),images:new Map(files.map(file=>[file,{base64:jpeg.toString('base64'),width:120,height:80}])),sheetName:'現場照片',rowHeight:150,columnWidth:210,cancelled:()=>false,onProgress:()=>{}};
}
async function bytesOf(workbook:ExcelJS.Workbook) {return new Uint8Array(await workbook.xlsx.writeBuffer()).slice().buffer;}

describe('real XLSX round trips',()=>{
  it('creates a real workbook with zero-padded IDs, dimensions and three embedded JPEGs',async()=>{
    const bytes=await exportWorkbook(request());
    const source=await loadWorkbook(bytes,'新表.xlsx');const sheet=source.workbook.worksheets[0];
    expect(['A2','A3','A4'].map(a=>sheet.getCell(a).value)).toEqual(['001','002','010']);
    expect(sheet.getCell('A2').numFmt).toBe('@');expect(sheet.getRow(2).height).toBe(150);
    expect(sheet.getImages()).toHaveLength(3);
    expect(sheet.getImages().map(i=>[i.range.tl.nativeCol,i.range.tl.nativeRow])).toEqual([[1,1],[1,2],[1,3]]);
    expect(inspectWorksheet(sheet).map(row=>row.blocked)).toEqual([undefined,undefined,undefined]);
    const zip=await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).filter(path=>/^xl\/media\/.*\.jpeg$/.test(path))).toHaveLength(3);
    expect(await zip.file('xl/media/image1.jpeg')!.async('uint8array')).toEqual(new Uint8Array(jpeg));
  });
  it('adds C2/C4, preserves B images, formulas, styles, merges and other sheets, and leaves source unchanged',async()=>{
    const a=await loadWorkbook(await exportWorkbook(request()),'A.xlsx');
    const sheet=a.workbook.worksheets[0];
    sheet.getCell('D2').value={formula:'1+2',result:3};sheet.getCell('D2').font={bold:true,color:{argb:'FF112233'}};
    sheet.mergeCells('E1:F1');sheet.getCell('E1').value='保留標題';
    a.workbook.addWorksheet('其他資料').getCell('B7').value='不要變更';
    const original=await bytesOf(a.workbook);const copy=new Uint8Array(original).slice();
    const source=await loadWorkbook(original,'A.xlsx');const b=photos(['001.jpg','010.jpg','099.jpg']);
    const options=request(b);options.source=source;options.sheetId=sheet.id;
    options.entries=readyEntries(makePlan(b,'b',inspectWorksheet(source.workbook.worksheets[0])));
    expect(options.entries.map(entry=>entry.address)).toEqual(['C2','C4']);
    const result=await loadWorkbook(await exportWorkbook(options),'B.xlsx');const updated=result.workbook.worksheets[0];
    expect(updated.getImages()).toHaveLength(5);
    expect(updated.getImages().slice(3).map(i=>[i.range.tl.nativeCol,i.range.tl.nativeRow])).toEqual([[2,1],[2,3]]);
    expect(updated.getCell('D2').value).toMatchObject({formula:'1+2',result:3});expect(updated.getCell('D2').font.bold).toBe(true);
    expect(updated.getCell('F1').isMerged).toBe(true);expect(result.workbook.getWorksheet('其他資料')!.getCell('B7').value).toBe('不要變更');
    expect(new Uint8Array(original)).toEqual(copy);
    expect(source.workbook.worksheets[0].getImages()).toHaveLength(3);
    expect(inspectWorksheet(updated).map(row=>row.blocked)).toEqual(['位置已有圖片',undefined,'位置已有圖片']);
    const again=await loadWorkbook(await exportWorkbook(options),'retry.xlsx');expect(again.workbook.worksheets[0].getImages()).toHaveLength(5);
  });
  it('detects occupied, merged, hidden and small cells',()=>{
    const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('test');sheet.getColumn(3).width=30;
    for(let row=2;row<=6;row++){sheet.getCell(row,1).value=String(row);sheet.getRow(row).height=150;}
    sheet.getCell('C2').value={formula:'IF(1=1,"",0)',result:''};
    sheet.mergeCells('C3:D3');sheet.getRow(4).hidden=true;sheet.getRow(5).height=15;
    expect(inspectWorksheet(sheet).map(row=>row.blocked)).toEqual(['C 欄已有內容','合併儲存格','儲存格隱藏或尺寸過小','儲存格隱藏或尺寸過小',undefined]);
  });
  it('does not export a destination that became occupied',async()=>{
    const source=await loadWorkbook(await exportWorkbook(request()),'A.xlsx');source.workbook.worksheets[0].getCell('C2').value='保留';
    const modified=await loadWorkbook(await bytesOf(source.workbook),'occupied.xlsx');
    const options=request(photos(['001.jpg']));options.entries[0].address='C2';options.source=modified;options.sheetId=modified.workbook.worksheets[0].id;
    await expect(exportWorkbook(options)).rejects.toThrow('配對已失效');
  });
  it('discards cancelled output and leaves the input workbook intact',async()=>{
    const source=await loadWorkbook(await exportWorkbook(request()),'A.xlsx');const b=photos(['001.jpg']);const options=request(b);
    options.source=source;options.sheetId=source.workbook.worksheets[0].id;options.entries=readyEntries(makePlan(b,'b',inspectWorksheet(source.workbook.worksheets[0])));
    let stop=false;options.cancelled=()=>stop;options.onProgress=()=>{stop=true;};
    await expect(exportWorkbook(options)).rejects.toMatchObject({name:'AbortError'});expect(source.workbook.worksheets[0].getImages()).toHaveLength(3);
  });
  it('rejects protected worksheets',async()=>{
    const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('test');await sheet.protect('test',{spinCount:1});
    expect(()=>inspectWorksheet(sheet)).toThrow('受保護');
  });
  it('blocks known unsupported workbook features before rewriting',async()=>{
    const zip=await JSZip.loadAsync(await exportWorkbook(request()));zip.file('xl/charts/chart1.xml','<chart/>');
    await expect(loadWorkbook(await zip.generateAsync({type:'arraybuffer'}),'chart.xlsx')).rejects.toThrow('不支援');
  });
  it('rejects invalid, encrypted-like or wrong-extension input',async()=>{
    await expect(loadWorkbook(new Uint8Array([1,2,3]).buffer,'broken.xlsx')).rejects.toThrow('有效的');
    await expect(loadWorkbook(new ArrayBuffer(10),'macro.xlsm')).rejects.toThrow('.xlsx');
  });
});
