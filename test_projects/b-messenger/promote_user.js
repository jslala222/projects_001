const fs = require('fs');

async function updateAdmin() {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  let supabaseUrl = '';
  let serviceKey = '';
  envContent.split('\n').forEach(line => {
    if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.trim().split('=')[1];
    }
    if (line.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      serviceKey = line.trim().split('=')[1];
    }
  });

  const email = 'jslala222@gmail.com';

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/b-messenger_users?email=eq.${email}`, {
      method: 'PATCH',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ 
        plan: 'enterprise',
        role: 'admin',
        status: 'approved' 
      })
    });
    
    if (!res.ok) {
      console.log('Error updating:', res.status, await res.text());
    } else {
      const data = await res.json();
      console.log('Update successful:', data);
    }
  } catch(e) {
    console.error('Fetch error:', e);
  }
}

updateAdmin();
