
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
        if (typeof e === 'string') return e;
        if (e?.code === '42703') return "Coluna inexistente no banco. Verifique o SQL atualizado.";
        if (e?.code === '23503') return "Erro de vínculo (Foreign Key).";
        if (e?.code === '42501') return "Permissão negada (RLS). Execute o comando 'DISABLE ROW LEVEL SECURITY'.";
        if (e?.code === '42P01') return "A tabela não existe no Supabase. Crie-a no SQL Editor.";
        return e?.message || e?.error_description || String(e);
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
                console.warn(`[DataService] Erro Supabase em ${collection}:`, error.message);
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

        // Garante persistência local antes de tentar rede
        this.saveLocal(collection, itemToSave);

        try {
            const { data, error } = await supabase
                .from(collection)
                .upsert(itemToSave)
                .select();

            if (error) {
                const errorMsg = this.formatError(error);
                console.error(`[DataService] Falha técnica no Supabase:`, error);
                
                // Se a falha for apenas de tabela ou permissão, o alerta ajuda a depurar
                if (error.code !== 'PGRST116') { // Ignora erros de "not found" em upsert simples
                     alert(`Erro no Banco de Dados:\n${errorMsg}\n\nO dado foi salvo apenas no seu navegador por enquanto.`);
                }
                
                return itemToSave as T;
            }

            return (data && data.length > 0 ? data[0] : itemToSave) as T;
        } catch (e: any) {
            console.warn(`[DataService] Erro de rede. Salvo localmente.`);
            return itemToSave as T;
        }
    }

    async delete(collection: string, id: string | number): Promise<boolean> {
        const list = this.getLocal<any>(collection);
        localStorage.setItem(STORAGE_PREFIX + collection, JSON.stringify(list.filter((i: any) => i.id !== id)));
        
        try {
            const { error } = await supabase.from(collection).delete().eq('id', id);
            if (error && error.code !== '42P01') throw error;
            return true;
        } catch (e) {
            return true;
        }
    }
}

export const dataService = new SupabaseDataService();
