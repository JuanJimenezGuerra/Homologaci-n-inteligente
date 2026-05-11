import React, { useState, useEffect } from 'react';
import { 
  History, Search, Filter, ChevronDown, ChevronUp, 
  User, Calendar, Building, CheckCircle, AlertCircle, 
  Clock, FileText, Download, RefreshCw, Loader2, X,
  TrendingUp, Users, Award, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com').replace(/\/$/, '');

const getToken = () => localStorage.getItem('token') || '';

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

const HistorialView = () => {
  const [procesos, setProcesos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');

  useEffect(() => {
    loadProcesos();
  }, []);

  const loadProcesos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/uploads`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (!res.ok) throw new Error('Error cargando procesos');
      const data = await res.json();
      setProcesos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
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
    </div>
  );
};

export default HistorialView;