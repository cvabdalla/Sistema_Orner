
import { supabase } from '../supabaseClient';
import * as mocks from '../constants';

interface IDataService {
    getAll<T>(collection: string, userId?: string, isAdmin?: boolean): Promise<T[]>;
    save<T extends { id: string | number }>(collection: string, item: T): Promise<T>;
    delete(collection: string, id: string | number): Promise<boolean>;
}

const MOCK_MAP: Record<string, any[]> = {
    'system_users': mocks.MOCK_USERS,
    'system_profiles': mocks.MOCK_PROFILES,
    'financial_transactions': mocks.MOCK_FINANCIAL_TRANSACTIONS,
    'financial_categories': mocks.FINANCIAL_CATEGORIES,
    'stock_items': mocks.MOCK_STOCK_ITEMS,
    'orcamentos': [],
    'sales_summary': [],
    'stock_movements': [],
    'purchase_requests': [],
    'checklist_checkin': [],
    'checklist_checkout': [],
    'checklist_manutencao': [],
    'expense_reports': []
};

class SupabaseDataService implements IDataService {
    
    private formatError(e: any): string {
        if (typeof e === 'string') return e;
        const msg = e?.message || e?.error_description || e?.error || String(e);
        if (msg.includes('fetch') || msg.includes('NetworkError')) {
            return 'Erro de conexão com o servidor. Verifique sua internet ou as configurações do banco de dados.';
        }
        return msg;
    }

    async getAll<T>(collection: string, userId?: string, isAdmin?: boolean): Promise<T[]> {
        try {
            let query = supabase.from(collection).select('*');
            
            if (!isAdmin && userId && ![
                'financial_categories', 
                'system_profiles', 
                'system_users'
            ].includes(collection)) {
                query = query.eq('owner_id', userId);
            }

            const { data, error } = await query;
            
            if (error) {
                if (error.code === '42P01' || error.message?.includes('cache') || error.message?.includes('not find')) {
                    return (MOCK_MAP[collection] || []) as T[];
                }
                console.error(`Erro ao buscar em ${collection}:`, error.message);
                return [];
            }
            
            return (data as T[]) || [];
        } catch (e: any) {
            console.warn(`Erro inesperado ao buscar em ${collection}:`, this.formatError(e));
            return [];
        }
    }

    async save<T extends { id: string | number }>(collection: string, item: T): Promise<T> {
        try {
            const itemToSave = { ...item };

            if (!itemToSave.id) {
                itemToSave.id = Date.now().toString();
            }

            const { data, error } = await supabase
                .from(collection)
                .upsert(itemToSave)
                .select();

            if (error) {
                const errorMsg = this.formatError(error);
                if (error.code === '42P01' || error.message?.includes('not find')) {
                    throw new Error(`Tabela "${collection}" não configurada no banco de dados.`);
                }
                throw new Error(errorMsg);
            }

            return (data && data.length > 0 ? data[0] : itemToSave) as T;
        } catch (e: any) {
            const errorMsg = this.formatError(e);
            console.error(`Falha ao gravar:`, errorMsg);
            throw new Error(errorMsg);
        }
    }

    async delete(collection: string, id: string | number): Promise<boolean> {
        try {
            const { error } = await supabase
                .from(collection)
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (e: any) {
            console.error(`Erro ao excluir:`, this.formatError(e));
            return false;
        }
    }
}

export const dataService = new SupabaseDataService();
