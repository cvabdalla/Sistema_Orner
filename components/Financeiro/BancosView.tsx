import React, { useState, useEffect, useMemo } from 'react';
import { 
    EditIcon, PlusIcon, CheckCircleIcon, 
    XCircleIcon, TableIcon, SearchIcon, FilterIcon, 
    CreditCardIcon, DollarIcon, CalendarIcon, LockClosedIcon
} from '../../assets/icons';
import type { BankAccount, User } from '../../types';
import { BRAZIL_BANKS } from '../../constants';
import { dataService } from '../../services/dataService';
import Modal from '../Modal';

interface BancosViewProps {
    currentUser: User;
}

const BancosView: React.FC<BancosViewProps> = ({ currentUser }) => {
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [formData, setFormData] = useState<Partial<BankAccount>>({
        accountName: '',
        bankName: '',
        bankCode: '',
        agency: '',
        accountNumber: '',
        initialBalance: 0,
        initialBalanceDate: new Date().toISOString().split('T')[0],
        active: true
    });
    const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

    const ADMIN_PROFILE_ID = '001';

    const loadData = async () => {
        setIsLoading(true);
        try {
            const isAdmin = currentUser.profileId === ADMIN_PROFILE_ID;
            const data = await dataService.getAll<BankAccount>('bank_accounts', currentUser.id, isAdmin);
            setAccounts(data.sort((a, b) => a.accountName.localeCompare(b.accountName)));
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentUser]);

    const handleOpenModal = (account?: BankAccount) => {
        if (account) {
            setEditingAccountId(account.id);
            setFormData({ ...account });
        } else {
            setEditingAccountId(null);
            setFormData({
                accountName: '',
                bankName: BRAZIL_BANKS[0].name,
                bankCode: BRAZIL_BANKS[0].code,
                agency: '',
                accountNumber: '',
                initialBalance: 0,
                initialBalanceDate: new Date().toISOString().split('T')[0],
                active: true
            });
        }
        // Fixed: changed setIsModalOpen to setModalOpen
        setModalOpen(true);
    };

    const handleBankChange = (name: string) => {
        const found = BRA_BANKS.find(b => b.name === name);
        setFormData(prev => ({
            ...prev,
            bankName: name,
            bankCode: found ? found.code : prev.bankCode
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.accountName || !formData.bankName) return;

        const data: BankAccount = {
            id: editingAccountId || `bank-${Date.now()}`,
            owner_id: currentUser.id,
            accountName: formData.accountName!,
            bankName: formData.bankName!,
            bankCode: formData.bankCode!,
            agency: formData.agency || '',
            accountNumber: formData.accountNumber || '',
            initialBalance: Number(formData.initialBalance || 0),
            initialBalanceDate: formData.initialBalanceDate || new Date().toISOString().split('T')[0],
            active: formData.active ?? true
        };

        await dataService.save('bank_accounts', data);
        // Fixed: changed setIsModalOpen to setModalOpen
        setModalOpen(false);
        loadData();
    };

    const BRA_BANKS = useMemo(() => BRAZIL_BANKS, []);

    const filteredAccounts = accounts.filter(acc => 
        acc.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.bankName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const inputClass = "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-xs font-semibold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed";
    const labelClass = "block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5 tracking-tight";

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                        <TableIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Bancos</h2>
                        <p className="text-xs text-gray-500 font-medium tracking-tight">Gestão de contas e instituições financeiras</p>
                    </div>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                >
                    <PlusIcon className="w-4 h-4" /> Novo banco
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nome ou banco..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border-none text-sm font-semibold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 font-bold text-[11px] text-gray-500 border-b dark:border-gray-700">
                            <tr>
                                <th className="px-6 py-4">Nome da conta</th>
                                <th className="px-6 py-4">Banco</th>
                                <th className="px-6 py-4 text-center">Código</th>
                                <th className="px-6 py-4">Agência/Conta</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredAccounts.length > 0 ? filteredAccounts.map(acc => (
                                <tr key={acc.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white text-xs">{acc.accountName}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300 font-medium text-xs">{acc.bankName}</td>
                                    <td className="px-6 py-4 text-center text-indigo-600 font-black text-xs">{acc.bankCode}</td>
                                    <td className="px-6 py-4">
                                        <p className="text-[10px] font-black text-gray-700 dark:text-gray-200">Ag: {acc.agency}</p>
                                        <p className="text-[10px] text-gray-400 font-bold mt-0.5">Cc: {acc.accountNumber}</p>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black ${acc.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {acc.active ? 'Ativa' : 'Inativa'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button onClick={() => handleOpenModal(acc)} className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors" title="Configurar conta"><EditIcon className="w-5 h-5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic font-bold">Nenhum banco cadastrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <Modal 
                    title={editingAccountId ? "Configurar conta" : "Novo banco"} 
                    onClose={() => setModalOpen(false)}
                    maxWidth="max-w-sm"
                >
                    <form onSubmit={handleSave} className="space-y-4 pt-1 animate-fade-in">
                        {editingAccountId && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800 mb-2 flex items-start gap-2">
                                <LockClosedIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 leading-tight">
                                    Os dados desta conta estão bloqueados. Você só pode alterar o status de ativação abaixo.
                                </p>
                            </div>
                        )}

                        <div>
                            <label className={labelClass}>Nome da conta</label>
                            <input 
                                required
                                disabled={!!editingAccountId}
                                type="text" 
                                value={formData.accountName}
                                onChange={e => setFormData({...formData, accountName: e.target.value})}
                                className={inputClass}
                                placeholder="Digite o nome da conta"
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Banco</label>
                            <select 
                                required
                                disabled={!!editingAccountId}
                                value={formData.bankName}
                                onChange={e => handleBankChange(e.target.value)}
                                className={inputClass}
                            >
                                {BRA_BANKS.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>Código do banco</label>
                            <input 
                                required
                                disabled={!!editingAccountId}
                                type="text" 
                                value={formData.bankCode}
                                onChange={e => setFormData({...formData, bankCode: e.target.value})}
                                className={inputClass}
                                placeholder="Código"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Agência</label>
                                <input 
                                    disabled={!!editingAccountId}
                                    type="text" 
                                    value={formData.agency}
                                    onChange={e => setFormData({...formData, agency: e.target.value})}
                                    className={inputClass}
                                    placeholder="Agência"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Conta</label>
                                <input 
                                    disabled={!!editingAccountId}
                                    type="text" 
                                    value={formData.accountNumber}
                                    onChange={e => setFormData({...formData, accountNumber: e.target.value})}
                                    className={inputClass}
                                    placeholder="Número da conta"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Saldo inicial (R$)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">R$</span>
                                    <input 
                                        required
                                        disabled={!!editingAccountId}
                                        type="number" 
                                        step="0.01"
                                        value={formData.initialBalance}
                                        onChange={e => setFormData({...formData, initialBalance: parseFloat(e.target.value) || 0})}
                                        className={`${inputClass} pl-8 text-indigo-600`}
                                        placeholder="0,00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Data do saldo</label>
                                <input 
                                    required
                                    disabled={!!editingAccountId}
                                    type="date" 
                                    value={formData.initialBalanceDate}
                                    onChange={e => setFormData({...formData, initialBalanceDate: e.target.value})}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <label className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl cursor-pointer hover:bg-white transition-all border border-gray-100 dark:border-gray-800 hover:border-indigo-100 group">
                                <input 
                                    type="checkbox" 
                                    checked={formData.active} 
                                    onChange={e => setFormData({...formData, active: e.target.checked})} 
                                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" 
                                />
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 transition-colors">Conta bancária ativa</span>
                                    <span className="text-[9px] text-gray-400 font-bold">Define se a conta será usada nos cálculos</span>
                                </div>
                            </label>
                        </div>

                        <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                            <button 
                                type="button" 
                                onClick={() => setModalOpen(false)}
                                className="flex-1 py-2.5 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                            >
                                {editingAccountId ? 'Salvar alterações' : 'Cadastrar conta'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default BancosView;