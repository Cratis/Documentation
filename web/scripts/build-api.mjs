// Generates the API reference into web/public/api/ (git-ignored, served at /api/):
//   - .NET: DocFX over the Chronicle clients, Arc (+MongoDB), and Fundamentals  -> /api/<product>/...
//   - TS:   TypeDoc over the @cratis/* packages                                 -> /api/<product>/javascript/...
// Run from web/:  node scripts/build-api.mjs   (or: npm run build:api)
// Requires: .NET 10 SDK, docfx (`dotnet tool install -g docfx`), and web deps installed.
import { execSync } from 'node:child_process';
import { existsSync, rmSync, cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const web = path.resolve(import.meta.dirname, '..');     // Documentation/web
const repos = path.resolve(web, '..', '..');             // parent of Documentation/ (siblings live here)
const apiBuild = path.join(web, 'api-build');
const publicApi = path.join(web, 'public', 'api');
const typedoc = path.join(web, 'node_modules', '.bin', 'typedoc');
const docfx = existsSync(path.join(os.homedir(), '.dotnet', 'tools', 'docfx'))
  ? path.join(os.homedir(), '.dotnet', 'tools', 'docfx')
  : 'docfx';

const run = (cmd, cwd = web) => { console.log(`\n+ ${cmd}`); execSync(cmd, { stdio: 'inherit', cwd }); };

// 1) Build Arc + Chronicle client Release DLLs — docfx can't run their source generators, so it reads the compiled DLLs.
console.log('== [1/4] Build Arc + Chronicle client Release DLLs ==');
run(`dotnet build "${path.join(repos, 'Arc/Source/DotNET/Arc/Arc.csproj')}" -c Release`);
run(`dotnet build "${path.join(repos, 'Arc/Source/DotNET/MongoDB/MongoDB.csproj')}" -c Release`);
run(`dotnet build "${path.join(repos, 'Chronicle/Source/Clients/DotNET/DotNET.csproj')}" -c Release`);
run(`dotnet build "${path.join(repos, 'Chronicle/Source/Clients/AspNetCore/AspNetCore.csproj')}" -c Release`);
run(`dotnet build "${path.join(repos, 'Chronicle/Source/Clients/Testing/Testing.csproj')}" -c Release`);

// 2) DocFX .NET API
console.log('== [2/4] DocFX .NET API ==');
for (const d of ['_site', '_meta', 'chronicle', 'arc', 'fundamentals']) rmSync(path.join(apiBuild, d), { recursive: true, force: true });
run(`"${docfx}" metadata docfx.json`, apiBuild);
run(`"${docfx}" build docfx.json`, apiBuild);

// 3) Publish the DocFX site under public/api/
console.log('== [3/4] Publish DocFX site -> public/api ==');
rmSync(publicApi, { recursive: true, force: true });
mkdirSync(publicApi, { recursive: true });
cpSync(path.join(apiBuild, '_site'), publicApi, { recursive: true });

// 4) TypeDoc TS API -> public/api/<product>/javascript/...
console.log('== [4/4] TypeDoc TS API ==');
const tsPackages = [
  { name: 'Arc', src: 'Arc/Source/JavaScript/Arc', out: 'arc/javascript/arc' },
  { name: 'Arc.React', src: 'Arc/Source/JavaScript/Arc.React', out: 'arc/javascript/arc.react' },
  { name: 'Arc.React.MVVM', src: 'Arc/Source/JavaScript/Arc.React.MVVM', out: 'arc/javascript/arc.react.mvvm' },
  { name: 'Arc.Vite', src: 'Arc/Source/JavaScript/Arc.Vite', out: 'arc/javascript/arc.vite' },
  { name: 'Fundamentals', src: 'Fundamentals/Source/JavaScript', out: 'fundamentals/javascript' },
];
for (const p of tsPackages) {
  const srcDir = path.join(repos, p.src);
  const entry = path.join(srcDir, 'index.ts');
  const tsconfig = path.join(srcDir, 'tsconfig.json');
  if (!existsSync(entry) || !existsSync(tsconfig)) { console.warn(`  skip ${p.name}: missing index.ts/tsconfig.json`); continue; }
  try {
    run(`"${typedoc}" --out "${path.join(publicApi, p.out)}" --tsconfig "${tsconfig}" --name "${p.name}" --skipErrorChecking --excludeExternals --readme none "${entry}"`);
  } catch (e) {
    console.warn(`  TypeDoc failed for ${p.name} (continuing): ${e.message}`);
  }
}

console.log('\nAPI reference generated under web/public/api/ — served at /api/.');
