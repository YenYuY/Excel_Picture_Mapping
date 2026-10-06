import { isGif, isImageFile } from './image-formats';

export type Mode = 'a' | 'b';
export interface Photo { file: File; name: string; label: string; key: string }
export interface Entry { name: string; label: string; key: string; file?: File; row?: number; address?: string; reason?: string }
export interface ExistingRow { row: number; id: unknown; blocked?: string }
export interface Plan { mode: Mode; entries: Entry[]; errors: string[] }
export const MAX_FILES = 500;
export const MAX_ROWS = 10000;
export const MAX_FILE_BYTES = 40 * 1024 * 1024;

export function normalizeId(value: unknown): string | null {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) return null;
  const text = String(value ?? '').trim();
  return /^\d+$/.test(text) ? text.replace(/^0+(?=\d)/, '') : null;
}

export function compareIds(a: string, b: string): number {
  return a.length - b.length || a.localeCompare(b, 'en');
}

export function makePlan(files: File[], mode: Mode, rows: ExistingRow[] = []): Plan {
  const entries: Entry[] = [];
  const errors: string[] = [];
  if (files.length > MAX_FILES) errors.push(`單次最多 ${MAX_FILES} 個檔案，請分批選取。`);
  const counts = new Map<string, number>();
  for (const file of files) {
    const label = mode === 'b' ? file.name.match(/^(\d+)/)?.[1] ?? '' : '';
    const key = normalizeId(label) ?? '';
    let reason: string | undefined;
    if (isGif(file)) reason = '不支援 GIF 格式';
    else if (!isImageFile(file)) reason = '不支援的格式';
    else if (mode === 'b' && !label) reason = '檔名未以數字開頭';
    else if (file.size === 0) reason = '空白檔案';
    else if (file.size > MAX_FILE_BYTES) reason = '檔案超過 40 MB';
    entries.push({ name: file.webkitRelativePath || file.name, label, key, file, reason });
    if (mode === 'b' && !reason) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (mode === 'a') {
    let row = 2;
    for (const entry of entries) if (!entry.reason) {
      entry.label = String(row - 1); entry.key = entry.label;
      entry.row = row++; entry.address = `B${entry.row}`;
    }
  } else {
    entries.sort((a, b) => compareIds(a.key, b.key) || a.name.localeCompare(b.name, 'zh-Hant', { numeric: true }));
    for (const entry of entries) {
      if (!entry.reason && counts.get(entry.key)! > 1) entry.reason = '照片編號重複';
    }
    if ([...counts.values()].some(count => count > 1)) errors.push('照片有重複編號（001 與 1 視為相同），請排除後重新選取。');
    const byId = new Map<string, ExistingRow[]>();
    for (const row of rows) {
      const key = normalizeId(row.id);
      if (key !== null) byId.set(key, [...(byId.get(key) ?? []), row]);
    }
    for (const entry of entries) {
      if (entry.reason) continue;
      const matches = byId.get(entry.key) ?? [];
      if (matches.length === 0) entry.reason = 'A 欄找不到編號';
      else if (matches.length > 1) entry.reason = 'A 欄編號重複';
      else {
        entry.row = matches[0].row;
        entry.address = `C${entry.row}`;
        entry.reason = matches[0].blocked;
      }
    }
  }
  return { mode, entries, errors };
}

export function readyEntries(plan: Plan): Entry[] {
  return plan.entries.filter(entry => !entry.reason && entry.row !== undefined);
}

export interface Rect { left: number; top: number; width: number; height: number }
export function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

export function fitImage(width: number, height: number, box: Rect, padding = 5): Rect {
  if (![width, height, box.width, box.height].every(n => Number.isFinite(n) && n > 0) || box.width <= padding * 2 || box.height <= padding * 2) throw new Error('圖片或儲存格尺寸無效。');
  const scale = Math.min((box.width - padding * 2) / width, (box.height - padding * 2) / height);
  return { width: width * scale, height: height * scale, left: box.left + (box.width - width * scale) / 2, top: box.top + (box.height - height * scale) / 2 };
}

export function validateSheetName(name: string): void {
  if (!name.trim() || name.length > 31 || /[\\/\[\]*?:]/.test(name) || name.startsWith("'") || name.endsWith("'") || name.toLowerCase() === 'history') throw new Error('工作表名稱不可空白、超過 31 字或包含 \\ / [ ] * ? :，也不可使用 History。');
}
