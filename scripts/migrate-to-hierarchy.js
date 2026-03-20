/**
 * svt20-content Migration Script v2
 * 
 * Migrates from flat UUID-named structure to hierarchical directory structure
 * 
 * Flat: chapters/{google-doc-id}.html
 * Hierarchical: chapters/1-bac/semestre-1/nutrition.html
 */

import fs from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';

const CONTENT_DIR = path.join(process.cwd());
const SRC_DB = path.join(CONTENT_DIR, '../svt20/svt.db');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function migrate() {
  console.log('🔄 Starting content migration (v2)...\n');

  // Load SQLite database
  let db;
  try {
    db = new Database(SRC_DB, { readonly: true });
    console.log('✅ Loaded SQLite database from svt20 app\n');
  } catch (error) {
    console.error('❌ Failed to load SQLite database:', error.message);
    console.log('   Make sure svt20/svt.db exists');
    return;
  }

  // Load sync state to map Google Doc IDs to slugs
  const syncState = await loadSyncState();
  console.log(`📋 Loaded sync state with ${Object.keys(syncState.documents).length} documents\n`);

  // Build Google Doc ID to slug mapping from sync state
  // We need to find the chapter that references each doc ID
  // The doc IDs are the filenames in the flat structure
  
  const index = {
    generated: new Date().toISOString(),
    version: 2,
    levels: [],
    exams: []
  };

  // Get all chapters from SQLite
  const chapters = db.prepare(`
    SELECT c.*, u.slug as unit_slug, u.name as unit_name, u.level_id,
           l.slug as level_slug, l.name as level_name
    FROM chapters c
    JOIN units u ON c.unit_id = u.id
    JOIN levels l ON u.level_id = l.id
    ORDER BY l.order_index, u.order_index, c.order_index
  `).all();

  console.log(`📚 Found ${chapters.length} chapters in database\n`);

  // Migrate chapters
  console.log('📚 Migrating chapters...');
  for (const chapter of chapters) {
    // Look for file with this chapter's slug or ID in the flat structure
    // Files are named with Google Doc IDs (UUIDs), we need to find the right file
    
    // Try different possible filenames
    const possibleFiles = [
      path.join(CONTENT_DIR, 'chapters', `${chapter.slug}.html`),
      path.join(CONTENT_DIR, 'chapters', `${chapter.id}.html`),
      path.join(CONTENT_DIR, 'chapters', `${chapter.course}.html`),
    ];

    let foundFile = null;
    for (const filePath of possibleFiles) {
      try {
        await fs.access(filePath);
        foundFile = filePath;
        break;
      } catch {}
    }

    // If not found, search for any file that might match
    if (!foundFile) {
      // List all files in chapters dir and try to match
      try {
        const files = await fs.readdir(path.join(CONTENT_DIR, 'chapters'));
        // Look for files with the slug in the name
        for (const file of files) {
          if (file.includes(chapter.slug.replace(/-/g, '').substring(0, 8))) {
            foundFile = path.join(CONTENT_DIR, 'chapters', file);
            break;
          }
        }
      } catch {}
    }

    if (!foundFile) {
      console.log(`  ⚠️  ${chapter.slug} (file not found)`);
      continue;
    }

    // Build directory path
    const dirPath = path.join(CONTENT_DIR, 'chapters', chapter.level_slug, chapter.unit_slug);
    await ensureDir(dirPath);

    const newFile = path.join(dirPath, `${chapter.slug}.html`);

    try {
      let content = await fs.readFile(foundFile, 'utf-8');

      // Add frontmatter
      content = addFrontmatter(content, {
        id: chapter.id,
        title: chapter.title,
        slug: chapter.slug,
        level: chapter.level_slug,
        levelName: chapter.level_name,
        unit: chapter.unit_slug,
        unitName: chapter.unit_name,
        order: chapter.order_index,
        type: 'chapter'
      });

      await fs.writeFile(newFile, content, 'utf-8');

      // Add to index
      let level = index.levels.find(l => l.slug === chapter.level_slug);
      if (!level) {
        level = {
          slug: chapter.level_slug,
          name: chapter.level_name,
          order: chapter.order_index,
          units: []
        };
        index.levels.push(level);
      }

      let unit = level.units.find(u => u.slug === chapter.unit_slug);
      if (!unit) {
        unit = {
          slug: chapter.unit_slug,
          name: chapter.unit_name,
          chapters: []
        };
        level.units.push(unit);
      }

      unit.chapters.push({
        id: chapter.id,
        slug: chapter.slug,
        title: chapter.title,
        file: `${chapter.level_slug}/${chapter.unit_slug}/${chapter.slug}.html`
      });

      console.log(`  ✅ ${chapter.slug}`);
    } catch (error) {
      console.log(`  ⚠️  ${chapter.slug} (${error.message})`);
    }
  }

  // Migrate sections
  console.log('\n📑 Migrating sections...');
  const sections = db.prepare(`
    SELECT s.*, c.slug as chapter_slug, c.unit_id,
           u.slug as unit_slug, u.level_id,
           l.slug as level_slug
    FROM sections s
    JOIN chapters c ON s.chapter_id = c.id
    JOIN units u ON c.unit_id = u.id
    JOIN levels l ON u.level_id = l.id
    ORDER BY c.order_index, s.order_index
  `).all();

  for (const section of sections) {
    if (!section.content) continue;

    const typeDir = section.type.includes('figure') ? 'figures' : 
                    section.type.includes('fiche') ? 'fiches' : 'exercises';
    const dirPath = path.join(CONTENT_DIR, 'sections', section.level_slug, section.unit_slug, section.chapter_slug, typeDir);
    await ensureDir(dirPath);

    const newFile = path.join(dirPath, `${section.id}-${section.type}.html`);

    try {
      let content = addFrontmatter(section.content, {
        id: section.id,
        title: section.title,
        type: section.type,
        chapterSlug: section.chapter_slug,
        level: section.level_slug,
        unit: section.unit_slug
      });

      await fs.writeFile(newFile, content, 'utf-8');
      console.log(`  ✅ sections/${section.chapter_slug}/${typeDir}/${section.id}`);
    } catch (error) {
      console.log(`  ⚠️  section ${section.id} (${error.message})`);
    }
  }

  // Migrate exams
  console.log('\n📋 Migrating exams...');
  const exams = db.prepare(`SELECT * FROM exams ORDER BY date DESC`).all();

  for (const exam of exams) {
    // Look for exam file
    const possibleFiles = [
      path.join(CONTENT_DIR, 'exams', `${exam.id}.html`),
      path.join(CONTENT_DIR, 'exams', `${exam.slug}.html`),
    ];

    let foundFile = null;
    for (const filePath of possibleFiles) {
      try {
        await fs.access(filePath);
        foundFile = filePath;
        break;
      } catch {}
    }

    if (!foundFile) {
      console.log(`  ⚠️  ${exam.slug} (file not found)`);
      continue;
    }

    let levelSlug = exam.slug.includes('1bac') || exam.slug.includes('1-bac') ? '1-bac' : '2-bac';
    
    const dirPath = path.join(CONTENT_DIR, 'exams', levelSlug);
    await ensureDir(dirPath);

    const newFile = path.join(dirPath, `${exam.slug}.html`);

    try {
      let content = await fs.readFile(foundFile, 'utf-8');
      content = addFrontmatter(content, {
        id: exam.id,
        name: exam.name,
        slug: exam.slug,
        date: exam.date,
        type: exam.type,
        level: levelSlug
      });

      await fs.writeFile(newFile, content, 'utf-8');

      index.exams.push({
        id: exam.id,
        name: exam.name,
        slug: exam.slug,
        date: exam.date,
        type: exam.type,
        level: levelSlug,
        file: `${levelSlug}/${exam.slug}.html`
      });

      console.log(`  ✅ exams/${exam.slug}`);
    } catch (error) {
      console.log(`  ⚠️  ${exam.slug} (${error.message})`);
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
  console.log('\n📁 New structure created:');
  console.log('   chapters/1-bac/semestre-1/chapter-name.html');
  console.log('   chapters/1-bac/semestre-2/chapter-name.html');
  console.log('   chapters/2-bac/semestre-1/chapter-name.html');
  console.log('   chapters/2-bac/semestre-2/chapter-name.html');
  console.log('\n⚠️  Review the new structure before deleting old flat files!');
}

function addFrontmatter(content, metadata) {
  const frontmatter = Object.entries(metadata)
    .map(([key, value]) => `${key}: "${value}"`)
    .join('\n');

  return `---\n${frontmatter}\n---\n\n${content}`;
}

async function loadSyncState() {
  try {
    const data = await fs.readFile(path.join(CONTENT_DIR, 'sync-state.json'), 'utf-8');
    return JSON.parse(data);
  } catch {
    return { documents: {} };
  }
}

migrate().catch(console.error);
