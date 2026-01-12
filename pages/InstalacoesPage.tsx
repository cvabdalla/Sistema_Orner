import React, { useState, useEffect, useMemo } from 'react';
import { 
    CalendarIcon, ClipboardListIcon, PlusIcon, TrashIcon, 
    ArrowLeftIcon, ChevronDownIcon, CheckCircleIcon, 
    EditIcon, MapIcon, BoltIcon, ClockIcon, UsersIcon, XCircleIcon, ExclamationTriangleIcon
} from '../assets/icons';
import Modal from '../components/Modal';
import { dataService } from '../services/dataService';
import type { InstalacoesPageProps, ActivityCatalogEntry, ActivityAppointment, SavedOrcamento, PainelConfig, User, AppointmentLogEntry } from '../types';

const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
    const hour = Math.floor(i / 2) + 7; // Começa às 07:00
    const minutes = i % 2 === 0 ? '00' : '30';
    return `${String(hour).padStart(2, '0')}:${minutes}`;
});

const GRID_HOURS = Array.from({ length: 14 }, (_, i) => 7 + i);

const toSentenceCase = (str: string) => {
    if (!str) return '';
    const clean = str.toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const SectionHeader: React.FC<{ icon: React.ReactElement<any>; title: string; color?: string; rightElement?: React.ReactNode }> = ({ icon, title, color = "bg-indigo-600", rightElement }) => (
    <div className="flex items-center justify-between mb-3 pb-1 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-2">
            <div className={`p-1 rounded-lg text-white ${color}`}>
                {React.cloneElement(icon, { className: "w-3 h-3" })}
            </div>
            <h4 className="text-[10px] font-black text-gray-500 dark:text-gray-400 tracking-widest">{title}</h4>
        </div>
        {rightElement && <div>{rightElement}</div>}
    </div>
);

const InstalacoesPage: React.FC<InstalacoesPageProps> = ({ currentUser }) => {
    const [catalog, setCatalog] = useState<ActivityCatalogEntry[]>([]);
    const [appointments, setAppointments] = useState<ActivityAppointment[]>([]);
    const [orcamentos, setOrcamentos] = useState<SavedOrcamento[]>([]);
    const [cancelLog, setCancelLog] = useState<AppointmentLogEntry[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingCep, setIsLoadingCep] = useState(false);

    const [calendarViewMode, setCalendarViewMode] = useState<'mensal' | 'semanal' | 'cancelados'>('mensal');
    const [currentDate, setCurrentDate] = useState(new Date());

    const [isApptModalOpen, setIsApptModalOpen] = useState(false);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
    const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
    const [isCancelReasonModalOpen, setIsCancelReasonModalOpen] = useState(false);
    const [isLogDetailModalOpen, setIsLogDetailModalOpen] = useState(false);
    
    const [conflictedUsers, setConflictedUsers] = useState<User[]>([]);
    const [selectedLogEntry, setSelectedLogEntry] = useState<AppointmentLogEntry | null>(null);
    const [cancelReasonText, setCancelReasonText] = useState('');
    
    const [editingAppt, setEditingAppt] = useState<ActivityAppointment | null>(null);

    const [apptForm, setApptForm] = useState<Partial<ActivityAppointment>>({
        activityId: '', clientName: '', startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0], startTime: '08:00', endTime: '12:00', isAllDay: false,
        cep: '', address: '', number: '', complement: '', city: '', platesCount: 0, arrangement: '', observations: '', panelsConfig: [], participantIds: [], notifyByEmail: false
    });

    const [tempPainel, setTempPainel] = useState<PainelConfig>({ id: '', linhas: 1, modulos: 1, orientacao: 'Retrato' });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const isAdmin = String(currentUser.profileId) === '001';
            const [catData, apptData, orcData, userData, logData] = await Promise.all([
                dataService.getAll<ActivityCatalogEntry>('activity_catalog', currentUser.id, true),
                dataService.getAll<ActivityAppointment>('activity_appointments', currentUser.id, isAdmin),
                dataService.getAll<SavedOrcamento>('orcamentos', currentUser.id, true),
                dataService.getAll<User>('system_users', undefined, true),
                dataService.getAll<AppointmentLogEntry>('activity_appointments_log', currentUser.id, isAdmin)
            ]);
            setCatalog(catData.sort((a,b) => a.title.localeCompare(b.title)));
            setAppointments(apptData);
            setOrcamentos(orcData.filter(o => o.status === 'Aprovado'));
            setUsers(userData.filter(u => u.active));
            setCancelLog((logData || []).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)));
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    useEffect(() => { loadData(); }, [currentUser.id]);

    useEffect(() => {
        const cleanCep = (apptForm.cep || '').replace(/\D/g, '');
        if (cleanCep.length === 8 && !isSaving) {
            const fetchCep = async () => {
                setIsLoadingCep(true);
                try {
                    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                    const data = await response.json();
                    if (!data.erro) {
                        setApptForm(prev => ({
                            ...prev,
                            address: data.logradouro || prev.address,
                            city: data.localidade || prev.city,
                        }));
                    }
                } catch (e) { console.error("Erro CEP:", e); }
                finally { setIsLoadingCep(false); }
            };
            fetchCep();
        }
    }, [apptForm.cep]);

    const checkConflicts = (data: ActivityAppointment): User[] => {
        if (!data.participantIds || data.participantIds.length === 0) return [];
        const startT = data.isAllDay ? "00:00" : (data.startTime || "00:00");
        const endT = data.isAllDay ? "23:59" : (data.endTime || "23:59");
        const conflicts: User[] = [];
        data.participantIds.forEach(pId => {
            const hasConflict = appointments.some(appt => {
                if (editingAppt && appt.id === editingAppt.id) return false;
                if (!appt.participantIds?.includes(pId)) return false;
                const isOverlappingDate = (data.startDate <= appt.endDate && data.endDate >= appt.startDate);
                if (!isOverlappingDate) return false;
                const aStart = appt.isAllDay ? "00:00" : (appt.startTime || "00:00");
                const aEnd = appt.isAllDay ? "23:59" : (appt.endTime || "23:59");
                return (startT < aEnd && endT > aStart);
            });
            if (hasConflict) {
                const user = users.find(u => u.id === pId);
                if (user) conflicts.push(user);
            }
        });
        return conflicts;
    };

    const handleSaveAppt = async (e: React.FormEvent) => {
        e.preventDefault();
        const selectedActivity = catalog.find(c => c.id === apptForm.activityId);
        const isPersonal = !!selectedActivity?.personalSchedule;
        
        if (!apptForm.participantIds || apptForm.participantIds.length === 0) {
            alert("Selecione pelo menos um membro para a equipe de trabalho.");
            return;
        }

        const data: ActivityAppointment = {
            id: editingAppt ? editingAppt.id : `appt-${Date.now()}`,
            owner_id: currentUser.id,
            activityId: apptForm.activityId!,
            clientName: isPersonal ? 'Agenda pessoal' : apptForm.clientName!,
            startDate: apptForm.startDate!,
            endDate: apptForm.endDate!,
            startTime: apptForm.startTime,
            endTime: apptForm.endTime,
            isAllDay: apptForm.isAllDay,
            cep: isPersonal ? undefined : apptForm.cep,
            address: isPersonal ? 'Agenda pessoal' : apptForm.address!,
            number: isPersonal ? undefined : apptForm.number,
            complement: isPersonal ? undefined : apptForm.complement,
            city: isPersonal ? undefined : apptForm.city,
            platesCount: isPersonal ? 0 : Number(apptForm.platesCount || 0),
            panelsConfig: isPersonal ? undefined : apptForm.panelsConfig,
            arrangement: apptForm.arrangement,
            observations: apptForm.observations,
            participantIds: apptForm.participantIds || [],
            notifyByEmail: apptForm.notifyByEmail
        };
        const conflictList = checkConflicts(data);
        if (conflictList.length > 0) {
            setConflictedUsers(conflictList);
            setIsConflictModalOpen(true);
            return;
        }
        setIsSaving(true);
        try {
            await dataService.save('activity_appointments', data);
            setIsApptModalOpen(false);
            setEditingAppt(null);
            setApptForm({ activityId: '', clientName: '', startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], startTime: '08:00', endTime: '12:00', isAllDay: false, cep: '', address: '', number: '', complement: '', city: '', platesCount: 0, arrangement: '', observations: '', panelsConfig: [], participantIds: [], notifyByEmail: false });
            await loadData();
        } finally { setIsSaving(false); }
    };

    const handleConfirmDeleteWithReason = async () => {
        if (!editingAppt || !cancelReasonText.trim()) return;
        setIsSaving(true);
        try {
            const auditLog: AppointmentLogEntry = {
                id: `log-del-${Date.now()}`,
                owner_id: currentUser.id,
                deletedAt: new Date().toISOString(),
                deletedBy: currentUser.name,
                deletedById: currentUser.id,
                cancelReason: cancelReasonText,
                originalAppointment: editingAppt
            };
            await dataService.save('activity_appointments_log', auditLog);
            await dataService.delete('activity_appointments', editingAppt.id);
            setIsCancelReasonModalOpen(false);
            setIsApptModalOpen(false);
            setIsSummaryModalOpen(false);
            setEditingAppt(null);
            setCancelReasonText('');
            await loadData();
        } finally { setIsSaving(false); }
    };

    const handleOpenApptSummary = (appt: ActivityAppointment) => {
        setEditingAppt(appt);
        setIsSummaryModalOpen(true);
    };

    const handleStartApptEdit = () => {
        if (!editingAppt) return;
        setApptForm({ ...editingAppt, participantIds: editingAppt.participantIds || [], notifyByEmail: false });
        setIsSummaryModalOpen(false);
        setIsApptModalOpen(true);
    };

    const toggleParticipant = (userId: string) => {
        const current = apptForm.participantIds || [];
        if (current.includes(userId)) setApptForm({ ...apptForm, participantIds: current.filter(id => id !== userId) });
        else setApptForm({ ...apptForm, participantIds: [...current, userId] });
    };

    const addPainelConfig = () => {
        const newPanel = { ...tempPainel, id: `p-${Date.now()}` };
        setApptForm(prev => ({
            ...prev,
            panelsConfig: [...(prev.panelsConfig || []), newPanel],
            platesCount: (prev.platesCount || 0) + (newPanel.linhas * newPanel.modulos)
        }));
        setTempPainel({ id: '', linhas: 1, modulos: 1, orientacao: 'Retrato' });
    };

    const removePainelConfig = (idx: number) => {
        const current = [...(apptForm.panelsConfig || [])];
        const removed = current[idx];
        current.splice(idx, 1);
        setApptForm(prev => ({
            ...prev,
            panelsConfig: current,
            platesCount: Math.max(0, (prev.platesCount || 0) - (removed.linhas * removed.modulos))
        }));
    };

    const calendarDays = useMemo(() => {
        const days = [];
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        if (calendarViewMode === 'mensal') {
            const firstDay = new Date(year, month, 1).getDay();
            const lastDate = new Date(year, month + 1, 0).getDate();
            for (let i = 0; i < firstDay; i++) days.push(null);
            for (let d = 1; d <= lastDate; d++) {
                const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                days.push({ day: d, date: dStr, appts: appointments.filter(a => a.startDate <= dStr && a.endDate >= dStr) });
            }
        } else if (calendarViewMode === 'semanal') {
            const sunday = new Date(currentDate);
            sunday.setDate(currentDate.getDate() - currentDate.getDay());
            for (let i = 0; i < 7; i++) {
                const d = new Date(sunday);
                d.setDate(sunday.getDate() + i);
                const dStr = d.toISOString().split('T')[0];
                days.push({ day: d.getDate(), date: dStr, appts: appointments.filter(a => a.startDate <= dStr && a.endDate >= dStr), label: d.toLocaleDateString('pt-BR', { weekday: 'short' }) });
            }
        }
        return days;
    }, [currentDate, calendarViewMode, appointments]);

    const approvedClients = useMemo(() => {
        return orcamentos.map(o => {
            const v = o.variants?.find(x => x.isPrincipal) || o.variants?.[0] || { formState: o.formState };
            return v.formState?.nomeCliente;
        }).filter(Boolean);
    }, [orcamentos]);

    const renderCancelados = () => (
        <div className="space-y-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/40 text-[10px] font-bold text-gray-400 border-b dark:border-gray-700">
                                <th className="px-6 py-4">Agendado p/</th>
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4">Atividade</th>
                                <th className="px-6 py-4">Excluído por</th>
                                <th className="px-6 py-4 text-center">Data exclusão</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {cancelLog.length > 0 ? cancelLog.map(log => {
                                const catItem = catalog.find(c => c.id === log.originalAppointment.activityId);
                                return (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors cursor-pointer group" onClick={() => { setSelectedLogEntry(log); setIsLogDetailModalOpen(true); }}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{new Date(log.originalAppointment.startDate).toLocaleDateString('pt-BR')}</p>
                                            <p className="text-[10px] text-gray-400 font-medium">{log.originalAppointment.startTime || 'Dia todo'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs font-bold text-gray-800 dark:text-white">{toSentenceCase(log.originalAppointment.clientName)}</p>
                                            <p className="text-[10px] text-gray-400 font-medium truncate max-w-[200px]">{log.originalAppointment.address}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: catItem?.color || '#ccc' }} />
                                                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{catItem?.title || 'Atividade'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[9px] border border-indigo-100">{log.deletedBy.substring(0, 1).toUpperCase()}</div>
                                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{toSentenceCase(log.deletedBy)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <p className="text-[11px] font-bold text-red-500">{new Date(log.deletedAt).toLocaleString('pt-BR')}</p>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic font-bold">Nenhum agendamento excluído encontrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderCalendario = () => {
        const selectedActivity = catalog.find(c => c.id === apptForm.activityId);
        const isPersonal = !!selectedActivity?.personalSchedule;
        const isCanceledView = calendarViewMode === 'cancelados';
        const isInstalacao = selectedActivity?.title.toLowerCase().includes('instalação');
        const isLavagem = selectedActivity?.title.toLowerCase().includes('lavagem');

        return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">{isCanceledView ? <TrashIcon className="w-6 h-6" /> : <CalendarIcon className="w-6 h-6" />}</div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">{isCanceledView ? 'Agendamentos excluídos' : 'Calendário de instalações'}</h2>
                        <p className="text-xs text-gray-500 font-medium">{isCanceledView ? 'Histórico de auditoria de remoções' : currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {!isCanceledView && (
                        <div className="flex items-center gap-3">
                            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                                <button onClick={() => setCalendarViewMode('mensal')} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${calendarViewMode === 'mensal' ? 'bg-white dark:bg-gray-600 text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Mensal</button>
                                <button onClick={() => setCalendarViewMode('semanal')} className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${calendarViewMode === 'semanal' ? 'bg-white dark:bg-gray-600 text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Semanal</button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => { const newDate = new Date(currentDate); if (calendarViewMode === 'mensal') newDate.setMonth(newDate.getMonth() - 1); else newDate.setDate(newDate.getDate() - 7); setCurrentDate(newDate); }} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"><ArrowLeftIcon className="w-4 h-4" /></button>
                                <button onClick={() => { const newDate = new Date(currentDate); if (calendarViewMode === 'mensal') newDate.setMonth(newDate.getMonth() + 1); else newDate.setDate(newDate.getDate() + 7); setCurrentDate(newDate); }} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg rotate-180"><ArrowLeftIcon className="w-4 h-4" /></button>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col items-end gap-2">
                        <button onClick={() => { setEditingAppt(null); setApptForm({ activityId: '', clientName: '', startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], startTime: '08:00', endTime: '12:00', isAllDay: false, cep: '', address: '', number: '', complement: '', city: '', platesCount: 0, arrangement: '', observations: '', panelsConfig: [], participantIds: [], notifyByEmail: false }); setIsApptModalOpen(true); }} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all active:scale-95">
                            <PlusIcon className="w-4 h-4" /> Agendar serviço
                        </button>
                        <button onClick={() => setCalendarViewMode(isCanceledView ? 'mensal' : 'cancelados')} className={`flex items-center gap-2 px-4 py-1.5 rounded-xl font-bold text-[10px] transition-all border ${isCanceledView ? 'bg-red-50 text-red-600 border-red-200 shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-100 dark:border-gray-700 hover:bg-gray-50'}`}>
                            {isCanceledView ? <ArrowLeftIcon className="w-3 h-3" /> : <TrashIcon className="w-3 h-3" />} {isCanceledView ? 'Voltar ao calendário' : 'Agendamentos cancelados'}
                        </button>
                    </div>
                </div>
            </header>

            {!isCanceledView && (
                calendarViewMode === 'mensal' ? (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="grid grid-cols-7 border-b border-gray-50 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-900/40">
                            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(day => (<div key={day} className="py-4 text-center text-[10px] font-bold text-gray-400 tracking-widest">{day}</div>))}
                        </div>
                        <div className="grid grid-cols-7">
                            {calendarDays.map((dayObj, idx) => (
                                <div key={idx} className={`min-h-[140px] border-r border-b border-gray-50 dark:border-gray-700/50 p-2 transition-all ${dayObj ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/10 dark:bg-gray-900/5'}`}>
                                    {dayObj && (
                                        <>
                                            <div className="flex justify-between items-start mb-2"><span className={`text-[11px] font-black ${new Date().toISOString().split('T')[0] === dayObj.date ? 'bg-indigo-600 text-white w-6 h-6 flex items-center justify-center rounded-full shadow-lg' : 'text-gray-400'}`}>{dayObj.day}</span></div>
                                            <div className="space-y-1 overflow-y-auto max-h-[100px] custom-scrollbar">
                                                {dayObj.appts.map(appt => {
                                                    const catItem = catalog.find(c => c.id === appt.activityId);
                                                    const teamNames = appt.participantIds?.map(id => users.find(u => u.id === id)?.name.split(' ')[0]).filter(Boolean).join(', ');
                                                    return (
                                                        <div key={appt.id} style={{ borderLeft: `3px solid ${catItem?.color || '#ccc'}`, backgroundColor: `${catItem?.color || '#ccc'}15` }} className="p-1.5 rounded-lg border border-transparent transition-all hover:shadow-md cursor-pointer group" onClick={() => handleOpenApptSummary(appt)}>
                                                            <p className="text-[9px] font-black truncate leading-none mb-1" style={{ color: catItem?.color }}>{appt.clientName}</p>
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-[7px] font-black text-gray-500">{appt.startTime || 'Dia todo'}</span>
                                                                {teamNames && <span className="text-[7px] font-bold text-gray-400 truncate">Equipe: {teamNames}</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="flex">
                            <div className="w-16 flex-shrink-0 border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20">
                                <div className="h-12 border-b dark:border-gray-700" />
                                {GRID_HOURS.map(hour => (
                                    <div key={hour} className="h-20 border-b dark:border-gray-700 flex items-start justify-center pt-2">
                                        <span className="text-[10px] font-bold text-gray-400">{String(hour).padStart(2, '0')}:00</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex-1 flex overflow-x-auto custom-scrollbar">
                                {calendarDays.map((dayObj, idx) => (
                                    <div key={idx} className="flex-1 min-w-[150px] border-r dark:border-gray-700 last:border-r-0">
                                        <div className={`h-12 border-b dark:border-gray-700 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-gray-900/40 ${new Date().toISOString().split('T')[0] === dayObj?.date ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{dayObj?.label}</span>
                                            <span className={`text-xs font-bold ${new Date().toISOString().split('T')[0] === dayObj?.date ? 'text-indigo-600' : 'text-gray-700 dark:text-gray-200'}`}>{dayObj?.day}</span>
                                        </div>
                                        <div className="relative h-[1120px] bg-white dark:bg-gray-800">
                                            {GRID_HOURS.map(hour => (
                                                <div key={hour} className="h-20 border-b border-gray-50 dark:border-gray-700/50 pointer-events-none" />
                                            ))}
                                            {dayObj?.appts.map(appt => {
                                                const catItem = catalog.find(c => c.id === appt.activityId);
                                                const teamNames = appt.participantIds?.map(id => users.find(u => u.id === id)?.name).filter(Boolean).join(', ');
                                                let top = 0; let height = 80;
                                                if (!appt.isAllDay && appt.startTime && appt.endTime) {
                                                    const [startH, startM] = appt.startTime.split(':').map(Number);
                                                    const [endH, endM] = appt.endTime.split(':').map(Number);
                                                    const startMinutesTotal = (startH * 60) + startM;
                                                    const endMinutesTotal = (endH * 60) + endM;
                                                    const gridStartMinutes = 7 * 60;
                                                    top = (startMinutesTotal - gridStartMinutes) * (80 / 60);
                                                    height = (endMinutesTotal - startMinutesTotal) * (80 / 60);
                                                } else { top = 0; height = 1120; }
                                                return (
                                                    <div key={appt.id} onClick={() => handleOpenApptSummary(appt)} className="absolute left-1 right-1 rounded-xl border border-white/50 dark:border-white/10 shadow-sm p-2 cursor-pointer hover:shadow-lg transition-all z-10 overflow-hidden group" style={{ top: `${top}px`, height: `${height}px`, backgroundColor: `${catItem?.color || '#ccc'}20`, borderLeft: `4px solid ${catItem?.color || '#ccc'}` }}>
                                                        <p className="text-[10px] font-black leading-tight mb-1" style={{ color: catItem?.color }}>{appt.clientName}</p>
                                                        <p className="text-[9px] font-bold text-gray-500 mb-1">{appt.startTime} - {appt.endTime}</p>
                                                        {teamNames && <p className="text-[8px] font-black text-indigo-500/70 mb-2 truncate">Equipe: {teamNames}</p>}
                                                        {appt.participantIds && appt.participantIds.length > 0 && (
                                                            <div className="flex -space-x-2 overflow-hidden">
                                                                {appt.participantIds.slice(0, 3).map(pId => {
                                                                    const user = users.find(u => u.id === pId);
                                                                    return (<div key={pId} className="inline-block h-5 w-5 rounded-full ring-2 ring-white dark:ring-gray-800 bg-gray-200 flex items-center justify-center overflow-hidden" title={user?.name}>{user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <span className="text-[8px] font-black">{user?.name.substring(0, 2).toUpperCase()}</span>}</div>);
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            )}

            {isCanceledView && renderCancelados()}

            {isApptModalOpen && (
                <Modal title={editingAppt ? "Editar agendamento" : "Agendar serviço"} onClose={() => setIsApptModalOpen(false)} maxWidth="max-w-xl">
                    <form onSubmit={handleSaveAppt} className="space-y-3 pt-1">
                        {/* Seção 1: Atividade */}
                        <div className="bg-gray-50 dark:bg-gray-900/30 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                            <label className="block text-[9px] font-black text-gray-400 tracking-widest mb-1.5 ml-1">Atividade</label>
                            <select required value={apptForm.activityId} onChange={e => setApptForm({...apptForm, activityId: e.target.value})} className="w-full rounded-xl border-transparent bg-white dark:bg-gray-700 p-2.5 text-xs font-black text-gray-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-sm transition-all appearance-none cursor-pointer">
                                <option value="">Selecione...</option>
                                {catalog.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>
                        </div>

                        {/* Seção 2: Participantes */}
                        <div className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                            <div className="flex justify-between items-center mb-2">
                                <SectionHeader icon={<UsersIcon />} title="Equipe de trabalho" color="bg-indigo-500" />
                                <span className="text-[9px] font-bold text-red-500">* Obrigatório</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {users.map(user => (<button key={user.id} type="button" onClick={() => toggleParticipant(user.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-[10px] font-black ${apptForm.participantIds?.includes(user.id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 border-transparent hover:border-indigo-100'}`}>{user.name}</button>))}
                            </div>
                            {(!apptForm.participantIds || apptForm.participantIds.length === 0) && (
                                <p className="text-[9px] text-amber-600 font-bold mt-2 italic">⚠️ Selecione pelo menos uma pessoa para habilitar o salvamento.</p>
                            )}
                        </div>

                        {/* Seção 3: Datas e Horários */}
                        <div className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <SectionHeader icon={<CalendarIcon />} title="Calendário" color="bg-indigo-600" />
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><label className="block text-[9px] font-bold text-gray-400 mb-1 ml-1">Início</label><input required type="date" value={apptForm.startDate} onChange={e => setApptForm({...apptForm, startDate: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700 p-2 text-xs font-black dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" /></div>
                                        <div><label className="block text-[9px] font-bold text-gray-400 mb-1 ml-1">Término</label><input required type="date" value={apptForm.endDate} min={apptForm.startDate} onChange={e => setApptForm({...apptForm, endDate: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700 p-2 text-xs font-black dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" /></div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <SectionHeader icon={<ClockIcon />} title="Horários" color="bg-indigo-600" rightElement={
                                        <label className="flex items-center gap-1.5 cursor-pointer group">
                                            <input type="checkbox" checked={apptForm.isAllDay} onChange={e => setApptForm({...apptForm, isAllDay: e.target.checked})} className="w-3.5 h-3.5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                                            <span className="text-[10px] font-black text-gray-400 group-hover:text-indigo-600 transition-colors">Dia todo</span>
                                        </label>
                                    } />
                                    {!apptForm.isAllDay ? (
                                        <div className="grid grid-cols-2 gap-2 animate-fade-in">
                                            <div><label className="block text-[9px] font-bold text-gray-400 mb-1 ml-1 tracking-tighter">De</label><select value={apptForm.startTime} onChange={e => setApptForm({...apptForm, startTime: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700 p-2 text-xs font-black dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm">{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                            <div><label className="block text-[9px] font-bold text-gray-400 mb-1 ml-1 tracking-tighter">Até</label><select value={apptForm.endTime} onChange={e => setApptForm({...apptForm, endTime: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700 p-2 text-xs font-black dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm">{TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                        </div>
                                    ) : (
                                        <div className="h-[38px] flex items-center justify-center bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl border border-dashed border-indigo-200"><span className="text-[10px] font-black text-indigo-500 uppercase">Período integral</span></div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Seção 4: Local (Condicional) */}
                        {!isPersonal && (
                            <div className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3 shadow-sm">
                                <SectionHeader icon={<MapIcon />} title="Localização do serviço" color="bg-teal-600" />
                                <div><label className="block text-[9px] font-bold text-gray-400 mb-1 ml-1">Cliente</label><input required list="client-list" type="text" value={apptForm.clientName} onChange={e => setApptForm({...apptForm, clientName: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700 p-2.5 text-xs font-black shadow-sm" placeholder="Nome do cliente..." /><datalist id="client-list">{approvedClients.map(c => <option key={c} value={c} />)}</datalist></div>
                                <div className="grid grid-cols-12 gap-2">
                                    <div className="col-span-4"><label className="block text-[9px] font-bold text-gray-400 mb-1 ml-1">CEP</label><input type="text" value={apptForm.cep} onChange={e => setApptForm({...apptForm, cep: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700 p-2 text-xs font-black shadow-sm" /></div>
                                    <div className="col-span-8"><label className="block text-[9px] font-bold text-gray-400 mb-1 ml-1">Endereço</label><input type="text" value={apptForm.address} onChange={e => setApptForm({...apptForm, address: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700 p-2 text-xs font-black shadow-sm" /></div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-1"><label className="block text-[9px] font-bold text-gray-400 mb-1 ml-1">Cidade</label><input type="text" value={apptForm.city} onChange={e => setApptForm({...apptForm, city: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700 p-2 text-xs font-black shadow-sm" /></div>
                                    <div className="col-span-1"><label className="block text-[9px] font-bold text-gray-400 mb-1 ml-1">Número</label><input type="text" value={apptForm.number} onChange={e => setApptForm({...apptForm, number: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700 p-2 text-xs font-black shadow-sm" /></div>
                                    <div className="col-span-1"><label className="block text-[9px] font-bold text-gray-400 mb-1 ml-1">Compl.</label><input type="text" value={apptForm.complement} onChange={e => setApptForm({...apptForm, complement: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700 p-2 text-xs font-black shadow-sm" /></div>
                                </div>
                            </div>
                        )}

                        {/* Seção 5: Técnica (Condicional) */}
                        {!isPersonal && (
                            <div className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                <SectionHeader icon={<BoltIcon />} title="Especificações técnicas" color="bg-gray-500" />
                                {isInstalacao ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-12 gap-2 items-end bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-inner">
                                            <div className="col-span-3"><label className="block text-[8px] font-black text-gray-400 mb-1">Linhas</label><input type="number" value={tempPainel.linhas} onChange={e => setTempPainel({...tempPainel, linhas: parseInt(e.target.value)||1})} className="w-full rounded-lg border-transparent bg-white dark:bg-gray-800 p-1.5 text-xs font-black outline-none" /></div>
                                            <div className="col-span-3"><label className="block text-[8px] font-black text-gray-400 mb-1">Módulos</label><input type="number" value={tempPainel.modulos} onChange={e => setTempPainel({...tempPainel, modulos: parseInt(e.target.value)||1})} className="w-full rounded-lg border-transparent bg-white dark:bg-gray-800 p-1.5 text-xs font-black outline-none" /></div>
                                            <div className="col-span-4"><label className="block text-[8px] font-black text-gray-400 mb-1">Orientação</label><select value={tempPainel.orientacao} onChange={e => setTempPainel({...tempPainel, orientacao: e.target.value})} className="w-full rounded-lg border-transparent bg-white dark:bg-gray-800 p-1.5 text-xs font-black outline-none"><option value="Retrato">Retrato</option><option value="Paisagem">Paisagem</option></select></div>
                                            <div className="col-span-2"><button type="button" onClick={addPainelConfig} className="w-full h-[32px] bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 shadow-sm active:scale-95 transition-all"><PlusIcon className="w-4 h-4" /></button></div>
                                        </div>
                                        <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                                            {(apptForm.panelsConfig || []).map((p: any, idx: number) => (
                                                <div key={p.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/40 p-2 rounded-lg border border-transparent text-[9px] font-bold"><span className="text-gray-500"><span className="text-indigo-600 font-black">F{idx+1}</span> • {p.linhas}L x {p.modulos}M ({p.orientacao})</span><button type="button" onClick={() => removePainelConfig(idx)} className="text-red-400 hover:text-red-600 transition-colors"><TrashIcon className="w-3.5 h-3.5"/></button></div>
                                            ))}
                                        </div>
                                        <div className="flex justify-between items-center px-1 pt-1.5 border-t dark:border-gray-700"><span className="text-[9px] font-black text-gray-400 tracking-tighter">Total calculado</span><span className="text-xs font-black text-indigo-600">{apptForm.platesCount || 0} unidades</span></div>
                                    </div>
                                ) : isLavagem ? (
                                    <div><label className="block text-[9px] font-bold text-gray-400 mb-1 ml-1">Quantidade de placas</label><input type="number" value={apptForm.platesCount} onChange={e => setApptForm({...apptForm, platesCount: parseInt(e.target.value)||0})} className="w-full rounded-xl bg-gray-50 dark:bg-gray-700 p-2.5 text-xs font-black outline-none shadow-sm" /></div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div><label className="block text-[9px] font-bold text-gray-400 mb-1 ml-1">Quantidade placas</label><input type="number" value={apptForm.platesCount} onChange={e => setApptForm({...apptForm, platesCount: parseInt(e.target.value)||0})} className="w-full rounded-xl bg-gray-50 dark:bg-gray-700 p-2.5 text-xs font-black outline-none shadow-sm" /></div>
                                        <div><label className="block text-[9px] font-bold text-gray-400 mb-1 ml-1">Arranjo (Ex: 2x10)</label><input type="text" value={apptForm.arrangement} onChange={e => setApptForm({...apptForm, arrangement: e.target.value})} className="w-full rounded-xl bg-gray-50 dark:bg-gray-700 p-2.5 text-xs font-black outline-none shadow-sm" /></div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Seção 6: Observações */}
                        <div className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <SectionHeader icon={<ClipboardListIcon />} title="Notas e observações" color="bg-gray-400" />
                            <textarea rows={2} value={apptForm.observations} onChange={e => setApptForm({...apptForm, observations: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700 p-2.5 text-[10px] font-semibold text-gray-700 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all" placeholder="Informações relevantes para a equipe..." />
                        </div>

                        {/* Ações */}
                        <div className="flex gap-3 pt-3 border-t dark:border-gray-700">
                            <button type="button" onClick={() => setIsApptModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-black text-[10px] tracking-widest hover:bg-gray-200 transition-all">Cancelar</button>
                            {editingAppt && (<button type="button" onClick={() => setIsDeleteConfirmModalOpen(true)} className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-black text-[10px] tracking-widest hover:bg-red-100 transition-all">Excluir</button>)}
                            <button 
                                type="submit" 
                                disabled={isSaving || !apptForm.activityId || !apptForm.participantIds?.length} 
                                className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] tracking-widest shadow-lg hover:bg-indigo-700 transition-all disabled:bg-gray-400 disabled:shadow-none"
                            >
                                Confirmar agendamento
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {isSummaryModalOpen && editingAppt && (
                <Modal title="Resumo do compromisso" onClose={() => setIsSummaryModalOpen(false)} maxWidth="max-w-md">
                    <div className="space-y-5 animate-fade-in">
                        {(() => {
                            const cat = catalog.find(c => c.id === editingAppt.activityId);
                            const isPersonal = !!cat?.personalSchedule;
                            return (
                                <>
                                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-600 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: cat?.color || '#ccc' }}><CalendarIcon className="w-5 h-5" /></div>
                                            <div><h4 className="text-sm font-black text-gray-800 dark:text-white leading-none">{cat?.title || 'Atividade'}</h4><p className="text-[10px] text-gray-400 font-bold mt-1.5 tracking-tighter">Consulta rápida</p></div>
                                        </div>
                                        <button onClick={handleStartApptEdit} className="p-2.5 bg-white dark:bg-gray-800 text-indigo-600 rounded-xl shadow-md hover:bg-indigo-50 transition-all border border-gray-100" title="Editar agendamento"><EditIcon className="w-5 h-5" /></button>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {/* Período */}
                                        <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                                            <p className="text-[10px] font-bold text-gray-400 mb-1.5 tracking-tight">Período do serviço</p>
                                            <div className="flex items-center gap-3"><div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg"><ClockIcon className="w-4 h-4" /></div><div><p className="text-xs font-bold text-gray-700 dark:text-gray-200">{new Date(editingAppt.startDate).toLocaleDateString('pt-BR')} até {new Date(editingAppt.endDate).toLocaleDateString('pt-BR')}</p><p className="text-[10px] font-bold text-gray-500">{editingAppt.isAllDay ? 'Dia todo (Integral)' : `${editingAppt.startTime} às ${editingAppt.endTime}`}</p></div></div>
                                        </div>

                                        {/* Equipe de Trabalho */}
                                        <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                                            <p className="text-[10px] font-bold text-gray-400 mb-2 tracking-tight">Equipe de trabalho</p>
                                            <div className="flex flex-wrap gap-2">
                                                {editingAppt.participantIds?.map(pId => {
                                                    const user = users.find(u => u.id === pId);
                                                    return (
                                                        <div key={pId} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800">
                                                            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-[8px] font-black ring-1 ring-indigo-200">
                                                                {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover rounded-full" alt="" /> : user?.name.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">{user?.name}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Cliente */}
                                        <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                                            <p className="text-[10px] font-bold text-gray-400 mb-1.5 tracking-tight">Cliente</p>
                                            <div className="flex items-center gap-3"><div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg"><UsersIcon className="w-4 h-4" /></div><p className="text-xs font-black text-gray-800 dark:text-white truncate">{toSentenceCase(editingAppt.clientName)}</p></div>
                                        </div>

                                        {/* Localização (Oculto se pessoal) */}
                                        {!isPersonal && editingAppt.address && (
                                            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                                                <p className="text-[10px] font-bold text-gray-400 mb-1.5 tracking-tight">Localização</p>
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 bg-teal-50 dark:bg-teal-900/20 text-teal-600 rounded-lg mt-0.5"><MapIcon className="w-4 h-4" /></div>
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{editingAppt.address}, {editingAppt.number}</p>
                                                        {editingAppt.complement && <p className="text-[10px] font-medium text-gray-500">{editingAppt.complement}</p>}
                                                        <p className="text-[10px] font-black text-teal-600 mt-1">{editingAppt.city || '---'} {editingAppt.cep ? `• CEP: ${editingAppt.cep}` : ''}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Especificações Técnicas (Oculto se pessoal) */}
                                        {!isPersonal && (editingAppt.platesCount > 0 || editingAppt.arrangement || editingAppt.panelsConfig?.length) && (
                                            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm">
                                                <p className="text-[10px] font-bold text-gray-400 mb-1.5 tracking-tight">Especificações técnicas</p>
                                                <div className="flex items-start gap-3">
                                                    <div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-lg mt-0.5"><BoltIcon className="w-4 h-4" /></div>
                                                    <div className="flex-1 space-y-2">
                                                        <div className="flex justify-between">
                                                            <span className="text-[10px] font-bold text-gray-500">Qtd. placas</span>
                                                            <span className="text-xs font-black text-gray-800 dark:text-white">{editingAppt.platesCount} un</span>
                                                        </div>
                                                        {editingAppt.arrangement && (
                                                            <div className="flex justify-between">
                                                                <span className="text-[10px] font-bold text-gray-500">Arranjo</span>
                                                                <span className="text-xs font-black text-gray-800 dark:text-white">{editingAppt.arrangement}</span>
                                                            </div>
                                                        )}
                                                        {editingAppt.panelsConfig && editingAppt.panelsConfig.length > 0 && (
                                                            <div className="pt-2 mt-2 border-t dark:border-gray-700 space-y-1">
                                                                {editingAppt.panelsConfig.map((p, idx) => (
                                                                    <div key={p.id} className="text-[9px] font-bold text-gray-400 flex justify-between">
                                                                        <span>Fileira {idx+1}: {p.linhas}L x {p.modulos}M</span>
                                                                        <span className="text-indigo-500">({p.orientacao})</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Observações */}
                                        {editingAppt.observations && (
                                            <div className="p-4 bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-inner">
                                                <p className="text-[10px] font-bold text-gray-400 mb-2 tracking-tight flex items-center gap-1.5">
                                                    <ClipboardListIcon className="w-3 h-3" /> Notas e observações
                                                </p>
                                                <p className="text-[11px] font-medium text-gray-600 dark:text-gray-300 leading-relaxed italic">
                                                    "{editingAppt.observations}"
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                        <div className="pt-4 border-t dark:border-gray-700 flex gap-3"><button onClick={() => setIsSummaryModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all">Fechar</button><button onClick={handleStartApptEdit} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"><EditIcon className="w-4 h-4" /> Editar completo</button></div>
                    </div>
                </Modal>
            )}

            {isDeleteConfirmModalOpen && (
                <Modal title="Confirmar exclusão" onClose={() => setIsDeleteConfirmModalOpen(false)} maxWidth="max-w-sm">
                    <div className="text-center p-4 space-y-6">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-50 text-red-600"><ExclamationTriangleIcon className="w-10 h-10" /></div>
                        <div className="space-y-2"><h3 className="text-lg font-bold text-gray-900 dark:text-white leading-relaxed">Deseja realmente excluir o agendamento?</h3><p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Esta ação moverá o item para o registro histórico e ele não será mais exibido no calendário.</p></div>
                        <div className="flex gap-4"><button onClick={() => setIsDeleteConfirmModalOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-sm">Não</button><button onClick={() => { setIsDeleteConfirmModalOpen(false); setCancelReasonText(''); setIsCancelReasonModalOpen(true); }} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-200">Sim, excluir</button></div>
                    </div>
                </Modal>
            )}

            {isCancelReasonModalOpen && (
                <Modal title="Motivo do cancelamento" onClose={() => setIsCancelReasonModalOpen(false)} maxWidth="max-w-md">
                    <div className="space-y-4 pt-2">
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800"><p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">Atenção</p><p className="text-xs font-bold text-gray-700 dark:text-gray-200">Justifique por que o serviço está sendo removido da agenda.</p></div>
                        <div><label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">Justificativa do cancelamento</label><textarea autoFocus required rows={4} value={cancelReasonText} onChange={e => setCancelReasonText(e.target.value)} className="w-full rounded-xl border-2 border-red-100 dark:border-red-900/30 bg-gray-50 dark:bg-gray-700/50 p-3 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all shadow-sm" placeholder="Descreva aqui o motivo..." /></div>
                        <div className="flex gap-3"><button type="button" onClick={() => setIsCancelReasonModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs">Voltar</button><button type="button" disabled={!cancelReasonText.trim() || isSaving} onClick={handleConfirmDeleteWithReason} className="flex-[2] py-3 bg-red-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-red-700 transition-all disabled:opacity-50">Confirmar cancelamento</button></div>
                    </div>
                </Modal>
            )}

            {isConflictModalOpen && (
                <Modal title="Conflito de agenda" onClose={() => setIsConflictModalOpen(false)} maxWidth="max-w-sm">
                    <div className="text-center p-4 space-y-6">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-50 text-red-600"><ExclamationTriangleIcon className="w-10 h-10" /></div>
                        <p className="text-sm font-bold text-gray-800 dark:text-white leading-relaxed">Compromisso já existente para <span className="text-red-600">{conflictedUsers.map(u => u.name).join(', ')}</span> nessa data e horário.</p>
                        <button onClick={() => setIsConflictModalOpen(false)} className="w-full py-3 bg-gray-900 dark:bg-white dark:text-gray-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">Ok</button>
                    </div>
                </Modal>
            )}

            {isLogDetailModalOpen && selectedLogEntry && (
                <Modal title="Detalhes do cancelamento" onClose={() => { setIsLogDetailModalOpen(false); setSelectedLogEntry(null); }} maxWidth="max-w-md">
                    <div className="space-y-6 pt-2">
                        <div className="bg-red-50 dark:bg-red-900/20 p-5 rounded-2xl border border-red-100 dark:border-red-900/50 shadow-sm"><div className="flex items-center gap-3 mb-4"><div className="p-2 bg-red-600 text-white rounded-lg shadow-lg"><XCircleIcon className="w-5 h-5" /></div><div><p className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none mb-1">Motivo informado</p><h4 className="text-sm font-black text-gray-800 dark:text-white">{selectedLogEntry.cancelReason || 'Não informado'}</h4></div></div></div>
                        <div className="space-y-4">
                            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm"><p className="text-[10px] font-bold text-gray-400 mb-1.5 tracking-tight">Registro de remoção</p><div className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-[9px] border border-indigo-100">{selectedLogEntry.deletedBy.substring(0, 1).toUpperCase()}</div><span className="text-xs font-bold text-gray-700 dark:text-gray-200">{toSentenceCase(selectedLogEntry.deletedBy)}</span></div><p className="text-[10px] font-bold text-red-500">{new Date(selectedLogEntry.deletedAt).toLocaleString('pt-BR')}</p></div></div>
                            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm"><p className="text-[10px] font-bold text-gray-400 mb-1.5 tracking-tight">Agendamento original</p><div className="space-y-1"><p className="text-xs font-bold">{selectedLogEntry.originalAppointment.clientName}</p><p className="text-[10px] text-gray-500 font-medium">{new Date(selectedLogEntry.originalAppointment.startDate).toLocaleDateString('pt-BR')} {selectedLogEntry.originalAppointment.startTime || ''}</p></div></div>
                        </div>
                        <button onClick={() => { setIsLogDetailModalOpen(false); setSelectedLogEntry(null); }} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-xs hover:bg-black transition-all">Fechar</button>
                    </div>
                </Modal>
            )}
        </div>
    );
    };

    return (
        <div className="max-w-7xl mx-auto pb-10">
            {renderCalendario()}
        </div>
    );
};

export default InstalacoesPage;