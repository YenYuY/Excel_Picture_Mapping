import './styles.css';
import './web.css';
import { makePlan, readyEntries, validateSheetName, MAX_FILES, type Mode, type Plan } from './planner';
import { loadWorkbook, inspectWorksheet, exportWorkbook, MAX_WORKBOOK_BYTES, XLSX_TYPE, type WorkbookSource } from './workbook';
import { prepareImage, sampleFiles, type PreparedImage } from './images';

function el<T extends HTMLElement = HTMLElement>(id: string): T { return document.getElementById(id) as T; }
let mode: Mode = 'a';
let files: File[] = [];
let source: WorkbookSource | undefined;
let lastOutput: {bytes:ArrayBuffer;name:string} | undefined;
let plan: Plan | undefined;
let busy = false;
let cancelled = false;
let revision = 0;
let previewName = '';
let downloadUrl = '';
const previewUrls: string[] = [];

function message(text: string, error = false): void {
  el('message').textContent = text; el('message').hidden = !text; el('message').classList.toggle('error', error);
}
function invalidate(): void {
  revision++; plan = undefined;
  previewUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
  el('preview-panel').hidden = true; el('progress-panel').hidden = true;
  el<HTMLButtonElement>('import').disabled = true;
  message('');
}
function setBusy(value: boolean): void {
  busy = value;
  el<HTMLFieldSetElement>('controls').disabled = value;
  el<HTMLButtonElement>('import').disabled = value || !plan || plan.errors.length > 0 || readyEntries(plan).length === 0;
  el<HTMLButtonElement>('preview').disabled = value || files.length === 0 || files.length > MAX_FILES || (mode === 'b' && !source);
}
function errorText(error: unknown): string { return error instanceof Error ? error.message : String(error); }
const yieldUI = () => new Promise(resolve => setTimeout(resolve,0));

function chooseMode(next: Mode): void {
  if (busy) return;
  mode = next;
  for (const key of ['a', 'b']) {
    el(`mode-${key}`).classList.toggle('active', key === mode);
    el(`mode-${key}`).setAttribute('aria-pressed', String(key === mode));
    el(`${key}-settings`).hidden = key !== mode;
  }
  selectFiles([]);
}
function selectFiles(selected: File[]): void {
  if (busy) return;
  files = selected; invalidate();
  const mb = (files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(1);
  el('selection').textContent = files.length ? `已選取 ${files.length} 個檔案 · ${mb} MB` : '尚未選取照片';
  if (files.length > MAX_FILES) message(`單次最多 ${MAX_FILES} 個檔案，請分批選取。`, true);
  setBusy(false);
}

async function selectWorkbook(read: () => Promise<ArrayBuffer>, name: string): Promise<void> {
  if (busy) return;
  invalidate(); source = undefined; setBusy(true);
  el('workbook-status').textContent = '正在本機讀取 Excel…';
  el<HTMLSelectElement>('target-sheet').replaceChildren(new Option('讀取中…',''));
  try {
    await yieldUI();
    source = await loadWorkbook(await read(),name);
    const visible = source.workbook.worksheets.filter(sheet => sheet.state === 'visible');
    if (!visible.length) throw new Error('此活頁簿沒有可見工作表。');
    el<HTMLSelectElement>('target-sheet').replaceChildren(...visible.map(sheet => new Option(sheet.name,String(sheet.id))));
    el('workbook-status').textContent = `${name} · ${visible.length} 個可見工作表`;
  } catch (error) {
    source = undefined;
    el('workbook-status').textContent = '未載入 Excel，請重新選取。';
    el<HTMLSelectElement>('target-sheet').replaceChildren(new Option('請先選取 Excel',''));
    message(errorText(error), true);
  } finally { setBusy(false); }
}

function renderPreview(): void {
  if (!plan) return;
  const ready = readyEntries(plan).length;
  el('ready-count').textContent = `${ready} 張可匯入`;
  const sheet = source?.workbook.getWorksheet(Number(el<HTMLSelectElement>('target-sheet').value));
  el('destination').textContent = mode === 'a' ? `建立新 Excel「${previewName}」· A 欄編號 / B 欄照片` : `${source?.name} →「${sheet?.name}」C 欄 · 另存新檔`;
  el('summary').textContent = plan.errors.length ? plan.errors.join('\n') : `可匯入 ${ready} 張，略過 ${plan.entries.length - ready} 個檔案。確認後產生可下載的 Excel。`;
  el('summary').classList.toggle('skip', plan.errors.length > 0);
  const rows = plan.entries.slice(0, 500).map((entry, index) => {
    const tr = document.createElement('tr');
    const name = document.createElement('td'); const wrapper = document.createElement('div'); wrapper.className = 'photo-cell';
    if (entry.file && /\.(png|jpe?g)$/i.test(entry.name) && entry.file.size <= 40 * 1024 * 1024 && index < 50) {
      const img = document.createElement('img'); img.className = 'thumb'; img.alt = ''; img.loading = 'lazy';
      img.src = URL.createObjectURL(entry.file); previewUrls.push(img.src);
      img.onerror = () => { img.hidden = true; }; wrapper.append(img);
    }
    const text = document.createElement('span'); const filename = document.createElement('span'); filename.className = 'filename'; filename.textContent = entry.name;
    const id = document.createElement('span'); id.className = 'photo-id'; id.textContent = entry.label ? `編號 ${entry.label}` : '無編號';
    text.append(filename, id); wrapper.append(text); name.append(wrapper);
    const address = document.createElement('td'); address.textContent = entry.address ?? '—';
    const status = document.createElement('td'); status.textContent = entry.reason ?? '可匯入'; status.className = entry.reason ? 'skip' : 'ready';
    tr.append(name, address, status); return tr;
  });
  el('preview-body').replaceChildren(...rows);
  el('preview-limit').textContent = plan.entries.length > 50 ? '縮圖僅顯示前 50 個檔案；配對清單包含全部選取檔案。' : '';
  el<HTMLButtonElement>('import').textContent = `產生並下載 Excel · ${ready} 張`;
  el('preview-panel').hidden = false;
}

function dimensions(): { rowHeight: number; columnWidth: number } {
  const rowHeight = Number(el<HTMLInputElement>('row-height').value);
  const columnWidth = Number(el<HTMLInputElement>('column-width').value);
  if (!Number.isFinite(rowHeight) || rowHeight < 48 || rowHeight > 400 || !Number.isFinite(columnWidth) || columnWidth < 48 || columnWidth > 500) throw new Error('列高請輸入 48–400 點；欄寬請輸入 48–500 點。');
  return { rowHeight, columnWidth };
}
function preview(): void {
  if (busy) return;
  invalidate();
  try {
    if (mode === 'a') {
      dimensions();
      previewName = el<HTMLInputElement>('sheet-name').value.trim() || '照片紀錄';
      validateSheetName(previewName);
      plan = makePlan(files,mode);
    } else {
      const sheet = source?.workbook.getWorksheet(Number(el<HTMLSelectElement>('target-sheet').value));
      if (!sheet) throw new Error('請先選取 Excel 與工作表。');
      plan = makePlan(files,mode,inspectWorksheet(sheet));
    }
    renderPreview();
  } catch (error) { message(errorText(error), true); }
  finally { setBusy(false); }
}

function offerDownload(bytes: ArrayBuffer, name: string): void {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = URL.createObjectURL(new Blob([bytes],{type:XLSX_TYPE}));
  const link=el<HTMLAnchorElement>('download');link.href=downloadUrl;link.download=name;
  link.textContent=`下載 ${name}`;el('download-panel').hidden=false;
  lastOutput={bytes,name};el('use-last').hidden=false;
  link.click();
}

async function runImport(): Promise<void> {
  if (busy || !plan || plan.errors.length) return;
  const entries = readyEntries(plan); if (!entries.length) return;
  setBusy(true); cancelled = false; message('');
  el('progress-panel').hidden = false; el<HTMLButtonElement>('cancel').disabled = false;
  const progress = el<HTMLProgressElement>('progress'); progress.value = 0;
  const images = new Map<File, PreparedImage>();
  try {
    let preparedBytes = 0;
    for (let i = 0; i < entries.length; i++) {
      if (cancelled) throw new DOMException('已取消，未產生新檔。','AbortError');
      el('progress-text').textContent = `檢查與縮圖 ${i + 1}/${entries.length} · ${entries[i].name}`;
      await yieldUI();
      const file = entries[i].file!; const prepared = await prepareImage(file);
      preparedBytes += prepared.base64.length;
      if (preparedBytes > 100 * 1024 * 1024) throw new Error('縮圖後資料超過 100 MB，請減少每批照片數量。');
      images.set(file, prepared); progress.value = Math.round((i + 1) / entries.length * 45);
    }
    const bytes=await exportWorkbook({
      entries,images,source:mode==='b'?source:undefined,sheetId:Number(el<HTMLSelectElement>('target-sheet').value),sheetName:previewName,
      ...(mode==='a'?dimensions():{rowHeight:150,columnWidth:210}),cancelled:()=>cancelled,
      onProgress:(done,total)=>{progress.value=45+Math.round(done/total*40);el('progress-text').textContent=done===total?'正在封裝 Excel，請稍候…':`放入圖片 ${done}/${total}`;},
    });
    const basename=mode==='a'?previewName:source!.name.replace(/\.xlsx$/i,'');
    const name=`${basename.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_')}${mode==='b'?'_補圖':''}.xlsx`;
    offerDownload(bytes,name);
    progress.value=100;el('progress-text').textContent=`完成 · ${entries.length} 張照片`;
    message(`已產生 ${name}（${(bytes.byteLength/1024/1024).toFixed(1)} MB）。若未自動下載，請按下方下載按鈕。${mode==='b'?'原始 Excel 檔未更動。':''}`);
  } catch (error) {
    const stopped=error instanceof DOMException && error.name==='AbortError';
    message(stopped?'已取消，未產生新檔，原始 Excel 未更動。':errorText(error),!stopped);
    el('progress-text').textContent=stopped?'已取消':'作業已停止，請查看訊息。';
  } finally { images.clear();plan=undefined;el<HTMLButtonElement>('cancel').disabled=true;setBusy(false); }
}

el('mode-a').onclick = () => chooseMode('a');
el('mode-b').onclick = () => chooseMode('b');
for (const id of ['folder-input','files-input']) el<HTMLInputElement>(id).onchange=event=>{
  const input=event.target as HTMLInputElement;selectFiles(Array.from(input.files??[]));input.value='';
};
el<HTMLInputElement>('workbook-input').onchange=async event=>{
  const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';
  if (!file) return;
  await selectWorkbook(async()=>{
    if(file.size>MAX_WORKBOOK_BYTES) throw new Error('Excel 檔案超過 50 MB，請縮小後再試。');
    return file.arrayBuffer();
  },file.name);
};
el('use-last').onclick=()=>{if(lastOutput) void selectWorkbook(async()=>lastOutput!.bytes,lastOutput.name);};
for(const id of ['sheet-name','row-height','column-width','target-sheet']) el(id).addEventListener('input',invalidate);
el('preview').onclick=preview;
el('import').onclick=()=>void runImport();
el('cancel').onclick=()=>{cancelled=true;el<HTMLButtonElement>('cancel').disabled=true;el('progress-text').textContent='正在取消，等待目前處理完成…';};
el('sample').onclick=async()=>{
  const current=revision;
  try {const samples=await sampleFiles(mode);if(current===revision)selectFiles(samples);}catch(error){message(errorText(error),true);}
};
window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
setBusy(false);
