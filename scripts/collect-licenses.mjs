import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const sections=['Plynex third-party dependency license notices\nGenerated from installed locked dependencies.\n'];
function collect(directory,label,expression) {
  if(!fs.existsSync(directory))return;
  const texts=fs.readdirSync(directory).filter(n=>/^(licen[cs]e|copying|notice|ofl)([.\-_]|$)/i.test(n) && fs.statSync(path.join(directory,n)).isFile());
  sections.push('\n'+'='.repeat(72)+'\n'+label+'\nDeclared license: '+expression+'\n');
  for(const filename of texts)sections.push('\n'+filename+'\n'+fs.readFileSync(path.join(directory,filename),'utf8'));
}
const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
for(const [name,meta] of Object.entries(lock.packages || {})) {
  if(!name || !fs.existsSync(name+'/package.json'))continue;
  const pkg=JSON.parse(fs.readFileSync(name+'/package.json','utf8'));
  collect(name,`npm: ${pkg.name}@${pkg.version}`,pkg.license || meta.license || 'See upstream package');
}
const host=execFileSync('rustc',['-vV'],{encoding:'utf8'}).match(/host: (.+)/)[1].trim();
const metadata=JSON.parse(execFileSync('cargo',['metadata','--manifest-path','src-tauri/Cargo.toml','--format-version','1','--locked','--filter-platform',host],{encoding:'utf8',maxBuffer:20*1024*1024}));
for(const pkg of metadata.packages)if(pkg.name!=='plynex')collect(path.dirname(pkg.manifest_path),`Cargo: ${pkg.name}@${pkg.version}`,pkg.license || 'See upstream crate');
fs.mkdirSync('LICENSES',{recursive:true});
fs.writeFileSync('LICENSES/DEPENDENCIES.txt',sections.join('\n'));
console.log('Dependency notices collected.');
