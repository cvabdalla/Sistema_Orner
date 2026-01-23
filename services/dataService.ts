
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

    /**
     * Remove strings base64 pesadas (imagens/pdfs) de um objeto para economizar espaço no LocalStorage.
     */
    private lightenData(data: any): any {
        if (Array.isArray(data)) {
            return data.map(item => this.lightenData(item));
        }
        if (data !== null && typeof data === 'object') {
            const newObj: any = {};
            for (const key in data) {
                const val = data[key];
                // Se o valor for uma string muito longa (provável base64), nós a removemos do cache local
                if (typeof val === 'string' && (val.startsWith('data:') || val.length > 5000)) {
                    newObj[key] = null; // Remove a imagem do cache, mas mantém a chave
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
            // Se falhar por cota excedida, tentamos limpar outros caches ou salvar uma versão "leve"
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
                console.warn(`[CACHE] Limite atingido em ${collection}. Tentando estratégia de recuperação...`);
                
                // 1. Tenta limpar todos os outros caches de tabelas pesadas
                const largeCollections = ['checklist_checkin', 'checklist_checkout', 'checklist_manutencao', 'expense_reports', 'homologacao_entries'];
                largeCollections.forEach(c => {
                    if (c !== collection) {
                        localStorage.removeItem(`orner_cache_${c}`);
                    }
                });

                try {
                    // Tenta salvar novamente após a limpeza
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                } catch (retryError) {
                    // 2. Se ainda assim falhar, salva apenas os dados de texto (remove imagens base64)
                    console.warn(`[CACHE] Persistência total falhou. Salvando versão reduzida (sem mídias) para ${collection}.`);
                    try {
                        const lightVersion = this.lightenData(data);
                        localStorage.setItem(cacheKey, JSON.stringify(lightVersion));
                    } catch (finalError) {
                        console.error(`[CACHE] Impossível salvar qualquer dado no LocalStorage para ${collection}. O navegador está sem espaço.`);
                    }
                }
            } else {
                console.error(`Erro ao salvar cache de ${collection}:`, e);
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
                'suppliers',
                'homologacao_entries'
            ];

            if (!isAdmin && userId && privateCollections.includes(collection)) {
                query = query.eq('owner_id', userId);
            }

            const { data, error } = await query;
            
            if (error) {
                console.warn(`[SUPABASE] Usando cache local para ${collection}:`, error.message);
                return this.getLocal<T>(collection);
            }

            if (data) {
                this.setLocal(collection, data);
            }
            
            return (data as T[]) || [];

        } catch (e: any) {
            console.error(`[OFFLINE] Usando dados locais para ${collection}.`, e.message || e);
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
            const cleanItem = Object.fromEntries(
                Object.entries(item).filter(([_, v]) => v !== undefined)
            );

            const { data, error } = await supabase
                .from(collection)
                .upsert(cleanItem)
                .select()
                .single();

            if (error) throw error;
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
