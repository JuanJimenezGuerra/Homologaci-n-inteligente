import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Plus, ArrowRight, CheckCircle, XCircle, Clock,
  RotateCcw, Trash2, ChevronDown, ChevronUp, Briefcase,
  Pencil, X, UserPlus, UserMinus, AlertCircle, FileSpreadsheet,
  Search, Download, Loader2,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com';
const API_BASE = `${API}/api/v1`;
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
};

const ESTADO_STYLES = {
  PENDIENTE:   { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Clock },
  EN_PROCESO:  { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: RotateCcw },
  FINALIZADA:  { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle },
  APROBADA:    { bg: 'bg-green-50',  text: 'text-green-700',  icon: CheckCircle },
  CANCELADA:   { bg: 'bg-red-50',    text: 'text-red-600',    icon: XCircle },
  BORRADOR:    { bg: 'bg-slate-100', text: 'text-slate-600',  icon: Clock },
  EN_REVISION: { bg: 'bg-blue-50',   text: 'text-blue-700',   icon: RotateCcw },
  RECHAZADA:   { bg: 'bg-red-50',    text: 'text-red-600',    icon: XCircle },
  DEFINITIVA:  { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle },
  HISTORICA:   { bg: 'bg-slate-100', text: 'text-slate-400',  icon: Clock },
};

const SESION_TRANSICIONES = {
  PENDIENTE:  ['EN_PROCESO', 'CANCELADA'],
  EN_PROCESO: ['FINALIZADA', 'CANCELADA', 'PENDIENTE'],
  FINALIZADA: ['APROBADA', 'EN_PROCESO', 'CANCELADA'],
  APROBADA:   [],
  CANCELADA:  ['PENDIENTE'],
};

const VERSION_TRANSICIONES = {
  BORRADOR:    ['EN_REVISION', 'RECHAZADA'],
  EN_REVISION: ['APROBADA', 'RECHAZADA', 'BORRADOR'],
  APROBADA:    ['DEFINITIVA', 'EN_REVISION'],
  RECHAZADA:   ['EN_REVISION', 'BORRADOR'],
  DEFINITIVA:  ['HISTORICA'],
  HISTORICA:   [],
};

const FACTORES = [
  { key: 'conocimientos', label: 'Conocimientos', options: ['Básico', 'Medio', 'Avanzado', 'Experto'] },
  { key: 'experiencia', label: 'Experiencia', options: ['Mínima', '1-2 años', '3-5 años', '5-7 años', '7+ años'] },
  { key: 'habilidad_gerencial', label: 'Habilidad Gerencial', options: ['No requiere', 'Baja', 'Media', 'Alta'] },
  { key: 'rol_cargo', label: 'Rol del Cargo', options: ['Individual', 'Supervisión', 'Táctico', 'Estratégico', 'Dirección'] },
  { key: 'contacto', label: 'Contacto', options: ['Interno', 'Mixto', 'Externo', 'Cliente'] },
  { key: 'frecuencia', label: 'Frecuencia', options: ['Esporádica', 'Mensual', 'Semanal', 'Diaria', 'Permanente'] },
  { key: 'contenido_relaciones', label: 'Contenido Relaciones', options: ['Informativo', 'Coordinación', 'Negociación', 'Asesoría'] },
  { key: 'complejidad_conceptual', label: 'Complejidad Conceptual', options: ['Repetitiva', 'Procedimental', 'Analítica', 'Creativa', 'Estratégica'] },
  { key: 'tendencia_cc', label: 'Tendencia CC', options: ['Estable', 'Creciente', 'Decreciente'] },
  { key: 'guias_apoyo', label: 'Guías Apoyo', options: ['Específicas', 'Generales', 'Políticas', 'Autonomía total'] },
  { key: 'tendencia_ga', label: 'Tendencia GA', options: ['Estable', 'Creciente', 'Decreciente'] },
  { key: 'impacto', label: 'Impacto', options: ['Mínimo', 'Medio', 'Alto', 'Crítico'] },
  { key: 'autonomia', label: 'Autonomía', options: ['Nula', 'Supervisada', 'Guiada', 'Total'] },
  { key: 'magnitud', label: 'Magnitud', options: ['Pequeña', 'Mediana', 'Grande', 'Corporativa'] },
];

function apiGet(path) {
  return fetch(`${API_BASE}${path}`, { headers: getAuthHeaders() }).then(r => r.json());
}
function apiPost(path, data) {
  return fetch(`${API_BASE}${path}`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) }).then(r => r.json());
}
function apiPut(path, data) {
  return fetch(`${API_BASE}${path}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data) }).then(r => r.json());
}
function apiDelete(path) {
  return fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: getAuthHeaders() }).then(r => r.json());
}

function EstadoBadge({ estado }) {
  const s = ESTADO_STYLES[estado] || ESTADO_STYLES.PENDIENTE;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <Icon size={10} /> {estado}
    </span>
  );
}

function Toast({ message, type, visible, onClose }) {
  if (!visible) return null;
  const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
      className={`fixed top-4 right-4 z-[100] ${bg} text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium`}>
      {type === 'success' ? <CheckCircle size={18} /> : type === 'error' ? <XCircle size={18} /> : <AlertCircle size={18} />}
      {message}
      <button onClick={onClose} className="ml-2 hover:opacity-70"><X size={16} /></button>
    </motion.div>
  );
}

function TransicionLabel(estado) {
  const labels = {
    EN_PROCESO: 'Iniciar', FINALIZADA: 'Finalizar', APROBADA: 'Aprobar',
    CANCELADA: 'Cancelar', PENDIENTE: 'Reabrir',
    EN_REVISION: 'Enviar a Revisión', RECHAZADA: 'Rechazar', BORRADOR: 'Volver a Borrador',
    DEFINITIVA: 'Hacer Definitiva', HISTORICA: 'Archivar',
  };
  return labels[estado] || estado;
}

function VersionEditModal({ version, cargo, onSave, onClose }) {
  const [form, setForm] = useState({ ...version });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await apiPut(`/versiones-valoracion/${version.id}`, form);
    if (res.id) onSave(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="font-bold text-lg text-slate-800">Editar Valoración: {cargo?.nombre || `Cargo #${version.cargo_id}`}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {FACTORES.map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{f.label}</label>
                {f.options ? (
                  <select value={form[f.key] || ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                    <option value="">Seleccionar...</option>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input value={form[f.key] || ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                )}
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Justificación</label>
            <textarea value={form.justificacion || ''} onChange={e => setForm(s => ({ ...s, justificacion: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {['criterio_1', 'criterio_2', 'criterio_3'].map(c => (
              <div key={c}>
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">{c.replace('_', ' ')}</label>
                <input type="number" value={form[c] || 0} onChange={e => setForm(s => ({ ...s, [c]: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">Guardar Cambios</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function SesionCard({ sesion, empresaId, onRefresh, onToast }) {
  const [expanded, setExpanded] = useState(false);
  const [cargos, setCargos] = useState([]);
  const [loadingCargos, setLoadingCargos] = useState(false);
  const [showAddCargo, setShowAddCargo] = useState(false);
  const [cargosDisponibles, setCargosDisponibles] = useState([]);
  const [editVersion, setEditVersion] = useState(null);
  const [editCargo, setEditCargo] = useState(null);
  const [showConsolidado, setShowConsolidado] = useState(false);
  const [consolidado, setConsolidado] = useState(null);
  const [loadingConsolidado, setLoadingConsolidado] = useState(false);
  const [loadingSesionTrans, setLoadingSesionTrans] = useState(null);
  const [loadingVersionTrans, setLoadingVersionTrans] = useState({});
  const [deleting, setDeleting] = useState(false);
  const [addingCargo, setAddingCargo] = useState(null);

  const loadCargos = async () => {
    setLoadingCargos(true);
    try {
      const res = await apiGet(`/sesiones-valoracion/${sesion.id}/cargos`);
      setCargos(Array.isArray(res) ? res : []);
    } catch { onToast?.('Error al cargar cargos', 'error'); }
    setLoadingCargos(false);
  };

  const toggleExpand = async () => {
    if (!expanded) await loadCargos();
    setExpanded(!expanded);
  };

  const handleSesionTransicion = async (estado) => {
    setLoadingSesionTrans(estado);
    try {
      await apiPost(`/sesiones-valoracion/${sesion.id}/transicion`, { estado });
      onToast?.(`Sesión → ${estado}`, 'success');
      onRefresh();
    } catch { onToast?.('Error en transición', 'error'); }
    setLoadingSesionTrans(null);
  };

  const handleDeleteSesion = async () => {
    if (!confirm('¿Eliminar esta sesión?')) return;
    setDeleting(true);
    try {
      await apiDelete(`/sesiones-valoracion/${sesion.id}`);
      onToast?.('Sesión eliminada', 'success');
      onRefresh();
    } catch { onToast?.('Error al eliminar', 'error'); }
    setDeleting(false);
  };

  const handleVersionTransicion = async (versionId, estado) => {
    setLoadingVersionTrans(s => ({ ...s, [versionId]: estado }));
    try {
      await apiPost(`/versiones-valoracion/${versionId}/transicion`, { estado });
      onToast?.(`Versión → ${estado}`, 'success');
      await loadCargos();
    } catch { onToast?.('Error en transición de versión', 'error'); }
    setLoadingVersionTrans(s => ({ ...s, [versionId]: null }));
  };

  const handleRemoveCargo = async (cargoId) => {
    if (!confirm('¿Quitar este cargo de la sesión?')) return;
    try {
      await apiDelete(`/sesiones-valoracion/${sesion.id}/cargos/${cargoId}`);
      onToast?.('Cargo removido', 'success');
      await loadCargos();
    } catch { onToast?.('Error al remover cargo', 'error'); }
  };

  const openAddCargo = async () => {
    try {
      const res = await apiGet(`/empresas/${empresaId}/cargos-organizacionales`);
      setCargosDisponibles(Array.isArray(res) ? res : []);
      setShowAddCargo(true);
    } catch { onToast?.('Error al cargar cargos disponibles', 'error'); }
  };

  const handleAddCargo = async (cargoId) => {
    setAddingCargo(cargoId);
    try {
      await apiPost(`/sesiones-valoracion/${sesion.id}/cargos`, { cargo_id: cargoId });
      setShowAddCargo(false);
      onToast?.('Cargo agregado', 'success');
      await loadCargos();
    } catch { onToast?.('Error al agregar cargo', 'error'); }
    setAddingCargo(null);
  };

  const openEditVersion = async (version, cargo) => {
    setEditVersion(version);
    setEditCargo(cargo);
  };

  const loadConsolidado = async () => {
    setLoadingConsolidado(true);
    try {
      const res = await apiGet(`/sesiones-valoracion/${sesion.id}/consolidado`);
      setConsolidado(res);
      setShowConsolidado(true);
    } catch { onToast?.('Error al cargar consolidado', 'error'); }
    setLoadingConsolidado(false);
  };

  const exportConsolidadoExcel = () => {
    if (!consolidado?.valoraciones?.length) return;
    const header = 'Cargo,Área,Versión,Estado,' + FACTORES.map(f => f.label).join(',') + '\n';
    const rows = consolidado.valoraciones.map(({ version, cargo }) =>
      [
        `"${cargo?.nombre || `#${version.cargo_id}`}"`,
        `"${cargo?.area_nombre || ''}"`,
        `v${version.version}`,
        version.estado,
        ...FACTORES.map(f => `"${version[f.key] || ''}"`),
      ].join(',')
    ).join('\n');
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `consolidado-${sesion.nombre.replace(/\s+/g, '_')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    onToast?.('Consolidado exportado', 'success');
  };

  const hasFinalVersions = cargos.some(c => c.version?.estado === 'DEFINITIVA' || c.version?.estado === 'APROBADA');

  const canTransition = sesion.estado !== 'APROBADA' && sesion.estado !== 'CANCELADA';

  return (
    <motion.div layout className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="p-5 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="font-bold text-slate-800">{sesion.nombre}</h3>
            <EstadoBadge estado={sesion.estado} />
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {sesion.metodologia && <span>{sesion.metodologia}</span>}
            {sesion.fecha_inicio && <span>Inicio: {new Date(sesion.fecha_inicio).toLocaleDateString()}</span>}
            {sesion.fecha_fin && <span>Fin: {new Date(sesion.fecha_fin).toLocaleDateString()}</span>}
          </div>
          {sesion.descripcion && <p className="text-sm text-slate-600 mt-1">{sesion.descripcion}</p>}
        </div>
        <div className="flex items-center gap-2">
          {SESION_TRANSICIONES[sesion.estado]?.map(est => (
            <button key={est} onClick={() => handleSesionTransicion(est)} disabled={loadingSesionTrans !== null}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${loadingSesionTrans === est ? 'opacity-50 cursor-wait' : 'hover:bg-slate-50'}`}>
              {loadingSesionTrans === est ? <Loader2 size={14} className="animate-spin inline" /> : TransicionLabel(est)}
            </button>
          ))}
          <button onClick={toggleExpand} className="p-2 hover:bg-slate-100 rounded-lg">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {sesion.estado === 'PENDIENTE' && (
            <button onClick={handleDeleteSesion} disabled={deleting} className="p-2 hover:bg-red-50 rounded-lg text-red-500">
              {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-slate-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                  <Briefcase size={14} /> Cargos ({cargos.length})
                </h4>
                <div className="flex gap-2">
                  {hasFinalVersions && (
                    <button onClick={loadConsolidado} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100">
                      <FileSpreadsheet size={14} /> Ver Consolidado
                    </button>
                  )}
                  {canTransition && (
                    <button onClick={openAddCargo} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold hover:bg-emerald-100">
                      <UserPlus size={14} /> Agregar Cargo
                    </button>
                  )}
                </div>
              </div>

              {loadingCargos ? (
                <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" /></div>
              ) : cargos.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-4">Sin cargos asignados</p>
              ) : (
                <div className="space-y-2">
                  {cargos.map(({ cargo, version }) => (
                    <div key={version.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl group">
                      <Briefcase size={14} className="text-orange-500 shrink-0" />
                      <span className="font-medium text-sm text-slate-700 flex-1 truncate">{cargo?.nombre || `Cargo #${version.cargo_id}`}</span>
                      <EstadoBadge estado={version.estado} />
                      <span className="text-xs text-slate-400 shrink-0">v{version.version}</span>
                      {canTransition && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditVersion(version, cargo)} className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600" title="Editar factores"><Pencil size={14} /></button>
                          {VERSION_TRANSICIONES[version.estado]?.map(est => (
                            <button key={est} onClick={() => handleVersionTransicion(version.id, est)}
                              disabled={loadingVersionTrans[version.id] !== undefined && loadingVersionTrans[version.id] !== null}
                              className={`px-2 py-1 text-[10px] font-semibold rounded-lg border transition-all ${loadingVersionTrans[version.id] === est ? 'opacity-50 cursor-wait' : 'hover:bg-white'}`}>
                              {loadingVersionTrans[version.id] === est ? <Loader2 size={10} className="animate-spin inline" /> : TransicionLabel(est)}
                            </button>
                          ))}
                          {version.estado === 'BORRADOR' && (
                            <button onClick={() => handleRemoveCargo(version.cargo_id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title="Quitar"><UserMinus size={14} /></button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showAddCargo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowAddCargo(false)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="font-bold text-lg text-slate-800">Agregar Cargo a Sesión</h3>
              <button onClick={() => setShowAddCargo(false)} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
            </div>
            <div className="p-6 max-h-72 overflow-y-auto space-y-2">
              {cargosDisponibles.filter(c => !cargos.find(({ cargo: cx }) => cx?.id === c.id)).map(c => (
                <button key={c.id} onClick={() => handleAddCargo(c.id)} disabled={addingCargo === c.id}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${addingCargo === c.id ? 'opacity-50 cursor-wait bg-emerald-50' : 'border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'}`}>
                  <span className="font-medium text-sm">{addingCargo === c.id ? <><Loader2 size={12} className="animate-spin inline mr-1" /> Agregando...</> : c.nombre}</span>
                  <span className="text-xs text-slate-400 ml-2">{c.nivel_organizacional || c.codigo || ''}</span>
                </button>
              ))}
              {cargosDisponibles.length === 0 && <p className="text-sm text-slate-400 italic">No hay cargos disponibles</p>}
            </div>
          </motion.div>
        </div>
      )}

      {editVersion && (
        <VersionEditModal version={editVersion} cargo={editCargo}
          onSave={(updated) => { setEditVersion(null); loadCargos(); }}
          onClose={() => setEditVersion(null)}
        />
      )}

      {showConsolidado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowConsolidado(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
              <h3 className="font-bold text-lg text-slate-800">Consolidado: {sesion.nombre}</h3>
              <button onClick={() => setShowConsolidado(false)} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
            </div>
            <div className="p-6">
              {loadingConsolidado ? (
                <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" /></div>
              ) : consolidado?.valoraciones?.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">{consolidado.total} valoración(es) definitiva(s)</p>
                    <button onClick={exportConsolidadoExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold hover:bg-emerald-100">
                      <Download size={14} /> Exportar Excel
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">Cargo</th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">Área</th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">Versión</th>
                          <th className="text-left py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">Estado</th>
                          {FACTORES.slice(0, 5).map(f => (
                            <th key={f.key} className="text-left py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {consolidado.valoraciones.map(({ version, cargo }) => (
                          <tr key={version.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2 px-3 font-medium">{cargo?.nombre || `#${version.cargo_id}`}</td>
                            <td className="py-2 px-3 text-slate-500">{cargo?.area_nombre || '-'}</td>
                            <td className="py-2 px-3 text-slate-500">v{version.version}</td>
                            <td className="py-2 px-3"><EstadoBadge estado={version.estado} /></td>
                            {FACTORES.slice(0, 5).map(f => (
                              <td key={f.key} className="py-2 px-3 text-slate-600">{version[f.key] || '-'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <details className="mt-4">
                    <summary className="text-sm font-semibold text-slate-600 cursor-pointer hover:text-slate-800">Ver todos los factores</summary>
                    <div className="overflow-x-auto mt-2">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">Cargo</th>
                            {FACTORES.map(f => (
                              <th key={f.key} className="text-left py-2 px-3 font-semibold text-slate-500 uppercase text-[10px]">{f.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {consolidado.valoraciones.map(({ version, cargo }) => (
                            <tr key={version.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-2 px-3 font-medium">{cargo?.nombre || `#${version.cargo_id}`}</td>
                              {FACTORES.map(f => (
                                <td key={f.key} className="py-2 px-3 text-slate-600">{version[f.key] || '-'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <FileSpreadsheet size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="font-semibold">Sin valoraciones definitivas</p>
                  <p className="text-sm mt-1">No hay versiones en estado DEFINITIVA o APROBADA en esta sesión</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

export default function SesionesView() {
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '', metodologia: 'SHR/HAY' });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  useEffect(() => {
    apiGet('/empresas').then(res => setEmpresas(Array.isArray(res) ? res : []));
  }, []);

  const loadSesiones = async (eid) => {
    if (!eid) return;
    setLoading(true);
    const res = await apiGet(`/empresas/${eid}/sesiones-valoracion`);
    setSesiones(Array.isArray(res) ? res : []);
    setLoading(false);
  };

  const handleEmpresaChange = (e) => {
    const eid = parseInt(e.target.value);
    setEmpresaId(eid);
    loadSesiones(eid);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await apiPost('/sesiones-valoracion', { ...form, empresa_id: empresaId });
    if (res.id) {
      setShowCreate(false);
      setForm({ nombre: '', descripcion: '', metodologia: 'SHR/HAY' });
      loadSesiones(empresaId);
    }
  };

  return (
    <div className="space-y-6">
      <Toast visible={toast.visible} message={toast.message} type={toast.type} onClose={() => setToast(t => ({ ...t, visible: false }))} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sesiones de Valoración</h1>
          <p className="text-sm text-slate-500 mt-1">Ciclos de valoración por empresa con máquina de estados</p>
        </div>
        <div className="flex gap-3">
          <select value={empresaId || ''} onChange={handleEmpresaChange} className="px-4 py-2 border border-slate-300 rounded-xl text-sm">
            <option value="">Seleccionar empresa...</option>
            {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre_empresa || e.nombre}</option>)}
          </select>
          {empresaId && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
              <Plus size={16} /> Nueva Sesión
            </button>
          )}
        </div>
      </div>

      {!empresaId ? (
        <div className="text-center py-20 text-slate-400">
          <ClipboardList size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-semibold">Selecciona una empresa</p>
          <p className="text-sm mt-1">Elige una empresa para ver sus sesiones de valoración</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" /></div>
      ) : sesiones.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <ClipboardList size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-semibold">Sin sesiones de valoración</p>
          <p className="text-sm mt-1">Crea la primera sesión para comenzar</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sesiones.map(s => <SesionCard key={s.id} sesion={s} empresaId={empresaId} onRefresh={() => loadSesiones(empresaId)} onToast={showToast} />)}
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <h3 className="font-bold text-lg text-slate-800">Nueva Sesión de Valoración</h3>
                <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-slate-100 rounded"><XCircle size={20} /></button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Nombre *</label>
                  <input value={form.nombre} onChange={e => setForm(s => ({ ...s, nombre: e.target.value }))} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Descripción</label>
                  <textarea value={form.descripcion} onChange={e => setForm(s => ({ ...s, descripcion: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Metodología</label>
                  <select value={form.metodologia} onChange={e => setForm(s => ({ ...s, metodologia: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option>SHR/HAY</option>
                    <option>MERCER</option>
                    <option>WTW</option>
                    <option>Personalizada</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
                  <button type="submit" className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">Crear Sesión</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
