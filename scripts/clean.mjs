#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Clean all build artefacts across every app and package.
 * Removes: dist/, out/, .next/, .turbo/, release/
 * Cross-platform — no rm -rf needed.
 */

import { rmSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')

const TARGETS = [
  // renderer
  'apps/renderer/.next',
  'apps/renderer/out',
  // server
  'apps/server/dist',
  // main
  'apps/main/dist',
  'apps/main/release',
  // packages
  'packages/types/dist',
  'packages/utils/dist',
  // turbo cache
  '.turbo',
  'apps/renderer/.turbo',
  'apps/server/.turbo',
  'apps/main/.turbo',
  'packages/types/.turbo',
  'packages/utils/.turbo',
]

let cleaned = 0
for (const target of TARGETS) {
  const fullPath = join(ROOT, target)
  if (existsSync(fullPath)) {
    rmSync(fullPath, { recursive: true, force: true })
    console.log(`  removed  ${target}`)
    cleaned++
  }
}

if (cleaned === 0) {
  console.log('  nothing to clean')
} else {
  console.log(`\n  cleaned ${cleaned} director${cleaned === 1 ? 'y' : 'ies'}`)
}
