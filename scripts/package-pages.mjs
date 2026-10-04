import JSZip from 'jszip';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const zip=new JSZip();
async function collect(directory,prefix=''){
  for(const item of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,item.name),name=prefix+item.name;
    if(item.isDirectory())await collect(path,name+'/');
    else if(item.isFile())zip.file(name,await readFile(path));
  }
}
await collect('dist');
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/github-pages.zip',await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));
console.log('Created artifacts/github-pages.zip (unzip before uploading to GitHub Pages).');
