
import { supabase } from '../supabaseClient';

interface IDataService {
    getAll<T>(collection: string, userId?: string, isAdmin?: boolean): Promise<T[]>;
    save<T extends { id: string | number }>(collection: string, item: T): Promise<T>;
    saveAll<T extends { id: string | number }>(collection: string, items: T[]): Promise<T[]>;
    delete(collection: string, id: string | number): Promise<boolean>;
}

class SupabaseDataService implements IDataService {
    
    private getLocal<T>(collection: string): T[] {
        try {
            const data = localStorage.getItem(`orner_cache_${collection}`);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error(`Erro ao ler cache de ${collection}:`, e);
            return [];
        }
    }

    private setLocal<T>(collection: string, data: T[]): void {
        try {
            localStorage.setItem(`orner_cache_${collection}`, JSON.stringify(data));
        } catch (e: any) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
                console.warn(`[CACHE] Limite de armazenamento atingido ao salvar ${collection}. Tentando liberar espaço...`);
                const largeCollections = ['checklist_checkin', 'checklist_checkout', 'checklist_manutencao', 'expense_reports'];
                largeCollections.forEach(c => {
                    if (c !== collection) {
                        localStorage.removeItem(`orner_cache_${c}`);
                    }
                });
                try {
                    localStorage.setItem(`orner_cache_${collection}`, JSON.stringify(data));
                } catch (retryError) {
                    console.error(`[CACHE] Falha crítica: ${collection} é muito grande para o LocalStorage.`);
                }
            } else {
                console.error(`Erro desconhecido ao salvar cache de ${collection}:`, e);
            }
        }
    }

    async getAll<T>(collection: string, userId?: string, isAdmin?: boolean): Promise<T[]> {
        try {
            let query = supabase.from(collection).select('*');
            
            const privateCollections = [
                'orcamentos', 
                'financial_transactions', 
                'expense_reports', 
                'purchase_requests', 
                'sales_summary',
                'lavagem_clients',
                'lavagem_packages',
                'lavagem_records',
                'checklist_checkin',
                'checklist_checkout',
                'checklist_manutencao',
                'suppliers'
            ];

            if (!isAdmin && userId && privateCollections.includes(collection)) {
                query = query.eq('owner_id', userId);
            }

            const { data, error } = await query;
            
            if (error) {
                console.warn(`[SUPABASE] Erro em ${collection}, usando cache local:`, error.message);
                return this.getLocal<T>(collection);
            }

            if (data) {
                this.setLocal(collection, data);
            }
            
            return (data as T[]) || [];

        } catch (e: any) {
            console.error(`[OFFLINE MODE] Usando dados locais para ${collection}.`, e.message || e);
            return this.getLocal<T>(collection);
        }
    }

    async save<T extends { id: string | number }>(collection: string, item: T): Promise<T> {
        const localData = this.getLocal<T>(collection);
        const index = localData.findIndex(i => String(i.id) === String(item.id));
        if (index > -1) {
            localData[index] = { ...localData[index], ...item };
        } else {
            localData.push(item);
        }
        this.setLocal(collection, localData);

        try {
            // Remove campos explicitamente marcados como undefined para evitar erros de schema no Supabase
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([_, v]) => v !== undefined)
            );

            const { data, error } = await supabase
                .from(collection)
                .upsert(cleanItem)
                .select()
                .single();

            if (error) {
                console.error(`[SUPABASE ERROR] ${collection}:`, error.message, error.details);
                throw error;
            }
            return data as T;
        } catch (e: any) {
            console.error(`[SAVE ERROR] ${collection}:`, e.message);
            throw e;
        }
    }

    async saveAll<T extends { id: string | number }>(collection: string, items: T[]): Promise<T[]> {
        const localData = this.getLocal<T>(collection);
        items.forEach(item => {
            const index = localData.findIndex(i => String(i.id) === String(item.id));
            if (index > -1) localData[index] = { ...localData[index], ...item };
            else localData.push(item);
        });
        this.setLocal(collection, localData);

        try {
            // Limpa cada item do array
            const cleanItems = items.map(item => 
                Object.fromEntries(Object.entries(item).filter(([_, v]) => v !== undefined))
            );

            const { data, error } = await supabase
                .from(collection)
                .upsert(cleanItems)
                .select();

            if (error) throw error;
            return data as T[];
        } catch (e: any) {
            console.error(`[BATCH SAVE ERROR] ${collection}:`, e.message);
            throw e;
        }
    }

    async delete(collection: string, id: string | number): Promise<boolean> {
        const localData = this.getLocal<any>(collection);
        const filtered = localData.filter(i => String(i.id) !== String(id));
        this.setLocal(collection, filtered);

        try {
            const { error } = await supabase
                .from(collection)
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (e: any) {
            console.error(`[DELETE ERROR] ${collection}:`, e.message);
            throw e;
        }
    }
}

export const dataService = new SupabaseDataService();
