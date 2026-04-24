import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Download, Search, AlertCircle, CheckCircle2, Clock, RotateCcw, Edit2, FileUp, MoreVertical, ExternalLink, Building } from 'lucide-react';
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

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    fetchUploads(true);
  }, []);

  const handleManualesUpload = async (uploadId, files) => {
    if (!files.length) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${apiUrl}/uploads/${uploadId}/manuales`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      alert('Manuales cargados y vinculados correctamente');
      fetchCargos(uploadId);
    } catch (err) {
      console.error(err);
      alert('Error al cargar manuales');
    }
  };

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
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${apiUrl}/uploads/${uploadId}/cargos`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCargos(res.data);
      setSelectedUpload(uploadId);
    } catch (err) {
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
      pollStatus(uploadId);
    } catch (err) {
      console.error(err);
      setProcessing(false);
    }
  };

  const pollStatus = (uploadId) => {
    const interval = setInterval(async () => {
      await fetchCargos(uploadId);
    }, 5000);
    return () => clearInterval(interval);
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
      link.setAttribute('download', `resultado_${uploadId}.xlsx`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredCargos = cargos.filter(c => 
    c.nombre_cargo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.area?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    const styles = {
      pendiente: 'bg-slate-100 text-slate-500 border-slate-200',
      procesando: 'bg-emerald-50 text-emerald-600 border-emerald-100 animate-pulse',
      homologado: 'bg-green-100 text-green-700 border-green-200',
      sin_coincidencia: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      error: 'bg-red-50 text-red-700 border-red-200'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${styles[status] || styles.pendiente}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-forest">Dashboard Operativo</h1>
          <p className="text-emerald-700/60 font-medium">Gestiona y monitorea tus procesos de homologación con IA</p>
        </div>
        <div className="flex gap-3">
           <button onClick={() => fetchUploads(false)} className="btn-secondary px-4 py-2">
             <RotateCcw size={16} />
           </button>
        </div>
      </header>

      {/* Uploads Horizontal Scroll or Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AnimatePresence>
          {uploads.map((u) => (
            <motion.div 
              key={u.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => fetchCargos(u.id)}
              className={`glass-card p-6 cursor-pointer border-2 transition-all group ${
                selectedUpload === u.id ? 'border-primary bg-primary/5 shadow-primary/20' : 'border-white/50 hover:border-emerald-200'
              }`}
            >
              <div className="flex justify-between items-start mb-6">
                <div className={`p-3 rounded-2xl ${selectedUpload === u.id ? 'bg-primary text-white' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Building size={20} />
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDownload(u.id); }}
                    className="p-2 hover:bg-white rounded-xl text-emerald-600 transition-colors shadow-sm"
                    title="Descargar Excel"
                  >
                    <Download size={18} />
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mb-1">{u.empresa || 'Empresa Desconocida'}</p>
              <h3 className="font-bold text-forest truncate text-lg mb-1">{u.filename}</h3>
              <p className="text-xs text-slate-400 font-medium italic">
                {new Date(u.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}
              </p>
              
              <div className="mt-8 pt-6 border-t border-emerald-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-1 rounded-md">
                  {u.cargo_count || 0} CARGOS
                </span>
                <div className="flex gap-2">
                  <input 
                    id={`manuales-${u.id}`}
                    type="file" 
                    multiple 
                    className="hidden" 
                    onChange={(e) => handleManualesUpload(u.id, e.target.files)}
                  />
                  <button 
                    onClick={(e) => { e.stopPropagation(); startProcessing(u.id); }}
                    disabled={processing}
                    className="flex items-center gap-2 bg-forest text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-primary transition-all shadow-lg shadow-forest/20 disabled:opacity-50"
                  >
                    <Play size={12} fill="currentColor" />
                    PROCESAR
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Cargos Detail Table */}
      {selectedUpload && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-3xl overflow-hidden shadow-2xl border border-white/60 bg-white/60"
        >
          <div className="p-8 border-b border-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-forest">Detalle de Cargos</h3>
              <p className="text-sm text-emerald-600/60 font-medium">Revisión y validación de homologaciones sugeridas</p>
            </div>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por cargo o área..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border border-emerald-100 rounded-2xl py-3 pl-12 pr-6 text-sm text-forest focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-full md:w-80 transition-all shadow-sm"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-emerald-50/50 text-emerald-800 text-[10px] font-bold uppercase tracking-widest">
                  <th className="px-8 py-5">Nombre de Cargo (Excel)</th>
                  <th className="px-8 py-5">Área de la Empresa</th>
                  <th className="px-8 py-5 text-center">Estado de Homologación</th>
                  <th className="px-8 py-5">Cargo Homologado (Sugerencia IA)</th>
                  <th className="px-8 py-5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {filteredCargos.map((c) => (
                  <tr key={c.id} className="hover:bg-white/40 transition-colors group">
                    <td className="px-8 py-6">
                      <p className="text-sm font-bold text-forest">{c.nombre_cargo}</p>
                      <p className="text-[10px] text-emerald-600/50 font-bold uppercase tracking-tighter mt-0.5">ID: {c.id}</p>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                        {c.area || 'N/A'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">{getStatusBadge(c.estado)}</td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        {editingId === c.id ? (
                          <div className="flex gap-2">
                            <input 
                              value={editValue} 
                              onChange={(e) => setEditValue(e.target.value)}
                              className="bg-white border border-primary rounded-lg px-3 py-1 text-sm w-full focus:outline-none ring-2 ring-primary/10"
                              autoFocus
                            />
                            <button onClick={() => handleSaveEdit(c.id)} className="text-primary hover:scale-110 transition-transform"><CheckCircle2 size={18} /></button>
                            <button onClick={() => setEditingId(null)} className="text-red-400 hover:scale-110 transition-transform"><RotateCcw size={18} /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group/edit">
                            <span className={`text-sm font-bold ${c.homologacion?.cargo_homologado && c.homologacion.cargo_homologado !== 'PENDIENTE' ? 'text-primary' : 'text-slate-300 italic'}`}>
                              {c.homologacion?.cargo_homologado || 'Sin procesar'}
                            </span>
                            <button 
                              onClick={() => { setEditingId(c.id); setEditValue(c.homologacion?.cargo_homologado || ''); }}
                              className="opacity-0 group-hover/edit:opacity-100 p-1 text-slate-400 hover:text-primary transition-all"
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        )}
                        {c.homologacion?.justificacion && (
                          <div className="mt-2 p-2 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                             <p className="text-[10px] text-emerald-800 font-medium leading-relaxed italic">
                               💡 {c.homologacion.justificacion}
                             </p>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                        className={`p-2 rounded-xl transition-all inline-flex items-center gap-2 ${expandedId === c.id ? 'bg-primary text-white' : 'text-emerald-400 hover:text-primary hover:bg-emerald-50'}`}
                      >
                        <ExternalLink size={16} />
                        {expandedId === c.id ? 'Cerrar' : 'Ver Todo'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === c.id && c.homologacion?.datos_excel && (
                    <tr className="bg-emerald-50/30">
                      <td colSpan="5" className="px-8 py-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2">
                          {Object.entries(c.homologacion.datos_excel).map(([key, val]) => (
                            <div key={key} className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
                              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter mb-1 truncate" title={key}>{key}</p>
                              <p className="text-xs text-forest font-medium truncate" title={val || 'N/A'}>{val || 'N/A'}</p>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                ))}
                {filteredCargos.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                          <Search size={32} />
                        </div>
                        <p className="text-slate-400 font-medium">No se encontraron cargos con ese nombre</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Dashboard;
