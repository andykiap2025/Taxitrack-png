/**
 * Creates the initial owner + supervisor accounts on your Supabase project.
 * Run ONCE after the migrations (see supabase/README.md).
 *
 * Talks to the Supabase Auth admin REST API directly with fetch, so it
 * runs on any Node ≥ 18 with no extra packages.
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

const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
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

let failures = 0;

for (const u of users) {
  try {
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: { full_name: u.full_name, role: u.role },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`✓ ${u.role} created: ${u.email} (${body.id ?? 'ok'})`);
    } else {
      const msg = body.msg ?? body.message ?? body.error_description ?? JSON.stringify(body);
      console.error(`✗ ${u.role} (${u.email}): ${msg}`);
      failures++;
    }
  } catch (err) {
    console.error(`✗ ${u.role} (${u.email}): ${err.message}`);
    failures++;
  }
}

process.exit(failures > 0 ? 1 : 0);
