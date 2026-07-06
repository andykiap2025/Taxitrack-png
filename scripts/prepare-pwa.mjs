// Prepares the web export for Netlify Drop and copies it to ../pwa.
//
// Netlify's drag-and-drop upload silently ignores every folder named
// "node_modules" — and expo export places fonts/icons under
// assets/node_modules/... . We rename that folder to assets/vendor and a
// rewrite rule in public/_redirects maps the original URLs onto it.
//
// Usage:  node scripts/prepare-pwa.mjs   (after: npx expo export -p web)

import { cpSync, existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(projectRoot, 'dist');
const pwa = path.join(projectRoot, '..', 'pwa');

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ not found or incomplete — run "npx expo export -p web" first.');
  process.exit(1);
}

const nodeModulesAssets = path.join(dist, 'assets', 'node_modules');
const vendorAssets = path.join(dist, 'assets', 'vendor');
if (existsSync(nodeModulesAssets)) {
  rmSync(vendorAssets, { recursive: true, force: true });
  try {
    renameSync(nodeModulesAssets, vendorAssets);
  } catch {
    // Windows sometimes denies renaming a just-written folder (antivirus
    // lock) — copy + delete achieves the same result.
    cpSync(nodeModulesAssets, vendorAssets, { recursive: true });
    rmSync(nodeModulesAssets, { recursive: true, force: true });
  }
  console.log('Renamed assets/node_modules -> assets/vendor');
}

// Refresh ../pwa with the new build (keep its README.md). Windows can hold
// locks on folders open in Explorer — overwrite-copy still succeeds, so a
// failed cleanup is only a warning.
for (const entry of readdirSync(pwa)) {
  if (entry === 'README.md') continue;
  try {
    rmSync(path.join(pwa, entry), { recursive: true, force: true });
  } catch {
    console.warn(`Could not fully remove old ${entry} (locked) — overwriting instead.`);
  }
}
cpSync(dist, pwa, { recursive: true, force: true });
console.log(`Copied build to ${pwa}`);
console.log('Ready: drag the pwa folder onto Netlify (app.netlify.com -> project -> Deploys).');
