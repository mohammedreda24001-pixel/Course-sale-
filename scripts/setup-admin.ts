/**
 * Script to setup Admin user in Supabase
 * Run: npx tsx scripts/setup-admin.ts
 */

import { createClient } from '@supabase/supabase-js';
import { hashPassword } from '../src/lib/auth';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const SUPABASE_URL = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME?.trim() || 'admin';
const ADMIN_PASSWORD = requiredEnv('ADMIN_PASSWORD');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupAdmin() {
  console.log('🔧 Setting up Admin user...');

  const adminId = '00000000-0000-0000-0000-000000000001';
  const username = ADMIN_USERNAME;
  const password = ADMIN_PASSWORD;
  
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
