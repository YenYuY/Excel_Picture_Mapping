import { describe, it, expect } from 'vitest';
import { makePlan, normalizeId, readyEntries, fitImage, overlaps, validateSheetName } from '../src/planner';
const file = (name: string) => new File(['image-data'], name, { type: 'image/jpeg' });

describe('照片排序與配對', () => {
  it('accepts JIFF/JFIF and non-GIF image formats without a JPEG/PNG whitelist', () => {
    const files = ['001.jiff','002.JFIF','003.webp','004.avif','005.bmp','006.svg','007.tiff','008.heic'].map(file);
    files.push(new File(['image-data'], '009.custom-image', { type: 'image/x-custom' }));
    expect(readyEntries(makePlan(files, 'a')).map(entry => entry.address)).toEqual(['B2','B3','B4','B5','B6','B7','B8','B9','B10']);
  });
  it('accepts image extensions when the OS provides empty or generic MIME types', () => {
    const files = [new File(['image-data'], '001.JIFF'), new File(['image-data'], '002.tiff', { type: 'application/octet-stream' }), new File(['image-data'], '003.miff')];
    expect(readyEntries(makePlan(files, 'a'))).toHaveLength(3);
  });
  it('excludes GIF by extension or MIME and skips non-image files', () => {
    const files = [file('001.GIF'), new File(['GIF89a'], '002.jpg', { type: 'image/gif' }), new File(['text'], '003.txt', { type: 'text/plain' })];
    const plan = makePlan(files, 'a');
    expect(readyEntries(plan)).toHaveLength(0);
    expect(plan.entries.map(entry => entry.reason)).toEqual(['不支援 GIF 格式','不支援 GIF 格式','不支援的格式']);
  });
  it('A keeps folder input order, accepts arbitrary names and generates sequential IDs', () => {
    const names = ['010.jpg','現場照片.jiff','002.png','1.jpg','001_現場.jpg'];
    const plan = makePlan(names.map(file), 'a');
    expect(plan.errors).toEqual([]);
    const entries = readyEntries(plan);
    expect(entries.map(entry => entry.name)).toEqual(names);
    expect(entries.map(entry => [entry.label, entry.key, entry.address])).toEqual([['1','1','B2'],['2','2','B3'],['3','3','B4'],['4','4','B5'],['5','5','B6']]);
  });
  it('B matches IDs without shifting rows when 002 is missing', () => {
    const rows = [{row:2,id:'001'},{row:3,id:'002'},{row:4,id:'003'}];
    expect(readyEntries(makePlan(['003.jpg','001.jpg'].map(file),'b',rows)).map(e => e.address)).toEqual(['C2','C4']);
  });
  it('treats numeric worksheet IDs and zero-padded filenames equally', () => {
    expect(readyEntries(makePlan([file('0001.jpg')], 'b', [{row:7,id:1}]))[0].address).toBe('C7');
  });
  it('B blocks duplicate image IDs including different zero padding', () => {
    const plan = makePlan(['001.jpg','1.png'].map(file),'b',[{row:2,id:1}]);
    expect(plan.errors).toHaveLength(1); expect(readyEntries(plan)).toHaveLength(0);
  });
  it('does not guess when worksheet IDs are duplicated', () => {
    const plan = makePlan([file('001.jpg')],'b',[{row:2,id:'01'},{row:3,id:1}]);
    expect(plan.entries[0].reason).toBe('A 欄編號重複');
  });
  it('skips unsupported, missing-ID, unmatched and occupied destinations', () => {
    const plan = makePlan(['001.jpg','002.jpg','003.gif','other.png'].map(file),'b',[{row:2,id:'001',blocked:'C 欄已有內容'}]);
    expect(readyEntries(plan)).toHaveLength(0);
    expect(plan.entries.map(e => e.reason)).toContain('A 欄找不到編號');
    expect(plan.entries.find(entry => entry.name === '003.gif')?.reason).toBe('不支援 GIF 格式');
  });
  it('does not turn huge string IDs into lossy numbers', () => {
    expect(normalizeId('0009007199254740993')).toBe('9007199254740993');
    expect(normalizeId(9007199254740992)).toBeNull();
    expect(readyEntries(makePlan(['100000000000000000.jpg','99999999999999999.jpg'].map(file),'b',[{row:2,id:'99999999999999999'},{row:3,id:'100000000000000000'}]))[0].label).toBe('99999999999999999');
  });
  it('rejects invalid and decimal identifiers', () => {
    for (const value of ['', null, -1, 1.2, 'A001', '1e3']) expect(normalizeId(value)).toBeNull();
  });
  it('rejects empty and oversized files', () => {
    const empty = new File([], '1.jpg');
    const large = { name:'2.jpg', size:41*1024*1024 } as File;
    expect(readyEntries(makePlan([empty,large],'a'))).toHaveLength(0);
  });
});
describe('layout and safe names', () => {
  it('fits landscape and portrait images without distortion', () => {
    const box = { left:20, top:30, width:210, height:150 };
    const image = fitImage(1600,800,box);
    expect(image).toEqual({left:25,top:55,width:200,height:100});
    const portrait = fitImage(800,1600,box);
    expect(portrait.width / portrait.height).toBe(.5); expect(portrait.top).toBe(35);
  });
  it('rejects zero-size cells', () => expect(() => fitImage(10,10,{left:0,top:0,width:0,height:10})).toThrow());
  it('detects crossing shapes but not merely adjacent ones', () => {
    const a = {left:0,top:0,width:10,height:10};
    expect(overlaps(a,{left:9,top:9,width:10,height:10})).toBe(true);
    expect(overlaps(a,{left:10,top:0,width:10,height:10})).toBe(false);
  });
  it('rejects invalid worksheet names', () => {
    for (const name of ['', 'a/b', "'test", 'History', 'a'.repeat(32)]) expect(() => validateSheetName(name)).toThrow();
    expect(() => validateSheetName('現場照片')).not.toThrow();
  });
});
