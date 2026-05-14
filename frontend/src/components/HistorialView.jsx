import React, { useState, useEffect } from 'react';
import { 
  History, Search, Filter, ChevronDown, ChevronUp, 
  User, Calendar, Building, CheckCircle, AlertCircle, 
  Clock, FileText, Download, RefreshCw, Loader2, X,
  TrendingUp, Users, Award, Target, Eye, EyeOff, Database, Server, Table as TableIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com').replace(/\/$/, '');
const getToken = () => localStorage.getItem('token') || '';
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
};

const STATUS_COLORS = {
  completado: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: '#10b981' },
  pendiente: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: '#94a3b8' },
  error: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', dot: '#ef4444' },
  procesando: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', dot: '#f59e0b' },
};

const ProcesoCard = ({ proceso, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  const statusStyle = STATUS_COLORS[proceso.estado] || STATUS_COLORS.pendiente;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl border border-emerald-100 overflow-hidden hover:border-emerald-200 transition-all"
    >
      <div 
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-emerald-50/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 shrink-0">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusStyle.bg}`}>
            <span className="text-lg font-bold" style={{ color: statusStyle.dot }}>#{proceso.id}</span>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-bold text-forest text-sm">{proceso.nombre_empresa || proceso.empresa || 'Proceso sin nombre'}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
              {proceso.estado?.toUpperCase() || 'PENDIENTE'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {proceso.fecha_creacion ? new Date(proceso.fecha_creacion).toLocaleDateString('es-ES', {
                day: '2-digit', month: 'short', year: 'numeric'
              }) : 'Sin fecha'}
            </span>
            <span className="flex items-center gap-1">
              <Building size={12} />
              {proceso.num_cargos || 0} cargos
            </span>
            {proceso.valorados > 0 && (
              <span className="flex items-center gap-1">
                <Target size={12} />
                {proceso.valorados} valorados
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Progreso</div>
            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${proceso.num_cargos > 0 ? (proceso.valorados / proceso.num_cargos) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-600">
                {proceso.num_cargos > 0 ? Math.round((proceso.valorados / proceso.num_cargos) * 100) : 0}%
              </span>
            </div>
          </div>
          <button className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-emerald-50 transition-all">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-emerald-100"
          >
            <div className="p-4 bg-slate-50/50 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Cargos</p>
                  <p className="font-bold text-xl text-forest">{proceso.num_cargos || 0}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Valorados</p>
                  <p className="font-bold text-xl text-emerald-600">{proceso.valorados || 0}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Homologados</p>
                  <p className="font-bold text-xl text-blue-600">{proceso.homologados || 0}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-100 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Fecha</p>
                  <p className="font-bold text-sm text-slate-600">
                    {proceso.fecha_creacion ? new Date(proceso.fecha_creacion).toLocaleDateString('es-ES') : '-'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={(e) => { e.stopPropagation(); onSelect && onSelect(proceso); }}
                  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-forest transition-all"
                >
                  <FileText size={14} />
                  Ver Detalle
                </button>
                <button className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg font-bold text-xs hover:bg-emerald-50 transition-all">
                  <Download size={14} />
                  Exportar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ESTADO_STYLES = {
  CREATE: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
  UPDATE: { bg: 'bg-blue-100', text: 'text-blue-700', icon: RefreshCw },
  DELETE: { bg: 'bg-red-100', text: 'text-red-700', icon: X },
};

const ENTIDAD_LABELS = {
  empresa: 'Empresa', regional: 'Regional', sede: 'Sede',
  macroproceso: 'Macroproceso', proceso: 'Proceso', area: 'Área',
  cargo_organizacional: 'Cargo', sesion_valoracion: 'Sesión',
  valoracion_version: 'Versión',
};

function AuditRow({ log }) {
  const [showDiff, setShowDiff] = useState(false);
  const s = ESTADO_STYLES[log.accion] || ESTADO_STYLES.UPDATE;
  const Icon = s.icon;
  let antes = null, despues = null;
  try { antes = log.valores_antes ? JSON.parse(log.valores_antes) : null; } catch {}
  try { despues = log.valores_despues ? JSON.parse(log.valores_despues) : null; } catch {}

  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg} shrink-0`}>
          <Icon size={14} className={s.text} />
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-4 gap-2 text-sm">
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Entidad</span>
            <span className="font-medium">{ENTIDAD_LABELS[log.entidad] || log.entidad}</span>
            <span className="text-slate-400 ml-1">#{log.entidad_id}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Acción</span>
            <span className={`font-semibold ${s.text}`}>{log.accion}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Usuario</span>
            <span className="text-slate-600 truncate block">{log.usuario_email || log.usuario_id || '-'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase block">Fecha</span>
            <span className="text-slate-600">{log.timestamp ? new Date(log.timestamp).toLocaleString('es-ES') : '-'}</span>
          </div>
        </div>
        {(antes || despues) && (
          <button onClick={() => setShowDiff(!showDiff)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
            {showDiff ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {showDiff && (antes || despues) && (
        <div className="border-t border-slate-100 p-4 bg-slate-50 grid grid-cols-2 gap-4 text-xs font-mono">
          {antes && (
            <div>
              <p className="font-semibold text-slate-500 mb-1 uppercase text-[10px]">Antes</p>
              <pre className="bg-white p-2 rounded-lg border border-slate-200 overflow-x-auto max-h-40 text-slate-600">{JSON.stringify(antes, null, 2)}</pre>
            </div>
          )}
          {despues && (
            <div>
              <p className="font-semibold text-slate-500 mb-1 uppercase text-[10px]">Después</p>
              <pre className="bg-white p-2 rounded-lg border border-slate-200 overflow-x-auto max-h-40 text-slate-600">{JSON.stringify(despues, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

const HistorialView = () => {
  const [subTab, setSubTab] = useState('procesos');
  const [procesos, setProcesos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState({ entidad: '', accion: '', search: '' });
  const [dbTables, setDbTables] = useState([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [expandedTable, setExpandedTable] = useState(null);

  useEffect(() => {
    if (subTab === 'procesos') loadProcesos();
    if (subTab === 'dbinfo') loadDbInfo();
  }, []);

  useEffect(() => {
    if (subTab === 'auditoria') loadAuditLogs();
    if (subTab === 'dbinfo') loadDbInfo();
  }, [subTab]);

  const fetchWithTimeout = (url, options = {}, timeout = 60000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
  };

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const params = new URLSearchParams();
      if (auditFilter.entidad) params.set('entidad', auditFilter.entidad);
      if (auditFilter.accion) params.set('accion', auditFilter.accion);
      const qs = params.toString();
      const res = await fetchWithTimeout(`${API_BASE}/api/v1/audit-logs${qs ? '?' + qs : ''}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Error cargando auditoría');
      const data = await res.json();
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAudit(false);
    }
  };

  const loadDbInfo = async () => {
    setLoadingDb(true);
    try {
      const res = await fetchWithTimeout(`${API_BASE}/db-info`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Error cargando info de base de datos');
      const data = await res.json();
      setDbTables(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setDbTables([]);
    } finally {
      setLoadingDb(false);
    }
  };

  const loadProcesos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`${API_BASE}/uploads`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Error cargando procesos');
      const data = await res.json();
      setProcesos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.name === 'AbortError' ? 'La solicitud tardó demasiado. El backend en Render tarda ~50s en iniciar. Intenta de nuevo.' : e.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats for dashboard
  const stats = {
    total: procesos.length,
    completados: procesos.filter(p => p.estado === 'completado').length,
    enProceso: procesos.filter(p => p.estado === 'procesando').length,
    pendientes: procesos.filter(p => p.estado === 'pendiente').length,
    totalCargos: procesos.reduce((sum, p) => sum + (p.num_cargos || 0), 0),
    totalValorados: procesos.reduce((sum, p) => sum + (p.valorados || 0), 0),
    totalHomologados: procesos.reduce((sum, p) => sum + (p.homologados || 0), 0),
  };

  const chartData = [
    { name: 'Completados', value: stats.completados, color: '#10b981' },
    { name: 'En Proceso', value: stats.enProceso, color: '#f59e0b' },
    { name: 'Pendientes', value: stats.pendientes, color: '#94a3b8' },
  ];

  const filteredProcesos = procesos.filter(p => {
    const matchSearch = !searchTerm || 
      (p.nombre_empresa || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.empresa || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.usuario_email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchEstado = filterEstado === 'todos' || p.estado === filterEstado;
    return matchSearch && matchEstado;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-primary">
        <Loader2 className="animate-spin" size={24} />
        <span className="font-medium">Cargando historial...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Sub-tab switcher */}
      <div className="flex gap-2 bg-white rounded-xl p-1.5 border border-slate-200 w-fit">
        <button onClick={() => setSubTab('procesos')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${subTab === 'procesos' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
          <div className="flex items-center gap-2"><History size={14} /> Procesos</div>
        </button>
        <button onClick={() => setSubTab('auditoria')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${subTab === 'auditoria' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
          <div className="flex items-center gap-2"><Eye size={14} /> Auditoría</div>
        </button>
        <button onClick={() => setSubTab('dbinfo')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${subTab === 'dbinfo' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
          <div className="flex items-center gap-2"><Database size={14} /> Base de Datos</div>
        </button>
      </div>

      {subTab === 'procesos' && (
      <>
      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4 border border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <History size={24} className="text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-forest">{stats.total}</p>
              <p className="text-xs text-slate-500">Procesos Totales</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{stats.completados}</p>
              <p className="text-xs text-slate-500">Completados</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.totalCargos}</p>
              <p className="text-xs text-slate-500">Cargos Totales</p>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-4 border border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Target size={24} className="text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.totalValorados}</p>
              <p className="text-xs text-slate-500">Cargos Valorados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      {stats.total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card rounded-xl p-4 border border-emerald-100">
            <h3 className="font-bold text-forest mb-4 text-sm">Estado de Procesos</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData.filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass-card rounded-xl p-4 border border-emerald-100">
            <h3 className="font-bold text-forest mb-4 text-sm">Progreso de Valoración</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Cargos', valorados: stats.totalValorados, total: stats.totalCargos }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#e2e8f0" name="Total" />
                  <Bar dataKey="valorados" fill="#10b981" name="Valorados" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest flex items-center gap-2">
            <History size={28} className="text-primary" />
            Historial de Procesos
          </h1>
          <p className="text-sm text-emerald-700/60 font-medium">
            {procesos.length} procesos ejecutados
          </p>
        </div>
        <button
          onClick={loadProcesos}
          className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-all shadow-sm"
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 border border-emerald-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por empresa o usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-emerald-200 rounded-xl text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="px-4 py-2.5 border border-emerald-200 rounded-xl text-sm focus:outline-none focus:border-primary bg-white"
        >
          <option value="todos">Todos los estados</option>
          <option value="completado">Completados</option>
          <option value="procesando">En Proceso</option>
          <option value="pendiente">Pendientes</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card rounded-2xl p-4 border border-red-200 bg-red-50 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500 shrink-0" />
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={loadProcesos} className="ml-auto text-red-600 font-bold text-sm hover:underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredProcesos.length === 0 && !loading && (
        <div className="max-w-3xl mx-auto py-16 text-center space-y-6">
          <div className="inline-flex p-5 bg-emerald-50 rounded-3xl text-primary mb-2">
            <History size={48} />
          </div>
          <h2 className="text-2xl font-bold text-forest">No hay procesos registrados</h2>
          <p className="text-slate-500 text-lg max-w-md mx-auto">
            {searchTerm || filterEstado !== 'todos' 
              ? 'No se encontraron procesos que coincidan con tu búsqueda.'
              : 'Aún no has ejecutado ningún proceso de valoración o homologación.'}
          </p>
        </div>
      )}

      {/* Process List */}
      <div className="space-y-3">
        {filteredProcesos.map((proceso) => (
          <ProcesoCard 
            key={proceso.id} 
            proceso={proceso} 
            onSelect={(p) => console.log('Selected:', p)}
          />
        ))}
      </div>
      </>
      )}

      {subTab === 'auditoria' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Registro de Auditoría</h2>
              <p className="text-sm text-slate-500">Traza de cambios en toda la plataforma</p>
            </div>
            <button onClick={loadAuditLogs} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50">
              <RefreshCw size={14} /> Actualizar
            </button>
          </div>

          {/* Audit filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Buscar por entidad o usuario..." value={auditFilter.search} onChange={e => setAuditFilter(f => ({ ...f, search: e.target.value }))} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <select value={auditFilter.entidad} onChange={e => setAuditFilter(f => ({ ...f, entidad: e.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option value="">Todas las entidades</option>
              {Object.entries(ENTIDAD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={auditFilter.accion} onChange={e => setAuditFilter(f => ({ ...f, accion: e.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
              <option value="">Todas las acciones</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
            <button onClick={loadAuditLogs} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
              <Search size={14} className="inline mr-1" /> Filtrar
            </button>
          </div>

          {loadingAudit ? (
            <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" /></div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Eye size={48} className="mx-auto mb-4 opacity-30" />
              <p className="font-semibold">Sin registros de auditoría</p>
              <p className="text-sm mt-1">No se encontraron registros con los filtros actuales</p>
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs
                .filter(l => !auditFilter.search || 
                  (l.entidad || '').includes(auditFilter.search.toLowerCase()) ||
                  (l.usuario_email || '').toLowerCase().includes(auditFilter.search.toLowerCase()))
                .map(log => <AuditRow key={log.id} log={log} />)
              }
            </div>
          )}
        </div>
      )}

      {subTab === 'dbinfo' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Estructura de la Base de Datos</h2>
              <p className="text-sm text-slate-500">Tablas, columnas y relaciones del backend</p>
            </div>
            <button onClick={loadDbInfo} className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50">
              <RefreshCw size={14} /> Recargar
            </button>
          </div>

          {loadingDb ? (
            <div className="flex items-center justify-center py-16 gap-3 text-primary">
              <Loader2 className="animate-spin" size={24} />
              <span className="font-medium">Cargando estructura...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Database size={24} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{dbTables.length}</p>
                  <p className="text-xs text-slate-500">Tablas en la base de datos</p>
                </div>
                <div className="ml-auto text-xs text-slate-400">
                  <Server size={14} className="inline mr-1" />
                  {import.meta.env.VITE_API_URL || 'shr-backend-prod.onrender.com'}
                </div>
              </div>

              {dbTables.map((table) => (
                <div key={table.name} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                      <TableIcon size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-bold text-slate-800 text-sm">{table.name}</h3>
                      <p className="text-xs text-slate-400">
                        {table.columns?.length || 0} columnas
                        {table.row_count !== undefined && (
                          <span> &middot; {table.row_count.toLocaleString()} registros</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                        {table.columns?.length || 0} cols
                      </span>
                      {table.row_count > 0 && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                          {table.row_count} filas
                        </span>
                      )}
                      {expandedTable === table.name ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>

                  {expandedTable === table.name && (
                    <div className="border-t border-slate-100">
                      {/* Foreign Keys */}
                      {table.foreign_keys?.length > 0 && (
                        <div className="px-4 py-3 bg-blue-50/50 border-b border-slate-100">
                          <p className="text-xs font-bold text-blue-700 mb-2 uppercase tracking-wider">Relaciones</p>
                          <div className="flex flex-wrap gap-2">
                            {table.foreign_keys.map((fk, i) => (
                              <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg font-medium">
                                {fk.constrained_columns?.join(', ')} → {fk.referred_table}({fk.referred_columns?.join(', ')})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Columns */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                              <th className="px-4 py-2">Columna</th>
                              <th className="px-4 py-2">Tipo</th>
                              <th className="px-4 py-2 text-center">Nulo</th>
                              <th className="px-4 py-2 text-center">PK</th>
                              <th className="px-4 py-2 text-center">Auto</th>
                              <th className="px-4 py-2">Default</th>
                            </tr>
                          </thead>
                          <tbody>
                            {table.columns?.map((col, i) => (
                              <tr key={col.name} className={`border-t border-slate-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                <td className="px-4 py-2 font-mono font-medium text-slate-800">{col.name}</td>
                                <td className="px-4 py-2 font-mono text-slate-500">{col.type}</td>
                                <td className="px-4 py-2 text-center">
                                  {col.nullable ? <span className="text-emerald-500 font-bold">SÍ</span> : <span className="text-red-400 font-bold">NO</span>}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {col.primary_key ? <CheckCircle size={14} className="text-amber-500 inline" /> : '—'}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {col.autoincrement ? <CheckCircle size={14} className="text-blue-500 inline" /> : '—'}
                                </td>
                                <td className="px-4 py-2 font-mono text-slate-400">{col.default || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistorialView;