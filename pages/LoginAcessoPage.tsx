import React, { useState, useEffect, useMemo } from 'react';
import { 
  LockClosedIcon, ClockIcon, SearchIcon, ArrowDownIcon,
  XCircleIcon, EyeIcon, ArrowLeftIcon, CalendarIcon
} from '../assets/icons';
import type { User, AccessLogEntry, AccessLogPageVisit } from '../types';
import { accessLogService } from '../services/accessLogService';
import { dataService } from '../services/dataService';
import { MOCK_PROFILES } from '../constants';
import Modal from '../components/Modal';

interface LoginAcessoPageProps {
  currentUser: User;
}

const LoginAcessoPage: React.FC<LoginAcessoPageProps> = ({ currentUser }) => {
  const [logs, setLogs] = useState<AccessLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AccessLogEntry | null>(null);
  const [filterDate, setFilterDate] = useState('');

  // Perfil e validação de Admin
  const [profiles, setProfiles] = useState<any[]>([]);

  const isAdmin = useMemo(() => {
    // Lista de IDs de perfil admin conhecidos
    const adminProfileIds = ['001', '00000000-0000-0000-0000-000000000001'];
    if (adminProfileIds.includes(String(currentUser.profileId))) return true;

    // Se estiver carregando Perfis do banco de dados
    const currentProfile = profiles.find(p => String(p.id) === String(currentUser.profileId));
    if (currentProfile?.permissions?.includes('ALL')) return true;

    // Caso o e-mail seja o super-admin
    if (currentUser.email.toLowerCase() === 'cvabdalla@gmail.com') return true;

    return false;
  }, [currentUser, profiles]);

  // Carrega logs e perfis de controle
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Busca perfis para validar admin
      const loadedProfiles = await dataService.getAll<any>('system_profiles', undefined, true);
      setProfiles(loadedProfiles.length > 0 ? loadedProfiles : MOCK_PROFILES);

      // 2. Busca histórico de acessos
      const fetchedLogs = await accessLogService.getAllAccessLogs();
      setLogs(fetchedLogs);
    } catch (error) {
      console.error("Erro ao carregar dados de acesso:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Formata data e hora legível para o usuário brasileiro (PT-BR)
  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatTimeOnly = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Filtragem dos logs em tempo real
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const nameMatch = log.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const emailMatch = log.user_email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      let dateMatch = true;
      if (filterDate) {
        // Encontra se a data bate (AAAA-MM-DD com data do log)
        const logDateStr = log.login_at?.substring(0, 10);
        dateMatch = logDateStr === filterDate;
      }

      return (nameMatch || emailMatch) && dateMatch;
    });
  }, [logs, searchTerm, filterDate]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[70vh] animate-fade-in">
        <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full mb-4 shadow-md">
          <LockClosedIcon className="w-16 h-16" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 dark:text-white">Acesso Restrito</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-sm">
          Apenas usuários com perfil administrativo podem visualizar relatórios de controle de acessos ao sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700/50">
        <div>
          <h1 className="text-2xl font-black text-gray-950 dark:text-white">Logs de Acesso</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mt-1">
            Histórico completo de autenticação e navegação por tela de todos os colaboradores.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-950/60 font-bold text-xs transition duration-200 flex items-center gap-1.5"
          >
            <ClockIcon className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Painel Principal de Filtros e Lista de Sessões (Colspan-2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700/50 space-y-4">
            
            {/* Filtros em Linha */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Filtrar por nome ou e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl pl-10 pr-4 py-3 text-sm font-semibold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-gray-400"
                />
              </div>

              <div className="relative w-full sm:w-48">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
                  <CalendarIcon className="w-4 h-4" />
                </span>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl pl-9 pr-4 py-3 text-sm font-semibold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                {filterDate && (
                  <button 
                    onClick={() => setFilterDate('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs font-bold"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Lista Tabela de Logs */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                <p className="text-gray-400 text-sm animate-pulse font-medium">Carregando logs de acessos...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-900 text-gray-400 rounded-full flex items-center justify-center mb-3">
                  <ClockIcon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-gray-700 dark:text-gray-300">Nenhum registro encontrado</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
                  Não localizamos nenhuma autenticação de usuário nas condições solicitadas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-500 tracking-wide">
                      <th className="py-3 px-4">Usuário</th>
                      <th className="py-3 px-4">Data e Hora de Entrada</th>
                      <th className="py-3 px-4 text-center">Telas Abertas</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/50 dark:divide-gray-700/40">
                    {filteredLogs.map((log) => {
                      const isSelected = selectedLog?.id === log.id;
                      const pagesOpenedCount = log.visited_pages?.length || 0;
                      
                      return (
                        <tr 
                          key={log.id} 
                          onClick={() => setSelectedLog(log)}
                          className={`cursor-pointer transition duration-150 ${
                            isSelected 
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/20' 
                            : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/10'
                          }`}
                        >
                          <td className="py-4 px-4 font-semibold">
                            <p className="text-sm text-gray-900 dark:text-white">{log.user_name}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">{log.user_email}</p>
                          </td>
                          <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-300 font-semibold">
                            {formatDateTime(log.login_at)}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold leading-none text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40 rounded-full">
                              {pagesOpenedCount}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                              }}
                              className="p-1 px-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 bg-indigo-100/35 dark:bg-indigo-900/10 rounded-lg hover:underline transition"
                            >
                              Ver Histórico
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Linha do Tempo de Navegação / Detalhes (Colspan-1) */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700/50 h-full flex flex-col">
            <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
              <ClockIcon className="w-5 h-5 text-indigo-500" />
              Telas Navegadas
            </h3>

            {!selectedLog ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center px-4 text-gray-400">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 rounded-full flex items-center justify-center mb-3">
                  <EyeIcon className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Nenhum login selecionado</h4>
                <p className="text-xs text-gray-400 mt-1 max-w-[200px] leading-relaxed mx-auto">
                  Selecione um login da lista ao lado para inspecionar os caminhos abertos.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col pt-4 space-y-4">
                
                {/* Cabeçalho da Sessão Selecionada */}
                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 relative">
                  <p className="text-xs text-gray-400 font-bold tracking-wide">Usuário Autenticado</p>
                  <p className="text-base font-black text-gray-950 dark:text-white mt-1 leading-tight">{selectedLog.user_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{selectedLog.user_email}</p>
                  
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-200/55 dark:border-gray-800">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold">Entrada</p>
                      <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{formatTimeOnly(selectedLog.login_at)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold">Total Telas</p>
                      <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">{selectedLog.visited_pages?.length || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Timeline Stepper de Telas */}
                <div className="flex-1 overflow-y-auto max-h-[420px] pr-1 scrollbar-thin">
                  <div className="relative pl-6 space-y-5 border-l-2 border-indigo-100 dark:border-indigo-950 ml-2 pt-2">
                    {selectedLog.visited_pages && selectedLog.visited_pages.map((visit, index) => {
                      const isLast = index === selectedLog.visited_pages.length - 1;
                      
                      return (
                        <div key={index} className="relative">
                          {/* Marcador */}
                          <span className={`absolute -left-[31px] top-1 flex items-center justify-center w-4 h-4 rounded-full ${
                            isLast 
                            ? 'bg-indigo-600 border border-white dark:border-gray-800 text-white animate-pulse' 
                            : 'bg-indigo-200 border border-white dark:border-gray-800 text-indigo-600 dark:bg-indigo-950'
                          }`}>
                            <span className="w-1.5 h-1.5 bg-current rounded-full" />
                          </span>

                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <h4 className={`text-xs font-bold leading-none ${isLast ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                {visit.label}
                              </h4>
                              <span className="text-[10px] text-gray-400 font-semibold shrink-0">
                                {formatTimeOnly(visit.timestamp)}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mt-1 tracking-wider">
                              Id: {visit.page}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoginAcessoPage;
