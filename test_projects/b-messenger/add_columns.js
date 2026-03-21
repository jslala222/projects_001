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
    `ALTER TABLE "b-messenger_users" ADD COLUMN IF NOT EXISTS plan_request TEXT`,
    `ALTER TABLE "b-messenger_users" ADD COLUMN IF NOT EXISTS depositor_name TEXT`,
    `ALTER TABLE "b-messenger_users" ADD COLUMN IF NOT EXISTS payment_status TEXT`,
    `NOTIFY pgrst, 'reload schema'`
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
      console.log(`Query: ${query.substring(0,40)}... status: ${res.status}`);
      if (!res.ok) console.log(await res.text());
    } catch (e) { console.error(e); }
  }
}
run();
