import React, { useState, useMemo } from 'react';
import { CreditCardIcon, XCircleIcon, PrinterIcon } from '../../assets/icons';
import type { FinancialCategory, FinancialTransaction } from '../../types';

interface CreditCardDREModalProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: FinancialTransaction[];
    categories: FinancialCategory[];
    year: number;
}

const formatCurrency = (value: number) => {
    if (isNaN(value) || value === 0) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const CreditCardDREModal: React.FC<CreditCardDREModalProps> = ({
    isOpen,
    onClose,
    transactions,
    categories,
    year
}) => {
    const [statusFilter, setStatusFilter] = useState<'all' | 'pago' | 'pendente'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const months = useMemo(() => [
        { label: 'Jan', value: 1 },
        { label: 'Fev', value: 2 },
        { label: 'Mar', value: 3 },
        { label: 'Abr', value: 4 },
        { label: 'Mai', value: 5 },
        { label: 'Jun', value: 6 },
        { label: 'Jul', value: 7 },
        { label: 'Ago', value: 8 },
        { label: 'Set', value: 9 },
        { label: 'Out', value: 10 },
        { label: 'Nov', value: 11 },
        { label: 'Dez', value: 12 }
    ], []);

    // Filter only active credit card expense transactions for the selected year
    const creditCardTxs = useMemo(() => {
        return transactions.filter(t => {
            if (!t.id.startsWith('cc-') || t.type !== 'despesa' || t.status === 'cancelado') {
                return false;
            }

            const dateRef = t.paymentDate || t.dueDate;
            if (!dateRef) return false;

            const [txYear] = dateRef.split('-').map(Number);
            if (txYear !== year) return false;

            if (statusFilter === 'pago' && t.status !== 'pago') return false;
            if (statusFilter === 'pendente' && t.status !== 'pendente') return false;

            return true;
        });
    }, [transactions, year, statusFilter]);

    // Build the matrix of expenses by Category and Month
    const ccMatrix = useMemo(() => {
        // Group available category info
        const categoryMap = new Map<string, { name: string; group: string }>();
        categories.forEach(c => {
            categoryMap.set(c.id, { name: c.name, group: c.group });
        });

        // Collect all distinct categoryIds present in the filtered transactions
        const distinctCategoryIds = Array.from(new Set(creditCardTxs.map(t => t.categoryId)));

        // Create row data
        const rows = distinctCategoryIds.map(catId => {
            const catInfo = categoryMap.get(catId) || { name: 'Categoria Não Informada', group: 'Geral' };
            
            // Compile monthly values
            const monthlyValues = Array(12).fill(0);
            creditCardTxs.forEach(t => {
                if (t.categoryId === catId) {
                    const dateRef = t.paymentDate || t.dueDate;
                    if (dateRef) {
                        const month = parseInt(dateRef.split('-')[1], 10);
                        if (month >= 1 && month <= 12) {
                            monthlyValues[month - 1] += t.amount;
                        }
                    }
                }
            });

            const total = monthlyValues.reduce((sum, val) => sum + val, 0);

            return {
                categoryId: catId,
                categoryName: catInfo.name,
                categoryGroup: catInfo.group,
                monthlyValues,
                total
            };
        });

        // Filter rows based on search term (case-insensitive)
        const filteredRows = rows.filter(row => 
            row.categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            row.categoryGroup.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => a.categoryName.localeCompare(b.categoryName));

        // Aggregate monthly sums for all filtered rows
        const monthlyTotals = Array(12).fill(0);
        filteredRows.forEach(row => {
            row.monthlyValues.forEach((val, idx) => {
                monthlyTotals[idx] += val;
            });
        });

        const grandTotal = monthlyTotals.reduce((sum, val) => sum + val, 0);

        return {
            rows: filteredRows,
            monthlyTotals,
            grandTotal
        };
    }, [creditCardTxs, categories, searchTerm]);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está ativo.');
            return;
        }

        const tableRowsHtml = ccMatrix.rows.map(row => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; font-weight: bold; font-size: 11px; text-align: left;">${row.categoryName} <br/><span style="font-size: 9px; color: #718096; font-weight: normal;">${row.categoryGroup}</span></td>
                ${row.monthlyValues.map(val => `<td style="padding: 10px; font-size: 11px; text-align: right; color: ${val > 0 ? '#e53e3e' : '#2d3748'}">${val > 0 ? formatCurrency(val) : '-'}</td>`).join('')}
                <td style="padding: 10px; font-weight: bold; font-size: 11px; text-align: right; background-color: #edf2f7; color: #e53e3e;">${row.total > 0 ? formatCurrency(row.total) : '-'}</td>
            </tr>
        `).join('');

        const totalRowHtml = `
            <tr style="background-color: #f7fafc; font-weight: bold; border-top: 2px solid #cbd5e0;">
                <td style="padding: 12px 10px; font-size: 12px; text-align: left;">TOTAL GERAL</td>
                ${ccMatrix.monthlyTotals.map(tot => `<td style="padding: 12px 10px; font-size: 11px; text-align: right; color: #e53e3e;">${tot > 0 ? formatCurrency(tot) : '-'}</td>`).join('')}
                <td style="padding: 12px 10px; font-size: 12px; text-align: right; background-color: #edf2f7; color: #e53e3e;">${formatCurrency(ccMatrix.grandTotal)}</td>
            </tr>
        `;

        printWindow.document.write(`
            <html>
            <head>
                <title>DRE Exclusivo de Cartão de Crédito - ${year}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 25px; color: #2d3748; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
                    .title h1 { margin: 0; font-size: 20px; font-weight: 800; color: #1a202c; }
                    .title p { margin: 5px 0 0 0; font-size: 12px; color: #4a5568; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th { padding: 12px 10px; font-size: 11px; font-weight: bold; text-align: right; background-color: #edf2f7; border-bottom: 2px solid #cbd5e0; text-transform: uppercase; }
                    th:first-child { text-align: left; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">
                        <h1>DRE de Cartão de Crédito - Exercício ${year}</h1>
                        <p>Visão de desembolso por categoria - Regime de Caixa (Filtro: ${statusFilter === 'all' ? 'Todos os Lançamentos' : statusFilter === 'pago' ? 'Apenas Pagos' : 'Apenas Pendentes'})</p>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 200px; text-align: left;">Categoria</th>
                            ${months.map(m => `<th>${m.label}</th>`).join('')}
                            <th style="background-color: #cbd5e0;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                        ${totalRowHtml}
                    </tbody>
                </table>
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" id="modal-dre-cartao">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity" onClick={onClose} />

            {/* Container */}
            <div className="flex min-h-full items-center justify-center p-4 sm:p-6 text-center">
                <div className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 text-left shadow-2xl transition-all w-full max-w-7xl border border-gray-100 dark:border-gray-700 animate-slide-up">
                    
                    {/* Header */}
                    <div className="bg-gray-50 dark:bg-gray-900/60 px-6 py-5 border-b border-gray-150 dark:border-gray-700/80 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
                                <CreditCardIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-gray-900 dark:text-white tracking-tight">DRE de Cartão de Crédito - {year}</h3>
                                <p className="text-[11px] text-gray-400 font-bold tracking-tight">Análise de gastos e previsões por categoria mês a mês</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button 
                                onClick={handlePrint}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] font-black text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition-colors shrink-0 shadow-sm cursor-pointer"
                            >
                                <PrinterIcon className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Imprimir DRE</span>
                            </button>
                            <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer outline-none">
                                <XCircleIcon className="w-7 h-7" />
                            </button>
                        </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 dark:bg-gray-900/50 p-1 rounded-xl border border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${statusFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                            >
                                Todos os lançamentos
                            </button>
                            <button
                                onClick={() => setStatusFilter('pago')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${statusFilter === 'pago' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                            >
                                Apenas Pagos
                            </button>
                            <button
                                onClick={() => setStatusFilter('pendente')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${statusFilter === 'pendente' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/10' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                            >
                                Apenas Pendentes (Previsão)
                            </button>
                        </div>

                        <div className="w-full md:w-64">
                            <input
                                type="text"
                                placeholder="Filtrar categoria..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full text-xs font-bold rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-3 py-2 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 border focus:border-transparent outline-none shadow-inner"
                            />
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="p-6 overflow-x-auto custom-scrollbar">
                        <div className="border border-gray-150 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-gray-900">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900">
                                    <tr>
                                        <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 sticky left-0 z-20 bg-gray-50 dark:bg-gray-900 border-r border-gray-150 dark:border-gray-700 w-52">
                                            Categoria / Grupo
                                        </th>
                                        {months.map(m => (
                                            <th key={m.label} className="px-3 py-3.5 text-right text-[11px] font-bold text-gray-500 dark:text-gray-400 min-w-[85px] border-r border-gray-100 dark:border-gray-800">
                                                {m.label}
                                            </th>
                                        ))}
                                        <th className="px-4 py-3.5 text-right text-xs font-bold text-gray-900 dark:text-white bg-indigo-50/50 dark:bg-indigo-950/20 min-w-[100px] border-l border-gray-200 dark:border-gray-700">
                                            Total Categoria
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-850 bg-white dark:bg-gray-800">
                                    {ccMatrix.rows.map(row => (
                                        <tr key={row.categoryId} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/20 transition-colors">
                                            <td className="px-4 py-3.5 whitespace-nowrap font-black text-[12px] text-gray-800 dark:text-gray-200 sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-gray-150 dark:border-gray-700 shadow-[2px_0_5px_rgba(0,0,0,0.01)]">
                                                {row.categoryName}
                                                <span className="block text-[9px] font-bold text-gray-400 dark:text-gray-500 tracking-tighter mt-0.5">
                                                    {row.categoryGroup}
                                                </span>
                                            </td>
                                            {row.monthlyValues.map((val, idx) => (
                                                <td key={idx} className="px-3 py-3.5 text-right text-[11px] font-bold whitespace-nowrap border-r border-gray-100 dark:border-gray-850/50 text-red-600/90 dark:text-red-400/90">
                                                    {val > 0 ? formatCurrency(val) : '-'}
                                                </td>
                                            ))}
                                            <td className="px-4 py-3.5 text-right text-[11.5px] font-black whitespace-nowrap bg-indigo-50/30 dark:bg-indigo-950/10 border-l border-gray-150 dark:border-gray-700 text-red-700 dark:text-red-300">
                                                {row.total > 0 ? formatCurrency(row.total) : formatCurrency(0)}
                                            </td>
                                        </tr>
                                    ))}

                                    {ccMatrix.rows.length === 0 && (
                                        <tr>
                                            <td colSpan={14} className="px-6 py-20 text-center space-y-3">
                                                <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center mx-auto text-gray-300 dark:text-gray-600 border border-dashed border-gray-200 dark:border-gray-700">
                                                    <CreditCardIcon className="w-6 h-6 animate-pulse" />
                                                </div>
                                                <p className="text-gray-400 font-bold italic text-xs tracking-tight">
                                                    Nenhum gasto lançado em cartão de crédito para o exercício {year}.
                                                </p>
                                            </td>
                                        </tr>
                                    )}

                                    {/* Subtotal row representing overall sum */}
                                    {ccMatrix.rows.length > 0 && (
                                        <tr className="bg-gray-900 text-white font-black border-t-2 border-gray-300 dark:border-gray-600 shadow-md">
                                            <td className="px-4 py-4 text-xs font-black uppercase sticky left-0 z-10 bg-gray-900 border-r border-gray-700">
                                                Total faturado cartão
                                            </td>
                                            {ccMatrix.monthlyTotals.map((tot, idx) => (
                                                <td key={idx} className="px-3 py-4 text-right text-[11px] font-black border-r border-gray-800 text-red-300">
                                                    {tot > 0 ? formatCurrency(tot) : '-'}
                                                </td>
                                            ))}
                                            <td className="px-4 py-4 text-right text-xs font-black bg-indigo-950/90 border-l border-gray-700 text-red-300">
                                                {formatCurrency(ccMatrix.grandTotal)}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
