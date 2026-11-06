
import { supabase } from './lib/supabase.js';

async function testConnection() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id')
    .limit(1);

  if (error) {
    console.error('Connection failed:', error.message);
    return;
  }

  console.log('Supabase connected successfully!');
  console.log('Subscriptions:', data);
}

testConnection();
