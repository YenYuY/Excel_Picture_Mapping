import { hasGifSignature, isGif } from './image-formats';

export interface PreparedImage { base64: string; width: number; height: number }

export async function prepareImage(file: File, maxEdge = 1280): Promise<PreparedImage> {
  try {
    const header = new Uint8Array(await file.slice(0, 6).arrayBuffer());
    if (isGif(file) || hasGifSignature(header)) throw new Error('不支援 GIF 格式');
    // JIFF/JFIF often arrive with no MIME type or application/octet-stream.
    const blob = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
      ? new Blob([file], { type: 'image/jpeg' }) : file;
    try { return await prepareNativeImage(blob, maxEdge); }
    catch {
      const { decodeImage } = await import('./image-decoder');
      return await decodeImage(file, maxEdge);
    }
  } catch (error) {
    throw new Error(`${file.name} 無法讀取：${error instanceof Error ? error.message : String(error)}`);
  }
}

async function prepareNativeImage(blob: Blob, maxEdge: number): Promise<PreparedImage> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('圖片沒有有效尺寸');
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('此環境不支援圖片縮圖');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { base64: canvas.toDataURL('image/jpeg', .85).split(',')[1], width: canvas.width, height: canvas.height };
  } finally { URL.revokeObjectURL(url); }
}

export async function sampleFiles(mode: 'a' | 'b'): Promise<File[]> {
  const ids = mode === 'a' ? ['010', '002', '001'] : ['003', '001', '099'];
  return Promise.all(ids.map(async (id, index) => {
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 400;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = ['#cbdcd0', '#d9e4ea', '#ebdfc8'][index]; ctx.fillRect(0, 0, 640, 400);
    ctx.fillStyle = '#365b46'; ctx.font = 'bold 100px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(id, 320, 220);
    ctx.font = '24px sans-serif'; ctx.fillText(`PHOTO ${mode.toUpperCase()}`, 320, 275);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('範例圖片產生失敗')), 'image/png'));
    return new File([blob], `${id}.png`, { type: 'image/png' });
  }));
}
