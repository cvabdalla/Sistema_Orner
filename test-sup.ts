import { supabase } from './supabaseClient';

async function test() {
  console.log("Fetching all installers from DB...");
  const { data, error } = await supabase.from('instaladores').select('*');
  if (error) {
    console.error("Error fetching:", error);
  } else {
    console.log("Installers:", JSON.stringify(data, null, 2));
  }
}

test();
