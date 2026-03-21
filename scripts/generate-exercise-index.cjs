#!/usr/bin/env node
/**
 * Generate index.html files in each exercises chapter folder
 * Each index.html contains a JSON array of exercise file names (without .html extension)
 */

const fs = require('fs');
const path = require('path');

const EXERCISES_DIR = path.join(__dirname, '..', 'exercises');

function generateIndex(folderPath) {
  // Skip if this is the root exercises directory
  if (folderPath === EXERCISES_DIR) return;
  
  // Check if this is a chapter folder (has parent level/unit structure)
  const relative = path.relative(EXERCISES_DIR, folderPath);
  const parts = relative.split(path.sep);
  
  // We need at least 3 parts: level/unit/chapter
  if (parts.length < 3) return;
  
  // Read directory
  let files;
  try {
    files = fs.readdirSync(folderPath);
  } catch (e) {
    console.error(`Error reading ${folderPath}: ${e.message}`);
    return;
  }
  
  // Filter for .html files only, strip extension
  const exercises = files
    .filter(f => f.endsWith('.html'))
    .map(f => f.replace(/\.html$/, ''));
  
  if (exercises.length === 0) {
    console.log(`No exercises in ${relative} - skipping`);
    return;
  }
  
  // Sort exercises (natural sort)
  exercises.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  
  // Create index.html with JSON array
  const indexPath = path.join(folderPath, 'index.html');
  const content = JSON.stringify(exercises);
  
  fs.writeFileSync(indexPath, content);
  console.log(`Created: ${relative}/index.html (${exercises.length} exercises)`);
}

// Walk through exercises directory
function walk(dir) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Check if this directory has HTML files
      const hasHtml = fs.readdirSync(fullPath).some(f => f.endsWith('.html'));
      
      if (hasHtml) {
        // This is a chapter folder - generate index
        generateIndex(fullPath);
      }
      
      // Continue walking
      walk(fullPath);
    }
  }
}

console.log('Generating exercise index files...\n');
walk(EXERCISES_DIR);
console.log('\nDone!');
