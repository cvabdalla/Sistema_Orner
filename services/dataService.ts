
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
        const code = e?.code || '';
        const msg = e?.message || '';
        
        if (code === '42703') return "Coluna inexistente no banco. Execute o SQL de atualização no README.";
        if (code === '23503') return "Erro de vínculo (Foreign Key).";
        if (code === '42501') return "Permissão negada (RLS). Execute 'DISABLE ROW LEVEL SECURITY' no Supabase.";
        if (code === '42P01') return "A tabela não existe no Supabase.";
        if (code === '22P02') return "Erro de tipo de dado: Você está tentando salvar um texto em uma coluna de número. Verifique o tipo da coluna 'id'.";
        
        return msg || String(e);
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
                console.error(`[Supabase Error]`, error);
                // LANÇA O ERRO para que a interface saiba que falhou
                throw new Error(errorMsg);
            }

            // Apenas se salvou no banco, sincronizamos o local
            this.saveLocal(collection, itemToSave);
            return (data && data.length > 0 ? data[0] : itemToSave) as T;
        } catch (e: any) {
            console.error(`[DataService Save Failure]`, e.message);
            throw e; // Repassa o erro para o componente
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
