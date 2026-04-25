import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Play, Download, Search, Edit2, ChevronDown, ChevronUp,
  FileSpreadsheet, Loader2, AlertCircle, Check, X, Eye, EyeOff,
  RefreshCw, Building, ArrowLeft, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const getToken = () => localStorage.getItem('token');
const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

const api = {
  get: (path) => axios.get(`${API}${path}`, { headers: authHeaders() }),
  post: (path, data) => axios.post(`${API}${path}`, data, { headers: authHeaders() }),
  put: (path, data) => axios.put(`${API}${path}`, data, { headers: authHeaders() }),
  patch: (path, data) => axios.patch(`${API}${path}`, data, { headers: authHeaders() }),
};

// ---- Status badge ----
const StatusBadge = ({ estado }) => {
  const s = (estado || '').toLowerCase();
  const map = {
    homologado: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    sugerido: 'bg-purple-100 text-purple-800 border-purple-300',
    procesando: 'bg-blue-100 text-blue-700 border-blue-300 animate-pulse',
    sin_coincidencia: 'bg-amber-100 text-amber-800 border-amber-300',
    error: 'bg-red-100 text-red-700 border-red-300',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${map[s] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {estado || 'PENDIENTE'}
    </span>
  );
};

// ---- Upload List Sidebar ----
const UploadList = ({ uploads, selectedUpload, onSelect }) => {
  if (!uploads.length) return (
    <div className="p-6 text-center text-slate-400 text-sm">
      No hay procesos aún.<br />
      <span className="font-bold text-primary">Crea uno nuevo</span> en "Nuevo Proceso".
    </div>
  );
  return (
    <div className="space-y-2 p-4">
      {uploads.map(u => (
        <button
          key={u.id}
          onClick={() => onSelect(u.id)}
          className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${
            selectedUpload === u.id
              ? 'bg-primary text-white border-primary shadow-md'
              : 'bg-white border-slate-100 hover:border-primary/40 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building size={14} className={selectedUpload === u.id ? 'text-white' : 'text-primary'} />
            <span className="font-bold truncate">{u.empresa || 'Sin empresa'}</span>
          </div>
          <p className={`text-[10px] mt-0.5 truncate ${selectedUpload === u.id ? 'text-white/70' : 'text-slate-400'}`}>
            {u.filename}
          </p>
          <p className={`text-[10px] ${selectedUpload === u.id ? 'text-white/60' : 'text-slate-300'}`}>
            #{u.id} · {u.status || 'pendiente'}
          </p>
        </button>
      ))}
    </div>
  );
};

// ---- Main DataFrame Table ----
const DataframeTable = ({
  cargos, upload, loading, processing,
  onProcess, onCancel, onDownload, onGoToValoracion,
  searchTerm, setSearchTerm,
  showMeta, setShowMeta,
  editingId, editValue, setEditValue, setEditingId,
  expandedId, setExpandedId,
  onEdit, onSaveEdit,
}) => {
  const filtered = cargos.filter(c =>
    c.nombre_cargo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.area?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: cargos.length,
    h: cargos.filter(c => ['homologado'].includes((c.estado || '').toLowerCase())).length,
    s: cargos.filter(c => ['sugerido'].includes((c.estado || '').toLowerCase())).length,
    p: cargos.filter(c => ['pendiente', ''].includes((c.estado || '').toLowerCase())).length,
    sc: cargos.filter(c => ['sin_coincidencia'].includes((c.estado || '').toLowerCase())).length,
  };

  // Columnas del excel (A-AS) si showMeta
  const metaKeys = cargos[0]?.homologacion?.datos_excel
    ? Object.keys(cargos[0].homologacion.datos_excel).slice(0, 10)
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl overflow-hidden border border-white/60 bg-white/80 shadow-xl"
    >
      {/* Controls */}
      <div className="p-4 border-b border-emerald-100 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet size={20} className="text-primary" />
          <div>
            <h3 className="font-bold text-forest text-sm">{upload?.empresa || 'DataFrame de Homologación'}</h3>
            <p className="text-xs text-slate-400">{upload?.filename} · {filtered.length} registros</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{stats.total} Total</span>
          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">{stats.h} ✓ Homologados</span>
          {stats.s > 0 && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-full">{stats.s} Sugeridos</span>}
          {stats.p > 0 && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">{stats.p} Pendientes</span>}
          {stats.sc > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{stats.sc} S/C</span>}

          <button
            onClick={() => setShowMeta(!showMeta)}
            className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${showMeta ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'}`}
          >
            {showMeta ? <EyeOff size={13} /> : <Eye size={13} />} {showMeta ? 'Ocultar' : 'Ver'} Datos
          </button>

          <div className="flex bg-forest rounded-lg overflow-hidden shadow-sm">
            <button
              onClick={onProcess}
              disabled={processing}
              className="flex items-center gap-1.5 text-white px-3 py-1.5 font-bold text-xs hover:bg-primary transition-all disabled:opacity-80"
            >
              {processing ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} fill="currentColor" />}
              {processing ? 'PROCESANDO...' : 'PROCESAR IA'}
            </button>
            {processing && (
              <button
                onClick={onCancel}
                className="flex items-center justify-center px-2.5 border-l border-white/20 text-red-200 hover:text-white hover:bg-red-500 transition-all"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {onGoToValoracion && upload && (
            <button
              onClick={() => onGoToValoracion(upload.id)}
              className="flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-purple-700 transition-all shadow-sm"
            >
              <BarChart2 size={12} /> Paso 2 · Valorar →
            </button>
          )}

          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 bg-white border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-emerald-50 transition-all shadow-sm"
          >
            <Download size={12} /> Descargar
          </button>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={13} />
            <input
              type="text"
              placeholder="Buscar cargo…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-white border border-emerald-100 rounded-xl py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 w-44"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center p-16 gap-3 text-primary">
          <Loader2 className="animate-spin" size={26} />
          <span className="font-medium text-sm">Cargando datos…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay cargos para mostrar</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-forest text-white text-[10px] font-bold uppercase sticky top-0">
              <tr>
                <th className="px-3 py-3 sticky left-0 bg-forest z-10">#</th>
                <th className="px-3 py-3 sticky left-6 bg-forest z-10 min-w-[180px]">Cargo</th>
                <th className="px-3 py-3 min-w-[120px]">Área</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 min-w-[180px]">Cargo Homologado</th>
                <th className="px-3 py-3 min-w-[220px]">Justificación</th>
                {showMeta && metaKeys.map(k => (
                  <th key={k} className="px-3 py-3 min-w-[100px] text-emerald-300">{k}</th>
                ))}
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const homo = c.homologacion || {};
                const isEditing = editingId === c.id;
                const isExpanded = expandedId === c.id;

                return (
                  <React.Fragment key={c.id}>
                    <tr className={`border-b border-emerald-50 hover:bg-emerald-50/30 transition-colors ${idx % 2 === 0 ? 'bg-white/60' : 'bg-white/90'}`}>
                      <td className="px-3 py-3 text-slate-300 font-mono sticky left-0 bg-inherit">{idx + 1}</td>
                      <td className="px-3 py-3 font-bold text-forest sticky left-6 bg-inherit z-10">
                        {c.nombre_cargo}
                      </td>
                      <td className="px-3 py-3 text-slate-500">{c.area}</td>
                      <td className="px-3 py-3">
                        <StatusBadge estado={c.estado} />
                      </td>
                      <td className="px-3 py-3">
                        {isEditing ? (
                          <input
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            className="border border-primary rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                        ) : (
                          <span className={`${homo.cargo_homologado && homo.cargo_homologado !== 'PENDIENTE' ? 'text-forest font-semibold' : 'text-slate-300 italic'}`}>
                            {homo.cargo_homologado && homo.cargo_homologado !== 'PENDIENTE' ? homo.cargo_homologado : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-400 max-w-[220px]">
                        <span className="line-clamp-2">{homo.justificacion || '—'}</span>
                      </td>
                      {showMeta && metaKeys.map(k => (
                        <td key={k} className="px-3 py-3 text-slate-400 text-[10px]">
                          {homo.datos_excel?.[k] || '—'}
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => onSaveEdit(c.id)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-all"
                              >
                                <X size={13} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => onEdit(c.id, homo.cargo_homologado || '')}
                              className="p-1.5 text-slate-400 hover:text-primary hover:bg-emerald-50 rounded-lg transition-all"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : c.id)}
                            className="p-1.5 text-slate-400 hover:text-primary hover:bg-emerald-50 rounded-lg transition-all"
                          >
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && c.descripcion_empresa && (
                      <tr className="bg-emerald-50/40">
                        <td colSpan={7 + (showMeta ? metaKeys.length : 0)} className="px-8 py-3">
                          <p className="text-xs font-bold text-emerald-700 mb-1">📄 Descripción del Cargo</p>
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line line-clamp-6">
                            {c.descripcion_empresa}
                          </p>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
};

// ---- Main Dashboard ----
const Dashboard = ({ initialUploadId, onUploadIdConsumed, onGoToValoracion }) => {
  const [uploads, setUploads] = useState([]);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showMeta, setShowMeta] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);

  const pollRef = useRef(null);

  // Load uploads on mount
  useEffect(() => {
    fetchUploads();
  }, []);

  // Auto-select if new upload
  useEffect(() => {
    if (initialUploadId) {
      setSelectedUpload(initialUploadId);
      if (onUploadIdConsumed) onUploadIdConsumed();
    }
  }, [initialUploadId]);

  // Load cargos when selectedUpload changes
  useEffect(() => {
    if (selectedUpload) {
      fetchCargos(selectedUpload);
    } else {
      setCargos([]);
    }
  }, [selectedUpload]);

  const fetchUploads = async () => {
    try {
      const res = await api.get('/uploads');
      const list = Array.isArray(res.data) ? res.data : [];
      setUploads(list);
      // Auto-select first if none selected
      if (list.length > 0 && !selectedUpload && !initialUploadId) {
        setSelectedUpload(list[0].id);
      }
    } catch (e) {
      console.error('Error fetching uploads:', e);
    }
  };

  const fetchCargos = async (uploadId) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/uploads/${uploadId}/cargos`);
      setCargos(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError('Error al cargar los cargos');
      setCargos([]);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (uploadId) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/uploads/${uploadId}/cargos`);
        const data = Array.isArray(res.data) ? res.data : [];
        setCargos(data);

        const allDone = data.every(c =>
          !['pendiente', 'procesando'].includes((c.estado || '').toLowerCase())
        );
        if (allDone) {
          clearInterval(pollRef.current);
          setProcessingId(null);
          fetchUploads();
        }
      } catch (e) {
        clearInterval(pollRef.current);
        setProcessingId(null);
      }
    }, 3000);
  };

  const handleProcess = async (uploadId) => {
    if (!uploadId) return;
    setProcessingId(uploadId);
    try {
      await api.post(`/procesar/${uploadId}`, {});
      startPolling(uploadId);
    } catch (e) {
      setError('Error al iniciar procesamiento');
      setProcessingId(null);
    }
  };

  const handleCancelProcess = async (uploadId) => {
    if (!uploadId) return;
    if (pollRef.current) clearInterval(pollRef.current);
    try {
      await api.post(`/procesar/${uploadId}/cancel`, {});
    } catch (e) {
      console.error('Error canceling:', e);
    }
    setProcessingId(null);
    fetchCargos(uploadId);
  };

  const handleDownload = async (uploadId) => {
    if (!uploadId) return;
    try {
      const res = await axios.get(`${API}/descargar/${uploadId}`, {
        headers: authHeaders(),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `homologacion_${uploadId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError('Error al descargar el archivo');
    }
  };

  const handleEdit = (id, currentValue) => {
    setEditingId(id);
    setEditValue(currentValue || '');
  };

  const handleSaveEdit = async (cargoId) => {
    try {
      await api.patch(`/cargos/${cargoId}`, {
        cargo_homologado: editValue,
        justificacion: 'Editado manualmente por el analista',
      });
      setEditingId(null);
      fetchCargos(selectedUpload);
    } catch (e) {
      setError('Error al guardar cambios');
    }
  };

  const currentUpload = uploads.find(u => u.id === selectedUpload);
  const processing = processingId === selectedUpload;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar: Upload list */}
      <div className="w-64 shrink-0">
        <div className="glass-card rounded-2xl overflow-hidden border border-white/60 shadow-lg">
          <div className="p-4 border-b border-emerald-100 flex items-center justify-between">
            <h3 className="font-bold text-forest text-sm">Procesos</h3>
            <button
              onClick={fetchUploads}
              className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-emerald-50 transition-all"
            >
              <RefreshCw size={13} />
            </button>
          </div>
          <UploadList
            uploads={uploads}
            selectedUpload={selectedUpload}
            onSelect={(id) => { setSelectedUpload(id); setSearchTerm(''); }}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm font-medium"
          >
            <AlertCircle size={16} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
          </motion.div>
        )}

        {!selectedUpload ? (
          <div className="glass-card rounded-2xl p-16 text-center border border-white/60 shadow-xl">
            <FileSpreadsheet size={48} className="mx-auto mb-4 text-slate-200" />
            <h3 className="text-xl font-bold text-forest mb-2">Selecciona un proceso</h3>
            <p className="text-slate-400 text-sm">
              Elige un proceso de la lista izquierda o crea uno nuevo en "Nuevo Proceso".
            </p>
          </div>
        ) : (
          <DataframeTable
            cargos={cargos}
            upload={currentUpload}
            loading={loading}
            processing={processing}
            onProcess={() => handleProcess(selectedUpload)}
            onCancel={() => handleCancelProcess(selectedUpload)}
            onDownload={() => handleDownload(selectedUpload)}
            onGoToValoracion={onGoToValoracion}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            showMeta={showMeta}
            setShowMeta={setShowMeta}
            editingId={editingId}
            editValue={editValue}
            setEditValue={setEditValue}
            setEditingId={setEditingId}
            expandedId={expandedId}
            setExpandedId={setExpandedId}
            onEdit={handleEdit}
            onSaveEdit={handleSaveEdit}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
