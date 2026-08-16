/**
 * Run Phase 2 Migration on Supabase
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://aypfkugcwxvxjmbxjfkt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cGZrdWdjd3h2eGptYnhqZmt0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQzMjA2OSwiZXhwIjoyMDk3MDA4MDY5fQ._xSGxe8YJJjyqyrM4ZXjb9BtGyu3lesVgC0tIFPWUUE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  console.log('🚀 Running Phase 2 Migration...');
  
  try {
    // Read migration file
    const sqlPath = '/home/z/my-project/upload/phase2_orders_codes_migration.sql';
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log('📄 Migration file loaded');
    console.log('⚠️  Note: Supabase JS client cannot run raw DDL. Use Supabase Dashboard or psql.');
    console.log('');
    console.log('='.repeat(60));
    console.log('MIGRATION SQL (Run manually in Supabase SQL Editor):');
    console.log('='.repeat(60));
    console.log(sqlContent);
    console.log('='.repeat(60));
    console.log('');
    console.log('📋 Steps to run migration:');
    console.log('1. Go to: https://supabase.com/dashboard/project/aypfkugcwxvxjmbxjfkt/sql');
    console.log('2. Copy and paste the SQL above');
    console.log('3. Click "Run" to execute');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

runMigration();
