import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function testAdminQuery() {
  console.log('🔍 Testing Supabase feedbacks select query...\n');

  try {
    const { data, error } = await supabase.from('feedbacks').select(`
      *,
      department_name:departments(name),
      category_name:categories(name),
      responder_name:users(full_name)
    `);

    if (error) {
      console.error('❌ Supabase Query Error:', error);
      return;
    }

    console.log(`📦 Returned ${data?.length || 0} feedbacks:`);
    if (data && data.length > 0) {
      console.log('First item sample:', JSON.stringify(data[0], null, 2));
    }
  } catch (err: any) {
    console.error('❌ Exception:', err?.message || err);
  }
}

testAdminQuery();
