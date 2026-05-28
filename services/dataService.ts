
import { supabase } from '../supabaseClient';

interface IDataService {
    getAll<T>(collection: string, userId?: string, isAdmin?: boolean): Promise<T[]>;
    getPartial<T>(collection: string, fields: string, userId?: string, isAdmin?: boolean): Promise<T[]>;
    getById<T>(collection: string, id: string | number): Promise<T | null>;
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

    /**
     * Remove strings base64 pesadas (imagens/pdfs) de um objeto para economizar espaço no LocalStorage.
     */
    private lightenData(data: any): any {
        if (Array.isArray(data)) {
            const lightArray = data.map(item => this.lightenData(item));
            return lightArray.length > 50 ? lightArray.slice(0, 50) : lightArray;
        }
        if (data !== null && typeof data === 'object') {
            const newObj: any = {};
            for (const key in data) {
                const val = data[key];
                if (typeof val === 'string' && (val.startsWith('data:') || val.length > 3000)) {
                    newObj[key] = null; 
                } else if (typeof val === 'object') {
                    newObj[key] = this.lightenData(val);
                } else {
                    newObj[key] = val;
                }
            }
            return newObj;
        }
        return data;
    }

    private setLocal<T>(collection: string, data: T[]): void {
        const cacheKey = `orner_cache_${collection}`;
        try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (e: any) {
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
                console.warn(`[CACHE] Limite atingido em ${collection}. Executando limpeza de emergência...`);
                
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('orner_cache_') && key !== cacheKey) {
                        localStorage.removeItem(key);
                    }
                });

                try {
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                } catch (retryError) {
                    try {
                        const lightVersion = this.lightenData(data);
                        localStorage.setItem(cacheKey, JSON.stringify(lightVersion));
                    } catch (finalError) {
                        localStorage.removeItem(cacheKey);
                    }
                }
            } else {
                console.error(`Erro ao salvar cache de ${collection}:`, e);
            }
        }
    }
    private serialize<T>(collection: string, item: any): any {
        return item;
    }

    private deserialize<T>(collection: string, item: any): T {
        return item;
    }

    async getById<T>(collection: string, id: string | number): Promise<T | null> {
        try {
            const { data, error } = await supabase
                .from(collection)
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) throw error;
            return this.deserialize<T>(collection, data);
        } catch (e: any) {
            console.error(`[DB ERROR] Erro ao buscar ${collection}:${id}:`, e.message);
            // Tenta no cache se falhar
            const local = this.getLocal<any>(collection);
            return local.find(i => String(i.id) === String(id)) || null;
        }
    }

    async getPartial<T>(collection: string, fields: string, userId?: string, isAdmin?: boolean): Promise<T[]> {
        try {
            let query = supabase.from(collection).select(fields);
            
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
                'suppliers',
                'homologacao_entries'
            ];

            if (!isAdmin && userId && privateCollections.includes(collection)) {
                if (collection === 'homologacao_entries') {
                    query = query.or(`owner_id.eq.${userId},responsible_user_id.eq.${userId}`);
                } else {
                    query = query.eq('owner_id', userId);
                }
            }

            const { data, error } = await query;
            if (error) throw error;
            return ((data as any[]) || []).map(item => this.deserialize<T>(collection, item));
        } catch (e: any) {
            console.error(`[DB ERROR] Erro parcial carregar ${collection}:`, e.message);
            return this.getLocal<T>(collection);
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
                'suppliers',
                'homologacao_entries'
            ];

            // Se for admin, não filtra. Se não for admin e tiver userId em coleção privada, filtra.
            if (!isAdmin && userId && privateCollections.includes(collection)) {
                // Caso especial para homologação: o responsável também deve ver o card
                if (collection === 'homologacao_entries') {
                    query = query.or(`owner_id.eq.${userId},responsible_user_id.eq.${userId}`);
                } else {
                    query = query.eq('owner_id', userId);
                }
            }

            const { data, error } = await query;
            
            if (error) {
                console.error(`[DB ERROR] Erro ao carregar ${collection}:`, error.message, error.details);
                if (error.code === 'PGRST116') {
                    // Item não encontrado - comum em .single()
                    return [];
                }
                if (error.message.includes('JWT') || error.code === '401' || error.message.includes('key')) {
                    console.error(`[CRITICAL] Problema de autenticação com o Supabase detectado ao carregar ${collection}.`);
                }
                return this.getLocal<T>(collection);
            }

            const deserialized = ((data as any[]) || []).map(item => this.deserialize<T>(collection, item));

            if (data) {
                this.setLocal(collection, deserialized);
            }
            
            return deserialized;

        } catch (e: any) {
            console.error(`[RUNTIME ERROR] Erro inesperado ao carregar ${collection}:`, e.message);
            return this.getLocal<T>(collection);
        }
    }

    async save<T extends { id: string | number }>(collection: string, item: T): Promise<T> {
        const deserializedItem = this.deserialize<T>(collection, item);
        const localData = this.getLocal<T>(collection);
        const index = localData.findIndex(i => String(i.id) === String(item.id));
        if (index > -1) {
            localData[index] = { ...localData[index], ...deserializedItem };
        } else {
            localData.push(deserializedItem);
        }
        this.setLocal(collection, localData);

        try {
            const dbItem = this.serialize(collection, item);
            const cleanItem = Object.fromEntries(
                Object.entries(dbItem).filter(([_, v]) => v !== undefined)
            );

            const { data, error } = await supabase
                .from(collection)
                .upsert(cleanItem)
                .select()
                .single();

            if (error) throw error;
            return this.deserialize<T>(collection, data);
        } catch (e: any) {
            console.error(`[SAVE ERROR] ${collection}:`, e.message);
            throw e;
        }
    }

    async saveAll<T extends { id: string | number }>(collection: string, items: T[]): Promise<T[]> {
        const deserializedItems = items.map(item => this.deserialize<T>(collection, item));
        const localData = this.getLocal<T>(collection);
        deserializedItems.forEach(item => {
            const index = localData.findIndex(i => String(i.id) === String(item.id));
            if (index > -1) localData[index] = { ...localData[index], ...item };
            else localData.push(item);
        });
        this.setLocal(collection, localData);

        try {
            const dbItems = items.map(item => this.serialize(collection, item));
            const cleanItems = dbItems.map(item => 
                Object.fromEntries(Object.entries(item).filter(([_, v]) => v !== undefined))
            );

            const { data, error } = await supabase
                .from(collection)
                .upsert(cleanItems)
                .select();

            if (error) throw error;
            return ((data as any[]) || []).map(item => this.deserialize<T>(collection, item));
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
