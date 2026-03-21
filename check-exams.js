import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../svt20/.env' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { data, error } = await supabase.from('examsections').select('unit').limit(10);
console.log('Error:', error?.message || 'none');
const units = [...new Set((data || []).map(e => e.unit))];
console.log('Unique units:', units);
console.log('Sample record:', data?.[0]);
