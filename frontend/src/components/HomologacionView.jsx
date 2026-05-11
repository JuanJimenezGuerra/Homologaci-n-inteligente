import React, { useState, useEffect, useRef } from 'react';
import { Link2, Play, Loader2, AlertCircle, Building2, MapPin, User, Edit2, Check, X, MessageSquare, RefreshCw, ArrowRight, Calendar, Phone, Mail, Package, Users, DollarSign, FileText, Activity, Briefcase, Target, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = (import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com').replace(/\/$/, '');

const STATUS_STYLES = {
  homologado: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
  sugerido: 'bg-purple-100 text-purple-700 border border-purple-300',
  procesando: 'bg-blue-100 text-blue-700 border border-blue-300 animate-pulse',
  sin_coincidencia: 'bg-amber-100 text-amber-700 border border-amber-300',
  pendiente: 'bg-slate-100 text-slate-600 border border-slate-200',
  error: 'bg-red-100 text-red-700 border border-red-300',
  buscado_en_internet: 'bg-cyan-100 text-cyan-700 border border-cyan-300',
};

const StatusBadge = ({ estado }) => {
  const key = (estado || 'pendiente').toLowerCase().replace(/ /g, '_');
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLES[key] || STATUS_STYLES.pendiente}`}>
      {estado || 'PENDIENTE'}
    </span>
  );
};

const DataField = ({ label, value, icon: Icon }) => {
  if (!value) return null;
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={13} className="text-slate-400 shrink-0" />}
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide">{label}</p>
      </div>
      <p className="font-semibold text-forest text-sm">{value}</p>
    </div>
  );
};

function HomologacionView({ empresaId, onComplete }) {
  const [cargos, setCargos] = useState([]);
  const [empresaData, setEmpresaData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [observaciones, setObservaciones] = useState('');
  const [selectedCargoIds, setSelectedCargoIds] = useState(new Set());
  const [searchingInternet, setSearchInternet] = useState(false);
  const [searchingIds, setSearchingIds] = useState(new Set());
  const [showConfirmValoracion, setShowConfirmValoracion] = useState(false);

  const [progress, setProgress] = useState(null);
  const [liveCargos, setLiveCargos] = useState([]);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    if (empresaId) loadData();
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [empresaId]);

  // Cargar información salarial de la empresa
  useEffect(() => {
    if (empresaId && cargos.length > 0) {
      // Los datos salariales ya vienen en el upload, pero podemos cargar más detalles
      const loadSalarios = async () => {
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${API}/uploads/${empresaId}/empresa`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setEmpresaData(prev => ({ ...prev, ...data }));
          }
        } catch (e) {
          console.warn('Error cargando datos salariales:', e);
        }
      };
      loadSalarios();
    }
  }, [empresaId, cargos.length]);

  // Notificar al padre cuando cambien los cargos
  useEffect(() => {
    if (onComplete && cargos.length > 0) {
      // Solo notificar si hay al menos algunos homologados
      const homologados = cargos.filter(c => c.estado === 'homologado' || c.estado === 'HOMOLOGADO' || c.estado === 'sugerido' || c.estado === 'SUGERIDO');
      if (homologados.length > 0) {
        // Guardar en localStorage para persistencia
        try { localStorage.setItem('shr_cargos_homologacion', JSON.stringify(cargos)); } catch {}
      }
    }
  }, [cargos, onComplete]);

  const handleIrValoracion = () => {
    setShowConfirmValoracion(true);
  };

  const confirmarIrValoracion = () => {
    setShowConfirmValoracion(false);
    
    // Guardar datos en localStorage para persistencia
    try {
      localStorage.setItem('shr_cargos_homologacion', JSON.stringify(cargos));
      if (empresaData) {
        localStorage.setItem('shr_empresa_data', JSON.stringify(empresaData));
      }
    } catch (e) {
      console.warn('Error guardando datos para valoración:', e);
    }
    
    // Guardar datos y pasar a valoración (sin descargar)
    if (onComplete) onComplete(cargos);
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('token');

    try {
      const [empRes, cargosRes] = await Promise.all([
        fetch(`${API}/uploads/${empresaId}/empresa`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/uploads/${empresaId}/cargos`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (empRes.ok) setEmpresaData(await empRes.json());
      if (cargosRes.ok) {
        const loadedCargos = await cargosRes.json();
        setCargos(loadedCargos);
        return loadedCargos;
      }
    } catch (e) {
      setError('Error al cargar datos: ' + e.message);
    } finally {
      setLoading(false);
    }
    return null;
  };

  const startPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const token = localStorage.getItem('token');
        const [statusRes, resultsRes] = await Promise.all([
          fetch(`${API}/homologacion/status/${empresaId}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/homologacion/results/${empresaId}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (statusRes.ok) {
          const status = await statusRes.json();
          setProgress(status);

          if (status.status === 'completado') {
            clearInterval(pollIntervalRef.current);
            setProcessing(false);
            setReprocessing(false);
            const loadedCargos = await loadData();
            if (loadedCargos) {
              const h = loadedCargos.filter(c => (c.estado || '').toLowerCase() === 'homologado').length;
              const s = loadedCargos.filter(c => (c.estado || '').toLowerCase() === 'sugerido').length;
              const sc = loadedCargos.filter(c => (c.estado || '').toLowerCase().includes('sin_coincidencia')).length;
              setMensaje(`Homologacion completada: ${h} matchs exactos, ${s} sugeridos IA, ${sc} sin coincidencia`);
            }
          }
        }

        if (resultsRes.ok) {
          setLiveCargos(await resultsRes.json());
        }
      } catch (e) {
        // Silent
      }
    }, 1500);
  };

  const ejecutarHomologacion = async () => {
    const token = localStorage.getItem('token');
    setProcessing(true);
    setError('');
    setMensaje('Iniciando homologacion...');
    setProgress(null);

    try {
      const res = await fetch(`${API}/homologacion/ejecutar?upload_id=${empresaId}&usar_ia=true`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        setMensaje('Homologacion en proceso...');
        startPolling();
      } else {
        const text = await res.text();
        setError(`Error ${res.status}: ${text.slice(0, 200)}`);
        setProcessing(false);
      }
    } catch (e) {
      setError('Error: ' + e.message);
      setProcessing(false);
    }
  };

  const reprocesarHomologacion = async () => {
    if (!observaciones.trim()) {
      setError('Escribe observaciones antes de reprocesar.');
      return;
    }

    const token = localStorage.getItem('token');
    setReprocessing(true);
    setError('');
    setMensaje('Iniciando reproceso...');
    setProgress(null);

    const body = { observaciones: observaciones.trim() };
    if (selectedCargoIds.size > 0) {
      body.cargo_ids = Array.from(selectedCargoIds);
    }

    try {
      const res = await fetch(`${API}/homologacion/reprocesar?upload_id=${empresaId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setMensaje(data.mensaje);
        startPolling();
      } else {
        const text = await res.text();
        setError(`Error ${res.status}: ${text.slice(0, 200)}`);
        setReprocessing(false);
      }
    } catch (e) {
      setError('Error: ' + e.message);
      setReprocessing(false);
    }
  };

  const handleEdit = (cargoId, currentValue) => {
    setEditingId(cargoId);
    setEditValue(currentValue || '');
  };

  const handleSaveEdit = async (cargoId) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/cargos/${cargoId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ cargo_homologado: editValue, justificacion: 'Editado manualmente por analista' }),
      });
      if (res.ok) { setEditingId(null); await loadData(); }
    } catch (e) {
      setError('Error al guardar: ' + e.message);
    }
  };

  const toggleCargoSelection = (cargoId) => {
    setSelectedCargoIds(prev => {
      const next = new Set(prev);
      if (next.has(cargoId)) next.delete(cargoId);
      else next.add(cargoId);
      return next;
    });
  };

  const selectAllReprocessable = () => {
    const ids = safeDisplayCargos.filter(item => item.estado !== 'HOMOLOGADO' && item.estado !== 'homologado').map(item => item.id);
    setSelectedCargoIds(new Set(ids));
  };

  const clearSelection = () => setSelectedCargoIds(new Set());

  const buscarInternet = async (cargoId) => {
    setSearchingIds(prev => new Set(prev).add(cargoId));
    try {
      const res = await fetch(`${API}/homologacion/${cargoId}/buscar-internet`, { method: 'POST' });
      if (res.ok) {
        await loadData();
      } else {
        const text = await res.text();
        setError(`Error en busqueda: ${text.slice(0, 200)}`);
      }
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
      setSearchingIds(prev => { const next = new Set(prev); next.delete(cargoId); return next; });
    }
  };

  const buscarInternetLote = async () => {
    const sinCoincidenciaIds = safeDisplayCargos.filter(c =>
      (c.estado || '').toLowerCase().includes('sin_coincidencia')
    ).map(c => c.id);

    if (sinCoincidenciaIds.length === 0) {
      setError('No hay cargos SIN COINCIDENCIA para buscar');
      return;
    }

    console.log('[Internet] Iniciando busqueda para', sinCoincidenciaIds.length, 'cargos');
    setSearchInternet(true);
    setSearchingIds(new Set(sinCoincidenciaIds));
    setError('');
    setMensaje('');
    try {
      const res = await fetch(`${API}/homologacion/buscar-internet-lote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cargo_ids: sinCoincidenciaIds }),
      });
      const data = await res.json();
      console.log('[Internet] Resultado:', data);
      if (res.ok) {
        setMensaje(`Busqueda completada: ${data.procesados} procesados, ${data.errores} errores`);
        await loadData();
      } else {
        setError(`Error en busqueda masiva: ${data.detail || 'Error desconocido'}`);
      }
    } catch (e) {
      console.error('[Internet] Error:', e);
      setError('Error: ' + e.message);
    } finally {
      setSearchInternet(false);
      setSearchingIds(new Set());
    }
  };

  // Columnas visibles (para colapsar)
  const [visibleCols, setVisibleCols] = useState({
    cargo: true,
    area: true,
    estado: true,
    homologado: true,
    justificacion: true,
    salario: true, // Show salary from formulario data
    acciones: true,
  });

  const toggleCol = (col) => setVisibleCols(prev => ({ ...prev, [col]: !prev[col] }));

  const normalizeStatus = (s) => (s || '').toLowerCase().replace(/[_\s-]+/g, '_');
  const displayCargos = (processing && liveCargos.length > 0 ? liveCargos : cargos).filter(c => {
    const matchSearch = (c.nombre_cargo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.area || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.homologacion?.cargo_homologado || '').toLowerCase().includes(searchTerm.toLowerCase());
    const statusVal = normalizeStatus(c.estado);
    const filterVal = normalizeStatus(filterStatus);
    const matchFilter = filterStatus === 'all' || statusVal === filterVal;
    return matchSearch && matchFilter;
  });

  // Defensive: ensure displayCargos is an array
  const safeDisplayCargos = Array.isArray(displayCargos) ? displayCargos : [];

  const stats = {
    total: safeDisplayCargos.length,
    homologados: safeDisplayCargos.filter(item => (item.estado || '').toLowerCase() === 'homologado').length,
    sugeridos: safeDisplayCargos.filter(item => (item.estado || '').toLowerCase() === 'sugerido').length,
    pendientes: safeDisplayCargos.filter(item => ['pendiente', 'procesando'].includes((item.estado || '').toLowerCase())).length,
    sin_coincidencia: safeDisplayCargos.filter(item => (item.estado || '').toLowerCase().includes('sin_coincidencia')).length,
    buscados_internet: safeDisplayCargos.filter(item => (item.estado || '').toLowerCase().includes('buscado_en_internet')).length,
  };

  const formatCurrency = (val) => {
    if (!val) return null;
    return `$${Number(val).toLocaleString('es-CO')}`;
  };

   const formatDate = (dateStr) => {
     if (!dateStr) return null;
     try { return new Date(dateStr).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }); }
     catch { return dateStr; }
   };

   if (loading && safeDisplayCargos.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-primary">
        <Loader2 className="animate-spin" size={24} />
        <span className="font-medium">Cargando datos...</span>
      </div>
    );
  }

  if (safeDisplayCargos.length === 0 && !loading && !processing) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No hay datos</h2>
          <p className="text-slate-600 mb-4">Primero carga el archivo de requerimientos en la pestana "Formulario"</p>
          {error && <p className="text-red-500">{error}</p>}
        </div>
      </div>
    );
  }

  // Helper to check if empresa has any data to display
  const hasEmpresaData = empresaData && Object.values(empresaData).some(v => v != null && v !== '' && v !== 'id');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ============ EMPRESA: TODOS LOS DATOS BASICOS ============ */}
      {hasEmpresaData && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-forest to-primary px-6 py-4">
            <div className="flex items-center gap-3">
              <Building2 className="text-white w-6 h-6" />
              <div>
                <h2 className="text-lg font-bold text-white">{empresaData.nombre_empresa || 'Empresa'}</h2>
                {empresaData.razon_social && empresaData.razon_social !== empresaData.nombre_empresa && (
                  <p className="text-xs text-white/70">{empresaData.razon_social}</p>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Fila 1: Datos principales */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <DataField label="NIT" value={empresaData.nit} />
              <DataField label="Tipo de Empresa" value={empresaData.tipo_empresa} />
              <DataField label="Sector Economico" value={empresaData.sector_economico} />
              <DataField label="Actividad Economica" value={empresaData.actividad_economica} />
              <DataField label="Direccion" value={empresaData.direccion} />
            </div>

            {/* Fila 2: Ubicacion y contacto */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {(empresaData.ciudad || empresaData.departamento) && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin size={13} className="text-slate-400 shrink-0" />
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide">Ubicacion</p>
                  </div>
                  <p className="font-semibold text-forest text-sm">{[empresaData.ciudad, empresaData.departamento].filter(Boolean).join(', ')}</p>
                </div>
              )}
              {empresaData.persona_contacto && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <User size={13} className="text-slate-400 shrink-0" />
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide">Persona que diligencia</p>
                  </div>
                  <p className="font-semibold text-forest text-sm">{empresaData.persona_contacto}</p>
                  {empresaData.cargo_contacto && <p className="text-[10px] text-slate-400 mt-0.5">{empresaData.cargo_contacto}</p>}
                </div>
              )}
              {empresaData.email_contacto && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail size={13} className="text-slate-400 shrink-0" />
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide">Email</p>
                  </div>
                  <p className="font-semibold text-forest text-sm truncate">{empresaData.email_contacto}</p>
                </div>
              )}
              {empresaData.telefono && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Phone size={13} className="text-slate-400 shrink-0" />
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide">Telefono</p>
                  </div>
                  <p className="font-semibold text-forest text-sm">{empresaData.telefono}</p>
                </div>
              )}
              {empresaData.telefono_contacto && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Phone size={13} className="text-slate-400 shrink-0" />
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wide">Tel. Contacto</p>
                  </div>
                  <p className="font-semibold text-forest text-sm">{empresaData.telefono_contacto}</p>
                </div>
              )}
            </div>

            {/* Fila 3: General adicional */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <DataField label="Fecha diligenciamiento" value={formatDate(empresaData.fecha_diligenciamiento)} icon={Calendar} />
              <DataField label="Consultor" value={empresaData.consultor} />
              <DataField label="Productos/Servicios" value={empresaData.principales_productos} icon={Package} />
              <DataField label="Motivacion" value={empresaData.motivacion} icon={Target} />
            </div>

            {/* Fila 4: Personal */}
            {(empresaData.num_personas_contratadas || empresaData.empleados_presenciales || empresaData.empleados_teletrabajo || empresaData.empleados_mixta || empresaData.tipos_contratos || empresaData.distribucion_contratos) && (
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500"></span> Personal
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                  {empresaData.num_personas_contratadas && (
                    <div className="bg-cyan-50 rounded-lg p-3 text-center border border-cyan-100">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Users size={14} className="text-cyan-500" />
                        <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-wide">Total</p>
                      </div>
                      <p className="font-black text-cyan-700 text-2xl">{empresaData.num_personas_contratadas}</p>
                    </div>
                  )}
                  {empresaData.empleados_presenciales && (
                    <div className="bg-cyan-50 rounded-lg p-3 text-center border border-cyan-100">
                      <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-wide">Presencial</p>
                      <p className="font-black text-cyan-700 text-2xl">{empresaData.empleados_presenciales}</p>
                    </div>
                  )}
                  {empresaData.empleados_teletrabajo && (
                    <div className="bg-cyan-50 rounded-lg p-3 text-center border border-cyan-100">
                      <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-wide">Teletrabajo</p>
                      <p className="font-black text-cyan-700 text-2xl">{empresaData.empleados_teletrabajo}</p>
                    </div>
                  )}
                  {empresaData.empleados_mixta && (
                    <div className="bg-cyan-50 rounded-lg p-3 text-center border border-cyan-100">
                      <p className="text-cyan-400 text-[10px] font-bold uppercase tracking-wide">Mixta</p>
                      <p className="font-black text-cyan-700 text-2xl">{empresaData.empleados_mixta}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <DataField label="Tipos de contratos" value={empresaData.tipos_contratos} icon={Briefcase} />
                  <DataField label="Distribucion de contratos" value={empresaData.distribucion_contratos} icon={FileText} />
                </div>
              </div>
            )}

            {/* Fila 5: Financieros */}
            {(empresaData.ventas_reales || empresaData.ingresos_reales || empresaData.excedentes_reales || empresaData.ventas_presupuestadas || empresaData.ingresos_presupuestados || empresaData.excedentes_presupuestados) && (
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> Financieros
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                  {empresaData.ventas_reales && (
                    <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <DollarSign size={12} className="text-amber-500" />
                        <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wide">Ventas Reales</p>
                      </div>
                      <p className="font-black text-amber-700 text-sm">{formatCurrency(empresaData.ventas_reales)}</p>
                    </div>
                  )}
                  {empresaData.ventas_presupuestadas && (
                    <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                      <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wide">Ventas Presup.</p>
                      <p className="font-black text-amber-700 text-sm">{formatCurrency(empresaData.ventas_presupuestadas)}</p>
                    </div>
                  )}
                  {empresaData.ingresos_reales && (
                    <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                      <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wide">Ingresos Reales</p>
                      <p className="font-black text-amber-700 text-sm">{formatCurrency(empresaData.ingresos_reales)}</p>
                    </div>
                  )}
                  {empresaData.ingresos_presupuestados && (
                    <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                      <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wide">Ingresos Presup.</p>
                      <p className="font-black text-amber-700 text-sm">{formatCurrency(empresaData.ingresos_presupuestados)}</p>
                    </div>
                  )}
                  {empresaData.excedentes_reales && (
                    <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                      <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wide">Excedentes Reales</p>
                      <p className="font-black text-amber-700 text-sm">{formatCurrency(empresaData.excedentes_reales)}</p>
                    </div>
                  )}
                  {empresaData.excedentes_presupuestados && (
                    <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                      <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wide">Excedentes Presup.</p>
                      <p className="font-black text-amber-700 text-sm">{formatCurrency(empresaData.excedentes_presupuestados)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ============ BARRA DE PROGRESO (solo una) ============ */}
      {processing && progress && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-lg p-4 border-2 border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-blue-600" size={20} />
              <div>
                <p className="font-bold text-forest text-sm">{progress.current_batch || 'Procesando...'}</p>
                {progress.current_cargo && <p className="text-xs text-slate-500">Actual: <span className="font-semibold text-forest">{progress.current_cargo}</span></p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-blue-700">{progress.processed || 0}<span className="text-sm text-slate-400 font-medium">/{progress.total}</span></p>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3 overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(100, ((progress.processed || 0) / (progress.total || 1)) * 100)}%` }} transition={{ duration: 0.3 }} />
          </div>
          <div className="flex gap-4 text-xs">
             <span className="flex items-center gap-1 text-blue-600 font-bold"><Activity size={12} /> Consultando IA ({Math.max(0, (progress.total || 0) - (progress.processed || 0))} cargos restantes)</span>
           </div>
          {progress.recent_results && progress.recent_results.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Ultimos resultados:</p>
              <div className="flex gap-2 overflow-x-auto pb-1 max-h-14 overflow-y-auto">
                {progress.recent_results.slice(-10).reverse().map((r, idx) => (
                  <div key={`${r.id}-${idx}`} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${r.tipo === 'exacto' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : r.tipo === 'ia' || r.tipo === 'reproceso' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    <span className="font-bold">{r.nombre_cargo}</span>
                    <span className="mx-1">→</span>
                    <span>{r.cargo_homologado}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ============ STATS & CONTROLES ============ */}
      <div className="bg-white rounded-2xl shadow-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Link2 className="text-primary w-5 h-5" />
            <h3 className="font-bold text-forest">Homologacion de Cargos</h3>
            <div className="flex gap-2">
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{stats.total} Total</span>
              {stats.homologados > 0 && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{stats.homologados} Match</span>}
              {stats.sugeridos > 0 && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-full">{stats.sugeridos} Sugeridos</span>}
              {stats.pendientes > 0 && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">{stats.pendientes} Pend.</span>}
              {stats.sin_coincidencia > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{stats.sin_coincidencia} S/C</span>}
              {stats.buscados_internet > 0 && <span className="text-[10px] font-bold bg-cyan-100 text-cyan-700 px-2 py-1 rounded-full">{stats.buscados_internet} Internet</span>}
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="all">Todos</option>
              <option value="homologado">Match Exacto</option>
              <option value="sugerido">Sugeridos IA</option>
              <option value="pendiente">Pendientes</option>
              <option value="sin_coincidencia">Sin Coincidencia</option>
              <option value="buscado_en_internet">Buscados en Internet</option>
            </select>
            <input type="text" placeholder="Buscar cargo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 w-44" />
            <button onClick={ejecutarHomologacion} disabled={processing} className="flex items-center gap-2 bg-forest text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-primary transition-all disabled:opacity-70">
              {processing ? <Loader2 size={16} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
              {processing ? 'PROCESANDO...' : 'EJECUTAR HOMOLOGACION'}
            </button>
            {stats.sin_coincidencia > 0 && (
              <button onClick={buscarInternetLote} disabled={searchingInternet} className="flex items-center gap-2 bg-cyan-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-cyan-700 transition-all disabled:opacity-70">
                {searchingInternet ? <Loader2 size={16} className="animate-spin" /> : <Globe size={14} />}
                {searchingInternet ? 'BUSCANDO...' : `BUSCAR ${stats.sin_coincidencia} S/C EN INTERNET`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============ MENSAJES ============ */}
      <AnimatePresence>
        {mensaje && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <Check size={14} /> {mensaje}
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============ TABLA DE CARGOS ============ */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Controles de columnas */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {Object.entries(visibleCols).map(([col, visible]) => (
          <button
            key={col}
            onClick={() => toggleCol(col)}
            className={`text-[10px] px-2 py-1 rounded-full font-bold transition-all ${
              visible ? 'bg-forest text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            {col === 'cargo' ? 'Cargo' :
             col === 'area' ? 'Area' :
             col === 'estado' ? 'Estado' :
             col === 'homologado' ? 'Homologado' :
             col === 'justificacion' ? 'Justificacion' :
             col === 'salario' ? 'Salario' :
             col === 'acciones' ? 'Acc.' : col}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-forest text-white text-[10px] font-bold uppercase">
              <tr>
                <th className="px-3 py-3 w-8">#</th>
                {(processing || selectedCargoIds.size > 0) && (
                  <th className="px-3 py-3 w-8">
                    <input type="checkbox" checked={selectedCargoIds.size > 0 && safeDisplayCargos.filter(item => item.estado !== 'HOMOLOGADO' && item.estado !== 'homologado').length > 0 && selectedCargoIds.size === safeDisplayCargos.filter(item => item.estado !== 'HOMOLOGADO' && item.estado !== 'homologado').length} onChange={e => { if (e.target.checked) selectAllReprocessable(); else clearSelection(); }} className="rounded border-slate-300 text-primary focus:ring-primary" />
                  </th>
                )}
                {visibleCols.cargo && <th className="px-3 py-3 min-w-[200px]">Cargo</th>}
                {visibleCols.area && <th className="px-3 py-3 min-w-[100px]">Area</th>}
                {visibleCols.estado && <th className="px-3 py-3 w-28">Estado</th>}
                {visibleCols.homologado && <th className="px-3 py-3 min-w-[250px]">Cargo Homologado (editable)</th>}
                {visibleCols.justificacion && <th className="px-3 py-3 min-w-[180px]">Justificacion</th>}
                {visibleCols.salario && <th className="px-3 py-3 min-w-[120px]">Salario Actual</th>}
                {visibleCols.acciones && <th className="px-3 py-3 w-20">Acc.</th>}
              </tr>
            </thead>
                <tbody>
                {safeDisplayCargos.map((c, idx) => {
                  const h = c.homologacion || {};
                  const isEditing = editingId === c.id;
                  const isSelected = selectedCargoIds.has(c.id);
                  const isReprocessable = c.estado !== 'HOMOLOGADO' && c.estado !== 'homologado';
                  const isBuscadorInternet = (c.estado || '').toLowerCase().includes('buscado_en_internet');
                  const isSinCoincidencia = (c.estado || '').toLowerCase().includes('sin_coincidencia');
                  const isSearching = searchingIds.has(c.id);
                  
                   // Datos salariales del cargo (si existen en la empresa)
                   const salarioActual = c?.homologacion?.datos_excel?.real_pagado ||
                                   c?.homologacion?.datos_excel?.basico || null;
                  
                  return (
                    <tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-purple-50/60' : isBuscadorInternet ? 'bg-cyan-50/40' : c.estado?.toLowerCase() === 'sugerido' ? 'bg-purple-50/40' : isSinCoincidencia ? 'bg-amber-50/30' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="px-3 py-2.5 text-slate-300 font-mono text-center text-xs">{idx + 1}</td>
                      {(processing || selectedCargoIds.size > 0) && (
                        <td className="px-3 py-2.5 text-center">
                          {isReprocessable && <input type="checkbox" checked={isSelected} onChange={() => toggleCargoSelection(c.id)} className="rounded border-slate-300 text-primary focus:ring-primary" />}
                        </td>
                      )}
                      {visibleCols.cargo && <td className="px-3 py-2.5 font-semibold text-forest">{c.nombre_cargo}</td>}
                      {visibleCols.area && <td className="px-3 py-2.5 text-slate-500 text-xs">{c.area}</td>}
                      {visibleCols.estado && <td className="px-3 py-2.5"><StatusBadge estado={c.estado} /></td>}
                      {visibleCols.homologado && <td className="px-3 py-2.5">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(c.id); if (e.key === 'Escape') setEditingId(null); }} className="border border-primary rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Cargo homologado..." />
                            <button onClick={() => handleSaveEdit(c.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={13} /></button>
                            <button onClick={() => setEditingId(null)} className="p-1 text-red-400 hover:bg-red-50 rounded"><X size={13} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className={`text-xs ${isBuscadorInternet ? 'text-cyan-700 font-bold uppercase' : h.cargo_homologado && h.cargo_homologado !== 'SIN COINCIDENCIA' ? 'text-forest font-medium' : 'text-slate-300 italic'}`}>
                              {h.cargo_homologado || 'Sin homologar'}
                            </span>
                            <button onClick={() => handleEdit(c.id, h.cargo_homologado || '')} className="p-1 text-slate-300 hover:text-primary hover:bg-emerald-50 rounded" title="Editar"><Edit2 size={12} /></button>
                          </div>
                        )}
                      </td>}
                      {visibleCols.justificacion && <td className="px-3 py-2.5 text-slate-400 text-[10px] max-w-[200px]">
                        {isBuscadorInternet ? (
                          <div className="space-y-1">
                            <p className="text-cyan-600 font-medium truncate" title={h.justificacion}>{h.justificacion || '—'}</p>
                            {h.busqueda_internet_url && (
                              <a href={h.busqueda_internet_url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-500 hover:text-blue-700 flex items-center gap-1">
                                <Globe size={9} /> Ver búsqueda
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="truncate" title={h.justificacion}>{h.justificacion || '—'}</p>
                        )}
                      </td>}
                      {visibleCols.salario && <td className="px-3 py-2.5 text-xs text-slate-600">
                        {salarioActual ? `$${Number(salarioActual).toLocaleString('es-CO')}` : '—'}
                      </td>}
                      {visibleCols.salario && <td className="px-3 py-2.5 text-xs text-emerald-600 font-medium">
                        {salarioActual ? `$${Number(salarioActual).toLocaleString('es-CO')}` : '—'}
                      </td>}
                      {visibleCols.acciones && <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {isSinCoincidencia && !isBuscadorInternet && (
                            <button
                              onClick={() => buscarInternet(c.id)}
                              disabled={isSearching}
                              className="p-1 text-cyan-500 hover:text-cyan-700 hover:bg-cyan-50 rounded"
                              title="Buscar en internet"
                            >
                              {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Globe size={13} />}
                            </button>
                          )}
                          {!isEditing && <button onClick={() => handleEdit(c.id, h.cargo_homologado || '')} className="p-1 text-slate-400 hover:text-primary hover:bg-emerald-50 rounded" title="Editar"><Edit2 size={13} /></button>}
                        </div>
                      </td>}
                    </tr>
                  );
                })}
              </tbody>
          </table>
        </div>
        {safeDisplayCargos.length === 0 && <div className="p-8 text-center text-slate-400 text-sm">No hay cargos que coincidan con la busqueda</div>}
      </div>

      {/* ============ OBSERVACIONES + REPROCESAR ============ */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-lg p-6 border border-purple-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-50 rounded-xl"><MessageSquare className="text-purple-600" size={20} /></div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-forest">Observaciones del Analista</h3>
              <div className="group relative">
                <AlertCircle size={14} className="text-slate-400 cursor-help" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  Escribe instrucciones para que la IA reprocese las homologaciones. Usa los filtros rapidos para aplicar reglas comunes. Luego selecciona los cargos a reprocesar con los checkboxes en la tabla.
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">Describe ajustes o indicaciones para que la IA reprocese las homologaciones</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap text-xs items-center">
            <span className="text-slate-400 font-medium">Filtros rapidos:</span>
            <button onClick={() => setObservaciones(prev => prev + (prev ? '\n' : '') + 'Produccion → Operaciones: Los cargos de PRODUCCION deben buscarse en el area de OPERACIONES')} className="px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors border border-blue-200 text-[11px]">🔄 Produccion → Operaciones</button>
            <button onClick={() => setObservaciones(prev => prev + (prev ? '\n' : '') + 'Jefe/Coordinador → nivel superior: Los cargos con JEFE o COORDINADOR deben tener nivel jerarquico superior (GERENTE)')} className="px-2 py-1 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors border border-purple-200 text-[11px]">⬆️ Jefe/Coord → Nivel Sup.</button>
            <button onClick={() => setObservaciones(prev => prev + (prev ? '\n' : '') + 'Administrativo ≠ Tecnico: Los cargos ADMINISTRATIVOS no deben coincidir con cargos TECNICOS')} className="px-2 py-1 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors border border-amber-200 text-[11px]">⚠️ Admin ≠ Tecnico</button>
            <button onClick={() => setObservaciones(prev => prev + (prev ? '\n' : '') + 'Buscar SIN COINCIDENCIA en internet y dar sugerencia de homologacion')} className="px-2 py-1 bg-cyan-50 text-cyan-700 rounded hover:bg-cyan-100 transition-colors border border-cyan-200 text-[11px]">🌐 Buscar SIN COINCIDENCIA</button>
          </div>

          <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Ejemplo: Los cargos del area de Logistica deben homologarse con cargos del area de Cadena de Suministro. Jefe de Produccion debe ir a Gerencia de Operaciones..." rows={4} className="w-full border border-purple-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none bg-purple-50/30" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-400">
                {selectedCargoIds.size > 0 ? `${selectedCargoIds.size} cargos seleccionados` : `${stats.sin_coincidencia + stats.sugeridos} cargos disponibles`}
              </p>
              {selectedCargoIds.size > 0 && <button onClick={clearSelection} className="text-xs text-purple-500 hover:text-purple-700 font-bold">Limpiar seleccion</button>}
            </div>
            <button onClick={reprocesarHomologacion} disabled={reprocessing || !observaciones.trim()} className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
              {reprocessing ? <><Loader2 size={16} className="animate-spin" /> Reprocesando...</> : <><RefreshCw size={16} /> {selectedCargoIds.size > 0 ? `Reprocesar ${selectedCargoIds.size} seleccionados` : 'Reprocesar con IA'}</>}
            </button>
          </div>

          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
            <p className="text-[11px] text-purple-700 flex items-start gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span><strong className="font-bold">Recordatorio:</strong> Selecciona los cargos a reprocesar usando los checkboxes en la tabla. Luego escribe tus observaciones y haz clic en "Reprocesar con IA". Los filtros rapidos agregan instrucciones que la IA interpretara automaticamente.</span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* ============ NEXT STEP ============ */}
      {stats.homologados + stats.sugeridos > 0 && !processing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
          <button onClick={handleIrValoracion} className="flex items-center gap-2 bg-forest text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary transition-all shadow-lg">
            Ir a Valoración <ArrowRight size={16} />
          </button>
        </motion.div>
      )}

      {/* ============ MODAL CONFIRMACIÓN IR A VALORACIÓN ============ */}
      {showConfirmValoracion && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-forest mb-3">¿Confirmar ir a Valuación?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Al pasar a Valuación se descargará la hoja de información y se guardarán los datos de homologación.
              ¿Está seguro de continuar?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirmValoracion(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={confirmarIrValoracion} className="px-4 py-2 rounded-xl bg-forest text-white text-sm font-bold hover:bg-primary">
                Sí, continuar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default HomologacionView;
