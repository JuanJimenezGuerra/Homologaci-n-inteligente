import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Play, Download, Search, CheckCircle2, RotateCcw, 
  Edit2, ExternalLink, Building, ChevronDown, ChevronUp,
  FileSpreadsheet, Loader2, AlertCircle, Check, X, 
  Eye, EyeOff, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Dashboard = () => {
  const [uploads, setUploads] = useState([]);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);

  const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

  useEffect(() => {
    fetchUploads(true);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const fetchUploads = async (autoSelect = false) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${apiUrl}/uploads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUploads(res.data);
      if (autoSelect && res.data.length > 0) {
        fetchCargos(res.data[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCargos = async (uploadId) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${apiUrl}/uploads/${uploadId}/cargos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCargos(res.data);
      setSelectedUpload(uploadId);
    } catch (err) {
      setError('No se pudieron cargar los cargos.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startProcessing = async (uploadId) => {
    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${apiUrl}/procesar/${uploadId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Poll every 4 seconds
      pollRef.current = setInterval(async () => {
        await fetchCargos(uploadId);
        const allDone = cargos.every(c => c.estado !== 'PROCESANDO' && c.estado !== 'PENDIENTE');
        if (allDone) {
          clearInterval(pollRef.current);
          setProcessing(false);
        }
      }, 4000);
    } catch (err) {
      console.error(err);
      setProcessing(false);
    }
  };

  const handleSaveEdit = async (cargoId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${apiUrl}/homologacion/${cargoId}`, {
        cargo_homologado: editValue
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingId(null);
      fetchCargos(selectedUpload);
    } catch (err) {
      console.error(err);
      alert('Error al guardar');
    }
  };

  const handleDownload = async (uploadId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${apiUrl}/descargar/${uploadId}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `homologacion_${uploadId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredCargos = cargos.filter(c =>
    c.nombre_cargo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.area?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: cargos.length,
    homologados: cargos.filter(c => c.estado === 'HOMOLOGADO' || c.estado === 'homologado').length,
    pendientes: cargos.filter(c => c.estado === 'PENDIENTE' || c.estado === 'pendiente').length,
    sinCoincidencia: cargos.filter(c => c.estado === 'SIN_COINCIDENCIA' || c.estado === 'sin_coincidencia').length,
  };

  const getStatusStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'homologado') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (s === 'procesando') return 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse';
    if (s === 'sin_coincidencia') return 'bg-amber-100 text-amber-800 border-amber-300';
    if (s === 'error') return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-slate-100 text-slate-600 border-slate-300';
  };

  // Get metadata columns to show (excluding nulls)
  const metaColumns = showMetadata && filteredCargos.length > 0 
    ? Object.keys(filteredCargos[0]?.homologacion?.datos_excel || {}).slice(0, 15) 
    : [];

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-forest">Hoja de Homologación</h1>
          <p className="text-sm text-emerald-700/60 font-medium">
            Vista tipo DataFrame · Edición en vivo · Sincronizado con IA
          </p>
        </div>
        <button 
          onClick={() => fetchUploads(false)} 
          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
          title="Refrescar"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Upload Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AnimatePresence>
          {uploads.map((u) => (
            <motion.div
              key={u.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => fetchCargos(u.id)}
              className={`glass-card p-5 cursor-pointer border-2 transition-all ${
                selectedUpload === u.id
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-white/50 hover:border-emerald-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${selectedUpload === u.id ? 'bg-primary text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Building size={18} />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(u.id); }}
                    className="p-1.5 hover:bg-white rounded-lg text-emerald-600 transition-colors"
                    title="Descargar Excel"
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">{u.empresa || 'Empresa'}</p>
              <h3 className="font-bold text-forest text-sm truncate">{u.filename}</h3>
              <p className="text-xs text-slate-400 mt-1">{new Date(u.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <div className="mt-3 pt-3 border-t border-emerald-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  {u.cargo_count || cargos.length || '?'} CARGOS
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); startProcessing(u.id); }}
                  disabled={processing}
                  className="flex items-center gap-1.5 bg-forest text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-primary transition-all disabled:opacity-50"
                >
                  {processing ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} fill="currentColor" />}
                  PROCESAR
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {uploads.length === 0 && (
          <div className="col-span-3 glass-card p-10 text-center text-slate-400">
            <FileSpreadsheet size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No hay archivos cargados. Ve a "Nuevo Proceso" para empezar.</p>
          </div>
        )}
      </div>

      {/* DataFrame Table */}
      {selectedUpload && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl overflow-hidden border border-white/60 bg-white/70 shadow-xl"
        >
          {/* Table Header Controls */}
          <div className="p-5 border-b border-emerald-100 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet size={20} className="text-primary" />
              <div>
                <h3 className="text-base font-bold text-forest">DataFrame de Homologación</h3>
                <p className="text-xs text-slate-500">{filteredCargos.length} registros · {stats.homologados} homologados · {stats.pendientes} pendientes</p>
              </div>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              {/* Stats pills */}
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">{stats.total} Total</span>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">{stats.homologados} ✓</span>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">{stats.pendientes} Pend.</span>
              {stats.sinCoincidencia > 0 && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">{stats.sinCoincidencia} S/C</span>
              )}
              {/* Metadata Toggle */}
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${showMetadata ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'}`}
              >
                {showMetadata ? <EyeOff size={14} /> : <Eye size={14} />}
                {showMetadata ? 'Ocultar' : 'Ver'} Datos A-AS
              </button>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" size={14} />
                <input
                  type="text"
                  placeholder="Buscar cargo o área..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white border border-emerald-100 rounded-xl py-2 pl-9 pr-4 text-xs text-forest focus:outline-none focus:ring-2 focus:ring-primary/20 w-52 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center p-20 gap-3 text-primary">
              <Loader2 className="animate-spin" size={28} />
              <span className="font-medium text-sm">Cargando datos...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center p-16 gap-3 text-red-500">
              <AlertCircle size={24} />
              <span className="font-medium">{error}</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-forest text-white text-[10px] font-bold uppercase tracking-widest sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 w-8">#</th>
                    <th className="px-4 py-3 min-w-52">📋 Nombre de Cargo</th>
                    <th className="px-4 py-3 min-w-32">🏢 Área</th>
                    <th className="px-4 py-3 min-w-28 text-center">Estado IA</th>
                    <th className="px-4 py-3 min-w-56">🤖 Cargo Homologado (IA)</th>
                    <th className="px-4 py-3 min-w-72">💡 Justificación</th>
                    {showMetadata && metaColumns.map(col => (
                      <th key={col} className="px-4 py-3 min-w-32 bg-emerald-900 text-emerald-200">
                        {col.replace(/_/g, ' ').replace(/^[A-Z]+ /, '')}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center">✏️</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCargos.map((c, idx) => (
                    <React.Fragment key={c.id}>
                      <tr className={`border-b border-emerald-50 hover:bg-emerald-50/30 transition-colors group ${idx % 2 === 0 ? 'bg-white/50' : 'bg-white/80'}`}>
                        {/* Row number */}
                        <td className="px-4 py-3 text-slate-400 font-mono font-bold text-[10px]">{idx + 1}</td>
                        
                        {/* Nombre Cargo */}
                        <td className="px-4 py-3">
                          <p className="font-bold text-forest text-xs">{c.nombre_cargo}</p>
                        </td>

                        {/* Área */}
                        <td className="px-4 py-3">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-200">
                            {c.area || 'N/A'}
                          </span>
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-[9px] font-bold border uppercase ${getStatusStyle(c.estado)}`}>
                            {c.estado || 'PENDIENTE'}
                          </span>
                        </td>

                        {/* Cargo Homologado - Editable */}
                        <td className="px-4 py-3">
                          {editingId === c.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="border-2 border-primary rounded-lg px-2 py-1 text-xs w-full focus:outline-none bg-white"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(c.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                              />
                              <button onClick={() => handleSaveEdit(c.id)} className="text-emerald-600 hover:text-emerald-800">
                                <Check size={16} />
                              </button>
                              <button onClick={() => setEditingId(null)} className="text-red-400 hover:text-red-600">
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div 
                              className="flex items-center gap-2 group/edit cursor-pointer"
                              onClick={() => { setEditingId(c.id); setEditValue(c.homologacion?.cargo_homologado || ''); }}
                            >
                              <span className={`font-bold ${c.homologacion?.cargo_homologado && c.homologacion.cargo_homologado !== 'PENDIENTE' ? 'text-primary' : 'text-slate-300 italic'}`}>
                                {c.homologacion?.cargo_homologado || '— Sin procesar —'}
                              </span>
                              <Edit2 size={12} className="opacity-0 group-hover/edit:opacity-100 text-slate-400 flex-shrink-0" />
                            </div>
                          )}
                        </td>

                        {/* Justificación */}
                        <td className="px-4 py-3 max-w-xs">
                          {c.homologacion?.justificacion ? (
                            <p className="text-[10px] text-slate-500 italic leading-relaxed line-clamp-2" title={c.homologacion.justificacion}>
                              {c.homologacion.justificacion}
                            </p>
                          ) : (
                            <span className="text-slate-300 italic text-[10px]">Sin justificación</span>
                          )}
                        </td>

                        {/* Metadata columns */}
                        {showMetadata && metaColumns.map(col => (
                          <td key={col} className="px-4 py-3 bg-emerald-50/20">
                            <span className="text-[10px] text-slate-600 truncate block max-w-32" title={c.homologacion?.datos_excel?.[col] || ''}>
                              {c.homologacion?.datos_excel?.[col] || '—'}
                            </span>
                          </td>
                        ))}

                        {/* Actions */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                            className={`p-1.5 rounded-lg transition-all ${expandedId === c.id ? 'bg-primary text-white' : 'text-slate-400 hover:text-primary hover:bg-emerald-50'}`}
                            title="Ver todos los datos A-AS"
                          >
                            {expandedId === c.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded metadata row */}
                      {expandedId === c.id && (
                        <tr className="bg-gradient-to-r from-emerald-50/50 to-white border-b-2 border-primary/20">
                          <td colSpan={7 + metaColumns.length + 1} className="px-6 py-5">
                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-3">
                              📊 Datos Completos del Excel · {c.nombre_cargo}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                              {c.homologacion?.datos_excel && Object.entries(c.homologacion.datos_excel).map(([key, val]) => (
                                <div key={key} className="bg-white rounded-lg p-2.5 border border-emerald-100 shadow-sm">
                                  <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-tighter mb-1 truncate">{key.replace(/_/g, ' ')}</p>
                                  <p className="text-[10px] text-slate-700 font-medium break-words leading-tight">{val || '—'}</p>
                                </div>
                              ))}
                              {(!c.homologacion?.datos_excel || Object.keys(c.homologacion.datos_excel).length === 0) && (
                                <div className="col-span-full text-slate-400 text-xs italic p-3">
                                  No hay datos de Excel para este cargo. Sube el archivo nuevamente.
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}

                  {filteredCargos.length === 0 && !loading && (
                    <tr>
                      <td colSpan="8" className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Search size={36} className="text-slate-200" />
                          <p className="text-slate-400 font-medium">
                            {cargos.length === 0
                              ? 'Carga un archivo Excel para ver los datos aquí.'
                              : 'No hay cargos que coincidan con la búsqueda.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default Dashboard;
