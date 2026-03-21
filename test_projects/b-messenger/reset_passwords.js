const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function resetPasswords() {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  let supabaseUrl = '';
  let serviceKey = '';
  envContent.split('\n').forEach(line => {
    if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.trim().split('=')[1];
    if (line.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceKey = line.trim().split('=')[1];
  });

  const supabase = createClient(supabaseUrl, serviceKey);

  const emails = ['test@test.com', 'admin@b-messenger.com'];
  
  for (const email of emails) {
    const { data: user, error } = await supabase
      .from('b-messenger_users')
      .select('id')
      .eq('email', email)
      .single();

    if (error || !user) {
      console.log(`❌ ${email} 사용자를 DB에서 찾을 수 없습니다.`);
      continue;
    }

    // Auth 비밀번호 초기화 (Supabase Admin API)
    const { error: authError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: '111111' }
    );

    if (authError) {
      console.log(`❌ ${email} 비밀번호 설정 실패:`, authError.message);
    } else {
      console.log(`✅ ${email} 계정의 비밀번호가 '111111' 로 초기화되었습니다.`);
    }
  }
}

resetPasswords();
