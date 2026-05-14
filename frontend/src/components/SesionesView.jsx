import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Plus, ArrowRight, CheckCircle, XCircle, Clock,
  RotateCcw, Trash2, ChevronDown, ChevronUp, Briefcase,
  Pencil, X, UserPlus, UserMinus, AlertCircle, FileSpreadsheet,
  Search, Download, Loader2, Users, User, Upload,
  BarChart3, TrendingUp, Layers, Eye,
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

const PTS = {
  conocimientos: { 'Básico': 20, 'Medio': 40, 'Avanzado': 60, 'Experto': 80 },
  experiencia: { 'Mínima': 0.6, '1-2 años': 0.8, '3-5 años': 1.0, '5-7 años': 1.2, '7+ años': 1.4 },
  habilidad_gerencial: { 'No requiere': 10, 'Baja': 20, 'Media': 30, 'Alta': 40 },
  rol_cargo: { 'Individual': 10, 'Supervisión': 15, 'Táctico': 25, 'Estratégico': 35, 'Dirección': 45 },
  contacto: { 'Interno': 5, 'Mixto': 10, 'Externo': 15, 'Cliente': 20 },
  frecuencia: { 'Esporádica': 2, 'Mensual': 4, 'Semanal': 6, 'Diaria': 8, 'Permanente': 10 },
  contenido_relaciones: { 'Informativo': 5, 'Coordinación': 10, 'Negociación': 15, 'Asesoría': 20 },
  complejidad_conceptual: { 'Repetitiva': 10, 'Procedimental': 20, 'Analítica': 30, 'Creativa': 40, 'Estratégica': 50 },
  tendencia: { 'Estable': 0.85, 'Creciente': 1.0, 'Decreciente': 1.15 },
  guias_apoyo: { 'Específicas': 10, 'Generales': 20, 'Políticas': 30, 'Autonomía total': 40 },
  impacto: { 'Mínimo': 10, 'Medio': 20, 'Alto': 30, 'Crítico': 40 },
  autonomia: { 'Nula': 10, 'Supervisada': 20, 'Guiada': 30, 'Total': 40 },
  magnitud: { 'Pequeña': 5, 'Mediana': 10, 'Grande': 15, 'Corporativa': 20 },
};

function calcularScorePreview(form) {
  const pts = PTS;
  const _g = (table, key, def) => (key && table[key] != null) ? table[key] : def;
  const f1 = _g(pts.conocimientos, form.conocimientos, 40) * _g(pts.experiencia, form.experiencia, 1.0) + _g(pts.habilidad_gerencial, form.habilidad_gerencial, 20) + _g(pts.rol_cargo, form.rol_cargo, 15);
  const f2 = _g(pts.contacto, form.contacto, 10) + _g(pts.frecuencia, form.frecuencia, 4) + _g(pts.contenido_relaciones, form.contenido_relaciones, 10);
  const f3 = _g(pts.complejidad_conceptual, form.complejidad_conceptual, 20) * _g(pts.tendencia, form.tendencia_cc, 1.0) + _g(pts.guias_apoyo, form.guias_apoyo, 20) * _g(pts.tendencia, form.tendencia_ga, 1.0);
  const f4 = _g(pts.impacto, form.impacto, 20) + _g(pts.autonomia, form.autonomia, 20) + _g(pts.magnitud, form.magnitud, 10);
  const crit = (parseInt(form.criterio_1) === 1 ? 1 : 0) + (parseInt(form.criterio_2) === 1 ? 1 : 0) + (parseInt(form.criterio_3) === 1 ? 1 : 0);
  const raw = Math.round(f1 + f2 + f3 + f4);
  const total = Math.round(raw * (1 + crit * 0.05));
  let nivel, cat;
  if (total <= 100) { nivel = 'Nivel I'; cat = 1; }
  else if (total <= 150) { nivel = 'Nivel II'; cat = 2; }
  else if (total <= 200) { nivel = 'Nivel III'; cat = 3; }
  else if (total <= 250) { nivel = 'Nivel IV'; cat = 4; }
  else if (total <= 300) { nivel = 'Nivel V'; cat = 5; }
  else if (total <= 350) { nivel = 'Nivel VI'; cat = 6; }
  else if (total <= 400) { nivel = 'Nivel VII'; cat = 7; }
  else { nivel = 'Nivel VIII'; cat = 8; }
  return { f1: Math.round(f1), f2: Math.round(f2), f3: Math.round(f3), f4: Math.round(f4), crit, raw, total, nivel, cat };
}

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

const NIVEL_COLORS = {
  'Nivel I': 'bg-slate-100 text-slate-600',
  'Nivel II': 'bg-blue-50 text-blue-700',
  'Nivel III': 'bg-cyan-50 text-cyan-700',
  'Nivel IV': 'bg-emerald-50 text-emerald-700',
  'Nivel V': 'bg-amber-50 text-amber-700',
  'Nivel VI': 'bg-orange-50 text-orange-700',
  'Nivel VII': 'bg-rose-50 text-rose-700',
  'Nivel VIII': 'bg-purple-50 text-purple-700',
};

function ScoreBar({ score, max }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = score >= 300 ? 'bg-purple-500' : score >= 200 ? 'bg-blue-500' : score >= 100 ? 'bg-emerald-500' : 'bg-slate-400';
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function SessionDashboard({ cargos, sesion }) {
  const stats = useMemo(() => {
    const total = cargos.length;
    const scored = cargos.filter(c => c.version?.puntos_totales != null);
    const avg = scored.length ? Math.round(scored.reduce((s, c) => s + (c.version.puntos_totales || 0), 0) / scored.length) : 0;
    const byNivel = {};
    const byEstado = {};
    scored.forEach(c => {
      const n = c.version.nivel_shr || 'Sin nivel';
      byNivel[n] = (byNivel[n] || 0) + 1;
      const e = c.version.estado || 'BORRADOR';
      byEstado[e] = (byEstado[e] || 0) + 1;
    });
    return { total, scored: scored.length, avg, byNivel, byEstado };
  }, [cargos]);

  return (
    <div className="space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase size={16} className="text-blue-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Cargos</span>
          </div>
          <span className="text-2xl font-bold text-blue-800">{stats.total}</span>
          <span className="text-xs text-blue-600 ml-2">{stats.scored} valorados</span>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-emerald-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Promedio</span>
          </div>
          <span className="text-2xl font-bold text-emerald-800">{stats.avg}</span>
          <span className="text-xs text-emerald-600 ml-2">pts</span>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Layers size={16} className="text-purple-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Niveles</span>
          </div>
          <span className="text-2xl font-bold text-purple-800">{Object.keys(stats.byNivel).length}</span>
          <span className="text-xs text-purple-600 ml-2">distintos</span>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={16} className="text-amber-600" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Definitivas</span>
          </div>
          <span className="text-2xl font-bold text-amber-800">{stats.byEstado['DEFINITIVA'] || 0}</span>
          <span className="text-xs text-amber-600 ml-2">de {stats.total}</span>
        </div>
      </div>

      {/* Distribution by Level */}
      {Object.keys(stats.byNivel).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(stats.byNivel).map(([nivel, count]) => {
            const colors = NIVEL_COLORS[nivel] || 'bg-slate-100 text-slate-600';
            return (
              <span key={nivel} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${colors}`}>
                {nivel} <span className="opacity-70">x{count}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Full Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left py-3 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-500">Cargo</th>
              <th className="text-left py-3 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-500">Área</th>
              <th className="text-center py-3 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-500">Puntaje</th>
              <th className="text-center py-3 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-500">Nivel SHR</th>
              <th className="text-center py-3 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-500">Cat</th>
              <th className="text-center py-3 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-500">Estado</th>
              <th className="text-center py-3 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-500">V</th>
            </tr>
          </thead>
          <tbody>
            {cargos.map(({ cargo, version }) => (
              <tr key={version.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                <td className="py-3 px-4 font-semibold text-slate-800">{cargo?.nombre || `Cargo #${version.cargo_id}`}</td>
                <td className="py-3 px-4 text-slate-500">{cargo?.area_nombre || '-'}</td>
                <td className="py-3 px-4">
                  {version.puntos_totales ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className={`font-bold text-sm ${version.puntos_totales >= 300 ? 'text-purple-700' : version.puntos_totales >= 200 ? 'text-blue-700' : 'text-slate-600'}`}>
                        {version.puntos_totales}
                      </span>
                      <ScoreBar score={version.puntos_totales} max={400} />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300 italic">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {version.nivel_shr ? (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${NIVEL_COLORS[version.nivel_shr] || 'bg-slate-100 text-slate-600'}`}>
                      {version.nivel_shr}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300 italic">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center text-sm font-medium text-slate-600">{version.categoria || '-'}</td>
                <td className="py-3 px-4 text-center"><EstadoBadge estado={version.estado} /></td>
                <td className="py-3 px-4 text-center text-xs text-slate-400">v{version.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {cargos.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400 italic">Sin cargos en esta sesión</div>
        )}
      </div>
    </div>
  );
}

function ParticipantInput({ rol, label, onAdd }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const handleSubmit = async () => {
    if (!value.trim() || saving) return;
    setSaving(true);
    await onAdd(rol, value);
    setValue('');
    setSaving(false);
  };
  return (
    <div className="flex items-center gap-1 flex-1">
      <input value={value} onChange={e => setValue(e.target.value)}
        placeholder="Nombre..."
        className="flex-1 min-w-0 px-2 py-0.5 text-xs border border-slate-300 rounded-lg bg-white"
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
      />
      <button onClick={handleSubmit} className="p-0.5 hover:bg-emerald-100 rounded text-emerald-600 shrink-0">
        {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
      </button>
    </div>
  );
}

function VersionEditModal({ version, cargo, onSave, onClose }) {
  const [form, setForm] = useState({ ...version });
  const score = useMemo(() => calcularScorePreview(form), [form]);

  const LEVEL_COLORS = {
    'Nivel I': 'bg-slate-100 text-slate-600',
    'Nivel II': 'bg-blue-50 text-blue-700',
    'Nivel III': 'bg-cyan-50 text-cyan-700',
    'Nivel IV': 'bg-emerald-50 text-emerald-700',
    'Nivel V': 'bg-amber-50 text-amber-700',
    'Nivel VI': 'bg-orange-50 text-orange-700',
    'Nivel VII': 'bg-rose-50 text-rose-700',
    'Nivel VIII': 'bg-purple-50 text-purple-700',
  };
  const levelColor = LEVEL_COLORS[score.nivel] || 'bg-slate-100 text-slate-600';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await apiPut(`/versiones-valoracion/${version.id}`, form);
    if (res.id) onSave(res);
  };

  const GroupBar = ({ label, value, max, color }) => (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-semibold text-slate-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(value / max * 100, 100)}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-600 w-8 text-right">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-lg text-slate-800">{cargo?.nombre || `Cargo #${version.cargo_id}`}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
        </div>

        {/* Score Preview Panel */}
        <div className="px-6 pt-5 pb-2">
          <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-blue-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Vista previa del puntaje</span>
              <span className="text-[10px] text-slate-400">en tiempo real</span>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${score.total >= 300 ? 'text-purple-700' : score.total >= 200 ? 'text-blue-700' : score.total >= 100 ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {score.total}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">puntos</span>
              </div>
              <div className="col-span-1 flex flex-col items-center justify-center">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${levelColor}`}>{score.nivel}</span>
                <span className="text-[10px] text-slate-400 mt-1">Nivel SHR</span>
              </div>
              <div className="col-span-1 flex flex-col items-center justify-center">
                <span className="text-sm font-bold text-slate-700">Cat. {score.cat}</span>
                <span className="text-[10px] text-slate-400 mt-1">Categoría</span>
              </div>
              <div className="col-span-1 flex flex-col items-center justify-center">
                <span className="text-sm font-bold text-slate-700">{score.crit > 0 ? `+${score.crit * 5}%` : '0%'}</span>
                <span className="text-[10px] text-slate-400 mt-1">Criticidad</span>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <GroupBar label="Saber" value={score.f1} max={300} color="bg-blue-500" />
              <GroupBar label="Contacto" value={score.f2} max={80} color="bg-emerald-500" />
              <GroupBar label="Complejidad" value={score.f3} max={120} color="bg-amber-500" />
              <GroupBar label="Impacto" value={score.f4} max={100} color="bg-purple-500" />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            {FACTORES.map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{f.label}</label>
                <select value={form[f.key] || ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all">
                  <option value="">Seleccionar...</option>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Justificación</label>
            <textarea value={form.justificacion || ''} onChange={e => setForm(s => ({ ...s, justificacion: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {['criterio_1', 'criterio_2', 'criterio_3'].map(c => (
              <div key={c}>
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">{c.replace('_', ' ')}</label>
                <select value={form[c] || 0} onChange={e => setForm(s => ({ ...s, [c]: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                  <option value={0}>0 - No aplica</option>
                  <option value={1}>1 - Aplica</option>
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">Guardar Cambios</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

const ROLES_TALLER = [
  { key: 'consultor', label: 'Consultor', icon: User, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'rh', label: 'RH', icon: User, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'gerente_area', label: 'Gerente Área', icon: User, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'lider_cargo', label: 'Líder del Cargo', icon: User, color: 'bg-orange-50 text-orange-700 border-orange-200' },
];

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
  const [participantes, setParticipantes] = useState([]);
  const [showParticipantes, setShowParticipantes] = useState(false);
  const [editParticipante, setEditParticipante] = useState({ rol: '', nombre: '', email: '' });
  const [activeSubTab, setActiveSubTab] = useState('cargos');

  const loadCargos = async () => {
    setLoadingCargos(true);
    try {
      const res = await apiGet(`/sesiones-valoracion/${sesion.id}/cargos`);
      setCargos(Array.isArray(res) ? res : []);
    } catch { onToast?.('Error al cargar cargos', 'error'); }
    setLoadingCargos(false);
  };

  const loadParticipantes = async () => {
    try {
      const res = await apiGet(`/sesiones-valoracion/${sesion.id}/participantes`);
      setParticipantes(Array.isArray(res) ? res : []);
    } catch { onToast?.('Error al cargar participantes', 'error'); }
  };

  const handleAddParticipante = async (rol, nombre) => {
    if (!nombre.trim()) return;
    try {
      await apiPost(`/sesiones-valoracion/${sesion.id}/participantes`, { rol, nombre, email: '' });
      onToast?.(`${ROLES_TALLER.find(r => r.key === rol)?.label}: ${nombre}`, 'success');
      await loadParticipantes();
    } catch { onToast?.('Error al agregar participante', 'error'); }
  };

  const handleRemoveParticipante = async (participanteId) => {
    try {
      await apiDelete(`/sesiones-valoracion/${sesion.id}/participantes/${participanteId}`);
      onToast?.('Participante eliminado', 'success');
      await loadParticipantes();
    } catch { onToast?.('Error al eliminar participante', 'error'); }
  };

  const participantesCompletos = ROLES_TALLER.every(r =>
    participantes.some(p => p.rol === r.key && p.nombre?.trim())
  );

  const toggleExpand = async () => {
    if (!expanded) {
      await loadCargos();
      await loadParticipantes();
    }
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
            <div className="px-5 pt-4">
              {/* Sub-tabs */}
              <div className="flex items-center gap-1 mb-4 border-b border-slate-200">
                {[
                  { key: 'cargos', label: 'Cargos', icon: Briefcase, count: cargos.length },
                  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
                  { key: 'participantes', label: 'Taller', icon: Users, count: participantes.length, badge: participantesCompletos ? '4/4' : `${participantes.length}/4` },
                ].map(tab => {
                  const Icon = tab.icon;
                  const active = activeSubTab === tab.key;
                  return (
                    <button key={tab.key} onClick={() => setActiveSubTab(tab.key)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${active ? 'border-blue-600 text-blue-700 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>
                      <Icon size={14} />
                      {tab.label}
                      {tab.count != null && <span className="text-[10px] opacity-60">({tab.count})</span>}
                      {tab.badge && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab.badge === '4/4' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{tab.badge}</span>}
                    </button>
                  );
                })}
                <div className="flex-1 flex justify-end gap-2">
                  {activeSubTab !== 'dashboard' && hasFinalVersions && (
                    <button onClick={loadConsolidado} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-semibold hover:bg-blue-100">
                      <FileSpreadsheet size={14} /> Consolidado
                    </button>
                  )}
                  {activeSubTab === 'cargos' && canTransition && (
                    <button onClick={openAddCargo} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold hover:bg-emerald-100">
                      <UserPlus size={14} /> Agregar
                    </button>
                  )}
                </div>
              </div>

              {/* Cargos tab */}
              {activeSubTab === 'cargos' && (
                <>
                  {loadingCargos ? (
                    <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" /></div>
                  ) : cargos.length === 0 ? (
                    <p className="text-sm text-slate-400 italic py-4 text-center">Sin cargos asignados. Presiona "Agregar" para añadir cargos a la sesión.</p>
                  ) : (
                    <div className="space-y-2">
                      {cargos.map(({ cargo, version }) => (
                        <div key={version.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl group">
                          <Briefcase size={14} className="text-orange-500 shrink-0" />
                          <span className="font-medium text-sm text-slate-700 flex-1 truncate">{cargo?.nombre || `Cargo #${version.cargo_id}`}</span>
                          {version.puntos_totales ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${version.puntos_totales >= 300 ? 'bg-purple-100 text-purple-700' : version.puntos_totales >= 200 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                              {version.puntos_totales} pts · {version.nivel_shr || ''}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300 italic shrink-0">— pts</span>
                          )}
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
                </>
              )}

              {/* Dashboard tab */}
              {activeSubTab === 'dashboard' && (
                <SessionDashboard cargos={cargos} sesion={sesion} />
              )}

              {/* Participants tab */}
              {activeSubTab === 'participantes' && (
                <div className="grid grid-cols-2 gap-2">
                  {ROLES_TALLER.map(rol => {
                    const existing = participantes.find(p => p.rol === rol.key);
                    const Icon = rol.icon;
                    return (
                      <div key={rol.key} className={`flex items-center gap-2 p-2 rounded-xl border ${existing ? rol.color : 'border-slate-200 bg-slate-50'} text-sm`}>
                        <Icon size={16} className="shrink-0" />
                        <span className="text-[10px] font-semibold text-slate-500 uppercase shrink-0 w-20">{rol.label}</span>
                        {existing ? (
                          <div className="flex items-center gap-1 flex-1 min-w-0">
                            <span className="text-xs font-medium text-slate-700 truncate">{existing.nombre}</span>
                            {canTransition && (
                              <button onClick={() => handleRemoveParticipante(existing.id)}
                                className="ml-auto p-0.5 hover:bg-red-100 rounded text-red-400 hover:text-red-600 shrink-0">
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        ) : canTransition ? (
                          <ParticipantInput rol={rol.key} label={rol.label} onAdd={handleAddParticipante} />
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Pendiente</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function SesionesView({ initialEmpresaId }) {
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(initialEmpresaId || null);
  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '', metodologia: 'SHR/HAY' });
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [showOrganigrama, setShowOrganigrama] = useState(false);
  const [orgImgUrl, setOrgImgUrl] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  useEffect(() => {
    apiGet('/empresas').then(res => {
      setEmpresas(Array.isArray(res) ? res : []);
      if (initialEmpresaId) {
        setEmpresaId(initialEmpresaId);
        setLoading(true);
        apiGet(`/empresas/${initialEmpresaId}/sesiones-valoracion`).then(r => {
          setSesiones(Array.isArray(r) ? r : []);
          setLoading(false);
        });
      }
    });
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

  const handleSyncFromUpload = async () => {
    const uploadId = window.prompt('ID del upload de requerimientos (ej: 1):');
    if (!uploadId || !uploadId.trim()) return;
    const res = await fetch(`${API}/uploads/${uploadId}/sync-organigrama`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`✅ ${data.created} cargos sincronizados desde requerimientos`, 'success');
      if (empresaId) loadSesiones(empresaId);
    } else {
      showToast(`Error: ${data.detail || 'desconocido'}`, 'error');
    }
  };

  const handleViewOrganigrama = async () => {
    const uploadId = window.prompt('ID del upload para ver el organigrama (ej: 1):');
    if (!uploadId || !uploadId.trim()) return;
    setOrgImgUrl(`${API}/uploads/${uploadId}/organigrama?t=${Date.now()}`);
    setZoomLevel(1);
    setShowOrganigrama(true);
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
          <button onClick={handleViewOrganigrama}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <Eye size={14} /> Ver Organigrama
          </button>
          <button onClick={handleSyncFromUpload}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <Upload size={14} /> Sinc. Req.
          </button>
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

      {/* Organigrama Modal */}
      <AnimatePresence>
        {showOrganigrama && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowOrganigrama(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
              className="bg-white rounded-2xl shadow-2xl w-[90vw] h-[90vh] m-4 flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
                <h3 className="font-bold text-lg text-slate-800">Organigrama</h3>
                <div className="flex items-center gap-3">
                  <button onClick={() => setZoomLevel(z => Math.max(0.25, z - 0.25))} className="px-2 py-1 border border-slate-300 rounded text-sm hover:bg-slate-50">-</button>
                  <span className="text-sm font-mono w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                  <button onClick={() => setZoomLevel(z => Math.min(4, z + 0.25))} className="px-2 py-1 border border-slate-300 rounded text-sm hover:bg-slate-50">+</button>
                  <button onClick={() => setZoomLevel(1)} className="px-2 py-1 border border-slate-300 rounded text-sm hover:bg-slate-50">1:1</button>
                  <button onClick={() => setZoomLevel(2)} className="px-2 py-1 border border-slate-300 rounded text-sm hover:bg-slate-50">Ajustar</button>
                  <button onClick={() => setShowOrganigrama(false)} className="p-1 hover:bg-slate-100 rounded ml-2"><X size={20} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-slate-100/50">
                {orgImgUrl ? (
                  <div className="inline-block" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}>
                    <img src={orgImgUrl} alt="Organigrama" className="max-w-none shadow-lg rounded-lg" onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<p class=\\"text-red-500 p-8\\">No se pudo cargar la imagen. Verifica el ID del upload.</p>'; }} />
                  </div>
                ) : (
                  <p className="text-slate-400">Cargando...</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} onClose={() => setToast(t => ({ ...t, visible: false }))} />
    </div>
  );
}
