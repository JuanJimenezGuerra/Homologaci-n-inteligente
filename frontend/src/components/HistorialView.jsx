import React, { useState, useEffect } from 'react';
import { 
  History, Search, Filter, ChevronDown, ChevronUp, 
  User, Calendar, Building, CheckCircle, AlertCircle, 
  Clock, FileText, Download, RefreshCw, Loader2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com').replace(/\/$/, '');

const getToken = () => localStorage.getItem('token') || '';

const STATUS_COLORS = {
  completado: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pendiente: 'bg-slate-100 text-slate-600 border-slate-200',
  error: 'bg-red-100 text-red-700 border-red-200',
  procesando: 'bg-amber-100 text-amber-700 border-amber-200',
};

const STATUS_ICONS = {
  completado: <CheckCircle size={14} className="text-emerald-500" />,
  pendiente: <Clock size={14} className="text-slate-400" />,
  error: <AlertCircle size={14} className="text-red-400" />,
  procesando: <Loader2 size={14} className="text-amber-500 animate-spin" />,
};

const ProcesoCard = ({ proceso }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl border border-emerald-100 overflow-hidden"
    >
      <div 
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-emerald-50/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 shrink-0">
          <div className={`p-2 rounded-lg ${STATUS_COLORS[proceso.estado] || STATUS_COLORS.pendiente}`}>
            {STATUS_ICONS[proceso.estado] || STATUS_ICONS.pendiente}
          </div>
          <span className="text-2xl font-bold text-forest">{proceso.id}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-forest text-sm">{proceso.nombre_empresa || 'Empresa sin nombre'}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_COLORS[proceso.estado]}`}>
              {proceso.estado?.toUpperCase() || 'PENDIENTE'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {proceso.fecha_creacion ? new Date(proceso.fecha_creacion).toLocaleDateString('es-ES') : 'Sin fecha'}
            </span>
            {proceso.num_cargos > 0 && (
              <span className="flex items-center gap-1">
                <Building size={12} />
                {proceso.num_cargos} cargos
              </span>
            )}
            {proceso.usuario_email && (
              <span className="flex items-center gap-1">
                <User size={12} />
                {proceso.usuario_email}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-right mr-2">
            <div className="text-xs text-slate-400">Valoración</div>
            <div className={`font-bold text-sm ${proceso.valoracion_completa ? 'text-emerald-600' : 'text-slate-400'}`}>
              {proceso.valorados || 0}/{proceso.num_cargos || 0}
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
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Cargos</p>
                  <p className="font-bold text-lg text-forest">{proceso.num_cargos || 0}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Valorados</p>
                  <p className="font-bold text-lg text-emerald-600">{proceso.valorados || 0}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Homologados</p>
                  <p className="font-bold text-lg text-blue-600">{proceso.homologados || 0}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Fecha Creación</p>
                  <p className="font-bold text-sm text-slate-600">
                    {proceso.fecha_creacion ? new Date(proceso.fecha_creacion).toLocaleDateString('es-ES', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    }) : '-'}
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-forest transition-all"
                  onClick={() => window.location.href = `/#/proceso/${proceso.id}`}
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
  const [expanded, setExpanded] = useState(false);

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

  const filteredProcesos = procesos.filter(p => {
    const matchSearch = !searchTerm || 
      (p.nombre_empresa || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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
        <div className="flex gap-2">
          <button
            onClick={loadProcesos}
            className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-all shadow-sm"
          >
            <RefreshCw size={14} />
            Actualizar
          </button>
        </div>
      </div>

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
          <option value="completado">Completado</option>
          <option value="pendiente">Pendiente</option>
          <option value="procesando">En proceso</option>
          <option value="error">Con errores</option>
        </select>
      </div>

      {error && (
        <div className="glass-card rounded-2xl p-4 border border-red-200 bg-red-50 flex items-center gap-3">
          <AlertCircle size={20} className="text-red-500 shrink-0" />
          <p className="text-red-600 text-sm">{error}</p>
          <button onClick={loadProcesos} className="ml-auto text-red-600 font-bold text-sm hover:underline">
            Reintentar
          </button>
        </div>
      )}

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

      <div className="space-y-3">
        {filteredProcesos.map((proceso) => (
          <ProcesoCard key={proceso.id} proceso={proceso} />
        ))}
      </div>
    </div>
  );
};

export default HistorialView;