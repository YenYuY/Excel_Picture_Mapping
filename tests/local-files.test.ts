import { describe, expect, it, vi } from 'vitest';
import { collectDirectoryFiles, type LocalDirectoryHandle, type LocalFileHandle } from '../src/local-files';

function fileHandle(name: string): LocalFileHandle {
  return { kind: 'file', name, async getFile() { return new File(['local image'], name, { type: 'image/jpeg', lastModified: 123 }); } };
}

function directory(name: string, entries: (LocalDirectoryHandle | LocalFileHandle)[]): LocalDirectoryHandle {
  return { kind: 'directory', name, async *values() { yield* entries; } };
}

describe('本機資料夾讀取', () => {
  it('reads nested files in enumeration order and retains paths and file metadata', async () => {
    const root = directory('照片', [fileHandle('z.jiff'), directory('子資料夾', [fileHandle('b.jpg'), fileHandle('a.webp')]), fileHandle('1.png')]);
    const files = await collectDirectoryFiles(root);
    expect(files.map(file => file.name)).toEqual(['z.jiff','b.jpg','a.webp','1.png']);
    expect(files.map(file => file.webkitRelativePath)).toEqual(['照片/z.jiff','照片/子資料夾/b.jpg','照片/子資料夾/a.webp','照片/1.png']);
    expect(files.map(file => [file.type, file.lastModified, file.size])).toEqual(Array.from({ length: 4 }, () => ['image/jpeg',123,11]));
  });
  it('stops at the 500-file limit without reading or returning a partial oversized selection', async () => {
    const extra = fileHandle('extra.jpg');
    extra.getFile = vi.fn(extra.getFile);
    const root = directory('照片', [...Array.from({ length: 500 }, (_, index) => fileHandle(`${index}.jpg`)), extra]);
    await expect(collectDirectoryFiles(root).then(files => files.length)).rejects.toThrow('單次最多 500 個檔案');
    expect(extra.getFile).not.toHaveBeenCalled();
  });
});
