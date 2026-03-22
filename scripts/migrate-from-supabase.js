/* DEPRECATED — Supabase/Google Drive integration disabled */
/**
 * svt20-content Migration Script v5
 * 
 * Uses Supabase for structure (levels, units, titles) and SQLite for slugs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';

dotenv.config({ path: path.join(process.cwd(), '../svt20/.env') });

const CONTENT_DIR = process.cwd();
const SRC_DB = path.join(process.cwd(), '../svt20/svt.db');

// Load slug mappings from SQLite
let slugMap = new Map();
try {
  const db = new Database(SRC_DB, { readonly: true });
  const chapters = db.prepare('SELECT id, title, slug FROM chapters').all();
  chapters.forEach(c => {
    // Map chapter ID (UUID) to slug
    slugMap.set(c.id, { slug: c.slug, title: c.title });
    // Also map by title for fallback
    slugMap.set(c.title, { slug: c.slug, title: c.title });
  });
  db.close();
  console.log(`✅ Loaded ${slugMap.size} slugs from SQLite`);
} catch (e) {
  console.warn('⚠️  Could not load SQLite:', e.message);
}

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function migrate() {
  console.log('🔄 Starting migration...\n');

  // Fetch levels from Supabase
  console.log('📚 Fetching levels...');
  const { data: levels, error: levelsError } = await supabase
    .from('levels')
    .select('*')
    .order('created_at');

  if (levelsError) {
    console.error('❌ Failed to fetch levels:', levelsError.message);
    return;
  }
  console.log(`   Found ${levels.length} levels\n`);

  // Fetch units from Supabase
  console.log('📚 Fetching units...');
  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('*')
    .order('created_at');

  if (unitsError) {
    console.error('❌ Failed to fetch units:', unitsError.message);
    return;
  }
  console.log(`   Found ${units.length} units\n`);

  // Fetch chapters from Supabase
  console.log('📚 Fetching chapters...');
  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('*')
    .order('created_at');

  if (chaptersError) {
    console.error('❌ Failed to fetch chapters:', chaptersError.message);
    return;
  }
  console.log(`   Found ${chapters.length} chapters\n`);

  // Build index
  const index = {
    generated: new Date().toISOString(),
    version: 5,
    levels: [],
    exams: []
  };

  let migratedCount = 0;
  let skippedCount = 0;

  // Process each level
  for (const level of levels) {
    const levelUnits = units.filter(u => u.level_id === level.id);
    const levelSlug = slugify(level.name);
    
    await ensureDir(path.join(CONTENT_DIR, 'chapters', levelSlug));

    const levelIndex = {
      slug: levelSlug,
      name: level.name,
      title: level.title,
      units: []
    };

    for (const unit of levelUnits) {
      const unitChapters = chapters.filter(c => c.unit_id === unit.id);
      const unitSlug = slugify(unit.name);
      
      const unitDir = path.join(CONTENT_DIR, 'chapters', levelSlug, unitSlug);
      await ensureDir(unitDir);

      const unitIndex = {
        slug: unitSlug,
        name: unit.name,
        chapters: []
      };

      for (const chapter of unitChapters) {
        // Look up slug from SQLite map
        let slugInfo = slugMap.get(chapter.id);
        
        // Fallback: try title match
        if (!slugInfo && chapter.title) {
          slugInfo = slugMap.get(chapter.title);
        }
        
        // Use slug or generate from title
        const chapterSlug = slugInfo?.slug || slugify(chapter.title || 'untitled');
        const chapterTitle = chapter.title || slugInfo?.title || 'Untitled';

        // Source file is named by chapter.id (UUID)
        const sourceFile = path.join(CONTENT_DIR, 'chapters', `${chapter.id}.html`);
        
        try {
          await fs.access(sourceFile);
        } catch {
          console.log(`  ⚠️  File not found: ${sourceFile}`);
          skippedCount++;
          continue;
        }

        const content = await fs.readFile(sourceFile, 'utf-8');
        
        // Use DATABASE SLUG as filename
        const destFilename = `${chapterSlug}.html`;
        const destPath = path.join(unitDir, destFilename);

        const frontmatter = `---
id: "${chapter.id}"
slug: "${chapterSlug}"
title: "${chapterTitle}"
course: "${chapter.course || ''}"
level: "${levelSlug}"
levelName: "${level.name}"
unit: "${unitSlug}"
unitName: "${unit.name}"
type: "chapter"
---

`;

        await fs.writeFile(destPath, frontmatter + content, 'utf-8');

        unitIndex.chapters.push({
          id: chapter.id,
          slug: chapterSlug,
          title: chapterTitle,
          course: chapter.course,
          file: `${levelSlug}/${unitSlug}/${destFilename}`
        });

        migratedCount++;
        console.log(`  ✅ ${levelSlug}/${unitSlug}/${destFilename}`);
      }

      if (unitIndex.chapters.length > 0) {
        levelIndex.units.push(unitIndex);
      }
    }

    if (levelIndex.units.length > 0) {
      index.levels.push(levelIndex);
    }
  }

  // Write index.json
  console.log('\n📄 Writing index.json...');
  await fs.writeFile(
    path.join(CONTENT_DIR, 'index.json'),
    JSON.stringify(index, null, 2),
    'utf-8'
  );

  console.log('\n✅ Migration complete!');
  console.log(`   Migrated: ${migratedCount} files`);
  console.log(`   Skipped: ${skippedCount} files`);
}

function slugify(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

migrate().catch(console.error);
*/
