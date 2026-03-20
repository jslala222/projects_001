const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jsdqmsbqtgdacccqkrjm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzZHFtc2JxdGdkYWNjY3FrcmptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTM1Mjk4MywiZXhwIjoyMDg0OTI4OTgzfQ.o3X2gwQ4THLBcJ3kktiSsoExnGj3Pp1A-xiAcIM9LbM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function confirmUser(email) {
  console.log(`Manually confirming email for ${email}...`);
  
  // 관리자 권한(service_role)으로 auth.users 데이터 업데이트
  const { data, error } = await supabase.auth.admin.updateUserById(
    await getUserIdByEmail(email),
    { email_confirm: true }
  );

  if (error) {
    console.error('Error confirming user:', error);
  } else {
    console.log('✅ Email confirmed successfully!');
  }
}

async function getUserIdByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find(u => u.email === email);
  return user ? user.id : null;
}

const targetEmail = 'heerayun0712@gmail.com';
confirmUser(targetEmail);
