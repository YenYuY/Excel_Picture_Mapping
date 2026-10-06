import { MAX_FILES } from './planner';

export interface LocalFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
}

export interface LocalDirectoryHandle {
  kind: 'directory';
  name: string;
  values(): AsyncIterable<LocalFileHandle | LocalDirectoryHandle>;
}

export type DirectoryPicker = (options: { mode: 'read' }) => Promise<LocalDirectoryHandle>;

export function getDirectoryPicker(): DirectoryPicker | undefined {
  const picker = (window as Window & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
  if (!window.isSecureContext || typeof picker !== 'function') return undefined;
  return options => picker.call(window, options);
}

export async function collectDirectoryFiles(directory: LocalDirectoryHandle): Promise<File[]> {
  const files: File[] = [];
  async function visit(current: LocalDirectoryHandle, path: string): Promise<void> {
    for await (const handle of current.values()) {
      const relativePath = `${path}/${handle.name}`;
      if (handle.kind === 'directory') await visit(handle, relativePath);
      else {
        if (files.length >= MAX_FILES) throw new Error(`單次最多 ${MAX_FILES} 個檔案，請分批選取。`);
        const file = await handle.getFile();
        Object.defineProperty(file, 'webkitRelativePath', { value: relativePath, configurable: true });
        files.push(file);
      }
    }
  }
  await visit(directory, directory.name);
  return files;
}
