// Generates the API reference into web/public/api/ (git-ignored, served at /api/):
//   - .NET: DocFX over the Chronicle clients, Arc (+MongoDB), and Fundamentals  -> /api/<product>/...
//   - TS:   TypeDoc over the @cratis/* packages                                 -> /api/<product>/javascript/...
// Run from web/:  node scripts/build-api.mjs   (or: npm run build:api)
// Requires: .NET 10 SDK, docfx (`dotnet tool install -g docfx`), and web deps installed.
import { execSync } from 'node:child_process';
import { existsSync, rmSync, cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
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
// The docs site needs loadable reference assemblies for DocFX. Product CI owns
// analyzer enforcement; warning-as-error policies should not block docs publishing.
const referenceBuildProps = [
  '-p:TreatWarningsAsErrors=false',
  '-p:MSBuildTreatWarningsAsErrors=false',
  '-p:CodeAnalysisTreatWarningsAsErrors=false',
  '-p:StyleCopTreatErrorsAsWarnings=true',
].join(' ');

const run = (cmd, cwd = web) => { console.log(`\n+ ${cmd}`); execSync(cmd, { stdio: 'inherit', cwd }); };

function walkFiles(dir, predicate, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, predicate, files);
    else if (entry.isFile() && predicate(full)) files.push(full);
  }
  return files;
}

function localTargetExists(root, fromFile, href) {
  let target = href.trim().replace(/&amp;/g, '&');
  if (
    !target ||
    target.startsWith('#') ||
    /^(?:https?:|mailto:|tel:|javascript:|data:|blob:)/i.test(target) ||
    target.startsWith('//')
  ) {
    return true;
  }

  target = target.split('#')[0].split('?')[0];
  if (!target) return true;

  const relativeRoot = target.startsWith('/')
    ? target.replace(/^\/api\/?/, '').replace(/^\/+/, '')
    : path.relative(root, path.resolve(path.dirname(fromFile), target));
  const candidate = path.join(root, relativeRoot);

  return (
    (existsSync(candidate) && statSync(candidate).isFile()) ||
    (existsSync(candidate) && statSync(candidate).isDirectory() && existsSync(path.join(candidate, 'index.html'))) ||
    (!path.extname(candidate) && existsSync(path.join(candidate, 'index.html')))
  );
}

function removeBrokenLocalHrefs(root) {
  let removed = 0;
  for (const file of walkFiles(root, (f) => f.endsWith('.html'))) {
    const html = readFileSync(file, 'utf8');
    const fixed = html.replace(/<a\b([^>]*?)\s+href=(["'])([^"']+)\2([^>]*)>/gi, (tag, before, quote, href, after) => {
      if (localTargetExists(root, file, href)) return tag;
      removed++;
      return `<a${before}${after}>`;
    });
    if (fixed !== html) writeFileSync(file, fixed, 'utf8');
  }
  console.log(`Removed ${removed} broken local hrefs from generated API HTML.`);
}

// 1) Build Arc + Chronicle client Release DLLs — docfx can't run their source generators, so it reads the compiled DLLs.
console.log('== [1/4] Build Arc + Chronicle client Release DLLs ==');
run(`dotnet build "${path.join(repos, 'Arc/Source/DotNET/Arc/Arc.csproj')}" -c Release ${referenceBuildProps}`);
run(`dotnet build "${path.join(repos, 'Arc/Source/DotNET/MongoDB/MongoDB.csproj')}" -c Release ${referenceBuildProps}`);
run(`dotnet build "${path.join(repos, 'Chronicle/Source/Clients/DotNET/DotNET.csproj')}" -c Release ${referenceBuildProps}`);
run(`dotnet build "${path.join(repos, 'Chronicle/Source/Clients/AspNetCore/AspNetCore.csproj')}" -c Release ${referenceBuildProps}`);
run(`dotnet build "${path.join(repos, 'Chronicle/Source/Clients/Testing/Testing.csproj')}" -c Release ${referenceBuildProps}`);

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

removeBrokenLocalHrefs(publicApi);

console.log('\nAPI reference generated under web/public/api/ — served at /api/.');
