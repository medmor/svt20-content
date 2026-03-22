#!/usr/bin/env node
/**
 * Rename exercise folders to match full slugs from SQLite.
 * 
 * The exercise folder names were created with truncated slugs (50 chars).
 * This script renames them to use the full slugs from the local SQLite DB.
 * 
 * Run from svt20-content directory:
 *   node scripts/rename-exercise-folders.cjs
 */

const fs = require('fs');
const path = require('path');

// Local SQLite for slug mapping
const dbPath = path.join(__dirname, '..', '..', 'svt20', 'svt.db');
let db = null;
try {
  db = require('better-sqlite3')(dbPath);
} catch (e) {
  console.error('Could not open SQLite DB at', dbPath, '-', e.message);
  process.exit(1);
}

const EXERCISES_DIR = path.join(__dirname, '..', 'exercises');

// Build full slug map from SQLite
const allChapters = db.prepare(`
  SELECT c.slug as full_slug, c.title, u.slug as unit_slug, l.slug as level_slug
  FROM chapters c
  JOIN units u ON c.unit_id = u.id
  JOIN levels l ON u.level_id = l.id
`).all();

console.log(`Loaded ${allChapters.length} chapters from local SQLite`);

// Build a map: `${level_slug}/${unit_slug}` -> array of {full_slug, truncated_slug, title}
// Note: exercises folder uses FULL unit_slug (e.g., "1-bac-unit-1", not "unit-1")
const chaptersByUnit = {};
allChapters.forEach(ch => {
  const key = `${ch.level_slug}/${ch.unit_slug}`;
  if (!chaptersByUnit[key]) chaptersByUnit[key] = [];
  
  // Truncated slug is first 50 chars
  const truncatedSlug = ch.full_slug.slice(0, 50);
  
  chaptersByUnit[key].push({
    full_slug: ch.full_slug,
    truncated_slug: truncatedSlug,
    title: ch.title
  });
});

// Walk exercises directory and find folders that need renaming
function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'index.html' || entry.name.includes('.')) continue;
    
    const fullPath = path.join(dir, entry.name);
    const renamed = processChapterFolder(dir, entry.name);
    // If folder was renamed, skip recursing into it
    if (renamed === false) continue;
    // Recurse into the folder
    walkDir(fullPath);
  }
}

function processChapterFolder(parentDir, folderName) {
  // Determine level and unit from parent path
  const relativePath = path.relative(EXERCISES_DIR, path.join(parentDir, folderName));
  const parts = relativePath.split(path.sep);
  
  if (parts.length < 2) return; // Not enough path depth
  
  const levelSlug = parts[0];
  const unitSlug = parts[1];
  
  const key = `${levelSlug}/${unitSlug}`;
  const chapters = chaptersByUnit[key];
  
  if (!chapters) {
    console.log(`  ⚠  No chapters found for: ${key}`);
    return;
  }
  
  // Find matching chapter
  let matched = null;
  for (const ch of chapters) {
    // Check if folder matches full slug OR truncated slug
    if (ch.full_slug === folderName) {
      matched = ch;
      break;
    }
    if (ch.truncated_slug === folderName) {
      matched = ch;
      break;
    }
  }
  
  if (!matched) {
    // Try partial match - folder name is prefix of full slug
    for (const ch of chapters) {
      if (ch.full_slug.startsWith(folderName) && folderName.length < ch.full_slug.length) {
        matched = ch;
        break;
      }
    }
  }
  
  if (!matched) {
    console.log(`  ⚠  Could not find match for folder: ${folderName} in ${key}`);
    return;
  }
  
  if (matched.full_slug === folderName) {
    console.log(`  ✓  OK: ${folderName}`);
    return; // Already correct, recurse into it
  }
  
  const oldPath = path.join(parentDir, folderName);
  const newPath = path.join(parentDir, matched.full_slug);
  
  if (fs.existsSync(newPath)) {
    console.log(`  ⚠  Target already exists: ${matched.full_slug} (skipping)`);
    return;
  }
  
  console.log(`  ✏️  ${folderName} → ${matched.full_slug}`);
  fs.renameSync(oldPath, newPath);
  // Don't recurse into the renamed folder - it will be processed when we walk again
  return false; // Signal to skip recursion
}

console.log('\nRenaming exercise folders...\n');
walkDir(EXERCISES_DIR);
console.log('\nDone!');
db.close();
