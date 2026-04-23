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
  
  // Sample definitions and flashcards per unit (simplified — can be expanded)
  const extras = getExtrasForUnit(unit);
  
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
    def_term: extras.def_term,
    def_text: extras.def_text,
    flash_front: extras.flash_front,
    flash_back: extras.flash_back,
  };
  
  // Write to daily-content.json
  fs.writeFileSync(DAILY_FILE, JSON.stringify(content, null, 2));
  console.log('✅ Written to daily-content.json');
  console.log(`🧪 Quiz: ${parsed.question}`);
  console.log(`   Answer: ${parsed.answer}`);
  
  return content;
}

function getExtrasForUnit(unit) {
  // Simple fallback extras — ideally these would come from a curated pool per unit
  const extras = {
    unit1: {
      def_term: 'Métabolisme',
      def_text: 'L\'ensemble des réactions biochimiques qui se déroulent dans une cellule vivante pour assurer sa croissance, sa maintenance et sa reproduction.',
      flash_front: 'Qu\'est-ce que la glycolyse ?',
      flash_back: 'C\'est la dégradation anaérobie du glucose en pyruvate, avec production nette de 2 ATP et 2 NADH. Elle se déroule dans le cytosol.'
    },
    unit2: {
      def_term: 'Réplication semi-conservative',
      def_text: 'Mode de réplication de l\'ADN où chaque molécule fille contient un brin parental conservé et un brin néoformé.',
      flash_front: 'Qu\'est-ce que les yeux de réplication ?',
      flash_back: 'Ce sont les zones de dédoublement de l\'hélice d\'ADN où se déroule la réplication. Ils apparaissent au cours de la phase S de l\'interphase.'
    },
    unit3: {
      def_term: 'Génotype',
      def_text: 'L\'ensemble des allèles présents dans l\'ADN d\'un individu pour un ou plusieurs gènes donnés.',
      flash_front: 'Qu\'est-ce que le brassage intrachromosomique ?',
      flash_back: 'C\'est l\'échange de fragments de chromatides entre chromosomes homologues (crossing-over) lors de la prophase I de la méiose.'
    },
    unit3sp: {
      def_term: 'Méiose',
      def_text: 'Succession de deux divisions cellulaires (réductionnelle et équationnelle) aboutissant à la formation de quatre cellules haploïdes à partir d\'une cellule diploïde.',
      flash_front: 'Qu\'est-ce que le brassage interchromosomique ?',
      flash_back: 'C\'est la séparation aléatoire des chromosomes homologues lors de l\'anaphase I, produisant 2^n combinaisons différentes.'
    },
    unit4: {
      def_term: 'Pool génique',
      def_text: 'L\'ensemble de tous les allèles présents dans une population pour un ou plusieurs gènes donnés à un moment donné.',
      flash_front: 'Qu\'est-ce que la sélection naturelle ?',
      flash_back: 'C\'est un mécanisme évolutif qui favorise la reproduction et la survie des individus les mieux adaptés à leur environnement.'
    },
    unit5: {
      def_term: 'Réponse immunitaire spécifique',
      def_text: 'Défense de l\'organisme ciblée contre un antigène particulier, impliquant les lymphocytes B et T, avec mémoire immunitaire.',
      flash_front: 'Qu\'est-ce que la mémoire immunitaire ?',
      flash_back: 'Capacité du système immunitaire à répondre plus rapidement et plus fortement lors d\'un second contact avec le même antigène.'
    },
    unit6: {
      def_term: 'Sismologie',
      def_text: 'Science qui étudie les séismes, leur origine, leur propagation et leurs effets sur les structures et l\'environnement.',
      flash_front: 'Qu\'est-ce que la croûte continentale ?',
      flash_back: 'Partie externe et rigide de la Terre, principalement granitique, qui constitue les continents. Son épaisseur moyenne est de 30-40 km.'
    }
  };
  
  return extras[unit] || extras.unit1;
}

// Run
const content = generateDailyContent();
process.exit(0);
