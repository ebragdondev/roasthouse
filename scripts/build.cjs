/* Deterministic, offline, zero-runtime-dependency single HTML build.
   TypeScript is required only while building. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');
const files = ['src/customer-economy.ts', 'src/empire-world.ts', 'src/engine.ts', 'src/phase7.ts', 'src/phase7-forecast.ts', 'src/phase7-ui.ts', 'src/ui.ts'];
const js = files.map(filename => {
  const source = read(filename);
  const built = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None,
      removeComments: false, strict: true, newLine: ts.NewLineKind.LineFeed },
    reportDiagnostics: true
  });
  if (built.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) {
    throw new Error(`${filename} failed transpilation`);
  }
  return `\n// ---- ${filename} ----\n${built.outputText}`;
}).join('\n');
const html = read('template.html').replace('/*__ROASTHOUSE_BUNDLE__*/', () => `(() => {\n"use strict";\n${js}\n})();`);
if (html.includes('__ROASTHOUSE_BUNDLE__')) throw new Error('Unbuilt template');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.writeFileSync(path.join(root, 'index.html'), html);
// Optional artifact directory for automation/CI; not required for local builds.
if (process.env.ROASTHOUSE_RELEASE_DIR) {
  const release = path.resolve(process.env.ROASTHOUSE_RELEASE_DIR);
  fs.mkdirSync(release, { recursive: true });
  fs.writeFileSync(path.join(release, 'index.html'), html);
  fs.writeFileSync(path.join(release, 'roasthouse_phase7.html'), html);
}
console.log('Built', path.join(dist, 'index.html'), html.length, 'bytes');
