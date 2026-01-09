import React, { useMemo } from 'react';
import { PrinterIcon, TableIcon } from '../../assets/icons';
import type { FinancialTransaction, FinancialCategory } from '../../types';
import type { DrePeriodType } from '../../pages/FinanceiroPage';

interface DREViewProps {
    transactions: FinancialTransaction[]; 
    categories: FinancialCategory[];
    periodType: DrePeriodType;
    isCCGrouped: boolean;
    isGroupedByManagerial?: boolean;
}

const formatCurrency = (value: number) => {
    if (isNaN(value) || value === 0) return '-';
    if (Math.abs(value) >= 1000000) {
        return (value / 1000000).toFixed(1) + 'M';
    }
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

const getColumnsConfig = (type: DrePeriodType) => {
    switch (type) {
        case 'trimestral':
            return [
                { label: '1º Trim', months: [0, 1, 2] },
                { label: '2º Trim', months: [3, 4, 5] },
                { label: '3º Trim', months: [6, 7, 8] },
                { label: '4º Trim', months: [9, 10, 11] },
            ];
        case 'semestral':
            return [
                { label: '1º Sem', months: [0, 1, 2, 3, 4, 5] },
                { label: '2º Sem', months: [6, 7, 8, 9, 10, 11] },
            ];
        case 'anual':
            return [
                { label: 'Ano', months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
            ];
        case 'mensal':
        default:
            return [
                { label: 'Jan', months: [0] }, { label: 'Fev', months: [1] }, { label: 'Mar', months: [2] },
                { label: 'Abr', months: [3] }, { label: 'Mai', months: [4] }, { label: 'Jun', months: [5] },
                { label: 'Jul', months: [6] }, { label: 'Ago', months: [7] }, { label: 'Set', months: [8] },
                { label: 'Out', months: [9] }, { label: 'Nov', months: [10] }, { label: 'Dez', months: [11] }
            ];
    }
};

const DREView: React.FC<DREViewProps> = ({ transactions, categories, periodType, isCCGrouped, isGroupedByManagerial = false }) => {
    
    const matrixData = useMemo(() => {
        const columns = getColumnsConfig(periodType);
        const getCategoryType = (id: string) => categories.find(c => c.id === id)?.type;
        const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'N/A';
        const getCategoryGroup = (id: string) => categories.find(c => c.id === id)?.group || 'Outros/Geral';

        const columnData = columns.map(() => ({
            receitas: {} as Record<string, number>,
            receitaBruta: 0,
            impostosMap: {} as Record<string, number>,
            impostosTotal: 0,
            custosMap: {} as Record<string, number>,
            custosTotal: 0,
            despesasOperacionais: {} as Record<string, number>,
            totalDespesas: 0
        }));

        const activeReceitaRows = new Set<string>();
        const activeImpostoRows = new Set<string>();
        const activeCustoRows = new Set<string>();
        const activeExpenseRows = new Set<string>();

        transactions.forEach(t => {
            const dateRef = t.paymentDate || t.dueDate;
            if (!dateRef) return;

            const monthIndex = parseInt(dateRef.split('-')[1]) - 1; 
            const colIndex = columns.findIndex(col => col.months.includes(monthIndex));
            if (colIndex === -1) return;

            let catType = getCategoryType(t.categoryId);
            let catName = getCategoryName(t.categoryId);
            const amount = t.amount;

            if (isCCGrouped && t.id.startsWith('cc-') && t.type === 'despesa') {
                catName = 'Cartão de crédito';
                catType = 'despesa';
            }

            const rowLabel = isGroupedByManagerial ? getCategoryGroup(t.categoryId) : catName;

            if (catType === 'receita') {
                columnData[colIndex].receitaBruta += amount;
                columnData[colIndex].receitas[rowLabel] = (columnData[colIndex].receitas[rowLabel] || 0) + amount;
                activeReceitaRows.add(rowLabel);
            } else if (catName.toLowerCase().includes('imposto')) {
                columnData[colIndex].impostosTotal += amount;
                columnData[colIndex].impostosMap[rowLabel] = (columnData[colIndex].impostosMap[rowLabel] || 0) + amount;
                activeImpostoRows.add(rowLabel);
            } else if (catName.toLowerCase().includes('fornecedor')) {
                columnData[colIndex].custosTotal += amount;
                columnData[colIndex].custosMap[rowLabel] = (columnData[colIndex].custosMap[rowLabel] || 0) + amount;
                activeCustoRows.add(rowLabel);
            } else if (catType === 'despesa') {
                columnData[colIndex].totalDespesas += amount;
                columnData[colIndex].despesasOperacionais[rowLabel] = (columnData[colIndex].despesasOperacionais[rowLabel] || 0) + amount;
                activeExpenseRows.add(rowLabel);
            }
        });

        const finalGrid = columnData.map(col => {
            const receitaLiquida = col.receitaBruta - col.impostosTotal;
            const lucroBruto = receitaLiquida - col.custosTotal;
            const lucroLiquido = lucroBruto - col.totalDespesas;
            const margem = col.receitaBruta > 0 ? (lucroLiquido / col.receitaBruta) * 100 : 0;
            return { ...col, receitaLiquida, lucroBruto, lucroLiquido, margem };
        });

        const totals = {
            receitaBruta: finalGrid.reduce((acc, c) => acc + c.receitaBruta, 0),
            impostosTotal: finalGrid.reduce((acc, c) => acc + c.impostosTotal, 0),
            receitaLiquida: finalGrid.reduce((acc, c) => acc + c.receitaLiquida, 0),
            custosTotal: finalGrid.reduce((acc, c) => acc + c.custosTotal, 0),
            lucroBruto: finalGrid.reduce((acc, c) => acc + c.lucroBruto, 0),
            totalDespesas: finalGrid.reduce((acc, c) => acc + c.totalDespesas, 0),
            lucroLiquido: finalGrid.reduce((acc, c) => acc + c.lucroLiquido, 0),
            receitas: {} as Record<string, number>,
            impostosMap: {} as Record<string, number>,
            custosMap: {} as Record<string, number>,
            despesasOperacionais: {} as Record<string, number>
        };

        activeReceitaRows.forEach(row => totals.receitas[row] = finalGrid.reduce((acc, col) => acc + (col.receitas[row] || 0), 0));
        activeImpostoRows.forEach(row => totals.impostosMap[row] = finalGrid.reduce((acc, col) => acc + (col.impostosMap[row] || 0), 0));
        activeCustoRows.forEach(row => totals.custosMap[row] = finalGrid.reduce((acc, col) => acc + (col.custosMap[row] || 0), 0));
        activeExpenseRows.forEach(row => totals.despesasOperacionais[row] = finalGrid.reduce((acc, col) => acc + (col.despesasOperacionais[row] || 0), 0));

        return {
            columnsData: finalGrid,
            columnHeaders: columns.map(c => c.label),
            receitaRows: Array.from(activeReceitaRows).sort(),
            impostoRows: Array.from(activeImpostoRows).sort(),
            custoRows: Array.from(activeCustoRows).sort(),
            expenseRows: Array.from(activeExpenseRows).sort(),
            totals: { ...totals, margem: totals.receitaBruta > 0 ? (totals.lucroLiquido / totals.receitaBruta) * 100 : 0 }
        };
    }, [transactions, categories, periodType, isCCGrouped, isGroupedByManagerial]);

    const handlePrint = () => window.print();

    const TableRow = ({ label, field, isBold = false, isNegative = false, type = 'fixed', bgColor = '', textColor = 'text-gray-700 dark:text-gray-300' }: any) => (
        <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${bgColor}`}>
            <td className={`px-3 py-2 whitespace-nowrap sticky left-0 z-10 border-r border-gray-200 dark:border-gray-700 ${bgColor || 'bg-white dark:bg-gray-800'} ${isBold ? 'font-bold' : 'font-medium pl-6'} ${textColor} text-[11px]`}>
                {label}
            </td>
            {matrixData.columnsData.map((col, idx) => {
                let val = 0;
                if (type === 'receita') val = col.receitas[field] || 0;
                else if (type === 'imposto') val = col.impostosMap[field] || 0;
                else if (type === 'custo') val = col.custosMap[field] || 0;
                else if (type === 'despesa') val = col.despesasOperacionais[field] || 0;
                else val = (col as any)[field];

                return (
                    <td key={idx} className={`px-2 py-2 text-right text-[11px] whitespace-nowrap border-r border-gray-100 dark:border-gray-800 ${isNegative && val > 0 ? 'text-red-500' : textColor} ${isBold ? 'font-bold' : ''}`}>
                        {val !== 0 ? (isNegative ? `(${formatCurrency(val)})` : formatCurrency(val)) : '-'}
                    </td>
                );
            })}
            <td className={`px-3 py-2 text-right text-[11px] font-bold whitespace-nowrap border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 ${isNegative && (type === 'receita' ? matrixData.totals.receitas[field] : type === 'imposto' ? matrixData.totals.impostosMap[field] : type === 'custo' ? matrixData.totals.custosMap[field] : type === 'despesa' ? matrixData.totals.despesasOperacionais[field] : (matrixData.totals as any)[field]) > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                 {(() => {
                    let val = 0;
                    if (type === 'receita') val = matrixData.totals.receitas[field] || 0;
                    else if (type === 'imposto') val = matrixData.totals.impostosMap[field] || 0;
                    else if (type === 'custo') val = matrixData.totals.custosMap[field] || 0;
                    else if (type === 'despesa') val = matrixData.totals.despesasOperacionais[field] || 0;
                    else val = (matrixData.totals as any)[field] || 0;
                    return val !== 0 ? (isNegative ? `(${formatCurrency(val)})` : formatCurrency(val)) : '-';
                 })()}
            </td>
        </tr>
    );

    return (
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg print:shadow-none print:border-none print:p-0">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">DRE - {periodType.charAt(0).toUpperCase() + periodType.slice(1)}</h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                        <p className="text-xs text-gray-500 font-medium">Valores em R$ (Regime de Caixa)</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${isCCGrouped ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                            {isCCGrouped ? 'Cartões Agrupados' : 'Cartões Detalhados'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${isGroupedByManagerial ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                            {isGroupedByManagerial ? 'Visão por Grupo' : 'Visão por Categoria'}
                        </span>
                    </div>
                </div>
                <div className="flex gap-2 print:hidden">
                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-xs font-bold">
                        <PrinterIcon className="w-4 h-4" /> Imprimir
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto border border-gray-100 dark:border-gray-700 rounded-xl custom-scrollbar shadow-sm">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                        <tr>
                            <th className="px-3 py-4 text-left text-xs font-bold text-gray-500 sticky left-0 z-20 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 w-48">Categoria / Grupo</th>
                            {matrixData.columnHeaders.map(colLabel => <th key={colLabel} className="px-2 py-4 text-right text-[11px] font-bold text-gray-500 min-w-[80px] border-r border-gray-200 dark:border-gray-800">{colLabel}</th>)}
                            <th className="px-3 py-4 text-right text-xs font-bold text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-800 min-w-[100px] border-l border-gray-300">Total</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100">
                        <TableRow label="(+) Receita Bruta" field="receitaBruta" textColor="text-blue-600" isBold />
                        {matrixData.receitaRows.map(row => <TableRow key={row} label={row} field={row} type="receita" />)}
                        
                        <TableRow label="(-) Impostos sobre Vendas" field="impostosTotal" isNegative isBold bgColor="bg-gray-50/50" />
                        {matrixData.impostoRows.map(row => <TableRow key={row} label={row} field={row} type="imposto" isNegative />)}
                        
                        <TableRow label="(=) Receita Líquida" field="receitaLiquida" isBold bgColor="bg-gray-100 dark:bg-gray-700/50" />
                        
                        <TableRow label="(-) Custos (Fornecedores)" field="custosTotal" isNegative isBold bgColor="bg-gray-50/50" />
                        {matrixData.custoRows.map(row => <TableRow key={row} label={row} field={row} type="custo" isNegative />)}
                        
                        <TableRow label="(=) Lucro Bruto" field="lucroBruto" isBold bgColor="bg-indigo-50 dark:bg-indigo-900/20" textColor="text-indigo-700" />

                        <tr><td colSpan={matrixData.columnHeaders.length + 2} className="px-3 py-2 bg-gray-50 text-[11px] font-bold text-gray-500 border-y">Despesas operacionais</td></tr>
                        {matrixData.expenseRows.map(row => <TableRow key={row} label={row} field={row} type="despesa" isNegative />)}
                        <TableRow label="Total despesas operacionais" field="totalDespesas" isBold isNegative textColor="text-red-600" bgColor="bg-red-50/50" />

                        <TableRow label="(=) Lucro Líquido" field="lucroLiquido" isBold bgColor="bg-green-100 dark:bg-green-900/30" textColor="text-green-800" />
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-900 border-t-2">
                        <tr>
                            <td className="px-3 py-3 text-xs font-bold text-gray-500 sticky left-0 bg-gray-50 border-r">Margem líquida %</td>
                            {matrixData.columnsData.map((col, idx) => (
                                <td key={idx} className={`px-2 py-3 text-right text-[11px] font-bold border-r ${col.margem >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {col.receitaBruta > 0 ? `${col.margem.toFixed(1)}%` : '-'}
                                </td>
                            ))}
                            <td className={`px-3 py-3 text-right text-xs font-extrabold border-l bg-gray-200 ${matrixData.totals.margem >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {matrixData.totals.margem.toFixed(1)}%
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default DREView;