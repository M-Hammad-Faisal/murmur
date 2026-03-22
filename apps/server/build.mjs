#!/usr/bin/env node
/**
 * Bundle the Murmur Express server into a single self-contained index.js.
 *
 * better-sqlite3 is kept external (native .node addon can't be inlined).
 * It's copied to dist/native/better-sqlite3/ — NOT dist/node_modules/ —
 * because electron-builder silently strips any directory named node_modules
 * from extraResources. A banner in the bundle intercepts require('better-sqlite3')
 * and redirects it to ./native/better-sqlite3 at runtime.
 *
 * Output layout (dist/):
 *   index.js                        ← single bundle (all JS deps inlined)
 *   native/better-sqlite3/…        ← native package (not named node_modules!)
 */

import { execSync } from 'child_process'
import { cpSync, mkdirSync, rmSync } from 'fs'
import { createRequire } from 'module'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const outDir = join(__dirname, 'dist')

// Clean previous build artefacts (removes stale tsc output / old node_modules copy)
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

// ── 1. Intercept require('better-sqlite3') at runtime ────────────────────────
//    The banner runs before anything else in the CJS bundle.
//    It patches Module._resolveFilename so any require('better-sqlite3') call
//    (including ones deep inside whatsapp-web.js deps) resolves to our local copy.
const nativeBanner = `
;(function(){
  var _Module = require('module');
  var _path   = require('path');
  var _orig   = _Module._resolveFilename;
  _Module._resolveFilename = function(request, parent, isMain, options) {
    if (request === 'better-sqlite3') {
      request = _path.join(__dirname, 'native', 'better-sqlite3');
    }
    return _orig.call(this, request, parent, isMain, options);
  };
})();
`.trim()

// ── 2. esbuild bundle ─────────────────────────────────────────────────────────
console.log('Bundling server…')
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: join(outDir, 'index.js'),
  sourcemap: true,
  external: ['better-sqlite3'],
  banner: { js: nativeBanner },
  logLevel: 'warning',
})
console.log('  ✓ dist/index.js')

// ── 3. Copy better-sqlite3 + its runtime deps to dist/native/ ────────────────
//    better-sqlite3 requires 'bindings' and 'bindings' requires 'file-uri-to-path'.
//    None of these can be in a folder named node_modules (electron-builder strips them).
//    We copy them into better-sqlite3/node_modules/ so Node's sibling resolution works.
try {
  // Copy better-sqlite3
  const bs3PkgJson = require.resolve('better-sqlite3/package.json')
  const bs3Src = dirname(bs3PkgJson)
  const bs3Dir = join(outDir, 'native', 'better-sqlite3')
  cpSync(bs3Src, bs3Dir, { recursive: true, force: true })
  // Verify the binary is the expected arch so we catch stale builds early
  const nodeBin = join(bs3Dir, 'build', 'Release', 'better_sqlite3.node')
  try {
    const arch = execSync(`file "${nodeBin}"`).toString()
    const archLabel = arch.includes('arm64') ? 'arm64' : arch.includes('x86_64') ? 'x86_64' : '?'
    console.log(`  ✓ dist/native/better-sqlite3 (${archLabel})`)
    if (archLabel === 'x86_64' && process.arch === 'arm64') {
      console.warn(
        '  ⚠ WARNING: copied x86_64 binary but running on arm64 — run pnpm install to fix',
      )
    }
  } catch {
    console.log('  ✓ dist/native/better-sqlite3')
  }

  // Resolve better-sqlite3's own deps (bindings, file-uri-to-path) from its location
  const bs3Require = createRequire(bs3PkgJson)
  const depsToBundle = ['bindings', 'file-uri-to-path']
  const nm = join(bs3Dir, 'node_modules')
  mkdirSync(nm, { recursive: true })

  for (const dep of depsToBundle) {
    try {
      const depPkg = bs3Require.resolve(`${dep}/package.json`)
      cpSync(dirname(depPkg), join(nm, dep), { recursive: true, force: true })
      console.log(`  ✓ dist/native/better-sqlite3/node_modules/${dep}`)
    } catch {
      console.warn(`  ⚠ Could not copy ${dep} (may not be needed)`)
    }
  }
} catch (e) {
  console.warn('  ⚠ Could not copy native deps:', e.message)
}

console.log('\n✅ Server bundle ready →', outDir)
