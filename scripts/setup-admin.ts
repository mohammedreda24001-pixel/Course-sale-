/**
 * Script to setup Admin user in Supabase
 * Run: npx tsx scripts/setup-admin.ts
 */

import { createClient } from '@supabase/supabase-js';
import { hashPassword } from '../src/lib/auth';

const SUPABASE_URL = 'https://aypfkugcwxvxjmbxjfkt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cGZrdWdjd3h2eGptYnhqZmt0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQzMjA2OSwiZXhwIjoyMDk3MDA4MDY5fQ._xSGxe8YJJjyqyrM4ZXjb9BtGyu3lesVgC0tIFPWUUE';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupAdmin() {
  console.log('🔧 Setting up Admin user...');

  const adminId = '00000000-0000-0000-0000-000000000001';
  const username = 'admin';
  const password = 'admin123'; // Default password - CHANGE IN PRODUCTION!
  
  // Hash the password
  const passwordHash = await hashPassword(password);
  console.log('✅ Password hashed successfully');

  try {
    // Check if admin exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username)
      .single();

    if (existingUser) {
      // Update existing admin password
      console.log('📝 Admin user found, updating password...');
      const { error: updateError } = await supabase
        .from('users')
        .update({ passwordHash })
        .eq('username', username);

      if (updateError) throw updateError;
      console.log('✅ Admin password updated!');
    } else {
      // Create new admin
      console.log('➕ Creating new admin user...');
      const { error: insertError } = await supabase
        .from('users')
        .insert([{
          id: adminId,
          username,
          passwordHash,
          role: 'admin'
        }]);

      if (insertError) throw insertError;
      console.log('✅ Admin user created!');
    }

    // Verify the user
    const { data: verifyUser } = await supabase
      .from('users')
      .select('id, username, role')
      .eq('username', username)
      .single();

    console.log('\n' + '='.repeat(50));
    console.log('🎉 ADMIN SETUP COMPLETE!');
    console.log('='.repeat(50));
    console.log(`👤 Username: ${verifyUser?.username}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`🎭 Role: ${verifyUser?.role}`);
    console.log(`🆔 ID: ${verifyUser?.id}`);
    console.log('='.repeat(50));
    console.log('\n⚠️  Please change this password after first login!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

setupAdmin();
