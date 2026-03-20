const fs = require('fs');

async function run() {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  let supabaseUrl = '';
  let serviceKey = '';
  envContent.split('\n').forEach(line => {
    if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.trim().split('=')[1];
    if (line.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceKey = line.trim().split('=')[1];
  });

  const queries = [
    `ALTER TABLE "b-messenger_users" ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'`,
    `ALTER TABLE "b-messenger_users" ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'`,
    `ALTER TABLE "b-messenger_users" ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT ''`,
    `UPDATE "b-messenger_users" SET role='admin', status='approved' WHERE email='jslala222@gmail.com'`
  ];

  for (let query of queries) {
    try {
      const res = await fetch(`${supabaseUrl}/pg/query`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({ query })
      });
      console.log(`Query: ${query.substring(0,30)}... status: ${res.status}`);
      if (!res.ok) console.log(await res.text());
    } catch (e) { console.error(e); }
  }
}
run();
