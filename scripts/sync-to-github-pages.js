// scripts/sync-to-github-pages.js
import { createClient } from '@supabase/supabase-js';
import { getDocHtml, listDocsInFolder } from '../lib/googleDrive.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

// Configuration
const CONTENT_REPO_PATH = process.env.CONTENT_REPO_PATH || '../svt20-content';
const BASE_URL = 'https://yourusername.github.io/svt20-content';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Directories
const CHAPTERS_DIR = path.join(CONTENT_REPO_PATH, 'chapters');
const EXERCISES_DIR = path.join(CONTENT_REPO_PATH, 'exercises');
const EXAMS_DIR = path.join(CONTENT_REPO_PATH, 'exams');
const CONSEILS_DIR = path.join(CONTENT_REPO_PATH, 'conseils');
const IMAGES_DIR = path.join(CONTENT_REPO_PATH, 'images');

async function ensureDirectories() {
  await fs.mkdir(CHAPTERS_DIR, { recursive: true });
  await fs.mkdir(EXERCISES_DIR, { recursive: true });
  await fs.mkdir(EXAMS_DIR, { recursive: true });
  await fs.mkdir(CONSEILS_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });
}

async function syncAllContent() {
  console.log('🔄 Syncing content to GitHub Pages repo...\n');
  
  // Ensure content repo exists
  try {
    await fs.access(CONTENT_REPO_PATH);
  } catch {
    throw new Error(`Content repo not found at ${CONTENT_REPO_PATH}. Please clone svt20-content repo first.`);
  }

  await ensureDirectories();

  // Sync all content types
  await syncChapters();
  await syncExercises();
  await syncExams();
  await syncConseils();

  // Generate index files for each directory
  await generateIndexFiles();

  // Commit and push to GitHub
  await commitAndPush();

  console.log('\n✅ Content synced and pushed to GitHub Pages!');
  console.log(`📡 Available at: ${BASE_URL}`);
}

// ==================== SYNC CHAPTERS ====================
async function syncChapters() {
  console.log('📚 Syncing chapters...');
  
  const { data: chapters, error } = await supabase
    .from('chapters')
    .select('id, course, title');

  if (error) {
    console.error('  ❌ Supabase error:', error.message);
    return;
  }

  if (!chapters || chapters.length === 0) {
    console.log('  ℹ️  No chapters found');
    return;
  }

  for (const chapter of chapters) {
    if (!chapter.course) continue;

    try {
      console.log(`  📄 ${chapter.title || chapter.id}`);
      
      const html = await getDocHtml(chapter.course);
      const { updatedHtml, imageCount } = await downloadAndReplaceImages(html, 'chapters', chapter.id);
      
      const filePath = path.join(CHAPTERS_DIR, `${chapter.id}.html`);
      await fs.writeFile(filePath, updatedHtml, 'utf-8');
      
      console.log(`  ✅ Saved (${imageCount} images)`);
    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`);
    }
  }
}

// ==================== SYNC EXERCISES ====================
async function syncExercises() {
  console.log('\n📝 Syncing exercises...');
  
  const { data: chapters, error } = await supabase
    .from('chapters')
    .select('id, exercises');

  if (error) {
    console.error('  ❌ Supabase error:', error.message);
    return;
  }

  if (!chapters || chapters.length === 0) {
    console.log('  ℹ️  No chapters found');
    return;
  }

  for (const chapter of chapters) {
    if (!chapter.exercises) continue;

    try {
      const files = await listDocsInFolder(chapter.exercises);
      
      for (const file of files) {
        console.log(`  📄 ${file.name}`);
        
        const html = await getDocHtml(file.id);
        const { updatedHtml, imageCount } = await downloadAndReplaceImages(html, 'exercises', file.id);
        
        const filePath = path.join(EXERCISES_DIR, `${file.id}.html`);
        await fs.writeFile(filePath, updatedHtml, 'utf-8');
        
        console.log(`  ✅ Saved (${imageCount} images)`);
      }
    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`);
    }
  }
}

// ==================== SYNC EXAMS ====================
async function syncExams() {
  console.log('\n📋 Syncing exams...');
  
  const { googleDocsExams } = await import('../data_samples/ExamData.js');
  
  for (const exam of googleDocsExams || []) {
    try {
      console.log(`  📁 ${exam.session} (${exam.branch})`);
      
      // List all docs in the exam folder
      const files = await listDocsInFolder(exam.id);
      
      for (const file of files) {
        console.log(`    📄 ${file.name}`);
        
        const html = await getDocHtml(file.id);
        const { updatedHtml, imageCount } = await downloadAndReplaceImages(html, 'exams', file.id);
        
        const filePath = path.join(EXAMS_DIR, `${file.id}.html`);
        await fs.writeFile(filePath, updatedHtml, 'utf-8');
        
        console.log(`    ✅ Saved (${imageCount} images)`);
      }
    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`);
    }
  }
}

// ==================== SYNC CONSEILS ====================
async function syncConseils() {
  console.log('\n💡 Syncing conseils...');
  
  const { tipsArticles } = await import('../data_samples/TipsData.js');
  
  for (const article of tipsArticles || []) {
    if (!article.docId) continue;

    try {
      console.log(`  📄 ${article.title}`);
      
      const html = await getDocHtml(article.docId);
      const { updatedHtml, imageCount } = await downloadAndReplaceImages(html, 'conseils', article.docId);
      
      const filePath = path.join(CONSEILS_DIR, `${article.docId}.html`);
      await fs.writeFile(filePath, updatedHtml, 'utf-8');
      
      console.log(`  ✅ Saved (${imageCount} images)`);
    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}`);
    }
  }
}

// ==================== DOWNLOAD AND REPLACE IMAGES ====================
async function downloadAndReplaceImages(html, category, docId) {
  // Remove /api/image-proxy wrappers that parseDoc adds
  html = html.replace(/\/api\/image-proxy\?url=([^"']+)/g, (match, encodedUrl) => {
    return decodeURIComponent(encodedUrl);
  });

  const imageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
  let match;
  const imageMap = new Map();
  let imageCount = 0;

  while ((match = imageRegex.exec(html)) !== null) {
    const originalUrl = match[1];
    
    // Skip already processed images
    if (originalUrl.startsWith('/images/') || 
        originalUrl.startsWith('data:') ||
        originalUrl.includes('github.io')) {
      continue;
    }

    try {
      let buffer;
      let contentType = 'image/jpeg';

      // Download image with authentication for Google URLs
      if (originalUrl.includes('googleusercontent.com') || originalUrl.includes('docs.google.com')) {
        const response = await fetch(originalUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0',
          }
        });
        
        if (!response.ok) {
          console.error(`    ⚠️ Failed to download: ${response.status}`);
          continue;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        contentType = response.headers.get('content-type') || 'image/jpeg';
      } else {
        // Regular fetch for other URLs
        const response = await fetch(originalUrl);
        if (!response.ok) {
          console.error(`    ⚠️ Failed to download: ${response.status}`);
          continue;
        }
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        contentType = response.headers.get('content-type') || 'image/jpeg';
      }
      
      // Generate filename
      const hash = crypto.createHash('md5').update(originalUrl).digest('hex').substring(0, 12);
      const ext = guessExtension(originalUrl, contentType);
      const filename = `${category}_${docId}_${hash}.${ext}`;
      
      // Save to images directory
      const imagePath = path.join(IMAGES_DIR, filename);
      await fs.writeFile(imagePath, buffer);
      
      // Map old URL to new GitHub Pages URL
      const newUrl = `${BASE_URL}/images/${filename}`;
      imageMap.set(originalUrl, newUrl);
      imageCount++;
      
    } catch (error) {
      console.error(`    ⚠️ Image error: ${error.message}`);
    }
  }

  // Replace URLs in HTML
  let updatedHtml = html;
  for (const [oldUrl, newUrl] of imageMap) {
    updatedHtml = updatedHtml.replaceAll(oldUrl, newUrl);
  }

  return { updatedHtml, imageCount };
}

// ==================== GENERATE INDEX FILES ====================
async function generateIndexFiles() {
  console.log('\n📋 Generating index files...');

  // Chapters index
  const chapters = await fs.readdir(CHAPTERS_DIR);
  await generateIndex(CHAPTERS_DIR, chapters, 'Chapters');

  // Exercises index
  const exercises = await fs.readdir(EXERCISES_DIR);
  await generateIndex(EXERCISES_DIR, exercises, 'Exercises');

  // Exams index
  const exams = await fs.readdir(EXAMS_DIR);
  await generateIndex(EXAMS_DIR, exams, 'Exams');

  // Conseils index
  const conseils = await fs.readdir(CONSEILS_DIR);
  await generateIndex(CONSEILS_DIR, conseils, 'Conseils');
}

async function generateIndex(dir, files, title) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - SVT20 Content</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
    ul { list-style: none; padding: 0; }
    li { padding: 10px; border-bottom: 1px solid #eee; }
    a { text-decoration: none; color: #0066cc; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p>Total: ${files.length} files</p>
  <ul>
    ${files.map(file => `<li><a href="${file}">${file}</a></li>`).join('\n    ')}
  </ul>
  <hr>
  <p><a href="/">← Back to home</a></p>
</body>
</html>`;

  await fs.writeFile(path.join(dir, 'index.html'), html, 'utf-8');
}

// ==================== GIT OPERATIONS ====================
async function commitAndPush() {
  console.log('\n🔄 Committing and pushing to GitHub...');

  try {
    process.chdir(CONTENT_REPO_PATH);

    // Add all changes
    execSync('git add .', { stdio: 'inherit' });

    // Check if there are changes
    const status = execSync('git status --porcelain').toString();
    if (!status) {
      console.log('✅ No changes to commit');
      return;
    }

    // Commit
    const date = new Date().toISOString();
    execSync(`git commit -m "Content sync: ${date}"`, { stdio: 'inherit' });

    // Push
    execSync('git push origin main', { stdio: 'inherit' });

    console.log('✅ Pushed to GitHub successfully!');
  } catch (error) {
    console.error('❌ Git operation failed:', error.message);
    throw error;
  }
}

function guessExtension(url, contentType) {
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('gif')) return 'gif';
  if (contentType?.includes('webp')) return 'webp';
  if (url.toLowerCase().includes('.png')) return 'png';
  return 'jpg';
}

// Run sync
syncAllContent().catch(console.error);