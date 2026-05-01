#!/usr/bin/env node
/**
 * SVT20 Daily Content Generator with Deduplication
 * Reads quiz files, checks history, picks unique question, publishes to daily-content.json
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = '/home/medmor/Documents/Projects/svt/svt20-content';
const HISTORY_DIR = path.join(BASE_DIR, 'daily-content-history');
const DAILY_FILE = path.join(BASE_DIR, 'daily-content.json');
const DAYS_BACK = 30;

// Unit rotation by day of week
const UNIT_BY_DAY = {
  0: 'unit6',   // Sunday
  1: 'unit1',   // Monday
  2: 'unit2',   // Tuesday
  3: 'unit3',   // Wednesday
  4: 'unit3sp', // Thursday
  5: 'unit4',   // Friday
  6: 'unit5',   // Saturday
};

function loadHistory(daysBack) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  
  const questions = new Set();
  if (!fs.existsSync(HISTORY_DIR)) return questions;
  
  const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const fileDate = new Date(file.replace('.json', ''));
    if (isNaN(fileDate.getTime()) || fileDate < cutoff) continue;
    
    try {
      const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, file), 'utf8'));
      if (data.quiz_question) questions.add(data.quiz_question.trim());
    } catch (e) {
      // skip malformed
    }
  }
  return questions;
}

function loadQuizzes(unit) {
  const quizDir = path.join(BASE_DIR, 'quizzes', '2bac', unit);
  if (!fs.existsSync(quizDir)) return [];
  
  const quizzes = [];
  const files = fs.readdirSync(quizDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(quizDir, file), 'utf8'));
      for (const q of data) {
        if (q.type === 'mcq') {
          quizzes.push({ ...q, source: file });
        }
      }
    } catch (e) {
      // skip malformed
    }
  }
  return quizzes;
}

function parseMCQ(q) {
  // Format: "question;@-@choice1;@-@choice2 Answer;@-@choice3;@-@choice4;@-@"
  const parts = q.choices.split(/@-\s*@/g).filter(s => s.trim());
  
  const choices = [];
  let answer = null;
  
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.endsWith(' Answer')) {
      const text = trimmed.replace(/\s*Answer\s*$/, '');
      choices.push(text);
      answer = text;
    } else {
      choices.push(trimmed);
    }
  }
  
  if (choices.length < 2) return null;
  if (!answer) answer = choices[0];
  
  return {
    question: q.question.trim(),
    option_a: choices[0] || '',
    option_b: choices[1] || '',
    option_c: choices[2] || '',
    option_d: choices[3] || '',
    answer: answer,
  };
}

function generateDailyContent() {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  const unit = UNIT_BY_DAY[today.getDay()];
  
  console.log(`Generating content for ${dateStr} → Unit: ${unit}`);
  
  const history = loadHistory(DAYS_BACK);
  console.log(`History size (last ${DAYS_BACK} days): ${history.size} questions`);
  
  const quizzes = loadQuizzes(unit);
  console.log(`Loaded ${quizzes.length} MCQs from unit ${unit}`);
  
  // Filter out duplicates
  const available = quizzes.filter(q => !history.has(q.question.trim()));
  console.log(`Available (not in history): ${available.length}`);
  
  if (available.length === 0) {
    console.error('No unique questions available! All used in last 30 days.');
    process.exit(1);
  }
  
  // Pick random
  const pick = available[Math.floor(Math.random() * available.length)];
  const parsed = parseMCQ(pick);
  
  if (!parsed) {
    console.error('Failed to parse selected quiz');
    process.exit(1);
  }
  
  // Only write quiz data — def/flash are filled by the AI agent from chapter content
  const content = {
    date: dateStr,
    quiz_level: '2bac',
    quiz_unit: unit,
    quiz_question: parsed.question,
    quiz_option_a: parsed.option_a,
    quiz_option_b: parsed.option_b,
    quiz_option_c: parsed.option_c,
    quiz_option_d: parsed.option_d,
    quiz_answer: parsed.answer,
    def_term: '',
    def_text: '',
    flash_front: '',
    flash_back: '',
  };
  
  // Write to daily-content.json
  fs.writeFileSync(DAILY_FILE, JSON.stringify(content, null, 2));
  console.log('✅ Written to daily-content.json');
  console.log(`🧪 Quiz: ${parsed.question}`);
  console.log(`   Answer: ${parsed.answer}`);
  
  return content;
}

// Run
const content = generateDailyContent();
process.exit(0);
