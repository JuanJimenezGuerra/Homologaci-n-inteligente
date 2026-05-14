import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Building2, Globe, MapPin, Layers, GitBranch, ClipboardList,
  ChevronRight, ChevronDown, Plus, Pencil, Trash2, Save, X,
  Search, FolderTree, Briefcase, Users, RotateCcw, AlertCircle, Upload, Sparkles,
  Loader2,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com';
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {};
};

// ─── Node types configuration ───
const NODE_TYPES = {
  grupo:      { icon: Building2,   label: 'Grupo Empresarial',  color: 'text-purple-600',  bg: 'bg-purple-50', border: 'border-purple-200', endpoint: 'grupos-empresariales', parentKey: null },
  empresa:    { icon: Globe,       label: 'Empresa',           color: 'text-blue-600',     bg: 'bg-blue-50',   border: 'border-blue-200',   endpoint: 'empresas',              parentKey: 'grupo_empresarial_id' },
  regional:   { icon: MapPin,      label: 'Regional',          color: 'text-emerald-600',  bg: 'bg-emerald-50', border: 'border-emerald-200', endpoint: 'regionales',            parentKey: 'empresa_id' },
  sede:       { icon: Layers,      label: 'Sede',              color: 'text-amber-600',    bg: 'bg-amber-50',  border: 'border-amber-200',  endpoint: 'sedes',                 parentKey: 'regional_id' },
  macro:      { icon: GitBranch,   label: 'Macroproceso',      color: 'text-rose-600',     bg: 'bg-rose-50',   border: 'border-rose-200',   endpoint: 'macroprocesos',         parentKey: 'empresa_id' },
  proceso:    { icon: Layers,      label: 'Proceso',           color: 'text-cyan-600',     bg: 'bg-cyan-50',   border: 'border-cyan-200',   endpoint: 'procesos',              parentKey: 'macroproceso_id' },
  area:       { icon: FolderTree,  label: 'Área',              color: 'text-indigo-600',   bg: 'bg-indigo-50', border: 'border-indigo-200', endpoint: 'areas',                 parentKey: 'proceso_id' },
  cargo:      { icon: Briefcase,   label: 'Cargo',             color: 'text-orange-600',   bg: 'bg-orange-50', border: 'border-orange-200', endpoint: 'cargos-organizacionales', parentKey: 'area_id' },
};

const FIELDS = {
  grupo:    ['nombre', 'descripcion', 'sector_principal', 'tamano', 'pais_principal'],
  empresa:  ['nombre', 'razon_social', 'nit', 'sector_economico', 'subsector', 'tamano_empresa', 'tipo_empresa', 'descripcion_negocio', 'modelo_operativo', 'cadena_valor', 'direccion', 'ciudad', 'telefono', 'persona_contacto', 'email_contacto'],
  regional: ['nombre', 'descripcion', 'responsable'],
  sede:     ['nombre', 'direccion', 'ciudad', 'departamento', 'pais', 'tipo_sede', 'cantidad_empleados'],
  macro:    ['nombre', 'descripcion', 'tipo', 'criticidad'],
  proceso:  ['nombre', 'descripcion', 'lider_proceso', 'criticidad'],
  area:     ['nombre', 'nombre_corto', 'descripcion', 'objetivo', 'responsable', 'tipo_area'],
  cargo:    ['nombre', 'codigo', 'nombre_estandarizado', 'nivel_organizacional', 'modalidad', 'mision', 'objetivo', 'proposito', 'responsabilidades_generales', 'formacion_requerida', 'experiencia'],
};

const FIELD_LABELS = {
  nombre: 'Nombre', descripcion: 'Descripción', sector_principal: 'Sector Principal',
  tamano: 'Tamaño', pais_principal: 'País', razon_social: 'Razón Social',
  nit: 'NIT', sector_economico: 'Sector Económico', subsector: 'Subsector',
  tamano_empresa: 'Tamaño Empresa', tipo_empresa: 'Tipo Empresa',
  descripcion_negocio: 'Descripción del Negocio', modelo_operativo: 'Modelo Operativo',
  cadena_valor: 'Cadena de Valor', direccion: 'Dirección', ciudad: 'Ciudad',
  telefono: 'Teléfono', persona_contacto: 'Persona Contacto', email_contacto: 'Email Contacto',
  responsable: 'Responsable', pais: 'País', tipo_sede: 'Tipo Sede',
  cantidad_empleados: 'Cantidad Empleados', tipo: 'Tipo', criticidad: 'Criticidad',
  lider_proceso: 'Líder Proceso', nombre_corto: 'Nombre Corto', objetivo: 'Objetivo',
  tipo_area: 'Tipo Área', codigo: 'Código', nombre_estandarizado: 'Nombre Estandarizado',
  nivel_organizacional: 'Nivel Organizacional', modalidad: 'Modalidad',
  mision: 'Misión', proposito: 'Propósito', responsabilidades_generales: 'Responsabilidades Generales',
  formacion_requerida: 'Formación Requerida', experiencia: 'Experiencia',
};

const API_BASE = `${API}/api/v1`;

function apiGet(path) {
  return fetch(`${API_BASE}${path}`, { headers: getAuthHeaders() }).then(async r => {
    if (!r.ok) throw new Error(await r.text().then(t => t.slice(0, 200)));
    return r.json();
  });
}
function apiPost(path, data) {
  return fetch(`${API_BASE}${path}`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(data) }).then(async r => {
    if (!r.ok) throw new Error(await r.text().then(t => t.slice(0, 200)));
    return r.json();
  });
}
function apiPut(path, data) {
  return fetch(`${API_BASE}${path}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(data) }).then(async r => {
    if (!r.ok) throw new Error(await r.text().then(t => t.slice(0, 200)));
    return r.json();
  });
}
function apiDelete(path) {
  return fetch(`${API_BASE}${path}`, { method: 'DELETE', headers: getAuthHeaders() }).then(async r => {
    if (!r.ok) throw new Error(await r.text().then(t => t.slice(0, 200)));
    return r.json();
  });
}

// ─── TreeNode Component ───
function TreeNode({ type, data, depth, onRefresh, empresaId }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [operating, setOperating] = useState(false);
  const Icon = NODE_TYPES[type].icon;
  const childTypes = { grupo: 'empresa', empresa: 'regional', regional: 'sede', sede: null, macro: 'proceso', proceso: 'area', area: 'cargo', cargo: null };
  const childType = childTypes[type];
  const fields = FIELDS[type] || [];

  const loadChildren = useCallback(async () => {
    if (!childType) return;
    setLoading(true);
    let path = '';
    const nt = NODE_TYPES[childType];
    if (type === 'grupo') path = `/grupos-empresariales/${data.id}/empresas`;
    else if (type === 'empresa') path = `/empresas/${data.id}/regionales`;
    else if (type === 'regional') path = `/regionales/${data.id}/sedes`;
    else if (type === 'sede') return;
    else if (type === 'macro') path = `/macroprocesos/${data.id}/procesos`;
    else if (type === 'proceso') path = `/procesos/${data.id}/areas`;
    else if (type === 'area') path = `/areas/${data.id}/cargos`;
    try {
      const res = await apiGet(path);
      setChildren(Array.isArray(res) ? res : []);
    } catch (e) { setChildren([]); }
    setLoading(false);
  }, [type, data.id, childType]);

  const toggleExpand = async () => {
    if (!expanded && !children) await loadChildren();
    setExpanded(!expanded);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setOperating(true);
    const payload = { ...formData };
    if (NODE_TYPES[childType]?.parentKey) {
      payload[NODE_TYPES[childType].parentKey] = data.id;
    }
    if (childType === 'empresa') payload.grupo_empresarial_id = data.id;
    if (childType === 'cargo') payload.empresa_id = empresaId || data.empresa_id;
    try {
      await apiPost(`/${nt.endpoint}`, payload);
      setShowForm(false);
      setFormData({});
      await loadChildren();
    } catch (e) { alert('Error al crear: ' + e.message); }
    setOperating(false);
  };

  const nodeEmpresaId = empresaId || data.empresa_id;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setOperating(true);
    const nt = NODE_TYPES[type];
    try {
      await apiPut(`/${nt.endpoint}/${data.id}`, formData);
      setEditing(false);
      onRefresh();
    } catch (e) { alert('Error al actualizar: ' + e.message); }
    setOperating(false);
  };

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar ${data.nombre || data.name || 'este elemento'}?`)) return;
    setOperating(true);
    const nt = NODE_TYPES[type];
    try {
      await apiDelete(`/${nt.endpoint}/${data.id}`);
      onRefresh();
    } catch (e) { alert('Error al eliminar: ' + e.message); }
    setOperating(false);
  };

  if (type === 'sede') {
    return (
      <div className="flex items-center gap-3 py-2 px-4 hover:bg-slate-50 rounded-lg group" style={{ paddingLeft: `${depth * 24 + 16}px` }}>
        <Icon size={16} className={NODE_TYPES[type].color} />
        <span className="font-medium text-sm text-slate-700">{data.nombre || data.name}</span>
        <span className="text-xs text-slate-400">{data.tipo_sede || ''}</span>
        <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
          <button onClick={() => { setEditing(true); setFormData(data); }} className="p-1 hover:bg-blue-100 rounded text-blue-600"><Pencil size={14} /></button>
          <button onClick={handleDelete} className="p-1 hover:bg-red-100 rounded text-red-600"><Trash2 size={14} /></button>
        </div>
        {editing && (
          <ModalEdit title={`Editar ${NODE_TYPES[type].label}`} data={data} fields={fields} onSave={handleUpdate} onClose={() => setEditing(false)} />
        )}
      </div>
    );
  }

  if (type === 'cargo') {
    const valStyle = data.tiene_valoracion_activa
      ? 'bg-emerald-100 text-emerald-700'
      : data.estado_valoracion === 'EN_PROCESO'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-slate-100 text-slate-500';
    return (
      <div className="flex items-center gap-3 py-2 px-4 hover:bg-slate-50 rounded-lg group" style={{ paddingLeft: `${depth * 24 + 16}px` }}>
        <Icon size={16} className={NODE_TYPES[type].color} />
        <span className="font-medium text-sm text-slate-700">{data.nombre || data.name}</span>
        <span className="text-xs text-slate-400">{data.nivel_organizacional || data.codigo || ''}</span>
        {(data.estado_valoracion || data.tiene_valoracion_activa) && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${valStyle}`}>
            {data.tiene_valoracion_activa ? 'VALORADO' : data.estado_valoracion}
          </span>
        )}
        <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
          <button onClick={() => { setEditing(true); setFormData(data); }} className="p-1 hover:bg-blue-100 rounded text-blue-600"><Pencil size={14} /></button>
          <button onClick={handleDelete} className="p-1 hover:bg-red-100 rounded text-red-600"><Trash2 size={14} /></button>
        </div>
        {editing && (
          <ModalEdit title={`Editar ${NODE_TYPES[type].label}`} data={data} fields={fields} onSave={handleUpdate} onClose={() => setEditing(false)} />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 py-2 px-4 hover:bg-slate-50 rounded-lg group" style={{ paddingLeft: `${depth * 24 + 8}px` }}>
        <button onClick={toggleExpand} className="p-0.5 hover:bg-slate-200 rounded">
          {loading ? <div className="w-4 h-4 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" /> :
            expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        </button>
        <Icon size={18} className={NODE_TYPES[type].color} />
        <span className="font-semibold text-sm text-slate-800">{data.nombre || data.name}</span>
        <span className="text-xs text-slate-400 ml-1">{data.sector_principal || data.sector_economico || data.tipo || data.tipo_area || ''}</span>
        {data.estado === 'INACTIVO' && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Inactivo</span>}
        <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
          {operating ? (
            <div className="p-1"><Loader2 size={14} className="animate-spin text-slate-400" /></div>
          ) : (
            <>
              <button onClick={() => { setEditing(true); setFormData(data); }} className="p-1 hover:bg-blue-100 rounded text-blue-600"><Pencil size={14} /></button>
              <button onClick={handleDelete} className="p-1 hover:bg-red-100 rounded text-red-600"><Trash2 size={14} /></button>
              {childType && <button onClick={() => setShowForm(true)} className="p-1 hover:bg-emerald-100 rounded text-emerald-600"><Plus size={14} /></button>}
            </>
          )}
        </div>
      </div>

      {expanded && children && (
        <div className="border-l-2 border-slate-200 ml-6">
          {children.length === 0 && (
            <div className="text-xs text-slate-400 py-2 pl-6 italic">Sin elementos</div>
          )}
          {children.map(child => (
            <TreeNode key={`${childType}-${child.id}`} type={childType} data={child} depth={depth + 1} onRefresh={loadChildren} empresaId={empresaId || data.empresa_id} />
          ))}
        </div>
      )}

      {showForm && (
        <ModalCreate
          title={`Nuevo ${NODE_TYPES[childType]?.label}`}
          fields={FIELDS[childType] || []}
          parentKey={NODE_TYPES[childType]?.parentKey}
          parentId={data.id}
          endpoint={NODE_TYPES[childType]?.endpoint}
          empresaId={nodeEmpresaId}
          onSave={() => { setShowForm(false); loadChildren(); }}
          onClose={() => setShowForm(false)}
        />
      )}

      {editing && (
        <ModalEdit title={`Editar ${NODE_TYPES[type].label}`} data={data} fields={fields} onSave={handleUpdate} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

// ─── Modal Create ───
function ModalCreate({ title, fields, parentKey, parentId, endpoint, empresaId, onSave, onClose }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form };
    if (parentKey) payload[parentKey] = parentId;
    if (endpoint === 'empresas') payload.grupo_empresarial_id = parentId;
    if (endpoint === 'cargos-organizacionales') payload.empresa_id = empresaId || parentId;
    await apiPost(`/${endpoint}`, payload);
    onSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {fields.map(f => (
            <div key={f}>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">{FIELD_LABELS[f] || f}</label>
              {['descripcion', 'mision', 'objetivo', 'proposito', 'responsabilidades_generales', 'formacion_requerida', 'descripcion_negocio', 'modelo_operativo', 'cadena_valor'].includes(f) ? (
                <textarea value={form[f] || ''} onChange={e => setForm(s => ({ ...s, [f]: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" rows={3} />
              ) : (
                <input value={form[f] || ''} onChange={e => setForm(s => ({ ...s, [f]: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              )}
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Modal Edit ───
function ModalEdit({ title, data, fields, onSave, onClose }) {
  const [form, setForm] = useState({ ...data });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(e);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="font-bold text-lg text-slate-800">Editar {title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {fields.filter(f => f !== 'id').map(f => (
            <div key={f}>
              <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">{FIELD_LABELS[f] || f}</label>
              {['descripcion', 'mision', 'objetivo', 'proposito', 'responsabilidades_generales', 'formacion_requerida', 'descripcion_negocio', 'modelo_operativo', 'cadena_valor'].includes(f) ? (
                <textarea value={form[f] || ''} onChange={e => setForm(s => ({ ...s, [f]: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" rows={3} />
              ) : (
                <input value={form[f] || ''} onChange={e => setForm(s => ({ ...s, [f]: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              )}
            </div>
          ))}
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {saving ? <><Loader2 size={14} className="animate-spin inline mr-1" /> Guardando...</> : 'Actualizar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function SyncFromUploadButton({ onRefresh }) {
  const [open, setOpen] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [error, setError] = useState('');

  const fetchUploads = async () => {
    setLoadingUploads(true);
    setError('');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${API}/uploads`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const err = await res.text();
        setError(`Error al cargar: ${err.slice(0, 100)}`);
        setUploads([]);
      } else {
        const data = await res.json();
        setUploads(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) setSelectedId(String(data[0].id));
      }
    } catch (e) {
      setError(e.name === 'AbortError' ? 'La conexión tardó demasiado. El backend en Render tarda ~50s en iniciar. Intenta de nuevo.' : 'Error de conexión al cargar uploads');
      setUploads([]);
    }
    setLoadingUploads(false);
  };

  const handleOpen = () => {
    setOpen(true);
    setResult(null);
    setError('');
    fetchUploads();
  };

  const handleSync = async () => {
    if (!selectedId) return;
    setSyncing(true);
    setResult(null);
    setError('');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${API}/uploads/${selectedId}/sync-organigrama`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, created: data.created, skipped: data.skipped, total: data.total });
        onRefresh?.();
      } else {
        setResult({ ok: false, error: data.detail || 'Error desconocido' });
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        setResult({ ok: false, error: 'La solicitud tardó demasiado. Intenta de nuevo.' });
      } else {
        setResult({ ok: false, error: e.message });
      }
    }
    setSyncing(false);
  };

  const fmtFecha = (u) => {
    try {
      if (u.fecha_creacion) return new Date(u.fecha_creacion).toLocaleDateString();
      if (u.fecha) return new Date(u.fecha).toLocaleDateString();
    } catch {}
    return '?';
  };

  return (
    <>
      <button onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
        <Upload size={16} /> Sincronizar
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => { setOpen(false); setResult(null); }}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="font-bold text-lg text-slate-800">Sincronizar desde Requerimientos</h3>
              <button onClick={() => { setOpen(false); setResult(null); }} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">Convierte los cargos del Excel de requerimientos en cargos organizacionales.</p>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Selecciona una carga</label>
                {loadingUploads ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400 py-3"><Loader2 size={14} className="animate-spin" /> Cargando...</div>
                ) : error ? (
                  <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
                ) : uploads.length === 0 ? (
                  <p className="text-sm text-slate-400 italic py-2">No hay cargas disponibles. Sube un Excel primero desde la pestaña "Formulario".</p>
                ) : (
                  <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                    {uploads.map(u => (
                      <option key={u.id} value={u.id}>
                        #{u.id} - {u.empresa || 'Sin empresa'} ({fmtFecha(u)}) - {u.num_cargos || 0} cargos
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {result && (
                <div className={`p-3 rounded-xl text-sm ${!result.ok ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {!result.ok ? `Error: ${result.error}` : `✅ ${result.created} creados, ${result.skipped} omitidos de ${result.total} total`}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setOpen(false); setResult(null); }} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50">Cerrar</button>
                <button onClick={handleSync} disabled={syncing || uploads.length === 0}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                  {syncing ? <><Loader2 size={14} className="animate-spin inline mr-1" /> Sincronizando...</> : 'Sincronizar'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}


// ─── Main View ───
export default function OrganizacionView({ onNavigate }) {
  const [grupos, setGrupos] = useState([]);
  const [stats, setStats] = useState({ empresas: 0, macroprocesos: 0, cargos: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreateGrupo, setShowCreateGrupo] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadCount, setUploadCount] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    Promise.all([
      apiGet('/grupos-empresariales'),
      apiGet('/empresas'),
      fetch(`${API}/uploads`, { headers: getAuthHeaders(), signal: controller.signal }).then(r => r.ok ? r.json() : []).then(d => Array.isArray(d) ? d.length : 0).catch(() => 0),
    ]).then(([gruposRes, empresasRes, uCount]) => {
      if (cancelled) return;
      clearTimeout(timeout);
      setUploadCount(uCount);
      const empresas = Array.isArray(empresasRes) ? empresasRes : [];
      setGrupos(Array.isArray(gruposRes) ? gruposRes : []);
      Promise.all(empresas.map(e =>
        Promise.all([
          apiGet(`/empresas/${e.id}/macroprocesos`).then(r => Array.isArray(r) ? r.length : 0),
          apiGet(`/empresas/${e.id}/cargos-organizacionales`).then(r => Array.isArray(r) ? r.length : 0),
        ])
      )).then(counts => {
        if (cancelled) return;
        const macroCount = counts.reduce((s, [m]) => s + m, 0);
        const cargoCount = counts.reduce((s, [, c]) => s + c, 0);
        setStats({ empresas: empresas.length, macroprocesos: macroCount, cargos: cargoCount });
      }).catch(() => {});
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [refreshKey]);

  const [grupoForm, setGrupoForm] = useState({ nombre: '', descripcion: '', sector_principal: '', tamano: '', pais_principal: '' });
  const [savingGrupo, setSavingGrupo] = useState(false);

  const handleCreateGrupo = async (e) => {
    e.preventDefault();
    if (!grupoForm.nombre.trim()) { alert('El nombre del grupo es requerido'); return; }
    setSavingGrupo(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(`${API_BASE}/grupos-empresariales`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(grupoForm),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const err = await res.text().then(t => t.slice(0, 200));
        throw new Error(err);
      }
      setShowCreateGrupo(false);
      setGrupoForm({ nombre: '', descripcion: '', sector_principal: '', tamano: '', pais_principal: '' });
      refresh();
    } catch (err) {
      alert(err.name === 'AbortError' ? 'La solicitud tardó demasiado (~60s). El backend en Render se reinicia tras inactividad. Intenta de nuevo.' : 'Error al crear grupo: ' + err.message);
    } finally {
      setSavingGrupo(false);
    }
  };

  const [seeding, setSeeding] = useState(false);
  const handleSeedDemo = async () => {
    setSeeding(true);
    try {
      const res = await fetch(`${API}/demo/seed`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Datos demo creados:\nEmpresa: ${data.empresa}\nCargos: ${data.cargos}\nSesión ID: ${data.sesion_id}\n\nVe a "Sesiones de Valoración" para ver el taller.`);
        refresh();
      } else {
        alert('Error: ' + (data.detail || 'Error desconocido'));
      }
    } catch (e) {
      alert('Error al crear datos demo: ' + e.message);
    }
    setSeeding(false);
  };

  return (
    <div className="space-y-6">
      {/* Welcome banner when no data */}
      {grupos.length === 0 && !loading && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-8 text-white shadow-xl">
          <h2 className="text-2xl font-bold mb-2">Bienvenido a SHR Valoración</h2>
          <p className="text-blue-100 mb-6">Completa esta información para comenzar con la estructura organizacional.</p>
          <div className="grid grid-cols-2 gap-4">
            {uploadCount === 0 ? (
              <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200 mb-1">Paso 1</p>
                <p className="font-semibold">Sube el Excel de Requerimientos</p>
                <p className="text-xs text-blue-200 mt-1">Ve a la pestaña "Formulario" y carga el archivo con los datos de la empresa y los cargos.</p>
              </div>
            ) : (
              <div className="bg-emerald-500/20 backdrop-blur rounded-xl p-4 border border-emerald-400/30">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 mb-1">Paso 1</p>
                <p className="font-semibold flex items-center gap-2">✓ Excel Cargado</p>
                <p className="text-xs text-emerald-200 mt-1">{uploadCount} archivo(s) procesado(s) correctamente.</p>
              </div>
            )}
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200 mb-1">Paso 2</p>
              <p className="font-semibold">Crea un Grupo Empresarial</p>
              <p className="text-xs text-blue-200 mt-1">Usa el botón "Nuevo Grupo" para crear la estructura jerárquica de la organización.</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200 mb-1">Paso 3</p>
              <p className="font-semibold">Sincroniza los Cargos</p>
              <p className="text-xs text-blue-200 mt-1">Usa el botón "Sincronizar" para convertir los cargos del Excel en cargos organizacionales.</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200 mb-1">Paso 4</p>
              <p className="font-semibold">Crea Sesiones de Valoración</p>
              <p className="text-xs text-blue-200 mt-1">Ve a "Sesiones de Valoración" para crear talleres con 4 participantes y valorar cargos.</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Administración Organizacional</h1>
          <p className="text-sm text-slate-500 mt-1">Gestión de estructura: grupos empresariales, empresas, sedes, procesos y cargos</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSeedDemo} disabled={seeding}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50">
            {seeding ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Demo
          </button>
          <SyncFromUploadButton onRefresh={refresh} />
          {onNavigate && (
            <button onClick={() => onNavigate('sesiones')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
              <ClipboardList size={16} /> Sesiones de Valoración
            </button>
          )}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar..." className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 w-48" />
          </div>
          <button onClick={() => setShowCreateGrupo(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700">
            <Plus size={16} /> Nuevo Grupo
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Grupos', value: grupos.length, icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Empresas', value: stats.empresas, icon: Globe, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Macroprocesos', value: stats.macroprocesos, icon: GitBranch, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Cargos', value: stats.cargos, icon: Briefcase, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-5 border border-slate-200`}>
            <div className="flex items-center gap-3">
              <s.icon size={24} className={s.color} />
              <div>
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tree */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Building2 size={48} className="mx-auto mb-4 opacity-30" />
          <p className="font-semibold">No hay grupos empresariales</p>
          <p className="text-sm mt-1">Crea el primer grupo para comenzar</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          {grupos.filter(g => !searchTerm || g.nombre?.toLowerCase().includes(searchTerm.toLowerCase())).map(g => (
            <TreeNode key={`grupo-${g.id}`} type="grupo" data={g} depth={0} onRefresh={refresh} />
          ))}
        </div>
      )}

      {/* Create Grupo Modal */}
      {showCreateGrupo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowCreateGrupo(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="font-bold text-lg text-slate-800">Nuevo Grupo Empresarial</h3>
              <button onClick={() => setShowCreateGrupo(false)} className="p-1 hover:bg-slate-100 rounded"><X size={20} /></button>
            </div>
            <form onSubmit={(e) => e.preventDefault()} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Nombre *</label>
                <input value={grupoForm.nombre} onChange={e => setGrupoForm(s => ({ ...s, nombre: e.target.value }))} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Descripción</label>
                <textarea value={grupoForm.descripcion} onChange={e => setGrupoForm(s => ({ ...s, descripcion: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Sector Principal</label>
                <input value={grupoForm.sector_principal} onChange={e => setGrupoForm(s => ({ ...s, sector_principal: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Tamaño</label>
                  <select value={grupoForm.tamano} onChange={e => setGrupoForm(s => ({ ...s, tamano: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500">
                    <option value="">Seleccionar</option>
                    <option>Pequeño</option>
                    <option>Mediano</option>
                    <option>Grande</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">País Principal</label>
                  <input value={grupoForm.pais_principal} onChange={e => setGrupoForm(s => ({ ...s, pais_principal: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateGrupo(false)} disabled={savingGrupo} className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
                <button type="button" onClick={handleCreateGrupo} disabled={savingGrupo} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                  {savingGrupo ? <><Loader2 size={14} className="animate-spin inline mr-1" /> Guardando...</> : 'Guardar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}


    </div>
  );
}
