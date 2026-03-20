/**
 * svt20-content Migration Script
 * 
 * Migrates from flat structure to hierarchical directory structure
 * 
 * Before:
 *   chapters/abc123.html (flat)
 *   exercises/xyz789.html (flat)
 * 
 * After:
 *   chapters/1-bac/semestre-1/nutrition.html (hierarchical)
 *   index.json (lookup table)
 */

import fs from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';

const CONTENT_DIR = path.join(process.cwd());
const SRC_DB = path.join(CONTENT_DIR, '../svt20/svt.db'); // SQLite from svt20 app
const chaptersDir = path.join(CONTENT_DIR, 'chapters');
const exercisesDir = path.join(CONTENT_DIR, 'exercises');
const examsDir = path.join(CONTENT_DIR, 'exams');
const sectionsDir = path.join(CONTENT_DIR, 'sections');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function migrate() {
  console.log('🔄 Starting content migration...\n');

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

  // Build index structure
  const index = {
    generated: new Date().toISOString(),
    levels: [],
    exams: []
  };

  // Migrate chapters
  console.log('📚 Migrating chapters...');
  await migrateChapters(db, index);

  // Migrate sections
  console.log('\n📑 Migrating sections...');
  await migrateSections(db, index);

  // Migrate exercises
  console.log('\n📝 Migrating exercises...');
  await migrateExercises(db, index);

  // Migrate exams
  console.log('\n📋 Migrating exams...');
  await migrateExams(db, index);

  // Write index.json
  console.log('\n📄 Writing index.json...');
  await fs.writeFile(
    path.join(CONTENT_DIR, 'index.json'),
    JSON.stringify(index, null, 2),
    'utf-8'
  );

  // Cleanup empty folders in old structure
  console.log('\n🧹 Cleaning up old flat folders...');
  await cleanupOldFolders();

  console.log('\n✅ Migration complete!');
  console.log('   - New structure created in svt20-content/');
  console.log('   - index.json generated for lookup');
  console.log('   - Old flat files kept for reference (can be deleted after review)');
}

// ==================== CHAPTERS ====================
async function migrateChapters(db, index) {
  const chapters = db.prepare(`
    SELECT c.*, u.slug as unit_slug, u.name as unit_name, u.level_id,
           l.slug as level_slug, l.name as level_name
    FROM chapters c
    JOIN units u ON c.unit_id = u.id
    JOIN levels l ON u.level_id = l.id
    ORDER BY l.order_index, u.order_index, c.order_index
  `).all();

  for (const chapter of chapters) {
    // Build directory path: chapters/1-bac/semestre-1/
    const dirPath = path.join(chaptersDir, chapter.level_slug, chapter.unit_slug);
    await ensureDir(dirPath);

    // Source file: old flat structure
    const oldFile = path.join(chaptersDir, `${chapter.id}.html`);
    const newFile = path.join(dirPath, `${chapter.slug}.html`);

    try {
      // Read old file content
      let content = await fs.readFile(oldFile, 'utf-8');

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

      // Write new file
      await fs.writeFile(newFile, content, 'utf-8');

      // Add to index
      const level = index.levels.find(l => l.slug === chapter.level_slug);
      if (!level) {
        index.levels.push({
          slug: chapter.level_slug,
          name: chapter.level_name,
          order: chapter.order_index,
          units: []
        });
      }
      
      const levelIndex = index.levels.find(l => l.slug === chapter.level_slug);
      let unit = levelIndex.units.find(u => u.slug === chapter.unit_slug);
      if (!unit) {
        levelIndex.units.push({
          slug: chapter.unit_slug,
          name: chapter.unit_name,
          chapters: []
        });
      }
      
      unit = levelIndex.units.find(u => u.slug === chapter.unit_slug);
      unit.chapters.push({
        id: chapter.id,
        slug: chapter.slug,
        title: chapter.title,
        file: `${chapter.level_slug}/${chapter.unit_slug}/${chapter.slug}.html`
      });

      console.log(`  ✅ ${chapter.slug}`);
    } catch (error) {
      console.log(`  ⚠️  ${chapter.slug} (${error.code})`);
    }
  }
}

// ==================== SECTIONS ====================
async function migrateSections(db, index) {
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

    // Build directory: sections/1-bac/semestre-1/nutrition/figures/
    const typeDir = section.type.includes('figure') ? 'figures' : 
                    section.type.includes('fiche') ? 'fiches' : 'exercises';
    const dirPath = path.join(sectionsDir, section.level_slug, section.unit_slug, section.chapter_slug, typeDir);
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
      console.log(`  ✅ ${section.chapter_slug}/${typeDir}/${section.id}`);
    } catch (error) {
      console.log(`  ⚠️  ${section.id} (${error.code})`);
    }
  }
}

// ==================== EXERCISES ====================
async function migrateExercises(db, index) {
  // Exercises are linked via chapters - get chapters with exercise data
  const chapters = db.prepare(`
    SELECT c.slug as chapter_slug, c.id as chapter_id, c.exercises as exercise_folder,
           u.slug as unit_slug, u.level_id,
           l.slug as level_slug
    FROM chapters c
    JOIN units u ON c.unit_id = u.id
    JOIN levels l ON u.level_id = l.id
    WHERE c.exercises IS NOT NULL
  `).all();

  // Read exercises from flat folder and reorganize
  try {
    const files = await fs.readdir(exercisesDir);
    
    for (const file of files) {
      if (!file.endsWith('.html')) continue;
      
      // Try to find which chapter this belongs to
      const content = await fs.readFile(path.join(exercisesDir, file), 'utf-8');
      const chapterMatch = content.match(/data-chapter-id="(\d+)"/) || [];
      const chapterId = chapterMatch[1];

      if (chapterId) {
        const chapter = chapters.find(c => c.chapter_id === parseInt(chapterId));
        if (chapter) {
          const dirPath = path.join(exercisesDir, chapter.level_slug, chapter.unit_slug, chapter.chapter_slug);
          await ensureDir(dirPath);
          
          const newFile = path.join(dirPath, file);
          await fs.writeFile(newFile, content, 'utf-8');
          console.log(`  ✅ exercises/${chapter.level_slug}/${chapter.unit_slug}/${file}`);
        }
      }
    }
  } catch (error) {
    console.log(`  ⚠️  ${error.message}`);
  }
}

// ==================== EXAMS ====================
async function migrateExams(db, index) {
  const exams = db.prepare(`
    SELECT e.*, es.unit
    FROM exams e
    LEFT JOIN exam_sections es ON e.id = es.exam_id
    GROUP BY e.id
    ORDER BY e.date DESC
  `).all();

  for (const exam of exams) {
    // Determine level from unit name
    let levelSlug = '2-bac'; // default
    if (exam.unit && exam.unit.includes('1')) levelSlug = '1-bac';
    
    const dirPath = path.join(examsDir, levelSlug);
    await ensureDir(dirPath);

    const oldFile = path.join(examsDir, `${exam.id}.html`);
    const newFile = path.join(dirPath, `${exam.slug}.html`);

    try {
      let content;
      try {
        content = await fs.readFile(oldFile, 'utf-8');
      } catch {
        // Try Google Drive format
        const gdocFile = path.join(examsDir, `gdoc_${exam.slug}.html`);
        content = await fs.readFile(gdocFile, 'utf-8');
      }

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
      console.log(`  ⚠️  ${exam.slug} (${error.code})`);
    }
  }
}

// ==================== HELPERS ====================
function addFrontmatter(content, metadata) {
  const frontmatter = Object.entries(metadata)
    .map(([key, value]) => `${key}: "${value}"`)
    .join('\n');

  return `---\n${frontmatter}\n---\n\n${content}`;
}

async function cleanupOldFolders() {
  // This keeps old files but could delete them after review
  // For now, just report what could be cleaned
  console.log('  ℹ️  Old files kept for review. Delete manually after verification.');
  console.log('  ℹ️  Files to review:');
  console.log('      - chapters/*.html (old flat files)');
  console.log('      - exercises/*.html (old flat files)');
  console.log('      - exams/*.html (old flat files)');
}

// Run migration
migrate().catch(console.error);
