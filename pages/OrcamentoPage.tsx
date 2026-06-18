import React, { useState, useEffect, useMemo, useRef } from "react";
import type {
  SavedOrcamento,
  OrcamentoPageProps,
  OrcamentoStatus,
  SalesSummaryItem,
  User,
  ChecklistEntry,
  LavagemClient,
  Instalador,
  StockItem,
} from "../types";
import {
  TrashIcon,
  AddIcon,
  EditIcon,
  FilterIcon,
  CalendarIcon,
  DollarIcon,
  TrendUpIcon,
  EyeIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  UsersIcon,
  SparklesIcon,
  ClockIcon,
  SearchIcon,
  CalculatorIcon,
  PhoneIcon,
  MapPinIcon,
  BoltIcon,
  ClipboardListIcon,
} from "../assets/icons";
import Modal from "../components/Modal";
import { dataService } from "../services/dataService";
import type { LavagemRecord } from "../types";

const STATUS_OPTIONS: OrcamentoStatus[] = [
  "Em Aberto",
  "Aprovado",
  "Finalizado",
  "Parado",
  "Perdido",
];

const FormLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5 tracking-tight">
    {children}
  </label>
);

const SectionHeader: React.FC<{
  icon: React.ReactElement<any>;
  title: string;
  color?: string;
  rightElement?: React.ReactNode;
}> = ({ icon, title, color = "bg-indigo-600", rightElement }) => {
  const isHex = color.startsWith("#");
  return (
    <div className="flex items-center justify-between mb-3 pb-1 border-b border-gray-100 dark:border-gray-700/50">
      <div className="flex items-center gap-2">
        <div
          className={`p-1 rounded-lg text-white ${!isHex ? color : ""}`}
          style={isHex ? { backgroundColor: color } : {}}
        >
          {React.cloneElement(icon, { className: "w-3.5 h-3.5" })}
        </div>
        <h4 className="text-[10px] font-black text-gray-500 dark:text-gray-400 tracking-wider">
          {title}
        </h4>
      </div>
      {rightElement && <div>{rightElement}</div>}
    </div>
  );
};

const toSentenceCase = (str: string) => {
  if (!str) return "";
  const clean = str.toLowerCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const parseSafeNumber = (val: any): number => {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const clean = String(val)
    .replace(/R\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

// Premium, vivid custom color mapping for statuses inside CRM layout
const STATUS_COLORS: Record<
  string,
  {
    bg: string;
    text: string;
    border: string;
    dot: string;
    ring: string;
    line: string;
    badge: string;
  }
> = {
  "Em Aberto": {
    bg: "bg-amber-50/70 dark:bg-amber-950/20",
    text: "text-amber-800 dark:text-amber-300",
    border: "border-amber-200/60 dark:border-amber-800/20",
    dot: "bg-amber-500",
    ring: "ring-amber-500/20",
    line: "border-l-amber-500",
    badge:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",
  },
  Aprovado: {
    bg: "bg-emerald-50/70 dark:bg-emerald-950/20",
    text: "text-emerald-800 dark:text-emerald-300",
    border: "border-emerald-200/60 dark:border-emerald-800/20",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/20",
    line: "border-l-emerald-500",
    badge:
      "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300",
  },
  Finalizado: {
    bg: "bg-violet-50/70 dark:bg-violet-950/20",
    text: "text-violet-800 dark:text-violet-300",
    border: "border-violet-200/60 dark:border-violet-800/20",
    dot: "bg-violet-500",
    ring: "ring-violet-500/20",
    line: "border-l-violet-500",
    badge:
      "bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300",
  },
  Parado: {
    bg: "bg-orange-50/70 dark:bg-orange-950/20",
    text: "text-orange-800 dark:text-orange-300",
    border: "border-orange-200/60 dark:border-orange-800/20",
    dot: "bg-orange-500",
    ring: "ring-orange-500/20",
    line: "border-l-orange-500",
    badge:
      "bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300",
  },
  Perdido: {
    bg: "bg-rose-50/70 dark:bg-rose-950/20",
    text: "text-rose-800 dark:text-rose-300",
    border: "border-rose-200/60 dark:border-rose-800/20",
    dot: "bg-rose-500",
    ring: "ring-rose-500/20",
    line: "border-l-rose-500",
    badge: "bg-rose-100 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300",
  },
};

const defaultColor = {
  bg: "bg-gray-50/70 dark:bg-gray-800/20",
  text: "text-gray-800 dark:text-gray-300",
  border: "border-gray-200 dark:border-gray-700/50",
  dot: "bg-gray-500",
  ring: "ring-gray-500/20",
  line: "border-l-gray-500",
  badge: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300",
};

const OrcamentoPage: React.FC<OrcamentoPageProps> = ({
  setCurrentPage,
  onEdit,
  currentUser,
}) => {
  const [orcamentos, setOrcamentos] = useState<SavedOrcamento[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);

  // States for "Novo cliente solar" modal trigger upon "Aprovado" status selection
  const [lavagemClients, setLavagemClients] = useState<LavagemClient[]>([]);
  const [lavagemRecords, setLavagemRecords] = useState<LavagemRecord[]>([]);
  const [checklistCheckouts, setChecklistCheckouts] = useState<
    ChecklistEntry[]
  >([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [selectedOrcamentoToApprove, setSelectedOrcamentoToApprove] =
    useState<SavedOrcamento | null>(null);
  const [clientForm, setClientForm] = useState<Partial<LavagemClient>>({
    name: "",
    phone: "",
    cep: "",
    address: "",
    address_number: "",
    complement: "",
    city: "",
    plates_count: 0,
    installation_end_date: "",
    observations: "",
  });
  const lastFetchedCep = useRef("");
  const [orcamentoToDeleteId, setOrcamentoToDeleteId] = useState<number | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  // States for toggle "Instalação Finalizada" date picker
  const [showInstallationEndDateModal, setShowInstallationEndDateModal] =
    useState(false);
  const [pendingInstallationEndDate, setPendingInstallationEndDate] =
    useState("");
  const [pendingTrackingOrcamentoId, setPendingTrackingOrcamentoId] = useState<
    number | null
  >(null);

  // States for Deslocamento Calculator Modal
  const [showDistanceModal, setShowDistanceModal] = useState(false);
  const [instaladores, setInstaladores] = useState<Instalador[]>([]);
  const [calcInstaladorId, setCalcInstaladorId] = useState("");
  const [calcCep, setCalcCep] = useState("");
  const [calcRua, setCalcRua] = useState("");
  const [calcNumero, setCalcNumero] = useState("");
  const [calcCidade, setCalcCidade] = useState("");
  const [calcUf, setCalcUf] = useState("");
  const [calcDistanceKm, setCalcDistanceKm] = useState<number | null>(null);
  const [systemKmValue, setSystemKmValue] = useState<number>(1.2);
  const [calcValorKm, setCalcValorKm] = useState("1.20");
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [calcIdaVolta, setCalcIdaVolta] = useState(true);
  const [calcHotel, setCalcHotel] = useState("0");
  const [calcMargem, setCalcMargem] = useState("0");

  const [activeTab, setActiveTab] = useState<string>("Em Aberto");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const userDropdownRef = useRef<HTMLDivElement>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const ADMIN_PROFILE_ID = "001";
  const isAdminUser = currentUser.profileId === ADMIN_PROFILE_ID;

  const [editingTrackId, setEditingTrackId] = useState<number | null>(null);
  const [trackVendaEtapas, setTrackVendaEtapas] = useState<any>({});
  const [trackCustosEstimados, setTrackCustosEstimados] = useState<any>({});
  const [trackCustosReais, setTrackCustosReais] = useState<any>({});

  const [showMemorialModal, setShowMemorialModal] = useState(false);
  const [memorialData, setMemorialData] = useState<any>(null);

  const handleOpenMemorial = (orc: SavedOrcamento, isReal: boolean) => {
    const variant = orc.variants?.find((v) => v.isPrincipal) ||
      orc.variants?.[0] || { formState: orc.formState };
    const fs = variant?.formState || {};

    let dist = parseFloat(fs.distanciaObraKM) || 0;
    let dias = parseInt(fs.quantidadeDiasViagem) || 1;
    let idaVolta = fs.considerarIdaVolta !== false;
    let vKm = parseFloat(fs.deslocamentoValorKm) || 1.2;
    let hotel = parseFloat(fs.deslocamentoHotel) || 0;
    let margem = parseFloat(fs.deslocamentoMargem) || 0;
    let finalVal =
      fs.deslocamento !== undefined
        ? parseFloat(String(fs.deslocamento).replace(",", ".")) || 0
        : parseFloat(String(fs.custoViagem).replace(",", ".")) || 0;

    if (isReal) {
      if (
        trackCustosReais &&
        trackCustosReais.deslocamentoDistanceKm !== undefined
      ) {
        dist = parseFloat(trackCustosReais.deslocamentoDistanceKm) || 0;
        vKm = parseFloat(trackCustosReais.deslocamentoValorKm) || 1.2;
        idaVolta = trackCustosReais.deslocamentoIdaVolta !== false;
        hotel = parseFloat(trackCustosReais.deslocamentoHotel) || 0;
        margem = parseFloat(trackCustosReais.deslocamentoMargem) || 0;
        finalVal = parseFloat(trackCustosReais.deslocamento) || 0;
      } else {
        const trackVal = parseFloat(trackCustosReais?.deslocamento);
        if (!isNaN(trackVal)) {
          finalVal = trackVal;
        } else if (orc.custos_reais?.deslocamento !== undefined) {
          finalVal = orc.custos_reais.deslocamento;
        }
      }
    } else {
      if (orc.custos_estimados?.deslocamento !== undefined) {
        finalVal = orc.custos_estimados.deslocamento;
      }
    }

    const inst = instaladores.find((i) => i.id === (fs.instaladorId || ""));
    const instaladorNome = inst ? inst.nome : "Não selecionado";

    setMemorialData({
      distancia: dist,
      dias: dias,
      idaVolta: idaVolta,
      valorKm: vKm,
      hotel: hotel,
      margem: margem,
      instaladorNome: instaladorNome,
      valorFinal: finalVal,
      isReal: isReal,
    });
    setShowMemorialModal(true);
  };

  const getRunningTracking = (orc: SavedOrcamento) => {
    let variant = orc.variants?.find((v) => v.isPrincipal) ||
      orc.variants?.[0] || {
        formState: orc.formState,
        calculated: orc.calculated,
      };
    const fs = variant?.formState || {};
    const calc = variant?.calculated || {};
    const thirdPartyInstallation =
      parseSafeNumber(fs.terceiroInstalacaoQtd) *
      parseSafeNumber(fs.terceiroInstalacaoCusto);

    const defaultEtapas = {
      compra_equipamento: false,
      contrato_procuracao: false,
      homologacao: false,
      agendamento_instalacao: false,
      pag_instalacao: false,
      pag_reembolso: false,
      instalacao_finalizada: false,
      faturado: false,
    };

    const originalCustos = {
      homologacao: parseSafeNumber(fs.projetoHomologacaoCusto),
      deslocamento:
        fs.deslocamento !== undefined
          ? parseSafeNumber(fs.deslocamento)
          : parseSafeNumber(fs.custoViagem),
      pedagio: parseSafeNumber(fs.pedagio),
      adequacao: parseSafeNumber(fs.adequacaoLocalCusto),
      instalacao: thirdPartyInstallation,
      materiais: parseSafeNumber(calc.totalEstrutura),
      imposto: parseSafeNumber(calc.impostos || calc.nfServicoValor || 0),
    };

    const currentEtapas = { ...defaultEtapas, ...(orc.venda_etapas || {}) };

    const isRealConfigured =
      orc.custos_reais && Object.keys(orc.custos_reais).length >= 6;
    const currentReais = isRealConfigured
      ? { ...originalCustos, ...orc.custos_reais }
      : { ...originalCustos };

    const clientName = fs.nomeCliente || "";
    let matchedCheckout: ChecklistEntry | undefined = undefined;
    if (orc.custos_reais?.linked_checkout_id) {
      matchedCheckout = checklistCheckouts.find(
        (c) =>
          String(c.id) === String(orc.custos_reais?.linked_checkout_id) &&
          c.status === "Finalizado",
      );
    }
    if (!matchedCheckout && clientName) {
      matchedCheckout = checklistCheckouts.find(
        (c) =>
          c.project?.toLowerCase().trim() === clientName.toLowerCase().trim() &&
          c.status === "Finalizado",
      );
    }
    if (matchedCheckout && matchedCheckout.details?.componentesEstoque) {
      const list = matchedCheckout.details.componentesEstoque || [];
      const calculatedMaterialsCost = list.reduce(
        (sum: number, comp: any) => {
          const item = stockItems.find(
            (si) => String(si.id) === String(comp.itemId),
          );
          const price = item ? item.averagePrice || 0 : 0;
          return sum + comp.qty * price;
        },
        0,
      );
      currentReais.materiais = calculatedMaterialsCost;
    }

    return {
      etapas: currentEtapas,
      estimados: originalCustos,
      reais: currentReais,
    };
  };

  const handleStartEditTracking = (orc: SavedOrcamento) => {
    setEditingTrackId(orc.id);
    const tracking = getRunningTracking(orc);
    setTrackVendaEtapas(tracking.etapas);
    setTrackCustosEstimados(tracking.estimados);
    setTrackCustosReais(tracking.reais);

    // Pre-fill pending installation end date if client exists and already has one
    const v = orc.variants?.find((x) => x.isPrincipal) ||
      orc.variants?.[0] || { formState: orc.formState };
    const clientName = v.formState?.nomeCliente || "";
    const matchingClient = lavagemClients.find(
      (lc) => lc.name?.toLowerCase().trim() === clientName.toLowerCase().trim(),
    );
    if (matchingClient && matchingClient.installation_end_date) {
      setPendingInstallationEndDate(matchingClient.installation_end_date);
    } else {
      setPendingInstallationEndDate("");
    }
  };

  const handleSaveTracking = async (id: number) => {
    const orcamento = orcamentos.find((o) => o.id === id);
    if (!orcamento) return;

    const updatedOrcamento: SavedOrcamento = {
      ...orcamento,
      venda_etapas: {
        ...trackVendaEtapas,
        instalacao_finalizada_data: trackVendaEtapas.instalacao_finalizada
          ? pendingInstallationEndDate ||
            orcamento.venda_etapas?.instalacao_finalizada_data ||
            ""
          : "",
      },
      custos_estimados: {
        homologacao: parseSafeNumber(trackCustosEstimados.homologacao),
        deslocamento: parseSafeNumber(trackCustosEstimados.deslocamento),
        pedagio: parseSafeNumber(trackCustosEstimados.pedagio),
        adequacao: parseSafeNumber(trackCustosEstimados.adequacao),
        instalacao: parseSafeNumber(trackCustosEstimados.instalacao),
        materiais: parseSafeNumber(trackCustosEstimados.materiais),
        imposto: parseSafeNumber(trackCustosEstimados.imposto),
      },
      custos_reais: {
        homologacao: parseSafeNumber(trackCustosReais.homologacao),
        deslocamento: parseSafeNumber(trackCustosReais.deslocamento),
        pedagio: parseSafeNumber(trackCustosReais.pedagio),
        adequacao: parseSafeNumber(trackCustosReais.adequacao),
        instalacao: parseSafeNumber(trackCustosReais.instalacao),
        materiais: parseSafeNumber(trackCustosReais.materiais),
        imposto: parseSafeNumber(trackCustosReais.imposto),
        deslocamentoDistanceKm:
          parseSafeNumber(trackCustosReais.deslocamentoDistanceKm) !== 0
            ? parseSafeNumber(trackCustosReais.deslocamentoDistanceKm)
            : orcamento.custos_reais?.deslocamentoDistanceKm || undefined,
        deslocamentoValorKm:
          parseSafeNumber(trackCustosReais.deslocamentoValorKm) !== 0
            ? parseSafeNumber(trackCustosReais.deslocamentoValorKm)
            : orcamento.custos_reais?.deslocamentoValorKm || undefined,
        deslocamentoIdaVolta:
          trackCustosReais.deslocamentoIdaVolta !== undefined
            ? trackCustosReais.deslocamentoIdaVolta
            : orcamento.custos_reais?.deslocamentoIdaVolta,
        deslocamentoHotel:
          parseSafeNumber(trackCustosReais.deslocamentoHotel) !== 0
            ? parseSafeNumber(trackCustosReais.deslocamentoHotel)
            : orcamento.custos_reais?.deslocamentoHotel || undefined,
        deslocamentoMargem:
          parseSafeNumber(trackCustosReais.deslocamentoMargem) !== 0
            ? parseSafeNumber(trackCustosReais.deslocamentoMargem)
            : orcamento.custos_reais?.deslocamentoMargem || undefined,
        linked_checkout_id:
          trackCustosReais.linked_checkout_id !== undefined
            ? trackCustosReais.linked_checkout_id
            : orcamento.custos_reais?.linked_checkout_id || "",
      },
    };

    try {
      await dataService.save("orcamentos", updatedOrcamento);

      // Update/Create matching lavagem_client and schedule lavagem_records if installation is finalized
      if (trackVendaEtapas.instalacao_finalizada) {
        const v = orcamento.variants?.find((x) => x.isPrincipal) ||
          orcamento.variants?.[0] || {
            formState: orcamento.formState,
            calculated: orcamento.calculated,
          };
        const fs = v.formState || {};
        const clientName = fs.nomeCliente || "";
        const finalDate =
          pendingInstallationEndDate ||
          orcamento.venda_etapas?.instalacao_finalizada_data ||
          new Date().toISOString().split("T")[0];

        if (clientName) {
          const clientId = `wash-auto-${orcamento.id}`;
          let existingClient =
            lavagemClients.find((lc) => lc.id === clientId) ||
            lavagemClients.find(
              (lc) =>
                lc.name?.toLowerCase().trim() ===
                clientName.toLowerCase().trim(),
            );

          let finalClientId = clientId;
          if (existingClient) {
            finalClientId = existingClient.id;
            const targetId = existingClient.id;
            const updatedClient = {
              ...existingClient,
              installation_end_date: finalDate,
            };
            await dataService.save("lavagem_clients", updatedClient);
            setLavagemClients((prev) =>
              prev.map((c) => (c.id === targetId ? updatedClient : c)),
            );
          } else {
            const newWashClient: LavagemClient = {
              id: clientId,
              owner_id: orcamento.owner_id,
              name: clientName,
              cep: fs.cep || "",
              address: fs.enderecoCompleto || "",
              address_number: "",
              complement: "",
              city: fs.cidade || "",
              plates_count:
                Number(fs.terceiroInstalacaoQtd) ||
                Number(v.calculated?.placasQtd) ||
                0,
              phone: fs.telefoneTitular || "",
              observations: `Importado automaticamente via acompanhamento de vendas em ${new Date().toLocaleDateString("pt-BR")}.`,
              installation_end_date: finalDate,
            };
            await dataService.save("lavagem_clients", newWashClient);
            setLavagemClients((prev) => [...prev, newWashClient]);
            existingClient = newWashClient;
          }

          // Schedule automatic laundry cycle (card de lavagem) 6 months after installation end date
          const hasWashRecord = lavagemRecords.some(
            (r) => r.client_id === finalClientId,
          );
          if (!hasWashRecord) {
            const washDateObj = new Date(finalDate);
            washDateObj.setMonth(washDateObj.getMonth() + 6);
            const washDateStr = washDateObj.toISOString().split("T")[0];

            const newWashRecord: LavagemRecord = {
              id: `wash-rec-${Date.now()}`,
              client_id: finalClientId,
              owner_id: orcamento.owner_id,
              date: washDateStr,
              status: "scheduled",
              created_at: new Date().toISOString(),
              notes: "Agendado automaticamente após conclusão da instalação.",
            };
            await dataService.save("lavagem_records", newWashRecord);
            setLavagemRecords((prev) => [...prev, newWashRecord]);
          }
        }
      }

      setOrcamentos((prev) =>
        prev.map((o) => (o.id === id ? updatedOrcamento : o)),
      );
      setEditingTrackId(null);
      setPendingInstallationEndDate("");
      setPendingTrackingOrcamentoId(null);
    } catch (e) {
      console.error("Erro ao salvar acompanhamento:", e);
      alert("Erro ao salvar o acompanhamento no banco de dados.");
    }
  };

  const loadGoogleMapsScript = (callback: () => void) => {
    if ((window as any).google) {
      callback();
      return;
    }
    if (document.getElementById("google-maps-script")) {
      const interval = setInterval(() => {
        if ((window as any).google) {
          clearInterval(interval);
          callback();
        }
      }, 500);
      return;
    }
    const GOOGLE_MAPS_KEY =
      (globalThis as any).process?.env?.GOOGLE_MAPS_PLATFORM_KEY ||
      (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
      "";
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places,routes`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      callback();
    };
    script.onerror = () => {
      console.error("Erro ao carregar o script do Google Maps");
    };
    document.head.appendChild(script);
  };

  const calculateWithGoogleMaps = (
    originAddr: string,
    destAddr: string,
  ): Promise<number> => {
    return new Promise((resolve, reject) => {
      loadGoogleMapsScript(() => {
        if (!(window as any).google) {
          reject(new Error("Google Maps SDK não carregado"));
          return;
        }
        const service = new (window as any).google.maps.DistanceMatrixService();
        service.getDistanceMatrix(
          {
            origins: [originAddr],
            destinations: [destAddr],
            travelMode: (window as any).google.maps.TravelMode.DRIVING,
          },
          (response: any, status: string) => {
            if (
              status === "OK" &&
              response &&
              response.rows[0]?.elements[0]?.status === "OK"
            ) {
              const distanceMeters =
                response.rows[0].elements[0].distance.value;
              const distanceKm = distanceMeters / 1000;
              resolve(distanceKm);
            } else {
              const dirService = new (
                window as any
              ).google.maps.DirectionsService();
              dirService.route(
                {
                  origin: originAddr,
                  destination: destAddr,
                  travelMode: (window as any).google.maps.TravelMode.DRIVING,
                },
                (result: any, dirStatus: string) => {
                  if (
                    dirStatus === "OK" &&
                    result &&
                    result.routes[0]?.legs[0]?.distance
                  ) {
                    const distKm =
                      result.routes[0].legs[0].distance.value / 1000;
                    resolve(distKm);
                  } else {
                    reject(
                      new Error(
                        `Erro DistanceMatrix/Directions: ${status || dirStatus}`,
                      ),
                    );
                  }
                },
              );
            }
          },
        );
      });
    });
  };

  const handleOpenDistanceCalculator = (orcId: number) => {
    const orc = orcamentos.find((o) => o.id === orcId);
    if (!orc) return;

    const variant = orc.variants?.find((v) => v.isPrincipal) ||
      orc.variants?.[0] || { formState: orc.formState };
    const fs = variant?.formState || {};

    const clientName = fs.nomeCliente || "";
    const matchingClient = lavagemClients.find(
      (lc) => lc.name?.toLowerCase().trim() === clientName.toLowerCase().trim(),
    );

    setCalcInstaladorId(fs.instaladorId || "");
    setCalcCep(matchingClient?.cep || fs.cep || "");
    setCalcRua(matchingClient?.address || fs.logradouro || fs.endereco || "");
    setCalcNumero(matchingClient?.address_number || fs.numero || "");
    setCalcCidade(matchingClient?.city || fs.cidade || "");
    setCalcUf(matchingClient?.uf || fs.uf || "");
    setCalcDistanceKm(null);

    const selInst = instaladores.find((i) => i.id === (fs.instaladorId || ""));
    setCalcValorKm(String(systemKmValue));

    setCalcIdaVolta(fs.considerarIdaVolta !== false);
    setCalcHotel("0");
    setCalcMargem("0");
    setShowDistanceModal(true);
  };

  const handleFetchCepForCalculadora = async (cepVal: string) => {
    const cleanCep = cepVal.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      setIsLoadingCep(true);
      try {
        const response = await fetch(
          `https://viacep.com.br/ws/${cleanCep}/json/`,
        );
        const data = await response.json();
        if (data && !data.erro) {
          setCalcRua(data.logradouro || "");
          setCalcCidade(data.localidade || "");
          setCalcUf(data.uf || "");
        }
      } catch (e) {
        console.error("Erro ao buscar CEP:", e);
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const geocodeAddress = async (
    cep: string,
    rua: string,
    cidade: string,
    uf: string,
  ): Promise<{ lat: number; lon: number }> => {
    const cleanCepVal = (cep || "").replace(/\D/g, "");
    if (cleanCepVal.length === 8) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?postalcode=${cleanCepVal}&country=Brazil&format=json&limit=1`;
        const res = await fetch(url, {
          headers: { "User-Agent": "SistemaOrnerSolar/1.0" },
        });
        const data = await res.json();
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
      } catch (e) {
        console.warn(
          `Geocoding by CEP ${cleanCepVal} failed, trying full address...`,
          e,
        );
      }
    }

    if (rua && cidade) {
      try {
        const query = `${rua}, ${cidade} - ${uf || ""}, Brazil`;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        const res = await fetch(url, {
          headers: { "User-Agent": "SistemaOrnerSolar/1.0" },
        });
        const data = await res.json();
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
      } catch (e) {
        console.warn(
          "Geocoding by street address failed, trying city only...",
          e,
        );
      }
    }

    if (cidade) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cidade)}&state=${encodeURIComponent(uf || "")}&country=Brazil&format=json&limit=1`;
        const res = await fetch(url, {
          headers: { "User-Agent": "SistemaOrnerSolar/1.0" },
        });
        const data = await res.json();
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
      } catch (e) {
        console.warn("Geocoding by city failed", e);
      }
    }

    throw new Error(
      "Não foi possível localizar as coordenadas para o endereço sugerido.",
    );
  };

  const calculateWithOSRM = async (
    origCep: string,
    origRua: string,
    origCidade: string,
    origUf: string,
    destCep: string,
    destRua: string,
    destCidade: string,
    destUf: string,
  ): Promise<number> => {
    const originCoords = await geocodeAddress(
      origCep,
      origRua,
      origCidade,
      origUf,
    );
    const destCoords = await geocodeAddress(
      destCep,
      destRua,
      destCidade,
      destUf,
    );

    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
    const routeRes = await fetch(routeUrl);
    const routeData = await routeRes.json();

    if (routeData && routeData.routes && routeData.routes.length > 0) {
      return routeData.routes[0].distance / 1000;
    }
    throw new Error("Não foi possível calcular a rota via OSRM");
  };

  const handleCalculateGoogleDistance = async () => {
    const selectedInst = instaladores.find((i) => i.id === calcInstaladorId);
    if (!selectedInst) {
      alert("Por favor, selecione o instalador para fornecer o endereço base.");
      return;
    }

    const instNum = (selectedInst as any).numero
      ? `, ${(selectedInst as any).numero}`
      : "";
    const instBairro = (selectedInst as any).bairro
      ? ` - ${(selectedInst as any).bairro}`
      : "";
    const originAddress = `${selectedInst.endereco || ""}${instNum}${instBairro}, ${selectedInst.cidade || ""} - ${selectedInst.uf || ""}, CEP ${selectedInst.cep || ""}`;
    const destinationAddress = `${calcRua || ""}, ${calcNumero || ""}, ${calcCidade || ""} - ${calcUf || ""} CEP ${calcCep || ""}`;

    if (!calcRua || !calcCidade) {
      alert("Por favor, informe o endereço de destino (rua e cidade).");
      return;
    }

    setIsCalculatingDistance(true);
    try {
      const kms = await calculateWithGoogleMaps(
        originAddress,
        destinationAddress,
      );
      setCalcDistanceKm(parseFloat(kms.toFixed(1)));
    } catch (error: any) {
      console.warn(
        "Google Maps API calculation failed, trying real OSRM estimation...",
        error,
      );
      try {
        const kms = await calculateWithOSRM(
          selectedInst.cep || "",
          selectedInst.endereco || "",
          selectedInst.cidade || "",
          selectedInst.uf || "",
          calcCep || "",
          calcRua || "",
          calcCidade || "",
          calcUf || "",
        );
        setCalcDistanceKm(parseFloat(kms.toFixed(1)));
      } catch (osrmError: any) {
        console.warn(
          "OSRM calculation failed, falling back to deterministic hash:",
          osrmError,
        );

        // Deterministic hash based on addresses
        const strConcat = `${originAddress}||${destinationAddress}`
          .toLowerCase()
          .trim();
        let hash = 0;
        for (let i = 0; i < strConcat.length; i++) {
          hash = strConcat.charCodeAt(i) + ((hash << 5) - hash);
        }
        const absHash = Math.abs(hash);
        const minFactor = 25;
        const maxFactor = 75;
        const baseEstVal = minFactor + (absHash % (maxFactor - minFactor + 1));
        const decimalEstVal = (absHash % 10) / 10;
        const deterministicKm = parseFloat(
          (baseEstVal + decimalEstVal).toFixed(1),
        );

        setCalcDistanceKm(deterministicKm);
        alert(
          `Cálculo automático indisponível. Usando estimativa padrão de ${deterministicKm} km. Você pode editar a distância manualmente.`,
        );
      }
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  const handleApplyCalculatedDistance = () => {
    const kms = calcDistanceKm || 0;
    const vKm = parseFloat(calcValorKm) || 0;
    const hotel = parseFloat(calcHotel) || 0;
    const margem = parseFloat(calcMargem) || 0;

    let baseCost = kms * vKm * (calcIdaVolta ? 2 : 1);
    let totalCost = baseCost + hotel;
    if (margem > 0) {
      totalCost = totalCost * (1 + margem / 100);
    }

    setTrackCustosReais((prev: any) => ({
      ...prev,
      deslocamento: parseFloat(totalCost.toFixed(2)),
      deslocamentoDistanceKm: kms,
      deslocamentoValorKm: vKm,
      deslocamentoIdaVolta: calcIdaVolta,
      deslocamentoHotel: hotel,
      deslocamentoMargem: margem,
    }));
    setShowDistanceModal(false);
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [
        orcData,
        userData,
        clientsData,
        recordsData,
        instaladoresData,
        remoteConfigs,
        checkoutData,
        stockData,
      ] = await Promise.all([
        dataService.getAll<SavedOrcamento>(
          "orcamentos",
          currentUser.id,
          isAdminUser,
        ),
        dataService.getAll<User>("system_users", undefined, true),
        dataService.getAll<LavagemClient>(
          "lavagem_clients",
          currentUser.id,
          isAdminUser,
        ),
        dataService.getAll<LavagemRecord>(
          "lavagem_records",
          currentUser.id,
          isAdminUser,
        ),
        dataService.getAll<Instalador>("instaladores", currentUser.id, true),
        dataService.getAll<any>("system_configs", undefined, true),
        dataService.getAll<ChecklistEntry>(
          "checklist_checkout",
          undefined,
          true,
        ),
        dataService.getAll<StockItem>("stock_items"),
      ]);
      setOrcamentos(orcData);
      setUsers(userData);
      setLavagemClients(clientsData || []);
      setLavagemRecords(recordsData || []);
      setInstaladores(instaladoresData || []);
      setChecklistCheckouts(checkoutData || []);
      setStockItems(stockData || []);

      const remoteKm =
        (remoteConfigs || []).find((c: any) => c.id === "km_value_budget") ||
        (remoteConfigs || []).find((c: any) => c.id === "km_value");
      if (remoteKm) {
        setSystemKmValue(parseFloat(remoteKm.value) || 1.2);
      }
    } catch (e) {
      console.error("Erro ao carregar dados:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDayOfYear = new Date(year, 0, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    setStartDate(formatDate(firstDayOfYear));
    setEndDate(formatDate(lastDayOfMonth));

    const handleClickOutside = (event: MouseEvent) => {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [currentUser, isAdminUser]);

  const toggleUserFilter = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const confirmDelete = async () => {
    if (orcamentoToDeleteId !== null) {
      await dataService.delete("orcamentos", orcamentoToDeleteId);
      const currentSales =
        await dataService.getAll<SalesSummaryItem>("sales_summary");
      const saleToDelete = currentSales.find(
        (s) => s.orcamentoId === orcamentoToDeleteId,
      );
      if (saleToDelete)
        await dataService.delete("sales_summary", saleToDelete.id);
      setOrcamentos((prev) => prev.filter((o) => o.id !== orcamentoToDeleteId));
      setDeleteModalOpen(false);
      setOrcamentoToDeleteId(null);
    }
  };

  // CEP lookup automatic auto-fill inside the approve modal
  useEffect(() => {
    const cleanCep = (clientForm.cep || "").replace(/\D/g, "");
    if (
      cleanCep.length === 8 &&
      isClientModalOpen &&
      cleanCep !== lastFetchedCep.current
    ) {
      const fetchCep = async () => {
        setIsLoadingCep(true);
        try {
          const response = await fetch(
            `https://viacep.com.br/ws/${cleanCep}/json/`,
          );
          const data = await response.json();
          if (!data.erro) {
            lastFetchedCep.current = cleanCep;
            setClientForm((prev) => ({
              ...prev,
              address: data.logradouro || prev.address || "",
              city: data.localidade || prev.city || "",
            }));
          }
        } catch (e) {
          console.error("Erro ao buscar CEP:", e);
        } finally {
          setIsLoadingCep(false);
        }
      };
      fetchCep();
    }
  }, [clientForm.cep, isClientModalOpen]);

  const handleSaveApproveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrcamentoToApprove) return;
    setIsSavingClient(true);

    try {
      const clientId = `wash-auto-${selectedOrcamentoToApprove.id}`;

      // Save wash client record
      const clientData: LavagemClient = {
        id: clientId,
        owner_id: selectedOrcamentoToApprove.owner_id,
        name: clientForm.name || "",
        phone: clientForm.phone || "",
        cep: clientForm.cep || "",
        address: clientForm.address || "",
        address_number: clientForm.address_number || "",
        complement: clientForm.complement || "",
        city: clientForm.city || "",
        plates_count: clientForm.plates_count || 0,
        installation_end_date:
          clientForm.installation_end_date ||
          new Date().toISOString().split("T")[0],
        observations: clientForm.observations || "",
      };

      await dataService.save("lavagem_clients", clientData);

      // Now proceed with saving the Orçamento to 'Aprovado'
      let updatedOrcamento = {
        ...selectedOrcamentoToApprove,
        status: "Aprovado" as OrcamentoStatus,
      };

      let variant = selectedOrcamentoToApprove.variants?.find(
        (v) => v.isPrincipal,
      ) ||
        selectedOrcamentoToApprove.variants?.[0] || {
          formState: selectedOrcamentoToApprove.formState,
          calculated: selectedOrcamentoToApprove.calculated,
        };
      const fs = variant.formState || {};
      const calc = variant.calculated || {};
      const thirdPartyInstallation =
        parseSafeNumber(fs.terceiroInstalacaoQtd) *
        parseSafeNumber(fs.terceiroInstalacaoCusto);

      if (!updatedOrcamento.venda_etapas) {
        updatedOrcamento.venda_etapas = {
          compra_equipamento: false,
          contrato_procuracao: false,
          homologacao: false,
          agendamento_instalacao: false,
          pag_instalacao: false,
          pag_reembolso: false,
          instalacao_finalizada: false,
          faturado: false,
        };
      }

      if (!updatedOrcamento.custos_estimados) {
        updatedOrcamento.custos_estimados = {
          homologacao: parseSafeNumber(fs.projetoHomologacaoCusto),
          deslocamento:
            fs.deslocamento !== undefined
              ? parseSafeNumber(fs.deslocamento)
              : parseSafeNumber(fs.custoViagem),
          pedagio: parseSafeNumber(fs.pedagio),
          adequacao: parseSafeNumber(fs.adequacaoLocalCusto),
          instalacao: thirdPartyInstallation,
          materiais: parseSafeNumber(calc.totalEstrutura),
          imposto: parseSafeNumber(calc.impostos || calc.nfServicoValor || 0),
        };
      }

      await dataService.save("orcamentos", updatedOrcamento);

      // Save to sales_summary as well (exactly like the existing handleStatusChange does)
      try {
        const currentSales =
          await dataService.getAll<SalesSummaryItem>("sales_summary");
        const existing = currentSales.find(
          (s) => s.orcamentoId === selectedOrcamentoToApprove.id,
        );

        const saleItem: SalesSummaryItem = {
          id: selectedOrcamentoToApprove.id,
          orcamentoId: selectedOrcamentoToApprove.id,
          owner_id: selectedOrcamentoToApprove.owner_id,
          clientName: clientData.name, // Use the updated name from form
          date:
            clientData.installation_end_date ||
            fs.dataOrcamento ||
            selectedOrcamentoToApprove.savedAt.split("T")[0],
          closedValue: parseSafeNumber(calc.precoVendaFinal),
          systemCost: parseSafeNumber(calc.valorVendaSistema),
          supplier: fs.fornecedor || "N/A",
          visitaTecnica: parseSafeNumber(fs.visitaTecnicaCusto),
          homologation: parseSafeNumber(fs.projetoHomologacaoCusto),
          installation: thirdPartyInstallation,
          travelCost:
            fs.deslocamento !== undefined
              ? parseSafeNumber(fs.deslocamento) + parseSafeNumber(fs.pedagio)
              : parseSafeNumber(fs.custoViagem),
          adequationCost: parseSafeNumber(fs.adequacaoLocalCusto),
          materialCost: parseSafeNumber(calc.totalEstrutura),
          invoicedTax: existing
            ? parseSafeNumber(existing.invoicedTax)
            : parseSafeNumber(calc.nfServicoValor),
          commission: parseSafeNumber(calc.comissaoVendasValor),
          bankFees: existing ? parseSafeNumber(existing.bankFees) : 0,
          totalCost: 0,
          netProfit: 0,
          finalMargin: 0,
          status: "Aprovado",
        };

        const extraCosts =
          (saleItem.visitaTecnica ?? 0) +
          (saleItem.homologation ?? 0) +
          (saleItem.installation ?? 0) +
          (saleItem.travelCost ?? 0) +
          (saleItem.adequationCost ?? 0) +
          (saleItem.materialCost ?? 0) +
          (saleItem.invoicedTax ?? 0) +
          (saleItem.commission ?? 0) +
          (saleItem.bankFees ?? 0);

        saleItem.totalCost = extraCosts;
        saleItem.netProfit =
          saleItem.closedValue - saleItem.systemCost - extraCosts;
        saleItem.finalMargin =
          saleItem.closedValue > 0
            ? (saleItem.netProfit / saleItem.closedValue) * 100
            : 0;

        await dataService.save("sales_summary", saleItem);
      } catch (err) {
        console.warn("Automação Resumo de Vendas falhou:", err);
      }

      setIsClientModalOpen(false);
      setSelectedOrcamentoToApprove(null);
      await loadData();
      alert(
        "Cadastro de cliente solar salvo e orçamento APROVADO com sucesso!",
      );
    } catch (err) {
      console.error("Erro ao aprovar orçamento e salvar cliente:", err);
      alert("Ocorreu um erro ao salvar o cadastro.");
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: OrcamentoStatus) => {
    const orcamento = orcamentos.find((o) => o.id === id);
    if (!orcamento) return;

    if (newStatus === "Aprovado") {
      let variant = orcamento.variants?.find((v) => v.isPrincipal) ||
        orcamento.variants?.[0] || {
          formState: orcamento.formState,
          calculated: orcamento.calculated,
        };
      const fs = variant.formState || {};

      // Verificamos se já existe um cadastro de cliente para este orçamento
      const existingClient = lavagemClients.find(
        (c) => c.id === `wash-auto-${orcamento.id}`,
      );

      setSelectedOrcamentoToApprove(orcamento);
      setClientForm({
        name: existingClient?.name || fs.nomeCliente || "",
        phone: existingClient?.phone || fs.telefoneTitular || "",
        cep: existingClient?.cep || fs.cep || "",
        address: existingClient?.address || fs.enderecoCompleto || "",
        address_number: existingClient?.address_number || "",
        complement: existingClient?.complement || "",
        city: existingClient?.city || fs.cidade || "",
        plates_count:
          existingClient?.plates_count ||
          Number(fs.terceiroInstalacaoQtd) ||
          Number(variant.calculated?.placasQtd) ||
          0,
        installation_end_date:
          existingClient?.installation_end_date ||
          new Date().toISOString().split("T")[0],
        observations:
          existingClient?.observations ||
          `Importado via orçamento em ${new Date().toLocaleDateString("pt-BR")}.`,
      });
      setIsClientModalOpen(true);
      return;
    }

    let updatedOrcamento = { ...orcamento, status: newStatus };

    if (newStatus === "Finalizado") {
      let variant = orcamento.variants?.find((v) => v.isPrincipal) ||
        orcamento.variants?.[0] || {
          formState: orcamento.formState,
          calculated: orcamento.calculated,
        };
      const fs = variant.formState || {};
      const calc = variant.calculated || {};
      const thirdPartyInstallation =
        parseSafeNumber(fs.terceiroInstalacaoQtd) *
        parseSafeNumber(fs.terceiroInstalacaoCusto);

      if (!updatedOrcamento.venda_etapas) {
        updatedOrcamento.venda_etapas = {
          compra_equipamento: true,
          contrato_procuracao: true,
          homologacao: true,
          agendamento_instalacao: true,
          pag_instalacao: true,
          pag_reembolso: true,
          instalacao_finalizada: true,
          instalacao_finalizada_data: new Date().toISOString().split("T")[0],
          faturado: true,
        };
      } else {
        updatedOrcamento.venda_etapas = {
          ...updatedOrcamento.venda_etapas,
          compra_equipamento: true,
          contrato_procuracao: true,
          homologacao: true,
          agendamento_instalacao: true,
          pag_instalacao: true,
          pag_reembolso: true,
          instalacao_finalizada: true,
          instalacao_finalizada_data:
            updatedOrcamento.venda_etapas.instalacao_finalizada_data ||
            new Date().toISOString().split("T")[0],
          faturado: true,
        };
      }

      if (!updatedOrcamento.custos_estimados) {
        updatedOrcamento.custos_estimados = {
          homologacao: parseSafeNumber(fs.projetoHomologacaoCusto),
          deslocamento:
            fs.deslocamento !== undefined
              ? parseSafeNumber(fs.deslocamento)
              : parseSafeNumber(fs.custoViagem),
          pedagio: parseSafeNumber(fs.pedagio),
          adequacao: parseSafeNumber(fs.adequacaoLocalCusto),
          instalacao: thirdPartyInstallation,
          materiais: parseSafeNumber(calc.totalEstrutura),
          imposto: parseSafeNumber(calc.impostos || calc.nfServicoValor || 0),
        };
      }
    }

    setOrcamentos((prev) =>
      prev.map((o) => (o.id === id ? updatedOrcamento : o)),
    );

    try {
      await dataService.save("orcamentos", updatedOrcamento);

      if (newStatus === "Finalizado") {
        try {
          const currentSales =
            await dataService.getAll<SalesSummaryItem>("sales_summary");
          let variant = orcamento.variants?.find((v) => v.isPrincipal) ||
            orcamento.variants?.[0] || {
              formState: orcamento.formState,
              calculated: orcamento.calculated,
            };

          if (variant.formState && variant.calculated) {
            const fs = variant.formState;
            const calc = variant.calculated;
            const thirdPartyInstallation =
              parseSafeNumber(fs.terceiroInstalacaoQtd) *
              parseSafeNumber(fs.terceiroInstalacaoCusto);

            const existing = currentSales.find(
              (s) => s.orcamentoId === orcamento.id,
            );

            const saleItem: SalesSummaryItem = {
              id: orcamento.id,
              orcamentoId: orcamento.id,
              owner_id: orcamento.owner_id,
              clientName: fs.nomeCliente || "Cliente sem nome",
              date: fs.dataOrcamento || orcamento.savedAt.split("T")[0],
              closedValue: parseSafeNumber(calc.precoVendaFinal),
              systemCost: parseSafeNumber(calc.valorVendaSistema),
              supplier: fs.fornecedor || "N/A",
              visitaTecnica: parseSafeNumber(fs.visitaTecnicaCusto),
              homologation: parseSafeNumber(fs.projetoHomologacaoCusto),
              installation: thirdPartyInstallation,
              travelCost:
                fs.deslocamento !== undefined
                  ? parseSafeNumber(fs.deslocamento) +
                    parseSafeNumber(fs.pedagio)
                  : parseSafeNumber(fs.custoViagem),
              adequationCost: parseSafeNumber(fs.adequacaoLocalCusto),
              materialCost: parseSafeNumber(calc.totalEstrutura),
              invoicedTax: existing
                ? parseSafeNumber(existing.invoicedTax)
                : parseSafeNumber(calc.nfServicoValor),
              commission: parseSafeNumber(calc.comissaoVendasValor),
              bankFees: existing ? parseSafeNumber(existing.bankFees) : 0,
              totalCost: 0,
              netProfit: 0,
              finalMargin: 0,
              status: newStatus,
            };

            const extraCosts =
              (saleItem.visitaTecnica ?? 0) +
              (saleItem.homologation ?? 0) +
              (saleItem.installation ?? 0) +
              (saleItem.travelCost ?? 0) +
              (saleItem.adequationCost ?? 0) +
              (saleItem.materialCost ?? 0) +
              (saleItem.invoicedTax ?? 0) +
              (saleItem.commission ?? 0) +
              (saleItem.bankFees ?? 0);

            saleItem.totalCost = extraCosts;
            saleItem.netProfit =
              saleItem.closedValue - saleItem.systemCost - extraCosts;
            saleItem.finalMargin =
              saleItem.closedValue > 0
                ? (saleItem.netProfit / saleItem.closedValue) * 100
                : 0;

            await dataService.save("sales_summary", saleItem);
          }
        } catch (err) {
          console.warn("Automação Resumo de Vendas falhou:", err);
        }

        if (newStatus === "Finalizado" && !orcamento.lavagem_cadastrada) {
          try {
            let variant = orcamento.variants?.find((v) => v.isPrincipal) ||
              orcamento.variants?.[0] || {
                formState: orcamento.formState,
                calculated: orcamento.calculated,
              };
            const fs = variant.formState || {};

            const clientId = `wash-auto-${orcamento.id}`;
            let existingClient =
              lavagemClients.find((c) => c.id === clientId) ||
              lavagemClients.find((c) => c.name === fs.nomeCliente);

            let finalClientId = clientId;
            if (existingClient) {
              finalClientId = existingClient.id;
              if (!existingClient.installation_end_date) {
                existingClient.installation_end_date = new Date()
                  .toISOString()
                  .split("T")[0];
                await dataService.save("lavagem_clients", existingClient);
              }
            } else {
              const newWashClient: LavagemClient = {
                id: clientId,
                owner_id: orcamento.owner_id,
                name: fs.nomeCliente || "Cliente sem nome",
                cep: fs.cep || "",
                address: fs.enderecoCompleto || "",
                address_number: "",
                complement: "",
                city: fs.cidade || "",
                plates_count:
                  Number(fs.terceiroInstalacaoQtd) ||
                  Number(variant.calculated?.placasQtd) ||
                  0,
                phone: fs.telefoneTitular || "",
                observations: `Importado automaticamente em ${new Date().toLocaleDateString("pt-BR")}.`,
                installation_end_date: new Date().toISOString().split("T")[0],
              };
              await dataService.save("lavagem_clients", newWashClient);
              existingClient = newWashClient;
            }

            // Schedule automatic laundry cycle (card de lavagem) 6 months after installation end date
            const hasWashRecord = lavagemRecords.some(
              (r) => r.client_id === finalClientId,
            );
            if (!hasWashRecord) {
              const installationEnd =
                existingClient?.installation_end_date ||
                new Date().toISOString().split("T")[0];
              const washDateObj = new Date(installationEnd);
              washDateObj.setMonth(washDateObj.getMonth() + 6);
              const washDateStr = washDateObj.toISOString().split("T")[0];

              const newWashRecord: LavagemRecord = {
                id: `wash-rec-${Date.now()}`,
                client_id: finalClientId,
                owner_id: orcamento.owner_id,
                date: washDateStr,
                status: "scheduled",
                created_at: new Date().toISOString(),
                notes: "Agendado automaticamente após conclusão do projeto.",
              };
              await dataService.save("lavagem_records", newWashRecord);
            }

            updatedOrcamento.lavagem_cadastrada = true;
            await dataService.save("orcamentos", updatedOrcamento);
            setOrcamentos((prev) =>
              prev.map((o) => (o.id === id ? updatedOrcamento : o)),
            );
          } catch (err) {
            console.warn("Automação Lavagem falhou:", err);
          }
        }
      } else {
        try {
          const currentSales =
            await dataService.getAll<SalesSummaryItem>("sales_summary");
          const saleToRemove = currentSales.find((s) => s.orcamentoId === id);
          if (saleToRemove)
            await dataService.delete("sales_summary", saleToRemove.id);
        } catch (err) {
          console.warn("Erro ao remover do Resumo de Vendas:", err);
        }
      }
    } catch (e) {
      console.error("Erro crítico ao trocar status:", e);
      loadData();
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const getDisplayData = (orc: SavedOrcamento) => {
    let clientName = "Sem nome";
    let displayPrice = 0;
    let lucroLiquido = 0;
    let variantCount = 0;
    let dataOrcamento = "";
    let fornecedor = "";
    let placasQtd = 0;

    if (orc.variants?.length) {
      const p = orc.variants.find((v) => v.isPrincipal) || orc.variants[0];
      clientName = p.formState?.nomeCliente || "Sem nome";
      displayPrice = p.calculated?.precoVendaFinal || 0;
      lucroLiquido = p.calculated?.lucroLiquido || 0;
      variantCount = orc.variants.length;
      dataOrcamento = p.formState?.dataOrcamento || "";
      fornecedor = p.formState?.fornecedor || "";
      placasQtd =
        Number(p.calculated?.placasQtd) ||
        Number(p.formState?.terceiroInstalacaoQtd) ||
        0;
    } else if (orc.formState) {
      clientName = orc.formState.nomeCliente || "Sem nome";
      displayPrice = orc.calculated?.precoVendaFinal || 0;
      lucroLiquido = orc.calculated?.lucroLiquido || 0;
      dataOrcamento = orc.formState.dataOrcamento || "";
      fornecedor = orc.formState.fornecedor || "";
      placasQtd =
        Number(orc.calculated?.placasQtd) ||
        Number(orc.formState?.terceiroInstalacaoQtd) ||
        0;
    }
    if (!dataOrcamento) dataOrcamento = orc.savedAt.split("T")[0];
    const ownerRawName =
      users.find((u) => String(u.id) === String(orc.owner_id))?.name ||
      "Sistema";
    const ownerName = toSentenceCase(ownerRawName);
    return {
      clientName,
      displayPrice,
      lucroLiquido,
      variantCount,
      dataOrcamento,
      ownerName,
      fornecedor,
      placasQtd,
    };
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Aprovado":
        return "bg-green-100 text-green-700 border-green-200";
      case "Finalizado":
        return "bg-purple-100 text-purple-700 border-purple-200";
      case "Perdido":
        return "bg-red-100 text-red-700 border-red-200";
      case "Parado":
        return "bg-orange-100 text-orange-700 border-orange-200";
      default:
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
    }
  };

  const filtered = useMemo(() => {
    let v = 0;
    let l = 0;
    const f = orcamentos.filter((orc) => {
      const d = getDisplayData(orc);
      const s = orc.status || "Em Aberto";

      if (
        searchTerm &&
        !d.clientName.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return false;

      if (activeTab !== "Todos" && s !== activeTab) return false;

      if (
        selectedUsers.length > 0 &&
        !selectedUsers.includes(String(orc.owner_id))
      )
        return false;
      if (startDate && d.dataOrcamento < startDate) return false;
      if (endDate && d.dataOrcamento > endDate) return false;
      v += d.displayPrice;
      l += d.lucroLiquido;
      return true;
    });

    f.sort((a, b) => {
      const dateA = getDisplayData(a).dataOrcamento;
      const dateB = getDisplayData(b).dataOrcamento;
      return dateB.localeCompare(dateA);
    });

    return {
      filteredOrcamentos: f,
      totalVendaFiltrado: v,
      totalLucroFiltrado: l,
    };
  }, [
    orcamentos,
    searchTerm,
    activeTab,
    selectedUsers,
    startDate,
    endDate,
    users,
  ]);

  // Dynamic calculations for advanced commercial insight
  const allLength = filtered.filteredOrcamentos.length;
  const approvedStatsCount = filtered.filteredOrcamentos.filter(
    (o) => o.status === "Aprovado" || o.status === "Finalizado",
  ).length;
  const conversionRate =
    allLength > 0 ? (approvedStatsCount / allLength) * 100 : 0;
  const avgMargin =
    filtered.totalVendaFiltrado > 0
      ? (filtered.totalLucroFiltrado / filtered.totalVendaFiltrado) * 100
      : 0;
  const avgTicket = allLength > 0 ? filtered.totalVendaFiltrado / allLength : 0;

  const MONTH_NAMES = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const getMonthLabel = (key: string) => {
    const [year, month] = key.split("-");
    const monthIndex = parseInt(month, 10) - 1;
    const name = MONTH_NAMES[monthIndex] || month;
    return `${name} de ${year}`;
  };

  const groupedMonths = useMemo(() => {
    const groups: Record<
      string,
      {
        label: string;
        items: SavedOrcamento[];
        totalValue: number;
        totalProfit: number;
        count: number;
      }
    > = {};

    filtered.filteredOrcamentos.forEach((orc) => {
      const d = getDisplayData(orc);
      const key = d.dataOrcamento ? d.dataOrcamento.substring(0, 7) : "Outros";
      if (!groups[key]) {
        const label = key !== "Outros" ? getMonthLabel(key) : "Sem Data";
        groups[key] = {
          label,
          items: [],
          totalValue: 0,
          totalProfit: 0,
          count: 0,
        };
      }
      groups[key].items.push(orc);
      groups[key].totalValue += d.displayPrice;
      groups[key].totalProfit += d.lucroLiquido;
      groups[key].count += 1;
    });

    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({
        key,
        ...groups[key],
      }));
  }, [filtered.filteredOrcamentos]);

  if (isLoading)
    return (
      <div className="flex justify-center p-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Bento Dashboard Section - Executive High End Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-5 rounded-2xl shadow-xl shadow-indigo-950/10 text-white relative overflow-hidden group hover:scale-[1.01] transition-all duration-300 border border-indigo-800/20">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
            <DollarIcon className="w-32 h-32 text-indigo-100" />
          </div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-indigo-300 tracking-widest">
                Volume Comercial
              </p>
              <h3 className="text-2xl font-black mt-1 leading-none tracking-tight">
                {formatCurrency(filtered.totalVendaFiltrado)}
              </h3>
            </div>
            <span className="p-2.5 bg-indigo-800/40 rounded-xl border border-indigo-700/30 text-indigo-200">
              <DollarIcon className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-indigo-800/30 pt-3">
            <span className="text-[10px] text-indigo-300 font-bold tracking-wider">
              Ticket Médio
            </span>
            <span className="text-xs font-extrabold text-indigo-100">
              {formatCurrency(avgTicket)}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all duration-300 border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5">
            <TrendUpIcon className="w-32 h-32 text-emerald-600" />
          </div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 tracking-widest">
                Lucratividade Estimada
              </p>
              <h3 className="text-2xl font-black mt-1 leading-none tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatCurrency(filtered.totalLucroFiltrado)}
              </h3>
            </div>
            <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-800/20 text-emerald-600 dark:text-emerald-400">
              <TrendUpIcon className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
            <span className="text-[10px] text-gray-400 font-bold tracking-wider">
              Margem Média Geral
            </span>
            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800/10">
              {avgMargin.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all duration-300 border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
          <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5">
            <CheckCircleIcon className="w-32 h-32 text-indigo-600" />
          </div>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 tracking-widest">
                Funil & Conversão
              </p>
              <h3 className="text-2xl font-black mt-1 leading-none tracking-tight text-indigo-600 dark:text-indigo-400">
                {approvedStatsCount}{" "}
                <span className="text-xs font-bold text-gray-400">
                  de {allLength} proj.
                </span>
              </h3>
            </div>
            <span className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-800/10 text-indigo-600 dark:text-indigo-400">
              <CheckCircleIcon className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
            <span className="text-[10px] text-gray-400 font-bold tracking-wider">
              Aproveitamento
            </span>
            <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800/10">
              {conversionRate.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Action Header & Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100/50 dark:border-gray-700/60">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-800 dark:text-white leading-tight tracking-tight">
              Projetos & Oportunidades
            </h2>
            <p className="text-xs text-gray-400 font-bold mt-1">
              Gestão inteligente e acompanhamento comercial da sua carteira
              solar.
            </p>
          </div>
          <button
            onClick={() => setCurrentPage("NOVO_ORCAMENTO")}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/30 transition-all font-black text-xs tracking-wider tracking-widest"
          >
            <AddIcon className="w-4 h-4" /> Novo Projeto
          </button>
        </div>

        <div className="flex flex-col gap-4 mb-6">
          {/* Modern Navigation Pill Status Filter Bar */}
          <div className="bg-gray-50 dark:bg-gray-900/40 p-1.5 rounded-2xl border border-gray-100/60 dark:border-gray-700/30 flex flex-wrap gap-1">
            {[
              {
                id: "Em Aberto",
                label: "Especulação",
                color: "bg-amber-500 text-white shadow-md shadow-amber-500/10",
                inactive:
                  "text-amber-600 hover:bg-amber-50/50 dark:hover:bg-amber-950/10",
                countColor: "bg-amber-100 dark:bg-amber-900/30 text-amber-700",
              },
              {
                id: "Aprovado",
                label: "Aprovados",
                color:
                  "bg-emerald-500 text-white shadow-md shadow-emerald-500/10",
                inactive:
                  "text-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10",
                countColor:
                  "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700",
              },
              {
                id: "Finalizado",
                label: "Finalizados",
                color:
                  "bg-violet-500 text-white shadow-md shadow-violet-500/10",
                inactive:
                  "text-violet-600 hover:bg-violet-50/50 dark:hover:bg-violet-950/10",
                countColor:
                  "bg-violet-100 dark:bg-violet-900/30 text-violet-700",
              },
              {
                id: "Parado",
                label: "Parados",
                color:
                  "bg-orange-500 text-white shadow-md shadow-orange-500/10",
                inactive:
                  "text-orange-600 hover:bg-orange-50/50 dark:hover:bg-orange-950/10",
                countColor:
                  "bg-orange-100 dark:bg-orange-900/30 text-orange-700",
              },
              {
                id: "Perdido",
                label: "Perdidos",
                color: "bg-rose-500 text-white shadow-md shadow-rose-500/10",
                inactive:
                  "text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/10",
                countColor: "bg-rose-100 dark:bg-rose-900/30 text-rose-700",
              },
              {
                id: "Todos",
                label: "Todos",
                color:
                  "bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow-md",
                inactive:
                  "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800",
                countColor: "bg-gray-100 dark:bg-gray-800 text-gray-500",
              },
            ].map((tab) => {
              const count = orcamentos.filter(
                (o) =>
                  tab.id === "Todos" || (o.status || "Em Aberto") === tab.id,
              ).length;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-tight transition-all duration-200 ${
                    isActive ? tab.color : `bg-transparent ${tab.inactive}`
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-lg text-[9px] font-black leading-none ${
                      isActive ? "bg-white/20 text-white" : tab.countColor
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Second Level Filter Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-gray-50/50 dark:bg-gray-900/10 p-4 rounded-2xl border border-gray-100/60 dark:border-gray-700/30">
            <div className="md:col-span-5 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <SearchIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Buscar cliente ou parceiro comercial..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-700 dark:text-gray-100 transition-all placeholder:text-gray-400"
              />
            </div>

            {isAdminUser && (
              <div className="md:col-span-3 relative" ref={userDropdownRef}>
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center justify-between w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-xs font-black text-gray-600 dark:text-gray-300 transition-all hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2 truncate">
                    <UsersIcon className="w-4 h-4 text-gray-400" />
                    <span>
                      {selectedUsers.length === 0
                        ? "Vendedor"
                        : `${selectedUsers.length} Selecionados`}
                    </span>
                  </div>
                  <ChevronDownIcon
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isUserDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isUserDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 animate-fade-in py-2 max-h-64 overflow-y-auto">
                    <p className="px-4 py-1.5 text-[8px] font-black text-gray-400 tracking-widest border-b border-gray-50 dark:border-gray-700/50 mb-1">
                      Filtrar por Vendedor
                    </p>
                    {users.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group transition-colors"
                      >
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={selectedUsers.includes(String(user.id))}
                          onChange={() => toggleUserFilter(String(user.id))}
                        />
                        <div
                          className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${selectedUsers.includes(String(user.id)) ? "bg-indigo-600 border-indigo-600" : "border-gray-300 dark:border-gray-600"}`}
                        >
                          {selectedUsers.includes(String(user.id)) && (
                            <CheckCircleIcon className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span
                          className={`text-xs font-bold ${selectedUsers.includes(String(user.id)) ? "text-indigo-600 dark:text-indigo-400" : "text-gray-600 dark:text-gray-300"}`}
                        >
                          {user.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="md:col-span-4 flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl">
              <span className="text-gray-400">
                <CalendarIcon className="w-4 h-4" />
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-xs font-bold dark:bg-gray-800 outline-none text-gray-600 dark:text-gray-200 flex-1 cursor-pointer"
              />
              <span className="text-gray-300">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-xs font-bold dark:bg-gray-800 outline-none text-gray-600 dark:text-gray-200 flex-1 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Redesigned CRM Grid List */}
        <div className="space-y-8">
          {groupedMonths.map((month) => (
            <div key={month.key} className="space-y-4">
              {/* Month block divider section */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50/70 dark:bg-gray-900/60 px-5 py-3.5 rounded-2xl border border-gray-100/50 dark:border-gray-800/40 gap-3">
                <div className="flex items-center gap-3">
                  <span className="p-1 px-3 bg-indigo-600/10 text-indigo-700 dark:text-indigo-400 text-xs font-black rounded-xl tracking-wider">
                    {month.label}
                  </span>
                  <span className="text-xs text-gray-400 font-bold">
                    {month.count} {month.count === 1 ? "projeto" : "projetos"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-400">
                  <div>
                    <span className="text-gray-400 text-[10px] font-black mr-1.5">
                      Valor Orçado:
                    </span>
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
                      {formatCurrency(month.totalValue)}
                    </span>
                  </div>
                  {month.totalProfit > 0 && (
                    <div className="border-l border-gray-200 dark:border-gray-800 pl-4">
                      <span className="text-gray-400 text-[10px] font-black mr-1.5">
                        Lucro Est.:
                      </span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatCurrency(month.totalProfit)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* List of budgets for this month */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-0 sm:pl-3">
                {month.items.map((orc) => {
                  const d = getDisplayData(orc);
                  const isReadOnlyStatus = orc.status === "Finalizado";
                  const isApproved =
                    orc.status === "Aprovado" || orc.status === "Finalizado";
                  const currentTheme =
                    STATUS_COLORS[orc.status] || defaultColor;

                  // Compute dynamic gross margin percentage for the specific contract card
                  const individualMargin =
                    d.displayPrice > 0
                      ? (d.lucroLiquido / d.displayPrice) * 100
                      : 0;

                  return (
                    <div
                      key={orc.id}
                      className={`p-4 rounded-xl border ${currentTheme.border} bg-white dark:bg-gray-800/70 hover:shadow-xl hover:translate-y-[-1px] transition-all duration-300 flex flex-col justify-between gap-3.5 relative overflow-hidden`}
                    >
                      {/* Colorful Left Border Accent representing modern commercial states */}
                      <div
                        className={`absolute top-0 left-0 w-1 h-full ${currentTheme.dot}`}
                      ></div>

                      {/* Header Row: Avatar, Client Name, and Actions */}
                      <div className="flex justify-between items-start gap-2 pl-1">
                        {/* Avatar and Info */}
                        <div className="flex gap-2.5 items-center min-w-0">
                          <div className="relative shrink-0">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-[11px] ${currentTheme.badge} shadow-inner`}
                            >
                              {d.clientName.substring(0, 2).toUpperCase()}
                            </div>
                            <div
                              className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center ${currentTheme.dot}`}
                            >
                              <div className="w-1 h-1 bg-white rounded-full animate-pulse"></div>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4
                                className="font-extrabold text-sm text-gray-800 dark:text-slate-100 tracking-tight leading-snug truncate"
                                title={d.clientName}
                              >
                                {d.clientName}
                              </h4>
                              <span className="text-[8px] font-black text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/40 px-1.5 py-0.5 rounded-md border border-gray-100 dark:border-gray-700 shrink-0">
                                #{orc.id}
                              </span>
                            </div>
                            {orc.lavagem_cadastrada && (
                              <span className="inline-flex items-center gap-1 text-[8px] font-black text-emerald-600 dark:text-emerald-400 tracking-widest mt-0.5">
                                <SparklesIcon className="w-2.5 h-2.5 text-emerald-500" />{" "}
                                Lavagem Ativa
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Top Corner Action Buttons */}
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => onEdit(orc)}
                            className={`p-1.5 rounded-lg border transition-all duration-200 ${
                              isApproved
                                ? "text-blue-600 bg-blue-50 border-blue-100 hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800/10"
                                : "text-gray-400 bg-gray-50 border-gray-100 hover:text-indigo-600 hover:bg-indigo-50 dark:bg-gray-800 dark:border-gray-700/50 dark:hover:text-indigo-400"
                            }`}
                            title={
                              isApproved
                                ? "Visualizar Proposta"
                                : "Editar Proposta"
                            }
                          >
                            {isApproved ? (
                              <EyeIcon className="w-3.5 h-3.5" />
                            ) : (
                              <EditIcon className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {currentUser.profileId === ADMIN_PROFILE_ID &&
                            !isReadOnlyStatus && (
                              <button
                                onClick={() => {
                                  setOrcamentoToDeleteId(orc.id);
                                  setDeleteModalOpen(true);
                                }}
                                className="p-1.5 text-gray-400 bg-gray-50 border-gray-100 hover:text-red-600 hover:bg-red-50 dark:bg-gray-800 dark:border-gray-700/50 dark:hover:text-red-400 hover:border-red-100 rounded-lg transition-all duration-200"
                                title="Excluir Orçamento"
                              >
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            )}
                        </div>
                      </div>

                      {/* Financial Summary Block */}
                      <div className="bg-gray-50/50 dark:bg-gray-900/10 p-2.5 rounded-xl border border-gray-100/40 dark:border-gray-700/30 flex justify-between items-center pl-3">
                        <div>
                          <span className="text-[9px] font-black text-gray-450 dark:text-gray-500 tracking-wider">
                            Valor do Contrato
                          </span>
                          <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 tracking-tight mt-0.5">
                            {formatCurrency(d.displayPrice)}
                          </h4>
                        </div>
                        {d.lucroLiquido > 0 && (
                          <div className="text-right">
                            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-[9px] bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-md border border-emerald-100/20 dark:border-emerald-800/10">
                              {individualMargin.toFixed(1)}% Margem
                            </span>
                            <span className="block text-gray-400 text-[8px] font-bold mt-1">
                              ({formatCurrency(d.lucroLiquido)} lucro)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Tags Block - Clean Metadata Wrap */}
                      <div className="flex flex-wrap gap-1.5 pl-1">
                        <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-950/20 px-2 py-0.5 rounded-md text-[9px] font-bold text-gray-500 dark:text-gray-400 border border-gray-100/60 dark:border-gray-700/40">
                          <CalendarIcon className="w-3 h-3 text-gray-400" />
                          <span>
                            {new Date(d.dataOrcamento).toLocaleDateString(
                              "pt-BR",
                              { timeZone: "UTC" },
                            )}
                          </span>
                        </div>
                        {d.placasQtd > 0 ? (
                          <div className="flex items-center gap-1 bg-indigo-50/55 dark:bg-indigo-950/10 px-2 py-0.5 rounded-md text-[9px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-800/10">
                            <CalculatorIcon className="w-3 h-3 text-indigo-500" />
                            <span>{d.placasQtd} Mod.</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-950/20 px-2 py-0.5 rounded-md text-[9px] font-bold text-gray-400 dark:text-gray-500 border border-gray-100/60 dark:border-gray-700/40">
                            <CalculatorIcon className="w-3 h-3 text-gray-300" />
                            <span>Sem placas</span>
                          </div>
                        )}
                        {d.fornecedor && (
                          <div className="flex items-center gap-1 bg-amber-50/50 dark:bg-amber-950/10 px-1.5 py-0.5 rounded-md text-[8px] font-extrabold text-amber-700 dark:text-amber-400 border border-amber-100/10 dark:border-amber-800/10 tracking-wider">
                            <span>{d.fornecedor}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 bg-purple-50/50 dark:bg-purple-950/10 px-1.5 py-0.5 rounded-md text-[8px] font-extrabold text-purple-700 dark:text-purple-400 border border-purple-100/10 dark:border-purple-800/10">
                          <span>
                            {d.variantCount}{" "}
                            {d.variantCount === 1 ? "Opção" : "Opções"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-md text-[8px] font-black text-gray-500 dark:text-gray-350 tracking-wide">
                          <UsersIcon className="w-2.5 h-2.5 text-gray-400" />
                          <span>{d.ownerName}</span>
                        </div>
                      </div>

                      {/* Acompanhamento das etapas da venda para orçamentos aprovados */}
                      {isApproved && (
                        <div className="mt-1 bg-gray-50/50 dark:bg-gray-900/30 p-3 rounded-xl border border-gray-150/60 dark:border-gray-700/60 text-xs space-y-3">
                          <div className="flex justify-between items-center pb-2 border-b border-gray-150 dark:border-gray-700/50 font-bold text-gray-700 dark:text-gray-300">
                            <span className="flex items-center gap-1 text-[9px] font-black tracking-wider text-indigo-600 dark:text-indigo-400">
                              📊 Acompanhamento de Venda
                            </span>
                            {editingTrackId !== orc.id ? (
                              <button
                                type="button"
                                onClick={() => handleStartEditTracking(orc)}
                                className="text-[10px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 font-extrabold hover:underline cursor-pointer flex items-center gap-0.5"
                              >
                                ✏️ Editar
                              </button>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingTrackId(null)}
                                  className="text-[10px] text-gray-400 hover:text-gray-600 dark:text-gray-500 font-bold hover:underline cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveTracking(orc.id)}
                                  className="text-[10px] text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 font-extrabold hover:underline cursor-pointer"
                                >
                                  Salvar
                                </button>
                              </div>
                            )}
                          </div>

                          {editingTrackId !== orc.id ? (
                            /* MODO DE VISUALIZAÇÃO */
                            <div className="space-y-3">
                              {/* Checklist Visual */}
                              <div>
                                <span className="block text-[8px] font-black text-gray-400 dark:text-gray-500 tracking-wider mb-1.5">
                                  Etapas Concluídas
                                </span>
                                <div className="grid grid-cols-2 gap-x-4">
                                  {/* Primeira Coluna */}
                                  <div className="space-y-1.5">
                                    {[
                                      {
                                        label: "Compra Equipamento",
                                        val: getRunningTracking(orc).etapas
                                          .compra_equipamento,
                                      },
                                      {
                                        label: "Contrato e Procuração",
                                        val: getRunningTracking(orc).etapas
                                          .contrato_procuracao,
                                      },
                                      {
                                        label: "Homologação",
                                        val: getRunningTracking(orc).etapas
                                          .homologacao,
                                      },
                                      {
                                        label: "Agendamento Instalação",
                                        val: getRunningTracking(orc).etapas
                                          .agendamento_instalacao,
                                      },
                                    ].map((item, idx) => (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-1.5 text-[10px]"
                                      >
                                        <span className="shrink-0 leading-none">
                                          {item.val ? "✅" : "⬜"}
                                        </span>
                                        <span
                                          className={`truncate leading-tight ${item.val ? "text-gray-700 dark:text-gray-200 font-extrabold" : "text-gray-400 dark:text-gray-500 font-medium"}`}
                                          title={item.label}
                                        >
                                          {item.label}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  {/* Segunda Coluna */}
                                  <div className="space-y-1.5">
                                    {[
                                      {
                                        label: "Instalação Finalizada",
                                        val: getRunningTracking(orc).etapas
                                          .instalacao_finalizada,
                                        key: "instalacao_finalizada",
                                      },
                                      {
                                        label: "Pag. Instalação",
                                        val: getRunningTracking(orc).etapas
                                          .pag_instalacao,
                                        key: "pag_instalacao",
                                      },
                                      {
                                        label: "Pag Reembolso",
                                        val: getRunningTracking(orc).etapas
                                          .pag_reembolso,
                                        key: "pag_reembolso",
                                      },
                                      {
                                        label: "Faturado",
                                        val: getRunningTracking(orc).etapas
                                          .faturado,
                                        key: "faturado",
                                      },
                                    ].map((item, idx) => {
                                      const hasDate =
                                        item.key === "instalacao_finalizada" &&
                                        item.val &&
                                        getRunningTracking(orc).etapas
                                          .instalacao_finalizada_data;
                                      const dateStr = hasDate
                                        ? new Date(
                                            getRunningTracking(orc).etapas
                                              .instalacao_finalizada_data +
                                              "T00:00:00",
                                          ).toLocaleDateString("pt-BR")
                                        : "";
                                      const tooltipText = hasDate
                                        ? `${item.label} (Concluída em: ${dateStr})`
                                        : item.label;

                                      return (
                                        <div
                                          key={idx}
                                          className={`flex items-center gap-1.5 text-[10px] group relative ${hasDate ? "cursor-help" : ""}`}
                                          title={tooltipText}
                                        >
                                          <span className="shrink-0 leading-none">
                                            {item.val ? "✅" : "⬜"}
                                          </span>
                                          <span
                                            className={`truncate leading-tight ${item.val ? "text-gray-700 dark:text-gray-200 font-extrabold" : "text-gray-400 dark:text-gray-500 font-medium"}`}
                                          >
                                            {item.label}
                                          </span>
                                          {hasDate && (
                                            <span className="ml-1 text-[8px] text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity duration-150 font-black whitespace-nowrap">
                                              ({dateStr})
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              {/* Custos Estimados Visual */}
                              <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-700/50">
                                <div className="flex justify-between items-center mb-1.5 px-0.5">
                                  <span className="block text-[8px] font-black text-gray-400 dark:text-gray-500 tracking-wider">
                                    Acompanhamento de Custos
                                  </span>
                                  <div className="flex gap-6 text-[8px] font-black uppercase text-gray-400 dark:text-gray-500 font-sans">
                                    <span className="w-[60px] text-right">
                                      Estimado
                                    </span>
                                    <span className="w-[60px] text-right text-indigo-600 dark:text-indigo-400">
                                      Real
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-1.5 text-[10px]">
                                  {[
                                    {
                                      label: "Homologação",
                                      est: getRunningTracking(orc).estimados
                                        .homologacao,
                                      real: getRunningTracking(orc).reais
                                        .homologacao,
                                    },
                                    {
                                      label: "Deslocamento",
                                      est: getRunningTracking(orc).estimados
                                        .deslocamento,
                                      real: getRunningTracking(orc).reais
                                        .deslocamento,
                                    },
                                    {
                                      label: "Pedágio",
                                      est: getRunningTracking(orc).estimados
                                        .pedagio,
                                      real: getRunningTracking(orc).reais
                                        .pedagio,
                                    },
                                    {
                                      label: "Adequação",
                                      est: getRunningTracking(orc).estimados
                                        .adequacao,
                                      real: getRunningTracking(orc).reais
                                        .adequacao,
                                    },
                                    {
                                      label: "Instalação",
                                      est: getRunningTracking(orc).estimados
                                        .instalacao,
                                      real: getRunningTracking(orc).reais
                                        .instalacao,
                                    },
                                    {
                                      label: "Materiais",
                                      est: getRunningTracking(orc).estimados
                                        .materiais,
                                      real: getRunningTracking(orc).reais
                                        .materiais,
                                    },
                                    {
                                      label: "Imposto",
                                      est: getRunningTracking(orc).estimados
                                        .imposto,
                                      real: getRunningTracking(orc).reais
                                        .imposto,
                                    },
                                  ].map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="flex justify-between items-center text-gray-600 dark:text-gray-400 border-b border-gray-100/50 dark:border-gray-800/20 pb-0.5"
                                    >
                                      <span className="font-medium text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                        <span>{item.label}</span>
                                      </span>
                                      <div className="flex gap-6 items-center">
                                        <span className="text-gray-400 dark:text-gray-500 w-[60px] text-right flex items-center justify-end gap-1">
                                          <span>
                                            {formatCurrency(item.est || 0)}
                                          </span>
                                          {item.label === "Deslocamento" && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleOpenMemorial(orc, false)
                                              }
                                              className="text-gray-400 hover:text-indigo-500 cursor-pointer text-[9px] outline-none font-sans"
                                              title="Ver Memorial do Custo Estimado"
                                            >
                                              👁️
                                            </button>
                                          )}
                                        </span>
                                        <span
                                          className={`font-black w-[60px] text-right ${Math.abs((item.real || 0) - (item.est || 0)) > 0.01 ? "text-indigo-600 dark:text-indigo-400" : "text-gray-800 dark:text-slate-200"}`}
                                        >
                                          {formatCurrency(item.real || 0)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* MODO DE EDIÇÃO */
                            <div className="space-y-3.5">
                              {/* Checklist Interativo */}
                              <div>
                                <span className="block text-[8px] font-black text-gray-400 dark:text-gray-500 tracking-wider mb-2">
                                  Marcar Etapas Realizadas
                                </span>
                                <div className="grid grid-cols-2 gap-x-4">
                                  {/* Primeira Coluna */}
                                  <div className="space-y-1.5">
                                    {[
                                      {
                                        label: "Compra Equipamento",
                                        key: "compra_equipamento",
                                      },
                                      {
                                        label: "Contrato e Procuração",
                                        key: "contrato_procuracao",
                                      },
                                      {
                                        label: "Homologação",
                                        key: "homologacao",
                                      },
                                      {
                                        label: "Agendamento Instalação",
                                        key: "agendamento_instalacao",
                                      },
                                    ].map((item, idx) => (
                                      <label
                                        key={idx}
                                        className="flex items-center gap-1.5 text-[10px] text-gray-700 dark:text-gray-350 cursor-pointer select-none font-medium"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={!!trackVendaEtapas[item.key]}
                                          onChange={(e) => {
                                            const isChecked = e.target.checked;
                                            setTrackVendaEtapas(
                                              (prev: any) => ({
                                                ...prev,
                                                [item.key]: isChecked,
                                              }),
                                            );

                                            if (
                                              item.key ===
                                                "instalacao_finalizada" &&
                                              isChecked
                                            ) {
                                              // Obtain current client original installation end date
                                              const currentOrc =
                                                orcamentos.find(
                                                  (o) =>
                                                    o.id === editingTrackId,
                                                );
                                              let existingDate = new Date()
                                                .toISOString()
                                                .split("T")[0];
                                              if (currentOrc) {
                                                const v =
                                                  currentOrc.variants?.find(
                                                    (x) => x.isPrincipal,
                                                  ) ||
                                                    currentOrc
                                                      .variants?.[0] || {
                                                      formState:
                                                        currentOrc.formState,
                                                    };
                                                const clientName =
                                                  v.formState?.nomeCliente ||
                                                  "";
                                                const matchingClient =
                                                  lavagemClients.find(
                                                    (lc) =>
                                                      lc.name
                                                        ?.toLowerCase()
                                                        .trim() ===
                                                      clientName
                                                        .toLowerCase()
                                                        .trim(),
                                                  );
                                                if (
                                                  matchingClient &&
                                                  matchingClient.installation_end_date
                                                ) {
                                                  existingDate =
                                                    matchingClient.installation_end_date;
                                                }
                                              }
                                              setPendingInstallationEndDate(
                                                existingDate,
                                              );
                                              setPendingTrackingOrcamentoId(
                                                editingTrackId,
                                              );
                                              setShowInstallationEndDateModal(
                                                true,
                                              );
                                            }
                                          }}
                                          className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer dark:bg-gray-800"
                                        />
                                        <span
                                          className="truncate"
                                          title={item.label}
                                        >
                                          {item.label}
                                        </span>
                                      </label>
                                    ))}
                                  </div>
                                  {/* Segunda Coluna */}
                                  <div className="space-y-1.5">
                                    {[
                                      {
                                        label: "Instalação Finalizada",
                                        key: "instalacao_finalizada",
                                      },
                                      {
                                        label: "Pag. Instalação",
                                        key: "pag_instalacao",
                                      },
                                      {
                                        label: "Pag Reembolso",
                                        key: "pag_reembolso",
                                      },
                                      { label: "Faturado", key: "faturado" },
                                    ].map((item, idx) => (
                                      <div
                                        key={idx}
                                        className="flex flex-col gap-0.5"
                                      >
                                        <label className="flex items-center gap-1.5 text-[10px] text-gray-700 dark:text-gray-350 cursor-pointer select-none font-medium">
                                          <input
                                            type="checkbox"
                                            checked={
                                              !!trackVendaEtapas[item.key]
                                            }
                                            onChange={(e) => {
                                              const isChecked =
                                                e.target.checked;
                                              setTrackVendaEtapas(
                                                (prev: any) => ({
                                                  ...prev,
                                                  [item.key]: isChecked,
                                                }),
                                              );

                                              if (
                                                item.key ===
                                                  "instalacao_finalizada" &&
                                                isChecked
                                              ) {
                                                // Obtain current client original installation end date
                                                const currentOrc =
                                                  orcamentos.find(
                                                    (o) =>
                                                      o.id === editingTrackId,
                                                  );
                                                let existingDate = new Date()
                                                  .toISOString()
                                                  .split("T")[0];
                                                if (currentOrc) {
                                                  if (
                                                    currentOrc.venda_etapas
                                                      ?.instalacao_finalizada_data
                                                  ) {
                                                    existingDate =
                                                      currentOrc.venda_etapas
                                                        .instalacao_finalizada_data;
                                                  } else {
                                                    const v =
                                                      currentOrc.variants?.find(
                                                        (x) => x.isPrincipal,
                                                      ) ||
                                                        currentOrc
                                                          .variants?.[0] || {
                                                          formState:
                                                            currentOrc.formState,
                                                        };
                                                    const clientName =
                                                      v.formState
                                                        ?.nomeCliente || "";
                                                    const matchingClient =
                                                      lavagemClients.find(
                                                        (lc) =>
                                                          lc.name
                                                            ?.toLowerCase()
                                                            .trim() ===
                                                          clientName
                                                            .toLowerCase()
                                                            .trim(),
                                                      );
                                                    if (
                                                      matchingClient &&
                                                      matchingClient.installation_end_date
                                                    ) {
                                                      existingDate =
                                                        matchingClient.installation_end_date;
                                                    }
                                                  }
                                                }
                                                setPendingInstallationEndDate(
                                                  existingDate,
                                                );
                                                setPendingTrackingOrcamentoId(
                                                  editingTrackId,
                                                );
                                                setShowInstallationEndDateModal(
                                                  true,
                                                );
                                              }
                                            }}
                                            className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer dark:bg-gray-800"
                                          />
                                          <span
                                            className="truncate"
                                            title={item.label}
                                          >
                                            {item.label}
                                          </span>
                                        </label>
                                        {item.key === "instalacao_finalizada" &&
                                          trackVendaEtapas.instalacao_finalizada && (
                                            <div className="pl-5 text-[8px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1.5">
                                              <span>
                                                Data:{" "}
                                                {pendingInstallationEndDate
                                                  ? new Date(
                                                      pendingInstallationEndDate +
                                                        "T00:00:00",
                                                    ).toLocaleDateString(
                                                      "pt-BR",
                                                    )
                                                  : "Não definida"}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setPendingTrackingOrcamentoId(
                                                    editingTrackId,
                                                  );
                                                  setShowInstallationEndDateModal(
                                                    true,
                                                  );
                                                }}
                                                className="underline hover:text-indigo-850 dark:hover:text-indigo-200 cursor-pointer"
                                              >
                                                Alterar
                                              </button>
                                            </div>
                                          )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Custos Estimados Campos de Input */}
                              <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-700/50">
                                <div className="mb-3 px-0.5 font-sans">
                                  <label className="block text-[8px] font-black text-indigo-500 tracking-wider mb-1">
                                    VINCULAR FORMULÁRIO DE CHECK-OUT DE OBRA (CUSTO DE MATERIAL)
                                  </label>
                                  <select
                                    value={trackCustosReais?.linked_checkout_id || ""}
                                    onChange={(e) => {
                                      const selectedId = e.target.value;
                                      setTrackCustosReais((prev: any) => {
                                        const updated = {
                                          ...prev,
                                          linked_checkout_id: selectedId,
                                        };
                                        let targetCheckout = undefined;
                                        if (selectedId) {
                                          targetCheckout = checklistCheckouts.find(
                                            (c) => String(c.id) === String(selectedId) && c.status === "Finalizado"
                                          );
                                        } else {
                                          const orc = orcamentos.find(o => o.id === editingTrackId);
                                          const variant = orc?.variants?.find((v) => v.isPrincipal) || orc?.variants?.[0] || { formState: orc?.formState };
                                          const clientName = variant?.formState?.nomeCliente || "";
                                          if (clientName) {
                                            targetCheckout = checklistCheckouts.find(
                                              (c) => c.project?.toLowerCase().trim() === clientName.toLowerCase().trim() && c.status === "Finalizado"
                                            );
                                          }
                                        }
                                        if (targetCheckout && targetCheckout.details?.componentesEstoque) {
                                          const list = targetCheckout.details.componentesEstoque || [];
                                          const calculatedMaterialsCost = list.reduce(
                                            (sum: number, comp: any) => {
                                              const item = stockItems.find(
                                                (si) => String(si.id) === String(comp.itemId),
                                              );
                                              const price = item ? item.averagePrice || 0 : 0;
                                              return sum + comp.qty * price;
                                            },
                                            0,
                                          );
                                          updated.materiais = calculatedMaterialsCost;
                                        } else if (!selectedId) {
                                          updated.materiais = trackCustosEstimados.materiais || 0;
                                        }
                                        return updated;
                                      });
                                    }}
                                    className="w-full text-[10px] font-bold bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-950/45 rounded-lg px-2 py-1.5 outline-none text-indigo-900 dark:text-indigo-100 focus:border-indigo-500 select-none cursor-pointer"
                                  >
                                    <option value="">-- Buscar por nome do cliente ou sem vínculo --</option>
                                    {(() => {
                                      const otherOrcamentos = orcamentos.filter(
                                        (o) => o.id !== editingTrackId
                                      );
                                      const usedCheckouts = new Set<string>();
                                      otherOrcamentos.forEach((o) => {
                                        if (o.custos_reais?.linked_checkout_id) {
                                          usedCheckouts.add(String(o.custos_reais.linked_checkout_id).toLowerCase().trim());
                                        } else {
                                          const v = o.variants?.find((vi) => vi.isPrincipal) || o.variants?.[0] || { formState: o.formState };
                                          const clName = v?.formState?.nomeCliente || "";
                                          if (clName) {
                                            usedCheckouts.add(clName.toLowerCase().trim());
                                          }
                                        }
                                      });

                                      const filteredOptions = checklistCheckouts.filter((checkout) => {
                                        // 1. MUST be 'Finalizado'
                                        if (checkout.status !== "Finalizado") return false;

                                        const checkoutIdStr = String(checkout.id).toLowerCase().trim();
                                        const checkoutProjectStr = (checkout.project || "").toLowerCase().trim();

                                        const isCurrentlyLinkedHere = trackCustosReais?.linked_checkout_id === String(checkout.id);
                                        const currentOrc = orcamentos.find((o) => o.id === editingTrackId);
                                        const currentV = currentOrc?.variants?.find((vi) => vi.isPrincipal) || currentOrc?.variants?.[0] || { formState: currentOrc?.formState };
                                        const currentClName = (currentV?.formState?.nomeCliente || "").toLowerCase().trim();
                                        const isNameMatchHere = !trackCustosReais?.linked_checkout_id && checkoutProjectStr === currentClName;

                                        // If it's linked/matched to this budget, always display it
                                        if (isCurrentlyLinkedHere || isNameMatchHere) {
                                          return true;
                                        }

                                        // Otherwise, if used by any other budget, filter it out
                                        if (usedCheckouts.has(checkoutIdStr) || usedCheckouts.has(checkoutProjectStr)) {
                                          return false;
                                        }

                                        return true;
                                      });

                                      return filteredOptions.map((checkout) => (
                                        <option key={checkout.id} value={checkout.id}>
                                          {checkout.project} (ID: {checkout.id} - {new Date(checkout.id).toLocaleDateString('pt-BR')})
                                        </option>
                                      ));
                                    })()}
                                  </select>
                                  <p className="text-[7.5px] text-gray-450 dark:text-gray-550 mt-1 leading-normal">
                                    Selecione o check-out do cliente correspondente para recalcular e travar o valor de material real gasto via componentes do estoque.
                                  </p>
                                </div>

                                <div className="flex justify-between items-center mb-2 px-0.5 font-sans">
                                  <span className="block text-[8px] font-black text-gray-400 dark:text-gray-500 tracking-wider font-sans">
                                    Ajuste de Custos Realizados (R$)
                                  </span>
                                  <span className="text-[8px] font-bold text-gray-450 dark:text-gray-550">
                                    Estimado não alterável
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                  {[
                                    {
                                      label: "Homologação",
                                      key: "homologacao",
                                      est: trackCustosEstimados.homologacao,
                                    },
                                    {
                                      label: "Deslocamento",
                                      key: "deslocamento",
                                      est: trackCustosEstimados.deslocamento,
                                    },
                                    {
                                      label: "Pedágio",
                                      key: "pedagio",
                                      est: trackCustosEstimados.pedagio,
                                    },
                                    {
                                      label: "Adequação",
                                      key: "adequacao",
                                      est: trackCustosEstimados.adequacao,
                                    },
                                    {
                                      label: "Instalação",
                                      key: "instalacao",
                                      est: trackCustosEstimados.instalacao,
                                    },
                                    {
                                      label: "Materiais",
                                      key: "materiais",
                                      est: trackCustosEstimados.materiais,
                                    },
                                    {
                                      label: "Imposto",
                                      key: "imposto",
                                      est: trackCustosEstimados.imposto,
                                    },
                                  ].map((item, idx) => {
                                    const orc = orcamentos.find(
                                      (o) => o.id === editingTrackId
                                    );
                                    const variant =
                                      orc?.variants?.find(
                                        (v) => v.isPrincipal
                                      ) ||
                                      orc?.variants?.[0] || {
                                        formState: orc?.formState,
                                      };
                                    const clientName =
                                      variant?.formState?.nomeCliente || "";
                                    const isMaterialsAndHasCheckout =
                                      item.key === "materiais" &&
                                      (trackCustosReais?.linked_checkout_id
                                        ? checklistCheckouts.some(
                                            (c) => String(c.id) === String(trackCustosReais.linked_checkout_id) && c.status === "Finalizado"
                                          )
                                        : checklistCheckouts.some(
                                            (c) =>
                                              c.project?.toLowerCase().trim() ===
                                              clientName.toLowerCase().trim() && c.status === "Finalizado"
                                          ));

                                    return (
                                      <div
                                        key={idx}
                                        className="flex flex-col gap-0.5"
                                      >
                                        <div className="flex justify-between items-center text-[8px] font-black text-gray-400 dark:text-gray-500">
                                          <span className="flex items-center gap-1">
                                            <span>{item.label}</span>
                                            {isMaterialsAndHasCheckout && (
                                              <span
                                                className="text-emerald-600 dark:text-emerald-400 font-extrabold text-[7px]"
                                                title="Valor calculado com base nas quantidades informadas no Check-out de obra"
                                              >
                                                (Check-out)
                                              </span>
                                            )}
                                          </span>
                                          <span className="text-gray-450 dark:text-gray-550 font-normal flex items-center gap-1">
                                            <span>
                                              Est:{" "}
                                              {formatCurrency(item.est || 0)}
                                            </span>
                                          </span>
                                        </div>
                                        <div className="relative">
                                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-indigo-500">
                                            R$
                                          </span>
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            disabled={isMaterialsAndHasCheckout}
                                            value={
                                              trackCustosReais[item.key] ===
                                                undefined ||
                                              trackCustosReais[item.key] === null
                                                ? ""
                                                : trackCustosReais[item.key]
                                            }
                                            onChange={(e) => {
                                              const val = e.target.value;
                                              setTrackCustosReais(
                                                (prev: any) => ({
                                                  ...prev,
                                                  [item.key]:
                                                    val === ""
                                                      ? 0
                                                      : parseFloat(val),
                                                }),
                                              );
                                            }}
                                            className={`w-full text-[10px] font-black bg-white dark:bg-gray-800 border rounded-lg pl-6 pr-1 py-1 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${isMaterialsAndHasCheckout ? "border-emerald-250 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/10 text-emerald-600 dark:text-emerald-400 cursor-not-allowed" : "border-indigo-100 dark:border-indigo-950/45 text-indigo-600 dark:text-indigo-400"}`}
                                            placeholder="0,00"
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer Row: Status Dropdown */}
                      <div className="flex justify-between items-center pt-2.5 border-t border-gray-100 dark:border-gray-700/50 pl-1">
                        <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 tracking-wider">
                          Status do Projeto
                        </span>
                        <div className="relative">
                          <select
                            value={orc.status}
                            onChange={(e) =>
                              handleStatusChange(orc.id, e.target.value as any)
                            }
                            disabled={isReadOnlyStatus}
                            className={`pl-2.5 pr-7 py-1.5 rounded-lg text-[9px] font-black border tracking-wider outline-none cursor-pointer hover:shadow-sm transition-all bg-no-repeat bg-right ${currentTheme.bg} ${currentTheme.text} ${currentTheme.border} ${isReadOnlyStatus ? "opacity-65 cursor-not-allowed" : ""}`}
                            style={{
                              appearance: "none",
                              backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3E%3C/svg%3E")`,
                              backgroundSize: "1rem",
                              backgroundPosition: "right 0.25rem center",
                            }}
                          >
                            <option
                              value="Em Aberto"
                              className="bg-white dark:bg-gray-800 text-amber-800 font-bold"
                            >
                              Em aberto
                            </option>
                            <option
                              value="Aprovado"
                              className="bg-white dark:bg-gray-800 text-emerald-800 font-bold"
                            >
                              Aprovado
                            </option>
                            <option
                              value="Finalizado"
                              className="bg-white dark:bg-gray-800 text-violet-800 font-bold"
                            >
                              Finalizado
                            </option>
                            <option
                              value="Parado"
                              className="bg-white dark:bg-gray-800 text-orange-800 font-bold"
                            >
                              Parado
                            </option>
                            <option
                              value="Perdido"
                              className="bg-white dark:bg-gray-800 text-rose-800 font-bold"
                            >
                              Perdido
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {filtered.filteredOrcamentos.length === 0 && (
            <div className="py-20 text-center bg-gray-50/20 dark:bg-gray-900/10 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-700/60">
              <FilterIcon className="w-10 h-10 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-400 font-extrabold italic text-xs">
                Nenhum orçamento encontrado para os critérios selecionados.
              </p>
            </div>
          )}
        </div>
      </div>

      {isDeleteModalOpen && (
        <Modal
          title="Excluir orçamento permanentemente"
          onClose={() => setDeleteModalOpen(false)}
        >
          <div className="text-center p-4 space-y-6">
            <div className="w-14 h-14 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto border border-red-100 dark:border-red-900/30 shadow-inner">
              <TrashIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="font-extrabold text-gray-800 dark:text-gray-100 text-sm">
                Deseja excluir este projeto permanentemente?
              </p>
              <p className="text-xs text-gray-400 font-bold mt-1.5">
                Esta ação é irreversível e removerá também registros associados
                do Resumo de Vendas.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-600 dark:text-gray-200 rounded-xl font-bold text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-red-600/15 transition-all"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isClientModalOpen && (
        <Modal
          title="Novo cliente solar"
          onClose={() => {
            setIsClientModalOpen(false);
            setSelectedOrcamentoToApprove(null);
          }}
          maxWidth="max-w-2xl"
        >
          <form
            onSubmit={handleSaveApproveClient}
            className="space-y-6 pt-2 animate-fade-in"
          >
            <div className="space-y-4">
              <SectionHeader
                icon={<UsersIcon />}
                title="Identificação do Cliente"
                color="bg-indigo-600"
              />
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8">
                  <FormLabel>Nome completo do titular</FormLabel>
                  <div className="relative">
                    <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      required
                      value={clientForm.name || ""}
                      onChange={(e) =>
                        setClientForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm pl-10"
                      placeholder="Ex: João da Silva"
                    />
                  </div>
                </div>
                <div className="md:col-span-4">
                  <FormLabel>Telefone de contato</FormLabel>
                  <div className="relative">
                    <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={clientForm.phone || ""}
                      onChange={(e) =>
                        setClientForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm pl-10"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <SectionHeader
                icon={<MapPinIcon />}
                title="Endereço de Instalação"
                color="bg-teal-600"
              />
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <FormLabel>CEP</FormLabel>
                  <div className="relative">
                    <input
                      placeholder="00000-000"
                      maxLength={9}
                      value={clientForm.cep || ""}
                      onChange={(e) =>
                        setClientForm((prev) => ({
                          ...prev,
                          cep: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                    />
                    {isLoadingCep && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    )}
                  </div>
                </div>
                <div className="md:col-span-6">
                  <FormLabel>Logradouro / Endereço</FormLabel>
                  <input
                    required
                    value={clientForm.address || ""}
                    onChange={(e) =>
                      setClientForm((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                    placeholder="Rua, Avenida..."
                  />
                </div>
                <div className="md:col-span-3">
                  <FormLabel>Cidade</FormLabel>
                  <input
                    required
                    value={clientForm.city || ""}
                    onChange={(e) =>
                      setClientForm((prev) => ({
                        ...prev,
                        city: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                    placeholder="Cidade"
                  />
                </div>
                <div className="md:col-span-3">
                  <FormLabel>Nº</FormLabel>
                  <input
                    required
                    value={clientForm.address_number || ""}
                    onChange={(e) =>
                      setClientForm((prev) => ({
                        ...prev,
                        address_number: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                    placeholder="S/N"
                  />
                </div>
                <div className="md:col-span-9">
                  <FormLabel>Complemento (Referência)</FormLabel>
                  <input
                    value={clientForm.complement || ""}
                    onChange={(e) =>
                      setClientForm((prev) => ({
                        ...prev,
                        complement: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                    placeholder="Apto, Bloco, Travessa..."
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <SectionHeader
                icon={<BoltIcon />}
                title="Configurações do Projeto"
                color="bg-amber-600"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FormLabel>Potência (Qtd. de Placas)</FormLabel>
                  <div className="relative">
                    <BoltIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
                    <input
                      type="number"
                      required
                      value={clientForm.plates_count || 0}
                      onChange={(e) =>
                        setClientForm((prev) => ({
                          ...prev,
                          plates_count: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/10 p-2.5 text-xs font-black text-amber-700 dark:text-amber-400 outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm pl-10"
                    />
                  </div>
                </div>
                <div>
                  <FormLabel>Término da instalação original</FormLabel>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="date"
                      value={clientForm.installation_end_date || ""}
                      onChange={(e) =>
                        setClientForm((prev) => ({
                          ...prev,
                          installation_end_date: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <SectionHeader
                icon={<ClipboardListIcon />}
                title="Notas e Observações"
                color="bg-gray-400"
              />
              <textarea
                rows={3}
                value={clientForm.observations || ""}
                onChange={(e) =>
                  setClientForm((prev) => ({
                    ...prev,
                    observations: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-medium text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm resize-none min-h-[80px]"
                placeholder="Notas técnicas ou comerciais..."
              />
            </div>

            <div className="flex gap-3 pt-6 border-t dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  setIsClientModalOpen(false);
                  setSelectedOrcamentoToApprove(null);
                }}
                className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingClient}
                className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95"
              >
                {isSavingClient ? "Gravando..." : "Salvar Cadastro"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showInstallationEndDateModal && (
        <Modal
          title="Conclusão da Instalação"
          onClose={() => {
            setShowInstallationEndDateModal(false);
            setTrackVendaEtapas((prev: any) => ({
              ...prev,
              instalacao_finalizada: false,
            }));
          }}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold leading-relaxed">
              Defina a data em que a instalação foi concluída. Esta informação
              será atualizada no respectivo card de lavagem deste cliente ao
              clicar em "Salvar".
            </p>
            <div>
              <FormLabel>Data de Término da Instalação *</FormLabel>
              <input
                type="date"
                required
                value={pendingInstallationEndDate}
                onChange={(e) => setPendingInstallationEndDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
              />
            </div>
            <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  setShowInstallationEndDateModal(false);
                  setTrackVendaEtapas((prev: any) => ({
                    ...prev,
                    instalacao_finalizada: false,
                  }));
                }}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!pendingInstallationEndDate) {
                    alert("Por favor, informe uma data válida.");
                    return;
                  }
                  setShowInstallationEndDateModal(false);
                }}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95"
              >
                Confirmar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDistanceModal && (
        <Modal
          title="Calculadora de Deslocamento"
          onClose={() => setShowDistanceModal(false)}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 pt-2 font-sans text-xs">
            <p className="text-gray-500 dark:text-gray-400 font-semibold leading-relaxed">
              Escolha o instalador para puxar o endereço base dele, insira o CEP
              ou endereço do cliente, e calcule a rota de distância ideal. O
              custo final do deslocamento será atualizado automaticamente ao
              aplicar.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Installer Selection */}
              <div className="sm:col-span-2">
                <FormLabel>Selecione o Instalador *</FormLabel>
                <select
                  value={calcInstaladorId}
                  onChange={(e) => {
                    const instId = e.target.value;
                    setCalcInstaladorId(instId);
                    const sel = instaladores.find((i) => i.id === instId);
                    if (sel) {
                      setCalcValorKm(String(systemKmValue));
                    }
                  }}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                >
                  <option value="">-- Escolha um Instalador --</option>
                  {instaladores.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nome}
                    </option>
                  ))}
                </select>
                {calcInstaladorId && (
                  <p className="mt-1 text-[10px] text-indigo-650 dark:text-indigo-400 font-black flex items-center gap-1">
                    <span>📍 Origem:</span>
                    <span className="font-bold underline">
                      {(() => {
                        const sel = instaladores.find(
                          (i) => i.id === calcInstaladorId,
                        );
                        return sel
                          ? `${sel.endereco || ""}, ${sel.cidade || ""}/${sel.uf || ""} (CEP: ${sel.cep || ""})`
                          : "";
                      })()}
                    </span>
                  </p>
                )}
              </div>

              {/* Customer Address Search */}
              <div className="sm:col-span-2 border-t pt-3 dark:border-gray-700/50">
                <h5 className="font-black text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide text-[10px]">
                  Endereço de Destino (Cliente)
                </h5>
              </div>

              {/* CEP */}
              <div>
                <FormLabel>CEP do Cliente</FormLabel>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="00000-000"
                    value={calcCep}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCalcCep(val);
                      handleFetchCepForCalculadora(val);
                    }}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                  />
                  {isLoadingCep && (
                    <span className="absolute right-3 top-2.5 text-[9px] font-bold text-indigo-500 animate-pulse">
                      Buscando...
                    </span>
                  )}
                </div>
              </div>

              {/* Number */}
              <div>
                <FormLabel>Número</FormLabel>
                <input
                  type="text"
                  placeholder="Nº Ex: 123"
                  value={calcNumero}
                  onChange={(e) => setCalcNumero(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                />
              </div>

              {/* Street/Rua */}
              <div className="sm:col-span-2">
                <FormLabel>Rua / Logradouro *</FormLabel>
                <input
                  type="text"
                  placeholder="Nome da rua"
                  value={calcRua}
                  onChange={(e) => setCalcRua(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                />
              </div>

              {/* City / UF */}
              <div>
                <FormLabel>Cidade *</FormLabel>
                <input
                  type="text"
                  placeholder="Cidade"
                  value={calcCidade}
                  onChange={(e) => setCalcCidade(e.target.value)}
                  className="w-full rounded-xl border border-gray-250 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                />
              </div>

              <div>
                <FormLabel>UF *</FormLabel>
                <input
                  type="text"
                  placeholder="UF"
                  maxLength={2}
                  value={calcUf}
                  onChange={(e) => setCalcUf(e.target.value)}
                  className="w-full rounded-xl border border-gray-250 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-sans"
                />
              </div>
            </div>

            {/* Google Calculate Button */}
            <div className="pt-3 flex justify-end">
              <button
                type="button"
                disabled={isCalculatingDistance}
                onClick={handleCalculateGoogleDistance}
                className="px-5 py-2.5 bg-indigo-600 dark:bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer w-full sm:w-auto"
              >
                {isCalculatingDistance ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Calculando Rota...</span>
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    <span>Calcular Rota (Google Maps)</span>
                  </>
                )}
              </button>
            </div>

            {/* Calculation Output Box */}
            <div className="border border-indigo-100 dark:border-indigo-950/45 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-xl p-4 space-y-4 font-sans">
              {/* Linha 1: Custos de Viagem */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-extrabold leading-none mb-1.5">
                    Distância Calculada (Ida)
                  </span>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Entre a distância em KM"
                      value={calcDistanceKm === null ? "" : calcDistanceKm}
                      onChange={(e) =>
                        setCalcDistanceKm(
                          e.target.value === ""
                            ? null
                            : parseFloat(e.target.value),
                        )
                      }
                      className="w-full rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-950/40 p-1.5 text-center font-bold text-xs text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/20 font-sans"
                    />
                    <span className="font-extrabold text-xs text-gray-650 dark:text-gray-350 shrink-0">
                      KM
                    </span>
                  </div>
                  <div className="select-none">
                    <label className="flex items-center gap-1.5 cursor-pointer font-sans">
                      <input
                        type="checkbox"
                        checked={calcIdaVolta}
                        onChange={(e) => setCalcIdaVolta(e.target.checked)}
                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                      />
                      <span className="font-extrabold text-[9px] text-gray-500 dark:text-gray-400">
                        Considerar Ida e Volta
                      </span>
                    </label>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] text-gray-505 leading-none mb-1.5">
                    Valor pago por Km
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-indigo-500">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="1.20"
                      value={calcValorKm}
                      onChange={(e) => setCalcValorKm(e.target.value)}
                      className="w-full rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-950/40 p-1.5 text-center font-bold text-xs text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/20 font-sans"
                    />
                  </div>
                </div>
              </div>

              {/* Linha 2: Apenas Hotel */}
              <div className="pt-3 border-t border-indigo-100/50 dark:border-indigo-900/40">
                <div className="max-w-[200px]">
                  <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-extrabold leading-none mb-1.5">
                    Hotel (Manual)
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-indigo-500">
                      R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={calcHotel}
                      onChange={(e) => setCalcHotel(e.target.value)}
                      className="w-full rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-950/40 p-1.5 text-center font-bold text-xs text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/20 font-sans"
                    />
                  </div>
                </div>
              </div>

              {calcDistanceKm !== null && (
                <div className="pt-2 border-t border-indigo-100/50 dark:border-indigo-900/40 flex flex-col gap-1 bg-white/50 dark:bg-gray-950/40 p-2.5 rounded-lg font-sans">
                  <div className="flex justify-between text-[11px] text-gray-650 dark:text-gray-300">
                    <span className="font-medium">Custo de Deslocamento:</span>
                    <span className="font-bold">
                      {calcDistanceKm} KM × R${" "}
                      {parseFloat(calcValorKm || "0").toFixed(2)}{" "}
                      {calcIdaVolta ? "× 2 (Ida/Volta)" : ""} = R${" "}
                      {(
                        (calcDistanceKm || 0) *
                        (parseFloat(calcValorKm) || 0) *
                        (calcIdaVolta ? 2 : 1)
                      ).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  {(parseFloat(calcHotel) || 0) > 0 && (
                    <div className="flex justify-between text-[11px] text-gray-650 dark:text-gray-300">
                      <span className="font-medium">Hotel/Hospedagem:</span>
                      <span className="font-bold">
                        R${" "}
                        {parseFloat(calcHotel || "0").toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {(parseFloat(calcMargem) || 0) > 0 && (
                    <div className="flex justify-between text-[11px] text-gray-650 dark:text-gray-300 border-t border-indigo-100/30 pt-1">
                      <span className="font-medium">Subtotal:</span>
                      <span className="font-bold">
                        R${" "}
                        {(
                          (calcDistanceKm || 0) *
                            (parseFloat(calcValorKm) || 0) *
                            (calcIdaVolta ? 2 : 1) +
                          (parseFloat(calcHotel) || 0)
                        ).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                  {(parseFloat(calcMargem) || 0) > 0 && (
                    <div className="flex justify-between text-[11px] text-indigo-650 dark:text-indigo-400">
                      <span className="font-medium">
                        Acréscimo de Margem (+{calcMargem}%):
                      </span>
                      <span className="font-bold">
                        R${" "}
                        {(
                          ((calcDistanceKm || 0) *
                            (parseFloat(calcValorKm) || 0) *
                            (calcIdaVolta ? 2 : 1) +
                            (parseFloat(calcHotel) || 0)) *
                          (parseFloat(calcMargem) / 100)
                        ).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Valor Total do Reembolso */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 font-sans">
              <div>
                <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-450 tracking-wide block">
                  Valor Total do Reembolso
                </span>
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-555 block">
                  Base + Hotel + Margem acrescida
                </span>
              </div>
              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-1.5 px-2 py-1 bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-850 rounded-xl shadow-xs">
                  <span className="text-[10px] font-black text-emerald-850 dark:text-emerald-400 tracking-wider">
                    Margem:
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={calcMargem}
                    onChange={(e) => setCalcMargem(e.target.value)}
                    className="w-12 text-center text-xs font-black text-emerald-700 dark:text-emerald-300 outline-none border-none p-0 bg-transparent font-sans"
                    placeholder="0"
                  />
                  <span className="text-[10px] font-black text-emerald-850 dark:text-emerald-450">
                    %
                  </span>
                </div>
                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-450">
                  R${" "}
                  {(
                    ((calcDistanceKm || 0) *
                      (parseFloat(calcValorKm) || 0) *
                      (calcIdaVolta ? 2 : 1) +
                      (parseFloat(calcHotel) || 0)) *
                    (1 + (parseFloat(calcMargem) || 0) / 100)
                  ).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowDistanceModal(false)}
                className="flex-1 py-2.5 bg-gray-105 dark:bg-gray-800 text-gray-500 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer text-center font-sans"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={calcDistanceKm === null}
                onClick={handleApplyCalculatedDistance}
                className="flex-1 py-1 px-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer text-center font-sans"
              >
                Aplicar no Deslocamento
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showMemorialModal && memorialData && (
        <Modal
          title="Memorial de Cálculo de Deslocamento"
          onClose={() => setShowMemorialModal(false)}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 font-sans text-xs">
            <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-3.5 rounded-xl border border-indigo-100/50 dark:border-indigo-900/40">
              <span className="block text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider mb-2">
                Parâmetros do Deslocamento{" "}
                {memorialData.isReal
                  ? "(Custo Realizado / Real)"
                  : "(Custo Estimado)"}
              </span>
              <div className="space-y-1.5 text-gray-700 dark:text-gray-300">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-500">
                    Parceiro Instalador:
                  </span>
                  <span className="font-black text-gray-800 dark:text-white">
                    {memorialData.instaladorNome}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-500">
                    Distância Calculada (Ida):
                  </span>
                  <span className="font-black text-gray-800 dark:text-white">
                    {memorialData.distancia} KM
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-500">
                    Considerar Ida e Volta:
                  </span>
                  <span className="font-black text-gray-800 dark:text-white">
                    {memorialData.idaVolta ? "Sim (× 2)" : "Não"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-500">
                    Dias de Viagem/Trabalho:
                  </span>
                  <span className="font-black text-gray-800 dark:text-white">
                    {memorialData.dias} {memorialData.dias > 1 ? "dias" : "dia"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-500">
                    Valor por KM:
                  </span>
                  <span className="font-black text-gray-800 dark:text-white">
                    R$ {memorialData.valorKm.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 p-3.5 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
              <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-extrabold uppercase tracking-wider mb-2">
                Fórmula de Cálculo
              </span>
              <div className="space-y-1.5 text-gray-700 dark:text-gray-300">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-gray-500">
                    Custo Base de Deslocamento:
                  </span>
                  <div className="text-right">
                    <span className="font-black text-gray-800 dark:text-white block">
                      R${" "}
                      {(
                        memorialData.distancia *
                        memorialData.valorKm *
                        (memorialData.idaVolta ? 2 : 1) *
                        memorialData.dias
                      ).toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-[9px] text-gray-400 block font-mono">
                      ({memorialData.distancia} KM × R${" "}
                      {memorialData.valorKm.toFixed(2)}{" "}
                      {memorialData.idaVolta ? "× 2" : ""}{" "}
                      {memorialData.dias > 1
                        ? `× ${memorialData.dias} dias`
                        : ""}
                      )
                    </span>
                  </div>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-dashed border-gray-200 dark:border-gray-700/60 font-sans">
                  <span className="font-semibold text-gray-500">
                    Custo de Hospedagem / Hotel:
                  </span>
                  <span className="font-black text-gray-800 dark:text-white">
                    R${" "}
                    {memorialData.hotel.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-dashed border-gray-200 dark:border-gray-700/60 font-sans">
                  <span className="font-semibold text-gray-500">
                    Subtotal (Transp. + Hotel):
                  </span>
                  <span className="font-black text-gray-800 dark:text-white">
                    R${" "}
                    {(
                      memorialData.distancia *
                        memorialData.valorKm *
                        (memorialData.idaVolta ? 2 : 1) *
                        memorialData.dias +
                      memorialData.hotel
                    ).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-500 font-sans">
                    Margem aplicada:
                  </span>
                  <span className="font-black text-gray-800 dark:text-white">
                    +{memorialData.margem}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50/40 dark:bg-amber-950/10 p-4 rounded-xl border border-amber-200/50 dark:border-amber-900/20 flex justify-between items-center font-sans">
              <div>
                <span className="block text-[9px] text-amber-600 dark:text-amber-400 font-extrabold uppercase tracking-wider">
                  {memorialData.isReal
                    ? "Custo Final Realizado"
                    : "Custo Final Estimado"}
                </span>
                <span className="text-[10px] text-gray-400">
                  Arredondado ao valor sugerido
                </span>
              </div>
              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                R${" "}
                {memorialData.valorFinal.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowMemorialModal(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all cursor-pointer font-sans"
              >
                Fechar Memorial
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OrcamentoPage;
