/**
 * svt20-content Migration Script v4
 * 
 * Fetches structure from Supabase (real schema) and reorganizes flat HTML files
 * into hierarchical structure: levels > units > chapters
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '../svt20/.env') });

const CONTENT_DIR = process.cwd();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
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

async function migrate() {
  console.log('🔄 Starting migration from Supabase...\n');

  // Fetch all levels
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

  // Fetch all units
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

  // Fetch all chapters
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
    version: 4,
    levels: [],
    exams: []
  };

  let migratedCount = 0;
  let skippedCount = 0;

  // Process each level
  for (const level of levels) {
    const levelUnits = units.filter(u => u.level_id === level.id);
    const levelSlug = slugify(level.name);
    
    // Create level directory
    await ensureDir(path.join(CONTENT_DIR, 'chapters', levelSlug));

    // Add to index
    const levelIndex = {
      slug: levelSlug,
      name: level.name,
      title: level.title,
      units: []
    };

    for (const unit of levelUnits) {
      const unitChapters = chapters.filter(c => c.unit_id === unit.id);
      const unitSlug = slugify(unit.name);
      
      // Create unit directory
      const unitDir = path.join(CONTENT_DIR, 'chapters', levelSlug, unitSlug);
      await ensureDir(unitDir);

      // Add to index
      const unitIndex = {
        slug: unitSlug,
        name: unit.name,
        chapters: []
      };

      for (const chapter of unitChapters) {
        // The chapter.id (UUID) matches the filename in flat structure
        // Files are named: {id}.html
        let sourceFile = null;
        
        if (chapter.id) {
          sourceFile = path.join(CONTENT_DIR, 'chapters', `${chapter.id}.html`);
          try {
            await fs.access(sourceFile);
          } catch {
            sourceFile = null;
          }
        }

        if (!sourceFile) {
          console.log(`  ⚠️  "${chapter.title}" - file not found (id: ${chapter.id})`);
          skippedCount++;
          continue;
        }

        // Read content
        const content = await fs.readFile(sourceFile, 'utf-8');

        // Create destination filename (slugified title)
        const destFilename = `${slugify(chapter.title)}.html`;
        const destPath = path.join(unitDir, destFilename);

        // Add frontmatter
        const frontmatter = `---
id: "${chapter.id}"
title: "${chapter.title || ''}"
course: "${chapter.course || ''}"
level: "${levelSlug}"
levelName: "${level.name}"
unit: "${unitSlug}"
unitName: "${unit.name}"
type: "chapter"
---

`;

        const newContent = frontmatter + content;

        // Write to new location
        await fs.writeFile(destPath, newContent, 'utf-8');

        // Add to index
        unitIndex.chapters.push({
          id: chapter.id,
          title: chapter.title,
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
  console.log('\n📁 Structure created:');
  console.log('   chapters/tc/*.html');
  console.log('   chapters/1-bac/*.html');
  console.log('   chapters/2-bac/*.html');
  console.log('\n⚠️  Review and delete old flat files manually!');
}

// Run
migrate().catch(console.error);
