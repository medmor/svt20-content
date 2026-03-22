#!/usr/bin/env node
/**
 * Build exam_exercise_units table in SQLite from Supabase data.
 *
 * Fetches exam sections from Supabase (which have unit info),
 * joins with local exams/index.json to get paths,
 * then fetches each exam's index.json to match titles → exercise slugs.
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

function normalizeTitle(title) {
  if (!title) return '';
  return title.toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/pts?\b/g, 'points')
    .replace(/[‑—]/g, '-')
    .replace(/'/g, "'")
    .trim();
}

async function fetchExamIndex(examSlug) {
  // Get exam path from local index
  const indexPath = path.join(ROOT, 'exams', 'index.json');
  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const exam = indexData.exams.find(e => e.slug === examSlug);
  if (!exam) return null;

  const indexUrl = `http://localhost:4001/exams/${exam.path}/index.json`;
  try {
    const res = await fetch(indexUrl);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function main() {
  // Load local exams index to map examId → exam info
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

  // Group sections by exam_slug to batch-fetch indexes
  const sectionsByExam = new Map();
  for (const s of sections) {
    const exam = examById.get(s.examid);
    if (!exam) continue;
    if (!sectionsByExam.has(exam.slug)) {
      sectionsByExam.set(exam.slug, []);
    }
    sectionsByExam.get(exam.slug).push({ ...s, exam });
  }

  // Fetch exam indexes and build a title→slug map for each exam
  console.log(`Fetching ${sectionsByExam.size} exam indexes...`);
  const examIndexes = new Map();
  for (const [examSlug] of sectionsByExam) {
    const idx = await fetchExamIndex(examSlug);
    if (idx?.exercises) {
      // Build title normalization map
      const titleMap = new Map();
      for (const ex of idx.exercises) {
        const normalized = normalizeTitle(ex.title);
        if (normalized) titleMap.set(normalized, ex.slug);
      }
      examIndexes.set(examSlug, titleMap);
    }
  }

  // Load SQLite
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);

  // Clear existing data and recreate table with exercise_slug column
  db.exec('DROP TABLE IF EXISTS exam_exercise_units');
  db.exec(`
    CREATE TABLE exam_exercise_units (
      id             TEXT NOT NULL,
      exam_slug      TEXT NOT NULL,
      path           TEXT NOT NULL,
      title          TEXT,
      unit           TEXT NOT NULL,
      unit_slug      TEXT NOT NULL,
      branch         TEXT,
      year           INTEGER,
      exercise_slug  TEXT,
      PRIMARY KEY (id, unit_slug)
    )
  `);

  // Insert
  const insert = db.prepare(`
    INSERT INTO exam_exercise_units (id, exam_slug, path, title, unit, unit_slug, branch, year, exercise_slug)
    VALUES (@id, @exam_slug, @path, @title, @unit, @unit_slug, @branch, @year, @exercise_slug)
  `);

  let inserted = 0;
  const insertMany = db.transaction((sectionsByExam) => {
    for (const [examSlug, sectionList] of sectionsByExam) {
      const titleMap = examIndexes.get(examSlug) || new Map();
      const normalizedSectionTitles = new Map(); // Track normalized titles for fuzzy matching

      for (const s of sectionList) {
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

          // Try to find matching exercise slug by normalized title
          const normalizedTitle = normalizeTitle(title);
          let exerciseSlug = titleMap.get(normalizedTitle) || null;

          // Fuzzy match: if exact match failed, try partial match
          if (!exerciseSlug) {
            for (const [normalizedExamTitle, slug] of titleMap) {
              if (normalizedExamTitle.includes(normalizedTitle) ||
                  normalizedTitle.includes(normalizedExamTitle)) {
                exerciseSlug = slug;
                break;
              }
            }
          }

          insert.run({
            id: s.id,
            exam_slug: examSlug,
            path: s.exam.path,
            title,
            unit: unitName,
            unit_slug: unitSlug,
            branch: s.exam.branch || null,
            year: s.exam.year || null,
            exercise_slug: exerciseSlug,
          });
          inserted++;
        }
      }
    }
  });

  insertMany(sectionsByExam);

  const count = db.prepare('SELECT COUNT(*) as c FROM exam_exercise_units').get();
  console.log(`Inserted ${count.c} rows into exam_exercise_units`);
  console.log(`Rows with exercise_slug: ${db.prepare("SELECT COUNT(*) as c FROM exam_exercise_units WHERE exercise_slug IS NOT NULL").get().c}`);
  console.log(`Sample:`);
  const sample = db.prepare('SELECT * FROM exam_exercise_units LIMIT 5').all();
  console.log(JSON.stringify(sample, null, 2));

  db.close();
}

main().catch(console.error);
