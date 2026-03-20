const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://jsdqmsbqtgdacccqkrjm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzZHFtc2JxdGdkYWNjY3FrcmptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTM1Mjk4MywiZXhwIjoyMDg0OTI4OTgzfQ.o3X2gwQ4THLBcJ3kktiSsoExnGj3Pp1A-xiAcIM9LbM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function setPlan(email, plan, role = 'user') {
  console.log(`Setting plan to ${plan} and role to ${role} for ${email}...`);
  const { data, error } = await supabase
    .from('b-messenger_users')
    .update({ plan: plan, role: role })
    .eq('email', email);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('✅ Success!');
  }
}

const targetEmail = 'jslala222@gmail.com';
const targetPlan = process.argv[2] || 'free';
const targetRole = process.argv[3] || 'user';

setPlan(targetEmail, targetPlan, targetRole);
