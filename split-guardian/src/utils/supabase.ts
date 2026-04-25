import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jkzxyfqmygmedohegobp.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprenh5ZnFteWdtZWRvaGVnb2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTg2NTcsImV4cCI6MjA5MjYzNDY1N30.S3LZ5GIe27dvghURloAjFnmIx0Wuhlxc6KkE-_18qOk';

// We use the anon key for simplicity, assuming RLS is disabled for this internal dashboard
// In production, we'd use a service role key for the cron job, but we'll stick to this for the MVP.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
