
import React, { useState, useRef } from 'react';
import Modal from '../Modal';
import { UploadIcon, CheckCircleIcon } from '../../assets/icons';
import type { FinancialTransaction, FinancialTransactionType, FinancialCategory } from '../../types';

interface OFXImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (transactions: FinancialTransaction[]) => void;
    categories: FinancialCategory[];
}

interface ParsedTransaction {
    id: string;
    description: string;
    amount: number;
    date: string;
    type: FinancialTransactionType;
    categoryId: string;
    selected: boolean;
}

const OFXImportModal: React.FC<OFXImportModalProps> = ({ isOpen, onClose, onImport, categories }) => {
    const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
    const [fileLoaded, setFileLoaded] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const parseOFX = (content: string) => {
        const transactions: ParsedTransaction[] = [];
        const transactionBlocks = content.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/g);

        if (transactionBlocks) {
            transactionBlocks.forEach((block, index) => {
                const typeMatch = block.match(/<TRNTYPE>(.*?)(\r|\n|<)/);
                const dateMatch = block.match(/<DTPOSTED>(.*?)(\r|\n|<)/);
                const amountMatch = block.match(/<TRNAMT>(.*?)(\r|\n|<)/);
                const memoMatch = block.match(/<MEMO>(.*?)(\r|\n|<)/);
                const fitidMatch = block.match(/<FITID>(.*?)(\r|\n|<)/);

                if (dateMatch && amountMatch) {
                    const rawDate = dateMatch[1].trim(); 
                    const rawAmount = parseFloat(amountMatch[1].trim().replace(',', '.'));
                    const formattedDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
                    let type: FinancialTransactionType = 'despesa';
                    if (rawAmount > 0) type = 'receita';
                    let description = memoMatch ? memoMatch[1].trim() : 'Transação Bancária';
                    description = description.replace(/&amp;/g, '&');

                    transactions.push({
                        id: fitidMatch ? fitidMatch[1].trim() : `ofx-${Date.now()}-${index}`,
                        description,
                        amount: Math.abs(rawAmount),
                        date: formattedDate,
                        type,
                        categoryId: '',
                        selected: true
                    });
                }
            });
        }
        return transactions;
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                const transactions = parseOFX(content);
                setParsedTransactions(transactions);
                setFileLoaded(true);
            };
            reader.readAsText(file);
        }
    };

    const handleConfirmImport = () => {
        const selected = parsedTransactions.filter(t => t.selected);
        // Fixed: Added owner_id: '' to satisfy FinancialTransaction requirements.
        // The parent component's handleImportTransactions will set the correct owner_id.
        const newTransactions: FinancialTransaction[] = selected.map(t => ({
            id: `imp-${Date.now()}-${t.id}`,
            owner_id: '',
            description: t.description,
            amount: t.amount,
            type: t.type,
            dueDate: t.date,
            launchDate: new Date().toISOString().split('T')[0],
            paymentDate: t.date,
            status: 'pago',
            categoryId: t.categoryId
        }));

        onImport(newTransactions);
        onClose();
        setParsedTransactions([]);
        setFileLoaded(false);
    };

    if (!isOpen) return null;

    return (
        <Modal title="Importar Extrato Bancário (OFX)" onClose={onClose} maxWidth="max-w-6xl">
            {!fileLoaded ? (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                    <UploadIcon className="w-16 h-16 text-gray-400 mb-4" />
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-2 font-medium">Upload de Extrato</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
                        Selecione um arquivo .OFX ou .OFC do seu banco para importar as movimentações e classificá-las automaticamente.
                    </p>
                    <label className="cursor-pointer px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md font-medium text-sm flex items-center gap-2">
                        <UploadIcon className="w-5 h-5" />
                        Escolher Arquivo
                        <input type="file" accept=".ofx,.ofc" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                    </label>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            <strong>{parsedTransactions.length}</strong> transações encontradas. Classifique os itens antes de importar.
                        </p>
                        <button onClick={() => setFileLoaded(false)} className="text-xs text-indigo-600 hover:underline font-medium">Trocar arquivo</button>
                    </div>

                    <div className="max-h-[500px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
                        <table className="min-w-full text-sm text-left">
                            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-3 py-3 w-10 text-center">
                                        <input 
                                            type="checkbox" 
                                            checked={parsedTransactions.every(t => t.selected)}
                                            onChange={(e) => setParsedTransactions(prev => prev.map(t => ({...t, selected: e.target.checked})))}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                        />
                                    </th>
                                    <th className="px-3 py-3 w-28">Data</th>
                                    <th className="px-3 py-3">Descrição</th>
                                    <th className="px-3 py-3 w-32 text-right">Valor</th>
                                    <th className="px-3 py-3 w-32">Tipo</th>
                                    <th className="px-3 py-3 w-48">Categoria</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                                {parsedTransactions.map(t => {
                                    const availableCategories = categories.filter(c => c.type === t.type);
                                    return (
                                        <tr key={t.id} className={`hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors ${!t.selected ? 'opacity-50 grayscale' : ''}`}>
                                            <td className="px-3 py-2 text-center">
                                                <input 
                                                    type="checkbox" 
                                                    checked={t.selected}
                                                    onChange={() => setParsedTransactions(prev => prev.map(x => x.id === t.id ? { ...x, selected: !x.selected } : x))}
                                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {new Date(t.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                                            </td>
                                            <td className="px-3 py-2">
                                                <input 
                                                    type="text" 
                                                    value={t.description}
                                                    onChange={(e) => setParsedTransactions(prev => prev.map(x => x.id === t.id ? { ...x, description: e.target.value } : x))}
                                                    disabled={!t.selected}
                                                    className="w-full bg-transparent border-none p-1 focus:ring-0 text-gray-800 dark:text-white text-sm"
                                                />
                                            </td>
                                            <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${t.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                                                {t.type === 'receita' ? '+' : '-'} {t.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={t.type}
                                                    onChange={(e) => setParsedTransactions(prev => prev.map(x => x.id === t.id ? { ...x, type: e.target.value as any, categoryId: '' } : x))}
                                                    disabled={!t.selected}
                                                    className={`w-full text-xs rounded border-gray-300 dark:border-gray-600 py-1 pl-2 pr-6 focus:ring-indigo-500 focus:border-indigo-500 ${
                                                        t.type === 'receita' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                                                    }`}
                                                >
                                                    <option value="receita">Receita</option>
                                                    <option value="despesa">Despesa</option>
                                                </select>
                                            </td>
                                            <td className="px-3 py-2">
                                                <select
                                                    value={t.categoryId}
                                                    onChange={(e) => setParsedTransactions(prev => prev.map(x => x.id === t.id ? { ...x, categoryId: e.target.value } : x))}
                                                    disabled={!t.selected}
                                                    className="w-full text-xs rounded border-gray-300 dark:border-gray-600 py-1 pl-2 pr-6 bg-white dark:bg-gray-700"
                                                >
                                                    <option value="">Selecione...</option>
                                                    {availableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700">
                        <div className="text-xs text-gray-500">* Transações importadas serão marcadas como "Pagas".</div>
                        <div className="flex gap-3">
                            <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200">Cancelar</button>
                            <button 
                                onClick={handleConfirmImport}
                                disabled={!parsedTransactions.some(t => t.selected)}
                                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm font-medium"
                            >
                                <CheckCircleIcon className="w-5 h-5" />
                                Importar {parsedTransactions.filter(t => t.selected).length} Itens
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default OFXImportModal;
