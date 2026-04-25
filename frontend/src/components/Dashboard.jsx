import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Play, Download, Search, Edit2, ChevronDown, ChevronUp, FileSpreadsheet, Loader2, AlertCircle, Check, X, Eye, EyeOff, RefreshCw, Building, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const token = () => localStorage.getItem('token');
const api = (path) => axios.get(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
const apiPost = (path, data) => axios.post(`${API}${path}`, data, { headers: { Authorization: `Bearer ${token()}` } });
const apiPut = (path, data) => axios.put(`${API}${path}`, data, { headers: { Authorization: `Bearer ${token()}` } });

// ---- Status badge ----
const StatusBadge = ({ estado }) => {
  const s = (estado || '').toLowerCase();
  const map = {
    homologado: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    sugerido: 'bg-purple-100 text-purple-800 border-purple-300',
    procesando:  'bg-blue-100 text-blue-700 border-blue-300 animate-pulse',
    sin_coincidencia: 'bg-amber-100 text-amber-800 border-amber-300',
    error: 'bg-red-100 text-red-700 border-red-300',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${map[s] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {estado || 'PENDIENTE'}
    </span>
  );
};

// ---- DataFrame Table ----
const DataframeTable = ({ cargos, onEdit, onSaveEdit, editingId, editValue, setEditValue, setEditingId, expandedId, setExpandedId, showMeta, setShowMeta, searchTerm, setSearchTerm, loading, onProcess, onDownload, upload, processing, onCancel }) => {
  const filtered = cargos.filter(c =>
    c.nombre_cargo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.area?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const stats = {
    total: cargos.length,
    h: cargos.filter(c => ['homologado'].includes((c.estado||'').toLowerCase())).length,
    p: cargos.filter(c => ['pendiente',''].includes((c.estado||'').toLowerCase())).length,
    s: cargos.filter(c => c.estado === 'SIN_COINCIDENCIA' || c.estado === 'sin_coincidencia').length,
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl overflow-hidden border border-white/60 bg-white/80 shadow-xl">
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
          <span className="badge-pill bg-slate-100 text-slate-600">{stats.total} Total</span>
          <span className="badge-pill bg-emerald-100 text-emerald-700">{stats.h} ✓ Homologados</span>
          <span className="badge-pill bg-slate-100 text-slate-500">{stats.p} Pendientes</span>
          {stats.s > 0 && <span className="badge-pill bg-amber-100 text-amber-700">{stats.s} S/C</span>}
          <button onClick={() => setShowMeta(!showMeta)} className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${showMeta ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'}`}>
            {showMeta ? <EyeOff size={13}/> : <Eye size={13}/>} {showMeta ? 'Ocultar' : 'Ver'} A-AS
          </button>
          <div className="flex bg-forest rounded-lg overflow-hidden shadow-sm">
            <button onClick={onProcess} disabled={processing} className="flex items-center gap-1.5 text-white px-3 py-1.5 font-bold text-xs hover:bg-primary transition-all disabled:opacity-80 disabled:cursor-wait">
              {processing ? <Loader2 size={11} className="animate-spin"/> : <Play size={11} fill="currentColor"/>} PROCESAR IA
            </button>
            {processing && (
              <button onClick={onCancel} className="flex items-center justify-center px-2.5 border-l border-white/20 text-red-200 hover:text-white hover:bg-red-500 transition-all" title="Detener proceso">
                <X size={13}/>
              </button>
          <button onClick={() => props.onGoToValoracion && props.onGoToValoracion(upload.id)} 
            className="flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-purple-700 transition-all shadow-sm"
>
  Paso 2 · Valorar →
</button>
            )}
          </div>
          <button onClick={onDownload} className="flex items-center gap-1.5 bg-white border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-emerald-50 transition-all shadow-sm">
            <Download size={12}/> Descargar
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={13}/>
            <input type="text" placeholder="Buscar cargo…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-white border border-emerald-100 rounded-xl py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 w-44"/>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center p-16 gap-3 text-primary">
          <Loader2 className="animate-spin" size={26}/><span className="font-medium text-sm">Cargando datos…</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-forest text-white text-[10px] font-bold uppercase tracking-widest sticky top-0 z-10">
              <tr>
                <th className="px-3 py-3 w-8">#</th>
                <th className="px-3 py-3 min-w-52">Nombre del Cargo</th>
                <th className="px-3 py-3 min-w-28">Área</th>
                <th className="px-3 py-3 min-w-24 text-center">Estado</th>
                <th className="px-3 py-3 min-w-52">Cargo Homologado (IA)</th>
                <th className="px-3 py-3 min-w-64">Justificación IA</th>
                {showMeta && <th className="px-3 py-3 min-w-24 bg-emerald-900 text-emerald-300">Nivel Cargo</th>}
                {showMeta && <th className="px-3 py-3 min-w-24 bg-emerald-900 text-emerald-300">Tipo Contrato</th>}
                {showMeta && <th className="px-3 py-3 min-w-24 bg-emerald-900 text-emerald-300">Formación</th>}
                {showMeta && <th className="px-3 py-3 min-w-24 bg-emerald-900 text-emerald-300">Experiencia</th>}
                <th className="px-3 py-3 w-12 text-center">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => {
                const dx = c.homologacion?.datos_excel || {};
                return (
                  <React.Fragment key={c.id}>
                    <tr className={`border-b border-emerald-50 hover:bg-emerald-50/20 transition-colors ${idx % 2 === 0 ? 'bg-white/60' : 'bg-white/90'}`}>
                      <td className="px-3 py-3 text-slate-400 font-mono text-[10px] font-bold">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <p className="font-bold text-forest">{c.nombre_cargo}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold">{c.area || 'N/A'}</span>
                      </td>
                      <td className="px-3 py-3 text-center"><StatusBadge estado={c.estado}/></td>
                      <td className="px-3 py-3">
                        {editingId === c.id ? (
                          <div className="flex items-center gap-1">
                            <input value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(c.id); if (e.key === 'Escape') setEditingId(null); }} className="border-2 border-primary rounded-lg px-2 py-1 text-xs w-full focus:outline-none bg-white" autoFocus/>
                            <button onClick={() => onSaveEdit(c.id)} className="text-emerald-600 hover:text-emerald-800 flex-shrink-0"><Check size={15}/></button>
                            <button onClick={() => setEditingId(null)} className="text-red-400 flex-shrink-0"><X size={15}/></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group/edit cursor-pointer" onClick={() => { setEditingId(c.id); setEditValue(c.homologacion?.cargo_homologado || ''); }}>
                            <span className={`font-bold ${c.homologacion?.cargo_homologado && c.homologacion.cargo_homologado !== 'PENDIENTE' ? 'text-primary' : 'text-slate-300 italic'}`}>
                              {c.homologacion?.cargo_homologado || '— clic para editar —'}
                            </span>
                            <Edit2 size={11} className="opacity-0 group-hover/edit:opacity-100 text-slate-400 flex-shrink-0"/>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 max-w-xs">
                        <p className="text-[10px] text-slate-500 italic line-clamp-2">{c.homologacion?.justificacion || '—'}</p>
                      </td>
                      {showMeta && <td className="px-3 py-3 bg-emerald-50/30 text-[10px] text-slate-600">{dx.F_nivel_cargo || '—'}</td>}
                      {showMeta && <td className="px-3 py-3 bg-emerald-50/30 text-[10px] text-slate-600">{dx.J_tipo_contrato || '—'}</td>}
                      {showMeta && <td className="px-3 py-3 bg-emerald-50/30 text-[10px] text-slate-600">{dx.N_formacion || '—'}</td>}
                      {showMeta && <td className="px-3 py-3 bg-emerald-50/30 text-[10px] text-slate-600">{dx.O_experiencia || '—'}</td>}
                      <td className="px-3 py-3 text-center">
                        <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className={`p-1.5 rounded-lg transition-all ${expandedId === c.id ? 'bg-primary text-white' : 'text-slate-400 hover:text-primary hover:bg-emerald-50'}`}>
                          {expandedId === c.id ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                        </button>
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr className="bg-gradient-to-r from-emerald-50/40 to-white border-b-2 border-primary/20">
                        <td colSpan={showMeta ? 11 : 7} className="px-6 py-4">
                          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-3">📊 Datos Completos A–AS · {c.nombre_cargo}</p>
                          {Object.keys(dx).length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                              {Object.entries(dx).map(([key, val]) => val && val !== 'None' && (
                                <div key={key} className="bg-white rounded-lg p-2 border border-emerald-100 shadow-sm">
                                  <p className="text-[8px] font-bold text-emerald-600 uppercase mb-1 truncate">{key.replace(/_/g, ' ').replace(/^[A-Z]+ /, '')}</p>
                                  <p className="text-[10px] text-slate-700 font-medium break-words leading-tight">{val}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-400 italic text-xs">Sin datos del Excel. Recarga el archivo.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan="11" className="px-6 py-14 text-center text-slate-400 text-sm italic">
                  {cargos.length === 0 ? 'Selecciona un proceso para ver los datos.' : 'Sin resultados para la búsqueda.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
};

// ---- Upload List ----
const UploadList = ({ uploads, selectedId, onSelect, onProcess, onDownload, processingId }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {uploads.map(u => (
      <motion.div key={u.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className={`glass-card p-5 border-2 transition-all ${selectedId === u.id ? 'border-primary bg-primary/5 shadow-lg' : 'border-white/50 hover:border-emerald-200 cursor-pointer'}`}
      >
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2.5 rounded-xl ${selectedId === u.id ? 'bg-primary text-white' : 'bg-emerald-50 text-emerald-600'}`}>
            <Building size={18}/>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onDownload(u.id)} className="p-1.5 hover:bg-white rounded-lg text-emerald-600" title="Descargar"><Download size={15}/></button>
          </div>
        </div>
        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">{u.empresa || 'Empresa'}</p>
        <h3 className="font-bold text-forest text-sm truncate">{u.filename}</h3>
        <p className="text-xs text-slate-400 mt-1">{u.created_at ? new Date(u.created_at).toLocaleDateString('es-CO') : ''}</p>
        <div className="mt-3 pt-3 border-t border-emerald-100 flex gap-2">
          <button onClick={() => onSelect(u.id)} className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-all ${selectedId === u.id ? 'bg-primary text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
            {selectedId === u.id ? '✓ Viendo datos' : 'Ver DataFrame'}
          </button>
          <button onClick={() => onProcess(u.id)} disabled={processingId === u.id} className="flex items-center gap-1 bg-forest text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-primary transition-all disabled:opacity-50">
            {processingId === u.id ? <Loader2 size={11} className="animate-spin"/> : <Play size={11} fill="currentColor"/>} IA
          </button>
        </div>
      </motion.div>
    ))}
    {uploads.length === 0 && (
      <div className="col-span-3 glass-card p-10 text-center text-slate-400">
        <FileSpreadsheet size={36} className="mx-auto mb-3 text-slate-200"/>
        <p>Ve a "Nuevo Proceso" para cargar tu primer archivo.</p>
      </div>
    )}
  </div>
);

// ---- Main Dashboard ----
const Dashboard = ({ initialUploadId, onUploadIdConsumed }) => {
  const [uploads, setUploads] = useState([]);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showMeta, setShowMeta] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'data'
  const pollRef = useRef(null);

  useEffect(() => {
    fetchUploads();
  }, []);

  // Auto-select the upload that was just created
  useEffect(() => {
    if (initialUploadId && uploads.length > 0) {
      selectUpload(initialUploadId);
      if (onUploadIdConsumed) onUploadIdConsumed();
    }
  }, [initialUploadId, uploads]);

  const fetchUploads = async () => {
    try {
      const res = await api('/uploads');
      const sorted = [...res.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setUploads(sorted);
      
      // Auto-abrir el último si estamos en la lista y no hay nada seleccionado
      if (sorted.length > 0 && !selectedUpload && !initialUploadId) {
        selectUpload(sorted[0].id);
      }
    } catch (e) { console.error(e); }
  };

  const selectUpload = async (uploadId) => {
    setSelectedUpload(uploadId);
    setView('data');
    setLoading(true);
    setSearchTerm('');
    setCargos([]);
    try {
      const res = await api(`/uploads/${uploadId}/cargos`);
      setCargos(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (uploadId) => {
    setProcessingId(uploadId);
    try {
      await apiPost(`/procesar/${uploadId}`, {});
      // Poll every 5 seconds until done
      pollRef.current = setInterval(async () => {
        const res = await api(`/uploads/${uploadId}/cargos`);
        const data = res.data;
        if (selectedUpload === uploadId) setCargos(data);
        const processing = data.some(c => ['procesando', 'PROCESANDO', 'pendiente', 'PENDIENTE'].includes(c.estado));
        if (!processing) {
          clearInterval(pollRef.current);
          setProcessingId(null);
        }
      }, 5000);
    } catch (e) {
      console.error(e);
      setProcessingId(null);
    }
  };

  const handleCancelProcess = async (uploadId) => {
    try {
      await apiPost(`/procesar/${uploadId}/cancel`, {});
      if (pollRef.current) clearInterval(pollRef.current);
      setProcessingId(null);
      // Refrescar para ver el estado real (PENDIENTE de los que no alcanzaron a procesar)
      const res = await api(`/uploads/${uploadId}/cargos`);
      setCargos(res.data);
    } catch (e) {
      console.error("Error cancelando:", e);
    }
  };

  const handleDownload = async (uploadId) => {
    try {
      const res = await axios.get(`${API}/descargar/${uploadId}`, {
        headers: { Authorization: `Bearer ${token()}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.setAttribute('download', `homologacion_${uploadId}.xlsx`);
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { alert('Error al descargar'); }
  };

  const handleSaveEdit = async (cargoId) => {
    try {
      await apiPut(`/homologacion/${cargoId}`, { cargo_homologado: editValue });
      setEditingId(null);
      const res = await api(`/uploads/${selectedUpload}/cargos`);
      setCargos(res.data);
    } catch (e) { alert('Error al guardar'); }
  };

  const currentUpload = uploads.find(u => u.id === selectedUpload);

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest">
            {view === 'data' ? '📊 DataFrame de Homologación' : '🗂 Panel de Procesos'}
          </h1>
          <p className="text-sm text-emerald-700/60 font-medium">
            {view === 'data' ? `${currentUpload?.empresa || ''} · ${currentUpload?.filename || ''}` : `${uploads.length} procesos cargados`}
          </p>
        </div>
        <div className="flex gap-2">
          {view === 'data' && (
            <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-primary px-3 py-2 rounded-xl hover:bg-emerald-50 transition-all">
              <ArrowLeft size={16}/> Volver a procesos
            </button>
          )}
          <button onClick={fetchUploads} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Refrescar">
            <RefreshCw size={18}/>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {view === 'list' && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <UploadList
              uploads={uploads}
              selectedId={selectedUpload}
              onSelect={selectUpload}
              onProcess={handleProcess}
              onDownload={handleDownload}
              processingId={processingId}
            />
          </motion.div>
        )}

        {view === 'data' && (
          <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <DataframeTable
              cargos={cargos}
              loading={loading}
              upload={currentUpload}
              onEdit={(id, val) => { setEditingId(id); setEditValue(val); }}
              onSaveEdit={handleSaveEdit}
              editingId={editingId}
              editValue={editValue}
              setEditValue={setEditValue}
              setEditingId={setEditingId}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              showMeta={showMeta}
              setShowMeta={setShowMeta}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onProcess={() => handleProcess(selectedUpload)}
              onCancel={() => handleCancelProcess(selectedUpload)}
              processing={processingId === selectedUpload}
              onDownload={() => handleDownload(selectedUpload)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
