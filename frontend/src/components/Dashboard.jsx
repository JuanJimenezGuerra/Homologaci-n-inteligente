import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Download, Search, AlertCircle, CheckCircle2, Clock, RotateCcw, Edit2, FileUp } from 'lucide-react';

const Dashboard = () => {
  const [uploads, setUploads] = useState([]);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchUploads();
  }, []);

  const handleManualesUpload = async (uploadId, files) => {
    if (!files.length) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8000/uploads/${uploadId}/manuales`, formData, {
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

  const fetchUploads = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:8000/uploads', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUploads(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCargos = async (uploadId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:8000/uploads/${uploadId}/cargos`, {
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
      await axios.post(`http://localhost:8000/procesar/${uploadId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Start polling status
      pollStatus(uploadId);
    } catch (err) {
      console.error(err);
      setProcessing(false);
    }
  };

  const pollStatus = (uploadId) => {
    const interval = setInterval(async () => {
      await fetchCargos(uploadId);
      // Logic to stop polling if all processed? 
      // For now simple refresh
    }, 5000);
    return () => clearInterval(interval);
  };

  const handleDownload = async (uploadId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:8000/descargar/${uploadId}`, {
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

  const getStatusBadge = (status) => {
    const styles = {
      pendiente: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      procesando: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse',
      homologado: 'bg-green-500/10 text-green-400 border-green-500/20',
      sin_coincidencia: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      error: 'bg-red-500/10 text-red-400 border-red-500/20'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.pendiente}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Dashboard</h2>
          <p className="text-slate-400">Gestiona y monitorea tus procesos de homologación</p>
        </div>
      </div>

      {/* Uploads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {uploads.map((u) => (
          <div 
            key={u.id}
            onClick={() => fetchCargos(u.id)}
            className={`glass-card p-6 rounded-3xl cursor-pointer transition-all ${selectedUpload === u.id ? 'ring-2 ring-primary-500 bg-primary-500/5' : ''}`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-800 rounded-xl">
                <Clock className="text-slate-400" size={20} />
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDownload(u.id); }}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <Download size={18} />
              </button>
            </div>
            <h3 className="font-bold text-white truncate">{u.filename}</h3>
            <p className="text-sm text-slate-500 mt-1">{new Date(u.created_at).toLocaleDateString()}</p>
            
            <div className="mt-6 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cargos: {u.cargo_count || '...'}</span>
              <div className="flex gap-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); document.getElementById(`manuales-${u.id}`).click(); }}
                  className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-bold text-xs transition-colors"
                >
                  <FileUp size={14} />
                  MANUALES
                </button>
                <input 
                  id={`manuales-${u.id}`}
                  type="file" 
                  multiple 
                  className="hidden" 
                  onChange={(e) => handleManualesUpload(u.id, e.target.files)}
                />
                <button 
                  onClick={(e) => { e.stopPropagation(); startProcessing(u.id); }}
                  className="flex items-center gap-2 text-primary-400 hover:text-primary-300 font-bold text-xs transition-colors"
                >
                  <Play size={14} />
                  PROCESAR
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cargos Table */}
      {selectedUpload && (
        <div className="glass-card rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Detalle de Cargos</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="text" 
                placeholder="Buscar cargo..." 
                className="bg-slate-900/50 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary-500 w-64"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-800/30 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Cargo Original</th>
                  <th className="px-6 py-4 font-semibold">Área</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 font-semibold">Cargo Homologado</th>
                  <th className="px-6 py-4 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {cargos.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-6 py-4 text-sm font-medium text-white">{c.nombre_cargo}</td>
                    <td className="px-6 py-4 text-sm text-slate-400">{c.area}</td>
                    <td className="px-6 py-4">{getStatusBadge(c.estado)}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm text-primary-300 font-medium">{c.homologacion?.cargo_homologado || '-'}</span>
                        <span className="text-xs text-slate-500 truncate max-w-xs">{c.homologacion?.justificacion}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button className="p-2 text-slate-500 hover:text-primary-400 hover:bg-primary-500/10 rounded-lg transition-all">
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
