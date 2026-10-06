import { AlphaAction, ImageMagick, initializeImageMagick, MagickColors, MagickFormat, MagickReadSettings } from '@imagemagick/magick-wasm';
import wasmUrl from '@imagemagick/magick-wasm/magick.wasm?url';
import type { PreparedImage } from './images';

let initialization: Promise<void> | undefined;

function initialize(): Promise<void> {
  return initialization ??= initializeImageMagick(new URL(wasmUrl, import.meta.url)).catch(error => {
    initialization = undefined;
    throw error;
  });
}

export async function decodeImage(file: File, maxEdge: number): Promise<PreparedImage> {
  await initialize();
  const bytes = new Uint8Array(await file.arrayBuffer());
  // TGA has no reliable signature; its aliases need an explicit decoder hint.
  const settings = new MagickReadSettings({ frameIndex: 0, frameCount: 1,
    format: /\.(tga|vda|icb|vst)$/i.test(file.name) ? MagickFormat.Tga : undefined });
  return ImageMagick.read(bytes, settings, image => {
    if (image.format === MagickFormat.Gif || image.format === MagickFormat.Gif87) throw new Error('不支援 GIF 格式');
    image.autoOrient();
    if (!image.width || !image.height) throw new Error('圖片沒有有效尺寸');
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    if (scale < 1) image.resize(Math.max(1, Math.round(image.width * scale)), Math.max(1, Math.round(image.height * scale)));
    image.backgroundColor = MagickColors.White;
    image.alpha(AlphaAction.Remove);
    image.quality = 85;
    const width = image.width, height = image.height;
    // Encoding stays inside the callback: these bytes belong to WASM memory,
    // which ImageMagick releases as soon as the callback finishes.
    return image.write(MagickFormat.Jpeg, data => {
      let binary = '';
      for (let offset = 0; offset < data.length; offset += 8192) {
        binary += String.fromCharCode(...data.subarray(offset, offset + 8192));
      }
      return { base64: btoa(binary), width, height };
    });
  });
}
