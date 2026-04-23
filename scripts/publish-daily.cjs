#!/usr/bin/env node
/**
 * SVT20 Daily Content Publisher
 * Runs generate-daily-content.cjs then commits & pushes
 */
const { execSync } = require('child_process');
const path = require('path');

const BASE_DIR = '/home/medmor/Documents/Projects/svt/svt20-content';
const SCRIPT = path.join(BASE_DIR, 'scripts', 'generate-daily-content.cjs');

// Step 1: Generate
console.log('🎲 Generating daily content...');
execSync(`node "${SCRIPT}"`, { cwd: BASE_DIR, stdio: 'inherit' });

// Step 2: Copy to history
const today = new Date().toISOString().split('T')[0];
execSync(`cp daily-content.json "daily-content-history/${today}.json"`, { cwd: BASE_DIR });

// Step 3: Git push
console.log('📤 Pushing to GitHub...');
execSync('git add -A && git commit -m "Daily content for ' + today + '" && git push origin main', { cwd: BASE_DIR, stdio: 'inherit' });

console.log('✅ Published!');
