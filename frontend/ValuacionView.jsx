import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Download, Loader2, ArrowLeft, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const token = () => localStorage.getItem('token');
const api = (path) => axios.get(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
const apiPost = (path, data) => axios.post(`${API}${path}`, data, { headers: { Authorization: `Bearer ${token()}` } });
const apiPatch = (path, data) => axios.patch(`${API}${path}`, data, { headers: { Authorization: `Bearer ${token()}` } });

const CRITERIOS = {
  conocimientos: { label: 'Conocimientos', opciones: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },
  experiencia: { label: 'Experiencia', opciones: ['-', 'o', '+'] },
  habilidad_gerencial: { label: 'Habilidad Gerencial', opciones: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] },
  rol_cargo: { label: 'Rol del Cargo', opciones: ['1', '2', '3', '4'] },
  contacto: { label: 'Contacto', opciones: ['A', 'B', 'C'] },
  frecuencia: { label: 'Frecuencia', opciones: ['1', '2', '3', '4'] },
  contenido_relaciones: { label: 'Contenido Relaciones', opciones: ['I', 'II', 'III', 'IV', 'V'] },
  complejidad_conceptual: { label: 'Complejidad Conceptual', opciones: ['1', '2', '3', '4', '5'] },
  guias_apoyo: { label: 'Guías de Apoyo', opciones: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] },
  impacto: { label: 'Impacto', opciones: ['I', 'II', 'III', 'IV'] },
  autonomia: { label: 'Autonomía', opciones: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
  magnitud: { label: 'Magnitud', opciones: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14'] },
};

const ValuacionView = ({ uploadId, onBack }) => {
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editField, setEditField] = useState(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    fetchValoraciones();
  }, [uploadId]);

  const fetchValoraciones = async () => {
    setLoading(true);
    try {
      const res = await api(`/uploads/${uploadId}/valoraciones`);
      setCargos(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async () => {
    setProcessing(true);
    try {
      await apiPost(`/procesar-valoracion/${uploadId}`, {});
      // Poll cada 3 segundos hasta que todos tengan valoracion
      const interval = setInterval(async () => {
        const res = await api(`/uploads/${uploadId}/valoraciones`);
        setCargos(res.data);
        const allDone = res.data.every(c => c.valoracion && c.valoracion.conocimientos);
        const anyProcessing = res.data.some(c => c.valoracion === null);
        if (allDone || !anyProcessing) {
          clearInterval(interval);
          setProcessing(false);
        }
      }, 3000);
    } catch (e) {
      console.error(e);
      setProcessing(false);
    }
  };

  const handleIAIndividual = async (cargoId) => {
    setProcessingId(cargoId);
    try {
      const res = await apiPost(`/valoracion/${cargoId}/evaluar-ia`, {});
      // Actualizar el cargo especifico en la lista
      setCargos(prev => prev.map(c => c.id === cargoId ? { ...c, valoracion: res.data.valoracion } : c));
    } catch (e) {
      console.error(e);
      alert('Error al valorar el cargo con IA');
    } finally {
      setProcessingId(null);
    }
  };

  const handleEdit = (cargoId, field, currentValue) => {
    setEditingId(cargoId);
    setEditField(field);
    setEditValue(currentValue || '');
  };

  const handleSave = async () => {
    try {
      await apiPatch(`/valoracion/${editingId}`, { [editField]: editValue });
      setEditingId(null);
      setEditField(null);
      fetchValoraciones();
    } catch (e) {
      console.error(e);
    }
  };

  const valorados = cargos.filter(c => c.valoracion && c.valoracion.conocimientos).length;
  const progreso = cargos.length > 0 ? Math.round((valorados / cargos.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary mb-2">
            <ArrowLeft size={16}/> Volver al Dashboard
          </button>
          <h1 className="text-2xl font-bold text-forest">📊 Paso 2: Valoración de Cargos</h1>
          <p className="text-sm text-emerald-700/60">Definición de los 12 factores por IA</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleProcess} disabled={processing} className="btn-primary">
            {processing ? <Loader2 size={16} className="animate-spin"/> : <Play size={16}/>}
            {processing ? 'Procesando...' : 'Valorar Todo con IA'}
          </button>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-forest">Progreso de Valoración</span>
          <span className="text-sm font-bold text-primary">{progreso}% ({valorados}/{cargos.length})</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progreso}%` }}
            className="h-full bg-primary rounded-full"
          />
        </div>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex items-center justify-center p-16 gap-3 text-primary">
          <Loader2 className="animate-spin" size={26}/>
          <span className="font-medium text-sm">Cargando valoraciones…</span>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-forest text-white text-[10px] font-bold uppercase">
                <tr>
                  <th className="px-3 py-3 sticky left-0 bg-forest z-10">Cargo</th>
                  <th className="px-3 py-3">Homologado</th>
                  {Object.entries(CRITERIOS).map(([key, info]) => (
                    <th key={key} className="px-3 py-3">{info.label}</th>
                  ))}
                  <th className="px-3 py-3">C1</th>
                  <th className="px-3 py-3">C2</th>
                  <th className="px-3 py-3">C3</th>
                </tr>
              </thead>
              <tbody>
                {cargos.map((c, idx) => {
                  const val = c.valoracion || {};
                  return (
                    <tr key={c.id} className={`border-b border-emerald-50 hover:bg-emerald-50/20 ${idx % 2 === 0 ? 'bg-white/60' : 'bg-white/90'}`}>
                      <td className="px-3 py-3 font-bold text-forest sticky left-0 bg-inherit z-10">{c.nombre_cargo}</td>
                      <td className="px-3 py-3 text-slate-500">{c.cargo_homologado || '—'}</td>
                      {Object.keys(CRITERIOS).map(field => (
                        <td key={field} className="px-3 py-3">
                          {editingId === c.id && editField === field ? (
                            <div className="flex items-center gap-1">
                              <select 
                                value={editValue} 
                                onChange={e => setEditValue(e.target.value)}
                                className="border border-primary rounded px-1 py-0.5 text-xs"
                              >
                                <option value="">—</option>
                                {CRITERIOS[field].opciones.map(opt => (
                                  <option key={opt} value={opt}>{opt}</option>
                                ))}
                              </select>
                              <button onClick={handleSave} className="text-emerald-600"><Check size={13}/></button>
                              <button onClick={() => setEditingId(null)} className="text-red-400"><X size={13}/></button>
                            </div>
                          ) : (
                            <span 
                              onClick={() => handleEdit(c.id, field, val[field])}
                              className={`cursor-pointer hover:text-primary ${val[field] ? 'font-bold text-primary' : 'text-slate-300 italic'}`}
                            >
                              {val[field] || '—'}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${val.criterio_1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                          {val.criterio_1 || 0}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${val.criterio_2 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                          {val.criterio_2 || 0}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${val.criterio_3 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-400'}`}>
                          {val.criterio_3 || 0}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleIAIndividual(c.id)}
                          disabled={processingId === c.id}
                          className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors disabled:opacity-50"
                          title="Valorar con IA"
                        >
                          {processingId === c.id ? <Loader2 size={12} className="animate-spin" /> : 'IA'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValuacionView;
