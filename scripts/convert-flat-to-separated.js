/* DEPRECATED — one-time migration script, no longer needed */
/* /**  * Convert old flat Google Docs HTML files to new separated exercise format  */
/**
 * Convert old flat Google Docs HTML files to new separated exercise format
 * 
 * Takes flat HTML files (from Google Docs sync) and converts them to:
 * exams/{year}/{branch}/{session}/
 *   ├── index.json
 *   ├── partie-I.html   (if exists)
 *   ├── exercice-1.html
 *   ├── exercice-2.html
 *   └── ...
 * 
 * Each exercise file has:
 * <div class="question-content" data-type="question">...</div>
 * <div class="question-content" data-type="correction">...</div>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXAMS_DIR = path.join(__dirname, '../exams');

// Google Docs exam metadata from ExamData.js
// Maps Google Doc ID -> {year, branch, session, date, duration}
const examMetadata = {
  // 2025 exams (already processed, listed for reference)
  // These are in folders already, not flat files
};

// We need to fetch metadata from the git history or reconstruct from file content
// For now, we'll use the folder structure from the flat files

async function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function splitByExercises(html) {
  const exercises = [];
  
  // Split by "Exercice" or "Correction" headings
  // The old format has: <h2>Exercice</h2> ... <h2>Correction</h2>
  const parts = html.split(/(?=<h[1-3][^>]*>)/);
  
  let currentExo = null;
  let currentContent = [];
  let correctionContent = [];
  let inCorrection = false;
  
  for (const part of parts) {
    const isCorrection = /<h[1-3][^>]*>.*?Correction/i.test(part);
    const isExercice = /<h[1-3][^>]*>.*?Exercice|Partie\s+I/i.test(part);
    const isPartieI = /<h[1-3][^>]*>.*?Partie\s+I/i.test(part);
    
    if (isExercice || isPartieI) {
      // Save previous exercise if any
      if (currentExo !== null) {
        exercises.push({
          title: currentExo,
          question: currentContent.join(''),
          correction: correctionContent.join('')
        });
      }
      // Extract title
      const titleMatch = part.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
      currentExo = titleMatch ? titleMatch[1].trim() : 'Exercice';
      currentContent = [part];
      correctionContent = [];
      inCorrection = false;
    } else if (isCorrection) {
      inCorrection = true;
      correctionContent.push(part);
    } else if (inCorrection) {
      correctionContent.push(part);
    } else {
      currentContent.push(part);
    }
  }
  
  // Push last exercise
  if (currentContent.length > 0) {
    exercises.push({
      title: currentExo || 'Exercice',
      question: currentContent.join(''),
      correction: correctionContent.join('')
    });
  }
  
  return exercises;
}

function slugify(text) {
  if (!text) return 'exercice';
  // Remove HTML tags
  const clean = text.replace(/<[^>]*>/g, '').trim();
  // Convert to lowercase and slugify
  return clean.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

function detectBranchFromContent(html) {
  // Detect branch from content keywords
  if (html.includes('mathématiques') || html.includes('المعادلات') || 
      html.includes('logarithme') || html.includes('Succinate') || html.includes('mitochondrie')) {
    return 'SM';
  }
  if (html.includes('Sélaginelles') || html.includes('fécondation') || 
      html.includes('méiose') || html.includes('caryotype')) {
    return 'SVT';
  }
  if (html.includes('asthm') || html.includes('sperme') || html.includes('spermatozoïde') ||
      html.includes('héréditaire') || html.includes('crossing-over')) {
    return 'SP';
  }
  return 'SVT'; // default
}

async function convertFlatFile(docId, html, metadata) {
  const { year, branch, session } = metadata;
  
  console.log(`\nConverting: ${docId} -> ${year}/${branch}/${session}`);
  
  const examDir = path.join(EXAMS_DIR, String(year), branch.toUpperCase(), session.toLowerCase());
  await ensureDir(examDir);
  
  // Split into exercises
  const exercises = splitByExercises(html);
  console.log(`  Found ${exercises.length} exercise(s)`);
  
  const exerciseIndex = [];
  
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    
    // Determine slug
    let slug;
    if (ex.title.toLowerCase().includes('partie') && ex.title.toLowerCase().includes('restitution')) {
      slug = 'partie-I';
    } else {
      slug = `exercice-${i + 1}`;
    }
    
    // Build HTML
    let fileHtml = `<div class="question-content" data-type="question">
${ex.question}
</div>`;
    
    if (ex.correction && ex.correction.trim()) {
      fileHtml += `
<div class="question-content" data-type="correction">
${ex.correction}
</div>`;
    }
    
    // Write file
    const filePath = path.join(examDir, `${slug}.html`);
    writeFileSync(filePath, fileHtml, 'utf-8');
    
    // Add to index
    exerciseIndex.push({
      slug,
      title: ex.title,
      path: `${slug}.html`,
      type: ex.title.toLowerCase().includes('partie') ? 'partie' : 'exercice',
      number: ex.title.toLowerCase().includes('partie') ? 0 : i + 1,
      hasCorrection: !!ex.correction && ex.correction.trim().length > 0
    });
    
    console.log(`  Created ${slug}.html (${ex.question.length} chars question, ${ex.correction?.length || 0} chars correction)`);
  }
  
  // Write index.json
  const indexData = {
    version: 1,
    generated: new Date().toISOString(),
    exam: {
      id: docId,
      session: session,
      date: metadata.date || `${year}-06-01`,
      duration: metadata.duration || '3',
      branch: branch.toUpperCase(),
      image: null
    },
    exercises: exerciseIndex
  };
  
  writeFileSync(
    path.join(examDir, 'index.json'),
    JSON.stringify(indexData, null, 2),
    'utf-8'
  );
  
  console.log(`  ✅ ${year}/${branch}/${session}/ - ${exerciseIndex.length} exercises`);
  
  return { year, branch, session, count: exerciseIndex.length };
}

async function main() {
  console.log('Converting flat Google Docs format to separated exercise format...\n');
  
  // Get list of flat HTML files from git history
  const { execSync } = await import('child_process');
  
  let flatFiles;
  try {
    // Files are at exams/{docId}.html (not in subdirectories)
    const output = execSync(
      'cd ~/Documents/Projects/svt/svt20-content && git ls-tree -r HEAD~3 --name-only | grep -E "^exams/[a-zA-Z0-9_-]+\\.html$"',
      { encoding: 'utf-8' }
    );
    flatFiles = output.trim().split('\n').filter(Boolean);
  } catch (e) {
    console.log('No flat files found in git history');
    return;
  }
  
  console.log(`Found ${flatFiles.length} flat HTML files`);
  
  // For each file, we need to extract year/branch/session from filename or content
  // The old format uses Google Doc IDs as filenames, so we need another source
  
  // Let's check if there's an index or manifest that maps IDs to metadata
  // For now, we'll try to detect from content
  
  const converted = [];
  
  for (const filePath of flatFiles) {
    try {
      // Get file content from git - the path is the same as in the tree
      let html;
      try {
        html = execSync(
          `cd ~/Documents/Projects/svt/svt20-content && git show HEAD~3:${filePath}`,
          { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        );
      } catch (e) {
        console.log(`  Could not fetch ${filePath} from git`);
        continue;
      }
      
      // Try to detect year from content
      let year = 2020; // default
      const yearMatch = html.match(/20\d{2}/);
      if (yearMatch) {
        const foundYear = parseInt(yearMatch[0]);
        if (foundYear >= 2016 && foundYear <= 2025) {
          year = foundYear;
        }
      }
      
      // Detect branch from content
      const branch = detectBranchFromContent(html);
      
      // Try to detect session (Normale vs Rattrapage)
      let session = 'Normale';
      if (html.toLowerCase().includes('rattrapage') || 
          html.includes('الاستدراكية') ||
          html.match(/session\s+de\s+rattrapage/i)) {
        session = 'Rattrapage';
      }
      
      // Extract doc ID from filename
      const docId = path.basename(filePath, '.html');
      
      await convertFlatFile(docId, html, { year, branch, session });
      converted.push({ year, branch, session });
      
    } catch (e) {
      console.error(`Error processing ${filePath}:`, e.message);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Conversion complete!');
  console.log(`Converted ${converted.length} exams`);
  
  // Summary by year
  const byYear = {};
  for (const c of converted) {
    const key = c.year;
    if (!byYear[key]) byYear[key] = [];
    byYear[key].push(`${c.branch} ${c.session}`);
  }
  console.log('\nBy year:');
  for (const [year, exams] of Object.entries(byYear)) {
    console.log(`  ${year}: ${exams.join(', ')}`);
  }
}

main().catch(console.error);
*/
