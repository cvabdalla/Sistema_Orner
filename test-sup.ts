import { supabase } from './supabaseClient';

async function test() {
  console.log("=== Testing manutencoes table ===");
  
  // Try to fetch
  console.log("1. Fetching from manutencoes...");
  const { data: selectData, error: selectError } = await supabase.from('manutencoes').select('*').limit(1);
  if (selectError) {
    console.error("Fetch Error:", selectError);
  } else {
    console.log("Fetch Success, records found:", selectData?.length);
  }

  // Try to insert
  console.log("2. Inserting a dummy record into manutencoes...");
  const dummyId = "test_maint_" + Math.random().toString(36).substring(2, 9);
  const { data: insertData, error: insertError } = await supabase.from('manutencoes').insert({
    id: dummyId,
    owner_id: "00000000-0000-0000-0000-000000000000",
    clientName: "Test Client",
    title: "Test Title",
    status: "Especulação"
  }).select();

  if (insertError) {
    console.error("Insert Error:", insertError);
  } else {
    console.log("Insert Success! Row inserted:", insertData);
    
    // Clean up
    console.log("3. Cleaning up test record...");
    const { error: deleteError } = await supabase.from('manutencoes').delete().eq('id', dummyId);
    if (deleteError) {
      console.error("Cleanup Error:", deleteError);
    } else {
      console.log("Cleanup Success!");
    }
  }
}

test();

