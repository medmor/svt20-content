/* DEPRECATED — Supabase/Google Drive integration disabled */
/**
 * Build 2024 & 2025 exams from Google Docs file IDs
 * 
 * Fetches content from git history (old synced files) and creates
 * the new separated exercise structure:
 * exams/{year}/{branch}/{session}/
 *   ├── index.json
 *   ├── partie-I.html
 *   ├── exercice-1.html
 *   └── ...
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXAMS_DIR = path.join(__dirname, '../exams');

// 2024 & 2025 Exams - file IDs from Google Drive
const allExams = [
  // ==================== 2024 ====================
  {
    slug: '2024-svt-normale',
    year: 2024,
    branch: 'SVT',
    session: 'Normale',
    files: [
      { id: '1-6STYTixZ78QOZ57RSmiJ-n8v5YbI00PPazPuRpxrNs', name: 'Partie I', slug: 'partie-I' },
      { id: '14kpUcW3YZtKiF513SoWE3HUCcbAIZngdi_tFB51QfSw', name: 'Exercice 1', slug: 'exercice-1' },
      { id: '1576_DWxCfWF6YQPUvFhBpKTQQVTP7rTRSDmtgxENVFI', name: 'Exercice 2', slug: 'exercice-2' },
      { id: '1hORmsU6wrFbVuRk8l_-ge-IKzOWYelD02u01TvNOW_M', name: 'Exercice 3', slug: 'exercice-3' },
      { id: '1VltPTz21H8P2IcdOLT04r8hMRPkbvFdGjP2L4ciM4T0', name: 'Exercice 4', slug: 'exercice-4' },
    ]
  },
  {
    slug: '2024-svt-rattrapage',
    year: 2024,
    branch: 'SVT',
    session: 'Rattrapage',
    files: [
      { id: '1qVaSBfGE8O3-YjCvZpwlnkDGVB6QcsudDRw6jSmGSyA', name: 'Partie I', slug: 'partie-I' },
      { id: '1BSAF4tQ-hD2t-3GwdEANtGwXhbvPv9w9XY9byN9lZ1c', name: 'Exercice 1', slug: 'exercice-1' },
      { id: '1dHQEcto0R3wCaGLBAKlEDaC-ZCmnBXWSQsiel_xJM6Q', name: 'Exercice 2', slug: 'exercice-2' },
      { id: '1Cz6vn48A2iwtYvevEjS5R0uL5zLjzo8YVGB0R3NkTck', name: 'Exercice 3', slug: 'exercice-3' },
      { id: '19OnG7SUMVVkQqiw-DtZEvI_lfaqWUp-wrSR2E3DHUc0', name: 'Exercice 4', slug: 'exercice-4' },
    ]
  },
  {
    slug: '2024-sp-normale',
    year: 2024,
    branch: 'SP',
    session: 'Normale',
    files: [
      { id: '1hi2QMpkIEhv8Fmx13QOEoDYE_EDMmwnlXGyDe8895mg', name: 'Partie I', slug: 'partie-I' },
      { id: '15Qfn2ZXYmt_piLce0-3kGNWa0L8FyjRJfdIPii0aWXk', name: 'Exercice 1', slug: 'exercice-1' },
      { id: '1Cyazbw28CZqFqDOmRYQ0deEeSSR9Uc81qCHvxZgeyYA', name: 'Exercice 2', slug: 'exercice-2' },
      { id: '1FTip6Xob_60W45n3L_nXvolYgZFKWviwHHB_zKqWUDI', name: 'Exercice 3', slug: 'exercice-3' },
    ]
  },
  {
    slug: '2024-sp-rattrapage',
    year: 2024,
    branch: 'SP',
    session: 'Rattrapage',
    files: [
      { id: '1Xn2pkqezp7avuC550FVcxNS2wGUSCKZpaQkZA5pvQc8', name: 'Partie I', slug: 'partie-I' },
      { id: '12F0ej8BNe71JJzhTt9NXtsGTnIWiQxOPIeh__G7dRPU', name: 'Exercice 1', slug: 'exercice-1' },
      { id: '10cCVq0CKnm2TYCch8N7s6X0f13kIxociZ8SaxpSbvcg', name: 'Exercice 2', slug: 'exercice-2' },
      { id: '1rZbR-Oz47JUhYpajmWTq1wYZ94qLhWkCyNC1S_owNEk', name: 'Exercice 3', slug: 'exercice-3' },
    ]
  },
  {
    slug: '2024-sm-normale',
    year: 2024,
    branch: 'SM',
    session: 'Normale',
    files: [
      { id: '1GS0wsBg2db7KsO-VXPfX98_eG80qWpHVjCbTO2JwcTo', name: 'Partie I', slug: 'partie-I' },
      { id: '11GntvzaMORNaDo53CmtDdDmsd44y_utVS_ozeMCVSF8', name: 'Exercice 1', slug: 'exercice-1' },
      { id: '1p1NxCQ8IGPFnrc4bscGJ_Lz7unTyUiONdAkNjwn4YHM', name: 'Exercice 2', slug: 'exercice-2' },
      { id: '1UVGwnaHtPTb1ihSOHU2FsbPjy9DKT1fyzcNC9yxAIOE', name: 'Exercice 3', slug: 'exercice-3' },
    ]
  },
  {
    slug: '2024-sm-rattrapage',
    year: 2024,
    branch: 'SM',
    session: 'Rattrapage',
    files: [
      { id: '1FQnNmSxYDseb1F9rwQjeI9KfEtWnLwmiKnZS3iTs-Ic', name: 'Partie I', slug: 'partie-I' },
      { id: '1Kctnr0GYs03T6o_LLYHX51qJkO90EF0UxXGZeSrOIAc', name: 'Exercice 1', slug: 'exercice-1' },
      { id: '1aH25PwA5bbQ-VJ9H3wIUdAkJ5dBwFUK2_5PPWZz3VO0', name: 'Exercice 2', slug: 'exercice-2' },
      { id: '10pcAKB2mxSXvlpHmdZgTbS_9ZUYi-skQLnC2HVjT_7Y', name: 'Exercice 3', slug: 'exercice-3' },
    ]
  },

  // ==================== 2025 ====================
  {
    slug: '2025-svt-normale',
    year: 2025,
    branch: 'SVT',
    session: 'Normale',
    files: [
      { id: '1QkJUSSO7i9YYqFL1cJzr4_G_8sPzQOrEBwIBU9ZUeyc', name: 'Partie I', slug: 'partie-I' },
      { id: '1BAIr0asJD2P8PC1ViMjVjg9KI1aLhFIL9UDH6Vj92MY', name: 'Exercice 1', slug: 'exercice-1' },
      { id: '1vgFONvZawUdsXYgq3lOgk3nki2ZpOfHU2Btq1hD2D9Q', name: 'Exercice 2', slug: 'exercice-2' },
      { id: '1spO0k-q8Pu1syQD9ksZmY5BRoapsNSksnBWmDaPSYt4', name: 'Exercice 3', slug: 'exercice-3' },
      { id: '1znpCpBsnkLV4H8pz8gn1-k78aiooeemMXMaGFkX0XYI', name: 'Exercice 4', slug: 'exercice-4' },
    ]
  },
  {
    slug: '2025-svt-rattrapage',
    year: 2025,
    branch: 'SVT',
    session: 'Rattrapage',
    files: [
      { id: '1AYZO8_6_yz0drnDKHAYqEXr6iOrgsFco3Usmbx1J0tA', name: 'Partie I', slug: 'partie-I' },
      { id: '1JDXMVAwAM5U9tRtcieYhpMBwKXAnLqgv90HRoBHiN04', name: 'Exercice 1', slug: 'exercice-1' },
      { id: '17JaV4ixsFYSzODsPCvALOkGV2FiBjA8flqrSmzCtZ8k', name: 'Exercice 2', slug: 'exercice-2' },
      { id: '1v59WH6UDCe56c5z4reUT_0wlMaFtNtyQacDTO3alzzI', name: 'Exercice 3', slug: 'exercice-3' },
      { id: '1hTcLjXcl-15vmoDRouUbxexTnZWvTdf848mp2X4_PVg', name: 'Exercice 4', slug: 'exercice-4' },
    ]
  },
  {
    slug: '2025-sp-normale',
    year: 2025,
    branch: 'SP',
    session: 'Normale',
    files: [
      { id: '1Acf9CD_cQlevxF5ndfzqohTUekXf4seIGz7o4HkvmEk', name: 'Partie I', slug: 'partie-I' },
      { id: '1F7yx_S-JCRg_HAHED846S-k4EWM-Pcfq-Vaf-LXCB0c', name: 'Exercice 1', slug: 'exercice-1' },
      { id: '1WZts5FIMAop6IUKhqNGm39d60pJVlLj6wTqv8Xb-l70', name: 'Exercice 2', slug: 'exercice-2' },
      { id: '1rX56NkTxF4ITPJOeDVNqzP8M5nn67kkcvtT0aum7tOs', name: 'Exercice 3', slug: 'exercice-3' },
    ]
  },
  {
    slug: '2025-sp-rattrapage',
    year: 2025,
    branch: 'SP',
    session: 'Rattrapage',
    files: [
      { id: '1uVMh03dhXmyxLj_-1PrKKhMFVBeqbgAiPAiLv_mSWiM', name: 'Partie II', slug: 'partie-II' },
      { id: '15uppYztd4UAEpjSV4BgELuVhy16muDgHS6ZTrDeqghA', name: 'Exercice 1', slug: 'exercice-1' },
      { id: '1PYfK__AjgFgTy6Dtbj7veuay_dwRQ30VhdxyUd-iBwM', name: 'Exercice 2', slug: 'exercice-2' },
      { id: '1faLM5537-jWQqt3gS3AqLApK0rbi3YChRTqsO7_fvYg', name: 'Exercice 3', slug: 'exercice-3' },
      { id: '1Ro8S1fksczKiRbgND6ABmYNOn6K20YLJ50LmdveuV7k', name: 'Exercice 4', slug: 'exercice-4' },
    ]
  },
  {
    slug: '2025-sm-normale',
    year: 2025,
    branch: 'SM',
    session: 'Normale',
    files: [
      { id: '1l-1-RDcwO0Y0ufkOqCP1qSIXAKitvWr6hGlma2Qrvks', name: 'Partie I', slug: 'partie-I' },
      { id: '1XF_Jqhbe1IiBvrEE0_LkX_XAnGwBOFr_eZrcreuLXwM', name: 'Exercice 1', slug: 'exercice-1' },
      { id: '1ZMBm6asNfGNNgUUgakGvFFWUCQgtB5dL5FBpNuPKuK8', name: 'Exercice 2', slug: 'exercice-2' },
      { id: '1_OSprcmjFNUAUxTkqtRwfIhjMf3lYsRC_k1SM_6lZOU', name: 'Exercice 3', slug: 'exercice-3' },
    ]
  },
];

async function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function extractQuestionAndCorrection(html) {
  // Split by Correction heading
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
  console.log('Building 2024 & 2025 exams from Google Docs file IDs...\n');
  
  // Process each exam
  for (const exam of allExams) {
    console.log(`\n=== ${exam.year} ${exam.branch} ${exam.session} ===`);
    
    const examDir = path.join(EXAMS_DIR, String(exam.year), exam.branch, exam.session.toLowerCase());
    
    // Clear existing directory
    if (existsSync(examDir)) {
      rmSync(examDir, { recursive: true });
    }
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
        id: exam.slug,
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
