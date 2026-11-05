// Stage a committed game snapshot under /beta without changing the live files.
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,rm} from 'node:fs/promises';
const ref=process.argv[2];
if(!ref)throw new Error('Usage: node scripts/stage-beta.mjs <tested-source-commit-or-branch>');
const git=(...args)=>execFileSync('git',args,{maxBuffer:32*1024*1024});
const commit=git('rev-parse','--verify',`${ref}^{commit}`).toString().trim();
const files=git('ls-tree','-r','--name-only',commit).toString().trim().split('\n').filter(p=>/^(index\.html|style\.css|app\.js|town\.js|water\.js|water-view\.js|navigation\.js|villagers\.js)$/.test(p)||/^(assets|vendor)\//.test(p));
if(!files.includes('index.html')||!files.includes('app.js'))throw new Error('Source is missing game files');
const snapshot=files.map(path=>{
  let data=git('show',`${commit}:${path}`);
  if(path==='app.js'){
    const source=data.toString();
    if(!source.includes('mosswood-v2'))throw new Error('Review save isolation before publishing this source');
    data=Buffer.from(source.replaceAll('mosswood-v2','stillwater-beta-v2').replaceAll('mosswood-v1','stillwater-beta-v1'));
  }
  return {path,data};
});
await rm('beta',{recursive:true,force:true});
for(const {path,data}of snapshot){await mkdir(`beta/${path.split('/').slice(0,-1).join('/')}`,{recursive:true});await writeFile(`beta/${path}`,data);}
await writeFile('beta/release.json',JSON.stringify({sourceCommit:commit,saveNamespace:'stillwater-beta'},null,2)+'\n');
console.log(`Staged ${files.length} game files from ${commit} at /beta/. Live files were not modified.`);
