/* DEPRECATED — Supabase/Google Drive integration disabled */
/**
 * Fetch 2025 exams from Google Docs and save as separated exercise files
 * 
 * The googleDocsExams array contains FOLDER IDs, not document IDs.
 * We need to list documents inside each folder and fetch them.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
const envPath = path.join(__dirname, '../../svt20/.env');
try {
  const { parse } = await import('dotenv');
  const env = parse(readFileSync(envPath));
  Object.entries(env).forEach(([k, v]) => process.env[k] = v);
} catch (e) {}

// Google Auth
const { google } = await import('googleapis');

function buildAuth(scopes) {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (raw) {
    let creds;
    try {
      creds = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      creds = JSON.parse(raw.replace(/\\n/g, '\n'));
    }
    if (creds.private_key && creds.private_key.includes('\\n')) {
      creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }
    return new google.auth.GoogleAuth({ credentials: creds, scopes });
  }
  return new google.auth.GoogleAuth({ keyFile: 'svt20-471109-615d0e03e469.json', scopes });
}

// 2025 Exam Folders from ExamData.js
const googleDocsExams = [
  { id: '1AI9WugNH0sq4L4rlKXRcUUYcSTvH6ff-', session: 'Normale', date: '2025-06-01', duration: '3', branch: 'SVT' },
  { id: '1PZkM4qbuCCctkB6cG_cwjNMgK0ZniIXm', session: 'Rattrapage', date: '2025-07-01', duration: '3', branch: 'SVT' },
  { id: '1WPxhJ-R-A4491oA3XDaSNJz6uMxqSt_i', session: 'Normale', date: '2025-06-01', duration: '3', branch: 'SP' },
  { id: '1I1eFT8A24O1fWeU2Qy5Ce8psHUaG8_3v', session: 'Rattrapage', date: '2025-07-01', duration: '3', branch: 'SP' },
  { id: '1Qxbj2MBKuFnHl_qKwcef4FHfvJyw-Iw5', session: 'Normale', date: '2025-07-01', duration: '2', branch: 'SM' },
];

const EXAMS_DIR = path.join(__dirname, '../exams');

async function listDocsInFolder(folderId) {
  const auth = buildAuth(['https://www.googleapis.com/auth/drive.readonly']);
  const drive = google.drive({ version: 'v3', auth });
  
  try {
    const { data } = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
      fields: 'files(id,name)',
      orderBy: 'name_natural',
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return data.files || [];
  } catch (e) {
    console.error(`Error listing folder ${folderId}:`, e.message);
    return [];
  }
}

async function fetchDoc(docId) {
  const auth = buildAuth(['https://www.googleapis.com/auth/documents.readonly']);
  const docs = google.docs({ version: 'v1', auth });
  
  try {
    const { data } = await docs.documents.get({ documentId: docId });
    return data;
  } catch (e) {
    console.error(`Error fetching doc ${docId}:`, e.message);
    return null;
  }
}

function parseDocToHtml(doc) {
  if (!doc || !doc.body) return '';
  
  let html = '';
  
  function processElement(element) {
    if (!element) return '';
    
    if (element.paragraph) {
      const p = element.paragraph;
      let text = '';
      
      for (const elem of p.elements || []) {
        if (elem.textRun) {
          text += elem.textRun.content || '';
        }
      }
      
      if (!text.trim()) return '';
      
      const style = p.paragraphStyle?.namedStyleType || '';
      
      if (style && style.startsWith('HEADING_')) {
        const level = style.replace('HEADING_', '');
        return `<h${level}>${text}</h${level}>`;
      }
      
      if (p.bullet) {
        return `<li>${text}</li>`;
      }
      
      let formatted = text;
      if (p.elements) {
        for (const elem of p.elements) {
          if (elem.textRun?.textStyle?.bold) {
            formatted = `<strong>${formatted}</strong>`;
            break;
          }
        }
      }
      
      return `<p>${formatted}</p>`;
    }
    
    if (element.table) {
      let tableHtml = '<table>';
      for (const row of element.table.tableRows || []) {
        tableHtml += '<tr>';
        for (const cell of row.tableCells || []) {
          tableHtml += '<td>';
          for (const ce of cell.content || []) {
            tableHtml += processElement(ce);
          }
          tableHtml += '</td>';
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</table>';
      return tableHtml;
    }
    
    return '';
  }
  
  for (const content of doc.body.content || []) {
    html += processElement(content);
  }
  
  return html;
}

function splitByExercises(html) {
  const exercises = [];
  
  // Split by "Exercice" heading
  const parts = html.split(/(?=<h[1-3]>)/);
  
  let currentExo = null;
  let currentContent = [];
  let correctionContent = [];
  let inCorrection = false;
  
  for (const part of parts) {
    const isExercice = /<h[1-3]>.*?Exercice/i.test(part);
    const isCorrection = /<h[1-3]>.*?Correction/i.test(part);
    
    if (isExercice) {
      // Save previous exercise if any
      if (currentExo !== null) {
        exercises.push({
          question: currentContent.join(''),
          correction: correctionContent.join('')
        });
      }
      currentExo = part;
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
      question: currentContent.join(''),
      correction: correctionContent.join('')
    });
  }
  
  return exercises;
}

async function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function processExam(exam) {
  console.log(`\nProcessing: ${exam.branch} ${exam.session} (${exam.date})`);
  
  const year = '2025';
  const branch = exam.branch.toUpperCase();
  const session = exam.session.toLowerCase() === 'normale' ? 'normale' : 'rattrapage';
  
  const examDir = path.join(EXAMS_DIR, year, branch, session);
  await ensureDir(examDir);
  
  // List documents in folder
  const files = await listDocsInFolder(exam.id);
  console.log(`  Found ${files.length} documents in folder`);
  
  if (files.length === 0) {
    console.log(`  No documents found, creating placeholder`);
    // Create empty exam structure
    writeFileSync(
      path.join(examDir, 'index.json'),
      JSON.stringify({
        version: 1,
        generated: new Date().toISOString(),
        exam: { id: exam.id, session: exam.session, date: exam.date, duration: exam.duration, branch, image: null },
        exercises: []
      }, null, 2),
      'utf-8'
    );
    return;
  }
  
  const exerciseIndex = [];
  
  // Process each document
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`  Fetching: ${file.name}`);
    
    const doc = await fetchDoc(file.id);
    if (!doc) {
      console.log(`    Failed to fetch`);
      continue;
    }
    
    const fullHtml = parseDocToHtml(doc);
    console.log(`    Parsed ${fullHtml.length} chars`);
    
    // Split into exercises with question/correction
    const exerciseParts = splitByExercises(fullHtml);
    console.log(`    Split into ${exerciseParts.length} exercise(s)`);
    
    for (let j = 0; j < exerciseParts.length; j++) {
      const exoNum = i + 1;
      const slug = `exercice-${exoNum}`;
      const { question, correction } = exerciseParts[j];
      
      // Build HTML with question and optional correction
      let html = `<div class="question-content" data-type="question">
${question}
</div>`;
      
      if (correction && (correction.includes('<p') || correction.includes('<h') || correction.includes('<li'))) {
        html += `
<div class="question-content" data-type="correction">
${correction}
</div>`;
      }
      
      writeFileSync(path.join(examDir, `${slug}.html`), html, 'utf-8');
      
      exerciseIndex.push({
        slug,
        title: file.name || `Exercice ${exoNum}`,
        path: `${slug}.html`,
        type: 'exercice',
        number: exoNum,
        hasCorrection: !!correction
      });
      
      console.log(`    Created ${slug}.html (correction: ${correction ? 'yes' : 'no'})`);
    }
  }
  
  // Generate index.json
  const indexData = {
    version: 1,
    generated: new Date().toISOString(),
    exam: {
      id: exam.id,
      session: exam.session,
      date: exam.date,
      duration: exam.duration,
      branch,
      image: null
    },
    exercises: exerciseIndex
  };
  
  writeFileSync(path.join(examDir, 'index.json'), JSON.stringify(indexData, null, 2), 'utf-8');
  
  console.log(`  ✅ ${year}/${branch}/${session}/ - ${exerciseIndex.length} exercises`);
}

async function main() {
  console.log('Fetching 2025 exams from Google Drive...\n');
  
  await ensureDir(path.join(EXAMS_DIR, '2025'));
  
  for (const exam of googleDocsExams) {
    await processExam(exam);
  }
  
  // Update master index
  console.log('\nUpdating master index...');
  
  const indexPath = path.join(EXAMS_DIR, 'index.json');
  let masterIndex = { exams: [] };
  
  if (existsSync(indexPath)) {
    try {
      masterIndex = JSON.parse(readFileSync(indexPath, 'utf-8'));
    } catch (e) {}
  }
  
  for (const exam of googleDocsExams) {
    const year = '2025';
    const branch = exam.branch.toLowerCase();
    const session = exam.session.toLowerCase() === 'normale' ? 'normale' : 'rattrapage';
    const slug = `${year}-${branch}-${session}`;
    
    if (!masterIndex.exams.find(e => e.slug === slug)) {
      masterIndex.exams.push({
        id: exam.id,
        slug,
        path: `${year}/${exam.branch}/${session}`,
        year: parseInt(year),
        branch: exam.branch,
        branchLower: branch,
        session: exam.session,
        sessionLower: session,
        date: exam.date,
        duration: exam.duration,
        image: null,
        level: '2-bac',
        levelName: '2 Bac'
      });
      console.log(`  Added ${slug}`);
    }
  }
  
  writeFileSync(indexPath, JSON.stringify(masterIndex, null, 2), 'utf-8');
  console.log('\nDone!');
}

main().catch(console.error);
*/
