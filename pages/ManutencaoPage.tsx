import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  SearchIcon,
  WrenchIcon,
  PhoneIcon,
  MapPinIcon,
  CheckCircleIcon,
  PrinterIcon,
  DollarIcon,
  SaveIcon,
  XCircleIcon,
  ArrowLeftIcon,
  UsersIcon,
  CubeIcon,
  EyeIcon,
} from "../assets/icons";
import { dataService } from "../services/dataService";
import type {
  ManutencaoRecord,
  ManutencaoServiceItem,
  ManutencaoMaterialItem,
  SavedOrcamento,
  User,
  ChecklistEntry,
  StockItem,
} from "../types";

interface ManutencaoPageProps {
  currentUser: User;
  hasGlobalView?: boolean;
}

export const ManutencaoPage: React.FC<ManutencaoPageProps> = ({
  currentUser,
  hasGlobalView,
}) => {
  const [maintenances, setMaintenances] = useState<ManutencaoRecord[]>([]);
  const [orcamentos, setOrcamentos] = useState<SavedOrcamento[]>([]);
  const [lavagemClients, setLavagemClients] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<ChecklistEntry[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  // Filtros e busca
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");

  // Estado do Modal de Motivo de Perda
  const [showLossReasonModal, setShowLossReasonModal] = useState(false);
  const [lossReasonRecord, setLossReasonRecord] = useState<{ record: any; source: 'modal' | 'kanban' } | null>(null);
  const [tempLossReason, setTempLossReason] = useState("");

  // Estado do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingRecord, setEditingRecord] =
    useState<Partial<ManutencaoRecord> | null>(null);
  const [viewingCategoryMaterials, setViewingCategoryMaterials] = useState<{
    category: string;
    items: ManutencaoMaterialItem[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    "dados" | "servicos" | "materiais" | "resumo"
  >("dados");

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const safeAlert = (message: string) => {
    showToast(message, "error");
  };

  const safeConfirm = (message: string): boolean => {
    try {
      return window.confirm(message);
    } catch (e) {
      console.warn("window.confirm blocked by sandbox, defaulting to true.");
      return true;
    }
  };

  const safePrompt = (message: string, defaultValue: string = ""): string | null => {
    try {
      return window.prompt(message, defaultValue);
    } catch (e) {
      console.warn("window.prompt blocked by sandbox, using default.");
      return defaultValue;
    }
  };

  const lastFetchedCep = useRef<string>("");

  // Busca de CEP automatica
  useEffect(() => {
    if (!editingRecord?.cep || !isModalOpen) {
      lastFetchedCep.current = "";
      return;
    }
    const cleanCep = editingRecord.cep.replace(/\D/g, "");
    
    // Se o usuário está digitando ou apagou o CEP, resetamos o ref para permitir nova busca
    if (cleanCep.length < 8) {
      lastFetchedCep.current = "";
      return;
    }

    if (cleanCep.length === 8 && cleanCep !== lastFetchedCep.current) {
      const fetchCep = async () => {
        setIsLoadingCep(true);
        try {
          const response = await fetch(
            `https://viacep.com.br/ws/${cleanCep}/json/`,
          );
          const data = await response.json();
          if (data && !data.erro) {
            lastFetchedCep.current = cleanCep;
            setEditingRecord((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                address: data.logradouro || "",
                bairro: data.bairro || "",
                city: data.localidade || "",
                estado: data.uf || "",
              };
            });
          } else {
            // Se o CEP for inválido/não encontrado, limpa o ref para permitir tentar de novo se corrigido
            lastFetchedCep.current = "";
          }
        } catch (e) {
          console.error("Erro ao buscar CEP:", e);
          lastFetchedCep.current = "";
        } finally {
          setIsLoadingCep(false);
        }
      };
      fetchCep();
    }
  }, [editingRecord?.cep, isModalOpen]);

  // Visualização de Impressão (Quote Detail View)
  const [printRecord, setPrintRecord] = useState<ManutencaoRecord | null>(null);

  // Categoria temporária
  const [newCategoryName, setNewCategoryName] = useState("");

  // Helpers
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);
  };

  const handleAddCategory = () => {
    if (!editingRecord) return;
    const name = newCategoryName.trim();
    if (!name) return;

    const currentCategories = editingRecord.categories || [];
    if (currentCategories.some((c) => c.toLowerCase() === name.toLowerCase())) {
      safeAlert("Esta categoria já existe neste orçamento.");
      return;
    }

    setEditingRecord((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: [...(prev.categories || []), name],
      };
    });
    setNewCategoryName("");
  };

  const handleRemoveCategory = (catName: string) => {
    if (!editingRecord) return;
    const confirmDelete = safeConfirm(
      `Tem certeza que deseja excluir a categoria "${catName}"? Os materiais vinculados a ela ficarão sem categoria.`
    );
    if (!confirmDelete) return;
    setEditingRecord((prev) => {
      if (!prev) return prev;
      const categories = (prev.categories || []).filter((c) => c !== catName);
      const materials = (prev.materials || []).map((m) =>
        m.category === catName ? { ...m, category: "" } : m,
      );
      return { ...prev, categories, materials };
    });
  };

  const handleEditCategory = (oldName: string) => {
    if (!editingRecord) return;
    const newName = safePrompt(
      `Digite o novo nome para a categoria "${oldName}":`,
      oldName
    );
    if (newName === null) return; // cancelado
    const trimmedNewName = newName.trim();
    if (!trimmedNewName) {
      safeAlert("O nome da categoria não pode ser vazio.");
      return;
    }
    if (trimmedNewName === oldName) return;

    const currentCategories = editingRecord.categories || [];
    if (
      currentCategories.some(
        (c) => c.toLowerCase() === trimmedNewName.toLowerCase() && c !== oldName
      )
    ) {
      safeAlert("Já existe outra categoria com este nome.");
      return;
    }

    setEditingRecord((prev) => {
      if (!prev) return prev;
      const categories = (prev.categories || []).map((c) =>
        c === oldName ? trimmedNewName : c
      );
      const materials = (prev.materials || []).map((m) =>
        m.category === oldName ? { ...m, category: trimmedNewName } : m
      );
      return { ...prev, categories, materials };
    });
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Inicialização e Carregamento de dados
  const loadData = async () => {
    setIsLoading(true);
    try {
      const isAdmin =
        String(currentUser.profileId) === "001" || !!hasGlobalView;
      const [maintData, orcData, lavData, checkins, checkouts, manutChecklists, stock] = await Promise.all([
        dataService.getAll<ManutencaoRecord>(
          "manutencoes",
          currentUser.id,
          isAdmin,
        ),
        dataService.getAll<SavedOrcamento>("orcamentos", currentUser.id, true),
        dataService.getAll<any>("lavagem_clients", currentUser.id, true),
        dataService.getAll<ChecklistEntry>("checklist_checkin", currentUser.id, true),
        dataService.getAll<ChecklistEntry>("checklist_checkout", currentUser.id, true),
        dataService.getAll<ChecklistEntry>("checklist_manutencao", currentUser.id, true),
        dataService.getAll<StockItem>("stock_items", currentUser.id, true),
      ]);

      setMaintenances(maintData || []);
      setOrcamentos(orcData || []);
      setLavagemClients(lavData || []);

      const combinedChecklists: ChecklistEntry[] = [
        ...(checkins || []).map((c) => ({ ...c, type: "checkin" as const })),
        ...(checkouts || []).map((c) => ({ ...c, type: "checkout" as const })),
        ...(manutChecklists || []).map((c) => ({ ...c, type: "manutencao" as const })),
      ];
      setChecklists(combinedChecklists);
      setStockItems(stock || []);
    } catch (e) {
      console.error("Erro ao carregar dados de manutenção:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser, hasGlobalView]);

  // Lista de clientes aprovados para sugestão / autocomplete
  const approvedClients = useMemo(() => {
    const fromOrcamentos = orcamentos
      .filter((o) => o.status === "Aprovado")
      .map((o) => {
        const v = o.variants?.find((x) => x.isPrincipal) ||
          o.variants?.[0] || { formState: o.formState };
        return v.formState?.nomeCliente;
      });
    const fromLavagem = lavagemClients.map((lc) => lc.name);
    const all = [...fromOrcamentos, ...fromLavagem].filter(Boolean);
    return Array.from(new Set(all));
  }, [orcamentos, lavagemClients]);

  // Busca rápida de dados cadastrais do cliente selecionado
  const handleClientSelect = (name: string) => {
    if (!editingRecord) return;

    // Tenta preencher dados do cliente a partir dos orçamentos aprovados
    const matchingOrc = orcamentos.find((o) => {
      const v = o.variants?.find((x) => x.isPrincipal) ||
        o.variants?.[0] || { formState: o.formState };
      return (
        v.formState?.nomeCliente?.toLowerCase().trim() ===
        name.toLowerCase().trim()
      );
    });

    if (matchingOrc) {
      const v = matchingOrc.variants?.find((x) => x.isPrincipal) ||
        matchingOrc.variants?.[0] || { formState: matchingOrc.formState };
      const fs = v.formState || {};
      setEditingRecord((prev) => ({
        ...prev,
        clientName: name,
        phone: fs.celular || fs.telefone || prev?.phone || "",
        cep: fs.cepObra || fs.cep || prev?.cep || "",
        address:
          fs.enderecoObra || fs.endereco || fs.rua || prev?.address || "",
        numero: fs.numeroObra || fs.numero || prev?.numero || "",
        bairro: fs.bairroObra || fs.bairro || prev?.bairro || "",
        complemento:
          fs.complementoObra || fs.complemento || prev?.complemento || "",
        city: fs.cidadeObra || fs.cidade || prev?.city || "",
        estado: fs.ufObra || fs.uf || prev?.estado || "",
      }));
      return;
    }

    // Se não achar em orçamento, tenta em lavagem_clients
    const matchingLc = lavagemClients.find(
      (lc) => lc.name?.toLowerCase().trim() === name.toLowerCase().trim(),
    );
    if (matchingLc) {
      setEditingRecord((prev) => ({
        ...prev,
        clientName: name,
        phone: matchingLc.phone || prev?.phone || "",
        cep: matchingLc.cep || prev?.cep || "",
        address: matchingLc.address || prev?.address || "",
        numero: matchingLc.address_number || prev?.numero || "",
        bairro: matchingLc.bairro || prev?.bairro || "",
        complemento: matchingLc.complement || prev?.complemento || "",
        city: matchingLc.city || prev?.city || "",
        estado: matchingLc.state || prev?.estado || "",
      }));
      return;
    }

    setEditingRecord((prev) => ({ ...prev, clientName: name }));
  };

  // Abertura do Modal de Novo Registro
  const handleOpenCreateModal = () => {
    setModalMode("create");
    lastFetchedCep.current = "";
    setEditingRecord({
      id: "maint_" + Math.random().toString(36).substr(2, 9),
      owner_id: currentUser.id,
      clientName: "",
      phone: "",
      cep: "",
      address: "",
      numero: "",
      bairro: "",
      complemento: "",
      city: "",
      estado: "",
      status: "Especulação",
      title: "",
      description: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      services: [],
      materials: [],
      categories: [],
      materialsSource: "manual",
      selectedChecklists: [],
      totalCost: 0,
      totalPrice: 0,
      notes: "",
    });
    setActiveTab("dados");
    setIsModalOpen(true);
  };

  // Abertura do Modal de Edição
  const handleOpenEditModal = (record: ManutencaoRecord) => {
    setModalMode("edit");
    lastFetchedCep.current = (record.cep || "").replace(/\D/g, "");
    setEditingRecord({
      materialsSource: "manual",
      selectedChecklists: [],
      ...record,
    });
    setActiveTab("dados");
    setIsModalOpen(true);
  };

  // Exclusão de Registro
  const handleDeleteRecord = async (id: string) => {
    if (
      !safeConfirm("Deseja realmente excluir este registro de manutenção?")
    )
      return;
    try {
      await dataService.delete("manutencoes", id);
      setMaintenances((prev) => prev.filter((m) => m.id !== id));
      showToast("Registro excluído com sucesso!", "success");
    } catch (e) {
      console.error("Erro ao deletar manutenção:", e);
      safeAlert("Não foi possível excluir o registro.");
    }
  };

  // Mudança rápida de Status (Aprovar / Finalizar / Perdido)
  const handleQuickStatusChange = async (
    record: ManutencaoRecord,
    newStatus: "Especulação" | "Aprovado" | "Finalizado" | "Perdido",
  ) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const updated = { 
      ...record, 
      status: newStatus,
      approvalDate: (newStatus === "Aprovado" || newStatus === "Finalizado") 
        ? (record.approvalDate || todayStr) 
        : record.approvalDate
    };
    try {
      await dataService.save("manutencoes", updated);
      setMaintenances((prev) =>
        prev.map((m) => (m.id === record.id ? updated : m)),
      );
    } catch (e) {
      console.error("Erro ao atualizar status:", e);
    }
  };

  // Adicionar Linha de Serviço no modal
  const handleAddServiceItem = () => {
    if (!editingRecord) return;

    // Não deixar abrir um novo registro caso tenha um já aberto
    const hasActiveEdit = (editingRecord.services || []).some(
      (s) => s.isEditing !== false
    );
    if (hasActiveEdit) {
      safeAlert("Por favor, salve ou cancele a linha de serviço que já está aberta antes de criar uma nova.");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const newService: ManutencaoServiceItem = {
      id: "srv_" + Math.random().toString(36).substr(2, 9),
      date: today,
      description: "",
      qty: 1,
      unitCost: 0,
      unitPrice: 0,
      isEditing: true,
    };
    setEditingRecord((prev) => {
      const services = [...(prev?.services || []), newService];
      return { ...prev, services };
    });

    // Deslocar a tela para a linha aberta no fim da página
    setTimeout(() => {
      const formEl = document.getElementById("maint-modal-form");
      if (formEl) {
        formEl.scrollTo({ top: formEl.scrollHeight, behavior: "smooth" });
      }
    }, 100);
  };

  // Modificar Linha de Serviço
  const handleUpdateServiceItem = (
    index: number,
    fields: Partial<ManutencaoServiceItem>,
  ) => {
    if (!editingRecord) return;
    setEditingRecord((prev) => {
      const services = [...(prev?.services || [])];
      services[index] = { ...services[index], ...fields };
      return { ...prev, services };
    });
  };

  // Remover Linha de Serviço
  const handleRemoveServiceItem = (index: number) => {
    if (!editingRecord) return;
    setEditingRecord((prev) => {
      const services = (prev?.services || []).filter((_, i) => i !== index);
      return { ...prev, services };
    });
  };

  // Alterna a seleção de um checklist e atualiza a lista de materiais
  const handleToggleChecklist = (checklistId: string) => {
    if (!editingRecord) return;
    const currentSelected = editingRecord.selectedChecklists || [];
    let nextSelected: string[];
    if (currentSelected.includes(checklistId)) {
      nextSelected = currentSelected.filter((id) => id !== checklistId);
    } else {
      nextSelected = [...currentSelected, checklistId];
    }

    const compiledMaterials: ManutencaoMaterialItem[] = [];
    nextSelected.forEach((chkId) => {
      const chk = checklists.find((c) => c.id === chkId);
      if (!chk) return;

      const components = chk.details?.componentesEstoque || [];
      components.forEach((comp: any) => {
        const stockItem = stockItems.find(
          (s) => String(s.id) === String(comp.itemId)
        );
        const price = stockItem?.averagePrice || 0;

        compiledMaterials.push({
          id: "chk_mat_" + chkId + "_" + comp.itemId,
          date: chk.date || new Date().toISOString().split("T")[0],
          description: `${comp.name || "Material"} (Vindo do Check List: ${chk.project})`,
          qty: comp.qty || 1,
          unitCost: price,
          unitPrice: price,
          category: "Checklist",
          isEditing: false,
        });
      });
    });

    setEditingRecord((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        selectedChecklists: nextSelected,
        materials: compiledMaterials,
      };
    });
  };

  // Altera a origem das peças e materiais (manual vs checklist)
  const handleChangeMaterialsSource = (source: "manual" | "checklist") => {
    if (!editingRecord) return;
    setEditingRecord((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        materialsSource: source,
        materials: [],
        selectedChecklists: [],
      };
    });
  };

  // Adicionar Linha de Material no modal
  const handleAddMaterialItem = () => {
    if (!editingRecord) return;

    // Não deixar abrir um novo registro caso tenha um já aberto
    const hasActiveEdit = (editingRecord.materials || []).some(
      (m) => m.isEditing !== false
    );
    if (hasActiveEdit) {
      safeAlert("Por favor, salve ou cancele a linha de peça/material que já está aberta antes de criar uma nova.");
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const newMaterial: ManutencaoMaterialItem = {
      id: "mat_" + Math.random().toString(36).substr(2, 9),
      date: today,
      description: "",
      qty: 1,
      unitCost: 0,
      unitPrice: 0,
      category: "",
      isEditing: true,
    };
    setEditingRecord((prev) => {
      const materials = [...(prev?.materials || []), newMaterial];
      return { ...prev, materials };
    });

    // Deslocar a tela para a linha aberta no fim da página
    setTimeout(() => {
      const formEl = document.getElementById("maint-modal-form");
      if (formEl) {
        formEl.scrollTo({ top: formEl.scrollHeight, behavior: "smooth" });
      }
    }, 100);
  };

  // Modificar Linha de Material
  const handleUpdateMaterialItem = (
    index: number,
    fields: Partial<ManutencaoMaterialItem>,
  ) => {
    if (!editingRecord) return;
    setEditingRecord((prev) => {
      const materials = [...(prev?.materials || [])];
      materials[index] = { ...materials[index], ...fields };
      return { ...prev, materials };
    });
  };

  // Remover Linha de Material
  const handleRemoveMaterialItem = (index: number) => {
    if (!editingRecord) return;
    const item = editingRecord.materials?.[index];
    const desc = item?.description || "este item";
    if (!window.confirm(`Tem certeza que deseja excluir "${desc}"?`)) return;
    setEditingRecord((prev) => {
      const materials = (prev?.materials || []).filter((_, i) => i !== index);
      return { ...prev, materials };
    });
  };

  // Cálculo dos Totais do Registro editado
  const computedTotals = useMemo(() => {
    if (!editingRecord) return { cost: 0, price: 0, profit: 0, margin: 0 };

    // "Serviço e Mão de Obra" são valores de receita (ou seja, entrada)
    const servicesPrice = (editingRecord.services || []).reduce(
      (acc, s) => acc + s.unitPrice * s.qty,
      0,
    );

    // "Peças e Materiais" são valores de despesas (ou seja, saída)
    const materialsCost = (editingRecord.materials || []).reduce(
      (acc, m) => acc + m.unitCost * m.qty,
      0,
    );

    const totalCost = materialsCost; // Despesa (Saída)
    const totalPrice = servicesPrice; // Receita (Entrada)
    const profit = totalPrice - totalCost;
    const margin = totalPrice > 0 ? (profit / totalPrice) * 100 : 0;

    return {
      cost: totalCost,
      price: totalPrice,
      profit,
      margin,
    };
  }, [editingRecord?.services, editingRecord?.materials]);

  // Agrupamento de materiais por categoria para o resumo financeiro
  const materialsByCategory = useMemo(() => {
    if (!editingRecord) return [];
    const categoriesList = [...(editingRecord.categories || [])].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const allKeys = [...categoriesList, "Sem Categoria"];
    const result: {
      category: string;
      totalCost: number;
      totalPrice: number;
      count: number;
      items: ManutencaoMaterialItem[];
    }[] = [];

    allKeys.forEach((cat) => {
      const items = (editingRecord.materials || []).filter((m) => {
        const itemCat =
          m.category && categoriesList.includes(m.category)
            ? m.category
            : "Sem Categoria";
        return itemCat === cat;
      });
      if (items.length > 0) {
        const totalCost = items.reduce((acc, m) => acc + m.unitCost * m.qty, 0);
        const totalPrice = items.reduce(
          (acc, m) => acc + m.unitPrice * m.qty,
          0,
        );
        result.push({
          category: cat === "Sem Categoria" ? "Outras / Sem Categoria" : cat,
          totalCost,
          totalPrice,
          count: items.length,
          items,
        });
      }
    });
    return result;
  }, [editingRecord?.materials, editingRecord?.categories]);

  // Salvar Registro de Manutenção
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord?.clientName || !editingRecord?.title) {
      safeAlert("Por favor, preencha o Nome do Cliente e o Título.");
      return;
    }

    setIsSaving(true);
    try {
      const finalRecord: ManutencaoRecord = {
        id: editingRecord.id || "maint_" + Date.now(),
        owner_id: editingRecord.owner_id || currentUser.id,
        clientName: editingRecord.clientName.trim(),
        phone: editingRecord.phone || "",
        cep: editingRecord.cep || "",
        address: editingRecord.address || "",
        numero: editingRecord.numero || "",
        bairro: editingRecord.bairro || "",
        complemento: editingRecord.complemento || "",
        city: editingRecord.city || "",
        estado: editingRecord.estado || "",
        status: editingRecord.status || "Especulação",
        title: editingRecord.title.trim(),
        description: editingRecord.description || "",
        startDate: editingRecord.startDate || "",
        endDate: editingRecord.endDate || "",
        services: editingRecord.services || [],
        materials: editingRecord.materials || [],
        categories: editingRecord.categories || [],
        materialsSource: editingRecord.materialsSource || "manual",
        selectedChecklists: editingRecord.selectedChecklists || [],
        totalCost: computedTotals.cost,
        totalPrice: computedTotals.price,
        notes: editingRecord.notes || "",
        motivoPerdido: editingRecord.motivoPerdido || "",
        createdAt: editingRecord.createdAt || new Date().toISOString(),
        approvalDate: (editingRecord.status === "Aprovado" || editingRecord.status === "Finalizado")
          ? (editingRecord.approvalDate || new Date().toISOString().split("T")[0])
          : editingRecord.approvalDate,
      };

      await dataService.save("manutencoes", finalRecord);

      // Atualiza state local
      setMaintenances((prev) => {
        const index = prev.findIndex((m) => m.id === finalRecord.id);
        if (index > -1) {
          const next = [...prev];
          next[index] = finalRecord;
          return next;
        }
        return [...prev, finalRecord];
      });

      showToast("Manutenção salva com sucesso!", "success");
      setIsModalOpen(false);
      setEditingRecord(null);
    } catch (err: any) {
      console.error("Erro ao salvar manutenção:", err);
      safeAlert(`Não foi possível salvar os dados: ${err?.message || "Erro desconhecido"}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Estatísticas Gerais para o Top Dashboard
  const stats = useMemo(() => {
    const active = maintenances.filter((m) => m.status !== "Finalizado" && m.status !== "Perdido");
    const speculation = maintenances.filter((m) => m.status === "Especulação");
    const approved = maintenances.filter((m) => m.status === "Aprovado");
    const finalized = maintenances.filter((m) => m.status === "Finalizado");
    const lost = maintenances.filter((m) => m.status === "Perdido");

    const totalRevenue = maintenances.filter((m) => m.status !== "Perdido").reduce((acc, m) => acc + m.totalPrice, 0);
    const totalCost = maintenances.filter((m) => m.status !== "Perdido").reduce((acc, m) => acc + m.totalCost, 0);
    const approvedRevenue = approved.reduce((acc, m) => acc + m.totalPrice, 0);

    return {
      countTotal: maintenances.length,
      countSpeculation: speculation.length,
      countApproved: approved.length,
      countFinalized: finalized.length,
      countLost: lost.length,
      activeCount: active.length,
      totalRevenue,
      totalCost,
      approvedRevenue,
      overallProfit: totalRevenue - totalCost,
      overallMargin:
        totalRevenue > 0
          ? ((totalRevenue - totalCost) / totalRevenue) * 100
          : 0,
    };
  }, [maintenances]);

  // Filtragem e busca dos cards (apenas por texto de busca)
  const searchedRecords = useMemo(() => {
    return maintenances.filter((m) => {
      const matchesSearch =
        m.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.city && m.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.description &&
          m.description.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesSearch;
    });
  }, [maintenances, searchTerm]);

  // Grupos por coluna do Kanban (separados após a busca por texto)
  const kanbanColumns = useMemo(() => {
    return {
      Especulação: searchedRecords.filter((m) => m.status === "Especulação"),
      Aprovado: searchedRecords.filter((m) => m.status === "Aprovado"),
      Finalizado: searchedRecords.filter((m) => m.status === "Finalizado"),
      Perdido: searchedRecords.filter((m) => m.status === "Perdido"),
    };
  }, [searchedRecords]);

  // Visualizar detalhes do Orçamento / Ordem de Serviço de Manutenção
  if (printRecord) {
    return (
      <div className="bg-white dark:bg-gray-900 p-6 md:p-10 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-md max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
        {/* Botão de Voltar (oculto no print) */}
        <div className="flex justify-between items-center mb-8 print:hidden">
          <button
            onClick={() => setPrintRecord(null)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs transition-all"
          >
            <ArrowLeftIcon className="w-4 h-4" /> Voltar para o Kanban
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all"
          >
            <PrinterIcon className="w-4 h-4" /> Imprimir / Salvar PDF
          </button>
        </div>

        {/* Cabeçalho do Orçamento/OS */}
        <div className="border-b-2 border-gray-100 dark:border-gray-800 pb-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[10px] font-black tracking-wider px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              Orçamento de Manutenção
            </span>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1.5">
              {printRecord.title}
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Registrado em {formatDate(printRecord.createdAt?.split("T")[0])}
            </p>
          </div>
          <div className="text-right md:text-right">
            <p className="text-[10px] font-bold text-gray-400">
              Status do Caso
            </p>
            <span
              className={`inline-block mt-1 px-3 py-1 rounded-full text-[10px] font-black ${
                printRecord.status === "Especulação"
                  ? "bg-amber-100 text-amber-800"
                  : printRecord.status === "Aprovado"
                    ? "bg-indigo-100 text-indigo-800"
                    : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {printRecord.status === "Especulação"
                ? "Especulação (Aguardando)"
                : printRecord.status}
            </span>
          </div>
        </div>

        {/* Dados do Cliente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl mb-8 border border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-[10px] font-black text-gray-400 tracking-tight mb-2">
              Dados do Cliente
            </h3>
            <p className="text-sm font-bold text-gray-800 dark:text-white">
              {printRecord.clientName}
            </p>
            {printRecord.phone && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                <PhoneIcon className="w-3.5 h-3.5 text-gray-400" />{" "}
                {printRecord.phone}
              </p>
            )}
          </div>
          <div>
            <h3 className="text-[10px] font-black text-gray-400 tracking-tight mb-2">
              Local de Atendimento
            </h3>
            {(printRecord.address || printRecord.city || printRecord.cep) && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-start gap-1.5">
                <MapPinIcon className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span>
                  {printRecord.address}
                  {printRecord.numero && `, ${printRecord.numero}`}
                  {printRecord.complemento && ` (${printRecord.complemento})`}
                  {printRecord.bairro && ` - ${printRecord.bairro}`}
                  {(printRecord.city ||
                    printRecord.estado ||
                    printRecord.cep) && <br />}
                  {printRecord.city}
                  {printRecord.estado && ` - ${printRecord.estado}`}
                  {printRecord.cep && ` | CEP: ${printRecord.cep}`}
                </span>
              </div>
            )}
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              <b>Período:</b>{" "}
              {printRecord.startDate
                ? formatDate(printRecord.startDate)
                : "A definir"}
              {printRecord.endDate && ` até ${formatDate(printRecord.endDate)}`}
            </p>
          </div>
        </div>

        {/* Descrição do Chamado */}
        {printRecord.description && (
          <div className="mb-8">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white border-b pb-2 mb-3">
              Descrição Técnica do Problema / Escopo
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {printRecord.description}
            </p>
          </div>
        )}

        {/* Serviços Aplicados */}
        {printRecord.services && printRecord.services.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white border-b pb-2 mb-3">
              Mão de Obra e Serviços
            </h3>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-gray-400 font-bold">
                  <th className="py-2 w-8/12">Descrição do Serviço</th>
                  <th className="py-2 text-center w-1/12">Qtd</th>
                  <th className="py-2 text-right w-3/12">Preço Unitário</th>
                  <th className="py-2 text-right w-3/12">Total</th>
                </tr>
              </thead>
              <tbody>
                {printRecord.services.map((srv) => (
                  <tr
                    key={srv.id}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-2.5 font-medium text-gray-800 dark:text-gray-300">
                      {srv.description}
                    </td>
                    <td className="py-2.5 text-center text-gray-600 dark:text-gray-400">
                      {srv.qty}
                    </td>
                    <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">
                      {formatCurrency(srv.unitPrice)}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-gray-800 dark:text-white">
                      {formatCurrency(srv.unitPrice * srv.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Materiais e Peças */}
        {printRecord.materials && printRecord.materials.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xs font-bold text-gray-900 dark:text-white border-b pb-2 mb-3">
              Materiais e Peças de Reposição
            </h3>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-gray-400 font-bold">
                  <th className="py-2 w-8/12">Peça / Equipamento</th>
                  <th className="py-2 text-center w-1/12">Qtd</th>
                  <th className="py-2 text-right w-3/12">Preço Unitário</th>
                  <th className="py-2 text-right w-3/12">Total</th>
                </tr>
              </thead>
              <tbody>
                {printRecord.materials.map((mat) => (
                  <tr
                    key={mat.id}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-2.5 font-medium text-gray-800 dark:text-gray-300">
                      {mat.description}
                    </td>
                    <td className="py-2.5 text-center text-gray-600 dark:text-gray-400">
                      {mat.qty}
                    </td>
                    <td className="py-2.5 text-right text-gray-600 dark:text-gray-400">
                      {formatCurrency(mat.unitPrice)}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-gray-800 dark:text-white">
                      {formatCurrency(mat.unitPrice * mat.qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Resumo Financeiro do Orçamento */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-stretch gap-6 pt-6 border-t-2 border-gray-100 dark:border-gray-800 mt-8">
          <div className="flex-1">
            {printRecord.notes && (
              <div className="bg-gray-50 dark:bg-gray-800/40 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                <h4 className="text-[10px] font-black text-gray-400 tracking-tight mb-1">
                  Notas e Termos
                </h4>
                <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed italic">
                  "{printRecord.notes}"
                </p>
              </div>
            )}
          </div>
          <div className="w-full md:w-80 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 rounded-2xl border border-indigo-100/30">
            <div className="space-y-2.5">
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Total Mão de Obra:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {formatCurrency(
                    (printRecord.services || []).reduce(
                      (acc, s) => acc + s.unitPrice * s.qty,
                      0,
                    ),
                  )}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Total Peças / Equipamentos:</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {formatCurrency(
                    (printRecord.materials || []).reduce(
                      (acc, m) => acc + m.unitPrice * m.qty,
                      0,
                    ),
                  )}
                </span>
              </div>
              <div className="h-px bg-indigo-100 dark:bg-indigo-900 my-2"></div>
              <div className="flex justify-between items-center text-sm">
                <span className="font-bold text-gray-800 dark:text-white">
                  Valor Total do Orçamento:
                </span>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                  {formatCurrency(printRecord.totalPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de Assinatura (para o print) */}
        <div className="hidden print:block mt-24">
          <div className="grid grid-cols-2 gap-12 text-center text-[10px]">
            <div>
              <div className="border-b border-gray-300 w-10/12 mx-auto mb-2 h-10"></div>
              <p className="font-bold">Representante Orner</p>
            </div>
            <div>
              <div className="border-b border-gray-300 w-10/12 mx-auto mb-2 h-10"></div>
              <p className="font-bold">
                Aceite do Cliente ({printRecord.clientName})
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isReadOnly = editingRecord?.status === "Finalizado";

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[9999]">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-xs font-bold transition-all animate-in fade-in slide-in-from-top-4 duration-300 ${
            toast.type === "success" 
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : toast.type === "error"
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
              : "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300"
          }`}>
            {toast.type === "success" && <CheckCircleIcon className="w-4 h-4 shrink-0" />}
            {toast.type === "error" && <XCircleIcon className="w-4 h-4 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header da Página */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 dark:border-gray-800 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <WrenchIcon className="w-7 h-7 text-indigo-500" /> Manutenção &
            Reparos
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Gerencie orçamentos e chamados de manutenção de sistemas que não se
            enquadram em vendas padrões.
          </p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95"
        >
          <PlusIcon className="w-4 h-4" /> Registrar Manutenção
        </button>
      </div>

      {/* KPIs Gerais (Visual e Funcional) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 tracking-tight">
              Casos Ativos
            </span>
            <h3 className="text-xl font-black text-gray-800 dark:text-white mt-1">
              {stats.activeCount} chamados
            </h3>
          </div>
          <div className="text-[10px] text-gray-500 mt-3 flex gap-2">
            <span>{stats.countSpeculation} especulação</span>
            <span>•</span>
            <span>{stats.countApproved} aprovados</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 tracking-tight">
              Receita Estimada (Total)
            </span>
            <h3 className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
              {formatCurrency(stats.totalRevenue)}
            </h3>
          </div>
          <span className="text-[10px] text-emerald-500 font-bold mt-3">
            {formatCurrency(stats.approvedRevenue)} aprovado/em execução
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 tracking-tight">
              Margem de Lucro Geral
            </span>
            <h3 className="text-xl font-black text-gray-800 dark:text-white mt-1">
              {stats.overallMargin.toFixed(1)}%
            </h3>
          </div>
          <span className="text-[10px] text-gray-500 mt-3">
            Lucro estimado: {formatCurrency(stats.overallProfit)}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 tracking-tight">
              Total Finalizados
            </span>
            <h3 className="text-xl font-black text-emerald-500 mt-1">
              {stats.countFinalized} chamados
            </h3>
          </div>
          <span className="text-[10px] text-gray-500 mt-3">
            Total de {stats.countTotal} cadastrados
          </span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Buscar por cliente, título ou local..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-none text-xs rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none placeholder-gray-400 font-medium"
          />
          <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {["Todos", "Especulação", "Aprovado", "Finalizado", "Perdido"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-xl font-bold text-xs transition-all ${
                statusFilter === status
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "bg-gray-50 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/80"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20 flex-col gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <p className="text-xs text-gray-400 animate-pulse">
            Buscando cadastros de manutenção...
          </p>
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${
          statusFilter === "Todos"
            ? "md:grid-cols-2 lg:grid-cols-4"
            : "max-w-2xl mx-auto"
        } gap-6`}>
          {/* Coluna 1: Especulação */}
          {(statusFilter === "Todos" || statusFilter === "Especulação") && (
            <div className="bg-gray-50 dark:bg-gray-800/20 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/80 flex flex-col min-h-[500px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-amber-600 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Especulação ({kanbanColumns["Especulação"].length})
                </h3>
                <span className="text-[10px] font-black text-amber-600/80 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md">
                  {formatCurrency(
                    kanbanColumns["Especulação"].reduce(
                      (acc, m) => acc + m.totalPrice,
                      0,
                    ),
                  )}
                </span>
              </div>
              <div className="space-y-3.5 overflow-y-auto flex-1 custom-scrollbar max-h-[600px] pr-1">
                {kanbanColumns["Especulação"].length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                    <p className="text-[10px] font-medium text-gray-400">
                      Nenhum orçamento / lead
                    </p>
                  </div>
                ) : (
                  kanbanColumns["Especulação"].map((m) => renderKanbanCard(m))
                )}
              </div>
            </div>
          )}

          {/* Coluna 2: Aprovados */}
          {(statusFilter === "Todos" || statusFilter === "Aprovado") && (
            <div className="bg-gray-50 dark:bg-gray-800/20 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/80 flex flex-col min-h-[500px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-indigo-500 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                  Aprovados / Em Execução ({kanbanColumns["Aprovado"].length})
                </h3>
                <span className="text-[10px] font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-md">
                  {formatCurrency(
                    kanbanColumns["Aprovado"].reduce(
                      (acc, m) => acc + m.totalPrice,
                      0,
                    ),
                  )}
                </span>
              </div>
              <div className="space-y-3.5 overflow-y-auto flex-1 custom-scrollbar max-h-[600px] pr-1">
                {kanbanColumns["Aprovado"].length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                    <p className="text-[10px] font-medium text-gray-400">
                      Nenhum serviço aprovado em aberto
                    </p>
                  </div>
                ) : (
                  kanbanColumns["Aprovado"].map((m) => renderKanbanCard(m))
                )}
              </div>
            </div>
          )}

          {/* Coluna 3: Finalizados */}
          {(statusFilter === "Todos" || statusFilter === "Finalizado") && (
            <div className="bg-gray-50 dark:bg-gray-800/20 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/80 flex flex-col min-h-[500px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-emerald-500 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  Finalizados ({kanbanColumns["Finalizado"].length})
                </h3>
                <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md">
                  {formatCurrency(
                    kanbanColumns["Finalizado"].reduce(
                      (acc, m) => acc + m.totalPrice,
                      0,
                    ),
                  )}
                </span>
              </div>
              <div className="space-y-3.5 overflow-y-auto flex-1 custom-scrollbar max-h-[600px] pr-1">
                {kanbanColumns["Finalizado"].length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                    <p className="text-[10px] font-medium text-gray-400">
                      Nenhum chamado concluído ainda
                    </p>
                  </div>
                ) : (
                  kanbanColumns["Finalizado"].map((m) => renderKanbanCard(m))
                )}
              </div>
            </div>
          )}

          {/* Coluna 4: Perdidos */}
          {(statusFilter === "Todos" || statusFilter === "Perdido") && (
            <div className="bg-gray-50 dark:bg-gray-800/20 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/80 flex flex-col min-h-[500px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-red-500 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  Perdidos ({kanbanColumns["Perdido"].length})
                </h3>
                <span className="text-[10px] font-black text-red-500 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-md">
                  {formatCurrency(
                    kanbanColumns["Perdido"].reduce(
                      (acc, m) => acc + m.totalPrice,
                      0,
                    ),
                  )}
                </span>
              </div>
              <div className="space-y-3.5 overflow-y-auto flex-1 custom-scrollbar max-h-[600px] pr-1">
                {kanbanColumns["Perdido"].length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                    <p className="text-[10px] font-medium text-gray-400">
                      Nenhum chamado perdido
                    </p>
                  </div>
                ) : (
                  kanbanColumns["Perdido"].map((m) => renderKanbanCard(m))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de Cadastro / Edição */}
      {isModalOpen && editingRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-gray-100 dark:border-gray-800">
            {/* Header Modal */}
            <div className="shrink-0 px-6 py-5 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gradient-to-r from-indigo-50 via-purple-50/50 to-white dark:from-indigo-950/20 dark:via-purple-950/10 dark:to-gray-900 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-600/20 dark:shadow-indigo-900/30">
                  <WrenchIcon className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-950 dark:text-white tracking-tight">
                    {isReadOnly
                      ? "Visualizar Chamado de Manutenção"
                      : modalMode === "create"
                      ? "Registrar Novo Chamado de Manutenção"
                      : "Editar Chamado de Manutenção"}
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                    Preencha os dados e gerencie custos e valores cobrados ao cliente de forma inteligente e integrada.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingRecord(null);
                }}
                className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Abas de Navegação interna */}
            <div className="flex shrink-0 border-b border-gray-150 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto p-1.5 gap-1 select-none">
              {[
                { id: "dados", label: "Dados do Cliente", color: "text-indigo-600 bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500", icon: <UsersIcon className="w-4 h-4" /> },
                { id: "servicos", label: "Serviços e Mão de Obra", color: "text-purple-600 bg-purple-500/10 dark:bg-purple-500/20 border-purple-500", icon: <WrenchIcon className="w-4 h-4" /> },
                { id: "materiais", label: "Peças e Materiais", color: "text-amber-600 bg-amber-500/10 dark:bg-amber-500/20 border-amber-500", icon: <CubeIcon className="w-4 h-4" /> },
                { id: "resumo", label: "Resumo Financeiro", color: "text-emerald-600 bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500", icon: <DollarIcon className="w-4 h-4" /> },
              ].map((tab, idx) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2.5 font-bold text-xs rounded-xl transition-all duration-200 whitespace-nowrap flex items-center justify-center gap-2 flex-1 ${
                      isActive
                        ? `${tab.color} shadow-sm border`
                        : "border border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                  >
                    <span className={isActive ? "" : "text-gray-400"}>
                      {tab.icon}
                    </span>
                    <span>{idx + 1}. {tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Form Body */}
            <form
              id="maint-modal-form"
              onSubmit={handleSaveRecord}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              {/* TAB 1: Dados Gerais */}
              {activeTab === "dados" && (
                <fieldset disabled={isReadOnly} className="space-y-4 border-0 p-0 m-0">
                  <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                        Cliente
                      </label>
                      <input
                        required
                        list="approved-maint-clients"
                        type="text"
                        value={editingRecord.clientName || ""}
                        onChange={(e) => handleClientSelect(e.target.value)}
                        className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold shadow-sm"
                        placeholder="Busque ou digite o nome do cliente..."
                      />
                      <datalist id="approved-maint-clients">
                        {approvedClients.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                        Telefone / WhatsApp
                      </label>
                      <input
                        type="text"
                        value={editingRecord.phone || ""}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            phone: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold shadow-sm"
                        placeholder="Ex: (11) 99999-9999"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                        CEP
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          maxLength={9}
                          value={editingRecord.cep || ""}
                          onChange={(e) =>
                            setEditingRecord({
                              ...editingRecord,
                              cep: e.target.value,
                            })
                          }
                          className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold shadow-sm"
                          placeholder="00000-000"
                        />
                        {isLoadingCep && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                        )}
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                        Endereço / Logradouro
                      </label>
                      <input
                        type="text"
                        value={editingRecord.address || ""}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            address: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold shadow-sm"
                        placeholder="Rua, Avenida..."
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                        Nº
                      </label>
                      <input
                        type="text"
                        value={editingRecord.numero || ""}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            numero: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold shadow-sm"
                        placeholder="Ex: 123"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                        Bairro
                      </label>
                      <input
                        type="text"
                        value={editingRecord.bairro || ""}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            bairro: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold shadow-sm"
                        placeholder="Ex: Centro"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                        Complemento
                      </label>
                      <input
                        type="text"
                        value={editingRecord.complemento || ""}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            complemento: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold shadow-sm"
                        placeholder="Apto, Bloco, etc."
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                        Cidade
                      </label>
                      <input
                        type="text"
                        value={editingRecord.city || ""}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            city: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold shadow-sm"
                        placeholder="Ex: Campinas"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                        Estado
                      </label>
                      <input
                        type="text"
                        value={editingRecord.estado || ""}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            estado: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold shadow-sm"
                        placeholder="Ex: SP"
                      />
                    </div>
                  </div>

                  <div className="h-px bg-gray-100 dark:bg-gray-800 my-2"></div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                      Título do Chamado
                    </label>
                    <input
                      required
                      type="text"
                      value={editingRecord.title || ""}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          title: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold shadow-sm"
                      placeholder="Ex: Substituição de Inversor Solis 10kW ou Limpeza Física"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                      Descrição Detalhada do Problema / Atendimento
                    </label>
                    <textarea
                      rows={3}
                      value={editingRecord.description || ""}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          description: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-semibold shadow-sm outline-none"
                      placeholder="Explique os detalhes do erro ou serviço preventivo solicitado pelo cliente..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                        Data de Início
                      </label>
                      <input
                        type="date"
                        value={editingRecord.startDate || ""}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            startDate: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                        Previsão de Conclusão
                      </label>
                      <input
                        type="date"
                        value={editingRecord.endDate || ""}
                        onChange={(e) =>
                          setEditingRecord({
                            ...editingRecord,
                            endDate: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                        Status Atual
                      </label>
                      <select
                        value={editingRecord.status || "Especulação"}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          if (val === "Perdido") {
                            setTempLossReason(editingRecord.motivoPerdido || "");
                            setLossReasonRecord({
                              record: editingRecord,
                              source: "modal",
                            });
                            setShowLossReasonModal(true);
                          } else {
                            setEditingRecord({
                              ...editingRecord,
                              status: val,
                            });
                          }
                        }}
                        className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold shadow-sm"
                      >
                        <option value="Especulação">Especulação</option>
                        <option value="Aprovado">Aprovado</option>
                        <option value="Finalizado">Finalizado</option>
                        <option value="Perdido">Perdido</option>
                      </select>
                    </div>

                    {editingRecord.status === "Perdido" && (
                      <div className="col-span-1 md:col-span-3">
                        <label className="block text-[10px] font-black text-red-500 tracking-tight mb-1 ml-1 flex items-center gap-1 animate-pulse">
                          ⚠️ Motivo do Orçamento Perdido *
                        </label>
                        <textarea
                          value={editingRecord.motivoPerdido || ""}
                          onChange={(e) =>
                            setEditingRecord({
                              ...editingRecord,
                              motivoPerdido: e.target.value,
                            })
                          }
                          required
                          placeholder="Informe detalhadamente por que este orçamento de manutenção foi perdido (Ex: Cliente achou caro, fechou com concorrente, mudou de ideia)..."
                          className="w-full rounded-xl border border-red-200 dark:border-red-950/40 bg-red-50/20 dark:bg-red-950/10 p-2.5 text-xs font-semibold focus:ring-red-500 focus:border-red-500 outline-none"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </fieldset>
            )}

              {/* TAB 2: Serviços e Mão de Obra */}
              {activeTab === "servicos" && (
                <fieldset disabled={isReadOnly} className="space-y-4 border-0 p-0 m-0">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-tight">
                        Incluir Serviços Técnicos
                      </h4>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={handleAddServiceItem}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                        >
                          <PlusIcon className="w-3.5 h-3.5" /> Adicionar Serviço
                        </button>
                      )}
                    </div>

                  {(editingRecord.services || []).length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800">
                      <p className="text-xs text-gray-400 font-medium">
                        Nenhum serviço manual adicionado.
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        Insira serviços como visita técnica, configuração,
                        limpeza ou instalação.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(editingRecord.services || []).map((srv, idx) => {
                        const subPrice = srv.qty * srv.unitPrice;
                        const isEditing = srv.isEditing !== false;

                        if (isEditing) {
                          return (
                            <div
                              key={srv.id}
                              className="p-3 bg-indigo-50/5 dark:bg-indigo-950/5 border border-indigo-100/20 dark:border-indigo-900/20 rounded-xl"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-[115px_1fr_110px_auto_auto] gap-2.5 items-end">
                                {/* DATA */}
                                <div>
                                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                    Data
                                  </label>
                                  <input
                                    type="date"
                                    value={srv.date || ""}
                                    onChange={(e) =>
                                      handleUpdateServiceItem(idx, {
                                        date: e.target.value,
                                      })
                                    }
                                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1.5 text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
                                  />
                                </div>

                                {/* DESCRIÇÃO */}
                                <div>
                                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                    Descrição
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="Descrição do serviço (ex: Configuração de inversor solar)..."
                                    value={srv.description}
                                    onChange={(e) =>
                                      handleUpdateServiceItem(idx, {
                                        description: e.target.value,
                                      })
                                    }
                                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1.5 text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none placeholder-gray-400"
                                  />
                                </div>

                                {/* VALOR (R$) */}
                                <div>
                                  <label className="block text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mb-1 ml-0.5">
                                    Valor (R$)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={srv.unitPrice || ""}
                                    onChange={(e) =>
                                      handleUpdateServiceItem(idx, {
                                        unitPrice: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-full rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 p-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                                  />
                                </div>

                                {/* BOTÃO SALVAR */}
                                <div className="w-full md:w-auto">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!srv.description.trim()) {
                                        safeAlert("Por favor, informe a descrição do serviço.");
                                        return;
                                      }
                                      handleUpdateServiceItem(idx, {
                                        isEditing: false,
                                      });
                                    }}
                                    className="w-full md:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-1 whitespace-nowrap min-h-[30px]"
                                  >
                                    <SaveIcon className="w-3.5 h-3.5" /> Salvar Linha
                                  </button>
                                </div>

                                {/* BOTÃO EXCLUIR */}
                                <div className="w-full md:w-auto flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveServiceItem(idx)}
                                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 rounded-lg transition-all"
                                    title="Remover"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={srv.id}
                            className="py-1.5 px-3 bg-gray-50/50 dark:bg-gray-800/20 border border-gray-100 dark:border-gray-800/60 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-sm"
                          >
                            <div className="flex items-center gap-2.5 flex-wrap md:flex-nowrap">
                              {srv.date && (
                                <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md font-mono">
                                  {srv.date.split("-").reverse().join("/")}
                                </span>
                              )}

                              {/* DESCRIÇÃO */}
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-gray-800 dark:text-white">
                                  {srv.description}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 justify-between md:justify-end">
                              {/* VALOR */}
                              <div className="flex flex-col md:items-end leading-none pr-1.5">
                                <span className="text-[8px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">
                                  Valor
                                </span>
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                  {formatCurrency(srv.unitPrice)}
                                </span>
                              </div>

                              {/* ACTIONS */}
                              {!isReadOnly && (
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateServiceItem(idx, {
                                        isEditing: true,
                                      })
                                    }
                                    className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 p-1 rounded-md transition-all"
                                    title="Editar"
                                  >
                                    <EditIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveServiceItem(idx)}
                                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1 rounded-md transition-all"
                                    title="Remover"
                                  >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Totalizador de Serviços */}
                  {(() => {
                    const servicesTotal = (editingRecord.services || []).reduce((acc, s) => acc + s.unitPrice * s.qty, 0);
                    if (servicesTotal <= 0) return null;
                    return (
                      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/30 p-4 rounded-xl flex justify-between items-center mt-4">
                        <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          Total de Serviços (Receita / Entrada):
                        </span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(servicesTotal)}
                        </span>
                      </div>
                    );
                  })()}
                  </div>
                </fieldset>
              )}

              {/* TAB 3: Peças e Materiais */}
              {activeTab === "materiais" && (
                <fieldset disabled={isReadOnly} className="space-y-4 border-0 p-0 m-0">
                  <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-tight">
                      Incluir Peças e Materiais
                    </h4>
                  </div>

                  {/* Escolha da Origem das Peças e Materiais */}
                  <div className="bg-gradient-to-r from-indigo-50/50 to-indigo-50/20 dark:from-indigo-950/20 dark:to-indigo-950/10 p-4.5 rounded-2xl border border-indigo-100/60 dark:border-indigo-900/40 space-y-3 shadow-sm">
                    <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 tracking-wide">
                      Método de Lançamento de Custos
                    </label>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Escolha se os custos de materiais serão inseridos manualmente ou calculados automaticamente a partir de um formulário de Check List / Manutenção em aberto.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                      {/* Opção 1: Lançamento Manual */}
                      <button
                        type="button"
                        onClick={() => handleChangeMaterialsSource("manual")}
                        className={`p-3.5 rounded-xl border-2 flex flex-col items-start gap-1 text-left transition-all ${
                          (editingRecord.materialsSource || "manual") === "manual"
                            ? "bg-white dark:bg-gray-900 border-indigo-600 dark:border-indigo-500 shadow-md ring-2 ring-indigo-600/10"
                            : "bg-gray-50/50 dark:bg-gray-800/20 border-gray-150 dark:border-gray-800 hover:border-gray-250 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            (editingRecord.materialsSource || "manual") === "manual"
                              ? "border-indigo-600 dark:border-indigo-500"
                              : "border-gray-300 dark:border-gray-650"
                          }`}>
                            {(editingRecord.materialsSource || "manual") === "manual" && (
                              <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500" />
                            )}
                          </div>
                          <span className="text-xs font-bold text-gray-900 dark:text-white">Lançamento Manual (Atual)</span>
                        </div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 pl-6">
                          Insira as peças, quantidades e custos manualmente.
                        </span>
                      </button>

                      {/* Opção 2: Vincular do Check List */}
                      <button
                        type="button"
                        onClick={() => handleChangeMaterialsSource("checklist")}
                        className={`p-3.5 rounded-xl border-2 flex flex-col items-start gap-1 text-left transition-all ${
                          editingRecord.materialsSource === "checklist"
                            ? "bg-white dark:bg-gray-900 border-indigo-600 dark:border-indigo-500 shadow-md ring-2 ring-indigo-600/10"
                            : "bg-gray-50/50 dark:bg-gray-800/20 border-gray-150 dark:border-gray-800 hover:border-gray-250 hover:bg-gray-50 dark:hover:bg-gray-800/40"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            editingRecord.materialsSource === "checklist"
                              ? "border-indigo-600 dark:border-indigo-500"
                              : "border-gray-300 dark:border-gray-650"
                          }`}>
                            {editingRecord.materialsSource === "checklist" && (
                              <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-500" />
                            )}
                          </div>
                          <span className="text-xs font-bold text-gray-900 dark:text-white font-semibold">Considerar de Check List / Manutenção</span>
                        </div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 pl-6">
                          Utiliza os materiais e valores dos Check Lists em aberto.
                        </span>
                      </button>
                    </div>
                  </div>

                  {editingRecord.materialsSource === "checklist" ? (
                    <div className="space-y-4">
                      {/* Seleção de Checklists em Aberto */}
                      <div className="bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-4.5 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 tracking-wider">
                            Check Lists / Manutenção em Aberto
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">
                            Selecione um ou mais Check Lists para importar peças e custos
                          </span>
                        </div>

                        {checklists.filter((c) => c.status === "Aberto" && c.type === "manutencao").length === 0 ? (
                          <div className="text-center py-10 bg-gray-50/50 dark:bg-gray-800/20 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                            <p className="text-xs text-gray-400 font-medium">
                              Nenhum Check List / Manutenção em aberto localizado no momento.
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              Abra ou crie Check Lists na aba de Check Lists com status "Aberto" para utilizá-los aqui.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {checklists
                              .filter((c) => c.status === "Aberto" && c.type === "manutencao")
                              .map((chk) => {
                                const chkComponents = chk.details?.componentesEstoque || [];
                                const totalVal = chkComponents.reduce((acc: number, comp: any) => {
                                  const stockItem = stockItems.find(
                                    (s) => String(s.id) === String(comp.itemId)
                                  );
                                  const price = stockItem?.averagePrice || 0;
                                  return acc + (comp.qty || 0) * price;
                                }, 0);
                                const isChecked = (editingRecord.selectedChecklists || []).includes(chk.id);

                                return (
                                  <div
                                    key={chk.id}
                                    onClick={() => handleToggleChecklist(chk.id)}
                                    className={`p-3.5 rounded-xl border cursor-pointer select-none transition-all flex items-start gap-3 ${
                                      isChecked
                                        ? "bg-indigo-50/20 dark:bg-indigo-950/20 border-indigo-400 dark:border-indigo-900/80 shadow-sm"
                                        : "bg-white dark:bg-gray-900 border-gray-150 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/20"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}} // handled by click of card
                                      className="mt-0.5 rounded border-gray-350 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                        <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                          {chk.project || "Sem nome do projeto"}
                                        </span>
                                        <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded tracking-wider ${
                                          chk.type === 'checkin'
                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                                            : chk.type === 'checkout'
                                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                            : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                                        }`}>
                                          {chk.type === 'checkin' ? 'Check-in' : chk.type === 'checkout' ? 'Check-out' : 'Manutenção'}
                                        </span>
                                      </div>
                                      
                                      <div className="mt-1.5 flex flex-col gap-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                                        <span>Responsável: <strong className="text-gray-700 dark:text-gray-300">{chk.responsible || "N/A"}</strong></span>
                                        <span>Data: <strong className="text-gray-700 dark:text-gray-300">{chk.date ? chk.date.split("-").reverse().join("/") : "N/A"}</strong></span>
                                      </div>

                                      <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center text-[10px] text-gray-500">
                                        <span>{chkComponents.length} {chkComponents.length === 1 ? "item" : "itens"}</span>
                                        <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-[11px]">
                                          {formatCurrency(totalVal)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>

                      {/* Visualização consolidada dos materiais importados */}
                      {(editingRecord.materials || []).length > 0 ? (
                        <div className="space-y-2.5 animate-fade-in">
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-200 tracking-wide block">
                            Materiais Importados dos Check Lists Selecionados
                          </span>
                          <div className="bg-gray-50 dark:bg-gray-800/10 border border-gray-150 dark:border-gray-800 rounded-2xl p-4.5 space-y-3">
                            <div className="divide-y divide-gray-150 dark:divide-gray-800/60 max-h-72 overflow-y-auto pr-1">
                              {(editingRecord.materials || []).map((mat) => {
                                const subCost = mat.qty * mat.unitCost;
                                return (
                                  <div
                                    key={mat.id}
                                    className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs first:pt-0 last:pb-0"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-semibold text-gray-800 dark:text-white truncate">
                                        {mat.description}
                                      </p>
                                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                                        Quantidade: <strong className="text-gray-700 dark:text-gray-300">{mat.qty}</strong> | Custo unitário: <strong className="text-gray-700 dark:text-gray-300">{formatCurrency(mat.unitCost)}</strong>
                                      </p>
                                    </div>
                                    <div className="text-right whitespace-nowrap">
                                      <span className="text-[10px] text-gray-400 font-medium block">Subtotal</span>
                                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                                        {formatCurrency(subCost)}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-xs">
                              <span className="font-bold text-gray-800 dark:text-gray-200">Total de Materiais do Check List:</span>
                              <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">
                                {formatCurrency(
                                  (editingRecord.materials || []).reduce((acc, m) => acc + (m.unitCost * m.qty), 0)
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        (editingRecord.selectedChecklists || []).length > 0 && (
                          <div className="text-center py-8 bg-gray-50/50 dark:bg-gray-800/15 rounded-xl border border-gray-150 dark:border-gray-800">
                            <p className="text-xs text-gray-400 font-semibold italic">
                              Os Check Lists selecionados não possuem nenhuma peça ou material listado.
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Seção de Gerenciamento de Categorias */}
                      <div className="bg-indigo-50/10 dark:bg-indigo-950/5 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/40 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="text-xs font-semibold text-indigo-950 dark:text-indigo-200 tracking-wide">
                            Categorias do Orçamento
                          </span>
                          <span className="text-[10px] text-indigo-500 font-medium">
                            Crie e gerencie categorias para organizar suas peças e materiais
                          </span>
                        </div>

                        {!isReadOnly && (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Nome da categoria (ex: Inversor, Painéis, Cabos)..."
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              className="flex-1 rounded-lg border border-indigo-200 dark:border-indigo-800 focus:border-indigo-500 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white placeholder-gray-400 shadow-sm outline-none transition-colors"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddCategory();
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={handleAddCategory}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-sm hover:shadow transition-all whitespace-nowrap"
                            >
                              + Criar Categoria
                            </button>
                          </div>
                        )}

                        {/* Lista de tags de categorias */}
                        {(editingRecord.categories || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {[...(editingRecord.categories || [])].sort((a, b) => a.localeCompare(b, "pt-BR")).map((cat) => (
                              <span
                                key={cat}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 text-xs font-semibold shadow-sm border border-indigo-150/50 dark:border-indigo-900/40"
                              >
                                <span>{cat}</span>
                                {!isReadOnly && (
                                  <div className="flex items-center gap-1.5 ml-1 border-l border-indigo-200 dark:border-indigo-800/40 pl-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleEditCategory(cat)}
                                      className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all"
                                      title="Editar Categoria"
                                    >
                                      <EditIcon className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCategory(cat)}
                                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-all"
                                      title="Excluir Categoria"
                                    >
                                      <TrashIcon className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-gray-400 italic font-medium">
                            Nenhuma categoria criada ainda. Digite um nome acima para dar destaque e organizar suas peças.
                          </p>
                        )}
                      </div>

                      <div className="flex justify-between items-center pt-1">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-wide">
                          Peças e Materiais Lançados
                        </span>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={handleAddMaterialItem}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1"
                          >
                            <PlusIcon className="w-3.5 h-3.5" /> Adicionar Peça / Material
                          </button>
                        )}
                      </div>

                      {(editingRecord.materials || []).length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-gray-100 dark:border-gray-800">
                          <p className="text-xs text-gray-400 font-medium">
                            Nenhuma peça cadastrada.
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            Insira cabos, conectores, fusíveis, disjuntores ou peças
                            especiais de inversor.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(editingRecord.materials || []).map((mat, idx) => {
                            const subCost = mat.qty * mat.unitCost;
                            const subPrice = mat.qty * mat.unitPrice;
                            const isEditing = mat.isEditing !== false;
                            const categoriesList = [...(editingRecord.categories || [])].sort((a, b) => a.localeCompare(b, "pt-BR"));

                            if (isEditing) {
                              return (
                                <div
                                  key={mat.id}
                                  className="p-3 bg-indigo-50/5 dark:bg-indigo-950/5 border border-indigo-100/20 dark:border-indigo-900/20 rounded-xl"
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-[115px_140px_1fr_110px_auto_auto] gap-2.5 items-end">
                                    {/* DATA */}
                                    <div>
                                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                        Data
                                      </label>
                                      <input
                                        type="date"
                                        required
                                        value={mat.date || ""}
                                        onChange={(e) =>
                                          handleUpdateMaterialItem(idx, {
                                            date: e.target.value,
                                          })
                                        }
                                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1.5 text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none"
                                      />
                                    </div>

                                    {/* CATEGORIA */}
                                    <div>
                                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                        Categoria
                                      </label>
                                      <select
                                        value={mat.category || ""}
                                        onChange={(e) =>
                                          handleUpdateMaterialItem(idx, {
                                            category: e.target.value,
                                          })
                                        }
                                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1.5 text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none"
                                      >
                                        <option value="">Sem Categoria</option>
                                        {categoriesList.map((c) => (
                                          <option key={c} value={c}>
                                            {c}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* DESCRIÇÃO */}
                                    <div>
                                      <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                        Descrição
                                      </label>
                                      <input
                                        type="text"
                                        required
                                        placeholder="Descrição (ex: Hospedagem)..."
                                        value={mat.description}
                                        onChange={(e) =>
                                          handleUpdateMaterialItem(idx, {
                                            description: e.target.value,
                                          })
                                        }
                                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1.5 text-xs font-medium focus:ring-1 focus:ring-indigo-500 outline-none placeholder-gray-400"
                                      />
                                    </div>

                                    {/* VALOR (R$) */}
                                    <div>
                                      <label className="block text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 mb-1 ml-0.5">
                                        Valor (R$)
                                      </label>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0,00"
                                        value={mat.unitPrice || ""}
                                        onChange={(e) =>
                                          handleUpdateMaterialItem(idx, {
                                            unitPrice:
                                              parseFloat(e.target.value) || 0,
                                            unitCost:
                                              parseFloat(e.target.value) || 0,
                                          })
                                        }
                                        className="w-full rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 p-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                                      />
                                    </div>

                                    {/* BOTÃO SALVAR */}
                                    <div className="w-full md:w-auto">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!mat.description.trim()) {
                                            safeAlert("Por favor, informe a descrição.");
                                            return;
                                          }
                                          handleUpdateMaterialItem(idx, {
                                            isEditing: false,
                                          });
                                        }}
                                        className="w-full md:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm hover:shadow transition-all flex items-center justify-center gap-1 whitespace-nowrap min-h-[30px]"
                                      >
                                        <SaveIcon className="w-3.5 h-3.5" /> Salvar Linha
                                      </button>
                                    </div>

                                    {/* BOTÃO EXCLUIR */}
                                    <div className="w-full md:w-auto flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRemoveMaterialItem(idx)
                                        }
                                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 rounded-lg transition-all"
                                        title="Remover"
                                      >
                                        <TrashIcon className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={mat.id}
                                className="py-1.5 px-3 bg-gray-50 dark:bg-gray-800/10 border border-gray-100 dark:border-gray-800/60 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2 shadow-sm"
                              >
                                <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                                  {/* DATA */}
                                  {mat.date && (
                                    <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md font-bold font-mono">
                                      {mat.date.split("-").reverse().join("/")}
                                    </span>
                                  )}

                                  {/* DESCRIÇÃO & CATEGORIA */}
                                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-semibold text-gray-800 dark:text-white">
                                      {mat.description}
                                    </p>
                                    {mat.category ? (
                                      <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[9px] font-extrabold tracking-wide">
                                        {mat.category}
                                      </span>
                                    ) : (
                                      <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-400 text-[9px] font-medium italic">
                                        Sem Categoria
                                      </span>
                                    )}
                                  </div>

                                  {/* VALOR */}
                                  <div className="flex flex-col md:items-end leading-none pr-1.5">
                                    <span className="text-[8px] text-gray-400 font-semibold uppercase tracking-wider mb-0.5">
                                      Valor
                                    </span>
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                      {formatCurrency(mat.unitPrice)}
                                    </span>
                                  </div>
                                </div>

                                {/* ACTIONS */}
                                {!isReadOnly && (
                                  <div className="flex items-center gap-0.5 justify-end pt-1 md:pt-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdateMaterialItem(idx, {
                                          isEditing: true,
                                        })
                                      }
                                      className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 p-1 rounded-md transition-all"
                                      title="Editar"
                                    >
                                      <EditIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMaterialItem(idx)}
                                      className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1 rounded-md transition-all"
                                      title="Remover"
                                    >
                                      <TrashIcon className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {/* Totalizador de Peças e Materiais */}
                  {(() => {
                    const materialsTotal = (editingRecord.materials || []).reduce((acc, m) => acc + m.unitCost * m.qty, 0);
                    if (materialsTotal <= 0) return null;
                    return (
                      <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/30 p-4 rounded-xl flex justify-between items-center mt-4">
                        <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                          Total de Peças e Materiais (Despesa / Saída):
                        </span>
                        <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                          {formatCurrency(materialsTotal)}
                        </span>
                      </div>
                    );
                  })()}
                  </div>
                </fieldset>
              )}

              {/* TAB 4: Resumo Financeiro */}
              {activeTab === "resumo" && (
                <div className="space-y-5">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white tracking-tight">
                    Consolidação de Receitas (Entradas) e Despesas (Saídas)
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tabela detalhada de consolidação */}
                    <div className="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
                      <h5 className="text-[10px] font-black text-gray-400 tracking-wider">
                        Detalhamento Financeiro
                      </h5>

                      <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800/60">
                        <span className="text-gray-500 font-medium">
                          Serviços e Mão de Obra (Receita / Entrada):
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(
                            (editingRecord.services || []).reduce(
                              (acc, s) => acc + s.unitPrice * s.qty,
                              0,
                            ),
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800/60">
                        <span className="text-gray-500 font-medium">
                          Peças e Materiais (Despesa / Saída):
                        </span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {formatCurrency(
                            (editingRecord.materials || []).reduce(
                              (acc, m) => acc + m.unitCost * m.qty,
                              0,
                            ),
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Card de Indicador / Dashboard de Margem */}
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-5 rounded-2xl border border-indigo-100/30 flex flex-col justify-between">
                      <div>
                        <h5 className="text-[10px] font-black text-indigo-400 tracking-wider mb-2">
                          Margem de Lucro do Chamado
                        </h5>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-3xl font-black ${computedTotals.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {computedTotals.margin.toFixed(1)}%
                          </span>
                          <span className="text-xs text-gray-500 font-bold">
                            de margem líquida
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 mt-4">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Total de Despesas (Saída):</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {formatCurrency(computedTotals.cost)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Total de Receita (Entrada):</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(computedTotals.price)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs font-bold pt-1.5 border-t border-indigo-100/30">
                          <span className="text-gray-800 dark:text-white">
                            Saldo Líquido Estimado:
                          </span>
                          <span className={computedTotals.profit >= 0 ? "text-emerald-500 font-black" : "text-rose-500 font-black"}>
                            {formatCurrency(computedTotals.profit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Custos por Categoria de Peças/Materiais */}
                  {materialsByCategory.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800/60 pb-2">
                        <h5 className="text-[10px] font-black text-gray-400 tracking-wider">
                          Consolidação por Categoria de Materiais
                        </h5>
                        <span className="text-[9px] text-gray-400 font-bold">
                          Resumo Financeiro por Categoria
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {materialsByCategory.map((item) => (
                          <div
                            key={item.category}
                            className="bg-white dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800/60 flex flex-col justify-between gap-1 shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate pr-2"
                                title={item.category}
                              >
                                {item.category}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md font-bold whitespace-nowrap">
                                  {item.count}{" "}
                                  {item.count === 1 ? "item" : "itens"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setViewingCategoryMaterials({ category: item.category, items: item.items })}
                                  className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                  title="Visualizar lançamentos"
                                >
                                  <EyeIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <div className="flex justify-between items-baseline mt-1.5 pt-1.5 border-t border-gray-50 dark:border-gray-800/40">
                              <span className="text-[9px] text-gray-400 font-semibold">
                                Valor Total:
                              </span>
                              <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                                {formatCurrency(item.totalCost)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 tracking-tight mb-1 ml-1">
                      Observações Finais / Termos de Atendimento
                    </label>
                    <textarea
                      rows={2}
                      disabled={isReadOnly}
                      value={editingRecord.notes || ""}
                      onChange={(e) =>
                        setEditingRecord({
                          ...editingRecord,
                          notes: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-semibold shadow-sm outline-none disabled:opacity-50"
                      placeholder="Garantia de atendimento, notas adicionais..."
                    />
                  </div>
                </div>
              )}
            </form>

            {/* Footer Modal */}
            <div className="shrink-0 px-6 py-4 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <div className="text-left">
                {activeTab !== "dados" && activeTab !== "resumo" && (
                  <>
                    <span className="block text-[8px] text-gray-400 font-black tracking-wider">
                      {activeTab === "servicos" || activeTab === "materiais" ? "Valor Total" : "Valor total cobrado"}
                    </span>
                    <span className={`text-sm font-black ${
                      activeTab === "servicos"
                        ? "text-purple-600 dark:text-purple-400"
                        : activeTab === "materiais"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-indigo-600 dark:text-indigo-400"
                    }`}>
                      {formatCurrency(
                        activeTab === "servicos"
                          ? (editingRecord.services || []).reduce((acc, s) => acc + s.unitPrice * s.qty, 0)
                          : activeTab === "materiais"
                          ? (editingRecord.materials || []).reduce((acc, m) => acc + m.unitCost * m.qty, 0)
                          : computedTotals.price
                      )}
                    </span>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingRecord(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all"
                >
                  {isReadOnly ? "Fechar" : "Cancelar"}
                </button>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={handleSaveRecord}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                  >
                    <SaveIcon className="w-4 h-4" />{" "}
                    {isSaving ? "Salvando..." : "Salvar Manutenção"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Justificativa de Perda */}
      {showLossReasonModal && lossReasonRecord && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-2 bg-red-100 dark:bg-red-950/40 rounded-xl">
                <XCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-gray-950 dark:text-white tracking-tight">
                  Motivo de Perda do Orçamento
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                  {lossReasonRecord.record.clientName || "Cliente"}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-gray-400 tracking-tight">
                Justificativa / Motivo de Perda *
              </label>
              <textarea
                value={tempLossReason}
                onChange={(e) => setTempLossReason(e.target.value)}
                placeholder="Por que este orçamento de manutenção foi perdido? (Ex: preço, prazo, concorrente, etc)..."
                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 p-3 text-xs font-semibold focus:ring-red-500 focus:border-red-500 outline-none"
                rows={4}
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowLossReasonModal(false);
                  setLossReasonRecord(null);
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl font-bold text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!tempLossReason.trim()}
                onClick={async () => {
                  const reason = tempLossReason.trim();
                  if (!reason) return;

                  if (lossReasonRecord.source === 'modal') {
                    setEditingRecord({
                      ...lossReasonRecord.record,
                      status: 'Perdido',
                      motivoPerdido: reason,
                    });
                  } else {
                    // Update directly in database and state
                    const updated = {
                      ...lossReasonRecord.record,
                      status: 'Perdido' as const,
                      motivoPerdido: reason,
                    };
                    try {
                      await dataService.save("manutencoes", updated);
                      setMaintenances((prev) =>
                        prev.map((m) => (m.id === updated.id ? updated : m)),
                      );
                    } catch (e) {
                      console.error("Erro ao salvar motivo de perda:", e);
                    }
                  }
                  setShowLossReasonModal(false);
                  setLossReasonRecord(null);
                }}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-red-600/20 transition-all disabled:opacity-50"
              >
                Confirmar Perda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes dos Gastos por Categoria */}
      {viewingCategoryMaterials && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/20">
              <div>
                <h3 className="text-sm font-black text-gray-950 dark:text-white tracking-tight">
                  Consulta de Gastos Lançados
                </h3>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                  Categoria: {viewingCategoryMaterials.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingCategoryMaterials(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Tabela de Lançamentos */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="overflow-hidden border border-gray-100 dark:border-gray-800 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 text-[10px] font-black text-gray-400 tracking-wider">
                      <th className="py-2.5 px-4 font-bold">Data</th>
                      <th className="py-2.5 px-4 font-bold">Descrição</th>
                      <th className="py-2.5 px-4 font-bold text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/40">
                    {viewingCategoryMaterials.items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 font-semibold text-gray-700 dark:text-gray-300">
                        <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">
                          {item.date ? new Date(item.date + "T00:00:00").toLocaleDateString("pt-BR") : "-"}
                        </td>
                        <td className="py-2.5 px-4 truncate max-w-[220px]" title={item.description}>
                          {item.description || "Sem descrição"}
                        </td>
                        <td className="py-2.5 px-4 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {formatCurrency(item.unitCost * item.qty)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-100 dark:border-gray-800 font-bold bg-gray-50/50 dark:bg-gray-800/20">
                      <td colSpan={2} className="py-2.5 px-4 text-gray-500 text-right">Total:</td>
                      <td className="py-2.5 px-4 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        {formatCurrency(viewingCategoryMaterials.items.reduce((acc, curr) => acc + curr.unitCost * curr.qty, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingCategoryMaterials(null)}
                className="px-5 py-2.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700 rounded-xl font-bold text-xs transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Renderizador para os Cards de Kanban
  function renderKanbanCard(m: ManutencaoRecord) {
    const totalItems = (m.services || []).length + (m.materials || []).length;
    const profit = m.totalPrice - m.totalCost;
    const margin = m.totalPrice > 0 ? (profit / m.totalPrice) * 100 : 0;

    return (
      <div
        key={m.id}
        className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all space-y-3 group"
      >
        {/* Header do Card */}
        <div className="flex justify-between items-start gap-2">
          <div>
            <h4 className="text-xs font-black text-gray-800 dark:text-white line-clamp-1">
              {m.clientName}
            </h4>
            <span className="text-[9px] font-bold text-gray-400 block mt-0.5">
              {m.title}
            </span>
          </div>
          <span className="text-[9px] font-bold text-gray-400/80 shrink-0">
            {formatDate(m.createdAt?.split("T")[0])}
          </span>
        </div>

        {/* Resumo do chamado */}
        {m.description && (
          <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed italic">
            "{m.description}"
          </p>
        )}

        {m.status === "Perdido" && m.motivoPerdido && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-950/40 p-2.5 rounded-xl">
            <span className="block text-[8px] font-black text-red-500 uppercase tracking-wider mb-0.5">
              Motivo da Perda
            </span>
            <p className="text-[10px] text-red-700 dark:text-red-400 font-medium leading-normal italic">
              "{m.motivoPerdido}"
            </p>
          </div>
        )}

        {/* Badges de Serviços e Itens */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {totalItems} itens manuais
          </span>
          {m.city && (
            <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 max-w-[120px] truncate">
              <MapPinIcon className="w-2.5 h-2.5" /> {m.city}
            </span>
          )}
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-700/60"></div>

        {/* Informações de Valores e Margem */}
        <div className="flex justify-between items-center text-xs">
          <div>
            <span className="block text-[8px] text-gray-400 font-bold">
              Preço Cobrado
            </span>
            <span className="font-black text-indigo-600 dark:text-indigo-400">
              {formatCurrency(m.totalPrice)}
            </span>
          </div>
          <div className="text-right">
            <span className="block text-[8px] text-gray-400 font-bold">
              Margem Lucro
            </span>
            <span
              className={`font-black ${margin >= 40 ? "text-emerald-500" : margin >= 20 ? "text-amber-500" : "text-red-500"}`}
            >
              {margin.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Menu de Ações inferiores */}
        <div className="flex justify-between items-center pt-2.5 border-t border-gray-50 dark:border-gray-700/40 mt-1.5">
          {/* Botões rápidos de mudança de status */}
          <div className="flex gap-1">
            {m.status === "Especulação" && (
              <>
                <button
                  onClick={() => handleQuickStatusChange(m, "Aprovado")}
                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[9px] font-black rounded-lg transition-all"
                  title="Aprovar Manutenção"
                >
                  Aprovar OS
                </button>
                <button
                  onClick={() => {
                    setTempLossReason(m.motivoPerdido || "");
                    setLossReasonRecord({
                      record: m,
                      source: "kanban",
                    });
                    setShowLossReasonModal(true);
                  }}
                  className="px-2 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-[9px] font-black rounded-lg transition-all"
                  title="Marcar como Perdido"
                >
                  Perdido
                </button>
              </>
            )}
            {m.status === "Aprovado" && (
              <button
                onClick={() => handleQuickStatusChange(m, "Finalizado")}
                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 text-[9px] font-black rounded-lg transition-all"
                title="Finalizar Atendimento"
              >
                Finalizar
              </button>
            )}
            {m.status === "Finalizado" && (
              <button
                onClick={() => handleQuickStatusChange(m, "Aprovado")}
                className="px-2 py-1 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-[9px] font-bold rounded-lg transition-all"
                title="Mover para Em Execução"
              >
                Reabrir
              </button>
            )}
            {m.status === "Perdido" && (
              <button
                onClick={() => handleQuickStatusChange(m, "Especulação")}
                className="px-2 py-1 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 text-[9px] font-bold rounded-lg transition-all"
                title="Mover para Especulação"
              >
                Reabrir
              </button>
            )}
          </div>

          {/* Botões de Ações gerais */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPrintRecord(m)}
              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-all"
              title="Imprimir orçamento / OS"
            >
              <PrinterIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleOpenEditModal(m)}
              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-all"
              title={m.status === "Finalizado" ? "Visualizar detalhes" : "Editar detalhes"}
            >
              {m.status === "Finalizado" ? (
                <EyeIcon className="w-3.5 h-3.5" />
              ) : (
                <EditIcon className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default ManutencaoPage;
