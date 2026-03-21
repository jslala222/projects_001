require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addSubscriptionEndDate() {
  const { data, error } = await supabase.rpc('run_sql', {
    sql_query: `
      ALTER TABLE "b-messenger_users" ADD COLUMN IF NOT EXISTS "subscription_end_date" TIMESTAMP WITH TIME ZONE;
    `
  });
  if (error) {
    if (error.message.includes('function "run_sql" does not exist')) {
      // Fallback: Use postgrest api but we cannot alter table. We have to instruct user to run SQL.
      console.error("SQL 쿼리를 실행할 수 없습니다. 수동으로 ALTER TABLE b-messenger_users ADD COLUMN subscription_end_date TIMESTAMP WITH TIME ZONE; 를 실행해주세요.");
      return;
    }
    console.error("SQL Error:", error);
  } else {
    console.log("subscription_end_date 필드 추가 완료!");
  }
}
addSubscriptionEndDate();
