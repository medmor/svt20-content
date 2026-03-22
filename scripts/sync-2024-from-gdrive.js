/* DEPRECATED — Supabase/Google Drive integration disabled */
/**
 * Sync 2024 exams from Google Drive using HTML export
 * 
 * Uses Google Drive export (HTML ZIP) to get full content including images.
 * 
 * Fetches from folder: 1aVcdSyWwzCj1v9zOG5wlRDyv2ahWzODF
 * 
 * Output:
 *   exams/2024/{branch}/{session}/
 *   ├── index.json
 *   ├── images/           (copied from Google Drive export)
 *   ├── partie-I.html
 *   ├── exercice-1.html
 *   └── ...
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, cpSync, readdirSync, statSync, createReadStream, createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { execSync } from 'child_process';
import { pipeline } from 'stream/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
const envPath = path.join(__dirname, '../../svt20/.env');
try {
  const { parse } = await import('dotenv');
  const env = parse(readFileSync(envPath));
  Object.entries(env).forEach(([k, v]) => process.env[k] = v);
} catch (e) {}

const { google } = await import('googleapis');

function buildAuth(scopes) {
  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
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

const EXAMS_DIR = path.join(__dirname, '../exams');
const ROOT_2024_FOLDER = '1aVcdSyWwzCj1v9zOG5wlRDyv2ahWzODF';
const TEMP_DIR = '/tmp/gdocs-export';

async function listFolders(parentId) {
  const auth = buildAuth(['https://www.googleapis.com/auth/drive.readonly']);
  const drive = google.drive({ version: 'v3', auth });
  
  try {
    const { data } = await drive.files.list({
      q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      orderBy: 'name_natural',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return data.files || [];
  } catch (e) {
    console.error(`Error listing folders in ${parentId}:`, e.message);
    return [];
  }
}

async function listDocs(parentId) {
  const auth = buildAuth(['https://www.googleapis.com/auth/drive.readonly']);
  const drive = google.drive({ version: 'v3', auth });
  
  try {
    const { data } = await drive.files.list({
      q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
      fields: 'files(id,name)',
      orderBy: 'name_natural',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    return data.files || [];
  } catch (e) {
    console.error(`Error listing docs in ${parentId}:`, e.message);
    return [];
  }
}

async function exportDocAsHtml(docId, outputDir) {
  const auth = buildAuth(['https://www.googleapis.com/auth/drive.readonly']);
  const drive = google.drive({ version: 'v3', auth });
  
  try {
    // Export as HTML (ZIP)
    const response = await drive.files.export({
      fileId: docId,
      mimeType: 'application/zip',
    }, { responseType: 'stream' });
    
    // Save ZIP
    const zipPath = path.join(TEMP_DIR, `${docId}.zip`);
    const writeStream = createWriteStream(zipPath);
    await pipeline(response.data, writeStream);
    return zipPath;
  } catch (e) {
    console.error(`Error exporting doc ${docId}:`, e.message);
    return null;
  }
}

function extractZip(zipPath, extractDir) {
  try {
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    console.error('Error extracting zip:', e.message);
    return false;
  }
}

function findHtmlFile(dir) {
  try {
    const files = readdirSync(dir);
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    if (htmlFiles.length > 0) {
      return path.join(dir, htmlFiles[0]);
    }
  } catch (e) {}
  return null;
}

function extractQuestionAndCorrection(html) {
  // Split by Correction heading (can be in various formats)
  const parts = html.split(/(?=<h[1-3][^>]*>.*?orrection)/i);
  
  let question = html;
  let correction = '';
  
  if (parts.length > 1) {
    question = parts[0];
    correction = parts.slice(1).join('');
    
    // Remove the Correction heading from the correction content
    correction = correction.replace(/<h[1-3][^>]*>.*?orrection.*?<\/h[1-3]>/gi, '').trim();
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

function extractExoNumber(title) {
  const match = title?.match(/exercice\s*(\d+)/i);
  return match ? parseInt(match[1]) : null;
}

function sanitizeHtml(html) {
  // Remove comments
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove the massive inline styles block
  html = html.replace(/<style type="text\/css">[\s\S]*?<\/style>/gi, '');
  
  // Extract body content only (Google Docs exports full HTML document)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    html = bodyMatch[1];
  }
  
  // Remove html/head wrappers if still present
  html = html.replace(/<html[^>]*>|<\/html>/gi, '');
  html = html.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  
  // Clean up empty paragraphs
  html = html.replace(/<p><br>\s*<\/p>/gi, '');
  html = html.replace(/<p>\s*<\/p>/gi, '');
  
  return html;
}

async function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function processFolder(branch, session, folderId) {
  const examDir = path.join(EXAMS_DIR, '2024', branch.toUpperCase(), session.toLowerCase());
  const imagesDir = path.join(examDir, 'images');
  
  // Clear existing
  if (existsSync(examDir)) {
    rmSync(examDir, { recursive: true });
  }
  await ensureDir(examDir);
  await ensureDir(imagesDir);
  
  // List documents
  const files = await listDocs(folderId);
  console.log(`  ${branch}/${session}: ${files.length} documents`);
  
  if (files.length === 0) {
    console.log(`  ⚠️  No documents found`);
    return null;
  }
  
  const exercises = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    // Determine slug based on filename
    let slug;
    if (/partie\s*i/i.test(file.name)) {
      slug = 'partie-I';
    } else if (/partie\s*ii/i.test(file.name)) {
      slug = 'partie-II';
    } else {
      const num = extractExoNumber(file.name) || (i + 1);
      slug = `exercice-${num}`;
    }
    
    console.log(`    Fetching: ${file.name} → ${slug}`);
    
    // Export as HTML
    const zipPath = await exportDocAsHtml(file.id, TEMP_DIR);
    if (!zipPath) {
      console.log(`      ❌ Failed to export`);
      continue;
    }
    
    console.log(`      Exported to ${zipPath}`);
    
    // Extract
    const extractDir = path.join(TEMP_DIR, file.id);
    // Clean old extraction if exists
    if (existsSync(extractDir)) {
      rmSync(extractDir, { recursive: true });
    }
    mkdirSync(extractDir, { recursive: true });
    console.log(`      Extracting...`);
    
    if (!extractZip(zipPath, extractDir)) {
      console.log(`      ❌ Failed to extract`);
      continue;
    }
    console.log(`      Extracted`);
    
    // Find HTML file
    const htmlFile = findHtmlFile(extractDir);
    if (!htmlFile) {
      console.log(`      ❌ No HTML file found in export`);
      continue;
    }
    
    // Read HTML
    let fullHtml = readFileSync(htmlFile, 'utf-8');
    
    // Copy images to exam directory and update paths
    const exportImagesDir = path.join(extractDir, 'images');
    if (existsSync(exportImagesDir)) {
      const imageFiles = readdirSync(exportImagesDir);
      for (const img of imageFiles) {
        const srcPath = path.join(exportImagesDir, img);
        const destPath = path.join(imagesDir, img);
        cpSync(srcPath, destPath);
        
        // Update path in HTML
        fullHtml = fullHtml.replace(
          new RegExp(`images/${img}`, 'g'),
          `images/${img}`
        );
      }
    }
    
    // Sanitize HTML
    fullHtml = sanitizeHtml(fullHtml);
    
    // Extract question and correction
    const { question, correction } = extractQuestionAndCorrection(fullHtml);
    
    // Write exercise file
    const html = buildExerciseHtml(file.name, question, correction);
    writeFileSync(path.join(examDir, `${slug}.html`), html, 'utf-8');
    
    exercises.push({
      slug,
      title: file.name,
      path: `${slug}.html`,
      type: slug.startsWith('partie') ? 'partie' : 'exercice',
      number: slug.startsWith('exercice') ? parseInt(slug.replace('exercice-', '')) : 0,
      hasCorrection: !!correction && correction.length > 0
    });
    
    console.log(`      ✅ ${slug}.html (Q: ${question.length} chars, C: ${correction.length} chars)`);
  }
  
  // Write index.json
  const indexData = {
    version: 1,
    generated: new Date().toISOString(),
    exam: {
      id: folderId,
      session: session.charAt(0).toUpperCase() + session.slice(1).toLowerCase(),
      date: '2024-06-01',
      duration: '3',
      branch: branch.toUpperCase(),
      image: null
    },
    exercises
  };
  
  writeFileSync(path.join(examDir, 'index.json'), JSON.stringify(indexData, null, 2), 'utf-8');
  
  return exercises.length;
}

async function main() {
  console.log('Syncing 2024 exams from Google Drive (with images)...\n');
  console.log(`Root folder: ${ROOT_2024_FOLDER}\n`);
  
  // Clean and ensure temp dir
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true });
  }
  mkdirSync(TEMP_DIR, { recursive: true });
  
  // Get branch folders (svt, sp, sm)
  const branches = await listFolders(ROOT_2024_FOLDER);
  console.log(`Found ${branches.length} branches: ${branches.map(b => b.name).join(', ')}\n`);
  
  let totalExercises = 0;
  
  for (const branch of branches) {
    console.log(`=== ${branch.name.toUpperCase()} ===`);
    
    // Get session folders (normale, rattrapage)
    const sessions = await listFolders(branch.id);
    
    for (const session of sessions) {
      const count = await processFolder(branch.name, session.name, session.id);
      if (count !== null) {
        totalExercises += count;
      }
    }
    console.log();
  }
  
  console.log(`\n✅ Done! Synced ${totalExercises} exercises from 2024`);
  console.log(`Images stored in: exams/2024/{branch}/{session}/images/`);
}

main().catch(console.error);
*/
