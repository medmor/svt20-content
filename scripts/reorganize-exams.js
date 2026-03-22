/* DEPRECATED — one-time migration script, no longer needed */
/* /**  * Reorganize exams from Supabase into proper hierarchy:  */
/**
 * Reorganize exams from Supabase into proper hierarchy:
 * exams/{year}/{branch}/{session}/{slug}.html
 * 
 * Section hierarchy patterns:
 * - Partie I: root has content (question), child with empty title is correction
 * - Partie II: root has no content, children are exercises (questions), grandchildren are corrections
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '../svt20/.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const EXAMS_DIR = path.join(process.cwd(), 'exams');

function titlesMatch(title1, title2) {
  if (!title1 || !title2) return false;
  if (title1 === title2) return true;
  const t1 = title1.replace(/\s*:\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const t2 = title2.replace(/\s*:\s*/g, ' ').replace(/\s+/g, ' ').trim();
  return t1 === t2;
}

function extractExoNumber(title) {
  const match = title?.match(/exercice\s*(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function generateExamHTML(exam, sections) {
  const rootSections = sections.filter(s => !s.parentid);
  const getChildren = (parentId) => sections.filter(s => s.parentid === parentId);
  
  let html = `<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${exam.session} ${exam.date} - ${exam.branch}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: ltr; background: #f5f5f5; padding: 20px; }
    .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333; }
    .header h1 { font-size: 1.8em; color: #333; margin-bottom: 10px; }
    .meta { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; color: #666; }
    .meta span { background: #eee; padding: 5px 15px; border-radius: 20px; }
    .partie { margin-bottom: 30px; }
    .partie h2 { background: #2c3e50; color: white; padding: 10px 20px; border-radius: 5px; margin-bottom: 15px; font-size: 1.2em; }
    .exercice { background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; }
    .exercice h3 { color: #2980b9; margin-bottom: 10px; font-size: 1.1em; }
    .exercice .content, .exercice > div { line-height: 1.8; }
    .correction { background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 8px; padding: 15px; margin-top: 10px; }
    .correction h4 { color: #2e7d32; margin-bottom: 10px; font-size: 1em; }
    .correction .content { line-height: 1.8; }
    img { max-width: 100%; height: auto; display: block; margin: 10px auto; border: 1px solid #ddd; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    td, th { border: 1px solid #ddd; padding: 8px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Examen ${exam.session === 'Normale' ? 'Normal' : 'Rattrapage'} ${exam.date.split('-')[0]}</h1>
      <div class="meta">
        <span>Branche: ${exam.branch}</span>
        <span>Duree: ${exam.duration} heures</span>
        <span>Date: ${exam.date}</span>
      </div>
    </div>
`;

  rootSections.forEach(root => {
    const children = getChildren(root.id);
    
    html += `    <div class="partie">\n`;
    html += `      <h2>${root.title}</h2>\n`;
    
    // Pattern 1: Partie I - root has content (question), child with empty title is correction
    const rootHasContent = root.content && root.content.length > 100;
    
    if (rootHasContent && children.length === 1 && !children[0].title) {
      // Partie I pattern: root question + child correction
      html += `      <div class="exercice">\n`;
      html += `        <h3>${root.title}</h3>\n`;
      html += `        <div class="content">${root.content}</div>\n`;
      html += `        <div class="correction">\n`;
      html += `          <h4>Correction</h4>\n`;
      html += `          <div class="content">${children[0].content}</div>\n`;
      html += `        </div>\n`;
      html += `      </div>\n`;
    } else {
      // Pattern 2: Partie II - children are exercises, grandchildren are corrections
      children.forEach(child => {
        const grandChildren = getChildren(child.id);
        
        // Find correction: grandchild with empty title OR same/similar title as child
        const correctionIdx = grandChildren.findIndex(gc => 
          !gc.title || titlesMatch(gc.title, child.title) || 
          extractExoNumber(gc.title) === extractExoNumber(child.title)
        );
        
        const hasCorrection = correctionIdx >= 0;
        
        html += `      <div class="exercice">\n`;
        // Use child title if exists, otherwise use part of root title
        html += `        <h3>${child.title || root.title}</h3>\n`;
        
        // Show question (child's content)
        if (child.content) {
          html += `        <div class="content">${child.content}</div>\n`;
        }
        
        // Show correction if exists
        if (hasCorrection) {
          const correction = grandChildren[correctionIdx];
          html += `        <div class="correction">\n`;
          html += `          <h4>Correction</h4>\n`;
          html += `          <div class="content">${correction.content}</div>\n`;
          html += `        </div>\n`;
        }
        
        html += `      </div>\n`;
      });
    }
    
    html += `    </div>\n`;
  });

  html += `  </div>
</body>
</html>`;

  return html;
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

async function reorganizeExams() {
  console.log('🔄 Fetching exams from Supabase...\n');

  const { data: exams, error: examsErr } = await supabase
    .from('exams')
    .select('*')
    .order('date');

  if (examsErr) {
    console.error('❌ Error fetching exams:', examsErr.message);
    return;
  }

  console.log(`📚 Found ${exams.length} exams\n`);

  let processed = 0;
  let errors = 0;

  for (const exam of exams) {
    try {
      const year = exam.date?.split('-')[0];
      const branch = exam.branch?.toUpperCase();
      const session = exam.session?.toLowerCase() === 'normale' ? 'normale' : 'rattrapage';

      if (!year || !branch || !session) {
        console.log(`⚠️  Skipping exam ${exam.id} - missing metadata`);
        errors++;
        continue;
      }

      const examDir = path.join(EXAMS_DIR, year, branch, session);
      await ensureDir(examDir);

      const { data: sections } = await supabase
        .from('examsections')
        .select('*')
        .eq('examid', exam.id)
        .order('id');

      const slug = `${year}-${branch.toLowerCase()}-${session}`;
      const html = generateExamHTML(exam, sections || []);

      const filePath = path.join(examDir, `${slug}.html`);
      await fs.writeFile(filePath, html, 'utf8');

      processed++;
      console.log(`✅ ${year}/${branch}/${session}/${slug}.html`);
    } catch (e) {
      console.error(`❌ Error processing exam ${exam.id}:`, e.message);
      errors++;
    }
  }

  console.log(`\n✅ Done! Processed: ${processed}, Errors: ${errors}`);
}

reorganizeExams();
*/
