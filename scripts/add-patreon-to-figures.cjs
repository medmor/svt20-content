#!/usr/bin/env node
// Script to add patreonUrl to figures.json entries
// Usage: node scripts/add-patreon-to-figures.cjs

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Load patreon data from SQLite
const dbPath = path.join(__dirname, '..', '..', 'svt20', 'svt.db');
const db = new Database(dbPath);

const chapters = db.prepare('SELECT slug, patreon FROM chapters WHERE patreon IS NOT NULL').all();
const patreonMap = {};

for (const ch of chapters) {
  try {
    const patreon = JSON.parse(ch.patreon);
    if (patreon.course) {
      patreonMap[ch.slug] = patreon.course;
    }
  } catch (e) {
    // skip invalid JSON
  }
}

db.close();

// Find all figures.json files
const contentRoot = path.join(__dirname, '..');
const figuresFiles = [];

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'figures.json') {
      figuresFiles.push(path.join(dir, entry.name));
    } else if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      walkDir(path.join(dir, entry.name));
    }
  }
}

walkDir(path.join(contentRoot, 'chapters'));

console.log(`Found ${figuresFiles.length} figures.json files`);

let updated = 0;
let errors = 0;

for (const file of figuresFiles) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const figures = JSON.parse(content);
    
    let modified = false;
    
    for (const chapterSlug of Object.keys(figures)) {
      if (patreonMap[chapterSlug]) {
        for (const figure of figures[chapterSlug]) {
          if (!figure.patreonUrl) {
            figure.patreonUrl = patreonMap[chapterSlug];
            modified = true;
          }
        }
      }
    }
    
    if (modified) {
      fs.writeFileSync(file, JSON.stringify(figures, null, 2) + '\n');
      console.log(`Updated: ${path.relative(contentRoot, file)}`);
      updated++;
    }
  } catch (e) {
    console.error(`Error: ${file}: ${e.message}`);
    errors++;
  }
}

console.log(`\nDone: ${updated} files updated, ${errors} errors`);
