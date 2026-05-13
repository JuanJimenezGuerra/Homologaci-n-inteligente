import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Play, Download, Search, Edit2, ChevronDown, ChevronUp,
  FileSpreadsheet, Loader2, AlertCircle, Check, X, Eye, EyeOff,
  RefreshCw, Building, BarChart2, FileText, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── API helpers ─────────────────────────────────────────────────────────────
// getHeaders() se llama DENTRO de cada fetch para leer el token actualizado
const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};
const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});
const apiGet   = (path)       => axios.get(`${getApiUrl()}${path}`,   { headers: getHeaders() });
const apiPost  = (path, data) => axios.post(`${getApiUrl()}${path}`,  data, { headers: getHeaders() });
const apiPatch = (path, data) => axios.patch(`${getApiUrl()}${path}`, data, { headers: getHeaders() });

// ─── StatusBadge ─────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  homologado:       'bg-emerald-100 text-emerald-800 border-emerald-300',
  sugerido:         'bg-purple-100 text-purple-800 border-purple-300',
  procesando:       'bg-blue-100 text-blue-700 border-blue-300 animate-pulse',
  sin_coincidencia: 'bg-amber-100 text-amber-800 border-amber-300',
  error:            'bg-red-100 text-red-700 border-red-300',
};
const StatusBadge = ({ estado }) => {
  const key = (estado || '').toLowerCase();
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${STATUS_STYLES[key] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {estado || 'PENDIENTE'}
    </span>
  );
};

// ─── Upload sidebar list ──────────────────────────────────────────────────────
const UploadList = ({ uploads, selectedId, onSelect }) => {
  if (!uploads.length) return (
    <div className="p-6 text-center text-slate-400 text-sm leading-relaxed">
      No hay procesos.<br />
      <span className="font-bold text-primary">Nuevo Proceso</span> para crear uno.
    </div>
  );
  return (
    <div className="space-y-2 p-3">
      {uploads.map(u => {
        const active = u.id === selectedId;
        return (
          <button
            key={u.id}
            onClick={() => onSelect(u.id)}
            className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${active ? 'bg-primary text-white border-primary shadow-md' : 'bg-white border-slate-100 hover:border-primary/40 text-slate-700'}`}
          >
            <div className="flex items-center gap-2">
              <Building size={13} className={active ? 'text-white/80' : 'text-primary'} />
              <span className="font-bold truncate">{u.empresa || 'Sin empresa'}</span>
            </div>
            <p className={`text-[10px] mt-0.5 truncate ${active ? 'text-white/70' : 'text-slate-400'}`}>{u.filename}</p>
            <p className={`text-[10px] ${active ? 'text-white/50' : 'text-slate-300'}`}>#{u.id} · {u.status || 'pendiente'}</p>
          </button>
        );
      })}
    </div>
  );
};

// ─── Data table ──────────────────────────────────────────────────────────────
const DataframeTable = ({
  cargos, upload, loading, processing,
  onProcess, onCancel, onDownload, onGoToValoracion,
  searchTerm, setSearchTerm, showMeta, setShowMeta,
  editingId, editValue, setEditValue, setEditingId,
  expandedId, setExpandedId, onEdit, onSaveEdit,
}) => {
  const filtered = cargos.filter(c =>
    (c.nombre_cargo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.area || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const total      = cargos.length;
  const homo       = cargos.filter(c => (c.estado||'').toLowerCase() === 'homologado').length;
  const suger      = cargos.filter(c => (c.estado||'').toLowerCase() === 'sugerido').length;
  const pend       = cargos.filter(c => ['pendiente',''].includes((c.estado||'').toLowerCase())).length;
  const sc         = cargos.filter(c => (c.estado||'').toLowerCase() === 'sin_coincidencia').length;
  const metaKeys   = cargos[0]?.homologacion?.datos_excel ? Object.keys(cargos[0].homologacion.datos_excel).slice(0,8) : [];

  return (
    <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
      className="glass-card rounded-2xl overflow-hidden border border-white/60 bg-white/80 shadow-xl">

      {/* Toolbar */}
      <div className="p-4 border-b border-emerald-100 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet size={20} className="text-primary" />
          <div>
            <h3 className="font-bold text-forest text-sm">{upload?.empresa || 'DataFrame'}</h3>
            <p className="text-xs text-slate-400">{upload?.filename} · {filtered.length} registros</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{total} Total</span>
          {homo > 0  && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">✓ {homo} OK</span>}
          {suger > 0 && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-full">~ {suger} Sug.</span>}
          {pend > 0  && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">{pend} Pend.</span>}
          {sc > 0    && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{sc} S/C</span>}

          <button onClick={() => setShowMeta(!showMeta)}
            className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${showMeta ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'}`}>
            {showMeta ? <EyeOff size={13}/> : <Eye size={13}/>} {showMeta ? 'Ocultar' : 'Ver'} Datos
          </button>

          <div className="flex bg-forest rounded-lg overflow-hidden shadow-sm">
            <button onClick={onProcess} disabled={processing}
              className="flex items-center gap-1.5 text-white px-3 py-1.5 font-bold text-xs hover:bg-primary transition-all disabled:opacity-70">
              {processing ? <Loader2 size={11} className="animate-spin"/> : <Play size={11} fill="currentColor"/>}
              {processing ? 'PROCESANDO...' : 'PROCESAR IA'}
            </button>
            {processing && (
              <button onClick={onCancel} title="Cancelar"
                className="px-2.5 border-l border-white/20 text-red-300 hover:text-white hover:bg-red-500 transition-all">
                <X size={13}/>
              </button>
            )}
          </div>

          {onGoToValoracion && upload && (
            <button onClick={() => onGoToValoracion(upload.id)}
              className="flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-purple-700 transition-all shadow-sm">
              <BarChart2 size={12}/> Paso 2 · Valorar →
            </button>
          )}

          <button onClick={onDownload}
            className="flex items-center gap-1.5 bg-white border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-emerald-50 transition-all shadow-sm">
            <Download size={12}/> Descargar
          </button>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={13}/>
            <input type="text" placeholder="Buscar cargo…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="bg-white border border-emerald-100 rounded-xl py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 w-44"/>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center p-16 gap-3 text-primary">
          <Loader2 className="animate-spin" size={26}/><span className="font-medium text-sm">Cargando datos…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-20"/>
          <p className="font-medium">No hay cargos{searchTerm ? ' con esa búsqueda' : ''}</p>
          {searchTerm && <button onClick={() => setSearchTerm('')} className="mt-2 text-xs text-primary underline">Limpiar</button>}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-forest text-white text-[10px] font-bold uppercase sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 w-8">#</th>
                <th className="px-3 py-3 min-w-[180px]">Cargo</th>
                <th className="px-3 py-3 min-w-[110px]">Área</th>
                <th className="px-3 py-3 w-12 text-center">Anexo</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 min-w-[200px]">Cargo Homologado</th>
                <th className="px-3 py-3 min-w-[200px]">Justificación</th>
                {showMeta && metaKeys.map(k => <th key={k} className="px-3 py-3 min-w-[90px] text-emerald-300">{k}</th>)}
                <th className="px-3 py-3 w-20">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const h = c.homologacion || {};
                const isEditing  = editingId === c.id;
                const isExpanded = expandedId === c.id;
                const homName = h.cargo_homologado && h.cargo_homologado !== 'PENDIENTE' ? h.cargo_homologado : null;
                return (
                  <React.Fragment key={c.id}>
                    <tr className={`border-b border-emerald-50 hover:bg-emerald-50/30 transition-colors ${idx%2===0?'bg-white/60':'bg-white/90'}`}>
                      <td className="px-3 py-2.5 text-slate-300 font-mono text-center">{idx+1}</td>
                      <td className="px-3 py-2.5 font-bold text-forest">{c.nombre_cargo}</td>
                      <td className="px-3 py-2.5 text-slate-500">{c.area === 'DESCRIPCION_ANEXA' ? '—' : c.area}</td>
                      <td className="px-3 py-2.5 text-center">
                        {c.tiene_descripcion_anexa ? (
                          <span title="Tiene descripción anexa" className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            <FileText size={11} /> Sí
                          </span>
                        ) : c.es_sin_match ? (
                          <span title="Sin match en Excel" className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            <AlertTriangle size={11} /> ?
                          </span>
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge estado={c.estado}/></td>
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <input value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                            onKeyDown={e => { if(e.key==='Enter') onSaveEdit(c.id); if(e.key==='Escape') setEditingId(null); }}
                            className="border border-primary rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"/>
                        ) : (
                          <span className={homName ? 'text-forest font-semibold' : 'text-slate-300 italic'}>
                            {homName || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-400 max-w-[200px]">
                        <span className="line-clamp-2 text-[10px] leading-relaxed">{h.justificacion || '—'}</span>
                      </td>
                      {showMeta && metaKeys.map(k => (
                        <td key={k} className="px-3 py-2.5 text-slate-400 text-[10px]">{h.datos_excel?.[k] ?? '—'}</td>
                      ))}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button onClick={() => onSaveEdit(c.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Guardar"><Check size={13}/></button>
                              <button onClick={() => setEditingId(null)} className="p-1 text-red-400 hover:bg-red-50 rounded" title="Cancelar"><X size={13}/></button>
                            </>
                          ) : (
                            <button onClick={() => onEdit(c.id, homName || '')} className="p-1 text-slate-400 hover:text-primary hover:bg-emerald-50 rounded" title="Editar"><Edit2 size={13}/></button>
                          )}
                          {c.descripcion_empresa && (
                            <button onClick={() => setExpandedId(isExpanded ? null : c.id)} className="p-1 text-slate-400 hover:text-primary hover:bg-emerald-50 rounded" title="Ver descripción">
                              {isExpanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {isExpanded && c.descripcion_empresa && (
                        <motion.tr key={`exp-${c.id}`} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="bg-emerald-50/40">
                          <td colSpan={8+(showMeta?metaKeys.length:0)} className="px-8 py-3">
                            <p className="text-[10px] font-bold text-emerald-700 mb-1 uppercase tracking-wider">📄 Descripción del Cargo</p>
                            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line max-h-32 overflow-y-auto">{c.descripcion_empresa}</p>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const Dashboard = ({ initialUploadId, onUploadIdConsumed, onGoToValoracion }) => {
  const [uploads,      setUploads]    = useState([]);
  const [selectedUpload, setSelected] = useState(null);
  const [cargos,       setCargos]     = useState([]);
  const [loading,      setLoading]    = useState(false);
  const [processingId, setProc]       = useState(null);
  const [editingId,    setEditingId]  = useState(null);
  const [editValue,    setEditValue]  = useState('');
  const [expandedId,   setExpandedId] = useState(null);
  const [showMeta,     setShowMeta]   = useState(false);
  const [searchTerm,   setSearch]     = useState('');
  const [error,        setError]      = useState(null);
  const pollRef = useRef(null);

  useEffect(() => { fetchUploads(); }, []);

  useEffect(() => {
    if (initialUploadId) {
      setSelected(initialUploadId);
      onUploadIdConsumed?.();
    }
  }, [initialUploadId]);

  useEffect(() => {
    if (selectedUpload) fetchCargos(selectedUpload);
    else setCargos([]);
  }, [selectedUpload]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const fetchUploads = async () => {
    try {
      const res = await apiGet('/uploads');
      const list = (Array.isArray(res.data) ? res.data : []).reverse();
      setUploads(list);
      if (!selectedUpload && !initialUploadId && list.length > 0) {
        setSelected(list[0].id);
      }
    } catch (e) { console.error('fetchUploads:', e); }
  };

  const fetchCargos = async (id) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet(`/uploads/${id}/cargos`);
      setCargos(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e.response?.status === 401
        ? 'Sesión expirada. Recarga la página e inicia sesión nuevamente.'
        : 'Error al cargar los cargos.');
      setCargos([]);
    } finally { setLoading(false); }
  };

  const startPolling = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await apiGet(`/uploads/${id}/cargos`);
        const data = Array.isArray(res.data) ? res.data : [];
        setCargos(data);
        const stillPending = data.some(c => ['pendiente','procesando'].includes((c.estado||'').toLowerCase()));
        if (!stillPending) { clearInterval(pollRef.current); setProc(null); fetchUploads(); }
      } catch { clearInterval(pollRef.current); setProc(null); }
    }, 3500);
  };

  const handleProcess = async () => {
    if (!selectedUpload) return;
    setProc(selectedUpload); setError(null);
    try { await apiPost(`/procesar/${selectedUpload}`, {}); startPolling(selectedUpload); }
    catch { setError('Error al iniciar el procesamiento con IA.'); setProc(null); }
  };

  const handleCancel = async () => {
    clearInterval(pollRef.current);
    try { await apiPost(`/procesar/${selectedUpload}/cancel`, {}); } catch {}
    setProc(null);
    fetchCargos(selectedUpload);
  };

  const handleDownload = async () => {
    try {
      const res = await axios.get(`${getApiUrl()}/descargar/${selectedUpload}`, { headers: getHeaders(), responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `homologacion_${selectedUpload}.xlsx`; a.click();
      window.URL.revokeObjectURL(url);
    } catch { setError('Error al descargar el Excel.'); }
  };

  const handleEdit = (id, val) => { setEditingId(id); setEditValue(val || ''); };

  const handleSaveEdit = async (cargoId) => {
    try {
      await apiPatch(`/cargos/${cargoId}`, { cargo_homologado: editValue, justificacion: 'Editado manualmente' });
      setEditingId(null);
      fetchCargos(selectedUpload);
    } catch { setError('Error al guardar el cambio.'); }
  };

  const currentUpload = uploads.find(u => u.id === selectedUpload) || null;
  const processing    = processingId === selectedUpload;

  return (
    <div className="flex gap-6 h-full">
      {/* Sidebar */}
      <div className="w-60 shrink-0">
        <div className="glass-card rounded-2xl overflow-hidden border border-white/60 shadow-lg">
          <div className="p-3 border-b border-emerald-100 flex items-center justify-between">
            <h3 className="font-bold text-forest text-sm">Procesos</h3>
            <button onClick={fetchUploads} className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-emerald-50 transition-all" title="Recargar">
              <RefreshCw size={13}/>
            </button>
          </div>
          <UploadList uploads={uploads} selectedId={selectedUpload}
            onSelect={id => { setSelected(id); setSearch(''); setEditingId(null); }}/>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        <AnimatePresence>
          {error && (
            <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
              className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-center gap-2 text-sm font-medium">
              <AlertCircle size={16} className="shrink-0"/>
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded"><X size={14}/></button>
            </motion.div>
          )}
        </AnimatePresence>

        {!selectedUpload ? (
          <div className="glass-card rounded-2xl p-16 text-center border border-white/60 shadow-xl">
            <FileSpreadsheet size={48} className="mx-auto mb-4 text-slate-200"/>
            <h3 className="text-xl font-bold text-forest mb-2">Selecciona un proceso</h3>
            <p className="text-slate-400 text-sm">Elige de la lista o crea uno en <strong>Nuevo Proceso</strong>.</p>
          </div>
        ) : (
          <DataframeTable
            cargos={cargos} upload={currentUpload} loading={loading} processing={processing}
            onProcess={handleProcess} onCancel={handleCancel} onDownload={handleDownload}
            onGoToValoracion={onGoToValoracion}
            searchTerm={searchTerm} setSearchTerm={setSearch}
            showMeta={showMeta} setShowMeta={setShowMeta}
            editingId={editingId} editValue={editValue} setEditValue={setEditValue} setEditingId={setEditingId}
            expandedId={expandedId} setExpandedId={setExpandedId}
            onEdit={handleEdit} onSaveEdit={handleSaveEdit}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
