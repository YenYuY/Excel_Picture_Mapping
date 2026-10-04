import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { fitImage, MAX_ROWS, normalizeId, overlaps, validateSheetName, type Entry, type ExistingRow, type Rect } from './planner';
import type { PreparedImage } from './images';

export const MAX_WORKBOOK_BYTES = 50 * 1024 * 1024;
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EMU_PER_PIXEL = 9525;
export interface WorkbookSource { bytes: ArrayBuffer; workbook: ExcelJS.Workbook; name: string }

// Check ZIP directory sizes before either ZIP library expands an untrusted workbook.
function checkZipSize(bytes: ArrayBuffer): void {
  const view = new DataView(bytes);
  let end = bytes.byteLength - 22;
  for (; end >= Math.max(0, bytes.byteLength - 65557); end--) {
    if (view.getUint32(end, true) === 0x06054b50 && end + 22 + view.getUint16(end + 20, true) === bytes.byteLength) break;
  }
  if (end < 0 || end < bytes.byteLength - 65557) throw new Error('檔案不是有效的 .xlsx，或已加密。');
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  if (count > 20000 || offset === 0xffffffff || view.getUint16(end + 4, true) !== 0) throw new Error('此 Excel 封裝過大或格式不支援。');
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Excel 封裝損壞。');
    total += view.getUint32(offset + 24, true);
    if (total > 250 * 1024 * 1024) throw new Error('Excel 解壓縮後超過 250 MB，請縮小檔案。');
    offset += 46 + view.getUint16(offset + 28, true) + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
}

async function checkSupportedWorkbook(bytes: ArrayBuffer): Promise<void> {
  checkZipSize(bytes);
  const zip = await JSZip.loadAsync(bytes);
  if (!zip.file('xl/workbook.xml')) throw new Error('檔案不是支援的 Excel 活頁簿。');
  // ExcelJS cannot round-trip these features. Fail visibly instead of silently removing them.
  const unsupported = /^(?:xl\/(?:charts|chartsheets|pivotTables|pivotCache|slicers|slicerCaches|externalLinks|queryTables|connections|activeX|ctrlProps|embeddings|richData|threadedComments|persons|model|webExtensions|macrosheets)|customXml\/|_xmlsignatures\/)|(?:vbaProject|vbaData)\.|\.vml$/i;
  if (Object.keys(zip.files).some(path => unsupported.test(path))) throw new Error('這份 Excel 含圖表、樞紐分析、巨集、註解或其他不支援的物件，無法可靠保留。請改用一般表格加照片的 .xlsx；原檔未更動。');
  const xmlPaths = Object.keys(zip.files).filter(path => /^xl\/(?:drawings\/drawing\d+|worksheets\/sheet\d+)\.xml$/.test(path));
  for (const path of xmlPaths) {
    const xml = await zip.file(path)!.async('string');
    const unsupportedSheetExtension = path.startsWith('xl/worksheets/') && /<(?:[\w]+:)?extLst(?:\s|>)/.test(xml);
    if (unsupportedSheetExtension || /<(?:[\w]+:)?(?:sp|grpSp|cxnSp|graphicFrame|absoluteAnchor|AlternateContent|oleObjects|controls)(?:\s|>)/.test(xml) || /<(?:[\w]+:)?xfrm\b[^>]*\b(?:rot|flipH|flipV)=/.test(xml) || /<(?:[\w]+:)?srcRect\b/.test(xml)) {
      throw new Error('此 Excel 含不支援的圖形、圖片裁切／旋轉或擴充功能。請使用一般照片表；原檔未更動。');
    }
  }
}

export async function loadWorkbook(bytes: ArrayBuffer, name: string): Promise<WorkbookSource> {
  if (!/\.xlsx$/i.test(name)) throw new Error('請選取 .xlsx 檔案；不支援 .xls、.xlsm 或密碼保護檔。');
  if (!bytes.byteLength || bytes.byteLength > MAX_WORKBOOK_BYTES) throw new Error('Excel 檔案必須介於 1 byte 與 50 MB 之間。');
  await checkSupportedWorkbook(bytes);
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(bytes); }
  catch { throw new Error('Excel 無法讀取，請確認檔案完整且未設定開啟密碼。'); }
  if (!workbook.worksheets.length) throw new Error('此檔案沒有可用的工作表。');
  return { bytes, workbook, name };
}

export function columnPixels(sheet: ExcelJS.Worksheet, col: number): number {
  const column = sheet.getColumn(col);
  if (column.hidden) return 0;
  const width = column.width ?? sheet.properties.defaultColWidth ?? 8.43;
  // Excel column widths use font characters; this is the Calibri 11 approximation.
  return width < 1 ? Math.floor(width * 12 + .5) : Math.floor(width * 7 + 5);
}
function rowPixels(sheet: ExcelJS.Worksheet, row: number): number {
  const item = sheet.getRow(row);
  return item.hidden ? 0 : (item.height ?? sheet.properties.defaultRowHeight ?? 15) * 96 / 72;
}
interface NativeAnchor { nativeCol: number; nativeRow: number; nativeColOff: number; nativeRowOff: number }

function geometry(sheet: ExcelJS.Worksheet) {
  const xs = [0], ys = [0];
  function x(col: number): number { for (let i = xs.length; i <= col; i++) xs.push(xs[i-1] + columnPixels(sheet, i)); return xs[col]; }
  function y(row: number): number { for (let i = ys.length; i <= row; i++) ys.push(ys[i-1] + rowPixels(sheet, i)); return ys[row]; }
  function point(anchor: NativeAnchor) {
    if (anchor.nativeCol < 0 || anchor.nativeCol > 16383 || anchor.nativeRow < 0 || anchor.nativeRow > MAX_ROWS) throw new Error('此工作表的圖片超出支援範圍。');
    return { left:x(anchor.nativeCol) + anchor.nativeColOff / EMU_PER_PIXEL, top:y(anchor.nativeRow) + anchor.nativeRowOff / EMU_PER_PIXEL };
  }
  return {
    cell(row: number, col: number): Rect { return { left:x(col-1),top:y(row-1),width:columnPixels(sheet,col),height:rowPixels(sheet,row) }; },
    image(range: {tl:ExcelJS.Anchor;br?:ExcelJS.Anchor;ext?:{width:number;height:number}}): Rect {
      const start = point(range.tl as unknown as NativeAnchor);
      if (range.br) { const end = point(range.br as unknown as NativeAnchor); return { ...start,width:end.left-start.left,height:end.top-start.top }; }
      if (range.ext) return { ...start, width:range.ext.width,height:range.ext.height };
      throw new Error('既有圖片定位格式不支援，請改用一般照片表。');
    },
  };
}

function cellId(cell: ExcelJS.Cell): unknown {
  const value = cell.value;
  if (value && typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) return value.result;
    if ('richText' in value) return value.richText.map(run => run.text).join('');
    if ('text' in value) return value.text;
  }
  return value;
}

export function inspectWorksheet(sheet: ExcelJS.Worksheet): ExistingRow[] {
  if (sheet.state !== 'visible') throw new Error('請選取可見的工作表。');
  const model = sheet.model as unknown as {sheetProtection?: {sheet?: boolean}};
  if (model.sheetProtection?.sheet) throw new Error('此工作表受保護，請先另存可編輯的副本。');
  const rows: ExistingRow[] = [];
  const layout = geometry(sheet);
  const images = sheet.getImages().map(image => layout.image(image.range));
  sheet.getColumn(1).eachCell({includeEmpty:false}, (cell, row) => {
    if (row === 1 || normalizeId(cellId(cell)) === null) return;
    if (row > MAX_ROWS) throw new Error(`A 欄編號超出第 ${MAX_ROWS} 列，請分批處理。`);
    const target = sheet.getCell(row, 3);
    const box = layout.cell(row, 3);
    let blocked: string | undefined;
    if (target.isMerged || cell.isMerged) blocked = '合併儲存格';
    else if (target.value !== null && target.value !== '') blocked = 'C 欄已有內容';
    else if (box.width < 32 || box.height < 32) blocked = '儲存格隱藏或尺寸過小';
    else if (images.some(image => overlaps(image, box))) blocked = '位置已有圖片';
    rows.push({row,id:cellId(cell),blocked});
  });
  return rows;
}

export interface ExportOptions {
  entries: Entry[];
  images: Map<File, PreparedImage>;
  source?: WorkbookSource;
  sheetId?: number;
  sheetName: string;
  rowHeight: number;
  columnWidth: number;
  cancelled: () => boolean;
  onProgress: (completed: number, total: number) => void;
}
function checkCancelled(options: ExportOptions): void { if (options.cancelled()) throw new DOMException('已取消，未產生新檔。', 'AbortError'); }

export async function exportWorkbook(options: ExportOptions): Promise<ArrayBuffer> {
  checkCancelled(options);
  if (!options.entries.length) throw new Error('沒有可匯入的照片。');
  const workbook = new ExcelJS.Workbook();
  let sheet: ExcelJS.Worksheet;
  if (options.source) {
    // Always reload the immutable original: cancelled/failed/repeated exports never accumulate images.
    await workbook.xlsx.load(options.source.bytes);
    const selected = workbook.getWorksheet(options.sheetId!);
    if (!selected) throw new Error('找不到所選工作表，請重新選取 Excel。');
    sheet = selected;
    const rows = inspectWorksheet(sheet);
    for (const entry of options.entries) {
      const matches = rows.filter(row => normalizeId(row.id) === entry.key);
      if (matches.length !== 1 || matches[0].row !== entry.row || matches[0].blocked) throw new Error('配對已失效，請重新預覽。');
    }
  } else {
    validateSheetName(options.sheetName);
    if (options.rowHeight < 48 || options.rowHeight > 400 || options.columnWidth < 48 || options.columnWidth > 500) throw new Error('列高或欄寬超出範圍。');
    workbook.creator = '照片批次匯入'; workbook.created = new Date();
    sheet = workbook.addWorksheet(options.sheetName);
    sheet.columns = [{header:'編號',key:'id',width:12},{header:'A 資料夾照片',width:(options.columnWidth*96/72-5)/7},{header:'B 資料夾照片',width:(options.columnWidth*96/72-5)/7}];
    sheet.getRow(1).height = 26;
    sheet.getRow(1).eachCell(cell => {cell.font={name:'Calibri',bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17694B'}};cell.alignment={vertical:'middle'};});
    sheet.views=[{state:'frozen',ySplit:1}];
    for (const entry of options.entries) { const row=sheet.getRow(entry.row!);row.height=options.rowHeight;row.getCell(1).value=entry.label;row.getCell(1).numFmt='@';row.getCell(1).alignment={vertical:'middle',horizontal:'center'}; }
  }
  const layout=geometry(sheet);
  for (let i=0;i<options.entries.length;i++) {
    checkCancelled(options);
    const entry=options.entries[i], image=options.images.get(entry.file!);
    if (!image) throw new Error(`${entry.name} 尚未完成縮圖。`);
    const col=options.source ? 3 : 2;
    const box=layout.cell(entry.row!,col), fitted=fitImage(image.width,image.height,box,7);
    const id=workbook.addImage({base64:`data:image/jpeg;base64,${image.base64}`,extension:'jpeg'});
    // Native offsets avoid ExcelJS's fractional anchor approximation on custom-width columns.
    const tl={nativeCol:col-1,nativeRow:entry.row!-1,nativeColOff:Math.round((fitted.left-box.left)*EMU_PER_PIXEL),nativeRowOff:Math.round((fitted.top-box.top)*EMU_PER_PIXEL)};
    sheet.addImage(id,{tl:tl as unknown as ExcelJS.Anchor,ext:{width:fitted.width,height:fitted.height},editAs:'oneCell'});
    options.onProgress(i+1,options.entries.length);
    // Yield for progress paint and the cancel button between images.
    await new Promise(resolve => setTimeout(resolve,0));
  }
  checkCancelled(options);
  const result=await workbook.xlsx.writeBuffer();
  checkCancelled(options);
  return new Uint8Array(result).slice().buffer;
}
