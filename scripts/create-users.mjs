/**
 * Creates the initial owner + supervisor accounts on your Supabase project.
 * Run ONCE after the migrations (see supabase/README.md).
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "service-role-key-from-dashboard"
 *   $env:OWNER_EMAIL = "you@example.com";        $env:OWNER_PASSWORD = "choose-a-password"
 *   $env:SUPERVISOR_EMAIL = "super@example.com"; $env:SUPERVISOR_PASSWORD = "choose-a-password"
 *   node scripts/create-users.mjs
 *
 * The service role key is server-side only — never put it in the app's .env
 * EXPO_PUBLIC_* variables and never commit it.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
  process.exit(1);
}

const users = [
  {
    email: process.env.OWNER_EMAIL,
    password: process.env.OWNER_PASSWORD,
    full_name: process.env.OWNER_NAME ?? 'Owner',
    role: 'owner',
  },
  {
    email: process.env.SUPERVISOR_EMAIL,
    password: process.env.SUPERVISOR_PASSWORD,
    full_name: process.env.SUPERVISOR_NAME ?? 'Supervisor',
    role: 'supervisor',
  },
].filter((u) => u.email && u.password);

if (users.length === 0) {
  console.error('Set OWNER_EMAIL/OWNER_PASSWORD (and optionally SUPERVISOR_*).');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const u of users) {
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    user_metadata: { full_name: u.full_name, role: u.role },
  });
  if (error) {
    console.error(`✗ ${u.role} (${u.email}): ${error.message}`);
  } else {
    console.log(`✓ ${u.role} created: ${u.email} (${data.user.id})`);
  }
}
