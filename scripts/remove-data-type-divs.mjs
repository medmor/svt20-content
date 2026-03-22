/**
 * Migration script: Remove data-type wrapper divs from exam HTML files.
 * 
 * BEFORE:
 * <div class="question-content" data-type="question">
 * <h2>Exercice</h2>
 * ...exercise content...
 * </div>
 * <div class="question-content" data-type="correction">
 * <h2>Correction</h2>
 * ...correction content...
 * </div>
 * </div>
 * 
 * AFTER:
 * <h2>Exercice</h2>
 * ...exercise content...
 * <h2>Correction</h2>
 * ...correction content...
 * 
 * Exercises without correction:
 * BEFORE:
 * <div class="question-content" data-type="question">
 * <h2>Exercice</h2>
 * ...exercise content...
 * </div>
 * </div>
 * 
 * AFTER:
 * <h2>Exercice</h2>
 * ...exercise content...
 */

import fs from 'fs';
import path from 'path';

const EXAMS_DIR = path.join(process.cwd(), 'exams');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // Check if file has data-type wrapper divs
  if (!content.includes('data-type="question"') && !content.includes('data-type="correction"')) {
    return false;
  }
  
  // Remove the opening wrapper divs
  content = content.replace(/<div class="question-content"\s+data-type="(question|correction)">\n?/g, '');
  
  // At the end of the file we have closing </div> tags:
  // - If has correction: ...</div></div></div> (3 divs)
  // - If no correction: ...</div></div> (2 divs)
  // Remove all of them
  content = content.replace(/<\/div>\n?$/g, '');
  content = content.replace(/<\/div>\n?$/g, '');
  content = content.replace(/<\/div>\n?$/g, '');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  }
  return false;
}

function walkDir(dir) {
  let count = 0;
  let changed = 0;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      const sub = walkDir(fullPath);
      count += sub.count;
      changed += sub.changed;
    } else if (entry.name.endsWith('.html')) {
      count++;
      if (processFile(fullPath)) {
        changed++;
        console.log(`  ${fullPath.replace(process.cwd() + '/', '')}`);
      }
    }
  }
  
  return { count, changed };
}

console.log('Removing data-type wrapper divs from exam HTML files...\n');
const result = walkDir(EXAMS_DIR);
console.log(`\nDone! Processed ${result.count} files, changed ${result.changed} files.`);
