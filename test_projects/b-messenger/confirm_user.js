const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

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

const supabase = createClient(supabaseUrl, serviceKey);

async function confirmEmail() {
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) throw error;
    
    const targetUser = users.find(u => u.email === 'jslala222@gmail.com');
    if (targetUser) {
      const { data, error: updateError } = await supabase.auth.admin.updateUserById(
        targetUser.id,
        { email_confirm: true }
      );
      if (updateError) {
        console.error('Update failed:', updateError.message);
      } else {
        console.log('✅ Email confirmed securely for:', data.user.email);
      }
    } else {
      console.log('User not found in Auth system.');
    }
  } catch (err) {
    console.error('Script Error:', err);
  }
}

confirmEmail();
