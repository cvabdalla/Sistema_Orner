
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
            // Verifica se o erro é de falta de espaço (QuotaExceededError)
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22) {
                console.warn(`[CACHE] Limite de armazenamento atingido ao salvar ${collection}. Tentando liberar espaço...`);
                
                // Estratégia de limpeza: Remove caches de outras coleções grandes para tentar salvar a atual
                const largeCollections = ['checklist_checkin', 'checklist_checkout', 'checklist_manutencao', 'expense_reports'];
                largeCollections.forEach(c => {
                    if (c !== collection) {
                        localStorage.removeItem(`orner_cache_${c}`);
                    }
                });

                // Tenta salvar novamente após a limpeza
                try {
                    localStorage.setItem(`orner_cache_${collection}`, JSON.stringify(data));
                } catch (retryError) {
                    console.error(`[CACHE] Falha crítica: ${collection} é muito grande para o LocalStorage, mesmo após limpeza.`);
                    // Não lançamos o erro para não quebrar o fluxo da aplicação
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
                'checklist_manutencao'
            ];

            if (!isAdmin && userId && privateCollections.includes(collection)) {
                query = query.eq('owner_id', userId);
            }

            const { data, error } = await query;
            
            if (error) {
                console.warn(`[SUPABASE] Erro em ${collection}, usando cache local:`, error.message);
                return this.getLocal<T>(collection);
            }

            // Atualiza o cache local de forma segura
            if (data) {
                this.setLocal(collection, data);
            }
            
            return (data as T[]) || [];

        } catch (e: any) {
            console.error(`[OFFLINE MODE] Usando dados locais para ${collection}. Motivo:`, e.message || e);
            return this.getLocal<T>(collection);
        }
    }

    async save<T extends { id: string | number }>(collection: string, item: T): Promise<T> {
        // 1. Salva no Cache Local Primeiro (Segurança)
        const localData = this.getLocal<T>(collection);
        const index = localData.findIndex(i => String(i.id) === String(item.id));
        if (index > -1) {
            localData[index] = { ...localData[index], ...item };
        } else {
            localData.push(item);
        }
        this.setLocal(collection, localData);

        // 2. Tenta sincronizar com Supabase
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
            console.warn(`[OFFLINE SAVE] ${collection} salva apenas localmente. Erro:`, e.message);
            return item;
        }
    }

    async saveAll<T extends { id: string | number }>(collection: string, items: T[]): Promise<T[]> {
        // 1. Salva no Cache Local
        const localData = this.getLocal<T>(collection);
        items.forEach(item => {
            const index = localData.findIndex(i => String(i.id) === String(item.id));
            if (index > -1) localData[index] = { ...localData[index], ...item };
            else localData.push(item);
        });
        this.setLocal(collection, localData);

        // 2. Tenta sincronizar
        try {
            const { data, error } = await supabase
                .from(collection)
                .upsert(items)
                .select();

            if (error) throw error;
            return data as T[];
        } catch (e: any) {
            console.warn(`[OFFLINE BATCH SAVE] ${collection} salvo apenas localmente.`);
            return items;
        }
    }

    async delete(collection: string, id: string | number): Promise<boolean> {
        // 1. Remove do Cache Local
        const localData = this.getLocal<any>(collection);
        const filtered = localData.filter(i => String(i.id) !== String(id));
        this.setLocal(collection, filtered);

        // 2. Tenta remover do Supabase
        try {
            const { error } = await supabase
                .from(collection)
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (e: any) {
            console.warn(`[OFFLINE DELETE] ${collection} removido apenas localmente.`);
            return true;
        }
    }
}

export const dataService = new SupabaseDataService();
