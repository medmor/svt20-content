/**
 * Generate exams index.json from Supabase
 * 
 * Creates exam objects with proper metadata for svt20 examContent.js
 * 
 * Structure:
 * exams/{year}/{branch}/{session}/index.json
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '../svt20/.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const EXAMS_DIR = path.join(process.cwd(), 'exams');

async function generateIndex() {
  console.log('Fetching exams from Supabase...\n');

  const { data: exams, error } = await supabase
    .from('exams')
    .select('*')
    .order('date');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log(`Found ${exams.length} exams\n`);

  const examList = exams.map(exam => {
    const year = exam.date?.split('-')[0];
    const branch = exam.branch?.toLowerCase();
    const session = exam.session?.toLowerCase() === 'normale' ? 'normale' : 'rattrapage';
    const slug = `${year}-${branch}-${session}`;
    const path = `${year}/${exam.branch}/${session}`; // e.g., "2024/SM/normale"
    
    return {
      id: exam.id,
      slug,
      path,
      year: parseInt(year),
      branch: exam.branch,
      branchLower: branch,
      session: exam.session,
      sessionLower: session,
      date: exam.date,
      duration: exam.duration,
      image: exam.image,
      level: '2-bac',
      levelName: '2 Bac'
    };
  });

  const index = {
    generated: new Date().toISOString(),
    version: 2,
    exams: examList
  };

  await fs.writeFile(
    path.join(EXAMS_DIR, 'index.json'),
    JSON.stringify(index, null, 2),
    'utf-8'
  );

  console.log('Generated exams/index.json');
  console.log(`Total exams: ${index.exams.length}`);
  
  const byYear = {};
  index.exams.forEach(e => {
    if (!byYear[e.year]) byYear[e.year] = [];
    byYear[e.year].push(e.branch);
  });
  
  console.log('\nBy year:');
  Object.keys(byYear).sort().forEach(year => {
    console.log(`   ${year}: ${byYear[year].length} branches`);
  });
}

generateIndex().catch(console.error);
