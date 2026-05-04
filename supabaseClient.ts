import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cisfqeaojyklgqgybzyq.supabase.co';
const supabaseAnonKey = 'sb_publishable_CAf0jiXLUEm7xzmPc3QIOw_cK--MAEW';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const testSupabaseConnection = async () => {
    try {
        const { error } = await supabase.from('system_configs').select('id').limit(1);
        if (error) return { ok: false, error };
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err };
    }
};
