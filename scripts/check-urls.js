#!/usr/bin/env node
/**
 * URL Checker — validates all links and images in svt20-content HTML files.
 *
 * Checks:
 * - Local files: relative and absolute paths resolved against the content root
 * - External URLs: HTTP HEAD request via Node.js built-in fetch
 *
 * Usage: node scripts/check-urls.js [--fix]
 *   --fix  — write errors to .url-errors.json instead of printing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const TIMEOUT_MS = 8000;

const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');

let totalFiles = 0;
let totalUrls = 0;
let checkedCount = 0;
let errorCount = 0;
let localErrors = [];
let extErrors = [];
let running = 0;
const MAX_CONCURRENT = 15;

function extractUrls(html) {
  const urls = new Set();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) urls.add(m[1]);
  for (const m of html.matchAll(/src=["']([^"']+)["']/gi)) urls.add(m[1]);
  return [...urls];
}

function isIgnored(url) {
  if (!url || url.startsWith('#')) return true;
  if (/^(mailto|tel|javascript):/.test(url)) return true;
  return false;
}

function resolveLocal(filePath, url) {
  if (url.startsWith('/')) return path.join(ROOT, url);
  return path.join(path.dirname(filePath), url);
}

async function checkUrl(filePath, url) {
  if (isIgnored(url)) return;
  totalUrls++;

  if (/^https?:\/\//.test(url)) {
    running++;
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
      });
      checkedCount++;
      if (res.status === 404) {
        errorCount++;
        extErrors.push({ file: path.relative(ROOT, filePath), url, status: 404 });
      }
    } catch (e) {
      checkedCount++;
      errorCount++;
      extErrors.push({ file: path.relative(ROOT, filePath), url, error: e.message });
    }
    running--;
  } else {
    const resolved = resolveLocal(filePath, url);
    checkedCount++;
    if (!fs.existsSync(resolved)) {
      errorCount++;
      localErrors.push({ file: path.relative(ROOT, filePath), url, resolved: path.relative(ROOT, resolved) });
    }
  }

  if (checkedCount % 200 === 0) {
    process.stdout.write(`  checked ${checkedCount} urls... ${errorCount} errors\n`);
  }
}

async function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    if (entry.isDirectory()) {
      await walkDir(full);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      totalFiles++;
      const html = fs.readFileSync(full, 'utf8');
      const urls = extractUrls(html);

      for (const url of urls) {
        while (running >= MAX_CONCURRENT) {
          await new Promise(r => setTimeout(r, 100));
        }
        checkUrl(full, url);
      }
    }
  }
}

async function main() {
  const start = Date.now();

  console.log(`Scanning: ${ROOT}\n`);
  await walkDir(ROOT);

  // Wait for in-flight requests
  while (running > 0) {
    await new Promise(r => setTimeout(r, 200));
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n--- Results (${elapsed}s) ---`);
  console.log(`Files scanned:  ${totalFiles}`);
  console.log(`URLs found:     ${totalUrls}`);
  console.log(`URLs checked:   ${checkedCount}`);

  if (errorCount === 0) {
    console.log(`\n✅ All URLs valid!`);
  } else {
    console.log(`\n❌ ${errorCount} broken URL(s):`);

    if (localErrors.length > 0) {
      console.log(`\n  Local files (${localErrors.length}):`);
      localErrors.slice(0, 20).forEach(e => {
        console.log(`    ${e.file}`);
        console.log(`      Missing: ${e.url} → ${e.resolved}`);
      });
      if (localErrors.length > 20) console.log(`    ... and ${localErrors.length - 20} more`);
    }

    if (extErrors.length > 0) {
      console.log(`\n  External URLs (${extErrors.length}):`);
      extErrors.slice(0, 20).forEach(e => {
        console.log(`    ${e.file}`);
        console.log(`      ${e.url} → ${e.error || e.status}`);
      });
      if (extErrors.length > 20) console.log(`    ... and ${extErrors.length - 20} more`);
    }

    if (FIX_MODE) {
      fs.writeFileSync('.url-errors.json', JSON.stringify([...localErrors, ...extErrors], null, 2));
      console.log(`\nErrors saved to .url-errors.json`);
    }
  }
}

main().catch(console.error);
