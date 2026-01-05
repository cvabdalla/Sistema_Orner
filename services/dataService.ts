import { supabase } from '../supabaseClient';
import * as mocks from '../constants';

interface IDataService {
    getAll<T>(collection: string, userId?: string, isAdmin?: boolean): Promise<T[]>;
    save<T extends { id: string | number }>(collection: string, item: T): Promise<T>;
    delete(collection: string, id: string | number): Promise<boolean>;
}

const STORAGE_PREFIX = 'orner_db_';

class SupabaseDataService implements IDataService {
    
    private getLocal<T>(collection: string): T[] {
        const data = localStorage.getItem(STORAGE_PREFIX + collection);
        return data ? JSON.parse(data) : [];
    }

    private saveLocal<T extends { id: string | number }>(collection: string, item: T) {
        const list = this.getLocal<any>(collection);
        const index = list.findIndex((i: any) => i.id === item.id);
        if (index > -1) list[index] = item;
        else list.push(item);
        localStorage.setItem(STORAGE_PREFIX + collection, JSON.stringify(list));
    }

    private formatError(e: any): string {
        if (!e) return "Erro desconhecido";
        if (typeof e === 'string') return e;
        
        // Extrai a mensagem de erro de forma amigável para evitar [object Object]
        const message = e.message || e.details || e.hint || (e.error && e.error.message) || JSON.stringify(e);
        const code = e.code || '';
        
        if (code === '42703') return `Coluna inexistente no banco de dados: ${message}. Execute o SQL do README no Supabase.`;
        if (code === 'PGRST204') return `Schema desatualizado: ${message}. Tente recriar a tabela no SQL Editor.`;
        
        return message;
    }

    async getAll<T>(collection: string, userId?: string, isAdmin?: boolean): Promise<T[]> {
        try {
            let query = supabase.from(collection).select('*');
            const noOwnerTables = ['financial_categories', 'system_profiles', 'system_users'];

            if (!isAdmin && userId && !noOwnerTables.includes(collection)) {
                query = query.eq('owner_id', userId);
            }

            const { data, error } = await query;
            
            const localData = this.getLocal<T>(collection);
            const remoteData = (data as T[]) || [];
            
            const combined = [...remoteData];
            localData.forEach(localItem => {
                if (!combined.find((remoteItem: any) => remoteItem.id === (localItem as any).id)) {
                    combined.push(localItem);
                }
            });

            if (error) {
                console.warn(`[DataService] Usando cache local para ${collection}:`, error.message);
                return (combined.length > 0 ? combined : (mocks as any)[`MOCK_${collection.toUpperCase()}`] || []) as T[];
            }
            
            return combined;
        } catch (e) {
            return this.getLocal<T>(collection);
        }
    }

    async save<T extends { id: string | number }>(collection: string, item: T): Promise<T> {
        const itemToSave = { ...item };
        if (!itemToSave.id) itemToSave.id = `id-${Date.now()}`;

        try {
            const { data, error } = await supabase
                .from(collection)
                .upsert(itemToSave)
                .select();

            if (error) {
                const errorMsg = this.formatError(error);
                console.error(`[Supabase Error Details]`, error);
                throw new Error(errorMsg);
            }

            this.saveLocal(collection, itemToSave);
            return (data && data.length > 0 ? data[0] : itemToSave) as T;
        } catch (e: any) {
            const msg = this.formatError(e);
            console.error(`[DataService Save Failure]`, msg);
            throw new Error(msg);
        }
    }

    async delete(collection: string, id: string | number): Promise<boolean> {
        try {
            const { error } = await supabase.from(collection).delete().eq('id', id);
            if (!error) {
                const list = this.getLocal<any>(collection);
                localStorage.setItem(STORAGE_PREFIX + collection, JSON.stringify(list.filter((i: any) => i.id !== id)));
                return true;
            }
            throw error;
        } catch (e) {
            console.error("Erro ao deletar:", e);
            return false;
        }
    }
}

export const dataService = new SupabaseDataService();