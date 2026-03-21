/**
 * Generate separated exercise files from Supabase
 * 
 * Structure:
 * exams/{year}/{branch}/{session}/
 * ├── index.json          # metadata + list of exercises
 * ├── partie-I.html       # Partie I exercise content (question + correction)
 * ├── exercice-1.html     # Exercise 1 content (question + correction)
 * ├── exercice-2.html
 * └── exercice-3.html
 * 
 * Each file contains just the HTML content body (not full document)
 * to be embedded in the Next.js page wrapper
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

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
}

async function reorganizeExams() {
  console.log('Fetching exams from Supabase...\n');

  const { data: exams, error: examsErr } = await supabase
    .from('exams')
    .select('*')
    .order('date');

  if (examsErr) {
    console.error('Error fetching exams:', examsErr.message);
    return;
  }

  console.log(`Found ${exams.length} exams\n`);

  let processed = 0;

  for (const exam of exams) {
    try {
      const year = exam.date?.split('-')[0];
      const branch = exam.branch?.toUpperCase();
      const session = exam.session?.toLowerCase() === 'normale' ? 'normale' : 'rattrapage';

      if (!year || !branch || !session) {
        console.log(`Skipping exam ${exam.id} - missing metadata`);
        continue;
      }

      const examDir = path.join(EXAMS_DIR, year, branch, session);
      await ensureDir(examDir);

      const { data: sections } = await supabase
        .from('examsections')
        .select('*')
        .eq('examid', exam.id)
        .order('id');

      if (!sections || sections.length === 0) {
        console.log(`No sections for exam ${exam.id}`);
        continue;
      }

      // Build tree
      const rootSections = sections.filter(s => !s.parentid);
      const getChildren = (parentId) => sections.filter(s => s.parentid === parentId);

      // Index of exercises for this exam
      const exerciseIndex = [];

      for (const root of rootSections) {
        const children = getChildren(root.id);
        const rootHasContent = root.content && root.content.length > 100;

        // Pattern 1: Partie I - root has question, child with empty title is correction
        if (rootHasContent && children.length === 1 && !children[0].title) {
          const slug = 'partie-I';
          
          // HTML content with data attributes for easy parsing
          const html = `<div class="question-content" data-type="question">
${root.content}
</div>
<div class="question-content" data-type="correction">
${children[0].content}
</div>`;

          await fs.writeFile(path.join(examDir, `${slug}.html`), html, 'utf-8');
          exerciseIndex.push({
            slug,
            title: root.title,
            path: `${slug}.html`,
            type: 'partie'
          });

        } else {
          // Pattern 2: Partie II - children are exercises, grandchildren are corrections
          for (const child of children) {
            const grandChildren = getChildren(child.id);

            // Find correction
            const correctionIdx = grandChildren.findIndex(gc =>
              !gc.title || titlesMatch(gc.title, child.title) ||
              extractExoNumber(gc.title) === extractExoNumber(child.title)
            );

            const correction = correctionIdx >= 0 ? grandChildren[correctionIdx] : null;
            const exoNum = extractExoNumber(child.title) || 1;
            const slug = `exercice-${exoNum}`;

            // HTML content with data attributes for easy parsing
            const html = `<div class="question-content" data-type="question">
${child.content || ''}
</div>
${correction ? `<div class="question-content" data-type="correction">
${correction.content}
</div>` : ''}`;

            await fs.writeFile(path.join(examDir, `${slug}.html`), html, 'utf-8');
            exerciseIndex.push({
              slug,
              title: child.title || `Exercice ${exoNum}`,
              path: `${slug}.html`,
              type: 'exercice',
              number: exoNum
            });
          }
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
          branch: exam.branch,
          image: exam.image
        },
        exercises: exerciseIndex
      };

      await fs.writeFile(
        path.join(examDir, 'index.json'),
        JSON.stringify(indexData, null, 2),
        'utf-8'
      );

      processed++;
      console.log(`✅ ${year}/${branch}/${session}/ - ${exerciseIndex.length} exercises`);
    } catch (e) {
      console.error(`❌ Error processing exam ${exam.id}:`, e.message);
    }
  }

  console.log(`\nDone! Processed ${processed} exams`);
}

reorganizeExams();
