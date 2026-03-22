#!/usr/bin/env node
/**
 * Build exam_exercise_units table in SQLite from Supabase data.
 *
 * Fetches exam sections from Supabase (which have unit info),
 * joins with local exams/index.json to get paths,
 * and inserts into SQLite.
 *
 * Run: node scripts/build-exam-exercise-units.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ROOT_SVT20 = '/home/medmor/Documents/Projects/svt/svt20';
const DB_PATH = path.join(ROOT_SVT20, 'svt.db');

const supabase = createClient(
  'https://qezkpggzsefmgfhrowmy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlemtwZ2d6c2VmbWdmaHJvd215Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NDg4MTMsImV4cCI6MjA3MDMyNDgxM30.F6zbQkWJ5pfKtPPYOf5Wir40gvuZ-qvAUu10USCh8ig'
);

async function main() {
  // Load local exams index to map examId → path
  const indexPath = path.join(ROOT, 'exams', 'index.json');
  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const examById = new Map(indexData.exams.map(e => [e.id, e]));

  // Fetch all exam sections from Supabase (only the ones with content = exercise)
  const { data: sections, error } = await supabase
    .from('examsections')
    .select('id, examid, unit, title')
    .not('content', 'is', null)
    .not('content', 'eq', '');

  if (error) throw error;
  console.log(`Fetched ${sections.length} sections from Supabase`);

  // Load SQLite
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);

  // Clear existing data and recreate table
  db.exec('DROP TABLE IF EXISTS exam_exercise_units');
  db.exec(`
    CREATE TABLE exam_exercise_units (
      id         TEXT NOT NULL,
      exam_slug  TEXT NOT NULL,
      path       TEXT NOT NULL,
      title      TEXT,
      unit       TEXT NOT NULL,
      unit_slug  TEXT NOT NULL,
      branch     TEXT,
      year       INTEGER,
      PRIMARY KEY (id, unit_slug)
    )
  `);

  // Insert
  const insert = db.prepare(`
    INSERT INTO exam_exercise_units (id, exam_slug, path, title, unit, unit_slug, branch, year)
    VALUES (@id, @exam_slug, @path, @title, @unit, @unit_slug, @branch, @year)
  `);

  const insertMany = db.transaction((sections) => {
    for (const s of sections) {
      const exam = examById.get(s.examid);
      if (!exam) continue; // skip if exam not in local index

      // Parse units — can be "Unité 1" or "Unité 2, Unité 3"
      const unitNames = (s.unit || '')
        .split(',')
        .map(u => u.trim())
        .filter(Boolean);

      for (const unitName of unitNames) {
        const unitNum = unitName.match(/Unité\s*(\d+)/i)?.[1];
        if (!unitNum) continue;

        const unitSlug = `2-bac-unit-${unitNum}`;
        const title = s.title || 'Exercice';

        insert.run({
          id: s.id,
          exam_slug: exam.slug,
          path: exam.path,
          title,
          unit: unitName,
          unit_slug: unitSlug,
          branch: exam.branch || null,
          year: exam.year || null,
        });
      }
    }
  });

  insertMany(sections);

  const count = db.prepare('SELECT COUNT(*) as c FROM exam_exercise_units').get();
  console.log(`Inserted ${count.c} rows into exam_exercise_units`);
  console.log(`Sample:`);
  const sample = db.prepare('SELECT * FROM exam_exercise_units LIMIT 5').all();
  console.log(JSON.stringify(sample, null, 2));

  db.close();
}

main().catch(console.error);
