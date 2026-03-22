#!/usr/bin/env node
/**
 * Remove Google Publisher Tag (GPT) ad elements from HTML files.
 * Targets: <ins class="adsbygoogle">, <div id="aswift_*">, and ad-related scripts.
 *
 * Usage: node scripts/remove-google-ads.js [path]
 *   path  — optional, defaults to content root
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = process.argv[2] || path.join(__dirname, '..');

let totalFiles = 0;
let cleanedFiles = 0;

function removeAdElements(html) {
  let original = html;

  // Remove <ins class="adsbygoogle...">...</ins> elements (GPT ad slots)
  html = html.replace(/<ins[^>]*class="[^"]*adsbygoogle[^"]*"[^>]*>[\s\S]*?<\/ins>/gi, '');

  // Remove <div id="aswift_X">...</div> wrapper elements created by GPT
  html = html.replace(/<div[^>]*\sid="aswift_\d+"[^>]*>[\s\S]*?<\/div>/gi, '');

  // Remove <div id="google_ads_*"> elements
  html = html.replace(/<div[^>]*\sid="google_ads_[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

  // Remove standalone <iframe> elements that point to googleads.g.doubleclick.net
  html = html.replace(/<iframe[^>]*googleads\.g\.doubleclick\.net[^>]*>[\s\S]*?<\/iframe>/gi, '');

  // Remove empty or whitespace-only <div> wrappers left behind
  html = html.replace(/<div[^>]*>\s*<\/div>/gi, '');

  // Remove Google AdSense auto-placed containers
  html = html.replace(/<div[^>]*class="[^"]*google-auto-placed[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  html = html.replace(/<div[^>]*class="[^"]*ap_container[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

  // Clean up orphaned iframes with ad-related attributes
  html = html.replace(/<iframe[^>]*(data-google-container-id|data-ad-format|data-ad-client)[^>]*>[\s\S]*?<\/iframe>/gi, '');

  return html;
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    if (entry.isDirectory()) {
      walkDir(full);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      totalFiles++;
      const content = fs.readFileSync(full, 'utf8');
      const cleaned = removeAdElements(content);
      if (cleaned !== content) {
        fs.writeFileSync(full, cleaned);
        cleanedFiles++;
        console.log(`  Cleaned: ${path.relative(root, full)}`);
      }
    }
  }
}

console.log(`Scanning: ${root}`);
walkDir(root);
console.log(`\nDone: ${cleanedFiles}/${totalFiles} files cleaned`);
