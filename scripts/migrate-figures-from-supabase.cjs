/* DEPRECATED — Supabase/Google Drive integration disabled */
#!/usr/bin/env node
/**
 * Migrate figures from Supabase to local figures.json files
 * 
 * Creates a figures.json at the unit level with structure:
 * {
 *   "chapter-slug": [{ title: "Planche 1", figureUrl: "..." }],
 *   ...
 * }
 * 
 * Run from svt20-content directory:
 *   node scripts/migrate-figures-from-supabase.cjs
 */

const fs = require('fs');
const path = require('path');

// Supabase connection - only used for this migration
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://qezkpggzsefmgfhrowmy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlemtwZ2d6c2VmbWdmaHJvd215Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NDg4MTMsImV4cCI6MjA3MDMyNDgxM30.F6zbQkWJ5pfKtPPYOf5Wir40gvuZ-qvAUu10USCh8ig'
);

// Local SQLite for title -> chapter mapping
const dbPath = path.join(__dirname, '..', '..', 'svt20', 'svt.db');
let db = null;
try {
  db = require('better-sqlite3')(dbPath);
} catch (e) {
  console.error('Could not open SQLite DB at', dbPath, '-', e.message);
  process.exit(1);
}

const CONTENT_DIR = path.join(__dirname, '..', 'chapters');

// Build title -> {slug, unit_slug, level_slug} map from local SQLite
const titleToChapter = {};
const stmt = db.prepare(`
  SELECT c.id, c.slug, c.title, u.slug as unit_slug, l.slug as level_slug
  FROM chapters c
  JOIN units u ON c.unit_id = u.id
  JOIN levels l ON u.level_id = l.id
`);
stmt.all().forEach(row => {
  titleToChapter[row.title] = row;
});
console.log(`Loaded ${Object.keys(titleToChapter).length} chapters from local SQLite`);

async function migrateFigures() {
  console.log('Fetching figure sections from Supabase...');
  const { data: figures, error } = await supabase
    .from('sections')
    .select('chapter_id, title, content, order_index')
    .eq('type', 'figure_section')
    .order('order_index');

  if (error) {
    console.error('Error fetching figures:', error);
    return;
  }
  console.log(`Found ${figures.length} figures`);

  // Get all chapters to map chapter_id -> title
  const { data: chapters } = await supabase.from('chapters').select('id, title');
  const chapterIdToTitle = {};
  chapters.forEach(c => { chapterIdToTitle[c.id] = c.title; });

  // Group figures by chapter slug (via title -> chapter mapping)
  const figuresBySlug = {};
  figures.forEach(f => {
    const title = chapterIdToTitle[f.chapter_id];
    if (!title) return;
    
    const chapterInfo = titleToChapter[title];
    if (!chapterInfo || !chapterInfo.slug) return;
    
    const { slug, unit_slug, level_slug } = chapterInfo;
    const unitFolder = unit_slug.replace(new RegExp('^' + level_slug + '-'), '');
    const folderKey = `${level_slug}/${unitFolder}`;
    
    if (!figuresBySlug[folderKey]) {
      figuresBySlug[folderKey] = {};
    }
    if (!figuresBySlug[folderKey][slug]) {
      figuresBySlug[folderKey][slug] = [];
    }
    
    // Extract image URL from content
    const imgMatch = f.content.match(/src="([^"]+)"/);
    const figureUrl = imgMatch ? imgMatch[1] : null;
    
    figuresBySlug[folderKey][slug].push({
      title: f.title,
      figureUrl: figureUrl
    });
  });

  // Write figures.json for each unit folder
  let created = 0;
  let skipped = 0;

  for (const [folderKey, chaptersData] of Object.entries(figuresBySlug)) {
    const unitPath = path.join(CONTENT_DIR, folderKey);

    if (!fs.existsSync(unitPath)) {
      console.log(`⚠ Folder not found: ${unitPath}`);
      skipped++;
      continue;
    }

    // Write figures.json
    const figuresJsonPath = path.join(unitPath, 'figures.json');
    fs.writeFileSync(figuresJsonPath, JSON.stringify(chaptersData, null, 2));
    const chapterCount = Object.keys(chaptersData).length;
    const figureCount = Object.values(chaptersData).flat().length;
    console.log(`✓ Created ${figuresJsonPath} (${chapterCount} chapters, ${figureCount} figures)`);
    created++;
  }

  console.log(`\nDone! Created ${created} figures.json files, skipped ${skipped}`);
  db.close();
}

migrateFigures().catch(e => { console.error(e); db?.close(); });
*/
