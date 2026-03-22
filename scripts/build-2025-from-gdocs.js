/* DEPRECATED — Supabase/Google Drive integration disabled */
/**
 * Build 2025 exams from Google Docs file IDs
 * 
 * Takes the file IDs from Google Drive folders and creates the new
 * separated exercise structure:
 * exams/2025/{branch}/{session}/
 *   ├── index.json
 *   ├── partie-I.html
 *   ├── exercice-1.html
 *   └── ...
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXAMS_DIR = path.join(__dirname, '../exams');

// 2025 Exams - file IDs from Google Drive folders
const exams2025 = {
  '2025-svt-normale': {
    branch: 'SVT',
    session: 'Normale',
    year: 2025,
    files: [
      { id: '1QkJUSSO7i9YYqFL1cJzr4_G_8sPzQOrEBwIBU9ZUeyc', name: 'Partie I : Restitution des connaissances (5 points)', slug: 'partie-I' },
      { id: '1BAIr0asJD2P8PC1ViMjVjg9KI1aLhFIL9UDH6Vj92MY', name: 'Exercice 1 (3 points)', slug: 'exercice-1' },
      { id: '1vgFONvZawUdsXYgq3lOgk3nki2ZpOfHU2Btq1hD2D9Q', name: 'Exercice 2 (6 points)', slug: 'exercice-2' },
      { id: '1spO0k-q8Pu1syQD9ksZmY5BRoapsNSksnBWmDaPSYt4', name: 'Exercice 3 (3 points)', slug: 'exercice-3' },
      { id: '1znpCpBsnkLV4H8pz8gn1-k78aiooeemMXMaGFkX0XYI', name: 'Exercice 4 (3 points)', slug: 'exercice-4' },
    ]
  },
  '2025-svt-rattrapage': {
    branch: 'SVT',
    session: 'Rattrapage',
    year: 2025,
    files: [
      { id: '1AYZO8_6_yz0drnDKHAYqEXr6iOrgsFco3Usmbx1J0tA', name: 'Partie I : Restitution des connaissances (5 points)', slug: 'partie-I' },
      { id: '1JDXMVAwAM5U9tRtcieYhpMBwKXAnLqgv90HRoBHiN04', name: 'Exercice 1 (3 points)', slug: 'exercice-1' },
      { id: '17JaV4ixsFYSzODsPCvALOkGV2FiBjA8flqrSmzCtZ8k', name: 'Exercice 2 (4 points)', slug: 'exercice-2' },
      { id: '1v59WH6UDCe56c5z4reUT_0wlMaFtNtyQacDTO3alzzI', name: 'Exercice 3 (3 points)', slug: 'exercice-3' },
      { id: '1hTcLjXcl-15vmoDRouUbxexTnZWvTdf848mp2X4_PVg', name: 'Exercice 4 (5 points)', slug: 'exercice-4' },
    ]
  },
  '2025-sp-normale': {
    branch: 'SP',
    session: 'Normale',
    year: 2025,
    files: [
      { id: '1Acf9CD_cQlevxF5ndfzqohTUekXf4seIGz7o4HkvmEk', name: 'Partie I : Restitution des connaissances (5 points)', slug: 'partie-I' },
      { id: '1F7yx_S-JCRg_HAHED846S-k4EWM-Pcfq-Vaf-LXCB0c', name: 'Exercice 1 (3 points)', slug: 'exercice-1' },
      { id: '1WZts5FIMAop6IUKhqNGm39d60pJVlLj6wTqv8Xb-l70', name: 'Exercice 2 (6 points)', slug: 'exercice-2' },
      { id: '1rX56NkTxF4ITPJOeDVNqzP8M5nn67kkcvtT0aum7tOs', name: 'Exercice 3 (6 points)', slug: 'exercice-3' },
    ]
  },
  '2025-sp-rattrapage': {
    branch: 'SP',
    session: 'Rattrapage',
    year: 2025,
    files: [
      { id: '1uVMh03dhXmyxLj_-1PrKKhMFVBeqbgAiPAiLv_mSWiM', name: 'Partie II : Raisonnement scientifique et communication écrite et graphique', slug: 'partie-II' },
      { id: '15uppYztd4UAEpjSV4BgELuVhy16muDgHS6ZTrDeqghA', name: 'Exercice 1 (5 points)', slug: 'exercice-1' },
      { id: '1PYfK__AjgFgTy6Dtbj7veuay_dwRQ30VhdxyUd-iBwM', name: 'Exercice 2 (4 points)', slug: 'exercice-2' },
      { id: '1faLM5537-jWQqt3gS3AqLApK0rbi3YChRTqsO7_fvYg', name: 'Exercice 3 (3 points)', slug: 'exercice-3' },
      { id: '1Ro8S1fksczKiRbgND6ABmYNOn6K20YLJ50LmdveuV7k', name: 'Exercice 4 (3 points)', slug: 'exercice-4' },
    ]
  },
  '2025-sm-normale': {
    branch: 'SM',
    session: 'Normale',
    year: 2025,
    files: [
      { id: '1l-1-RDcwO0Y0ufkOqCP1qSIXAKitvWr6hGlma2Qrvks', name: 'Partie I : Restitution des connaissances (5 points)', slug: 'partie-I' },
      { id: '1XF_Jqhbe1IiBvrEE0_LkX_XAnGwBOFr_eZrcreuLXwM', name: 'Exercice 1 (5 points)', slug: 'exercice-1' },
      { id: '1ZMBm6asNfGNNgUUgakGvFFWUCQgtB5dL5FBpNuPKuK8', name: 'Exercice 2 (5 points)', slug: 'exercice-2' },
      { id: '1_OSprcmjFNUAUxTkqtRwfIhjMf3lYsRC_k1SM_6lZOU', name: 'Exercice 3 (10 points)', slug: 'exercice-3' },
    ]
  }
};

async function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function extractQuestionAndCorrection(html) {
  // Split by Correction heading
  // The heading pattern is <h2 class="...">Correction<br></h2>
  const parts = html.split(/(?=<h[1-3][^>]*>.*?Correction)/i);
  
  let question = html;
  let correction = '';
  
  if (parts.length > 1) {
    question = parts[0];
    correction = parts.slice(1).join('');
    
    // Remove the Correction heading from the correction content
    correction = correction.replace(/<h[1-3][^>]*>.*?Correction.*?<\/h[1-3]>/gi, '').trim();
  }
  
  return { question, correction };
}

function buildExerciseHtml(title, question, correction) {
  let html = `<div class="question-content" data-type="question">
${question}
</div>`;
  
  if (correction && correction.trim().length > 0) {
    html += `
<div class="question-content" data-type="correction">
<h2>Correction</h2>
${correction}
</div>`;
  }
  
  return html;
}

async function main() {
  console.log('Building 2025 exams from Google Docs file IDs...\n');
  
  // Delete existing 2025 folders to rebuild
  for (const examSlug of Object.keys(exams2025)) {
    const exam = exams2025[examSlug];
    const dir = path.join(EXAMS_DIR, String(exam.year), exam.branch, exam.session.toLowerCase());
    if (existsSync(dir)) {
      const { rmSync } = await import('fs');
      rmSync(dir, { recursive: true });
    }
  }
  
  // Process each exam
  for (const [examSlug, exam] of Object.entries(exams2025)) {
    console.log(`\n=== ${exam.branch} ${exam.session} ${exam.year} ===`);
    
    const examDir = path.join(EXAMS_DIR, String(exam.year), exam.branch, exam.session.toLowerCase());
    await ensureDir(examDir);
    
    const exercises = [];
    
    for (const file of exam.files) {
      console.log(`  Fetching: ${file.name} (${file.id})`);
      
      // Fetch from git history - old flat files are at exams/{docId}.html
      const { execSync } = await import('child_process');
      let html;
      
      try {
        html = execSync(
          `cd ~/Documents/Projects/svt/svt20-content && git show HEAD~3:exams/${file.id}.html`,
          { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        );
      } catch (e) {
        console.log(`    Warning: Could not fetch ${file.id} from git`);
        continue;
      }
      
      // Extract question and correction
      const { question, correction } = extractQuestionAndCorrection(html);
      
      // Write exercise file
      const filePath = path.join(examDir, `${file.slug}.html`);
      const exerciseHtml = buildExerciseHtml(file.name, question, correction);
      writeFileSync(filePath, exerciseHtml, 'utf-8');
      
      console.log(`    Created ${file.slug}.html (Q: ${question.length} chars, C: ${correction.length} chars)`);
      
      exercises.push({
        slug: file.slug,
        title: file.name,
        path: `${file.slug}.html`,
        type: file.slug.startsWith('partie') ? 'partie' : 'exercice',
        number: file.slug.startsWith('exercice') ? parseInt(file.slug.replace('exercice-', '')) : 0,
        hasCorrection: !!correction && correction.length > 0
      });
    }
    
    // Write index.json
    const indexData = {
      version: 1,
      generated: new Date().toISOString(),
      exam: {
        id: examSlug,
        session: exam.session,
        date: `${exam.year}-${exam.session === 'Normale' ? '06' : '07'}-01`,
        duration: '3',
        branch: exam.branch,
        image: null
      },
      exercises
    };
    
    writeFileSync(path.join(examDir, 'index.json'), JSON.stringify(indexData, null, 2), 'utf-8');
    console.log(`  ✅ ${exam.branch}/${exam.session} - ${exercises.length} exercises`);
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
*/
