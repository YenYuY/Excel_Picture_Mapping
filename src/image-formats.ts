// Extensions also cover image files whose OS supplies no image/* MIME type.
const IMAGE_EXTENSIONS = [
  'jpg','jpeg','jpe','jfif','jiff','png','apng','webp','avif','bmp','dib','svg','svgz','ico','cur',
  'tif','tiff','ptif','tiff64','heic','heif','hif','jxl','jp2','j2k','j2c','jpc','jpf','jpx','jpm','jpt','mj2','mpo','jps',
  'psd','psb','xcf','ase','aseprite','tga','vda','icb','vst','pcx','dcx','pnm','pbm','pgm','ppm','pam','pfm','qoi',
  'dds','exr','hdr','rgbe','jng','mng','xbm','xpm','wbmp','miff','mpc','mat','fits','fts','dcm','dicom',
  'sgi','rgb','rgba','ras','sun','pcd','pct','pict','pix','rla','rle','otb','palm','pdb','tim','tm2','vicar','viff',
  'wpg','cut','cin','dpx','sct','hrz','fax','g3','g4','cal','cals','aai','avs','farbfeld','ff','fl32','pgx','phm','six','sixel',
  'raw','3fr','arw','cr2','cr3','crw','dcr','dng','erf','fff','iiq','k25','kdc','mdc','mef','mos','mrw','nef','nrw',
  'orf','pef','raf','rw2','rwl','sr2','srf','srw','x3f',
];

export const IMAGE_FILE_ACCEPT = `image/*,${IMAGE_EXTENSIONS.map(extension => `.${extension}`).join(',')}`;

export function isGif(file: Pick<File, 'name' | 'type'>): boolean {
  return /\.gif$/i.test(file.name) || /^image\/(?:x-)?gif(?:;|$)/i.test(file.type);
}

export function isImageFile(file: Pick<File, 'name' | 'type'>): boolean {
  if (isGif(file)) return false;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return /^image\//i.test(file.type) || IMAGE_EXTENSIONS.includes(extension);
}

export function hasGifSignature(bytes: Uint8Array): boolean {
  return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61;
}
