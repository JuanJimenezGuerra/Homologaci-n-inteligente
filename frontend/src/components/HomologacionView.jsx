import React, { useState, useEffect } from 'react';
import { Link2, Play, Loader2, AlertCircle, Building2, MapPin, User, Edit2, Check, X, MessageSquare, RefreshCw, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const API = (import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com').replace(/\/$/, '');

const STATUS_STYLES = {
  homologado: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
  sugerido: 'bg-purple-100 text-purple-700 border border-purple-300',
  procesando: 'bg-blue-100 text-blue-700 border border-blue-300 animate-pulse',
  sin_coincidencia: 'bg-amber-100 text-amber-700 border border-amber-300',
  pendiente: 'bg-slate-100 text-slate-600 border border-slate-200',
  error: 'bg-red-100 text-red-700 border border-red-300',
};

const StatusBadge = ({ estado }) => {
  const key = (estado || 'pendiente').toLowerCase();
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLES[key] || STATUS_STYLES.pendiente}`}>
      {estado || 'PENDIENTE'}
    </span>
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

  useEffect(() => {
    if (empresaId) loadData();
  }, [empresaId]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('token');

    try {
      const empRes = await fetch(`${API}/uploads/${empresaId}/empresa`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (empRes.ok) setEmpresaData(await empRes.json());

      const cargosRes = await fetch(`${API}/uploads/${empresaId}/cargos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (cargosRes.ok) setCargos(await cargosRes.json());
    } catch (e) {
      setError('Error al cargar datos: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const ejecutarHomologacion = async () => {
    const token = localStorage.getItem('token');
    setProcessing(true);
    setError('');
    setMensaje('Procesando homologacion...');

    try {
      const res = await fetch(`${API}/homologacion/ejecutar?upload_id=${empresaId}&usar_ia=true`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        setMensaje(`Homologacion completada: ${data.matched_exact} matchs exactos, ${data.suggested_ia} sugeridos IA, ${data.not_matched} sin coincidencia`);
        await loadData();
      } else {
        const text = await res.text();
        setError(`Error ${res.status}: ${text.slice(0, 200)}`);
      }
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
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
    setMensaje('Reprocesando homologaciones con observaciones del analista...');

    try {
      const res = await fetch(`${API}/homologacion/reprocesar?upload_id=${empresaId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ observaciones: observaciones.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMensaje(data.mensaje);
        setObservaciones('');
        await loadData();
      } else {
        const text = await res.text();
        setError(`Error ${res.status}: ${text.slice(0, 200)}`);
      }
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
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
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cargo_homologado: editValue, justificacion: 'Editado manualmente por analista' }),
      });
      if (res.ok) {
        setEditingId(null);
        await loadData();
      }
    } catch (e) {
      setError('Error al guardar: ' + e.message);
    }
  };

  const filteredCargos = cargos.filter(c => {
    const matchSearch = (c.nombre_cargo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.area || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.homologacion?.cargo_homologado || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchFilter = filterStatus === 'all' || (c.estado || '').toLowerCase().replace(' ', '_') === filterStatus.toLowerCase();
    return matchSearch && matchFilter;
  });

  const stats = {
    total: cargos.length,
    homologados: cargos.filter(c => (c.estado || '').toLowerCase() === 'homologado').length,
    sugeridos: cargos.filter(c => (c.estado || '').toLowerCase() === 'sugerido').length,
    pendientes: cargos.filter(c => (c.estado || '').toLowerCase() === 'pendiente').length,
    sin_coincidencia: cargos.filter(c => (c.estado || '').toLowerCase().includes('sin_coincidencia')).length,
    no_match: cargos.filter(c => {
      const h = c.homologacion?.cargo_homologado;
      return !h || h === 'SIN COINCIDENCIA' || (c.estado || '').toLowerCase() === 'sin_coincidencia';
    }).length,
  };

  if (loading && cargos.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-primary">
        <Loader2 className="animate-spin" size={24} />
        <span className="font-medium">Cargando datos...</span>
      </div>
    );
  }

  if (cargos.length === 0 && !loading) {
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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Empresa Data Card */}
      {empresaData && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-primary"
        >
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="text-primary w-6 h-6" />
            <h2 className="text-lg font-bold text-forest">{empresaData.nombre_empresa || 'Empresa'}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {empresaData.nit && (
              <div>
                <p className="text-slate-400 text-xs font-medium">NIT</p>
                <p className="font-semibold text-forest">{empresaData.nit}</p>
              </div>
            )}
            {(empresaData.ciudad || empresaData.departamento) && (
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-400 text-xs font-medium">Ubicacion</p>
                  <p className="font-semibold text-forest">{[empresaData.ciudad, empresaData.departamento].filter(Boolean).join(', ')}</p>
                </div>
              </div>
            )}
            {empresaData.sector_economico && (
              <div>
                <p className="text-slate-400 text-xs font-medium">Sector</p>
                <p className="font-semibold text-forest">{empresaData.sector_economico}</p>
              </div>
            )}
            {empresaData.consultor && (
              <div className="flex items-start gap-2">
                <User size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-400 text-xs font-medium">Consultor</p>
                  <p className="font-semibold text-forest">{empresaData.consultor}</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Stats & Controls */}
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
              {stats.no_match > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{stats.no_match} S/C</span>}
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">Todos</option>
              <option value="homologado">Match Exacto</option>
              <option value="sugerido">Sugeridos IA</option>
              <option value="pendiente">Pendientes</option>
              <option value="sin_coincidencia">Sin Coincidencia</option>
            </select>
            <input
              type="text"
              placeholder="Buscar cargo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 w-44"
            />
            <button
              onClick={ejecutarHomologacion}
              disabled={processing}
              className="flex items-center gap-2 bg-forest text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-primary transition-all disabled:opacity-70"
            >
              {processing ? <Loader2 size={16} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
              {processing ? 'PROCESANDO...' : 'EJECUTAR HOMOLOGACION'}
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {mensaje && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-sm font-medium flex items-center gap-2">
          <Check size={14} /> {mensaje}
        </motion.div>
      )}
      {error && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-sm font-medium flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </motion.div>
      )}

      {/* Cargos Table */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-forest text-white text-[10px] font-bold uppercase">
              <tr>
                <th className="px-3 py-3 w-8">#</th>
                <th className="px-3 py-3 min-w-[200px]">Cargo</th>
                <th className="px-3 py-3 min-w-[100px]">Area</th>
                <th className="px-3 py-3 w-28">Estado</th>
                <th className="px-3 py-3 min-w-[250px]">Cargo Homologado (editable)</th>
                <th className="px-3 py-3 min-w-[180px]">Justificacion</th>
                <th className="px-3 py-3 w-20">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {filteredCargos.map((c, idx) => {
                const h = c.homologacion || {};
                const isEditing = editingId === c.id;
                return (
                  <tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    c.estado?.toLowerCase() === 'sugerido' ? 'bg-purple-50/40' :
                    c.estado?.toLowerCase() === 'sin_coincidencia' ? 'bg-amber-50/30' :
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}>
                    <td className="px-3 py-2.5 text-slate-300 font-mono text-center text-xs">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-semibold text-forest">{c.nombre_cargo}</td>
                    <td className="px-3 py-2.5 text-slate-500 text-xs">{c.area}</td>
                    <td className="px-3 py-2.5"><StatusBadge estado={c.estado} /></td>
                    <td className="px-3 py-2.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(c.id); if (e.key === 'Escape') setEditingId(null); }}
                            className="border border-primary rounded px-2 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Escribe o selecciona cargo homologado..."
                          />
                          <button onClick={() => handleSaveEdit(c.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={13} /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-red-400 hover:bg-red-50 rounded"><X size={13} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className={`text-xs ${h.cargo_homologado && h.cargo_homologado !== 'SIN COINCIDENCIA' ? 'text-forest font-medium' : 'text-slate-300 italic'}`}>
                            {h.cargo_homologado || 'Sin homologar'}
                          </span>
                          <button onClick={() => handleEdit(c.id, h.cargo_homologado || '')} className="p-1 text-slate-300 hover:text-primary hover:bg-emerald-50 rounded" title="Editar">
                            <Edit2 size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 text-[10px] max-w-[200px] truncate" title={h.justificacion}>
                      {h.justificacion || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {!isEditing && (
                        <button onClick={() => handleEdit(c.id, h.cargo_homologado || '')} className="p-1 text-slate-400 hover:text-primary hover:bg-emerald-50 rounded" title="Editar">
                          <Edit2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredCargos.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-sm">No hay cargos que coincidan con la busqueda</div>
        )}
      </div>

      {/* Observaciones + Reprocesar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg p-6 border border-purple-100"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-50 rounded-xl">
            <MessageSquare className="text-purple-600" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-lg text-forest">Observaciones del Analista</h3>
            <p className="text-xs text-slate-500">Describe ajustes o indicaciones para que la IA reprocese las homologaciones</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap text-xs">
            <span className="text-slate-400">Filtros rapidos:</span>
            <button onClick={() => setObservaciones(prev => prev + (prev ? '\n' : '') + 'Los cargos de Produccion deben buscar en el area de Operaciones')} className="px-2 py-1 bg-slate-100 rounded hover:bg-slate-200 transition-colors">
              Produccion → Operaciones
            </button>
            <button onClick={() => setObservaciones(prev => prev + (prev ? '\n' : '') + 'Los cargos con "Jefe" o "Coordinador" deben tener nivel jerarquico superior')} className="px-2 py-1 bg-slate-100 rounded hover:bg-slate-200 transition-colors">
              Jefe/Coordinador → nivel superior
            </button>
            <button onClick={() => setObservaciones(prev => prev + (prev ? '\n' : '') + 'Los cargos administrativos no deben aparecer en areas tecnicas')} className="px-2 py-1 bg-slate-100 rounded hover:bg-slate-200 transition-colors">
              Administrativo ≠ Tecnico
            </button>
          </div>

          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            placeholder="Ejemplo: Los cargos del area de Logistica deben homologarse con cargos del area de Cadena de Suministro. Los auxiliares deben ir en nivel basico..."
            rows={4}
            className="w-full border border-purple-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none bg-purple-50/30"
          />

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              {stats.no_match > 0 ? `${stats.no_match} cargos sin coincidencia para reprocesar` : 'Todos los cargos tienen homologacion'}
            </p>
            <button
              onClick={reprocesarHomologacion}
              disabled={reprocessing || !observaciones.trim()}
              className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {reprocessing ? (
                <><Loader2 size={16} className="animate-spin" /> Reprocesando...</>
              ) : (
                <><RefreshCw size={16} /> Reprocesar con IA</>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Next Step */}
      {stats.homologados + stats.sugeridos > 0 && onComplete && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
          <button
            onClick={onComplete}
            className="flex items-center gap-2 bg-forest text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary transition-all shadow-lg"
          >
            Ir a Valuacion <ArrowRight size={16} />
          </button>
        </motion.div>
      )}
    </div>
  );
}

export default HomologacionView;
