import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../svt20/.env' });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Test exact match
const unit = 'Unité 1';
const { data, error } = await supabase
  .from('examsections')
  .select('*')
  .eq('unit', unit);

console.log('Error:', error?.message || 'none');
console.log('Results for "Unité 1":', data?.length || 0);
if (data && data.length > 0) {
  console.log('First result:', data[0]);
}
