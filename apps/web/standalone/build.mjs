/**
 * Bundle the app into one self-contained HTML file.
 *
 * Same pages, same engine — only the router and the font loading differ from the
 * Next.js build. If a number differs between the two, this build is the bug.
 */
import { build, transform } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, '..');

await build({
  entryPoints: [resolve(here, 'main.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  outfile: resolve(here, 'bundle.js'),
  alias: { '@scope/engine': resolve(web, '../../packages/engine/src/index.ts') },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});

// Minified like the JS is. The source keeps its comments; the single-file build is a
// build artefact, and the publish path has a size ceiling the comments were eating into.
const source = await readFile(resolve(web, 'app/globals.css'), 'utf8');
const { code: css } = await transform(source, { loader: 'css', minify: true });
const js = await readFile(resolve(here, 'bundle.js'), 'utf8');

// next/font supplies these in the Next build; here they come from Google Fonts.
const fontVars = ":root { --font-sans: 'Inter'; --font-serif: 'Newsreader'; }\n";

const html = [
  '<title>Scope Delivery Planner</title>',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,400&display=swap">',
  `<style>\n${fontVars}${css}</style>`,
  '<div id="root"></div>',
  `<script>\n${js.replaceAll('</script>', '<\\/script>')}\n</script>`,
].join('\n');

const out = resolve(here, 'scope-sandbox.html');
await writeFile(out, html);
console.log(`  ${out}  ${(Buffer.byteLength(html) / 1024).toFixed(0)}kb`);
