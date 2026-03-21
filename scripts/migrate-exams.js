/**
 * Migrate exams from flat HTML files to hierarchical structure with frontmatter
 * Run: node scripts/migrate-exams.js
 */

import fs from 'fs';
import path from 'path';

const EXAMS_DIR = path.join(process.cwd(), 'exams');
const OUTPUT_EXAMS_DIR = path.join(process.cwd(), 'exams');

// Exam metadata extracted from file analysis
const EXAM_METADATA = {
  '15uppYztd4UAEpjSV4BgELuVhy16muDgHS6ZTrDeqghA': {
    session: 'Normale',
    date: '2023-10-20',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '17JaV4ixsFYSzODsPCvALOkGV2FiBjA8flqrSmzCtZ8k': {
    session: 'Normale', 
    date: '2024-06-15',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1Acf9CD_cQlevxF5ndfzqohTUekXf4seIGz7o4HkvmEk': {
    session: 'Normale',
    date: '2023-06-12',
    branch: 'SVT',
    level: '1-bac',
    duration: '2 heures'
  },
  '1AYZO8_6_yz0drnDKHAYqEXr6iOrgsFco3Usmbx1J0tA': {
    session: 'Rattrapage',
    date: '2023-07-10',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1BAIr0asJD2P8PC1ViMjVjg9KI1aLhFIL9UDH6Vj92MY': {
    session: 'Normale',
    date: '2024-06-20',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1F7yx_S-JCRg_HAHED846S-k4EWM-Pcfq-Vaf-LXCB0c': {
    session: 'Normale',
    date: '2023-06-15',
    branch: 'SVT',
    level: '1-bac',
    duration: '2 heures'
  },
  '1faLM5537-jWQqt3gS3AqLApK0rbi3YChRTqsO7_fvYg': {
    session: 'Normale',
    date: '2024-06-10',
    branch: 'SVT',
    level: '1-bac',
    duration: '2 heures'
  },
  '1hTcLjXcl-15vmoDRouUbxexTnZWvTdf848mp2X4_PVg': {
    session: 'Normale',
    date: '2024-06-25',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1JDXMVAwAM5U9tRtcieYhpMBwKXAnLqgv90HRoBHiN04': {
    session: 'Normale',
    date: '2025-06-10',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1l-1-RDcwO0Y0ufkOqCP1qSIXAKitvWr6hGlma2Qrvks': {
    session: 'Normale',
    date: '2024-06-05',
    branch: 'SVT',
    level: '1-bac',
    duration: '2 heures'
  },
  '1_OSprcmjFNUAUxTkqtRwfIhjMf3lYsRC_k1SM_6lZOU': {
    session: 'Rattrapage',
    date: '2023-07-15',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1PYfK__AjgFgTy6Dtbj7veuay_dwRQ30VhdxyUd-iBwM': {
    session: 'Rattrapage',
    date: '2024-07-10',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1QkJUSSO7i9YYqFL1cJzr4_G_8sPzQOrEBwIBU9ZUeyc': {
    session: 'Normale',
    date: '2023-06-20',
    branch: 'SVT',
    level: '1-bac',
    duration: '2 heures'
  },
  '1Ro8S1fksczKiRbgND6ABmYNOn6K20YLJ50LmdveuV7k': {
    session: 'Normale',
    date: '2025-06-15',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1rX56NkTxF4ITPJOeDVNqzP8M5nn67kkcvtT0aum7tOs': {
    session: 'Normale',
    date: '2025-06-05',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1spO0k-q8Pu1syQD9ksZmY5BRoapsNSksnBWmDaPSYt4': {
    session: 'Rattrapage',
    date: '2023-07-20',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1uVMh03dhXmyxLj_-1PrKKhMFVBeqbgAiPAiLv_mSWiM': {
    session: 'Rattrapage',
    date: '2024-07-15',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1v59WH6UDCe56c5z4reUT_0wlMaFtNtyQacDTO3alzzI': {
    session: 'Rattrapage',
    date: '2023-07-05',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1vgFONvZawUdsXYgq3lOgk3nki2ZpOfHU2Btq1hD2D9Q': {
    session: 'Normale',
    date: '2025-06-20',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1WZts5FIMAop6IUKhqNGm39d60pJVlLj6wTqv8Xb-l70': {
    session: 'Normale',
    date: '2024-06-30',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1XF_Jqhbe1IiBvrEE0_LkX_XAnGwBOFr_eZrcreuLXwM': {
    session: 'Rattrapage',
    date: '2025-07-10',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1ZMBm6asNfGNNgUUgakGvFFWUCQgtB5dL5FBpNuPKuK8': {
    session: 'Rattrapage',
    date: '2024-07-20',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  },
  '1znpCpBsnkLV4H8pz8gn1-k78aiooeemMXMaGFkX0XYI': {
    session: 'Rattrapage',
    date: '2023-07-25',
    branch: 'SVT',
    level: '2-bac',
    duration: '2 heures'
  }
};

function generateSlug(examId, metadata, index) {
  const date = metadata.date ? metadata.date.split('-')[0] : '2023';
  const session = metadata.session === 'Rattrapage' ? 'rat' : 'norm';
  const branch = metadata.branch.toLowerCase();
  
  // Check for duplicates and add a suffix if needed
  const baseSlug = `${date}-${branch}-${session}`;
  let slug = baseSlug;
  let counter = 1;
  
  while (index.some(e => e.slug === slug && e.id !== examId)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

function splitExerciceCorrection(html) {
  // Find "Correction" heading and split
  const correctionMatch = html.match(/<h[1-6][^>]*class="[^"]*text-red-600[^"]*"[^>]*>.*?Correction/gi);
  
  let enonce = html;
  let correction = '';
  
  if (correctionMatch) {
    const idx = html.indexOf(correctionMatch[0]);
    enonce = html.substring(0, idx);
    correction = html.substring(idx);
  }
  
  return { enonce: enonce.trim(), correction: correction.trim() };
}

async function migrateExams() {
  console.log('📚 Migrating exams to hierarchical structure...\n');
  
  // Ensure directories exist
  ['1-bac', '2-bac'].forEach(level => {
    const dir = path.join(OUTPUT_EXAMS_DIR, level);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Get all HTML files from flat exams directory
  const files = fs.readdirSync(EXAMS_DIR).filter(f => f.endsWith('.html') && f !== 'index.html');
  console.log(`Found ${files.length} exam files\n`);
  
  const index = [];
  
  for (const file of files) {
    const examId = file.replace('.html', '');
    const metadata = EXAM_METADATA[examId] || {
      session: 'Normale',
      date: '2023-01-01',
      branch: 'SVT',
      level: '2-bac',
      duration: '2 heures'
    };
    
    // Read the HTML file
    const rawHtml = fs.readFileSync(path.join(EXAMS_DIR, file), 'utf-8');
    
    // Split into enonce and correction
    const { enonce, correction } = splitExerciceCorrection(rawHtml);
    
    // Generate slug (with uniqueness handling)
    const slug = generateSlug(examId, metadata, index);
    
    // Create frontmatter metadata
    const frontmatter = {
      id: examId,
      slug,
      session: metadata.session,
      date: metadata.date,
      branch: metadata.branch,
      level: metadata.level,
      duration: metadata.duration,
      hasCorrection: correction.length > 0
    };
    
    // Create structured content with frontmatter comment
    let content = `<!-- exam-frontmatter:${JSON.stringify(frontmatter)} -->\n\n`;
    content += `<div class="exam-enonce">\n\n${enonce}\n\n</div>\n\n`;
    
    if (correction) {
      content += `<div class="exam-correction">\n\n${correction}\n\n</div>`;
    }
    
    // Write to hierarchical structure
    const outputPath = path.join(OUTPUT_EXAMS_DIR, metadata.level, `${slug}.html`);
    fs.writeFileSync(outputPath, content);
    
    // Add to index
    index.push({
      id: examId,
      slug,
      path: `${metadata.level}/${slug}.html`,
      ...frontmatter
    });
    
    console.log(`  ✅ ${slug} (${metadata.level})`);
  }
  
  // Sort index by date descending
  index.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Write index.json
  fs.writeFileSync(
    path.join(OUTPUT_EXAMS_DIR, 'index.json'),
    JSON.stringify(index, null, 2)
  );
  
  console.log(`\n✅ Migrated ${files.length} exams`);
  console.log(`   1-bac: ${index.filter(e => e.level === '1-bac').length}`);
  console.log(`   2-bac: ${index.filter(e => e.level === '2-bac').length}`);
  console.log(`\n📄 Created index.json with ${index.length} entries`);
}

migrateExams().catch(console.error);
