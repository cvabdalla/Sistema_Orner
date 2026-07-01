import React, { useState, useRef } from 'react';
import { dataService } from '../services/dataService';
import { authService } from '../services/authService';
import type { HistoricalRevenue } from '../types';

interface HistoricalRevenueModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDataChanged: () => void;
    historicalData: HistoricalRevenue[];
}

export const HistoricalRevenueModal: React.FC<HistoricalRevenueModalProps> = ({
    isOpen,
    onClose,
    onDataChanged,
    historicalData
}) => {
    const [year, setYear] = useState<number>(new Date().getFullYear() - 1);
    const [month, setMonth] = useState<number>(1);
    const [clientName, setClientName] = useState<string>('');
    const [vendaSistema, setVendaSistema] = useState<string>('');
    const [custoSistema, setCustoSistema] = useState<string>('');
    const [manutencao, setManutencao] = useState<string>('');
    const [lavagem, setLavagem] = useState<string>('');
    
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [dragActive, setDragActive] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const currentUser = authService.getSession();

    const handleAddManual = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) {
            setStatusMessage({ type: 'error', text: 'Você precisa estar logado para salvar dados.' });
            return;
        }

        setIsLoading(true);
        setStatusMessage(null);

        const newRecord: HistoricalRevenue = {
            id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            owner_id: currentUser.id || '001',
            year: Number(year),
            month: Number(month),
            client_name: clientName.trim() || '',
            venda_sistema: Number(vendaSistema) || 0,
            custo_sistema: Number(custoSistema) || 0,
            manutencao: Number(manutencao) || 0,
            lavagem: Number(lavagem) || 0
        };

        try {
            await dataService.save<HistoricalRevenue>('historical_revenue', newRecord);
            setStatusMessage({ type: 'success', text: 'Registro salvo com sucesso!' });
            setClientName('');
            setVendaSistema('');
            setCustoSistema('');
            setManutencao('');
            setLavagem('');
            onDataChanged();
        } catch (error: any) {
            console.error(error);
            setStatusMessage({ type: 'error', text: `Erro ao salvar: ${error.message || 'Erro desconhecido'}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setIsLoading(true);
        setStatusMessage(null);
        try {
            await dataService.delete('historical_revenue', id);
            setStatusMessage({ type: 'success', text: 'Registro excluído com sucesso!' });
            setDeleteConfirmId(null);
            onDataChanged();
        } catch (error: any) {
            setStatusMessage({ type: 'error', text: `Erro ao excluir: ${error.message}` });
        } finally {
            setIsLoading(false);
        }
    };

    // Download do Excel de Exemplo em formato CSV
    const handleDownloadTemplate = () => {
        const headers = "ano,mes,nome_cliente,venda_sistema,custo_sistema,manutencao,lavagem\n";
        const examples = [
            "2025,1,Cliente Solar Alpha,120000.00,85000.00,15000.00,8000.00",
            "2025,2,Engenharia Beta,95000.00,62000.00,12500.00,6500.00",
            "2025,3,Cliente Residencial Gama,110000.00,75000.00,14000.00,7200.00"
        ].join("\n");
        
        const blob = new Blob([headers + examples], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "modelo_importacao_historico.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Importer Parser para CSV (comporta vírgula e ponto-e-vírgula e limpador de aspas)
    const parseAndImportCSV = (text: string) => {
        if (!currentUser) {
            setStatusMessage({ type: 'error', text: 'Usuário não logado.' });
            return;
        }

        const lines = text.split(/\r?\n/);
        if (lines.length <= 1) {
            setStatusMessage({ type: 'error', text: 'O arquivo está vazio ou não possui linhas de dados.' });
            return;
        }

        // Detectar delimitador (vírgula ou ponto e vírgula)
        const header = lines[0];
        const delimiter = header.includes(';') ? ';' : ',';
        const cols = header.split(delimiter).map(c => c.trim().toLowerCase().replace(/"/g, ''));

        // Mapeamento de colunas esperadas
        const colIdx = {
            ano: cols.indexOf('ano'),
            mes: cols.indexOf('mes'),
            cliente: cols.indexOf('nome_cliente') !== -1 ? cols.indexOf('nome_cliente') : cols.indexOf('client_name'),
            venda: cols.indexOf('venda_sistema'),
            custo: cols.indexOf('custo_sistema'),
            manutencao: cols.indexOf('manutencao'),
            lavagem: cols.indexOf('lavagem')
        };

        if (colIdx.ano === -1 || colIdx.mes === -1) {
            setStatusMessage({ 
                type: 'error', 
                text: 'Cabeçalhos inválidos. Certifique-se de usar exatamente as colunas: ano, mes, venda_sistema, custo_sistema, manutencao, lavagem' 
            });
            return;
        }

        const importedRecords: HistoricalRevenue[] = [];
        let errorCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cells = line.split(delimiter).map(c => c.trim().replace(/"/g, ''));
            if (cells.length < 2) continue;

            const rYear = parseInt(cells[colIdx.ano], 10);
            const rMonth = parseInt(cells[colIdx.mes], 10);
            
            if (isNaN(rYear) || isNaN(rMonth) || rMonth < 1 || rMonth > 12) {
                errorCount++;
                continue;
            }

            const rVenda = colIdx.venda !== -1 ? parseFloat(cells[colIdx.venda]) : 0;
            const rCusto = colIdx.custo !== -1 ? parseFloat(cells[colIdx.custo]) : 0;
            const rManutencao = colIdx.manutencao !== -1 ? parseFloat(cells[colIdx.manutencao]) : 0;
            const rLavagem = colIdx.lavagem !== -1 ? parseFloat(cells[colIdx.lavagem]) : 0;
            const rCliente = colIdx.cliente !== -1 ? cells[colIdx.cliente] : '';

            importedRecords.push({
                id: `hist_${rYear}_${rMonth}_${Math.random().toString(36).substr(2, 5)}`,
                owner_id: currentUser.id || '001',
                year: rYear,
                month: rMonth,
                client_name: rCliente || '',
                venda_sistema: isNaN(rVenda) ? 0 : rVenda,
                custo_sistema: isNaN(rCusto) ? 0 : rCusto,
                manutencao: isNaN(rManutencao) ? 0 : rManutencao,
                lavagem: isNaN(rLavagem) ? 0 : rLavagem
            });
        }

        if (importedRecords.length === 0) {
            setStatusMessage({ type: 'error', text: 'Nenhum registro válido pôde ser importado do arquivo.' });
            return;
        }

        setIsLoading(true);
        dataService.saveAll<HistoricalRevenue>('historical_revenue', importedRecords)
            .then(() => {
                setStatusMessage({ 
                    type: 'success', 
                    text: `Importado com sucesso ${importedRecords.length} registros histofaturamento!${errorCount > 0 ? ` (${errorCount} linhas ignoradas por erros)` : ''}`
                });
                onDataChanged();
            })
            .catch(err => {
                setStatusMessage({ type: 'error', text: `Erro de salvamento em lote: ${err.message}` });
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            parseAndImportCSV(text);
        };
        reader.readAsText(file);
        e.target.value = ''; // reseta
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                parseAndImportCSV(text);
            };
            reader.readAsText(file);
        }
    };

    const sortedHistory = [...historicalData].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
    });

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const getMonthName = (m: number) => {
        const date = new Date(2024, m - 1, 1);
        const name = date.toLocaleString('pt-BR', { month: 'long' });
        return name.charAt(0).toUpperCase() + name.slice(1);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700/50 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Abastecer Histórico de Anos Anteriores</h3>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1">Preencha dados consolidados passados para enriquecer os gráficos comparativos</p>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 p-2 rounded-full transition-all text-gray-500 dark:text-gray-300"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Painel Esquerdo: Cadastro / Upload */}
                    <div className="md:col-span-5 space-y-6">
                        {statusMessage && (
                            <div className={`p-4 rounded-xl text-xs font-bold flex gap-2 ${statusMessage.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20 10 10 0 010-20z"/></svg>
                                <span>{statusMessage.text}</span>
                            </div>
                        )}

                        {/* Importação por CSV / Excel */}
                        <div className="bg-gray-50 dark:bg-gray-900/30 p-5 rounded-2xl border border-gray-200/50 dark:border-gray-700/50">
                            <h4 className="text-xs font-black text-gray-500 dark:text-gray-400 mb-3 tracking-wide">Importar Planilha (Excel / CSV)</h4>
                            
                            <button 
                                onClick={handleDownloadTemplate}
                                className="w-full flex items-center justify-center gap-2 mb-4 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                Baixar Modelo em Branco (CSV)
                            </button>

                            {/* Drag and Drop Zone */}
                            <div 
                                onDragEnter={handleDrag}
                                onDragOver={handleDrag}
                                onDragLeave={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragActive ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-400 hover:bg-gray-50/50 dark:hover:bg-gray-900/20'}`}
                            >
                                <input 
                                    ref={fileInputRef} 
                                    type="file" 
                                    className="hidden" 
                                    accept=".csv" 
                                    onChange={handleFileChange} 
                                />
                                <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                                <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Arraste seu arquivo CSV ou clique para selecionar</p>
                                <p className="text-[10px] text-gray-400 mt-1">Compatível com Excel (separados por vírgula ou ponto e vírgula)</p>
                            </div>
                        </div>

                        {/* Cadastro Manual */}
                        <form onSubmit={handleAddManual} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3 shadow-sm">
                            <h4 className="text-xs font-black text-gray-500 dark:text-gray-400 tracking-wide">Inserir Manualmente</h4>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Ano</label>
                                    <input 
                                        type="number" 
                                        required
                                        min="2000"
                                        max="2100"
                                        value={year}
                                        onChange={(e) => setYear(parseInt(e.target.value, 10))}
                                        className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 dark:text-white w-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Mês</label>
                                    <select 
                                        value={month}
                                        onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                                        className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 dark:text-white w-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Nome do Cliente</label>
                                <input 
                                    type="text" 
                                    placeholder="Ex: Cliente Solar ABC"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 dark:text-white w-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            <div className="p-3.5 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/80 dark:border-indigo-900/40 rounded-2xl space-y-3">
                                <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                    Venda de Sistema
                                </span>
                                <div className="space-y-2.5">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Preço de Venda do Sistema (R$)</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            placeholder="Ex: 120000.00"
                                            value={vendaSistema}
                                            onChange={(e) => setVendaSistema(e.target.value)}
                                            className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 dark:text-white w-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Custo do Sistema (R$)</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            placeholder="Ex: 80000.00"
                                            value={custoSistema}
                                            onChange={(e) => setCustoSistema(e.target.value)}
                                            className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 dark:text-white w-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Faturamento Manutenção (R$)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    placeholder="Ex: 8500.00"
                                    value={manutencao}
                                    onChange={(e) => setManutencao(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 dark:text-white w-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">Faturamento Contrato Lavagem (R$)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    placeholder="Ex: 5000.00"
                                    value={lavagem}
                                    onChange={(e) => setLavagem(e.target.value)}
                                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 dark:text-white w-full focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            <button 
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                            >
                                {isLoading ? 'Gravando...' : 'Adicionar ao Histórico'}
                            </button>
                        </form>
                    </div>

                    {/* Painel Direito: Listagem e Gerenciamento */}
                    <div className="md:col-span-7 flex flex-col h-full">
                        <div className="bg-gray-50 dark:bg-gray-900/30 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl flex-1 flex flex-col min-h-[350px] overflow-hidden">
                            <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50 flex justify-between items-center bg-white dark:bg-gray-800">
                                <span className="text-xs font-black text-gray-500 dark:text-gray-400 tracking-wide">Histórico Lançado ({historicalData.length})</span>
                            </div>

                            <div className="overflow-y-auto flex-1 max-h-[450px]">
                                {sortedHistory.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-400">
                                        <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                        <p className="text-xs font-semibold">Nenhum registro histórico importado ou lançado.</p>
                                        <p className="text-[10px] text-gray-400 mt-1">Use a importação CSV ou o formulário ao lado.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left text-xs font-medium border-collapse">
                                        <thead className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 sticky top-0 text-xs tracking-wide border-b border-gray-200 dark:border-gray-700">
                                            <tr>
                                                <th className="p-3">Período</th>
                                                <th className="p-3">Cliente</th>
                                                <th className="p-3 text-right">Vendas Sist.</th>
                                                <th className="p-3 text-right">Custo Sist.</th>
                                                <th className="p-3 text-right">Manut.</th>
                                                <th className="p-3 text-right">Lavagem</th>
                                                <th className="p-3 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {sortedHistory.map((row) => (
                                                <tr key={row.id} className="hover:bg-white dark:hover:bg-gray-800/40 transition-colors">
                                                    <td className="p-3 font-bold text-gray-900 dark:text-white">
                                                        {getMonthName(row.month)}/{row.year}
                                                    </td>
                                                    <td className="p-3 text-gray-700 dark:text-gray-300 max-w-[120px] truncate" title={row.client_name || '-'}>
                                                        {row.client_name || <span className="text-gray-400 italic font-normal">-</span>}
                                                    </td>
                                                    <td className="p-3 text-right text-gray-700 dark:text-gray-300">
                                                        {formatCurrency(row.venda_sistema)}
                                                    </td>
                                                    <td className="p-3 text-right text-gray-700 dark:text-gray-300">
                                                        {formatCurrency(row.custo_sistema || 0)}
                                                    </td>
                                                    <td className="p-3 text-right text-gray-700 dark:text-gray-300">
                                                        {formatCurrency(row.manutencao)}
                                                    </td>
                                                    <td className="p-3 text-right text-gray-700 dark:text-gray-300">
                                                        {formatCurrency(row.lavagem)}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {deleteConfirmId === row.id ? (
                                                            <div className="flex items-center justify-center gap-1.5 animate-fadeIn">
                                                                <button
                                                                    onClick={() => handleDelete(row.id)}
                                                                    className="bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] px-2 py-1 rounded transition-colors"
                                                                    title="Confirmar exclusão"
                                                                >
                                                                    Sim
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeleteConfirmId(null)}
                                                                    className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-[10px] px-2 py-1 rounded transition-colors"
                                                                    title="Cancelar"
                                                                >
                                                                    Não
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                disabled={isLoading}
                                                                onClick={() => setDeleteConfirmId(row.id)}
                                                                className="text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                                                                title="Excluir"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50">
                    <button 
                        onClick={onClose}
                        className="bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 px-5 py-2.5 rounded-xl text-xs font-bold transition-all text-gray-700 dark:text-gray-200 shadow-sm"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};
