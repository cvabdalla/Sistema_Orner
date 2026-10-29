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
  CalculatorIcon,
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
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [checklists, setChecklists] = useState<ChecklistEntry[]>([]);
  const [instaladores, setInstaladores] = useState<any[]>([]);
  const [systemKmValue, setSystemKmValue] = useState<number>(1.20);

  // Estados da Calculadora de Deslocamento
  const [showDistanceModal, setShowDistanceModal] = useState(false);
  const [calcInstaladorId, setCalcInstaladorId] = useState("");
  const [calcCep, setCalcCep] = useState("");
  const [calcRua, setCalcRua] = useState("");
  const [calcNumero, setCalcNumero] = useState("");
  const [calcCidade, setCalcCidade] = useState("");
  const [calcUf, setCalcUf] = useState("");
  const [calcDistanceKm, setCalcDistanceKm] = useState<number | null>(null);
  const [calcValorKm, setCalcValorKm] = useState("1.20");
  const [calcIdaVolta, setCalcIdaVolta] = useState(true);
  const [calcHotel, setCalcHotel] = useState("0");
  const [calcMargem, setCalcMargem] = useState("0");
  const [calcDiasViagem, setCalcDiasViagem] = useState(1);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [isLoadingCalcCep, setIsLoadingCalcCep] = useState(false);

  // Estados do Memorial de Cálculo
  const [showMemorialModal, setShowMemorialModal] = useState(false);
  const [memorialData, setMemorialData] = useState<any>(null);

  // Estados de Pedágios
  const [showTollsModal, setShowTollsModal] = useState(false);
  const [tollsModalData, setTollsModalData] = useState<any>(null);
  const [isCalculatingTolls, setIsCalculatingTolls] = useState(false);

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

  // Estado da Calculadora de Margem Desejada (Aba Resumo Financeiro)
  const [isMarginCalculatorOpen, setIsMarginCalculatorOpen] = useState(false);
  const [targetMarginInput, setTargetMarginInput] = useState<string>("20");
  const [selectedServiceIdForMargin, setSelectedServiceIdForMargin] = useState<string>("");
  const [newServiceNameForMargin, setNewServiceNameForMargin] = useState<string>("Mão de Obra Técnica");

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

  const roundToCents = (value: number) => Math.round(value * 100) / 100;

  const parseNumber = (val: any): number => {
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const clean = String(val).replace(",", ".");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const loadGoogleMapsScript = (callback: () => void, onError?: () => void) => {
    if ((window as any).google && (window as any).google.maps) {
      callback();
      return;
    }
    const GOOGLE_MAPS_KEY = (globalThis as any).process?.env?.GOOGLE_MAPS_PLATFORM_KEY || (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || "";
    if (!GOOGLE_MAPS_KEY || GOOGLE_MAPS_KEY === "YOUR_GOOGLE_MAPS_KEY" || GOOGLE_MAPS_KEY.trim() === "") {
      console.warn("Chave do Google Maps não configurada. Usando fallback.");
      if (onError) onError();
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
      if (onError) onError();
    };
    document.head.appendChild(script);
  };

  const calculateWithGoogleMaps = (originAddr: string, destAddr: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const GOOGLE_MAPS_KEY = (globalThis as any).process?.env?.GOOGLE_MAPS_PLATFORM_KEY || (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || "";
      if (!GOOGLE_MAPS_KEY || GOOGLE_MAPS_KEY === "YOUR_GOOGLE_MAPS_KEY" || GOOGLE_MAPS_KEY.trim() === "") {
        reject(new Error("Chave do Google Maps não configurada. Usando fallback OSRM."));
        return;
      }
      loadGoogleMapsScript(() => {
        if (!(window as any).google) {
          reject(new Error("Google Maps SDK não carregado"));
          return;
        }
        const service = new (window as any).google.maps.DistanceMatrixService();
        service.getDistanceMatrix({
          origins: [originAddr],
          destinations: [destAddr],
          travelMode: (window as any).google.maps.TravelMode.DRIVING,
        }, (response: any, status: string) => {
          if (status === "OK" && response && response.rows[0]?.elements[0]?.status === "OK") {
            const distanceMeters = response.rows[0].elements[0].distance.value;
            const distanceKm = distanceMeters / 1000;
            resolve(distanceKm);
          } else {
            const dirService = new (window as any).google.maps.DirectionsService();
            dirService.route({
              origin: originAddr,
              destination: destAddr,
              travelMode: (window as any).google.maps.TravelMode.DRIVING
            }, (result: any, dirStatus: string) => {
              if (dirStatus === "OK" && result && result.routes[0]?.legs[0]?.distance) {
                const distKm = result.routes[0].legs[0].distance.value / 1000;
                resolve(distKm);
              } else {
                reject(new Error(`Erro DistanceMatrix/Directions: ${status || dirStatus}`));
              }
            });
          }
        });
      }, () => {
        reject(new Error("Erro ao carregar o SDK do Google Maps"));
      });
    });
  };

  const geocodeAddress = async (cep: string, rua: string, cidade: string, uf: string): Promise<{lat: number, lon: number}> => {
    const cleanCepVal = (cep || "").replace(/\D/g, "");
    if (cleanCepVal.length === 8) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?postalcode=${cleanCepVal}&country=Brazil&format=json&limit=1`;
        const res = await fetch(url, { headers: { "User-Agent": "SistemaOrnerSolar/1.0" } });
        const data = await res.json();
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
      } catch (e) {
        console.warn(`Geocoding by CEP ${cleanCepVal} failed:`, e);
      }
    }

    if (rua && cidade) {
      try {
        const query = `${rua}, ${cidade} - ${uf || ""}, Brazil`;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
        const res = await fetch(url, { headers: { "User-Agent": "SistemaOrnerSolar/1.0" } });
        const data = await res.json();
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
      } catch (e) {
        console.warn("Geocoding by street address failed:", e);
      }
    }

    if (cidade) {
      try {
        const url = `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cidade)}&state=${encodeURIComponent(uf || "")}&country=Brazil&format=json&limit=1`;
        const res = await fetch(url, { headers: { "User-Agent": "SistemaOrnerSolar/1.0" } });
        const data = await res.json();
        if (data && data.length > 0) {
          return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        }
      } catch (e) {
        console.warn("Geocoding by city failed:", e);
      }
    }

    throw new Error("Não foi possível localizar as coordenadas para o endereço sugerido.");
  };

  const calculateWithOSRM = async (
    origCep: string, origRua: string, origCidade: string, origUf: string,
    destCep: string, destRua: string, destCidade: string, destUf: string
  ): Promise<number> => {
    const originCoords = await geocodeAddress(origCep, origRua, origCidade, origUf);
    const destCoords = await geocodeAddress(destCep, destRua, destCidade, destUf);

    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`;
    const routeRes = await fetch(routeUrl);
    const routeData = await routeRes.json();

    if (routeData && routeData.routes && routeData.routes.length > 0) {
      return routeData.routes[0].distance / 1000;
    }
    throw new Error("Não foi possível calcular a rota via OSRM");
  };

  const getSimulatedTollsList = (originCity: string, destCity: string, distanceKm: number) => {
    const list: any[] = [];
    const numPlazas = distanceKm > 25 ? Math.max(1, Math.round(distanceKm / 60)) : 0;

    const normalizeStr = (str: string) => {
      return (str || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    };

    const cleanOrig = normalizeStr(originCity);
    const cleanDest = normalizeStr(destCity);

    const hasCampinasAmericana = (cleanOrig.includes("campinas") && cleanDest.includes("americana")) || 
                                 (cleanOrig.includes("americana") && cleanDest.includes("campinas"));
    const hasCampinasSaoPaulo = (cleanOrig.includes("campinas") && cleanDest.includes("sao paulo")) || 
                                (cleanOrig.includes("sao paulo") && cleanDest.includes("campinas"));
    const hasCampinasJundiai = (cleanOrig.includes("campinas") && cleanDest.includes("jundia")) || 
                               (cleanOrig.includes("jundia") && cleanDest.includes("campinas"));

    const averageTollPrice = 12.20;

    if (hasCampinasAmericana) {
      list.push({
        name: "Pedágio Nova Odessa / Sumaré (SP-330 Rod. Anhanguera)",
        value: 12.20,
        location: "Nova Odessa - Km 118"
      });
    } else if (hasCampinasJundiai) {
      list.push({
        name: "Pedágio Louveira (SP-330 Rod. Anhanguera)",
        value: 11.80,
        location: "Louveira - Km 82"
      });
    } else if (hasCampinasSaoPaulo) {
      list.push({
        name: "Pedágio Valinhos (SP-330 Rod. Anhanguera)",
        value: 11.80,
        location: "Valinhos - Km 82"
      });
      list.push({
        name: "Pedágio Itupeva (SP-348 Rod. dos Bandeirantes)",
        value: 12.60,
        location: "Itupeva - Km 77"
      });
    }

    if (list.length === 0) {
      for (let i = 1; i <= numPlazas; i++) {
        list.push({
          name: `Pedágio Estimado ${i} (Rodovia de Ligação)`,
          value: averageTollPrice,
          location: `Trecho ${originCity} ➔ ${destCity}`
        });
      }
    } else {
      if (list.length < numPlazas) {
        for (let i = list.length + 1; i <= numPlazas; i++) {
          list.push({
            name: `Pedágio Estimado Adicional ${i}`,
            value: averageTollPrice,
            location: `Rodovia Secundária - Km ${Math.round((distanceKm / (numPlazas + 1)) * i)}`
          });
        }
      }
    }
    return list;
  };

  const handleOpenDistanceCalculator = () => {
    if (!editingRecord) return;
    setCalcInstaladorId(editingRecord.instaladorId || "");
    setCalcCep(editingRecord.cep || "");
    setCalcRua(editingRecord.address || "");
    setCalcNumero(editingRecord.numero || "");
    setCalcCidade(editingRecord.city || "");
    setCalcUf(editingRecord.estado || "");

    const currentDist = editingRecord.distanciaObraKM !== undefined && editingRecord.distanciaObraKM !== ""
      ? parseNumber(editingRecord.distanciaObraKM)
      : null;
    setCalcDistanceKm(currentDist);

    setCalcDiasViagem(editingRecord.quantidadeDiasViagem || 1);
    setCalcValorKm(
      editingRecord.deslocamentoValorKm !== undefined && editingRecord.deslocamentoValorKm !== ""
        ? String(editingRecord.deslocamentoValorKm)
        : String(systemKmValue || 1.20)
    );
    setCalcIdaVolta(editingRecord.considerarIdaVolta !== undefined ? editingRecord.considerarIdaVolta !== false : true);
    setCalcHotel(
      editingRecord.deslocamentoHotel !== undefined && editingRecord.deslocamentoHotel !== ""
        ? String(editingRecord.deslocamentoHotel)
        : "0"
    );
    setCalcMargem(
      editingRecord.deslocamentoMargem !== undefined && editingRecord.deslocamentoMargem !== ""
        ? String(editingRecord.deslocamentoMargem)
        : "0"
    );

    setShowDistanceModal(true);
  };

  const handleFetchCepForCalculadora = async (cepVal: string) => {
    const cleanCep = (cepVal || "").replace(/\D/g, "");
    if (cleanCep.length === 8) {
      setIsLoadingCalcCep(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (data && !data.erro) {
          setCalcRua(data.logradouro || "");
          setCalcCidade(data.localidade || "");
          setCalcUf(data.uf || "");
        }
      } catch (e) {
        console.error("Erro ao buscar CEP na calculadora:", e);
      } finally {
        setIsLoadingCalcCep(false);
      }
    }
  };

  const handleCalculateGoogleDistance = async () => {
    const selectedInst = instaladores.find((i: any) => i.id === calcInstaladorId);
    if (!selectedInst) {
      safeAlert("Por favor, selecione o instalador para fornecer o endereço base de origem.");
      return;
    }

    const instNum = (selectedInst as any).numero ? `, ${(selectedInst as any).numero}` : "";
    const instBairro = (selectedInst as any).bairro ? ` - ${(selectedInst as any).bairro}` : "";
    const originAddress = `${selectedInst.endereco || ""}${instNum}${instBairro}, ${selectedInst.cidade || ""} - ${selectedInst.uf || ""}, CEP ${selectedInst.cep || ""}`;
    const destinationAddress = `${calcRua || ""}, ${calcNumero || ""}, ${calcCidade || ""} - ${calcUf || ""} CEP ${calcCep || ""}`;

    if (!calcRua || !calcCidade) {
      safeAlert("Por favor, informe o endereço de destino (rua e cidade).");
      return;
    }

    setIsCalculatingDistance(true);
    try {
      const kms = await calculateWithGoogleMaps(originAddress, destinationAddress);
      setCalcDistanceKm(parseFloat(kms.toFixed(1)));
    } catch (error: any) {
      console.warn("Google Maps calculation failed, trying real OSRM estimation...", error);
      try {
        const kms = await calculateWithOSRM(
          selectedInst.cep || "", selectedInst.endereco || "", selectedInst.cidade || "", selectedInst.uf || "",
          calcCep || "", calcRua || "", calcCidade || "", calcUf || ""
        );
        setCalcDistanceKm(parseFloat(kms.toFixed(1)));
      } catch (osrmError: any) {
        console.warn("OSRM calculation failed, falling back to deterministic hash:", osrmError);
        const strConcat = `${originAddress}||${destinationAddress}`.toLowerCase().trim();
        let hash = 0;
        for (let i = 0; i < strConcat.length; i++) {
          hash = strConcat.charCodeAt(i) + ((hash << 5) - hash);
        }
        const absHash = Math.abs(hash);
        const minFactor = 25;
        const maxFactor = 75;
        const baseEstVal = minFactor + (absHash % (maxFactor - minFactor + 1));
        const decimalEstVal = (absHash % 10) / 10;
        const deterministicKm = parseFloat((baseEstVal + decimalEstVal).toFixed(1));
        setCalcDistanceKm(deterministicKm);
        showToast(`Cálculo automático indisponível. Usando estimativa de ${deterministicKm} KM. Você pode ajustar manualmente se desejar.`, "info");
      }
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  const handleApplyCalculatedDistance = () => {
    if (!editingRecord) return;
    const kms = calcDistanceKm || 0;
    const vKm = parseNumber(calcValorKm) || 0;
    const dias = calcDiasViagem || 1;
    const hotel = parseNumber(calcHotel) || 0;
    const margem = parseNumber(calcMargem) || 0;

    const baseCost = kms * vKm * (calcIdaVolta ? 2 : 1) * dias;
    let totalCost = baseCost + hotel;
    if (margem > 0) {
      totalCost = totalCost * (1 + margem / 100);
    }

    const selectedInst = instaladores.find((i: any) => i.id === calcInstaladorId);
    const originCity = selectedInst ? selectedInst.cidade : "Cidade Origem";
    const destCity = calcCidade || editingRecord.city || "Cidade Destino";

    const list = getSimulatedTollsList(originCity, destCity, kms);
    const sumSingleWay = list.reduce((acc: number, p: any) => acc + p.value, 0);
    const estimatedTollsCost = sumSingleWay * (calcIdaVolta ? 2 : 1) * dias;

    const roundedDeslocamento = roundToCents(totalCost);
    const roundedPedagio = roundToCents(estimatedTollsCost);

    setEditingRecord((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        instaladorId: calcInstaladorId,
        distanciaObraKM: String(kms),
        quantidadeDiasViagem: dias,
        considerarIdaVolta: calcIdaVolta,
        deslocamentoValorKm: String(vKm),
        deslocamentoHotel: String(hotel),
        deslocamentoMargem: String(margem),
        deslocamento: roundedDeslocamento,
        pedagio: roundedPedagio,
      };
    });

    showToast(
      `Deslocamento (${formatCurrency(roundedDeslocamento)}) e Pedágio (${formatCurrency(roundedPedagio)}) aplicados ao chamado!`,
      "success"
    );
    setShowDistanceModal(false);
  };

  const handleOpenMemorial = () => {
    if (!editingRecord) return;
    const dist = parseNumber(editingRecord.distanciaObraKM) || 0;
    const dias = editingRecord.quantidadeDiasViagem || 1;
    const idaVolta = editingRecord.considerarIdaVolta !== false;
    const vKm = parseNumber(editingRecord.deslocamentoValorKm) || parseNumber(calcValorKm) || systemKmValue || 1.20;
    const hotel = parseNumber(editingRecord.deslocamentoHotel) || parseNumber(calcHotel) || 0;
    const margem = parseNumber(editingRecord.deslocamentoMargem) || parseNumber(calcMargem) || 0;

    const inst = instaladores.find((i: any) => i.id === editingRecord.instaladorId);
    const instaladorNome = inst ? inst.nome : "Não selecionado";
    const finalVal = parseNumber(editingRecord.deslocamento) || 0;

    setMemorialData({
      distancia: dist,
      dias: dias,
      idaVolta: idaVolta,
      valorKm: vKm,
      hotel: hotel,
      margem: margem,
      instaladorNome: instaladorNome,
      valorFinal: finalVal,
    });
    setShowMemorialModal(true);
  };

  const handleCalculateTollsInline = async () => {
    if (!editingRecord) return;
    const selectedInst = instaladores.find((i: any) => i.id === editingRecord.instaladorId);

    setIsCalculatingTolls(true);
    try {
      let kms = parseNumber(editingRecord.distanciaObraKM);
      if (isNaN(kms) || kms <= 0) {
        if (!selectedInst) {
          safeAlert("Por favor, selecione o instalador e defina a distância da obra (no botão Calcular de Deslocamento) para calcular os pedágios.");
          setIsCalculatingTolls(false);
          return;
        }

        const destCep = editingRecord.cep || calcCep || "";
        const destRua = editingRecord.address || calcRua || "";
        const destNum = editingRecord.numero || calcNumero || "";
        const destCidade = editingRecord.city || calcCidade || "";
        const destUf = editingRecord.estado || calcUf || "";

        if (!destCep && !destRua) {
          safeAlert("Endereço de destino não informado. Preencha os Dados do Cliente na Aba 1 ou informe na Calculadora de Deslocamento.");
          setIsCalculatingTolls(false);
          return;
        }

        const instNum = (selectedInst as any).numero ? `, ${(selectedInst as any).numero}` : "";
        const instBairro = (selectedInst as any).bairro ? ` - ${(selectedInst as any).bairro}` : "";
        const originAddress = `${selectedInst.endereco || ""}${instNum}${instBairro}, ${selectedInst.cidade || ""} - ${selectedInst.uf || ""}, CEP ${selectedInst.cep || ""}`;
        const destinationAddress = `${destRua || ""}, ${destNum || ""}, ${destCidade || ""} - ${destUf || ""} CEP ${destCep || ""}`;

        try {
          kms = await calculateWithGoogleMaps(originAddress, destinationAddress);
        } catch {
          try {
            kms = await calculateWithOSRM(
              selectedInst.cep || "", selectedInst.endereco || "", selectedInst.cidade || "", selectedInst.uf || "",
              destCep, destRua, destCidade, destUf
            );
          } catch {
            const strConcat = `${originAddress}||${destinationAddress}`.toLowerCase().trim();
            let hash = 0;
            for (let i = 0; i < strConcat.length; i++) {
              hash = strConcat.charCodeAt(i) + ((hash << 5) - hash);
            }
            const absHash = Math.abs(hash);
            kms = 25 + (absHash % 51) + ((absHash % 10) / 10);
          }
        }
      }

      const isRoundTrip = editingRecord.considerarIdaVolta !== false;
      const days = editingRecord.quantidadeDiasViagem || 1;
      const originCity = selectedInst ? selectedInst.cidade : "Cidade Origem";
      const destCity = editingRecord.city || calcCidade || "Cidade Destino";

      const list = getSimulatedTollsList(originCity, destCity, kms);
      const numTollPlazas = list.length;
      const sumSingleWay = list.reduce((acc: number, p: any) => acc + p.value, 0);
      const totalTollTrips = numTollPlazas * (isRoundTrip ? 2 : 1) * days;
      const estimatedTollsCost = sumSingleWay * (isRoundTrip ? 2 : 1) * days;

      const roundedPedagio = roundToCents(estimatedTollsCost);

      setEditingRecord((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          distanciaObraKM: String(kms.toFixed(1)),
          pedagio: roundedPedagio,
        };
      });

      showToast(
        `Pedágio calculado com sucesso: ${formatCurrency(roundedPedagio)} (${numTollPlazas} praças, ${totalTollTrips} passagens)`,
        "success"
      );
    } catch (e: any) {
      console.error("Erro ao calcular pedágios:", e);
      safeAlert("Não foi possível calcular o pedágio automaticamente.");
    } finally {
      setIsCalculatingTolls(false);
    }
  };

  const handleOpenTollsDetail = () => {
    if (!editingRecord) return;
    const selectedInst = instaladores.find((i: any) => i.id === editingRecord.instaladorId);
    const kms = parseNumber(editingRecord.distanciaObraKM) || (calcDistanceKm || 0);

    const originCity = selectedInst ? selectedInst.cidade : (selectedInst?.nome || "Cidade do Instalador");
    const destCity = editingRecord.city || calcCidade || "Local da Obra";
    const list = getSimulatedTollsList(originCity, destCity, kms);
    const isRoundTrip = editingRecord.considerarIdaVolta !== false;
    const days = editingRecord.quantidadeDiasViagem || 1;
    const sumSingleWay = list.reduce((acc: number, p: any) => acc + p.value, 0);
    const totalTolls = sumSingleWay * (isRoundTrip ? 2 : 1) * days;

    setTollsModalData({
      origemCidade: originCity,
      destinoCidade: destCity,
      distancia: kms,
      praçasLista: list,
      idaVolta: isRoundTrip,
      dias: days,
      custoTotal: parseNumber(editingRecord.pedagio) || totalTolls,
    });
    setShowTollsModal(true);
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
      const [maintData, orcData, lavData, checkins, checkouts, manutChecklists, stock, instaladoresData, remoteConfigs] = await Promise.all([
        dataService.getAll<ManutencaoRecord>(
          "manutencoes",
          currentUser.id,
          isAdmin,
        ),
        dataService.getAll<SavedOrcamento>("orcamentos", currentUser.id, true),
        dataService.getAll<any>("lavagem_clients", currentUser.id, true),
        dataService.getPartial<any>("checklist_checkin", "id, owner_id, project, responsible, date, status", currentUser.id, true),
        dataService.getPartial<any>("checklist_checkout", "id, owner_id, project, responsible, date, status", currentUser.id, true),
        dataService.getPartial<any>("checklist_manutencao", "id, owner_id, project, responsible, date, status, details->componentesEstoque", currentUser.id, true),
        dataService.getAll<StockItem>("stock_items", currentUser.id, true),
        dataService.getAll<any>("instaladores", undefined, true),
        dataService.getAll<any>("system_configs", undefined, true),
      ]);

      setMaintenances(maintData || []);
      setOrcamentos(orcData || []);
      setLavagemClients(lavData || []);
      setInstaladores((instaladoresData || []).filter((i: any) => i.ativo));

      const remoteKm = (remoteConfigs || []).find((c: any) => c.id === "km_value_budget") || (remoteConfigs || []).find((c: any) => c.id === "km_value");
      const finalKmCost = remoteKm ? parseFloat(remoteKm.value) : 1.20;
      setSystemKmValue(finalKmCost);

      const formatChecklist = (c: any) => ({
        ...c,
        details: {
          componentesEstoque: c.componentesEstoque || []
        }
      });

      const combinedChecklists: ChecklistEntry[] = [
        ...(checkins || []).map((c) => ({ ...formatChecklist(c), type: "checkin" as const })),
        ...(checkouts || []).map((c) => ({ ...formatChecklist(c), type: "checkout" as const })),
        ...(manutChecklists || []).map((c) => ({ ...formatChecklist(c), type: "manutencao" as const })),
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
      deslocamento: 0,
      pedagio: 0,
      instaladorId: "",
      distanciaObraKM: "",
      quantidadeDiasViagem: 1,
      considerarIdaVolta: true,
      deslocamentoValorKm: String(systemKmValue || 1.20),
      deslocamentoHotel: "0",
      deslocamentoMargem: "0",
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
      ...record,
      materialsSource: record.materialsSource || "manual",
      selectedChecklists: record.selectedChecklists || [],
      deslocamento: Number(record.deslocamento || 0),
      pedagio: Number(record.pedagio || 0),
      instaladorId: record.instaladorId || "",
      distanciaObraKM: record.distanciaObraKM || "",
      quantidadeDiasViagem: record.quantidadeDiasViagem !== undefined ? Number(record.quantidadeDiasViagem) : 1,
      considerarIdaVolta: record.considerarIdaVolta !== undefined ? record.considerarIdaVolta !== false : true,
      deslocamentoValorKm: record.deslocamentoValorKm || String(systemKmValue || 1.20),
      deslocamentoHotel: record.deslocamentoHotel || "0",
      deslocamentoMargem: record.deslocamentoMargem || "0",
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
  const handleToggleChecklist = async (checklistId: string) => {
    if (!editingRecord) return;
    const currentSelected = editingRecord.selectedChecklists || [];
    let nextSelected: string[];
    if (currentSelected.includes(checklistId)) {
      nextSelected = currentSelected.filter((id) => id !== checklistId);
    } else {
      nextSelected = [...currentSelected, checklistId];
    }

    let updatedChecklists = [...checklists];
    const isAdding = nextSelected.includes(checklistId);
    if (isAdding) {
      const existing = checklists.find((c) => c.id === checklistId);
      if (existing && (!existing.details?.componentesEstoque || existing.details.componentesEstoque.length === 0)) {
        try {
          const table = existing.type === "checkin" 
            ? "checklist_checkin" 
            : existing.type === "checkout" 
              ? "checklist_checkout" 
              : "checklist_manutencao";
          const full = await dataService.getById<any>(table, checklistId);
          if (full && full.details) {
            updatedChecklists = checklists.map((c) =>
              c.id === checklistId ? { ...c, details: full.details } : c
            );
            setChecklists(updatedChecklists);
          }
        } catch (err) {
          console.error("Erro ao carregar detalhes do checklist para manutenção:", err);
        }
      }
    }

    const compiledMaterials: ManutencaoMaterialItem[] = [];
    nextSelected.forEach((chkId) => {
      const chk = updatedChecklists.find((c) => c.id === chkId);
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
    if (!editingRecord) {
      return {
        cost: 0,
        price: 0,
        profit: 0,
        margin: 0,
        servicesPrice: 0,
        materialsCost: 0,
        deslocamento: 0,
        pedagio: 0,
        displacementTotal: 0,
        totalToCharge: 0,
      };
    }

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

    const deslocamento = parseNumber(editingRecord.deslocamento);
    const pedagio = parseNumber(editingRecord.pedagio);
    const displacementTotal = deslocamento + pedagio;

    const totalCost = materialsCost + displacementTotal; // Despesa Total (Saída: Peças + Deslocamento + Pedágio)
    const totalPrice = servicesPrice; // Receita de Serviços (Valor Cobrado do Cliente)
    const profit = totalPrice - totalCost;
    const margin = totalPrice > 0 ? (profit / totalPrice) * 100 : 0;
    const totalToCharge = servicesPrice; // Valor cobrado do cliente é exclusivamente o serviço

    return {
      cost: totalCost,
      price: totalPrice,
      profit,
      margin,
      servicesPrice,
      materialsCost,
      deslocamento,
      pedagio,
      displacementTotal,
      totalToCharge,
    };
  }, [editingRecord?.services, editingRecord?.materials, editingRecord?.deslocamento, editingRecord?.pedagio]);

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

  // Abertura da Calculadora de Margem
  const handleOpenMarginCalculator = () => {
    const services = editingRecord?.services || [];
    if (services.length > 0) {
      if (!selectedServiceIdForMargin || !services.some((s) => s.id === selectedServiceIdForMargin)) {
        setSelectedServiceIdForMargin(services[0].id);
      }
    }
    if (computedTotals.margin > 0 && computedTotals.margin < 100) {
      setTargetMarginInput(computedTotals.margin.toFixed(1));
    } else {
      setTargetMarginInput("25");
    }
    setIsMarginCalculatorOpen(true);
  };

  // Cálculo e simulação em tempo real para a margem desejada
  const marginCalculation = useMemo(() => {
    if (!editingRecord) {
      return {
        totalCost: 0,
        targetMarginNum: 0,
        requiredRevenue: 0,
        otherServicesRevenue: 0,
        neededServicePrice: 0,
        simulatedTotalRevenue: 0,
        simulatedProfit: 0,
        simulatedMargin: 0,
        targetService: undefined as ManutencaoServiceItem | undefined,
        isValid: false,
        warning: "",
      };
    }

    const materialsCost = (editingRecord.materials || []).reduce(
      (acc, m) => acc + m.unitCost * m.qty,
      0
    );
    const deslocamento = parseNumber(editingRecord.deslocamento);
    const pedagio = parseNumber(editingRecord.pedagio);
    const totalCost = materialsCost + deslocamento + pedagio;

    const targetMarginNum = parseFloat(String(targetMarginInput).replace(",", ".")) || 0;

    if (targetMarginNum >= 100) {
      return {
        totalCost,
        targetMarginNum,
        requiredRevenue: 0,
        otherServicesRevenue: 0,
        neededServicePrice: 0,
        simulatedTotalRevenue: 0,
        simulatedProfit: 0,
        simulatedMargin: 0,
        targetService: undefined,
        isValid: false,
        warning: "A margem líquida deve ser menor que 100%.",
      };
    }

    if (targetMarginNum < 0) {
      return {
        totalCost,
        targetMarginNum,
        requiredRevenue: 0,
        otherServicesRevenue: 0,
        neededServicePrice: 0,
        simulatedTotalRevenue: 0,
        simulatedProfit: 0,
        simulatedMargin: 0,
        targetService: undefined,
        isValid: false,
        warning: "A margem líquida não pode ser negativa.",
      };
    }

    // Fórmula: Margem (%) = ((Receita - Custo) / Receita) * 100
    // Receita * (1 - Margem/100) = Custo
    // Receita = Custo / (1 - Margem/100)
    const factor = 1 - targetMarginNum / 100;
    const requiredRevenue = factor > 0 ? totalCost / factor : 0;

    const services = editingRecord.services || [];
    const targetService =
      services.find((s) => s.id === selectedServiceIdForMargin) || services[0];

    const otherServicesRevenue = targetService
      ? services
          .filter((s) => s.id !== targetService.id)
          .reduce((acc, s) => acc + s.unitPrice * s.qty, 0)
      : 0;

    const neededFromSelected = Math.max(0, requiredRevenue - otherServicesRevenue);
    const serviceQty = targetService?.qty || 1;
    const neededUnitPrice = Math.round((neededFromSelected / serviceQty) * 100) / 100;

    const simulatedTotalRevenue = otherServicesRevenue + neededUnitPrice * serviceQty;
    const simulatedProfit = simulatedTotalRevenue - totalCost;
    const simulatedMargin =
      simulatedTotalRevenue > 0 ? (simulatedProfit / simulatedTotalRevenue) * 100 : 0;

    let warning = "";
    if (totalCost === 0) {
      warning = "Total de despesas (materiais/deslocamento) é R$ 0,00. Adicione peças ou deslocamento na aba 3 para cálculo de margem sobre custos.";
    } else if (otherServicesRevenue > requiredRevenue) {
      warning = "Os outros serviços já somam valor superior à receita total necessária para esta margem.";
    }

    return {
      totalCost,
      targetMarginNum,
      requiredRevenue,
      otherServicesRevenue,
      neededServicePrice: neededUnitPrice,
      simulatedTotalRevenue,
      simulatedProfit,
      simulatedMargin,
      targetService,
      isValid: true,
      warning,
    };
  }, [
    editingRecord?.materials,
    editingRecord?.services,
    editingRecord?.deslocamento,
    editingRecord?.pedagio,
    targetMarginInput,
    selectedServiceIdForMargin,
  ]);

  // Aplicar margem calculada ao serviço selecionado
  const handleApplyMarginToService = () => {
    if (!editingRecord || !marginCalculation.isValid) return;

    const services = editingRecord.services || [];

    if (services.length > 0) {
      const targetService = marginCalculation.targetService;
      if (!targetService) {
        safeAlert("Selecione um serviço para aplicar o valor.");
        return;
      }

      setEditingRecord((prev) => {
        if (!prev) return prev;
        const updatedServices = (prev.services || []).map((s) => {
          if (s.id === targetService.id) {
            return {
              ...s,
              unitPrice: marginCalculation.neededServicePrice,
              isEditing: false,
            };
          }
          return s;
        });
        return { ...prev, services: updatedServices };
      });

      showToast(
        `Valor de "${targetService.description || "Serviço"}" ajustado para ${formatCurrency(
          marginCalculation.neededServicePrice
        )} (Margem: ${marginCalculation.targetMarginNum}%)!`,
        "success"
      );
    } else {
      // Nenhum serviço existia, cria um novo
      const today = new Date().toISOString().split("T")[0];
      const newService: ManutencaoServiceItem = {
        id: "srv_" + Math.random().toString(36).substr(2, 9),
        date: today,
        description: newServiceNameForMargin.trim() || "Mão de Obra Técnica",
        qty: 1,
        unitCost: 0,
        unitPrice: marginCalculation.neededServicePrice,
        isEditing: false,
      };

      setEditingRecord((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          services: [newService],
        };
      });

      showToast(
        `Serviço criado com valor de ${formatCurrency(
          marginCalculation.neededServicePrice
        )} (Margem: ${marginCalculation.targetMarginNum}%)!`,
        "success"
      );
    }

    setIsMarginCalculatorOpen(false);
  };

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
        deslocamento: computedTotals.deslocamento,
        pedagio: computedTotals.pedagio,
        instaladorId: editingRecord.instaladorId || "",
        distanciaObraKM: editingRecord.distanciaObraKM || "",
        quantidadeDiasViagem: editingRecord.quantidadeDiasViagem || 1,
        considerarIdaVolta: editingRecord.considerarIdaVolta !== false,
        deslocamentoValorKm: editingRecord.deslocamentoValorKm || "",
        deslocamentoHotel: editingRecord.deslocamentoHotel || "",
        deslocamentoMargem: editingRecord.deslocamentoMargem || "",
        totalCost: computedTotals.cost,
        totalPrice: computedTotals.price,
        totalToCharge: computedTotals.totalToCharge,
        notes: editingRecord.notes || "",
        motivoPerdido: editingRecord.motivoPerdido || "",
        createdAt: editingRecord.createdAt || new Date().toISOString(),
        approvalDate: (editingRecord.status === "Aprovado" || editingRecord.status === "Finalizado")
          ? (editingRecord.approvalDate || new Date().toISOString().split("T")[0])
          : editingRecord.approvalDate,
      };

      const savedRecord = await dataService.save("manutencoes", finalRecord);

      // Atualiza state local
      setMaintenances((prev) => {
        const index = prev.findIndex((m) => m.id === finalRecord.id);
        if (index > -1) {
          const next = [...prev];
          next[index] = savedRecord || finalRecord;
          return next;
        }
        return [...prev, savedRecord || finalRecord];
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
              {Number(printRecord.deslocamento || 0) > 0 && (
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Deslocamento e Logística:</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {formatCurrency(Number(printRecord.deslocamento))}
                  </span>
                </div>
              )}
              {Number(printRecord.pedagio || 0) > 0 && (
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Pedágios:</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {formatCurrency(Number(printRecord.pedagio))}
                  </span>
                </div>
              )}
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

                  {/* Seção de Custos de Deslocamento e Logística */}
                  <div className="bg-gradient-to-r from-indigo-50/30 via-slate-50/50 to-white dark:from-indigo-950/20 dark:via-gray-800/40 dark:to-gray-900 p-4.5 rounded-xl border border-indigo-150/70 dark:border-indigo-900/40 space-y-3.5 shadow-xs mt-5">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-indigo-100/60 dark:border-indigo-900/40 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span>
                        <span className="text-xs font-bold text-gray-900 dark:text-white tracking-wide">
                          Custos de Deslocamento e Logística
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                        Quilometragem, hotel e pedágios da equipe técnica
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Campo Deslocamento */}
                      <div className="space-y-1.5 bg-white dark:bg-gray-850 p-3.5 rounded-xl border border-gray-150 dark:border-gray-800 shadow-2xs">
                        <div className="flex justify-between items-center">
                          <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">
                            Deslocamento (R$)
                          </label>
                          <div className="flex items-center gap-2">
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={handleOpenDistanceCalculator}
                                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-0.5 bg-transparent border-none outline-none font-sans"
                                title="Calcular distância e valores de deslocamento"
                              >
                                <span>🚗</span>
                                <span>Calcular</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleOpenMemorial}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1 bg-transparent border-none outline-none font-sans"
                              title="Visualizar Memorial de Cálculo"
                            >
                              <span>👁️</span>
                              <span>Memorial</span>
                            </button>
                          </div>
                        </div>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 inset-y-0 flex items-center text-xs font-semibold text-gray-400 pointer-events-none select-none">
                            R$
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={isReadOnly}
                            value={
                              editingRecord.deslocamento !== undefined && editingRecord.deslocamento !== null && editingRecord.deslocamento !== 0
                                ? editingRecord.deslocamento
                                : ""
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              const num = val === "" ? 0 : parseFloat(val);
                              setEditingRecord((prev) => prev ? { ...prev, deslocamento: isNaN(num) ? 0 : num } : prev);
                            }}
                            placeholder="0,00"
                            className={`w-full py-2 pr-3 pl-9 rounded-lg border font-bold text-xs outline-none transition-all ${
                              isReadOnly
                                ? "bg-gray-50 dark:bg-gray-900 text-gray-500 cursor-not-allowed border-gray-200 dark:border-gray-800"
                                : "bg-white dark:bg-gray-900 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 focus:ring-1 focus:ring-indigo-500"
                            }`}
                          />
                        </div>
                        {editingRecord.distanciaObraKM && Number(editingRecord.distanciaObraKM) > 0 && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 pt-0.5 flex-wrap">
                            <span>📍 {editingRecord.distanciaObraKM} KM</span>
                            <span>•</span>
                            <span>{editingRecord.quantidadeDiasViagem || 1} dia(s)</span>
                            <span>•</span>
                            <span>{editingRecord.considerarIdaVolta !== false ? "Ida e Volta" : "Somente Ida"}</span>
                            {(() => {
                              const inst = instaladores.find((i: any) => i.id === editingRecord.instaladorId);
                              return inst ? <><span>•</span><span>Instalador: {inst.nome}</span></> : null;
                            })()}
                          </p>
                        )}
                      </div>

                      {/* Campo Pedágio */}
                      <div className="space-y-1.5 bg-white dark:bg-gray-855 p-3.5 rounded-xl border border-gray-150 dark:border-gray-800 shadow-2xs">
                        <div className="flex justify-between items-center">
                          <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300">
                            Pedágio (R$)
                          </label>
                          <div className="flex items-center gap-2">
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={handleCalculateTollsInline}
                                disabled={isCalculatingTolls}
                                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-0.5 bg-transparent border-none outline-none font-sans disabled:opacity-50"
                                title="Calcular custos de pedágio do trecho"
                              >
                                <span>🛣️</span>
                                <span>{isCalculatingTolls ? "Calculando..." : "Calcular"}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleOpenTollsDetail}
                              className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1 bg-transparent border-none outline-none font-sans"
                              title="Consultar Detalhes dos Pedágios"
                            >
                              <span>👁️</span>
                              <span>Consultar</span>
                            </button>
                          </div>
                        </div>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 inset-y-0 flex items-center text-xs font-semibold text-gray-400 pointer-events-none select-none">
                            R$
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            disabled={isReadOnly}
                            value={
                              editingRecord.pedagio !== undefined && editingRecord.pedagio !== null && editingRecord.pedagio !== 0
                                ? editingRecord.pedagio
                                : ""
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              const num = val === "" ? 0 : parseFloat(val);
                              setEditingRecord((prev) => prev ? { ...prev, pedagio: isNaN(num) ? 0 : num } : prev);
                            }}
                            placeholder="0,00"
                            className={`w-full py-2 pr-3 pl-9 rounded-lg border font-bold text-xs outline-none transition-all ${
                              isReadOnly
                                ? "bg-gray-50 dark:bg-gray-900 text-gray-500 cursor-not-allowed border-gray-200 dark:border-gray-800"
                                : "bg-white dark:bg-gray-900 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 focus:ring-1 focus:ring-indigo-500"
                            }`}
                          />
                        </div>
                        {editingRecord.distanciaObraKM && Number(editingRecord.distanciaObraKM) > 0 && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 pt-0.5">
                            <span>🛣️ Pedágio estimado para rota de {editingRecord.distanciaObraKM} KM</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Totalizador Geral de Peças e Logística */}
                  <div className="bg-rose-50/60 dark:bg-rose-950/25 border border-rose-100/50 dark:border-rose-900/30 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mt-4">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-rose-900 dark:text-rose-200 block">
                        Total de Despesas / Saídas da Manutenção:
                      </span>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-rose-700/80 dark:text-rose-300/80 font-medium">
                        <span>Peças: <strong>{formatCurrency(computedTotals.materialsCost)}</strong></span>
                        <span>+</span>
                        <span>Deslocamento: <strong>{formatCurrency(computedTotals.deslocamento)}</strong></span>
                        <span>+</span>
                        <span>Pedágio: <strong>{formatCurrency(computedTotals.pedagio)}</strong></span>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <span className="text-[9px] font-bold text-rose-500 block uppercase tracking-wider">
                        Total Despesas (Saída)
                      </span>
                      <span className="text-base font-black text-rose-600 dark:text-rose-400">
                        {formatCurrency(computedTotals.cost)}
                      </span>
                    </div>
                  </div>
                  </div>
                </fieldset>
              )}

              {/* TAB 4: Resumo Financeiro */}
              {activeTab === "resumo" && (
                <div className="space-y-5">
                  {/* Card Destaque: Preço Cobrado do Cliente (Receita de Serviços) */}
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-5 rounded-2xl shadow-md border border-indigo-900/40 relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                      <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider border border-emerald-400/20">
                          <DollarIcon className="w-3 h-3 text-emerald-300" />
                          <span>Receita do Chamado</span>
                        </div>
                        <h4 className="text-base sm:text-lg font-bold text-white tracking-tight">
                          Preço Cobrado do Cliente (Serviços e Mão de Obra)
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-200/90 font-medium pt-0.5">
                          <span>Total de Custos: <strong className="text-rose-300 font-bold">{formatCurrency(computedTotals.cost)}</strong></span>
                          <span className="text-indigo-400 font-bold">•</span>
                          <span>Lucro Estimado: <strong className={computedTotals.profit >= 0 ? "text-emerald-300 font-bold" : "text-rose-300 font-bold"}>{formatCurrency(computedTotals.profit)}</strong></span>
                          <span className="text-indigo-400 font-bold">•</span>
                          <span>Margem Líquida: <strong className="text-white font-bold">{computedTotals.margin.toFixed(1)}%</strong></span>
                        </div>
                      </div>
                      <div className="sm:text-right shrink-0 bg-white/5 sm:bg-white/10 px-4 py-2.5 rounded-xl border border-white/10">
                        <span className="text-[10px] font-bold text-indigo-200 block uppercase tracking-wider">
                          Valor Cobrado do Cliente
                        </span>
                        <span className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                          {formatCurrency(computedTotals.servicesPrice)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white tracking-tight">
                      Consolidação de Receitas (Entradas) e Despesas (Saídas)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Tabela detalhada de consolidação */}
                    <div className="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
                      <div className="flex justify-between items-center">
                        <h5 className="text-[10px] font-black text-gray-400 tracking-wider">
                          Detalhamento Financeiro
                        </h5>
                      </div>

                      <div className="flex justify-between items-center text-xs py-1.5 border-b border-gray-100 dark:border-gray-800/60">
                        <span className="text-gray-500 font-medium">
                          Serviços e Mão de Obra (Receita / Entrada):
                        </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(computedTotals.servicesPrice)}
                        </span>
                      </div>

                      <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800/60">
                        <span className="text-gray-500 font-medium">
                          Peças e Materiais (Despesa / Saída):
                        </span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {formatCurrency(computedTotals.materialsCost)}
                        </span>
                      </div>

                      {computedTotals.deslocamento > 0 && (
                        <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800/60">
                          <span className="text-gray-500 font-medium">
                            Deslocamento e Logística (Despesa / Saída):
                          </span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {formatCurrency(computedTotals.deslocamento)}
                          </span>
                        </div>
                      )}

                      {computedTotals.pedagio > 0 && (
                        <div className="flex justify-between text-xs py-1.5 border-b border-gray-100 dark:border-gray-800/60">
                          <span className="text-gray-500 font-medium">
                            Pedágios (Despesa / Saída):
                          </span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {formatCurrency(computedTotals.pedagio)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs pt-2 mt-1 border-t-2 border-dashed border-gray-200 dark:border-gray-700 bg-rose-50/50 dark:bg-rose-950/20 px-3 py-2 rounded-xl">
                        <div>
                          <span className="text-rose-950 dark:text-rose-100 font-extrabold text-xs block">
                            Total de Custos / Despesas (Saídas):
                          </span>
                          <span className="text-[10px] text-rose-600/80 dark:text-rose-300/80">
                            Peças e Materiais + Deslocamento e Pedágios
                          </span>
                        </div>
                        <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                          {formatCurrency(computedTotals.cost)}
                        </span>
                      </div>
                    </div>

                    {/* Card de Indicador / Dashboard de Margem */}
                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-5 rounded-2xl border border-indigo-100/30 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <h5 className="text-[10px] font-black text-indigo-400 tracking-wider">
                            Margem de Lucro do Chamado
                          </h5>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={handleOpenMarginCalculator}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/80 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:hover:bg-indigo-900/80 rounded-lg transition-all shadow-xs"
                              title="Abrir calculadora para definir margem desejada"
                            >
                              <CalculatorIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Calcular Margem</span>
                            </button>
                          )}
                        </div>
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
                {activeTab !== "dados" && (
                  <>
                    <span className="block text-[8px] text-gray-400 font-black tracking-wider">
                      {activeTab === "servicos"
                        ? "Total em Serviços"
                        : activeTab === "materiais"
                        ? "Total Despesas (Peças + Deslocamento)"
                        : "Soma Final a Cobrar (Serviço + Peças + Deslocamento)"}
                    </span>
                    <span className={`text-sm font-black ${
                      activeTab === "servicos"
                        ? "text-purple-600 dark:text-purple-400"
                        : activeTab === "materiais"
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}>
                      {formatCurrency(
                        activeTab === "servicos"
                          ? computedTotals.servicesPrice
                          : activeTab === "materiais"
                          ? computedTotals.cost
                          : computedTotals.totalToCharge
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

      {/* Modal da Calculadora de Margem Desejada */}
      {isMarginCalculatorOpen && editingRecord && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl border border-gray-150 dark:border-gray-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white dark:from-emerald-950/30 dark:via-teal-950/10 dark:to-gray-900">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600 rounded-xl text-white shadow-md shadow-emerald-600/20">
                  <CalculatorIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-950 dark:text-white tracking-tight">
                    Calculadora de Margem de Lucro
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                    Ajuste o valor de Serviços e Mão de Obra para atingir a margem desejada
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMarginCalculatorOpen(false)}
                className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Resumo de Custos Atuais */}
              <div className="grid grid-cols-3 gap-2.5 bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl border border-gray-150 dark:border-gray-800 text-center">
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                    Despesas (Saídas)
                  </span>
                  <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                    {formatCurrency(marginCalculation.totalCost)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                    Receita Atual
                  </span>
                  <span className="text-xs font-black text-gray-800 dark:text-gray-200">
                    {formatCurrency(computedTotals.price)}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                    Margem Atual
                  </span>
                  <span className={`text-xs font-black ${computedTotals.margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {computedTotals.margin.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Input Margem Desejada (%) */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    Margem Líquida Desejada (%)
                  </label>
                  <span className="text-[10px] text-gray-400 font-medium">
                    (Lucro Líquido / Receita)
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="99.9"
                    value={targetMarginInput}
                    onChange={(e) => setTargetMarginInput(e.target.value)}
                    placeholder="Ex: 25"
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2.5 text-base font-extrabold text-emerald-600 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none pr-10 shadow-sm"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-gray-400">
                    %
                  </span>
                </div>

                {/* Chips de Atalhos */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] text-gray-400 font-semibold self-center mr-1">
                    Atalhos:
                  </span>
                  {["15", "20", "25", "30", "35", "40", "50"].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setTargetMarginInput(pct)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        targetMarginInput === pct
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Seleção do Serviço a ser alterado */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    Serviço e Mão de Obra para Ajustar
                  </label>
                  {(editingRecord.services || []).length > 1 && (
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                      Selecione qual item alterar
                    </span>
                  )}
                </div>

                {(editingRecord.services || []).length === 0 ? (
                  <div className="bg-amber-50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 space-y-2">
                    <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                      Nenhum serviço está cadastrado no momento. Um novo serviço será adicionado com o valor calculado:
                    </p>
                    <input
                      type="text"
                      value={newServiceNameForMargin}
                      onChange={(e) => setNewServiceNameForMargin(e.target.value)}
                      placeholder="Descrição do serviço (ex: Mão de Obra Técnica)"
                      className="w-full rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 p-2 text-xs font-medium text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                ) : (editingRecord.services || []).length === 1 ? (
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-800/60 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">
                        {editingRecord.services?.[0]?.description || "Serviço sem descrição"}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        Quantidade: {editingRecord.services?.[0]?.qty || 1}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-gray-400 block font-medium">Valor Atual</span>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        {formatCurrency(
                          (editingRecord.services?.[0]?.unitPrice || 0) * (editingRecord.services?.[0]?.qty || 1)
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {(editingRecord.services || []).map((srv, idx) => {
                      const isSelected = (selectedServiceIdForMargin || editingRecord.services?.[0]?.id) === srv.id;
                      return (
                        <button
                          key={srv.id || idx}
                          type="button"
                          onClick={() => setSelectedServiceIdForMargin(srv.id)}
                          className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 shadow-sm ring-1 ring-emerald-500"
                              : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/80"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? "border-emerald-600 bg-emerald-600" : "border-gray-300 dark:border-gray-600"
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs font-bold truncate ${isSelected ? "text-emerald-900 dark:text-emerald-200" : "text-gray-800 dark:text-gray-200"}`}>
                                {srv.description || `Serviço ${idx + 1}`}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                Quantidade: {srv.qty || 1}
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[9px] text-gray-400 block font-medium">Valor Atual</span>
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                              {formatCurrency(srv.unitPrice * (srv.qty || 1))}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Simulação em Tempo Real */}
              <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-indigo-500/10 dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-indigo-950/30 p-4.5 rounded-2xl border border-emerald-500/20 space-y-3">
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                      Novo Valor Sugerido do Serviço
                    </span>
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-300">
                      {formatCurrency(marginCalculation.neededServicePrice)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block">
                      Margem Resultante
                    </span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {marginCalculation.simulatedMargin.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-500/20 grid grid-cols-2 gap-2 text-[11px] text-gray-600 dark:text-gray-300">
                  <div className="flex justify-between">
                    <span>Receita (Serviços):</span>
                    <strong className="text-gray-900 dark:text-white">
                      {formatCurrency(marginCalculation.simulatedTotalRevenue)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Lucro Estimado:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(marginCalculation.simulatedProfit)}
                    </strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-500/10 flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-700 dark:text-gray-200">
                    Novo Total a Cobrar (Serviço + Peças):
                  </span>
                  <strong className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(marginCalculation.simulatedTotalRevenue + computedTotals.materialsCost)}
                  </strong>
                </div>

                {marginCalculation.warning && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                    {marginCalculation.warning}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/40 border-t border-gray-150 dark:border-gray-800 flex justify-end items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMarginCalculatorOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-xs transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyMarginToService}
                disabled={!marginCalculation.isValid}
                className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SaveIcon className="w-4 h-4" />
                <span>Aplicar no Serviço</span>
              </button>
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
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal da Calculadora de Deslocamento */}
      {showDistanceModal && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-2xl shadow-2xl border border-gray-150 dark:border-gray-800 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gradient-to-r from-indigo-50 via-blue-50/40 to-white dark:from-indigo-950/30 dark:via-gray-850 dark:to-gray-900">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600 rounded-xl text-white shadow-md shadow-indigo-600/20">
                  <span className="text-base">🚗</span>
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-950 dark:text-white tracking-tight">
                    Calculadora de Deslocamento
                  </h3>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                    Calcule distâncias e custos com base no instalador e endereço da obra
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDistanceModal(false)}
                className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 p-1.5 rounded-lg transition-colors"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 font-sans text-xs">
              <p className="text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                Selecione o parceiro para obter seu endereço base e confirme o CEP ou endereço do cliente para calcular a quilometragem ideal.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Installer Selection */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1 tracking-wide">
                    Selecione o Instalador *
                  </label>
                  <select
                    value={calcInstaladorId}
                    onChange={(e) => {
                      const instId = e.target.value;
                      setCalcInstaladorId(instId);
                      const sel = instaladores.find((i: any) => i.id === instId);
                      if (sel) {
                        setCalcValorKm(String(systemKmValue || 1.20));
                      }
                    }}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="">-- Escolha um Instalador --</option>
                    {instaladores.map((i: any) => (
                      <option key={i.id} value={i.id}>
                        {i.nome}
                      </option>
                    ))}
                  </select>
                  {calcInstaladorId && (
                    <p className="mt-1.5 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1">
                      <span>📍 Origem:</span>
                      <span className="underline">
                        {(() => {
                          const sel = instaladores.find((i: any) => i.id === calcInstaladorId);
                          return sel ? `${sel.endereco || ""}${sel.numero ? `, ${sel.numero}` : ""}, ${sel.cidade || ""}/${sel.uf || ""} (CEP: ${sel.cep || ""})` : "";
                        })()}
                      </span>
                    </p>
                  )}
                </div>

                {/* Customer Address */}
                <div className="sm:col-span-2 border-t pt-3 dark:border-gray-800">
                  <h5 className="font-black text-gray-700 dark:text-gray-300 mb-2 tracking-wide text-[10px] uppercase">
                    Endereço de Destino (Cliente)
                  </h5>
                </div>

                {/* CEP */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1 tracking-wide">
                    CEP do Cliente
                  </label>
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
                      className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    {isLoadingCalcCep && (
                      <span className="absolute right-3 top-2.5 text-[9px] font-bold text-indigo-500 animate-pulse">
                        Buscando...
                      </span>
                    )}
                  </div>
                </div>

                {/* Number */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1 tracking-wide">
                    Número
                  </label>
                  <input
                    type="text"
                    placeholder="Nº Ex: 123"
                    value={calcNumero}
                    onChange={(e) => setCalcNumero(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* Street/Rua */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1 tracking-wide">
                    Rua / Logradouro *
                  </label>
                  <input
                    type="text"
                    placeholder="Nome da rua"
                    value={calcRua}
                    onChange={(e) => setCalcRua(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                {/* City / UF */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1 tracking-wide">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={calcCidade}
                    onChange={(e) => setCalcCidade(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1 tracking-wide">
                    UF *
                  </label>
                  <input
                    type="text"
                    placeholder="UF"
                    maxLength={2}
                    value={calcUf}
                    onChange={(e) => setCalcUf(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase"
                  />
                </div>
              </div>

              {/* Botão de Calcular Rota */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={isCalculatingDistance}
                  onClick={handleCalculateGoogleDistance}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer w-full sm:w-auto"
                >
                  {isCalculatingDistance ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Calculando Rota...</span>
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>Calcular Rota (Google Maps / OSRM)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Parâmetros de Viagem */}
              <div className="border border-indigo-100 dark:border-indigo-950/45 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-xl p-4 space-y-3 font-sans">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-extrabold leading-none mb-1.5">
                      Distância (Ida)
                    </span>
                    <div className="flex items-center gap-2 mb-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="Distância em KM"
                        value={calcDistanceKm === null ? "" : calcDistanceKm}
                        onChange={(e) => setCalcDistanceKm(e.target.value === "" ? null : parseFloat(e.target.value))}
                        className="w-full rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-950/40 p-1.5 text-center font-bold text-xs text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <span className="font-extrabold text-xs text-gray-500 shrink-0">KM</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={calcIdaVolta}
                        onChange={(e) => setCalcIdaVolta(e.target.checked)}
                        className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3"
                      />
                      <span className="font-bold text-[9px] text-gray-500 dark:text-gray-400">Considerar Ida e Volta</span>
                    </label>
                  </div>

                  <div>
                    <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-extrabold leading-none mb-1.5">
                      Valor por Km
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-indigo-500">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="1.20"
                        value={calcValorKm}
                        onChange={(e) => setCalcValorKm(e.target.value)}
                        className="w-full rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-950/40 p-1.5 text-center font-bold text-xs text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-extrabold leading-none mb-1.5">
                      Dias de Viagem
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={calcDiasViagem}
                      onChange={(e) => setCalcDiasViagem(parseInt(e.target.value) || 1)}
                      className="w-full rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-950/40 p-1.5 text-center font-bold text-xs text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-indigo-100/50 dark:border-indigo-900/40 flex flex-wrap gap-4">
                  <div className="w-40">
                    <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-extrabold leading-none mb-1.5">
                      Hotel / Hospedagem
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold text-indigo-500">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={calcHotel}
                        onChange={(e) => setCalcHotel(e.target.value)}
                        className="w-full rounded-lg border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-950/40 p-1.5 text-center font-bold text-xs text-indigo-700 dark:text-indigo-300 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                </div>

                {calcDistanceKm !== null && (
                  <div className="pt-2 border-t border-indigo-100/50 dark:border-indigo-900/40 flex flex-col gap-1 bg-white/60 dark:bg-gray-950/40 p-2.5 rounded-lg">
                    <div className="flex justify-between text-[11px] text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Custo de Deslocamento:</span>
                      <span className="font-bold">
                        {calcDistanceKm} KM × R$ {parseFloat(calcValorKm || "0").toFixed(2)} {calcIdaVolta ? "× 2 (Ida/Volta)" : ""} {calcDiasViagem > 1 ? `× ${calcDiasViagem} dias` : ""} = R$ {((calcDistanceKm || 0) * (parseFloat(calcValorKm) || 0) * (calcIdaVolta ? 2 : 1) * calcDiasViagem).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    {parseFloat(calcHotel || "0") > 0 && (
                      <div className="flex justify-between text-[11px] text-gray-600 dark:text-gray-300">
                        <span className="font-medium">Hotel/Hospedagem:</span>
                        <span className="font-bold">R$ {parseFloat(calcHotel || "0").toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {parseFloat(calcMargem || "0") > 0 && (
                      <div className="flex justify-between text-[11px] text-indigo-600 dark:text-indigo-400">
                        <span className="font-medium">Acréscimo de Margem (+{calcMargem}%):</span>
                        <span className="font-bold">
                          R$ {((((calcDistanceKm || 0) * (parseFloat(calcValorKm) || 0) * (calcIdaVolta ? 2 : 1) * calcDiasViagem) + (parseFloat(calcHotel) || 0)) * (parseFloat(calcMargem) / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Total do Reembolso */}
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 tracking-wide block">
                    Valor Total do Deslocamento
                  </span>
                  <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 block">
                    Base + Hotel + Margem acrescida
                  </span>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800 rounded-xl shadow-xs">
                    <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-400">Margem:</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={calcMargem}
                      onChange={(e) => setCalcMargem(e.target.value)}
                      className="w-12 text-center text-xs font-black text-emerald-700 dark:text-emerald-300 outline-none border-none p-0 bg-transparent"
                      placeholder="0"
                    />
                    <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-400">%</span>
                  </div>
                  <span className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    R$ {((((calcDistanceKm || 0) * (parseFloat(calcValorKm) || 0) * (calcIdaVolta ? 2 : 1) * calcDiasViagem) + (parseFloat(calcHotel) || 0)) * (1 + (parseFloat(calcMargem) || 0) / 100)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-2.5 p-4 border-t border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
              <button
                type="button"
                onClick={() => setShowDistanceModal(false)}
                className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-300 dark:hover:bg-gray-750 transition-all text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={calcDistanceKm === null}
                onClick={handleApplyCalculatedDistance}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer text-center"
              >
                Aplicar no Deslocamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Memorial de Cálculo */}
      {showMemorialModal && memorialData && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl border border-gray-150 dark:border-gray-800 flex flex-col overflow-hidden max-h-[85vh]">
            <div className="px-5 py-3.5 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/20">
              <h3 className="text-sm font-black text-gray-950 dark:text-white tracking-tight">
                Memorial de Cálculo de Deslocamento
              </h3>
              <button
                type="button"
                onClick={() => setShowMemorialModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 font-sans text-xs overflow-y-auto">
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-100/50 dark:border-indigo-900/40">
                <span className="block text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider mb-2">
                  Parâmetros do Deslocamento
                </span>
                <div className="space-y-1.5 text-gray-700 dark:text-gray-300">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Parceiro Instalador:</span>
                    <strong className="text-gray-800 dark:text-white">{memorialData.instaladorNome}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Distância Calculada (Ida):</span>
                    <strong className="text-gray-800 dark:text-white">{memorialData.distancia} KM</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Considerar Ida e Volta:</span>
                    <strong className="text-gray-800 dark:text-white">{memorialData.idaVolta ? "Sim (× 2)" : "Não"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Dias de Viagem/Trabalho:</span>
                    <strong className="text-gray-800 dark:text-white">{memorialData.dias} {memorialData.dias > 1 ? "dias" : "dia"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valor por KM:</span>
                    <strong className="text-gray-800 dark:text-white">R$ {memorialData.valorKm.toFixed(2)}</strong>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/40 p-3.5 rounded-xl border border-gray-200/50 dark:border-gray-700/50 space-y-2">
                <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-extrabold uppercase tracking-wider mb-1">
                  Fórmula de Cálculo
                </span>
                <div className="flex justify-between items-start">
                  <span className="text-gray-500">Custo Base:</span>
                  <div className="text-right">
                    <strong className="text-gray-800 dark:text-white block">
                      R$ {(memorialData.distancia * memorialData.valorKm * (memorialData.idaVolta ? 2 : 1) * memorialData.dias).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                    <span className="text-[9px] text-gray-400 font-mono">
                      ({memorialData.distancia} KM × R$ {memorialData.valorKm.toFixed(2)} {memorialData.idaVolta ? "× 2" : ""} {memorialData.dias > 1 ? `× ${memorialData.dias} dias` : ""})
                    </span>
                  </div>
                </div>
                {memorialData.hotel > 0 && (
                  <div className="flex justify-between pt-1 border-t border-dashed border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500">Hotel / Hospedagem:</span>
                    <strong className="text-gray-800 dark:text-white">
                      R$ {memorialData.hotel.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>
                )}
                {memorialData.margem > 0 && (
                  <div className="flex justify-between pt-1 border-t border-dashed border-gray-200 dark:border-gray-700">
                    <span className="text-gray-500">Margem Aplicada:</span>
                    <strong className="text-indigo-600 dark:text-indigo-400">+{memorialData.margem}%</strong>
                  </div>
                )}
              </div>

              <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-200/50 dark:border-amber-900/30 flex justify-between items-center">
                <div>
                  <span className="block text-[9px] text-amber-700 dark:text-amber-400 font-extrabold uppercase tracking-wider">
                    Custo Final de Deslocamento
                  </span>
                  <span className="text-[10px] text-gray-400">Valor aplicado ao chamado</span>
                </div>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                  R$ {memorialData.valorFinal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMemorialModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors"
              >
                Fechar Memorial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes de Pedágios */}
      {showTollsModal && tollsModalData && (
        <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl shadow-2xl border border-gray-150 dark:border-gray-800 flex flex-col overflow-hidden max-h-[85vh]">
            <div className="px-5 py-3.5 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/20">
              <h3 className="text-sm font-black text-gray-950 dark:text-white tracking-tight">
                Consulta de Pedágio por Trecho
              </h3>
              <button
                type="button"
                onClick={() => setShowTollsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 font-sans text-xs overflow-y-auto">
              <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-xl border border-indigo-100/50 dark:border-indigo-900/40 space-y-1.5">
                <span className="block text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold uppercase tracking-wider mb-2">
                  Simulação de Rota
                </span>
                <div className="flex justify-between">
                  <span className="text-gray-500">Origem (Instalador):</span>
                  <strong className="text-gray-800 dark:text-white">{tollsModalData.origemCidade}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Destino (Cliente):</span>
                  <strong className="text-gray-800 dark:text-white">{tollsModalData.destinoCidade}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Distância Estimada (Ida):</span>
                  <strong className="text-gray-800 dark:text-white">{tollsModalData.distancia.toFixed(1)} KM</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Considerar Ida e Volta:</span>
                  <strong className="text-gray-800 dark:text-white">{tollsModalData.idaVolta ? "Sim (× 2)" : "Não"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dias de Trabalho:</span>
                  <strong className="text-gray-800 dark:text-white">{tollsModalData.dias} {tollsModalData.dias > 1 ? "dias" : "dia"}</strong>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/40 p-3.5 rounded-xl border border-gray-200/50 dark:border-gray-800">
                <span className="block text-[10px] text-gray-500 dark:text-gray-400 font-extrabold tracking-wider mb-2">
                  Praças de Pedágio Estimadas no Trecho
                </span>
                {tollsModalData.praçasLista.length === 0 ? (
                  <p className="text-gray-450 italic text-center py-2 text-[11px]">
                    Nenhum pedágio estimado para rotas menores que 25 KM.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {tollsModalData.praçasLista.map((pl: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-150 dark:border-gray-700">
                        <div>
                          <p className="font-bold text-[11px] text-gray-800 dark:text-gray-200">{pl.name}</p>
                          <p className="text-[9px] text-gray-400">{pl.location}</p>
                        </div>
                        <span className="font-black text-xs text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(pl.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Custo Total Estimado de Pedágios:
                </span>
                <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(tollsModalData.custoTotal)}
                </span>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-150 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTollsModal(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors"
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
