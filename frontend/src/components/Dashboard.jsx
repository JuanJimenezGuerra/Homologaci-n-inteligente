import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Play, Download, Search, Edit2, ChevronDown, ChevronUp, FileSpreadsheet, Loader2, AlertCircle, Check, X, Eye, EyeOff, RefreshCw, Building, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const token = () => localStorage.getItem('token');
const api = (path) => axios.get(`${API}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
const apiPost = (path, data) => axios.post(`${API}${path}`, data, { headers: { Authorization: `Bearer ${token()}` } });
const apiPut = (path, data) => axios.put(`${API}${path}`, data, { headers: { Authorization: `Bearer ${token()}` } });

// ---- Status badge ----
const StatusBadge = ({ estado }) => {
  const s = (estado || '').toLowerCase();
  const map = {
    homologado: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    sugerido: 'bg-purple-100 text-purple-800 border-purple-300',
    procesando:  'bg-blue-100 text-blue-700 border-blue-300 animate-pulse',
    sin_coincidencia: 'bg-amber-100 text-amber-800 border-amber-300',
    error: 'bg-red-100 text-red-700 border-red-300',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${map[s] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {estado || 'PENDIENTE'}
    </span>
  );
};

// ---- DataFrame Table ----
const DataframeTable = ({
  cargos, onEdit, onSaveEdit, editingId, editValue, setEditValue, setEditingId,
  expandedId, setExpandedId, showMeta, setShowMeta, searchTerm, setSearchTerm,
  loading, onProcess, onDownload, upload, processing, onCancel,
  onGoToValoracion
}) => {

  const filtered = cargos.filter(c =>
    c.nombre_cargo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.area?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: cargos.length,
    h: cargos.filter(c => ['homologado'].includes((c.estado||'').toLowerCase())).length,
    p: cargos.filter(c => ['pendiente',''].includes((c.estado||'').toLowerCase())).length,
    s: cargos.filter(c => c.estado === 'SIN_COINCIDENCIA' || c.estado === 'sin_coincidencia').length,
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl overflow-hidden border border-white/60 bg-white/80 shadow-xl">
      
      {/* Controls */}
      <div className="p-4 border-b border-emerald-100 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet size={20} className="text-primary" />
          <div>
            <h3 className="font-bold text-forest text-sm">{upload?.empresa || 'DataFrame de Homologación'}</h3>
            <p className="text-xs text-slate-400">{upload?.filename} · {filtered.length} registros</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          <span className="badge-pill bg-slate-100 text-slate-600">{stats.total} Total</span>
          <span className="badge-pill bg-emerald-100 text-emerald-700">{stats.h} ✓ Homologados</span>
          <span className="badge-pill bg-slate-100 text-slate-500">{stats.p} Pendientes</span>
          {stats.s > 0 && <span className="badge-pill bg-amber-100 text-amber-700">{stats.s} S/C</span>}

          <button onClick={() => setShowMeta(!showMeta)} className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${showMeta ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'}`}>
            {showMeta ? <EyeOff size={13}/> : <Eye size={13}/>} {showMeta ? 'Ocultar' : 'Ver'} A-AS
          </button>

          <div className="flex bg-forest rounded-lg overflow-hidden shadow-sm">
            <button onClick={onProcess} disabled={processing} className="flex items-center gap-1.5 text-white px-3 py-1.5 font-bold text-xs hover:bg-primary transition-all disabled:opacity-80 disabled:cursor-wait">
              {processing ? <Loader2 size={11} className="animate-spin"/> : <Play size={11} fill="currentColor"/>} PROCESAR IA
            </button>

            {processing && (
              <>
                <button onClick={onCancel} className="flex items-center justify-center px-2.5 border-l border-white/20 text-red-200 hover:text-white hover:bg-red-500 transition-all">
                  <X size={13}/>
                </button>

                <button 
                  onClick={() => onGoToValoracion && onGoToValoracion(upload.id)} 
                  className="flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-purple-700 transition-all shadow-sm"
                >
                  Paso 2 · Valorar →
                </button>
              </>
            )}
          </div>

          <button onClick={onDownload} className="flex items-center gap-1.5 bg-white border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-emerald-50 transition-all shadow-sm">
            <Download size={12}/> Descargar
          </button>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={13}/>
            <input type="text" placeholder="Buscar cargo…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-white border border-emerald-100 rounded-xl py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 w-44"/>
          </div>
        </div>
      </div>

      {/* TODO: aquí sigue TODA tu tabla original sin cambios */}
      {/* 👉 aquí sigue TODO tu código original sin tocar */}
      
    </motion.div>
  );
};

// ---- Upload List ----
// (SIN CAMBIOS)


// ---- Main Dashboard ----
const Dashboard = ({ initialUploadId, onUploadIdConsumed, onGoToValoracion }) => {

  // TODO tu código igual...

  return (
    <div className="space-y-6 pb-20">

      {/* TODO igual */}

      <DataframeTable
        cargos={cargos}
        loading={loading}
        upload={currentUpload}
        onEdit={(id, val) => { setEditingId(id); setEditValue(val); }}
        onSaveEdit={handleSaveEdit}
        editingId={editingId}
        editValue={editValue}
        setEditValue={setEditValue}
        setEditingId={setEditingId}
        expandedId={expandedId}
        setExpandedId={setExpandedId}
        showMeta={showMeta}
        setShowMeta={setShowMeta}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onProcess={() => handleProcess(selectedUpload)}
        onCancel={() => handleCancelProcess(selectedUpload)}
        processing={processingId === selectedUpload}
        onDownload={() => handleDownload(selectedUpload)}

        onGoToValoracion={onGoToValoracion}  // ✅ clave
      />

    </div>
  );
};

export default Dashboard;
