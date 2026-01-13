import { supabase } from '../supabaseClient';

interface IDataService {
    getAll<T>(collection: string, userId?: string, isAdmin?: boolean): Promise<T[]>;
    save<T extends { id: string | number }>(collection: string, item: T): Promise<T>;
    saveAll<T extends { id: string | number }>(collection: string, items: T[]): Promise<T[]>;
    delete(collection: string, id: string | number): Promise<boolean>;
}

class SupabaseDataService implements IDataService {
    
    async getAll<T>(collection: string, userId?: string, isAdmin?: boolean): Promise<T[]> {
        let query = supabase.from(collection).select('*');
        
        // Lista de coleções que devem ser privadas ao criador (não admin)
        const privateCollections = [
            'orcamentos', 
            'financial_transactions', 
            'expense_reports', 
            'checklist_checkin', 
            'checklist_checkout', 
            'checklist_manutencao', 
            'purchase_requests', 
            'sales_summary',
            'activity_appointments',
            'activity_appointments_log'
        ];

        if (!isAdmin && userId && privateCollections.includes(collection)) {
            query = query.eq('owner_id', userId);
        }

        const { data, error } = await query;
        
        if (error) {
            console.error(`[SUPABASE] Erro ao buscar em ${collection}:`, error.message || error);
            return [];
        }

        return (data as T[]) || [];
    }

    async save<T extends { id: string | number }>(collection: string, item: T): Promise<T> {
        // Remove campos nulos ou indefinidos para evitar erros no Supabase
        const cleanItem = Object.fromEntries(
            Object.entries(item).filter(([_, v]) => v !== undefined)
        );

        const { data, error } = await supabase
            .from(collection)
            .upsert(cleanItem)
            .select()
            .single();

        if (error) {
            console.error(`[SUPABASE] Erro ao salvar em ${collection}:`, error.message || error);
            throw error;
        }

        return data as T;
    }

    async saveAll<T extends { id: string | number }>(collection: string, items: T[]): Promise<T[]> {
        const { data, error } = await supabase
            .from(collection)
            .upsert(items)
            .select();

        if (error) {
            console.error(`[SUPABASE] Erro ao salvar lote em ${collection}:`, error.message || error);
            throw error;
        }

        return data as T[];
    }

    async delete(collection: string, id: string | number): Promise<boolean> {
        const { error } = await supabase
            .from(collection)
            .delete()
            .eq('id', id);

        if (error) {
            console.error(`[SUPABASE] Erro ao deletar em ${collection}:`, error.message || error);
            return false;
        }

        return true;
    }
}

export const dataService = new SupabaseDataService();