
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
            // Se for array, processa cada item e limita a quantidade no cache se for muito grande
            const lightArray = data.map(item => this.lightenData(item));
            return lightArray.length > 50 ? lightArray.slice(0, 50) : lightArray;
        }
        if (data !== null && typeof data === 'object') {
            const newObj: any = {};
            for (const key in data) {
                const val = data[key];
                // Se o valor for uma string muito longa (provável base64 ou anexo), remove do cache
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
                
                // 1. Limpa ABSOLUTAMENTE TODOS os outros caches para dar prioridade ao atual
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('orner_cache_') && key !== cacheKey) {
                        localStorage.removeItem(key);
                    }
                });

                try {
                    // Tenta salvar novamente após limpar tudo ao redor
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                } catch (retryError) {
                    // 2. Se ainda assim falhar, salva a versão sem imagens e limitada em 20 itens
                    console.warn(`[CACHE] Salvando apenas metadados leves (sem imagens) para ${collection}.`);
                    try {
                        const lightVersion = this.lightenData(data);
                        localStorage.setItem(cacheKey, JSON.stringify(lightVersion));
                    } catch (finalError) {
                        // Se falhar aqui, o LocalStorage está corrompido ou o item único é grande demais
                        localStorage.removeItem(cacheKey);
                        console.error(`[CACHE] Falha crítica: ${collection} é muito grande para o LocalStorage.`);
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
                return this.getLocal<T>(collection);
            }

            if (data) {
                this.setLocal(collection, data);
            }
            
            return (data as T[]) || [];

        } catch (e: any) {
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
