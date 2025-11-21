import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_REPO_PATH = process.env.CONTENT_REPO_PATH || path.join(__dirname, '..');
const IMAGES_DIR = path.join(CONTENT_REPO_PATH, 'images');
const CHAPTERS_DIR = path.join(CONTENT_REPO_PATH, 'chapters');
const EXERCISES_DIR = path.join(CONTENT_REPO_PATH, 'exercises');
const EXAMS_DIR = path.join(CONTENT_REPO_PATH, 'exams');
const CONSEILS_DIR = path.join(CONTENT_REPO_PATH, 'conseils');

async function getAllHtmlFiles() {
  const htmlFiles = [];
  const dirs = [CHAPTERS_DIR, EXERCISES_DIR, EXAMS_DIR, CONSEILS_DIR];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith('.html')) {
        htmlFiles.push(path.join(dir, file));
      }
    }
  }

  return htmlFiles;
}

function extractImageReferences(htmlContent) {
  const imageRefs = new Set();
  
  // Match all image src attributes
  const imgRegex = /src=["']https:\/\/medmor\.github\.io\/svt20-content\/images\/(.*?)["']/g;
  let match;
  
  while ((match = imgRegex.exec(htmlContent)) !== null) {
    imageRefs.add(match[1]);
  }
  
  return imageRefs;
}

async function cleanupUnusedImages() {
  console.log('🔍 Scanning HTML files for image references...\n');

  // Get all HTML files
  const htmlFiles = await getAllHtmlFiles();
  console.log(`📄 Found ${htmlFiles.length} HTML files\n`);

  // Extract all image references from HTML files
  const usedImages = new Set();
  
  for (const htmlFile of htmlFiles) {
    const content = fs.readFileSync(htmlFile, 'utf-8');
    const refs = extractImageReferences(content);
    refs.forEach(ref => usedImages.add(ref));
  }

  console.log(`🖼️  Found ${usedImages.size} unique images referenced in HTML\n`);

  // Get all images in the images directory
  if (!fs.existsSync(IMAGES_DIR)) {
    console.log('❌ Images directory does not exist');
    return;
  }

  const allImages = fs.readdirSync(IMAGES_DIR);
  console.log(`📁 Found ${allImages.length} total images on disk\n`);

  // Find unused images
  const unusedImages = new Set();
  for (const image of allImages) {
    if (!usedImages.has(image)) {
      unusedImages.add(image);
    }
  }

  if (unusedImages.size === 0) {
    console.log('✅ No unused images found. Everything is clean!');
    return;
  }

  console.log(`🗑️  Found ${unusedImages.size} unused images:\n`);

  // Delete unused images
  let deletedCount = 0;
  for (const image of unusedImages) {
    const imagePath = path.join(IMAGES_DIR, image);
    try {
      fs.unlinkSync(imagePath);
      console.log(`  ❌ Deleted: ${image}`);
      deletedCount++;
    } catch (error) {
      console.error(`  ⚠️  Failed to delete ${image}:`, error.message);
    }
  }

  console.log(`\n✅ Cleanup complete! Deleted ${deletedCount} unused images.`);
}

// Run the cleanup
cleanupUnusedImages().catch(console.error);