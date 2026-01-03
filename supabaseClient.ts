
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cisfqeaojyklgqgybzyq.supabase.co';
const supabaseAnonKey = 'sb_publishable_CAf0jiXLUEm7xzmPc3QIOw_cK--MAEW';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
