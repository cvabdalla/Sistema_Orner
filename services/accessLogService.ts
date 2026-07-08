import { dataService } from './dataService';
import type { User, AccessLogEntry } from '../types';

const SESSION_LOG_KEY = 'orner_active_session_log_id';

class AccessLogService {
    
    // Friendly labels for app pages
    getFriendlyPageLabel(page: string): string {
        const PAGE_LABELS: Record<string, string> = {
            'DASHBOARD': 'Dashboard / Indicadores YTD',
            'ORCAMENTO': 'Lista de Orçamentos',
            'NOVO_ORCAMENTO': 'Novo Orçamento',
            'RESUMO_VENDAS': 'Resumo de Vendas',
            'FINANCEIRO_VISAO_GERAL': 'Fluxo de Caixa',
            'FINANCEIRO_DRE': 'DRE Gerencial',
            'FINANCEIRO_CATEGORIAS': 'Categorias Financeiras',
            'FINANCEIRO_BANCOS': 'Contas Bancárias',
            'ESTOQUE_VISAO_GERAL': 'Estoque Geral',
            'ESTOQUE_NOVO_PRODUTO': 'Cadastrar Produto',
            'ESTOQUE_COMPRAS': 'Pedido de Compra',
            'CHECKLIST_CHECKIN': 'Check-in de Obra',
            'CHECKLIST_CHECKOUT': 'Check-out de Obra',
            'CHECKLIST_MANUTENCAO': 'Manutenção de Obra',
            'CHECKLIST_HOMOLOGACAO': 'Homologação',
            'RELATORIOS_VISAO_GERAL': 'Resumo de Reembolsos',
            'RELATORIOS_NOVO': 'Novo Reembolso',
            'RELATORIOS_STATUS': 'Status de Reembolsos',
            'RELATORIOS_HISTORICO': 'Histórico de Reembolsos',
            'RELATORIOS_CONFIG': 'Configurações Gerais',
            'INSTALACAO_LAVAGEM_SOLIC': 'Instalações / Lavagens',
            'INSTALACOES_CALENDARIO': 'Agenda de Serviços',
            'INSTALACOES_CADASTRO': 'Cadastro de Instalações',
            'INSTALACOES_LAVAGEM': 'Lavagem de Placas',
            'USUARIOS_GESTAO': 'Cadastro de Usuários',
            'CADASTRO_INSTALADOR': 'Cadastro de Instalador',
            'USUARIOS_PERFIL': 'Perfil de Usuário',
            'LOGIN_ACESSO': 'Logs de Acesso'
        };
        return PAGE_LABELS[page] || page;
    }

    /**
     * Registra o login e inicia a sessão temporária na aba do navegador.
     */
    async logLogin(user: User): Promise<string> {
        try {
            const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            sessionStorage.setItem(SESSION_LOG_KEY, sessionId);

            const initialEntry: AccessLogEntry = {
                id: sessionId,
                owner_id: user.id,
                user_name: user.name,
                user_email: user.email,
                login_at: new Date().toISOString(),
                visited_pages: [
                    {
                        page: 'DASHBOARD',
                        label: 'Login Realizado & Dashboard Aberto',
                        timestamp: new Date().toISOString()
                    }
                ]
            };

            await dataService.save('login_access_logs', initialEntry);
            return sessionId;
        } catch (e: any) {
            console.warn('[ACCESS LOG] Falha ao registrar login no Supabase (operando em cache local):', e.message);
            return sessionStorage.getItem(SESSION_LOG_KEY) || '';
        }
    }

    /**
     * Registra a abertura de uma tela (janela) do sistema.
     */
    async logPageVisit(user: User, page: string): Promise<void> {
        if (!user) return;
        try {
            let sessionId = sessionStorage.getItem(SESSION_LOG_KEY);
            
            // Se o usuário recarregou a página ou abriu nova guia, restaura ou cria a sessão de log
            if (!sessionId) {
                sessionId = await this.logLogin(user);
            }

            // Busca os logs existentes do local storage/banco
            const logs = await dataService.getAll<AccessLogEntry>('login_access_logs', user.id, true);
            const currentLog = logs.find(log => log.id === sessionId);

            if (currentLog) {
                // Evita duplicar o último registro de tela consecutiva
                const lastVisit = currentLog.visited_pages[currentLog.visited_pages.length - 1];
                if (lastVisit && lastVisit.page === page) {
                    return; // Sem necessidade de duplicar
                }

                const updatedPages = [
                    ...currentLog.visited_pages,
                    {
                        page,
                        label: this.getFriendlyPageLabel(page),
                        timestamp: new Date().toISOString()
                    }
                ];

                const updatedLog: AccessLogEntry = {
                    ...currentLog,
                    visited_pages: updatedPages
                };

                await dataService.save('login_access_logs', updatedLog);
            } else {
                // Caso não encontre (por exemplo, cache apagado ou registro remoto pendente), recria o registro
                const newLog: AccessLogEntry = {
                    id: sessionId,
                    owner_id: user.id,
                    user_name: user.name,
                    user_email: user.email,
                    login_at: new Date().toISOString(),
                    visited_pages: [
                        {
                            page,
                            label: this.getFriendlyPageLabel(page),
                            timestamp: new Date().toISOString()
                        }
                    ]
                };
                await dataService.save('login_access_logs', newLog);
            }
        } catch (e: any) {
            console.warn('[ACCESS LOG] Erro ao registrar visita de página:', e.message);
        }
    }

    /**
     * Retorna todos os logs de acessos (com ordenação decrescente).
     */
    async getAllAccessLogs(): Promise<AccessLogEntry[]> {
        try {
            const logs = await dataService.getAll<AccessLogEntry>('login_access_logs', undefined, true);
            return logs.sort((a, b) => new Date(b.login_at).getTime() - new Date(a.login_at).getTime());
        } catch (e: any) {
            console.error('[ACCESS LOG] Erro ao carregar histórico de acessos:', e);
            return [];
        }
    }

    /**
     * Limpa histórico de acessos
     */
    async clearLogs(): Promise<void> {
        try {
            const logs = await this.getAllAccessLogs();
            for (const log of logs) {
                await dataService.delete('login_access_logs', log.id);
            }
        } catch (e) {
            console.error('[ACCESS LOG] Erro ao limpar logs:', e);
        }
    }
}

export const accessLogService = new AccessLogService();
