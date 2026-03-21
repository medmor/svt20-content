#!/usr/bin/env node
// Migrates fiches from Supabase to local files in svt20-content
// Stores each chapter's fiche at the chapter level (alongside chapter .html)
//
// Usage: node scripts/migrate-fiches-from-supabase.cjs

const fs = require('fs');
const path = require('path');

// Supabase client
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://qezkpggzsefmgfhrowmy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlemtwZ2d6c2VmbWdmaHJvd215Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NDg4MTMsImV4cCI6MjA3MDMyNDgxM30.F6zbQkWJ5pfKtPPYOf5Wir40gvuZ-qvAUu10USCh8ig'
);

const contentRoot = path.join(__dirname, '..');

// Build maps of chapters
function buildChapterMaps() {
  const chapters = []; // Array of {slug, title, dir}
  
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.endsWith('.html')) {
        const content = fs.readFileSync(path.join(dir, entry.name), 'utf8');
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (match) {
          const fm = match[1];
          const slugMatch = fm.match(/^slug:\s*["']?([^"'\n]+)["']?/m);
          const titleMatch = fm.match(/^title:\s*["']?([^"'\n]+)["']?/m);
          if (slugMatch) {
            chapters.push({
              slug: slugMatch[1],
              title: titleMatch ? titleMatch[1] : '',
              dir: dir
            });
          }
        }
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walkDir(path.join(dir, entry.name));
      }
    }
  }
  
  walkDir(path.join(contentRoot, 'chapters'));
  return chapters;
}

function normalizeForMatch(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .normalize('NFD')
    .replace(/[^\x00-\x7f]/g, '')    // Remove remaining non-ASCII
    .replace(/[:\.]/g, '')            // Remove punctuation
    .replace(/\s+/g, ' ')             // Collapse spaces
    .trim();
}

function slugify(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[:\.]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/-+$/, '');
}

function extractChapterTitleFromFiche(content) {
  // Handle &nbsp; and different HTML structures
  const fixed = content.replace(/&nbsp;/g, ' ');
  
  // Find "Chapitre" and then look for the next td with colspan=2 for the title
  const idx = fixed.indexOf('Chapitre');
  if (idx === -1) return null;
  
  const rest = fixed.substring(idx);
  const tdMatch = rest.match(/<\/td>\s*<td[^>]*colspan="2"[^>]*>\s*<span[^>]*>([^<]+)/);
  if (tdMatch) return tdMatch[1].trim();
  
  // Fallback: try simpler pattern
  const match = fixed.match(/<strong>Chapitre\s*\d+\s*<\/strong>\s*<\/span>\s*<\/td>\s*<td[^>]*>\s*<span[^>]*>([^<]+)/);
  if (match) return match[1].trim();
  
  return null;
}

async function main() {
  console.log('Fetching fiches from Supabase...');
  
  const { data: fiches, error } = await supabase
    .from('sections')
    .select('*')
    .eq('type', 'fiche_section');
  
  if (error) throw error;
  console.log(`Found ${fiches.length} fiches in Supabase`);
  
  const chapters = buildChapterMaps();
  console.log(`Found ${chapters.length} chapters`);
  
  // Build match maps
  const slugMap = new Map(chapters.map(c => [c.slug, c]));
  const titleNormMap = new Map(chapters.map(c => [normalizeForMatch(c.title), c]));
  
  // Manual overrides for known title mismatches (ASCII-only keys)
  const titleOverrides = {
    'realisation de carte paleogeographique dune region': 'ralisation-de-la-carte-palogographique-dune-rgion',
    'absorption deau et des sels mineraux': 'absorption-de-leau-et-des-sels-minraux-par-les-plantes',
  };
  let migrated = 0;
  let skipped = 0;
  
  for (const fiche of fiches) {
    const chapterTitle = extractChapterTitleFromFiche(fiche.content);
    
    if (!chapterTitle) {
      console.warn(`  Could not extract chapter title from fiche ${fiche.id} - skipping`);
      skipped++;
      continue;
    }
    
    const normTitle = normalizeForMatch(chapterTitle);
    let chapter = titleNormMap.get(normTitle);
    
    // Try overrides
    if (!chapter) {
      const overrideKey = normTitle.replace(/['"\u2018\u2019\u201b]/g, '').replace(/\s+/g, ' ').trim();
      const overrideSlug = titleOverrides[overrideKey];
      if (overrideSlug) {
        chapter = slugMap.get(overrideSlug);
      }
    }
    
    // Try fuzzy match
    if (!chapter) {
      for (const [title, c] of titleNormMap) {
        // Check if titles are similar enough (contain each other)
        const minLen = Math.min(title.length, normTitle.length);
        if (title.length > 10 && normTitle.length > 10) {
          if (title.includes(normTitle.substring(0, Math.min(20, normTitle.length))) || 
              normTitle.includes(title.substring(0, Math.min(20, title.length)))) {
            chapter = c;
            break;
          }
        }
      }
    }
    
    if (!chapter) {
      console.warn(`  Could not match fiche for chapter: "${chapterTitle}" - skipping`);
      skipped++;
      continue;
    }
    
    // fiche at chapter level as {slug}.fiche.html
    const fichePath = path.join(chapter.dir, chapter.slug + '.fiche.html');
    
    // Check if already exists
    if (fs.existsSync(fichePath)) {
      const existing = fs.readFileSync(fichePath, 'utf8');
      if (existing === fiche.content) {
        console.log(`  Skipping ${chapter.slug} (already migrated)`);
        continue;
      }
    }
    
    fs.writeFileSync(fichePath, fiche.content);
    console.log(`  Migrated: ${chapter.slug}`);
    migrated++;
  }
  
  console.log(`\nDone: ${migrated} migrated, ${skipped} skipped`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
