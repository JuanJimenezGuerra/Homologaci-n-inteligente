import React, { useState, useRef, useEffect } from 'react';
import { Upload as UploadIcon, FileCheck, Loader2, ArrowRight, CheckCircle, AlertCircle, Files, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';

const API = (import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com').replace(/\/$/, '');
const getToken = () => localStorage.getItem('token') || '';

function FormularioView({ empresaId, onEmpresaCreated }) {
  if (empresaId) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold">Datos ya cargados</h2>
          <p className="text-slate-500 mb-4">Empresa ID: {empresaId}</p>
          <button onClick={() => onEmpresaCreated(empresaId)} className="btn-primary mt-4">
            Ir a Organización
          </button>
        </div>
      </div>
    );
  }

  return <CargaDirecta onSuccess={onEmpresaCreated} />;
}

function CargaDirecta({ onSuccess }) {
  const [excelFile, setExcelFile] = useState(null);
  const [extraFiles, setExtraFiles] = useState([]);
  const [organigramaFile, setOrganigramaFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadId, setUploadId] = useState(null);
  const [detectedEmpresa, setDetectedEmpresa] = useState('');
  const [empresaData, setEmpresaData] = useState(null);
  const [empresaContext, setEmpresaContext] = useState({});
  const [savingContext, setSavingContext] = useState(false);
  const [contextSaved, setContextSaved] = useState(false);
  const [cargos, setCargos] = useState(null);
  const [showCargos, setShowCargos] = useState(true);

  const excelRef = useRef(null);
  const extraRef = useRef(null);
  const organigramaRef = useRef(null);

  const handleExcelSelect = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setExcelFile(file);
      setError('');
    } else {
      setError('Usa archivo .xlsx o .xls');
    }
  };

  const handleExtraSelect = (e) => {
    const files = Array.from(e.target.files);
    setExtraFiles([...extraFiles, ...files]);
  };

  const removeExtra = (i) => {
    setExtraFiles(extraFiles.filter((_, idx) => idx !== i));
  };

  const handleOrganigramaSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setOrganigramaFile(file);
    } else {
      setError('Selecciona una imagen válida');
    }
  };

  const fetchCargos = async (uid) => {
    try {
      const res = await fetch(`${API}/uploads/${uid}/cargos`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCargos(Array.isArray(data) ? data : []);
      }
    } catch {}
  };

  const saveEmpresaContext = async () => {
    if (!empresaData?.id) return;
    setSavingContext(true);
    try {
      const res = await fetch(`${API}/api/v1/empresas/${empresaData.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(empresaContext),
      });
      if (res.ok) {
        setContextSaved(true);
      }
    } catch {}
    setSavingContext(false);
  };

  const handleSubmit = async () => {
    if (!excelFile) {
      setError('Selecciona el Excel de requerimientos');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', excelFile);

    try {
      const res = await fetch(`${API}/uploads/requirements`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        setError(`Error ${res.status}: ${text.slice(0, 200)}`);
        return;
      }

      const data = await res.json();
      const newUploadId = data.upload_id;
      setUploadId(newUploadId);
      if (data.empresa) {
        setDetectedEmpresa(data.empresa);
      }
      if (data.empresa_data) {
        setEmpresaData(data.empresa_data);
        setEmpresaContext({
          sector_economico: data.empresa_data.sector_economico || '',
          tamano_empresa: data.empresa_data.tamano_empresa || '',
          tipo_empresa: data.empresa_data.tipo_empresa || '',
          descripcion_negocio: data.empresa_data.descripcion_negocio || '',
          modelo_operativo: data.empresa_data.modelo_operativo || '',
          motivacion: data.empresa_data.motivacion || '',
          ciudad: data.empresa_data.ciudad || '',
          direccion: data.empresa_data.direccion || '',
          persona_contacto: data.empresa_data.persona_contacto || '',
          email_contacto: data.empresa_data.email_contacto || '',
        });
      }

      // Subir archivos extra si hay
      if (extraFiles.length > 0) {
        const extraForm = new FormData();
        extraFiles.forEach(f => extraForm.append('files', f));
        try {
          const extraRes = await fetch(`${API}/uploads/${newUploadId}/extra-descriptions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` },
            body: extraForm,
          });
          if (!extraRes.ok) console.error('Error uploading extra files:', await extraRes.text());
        } catch (e) {
          console.error('Error uploading extra files:', e);
        }
      }

      // Subir organigrama si hay
      if (organigramaFile) {
        const orgForm = new FormData();
        orgForm.append('file', organigramaFile);
        try {
          await fetch(`${API}/uploads/${newUploadId}/organigrama`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` },
            body: orgForm,
          });
        } catch (e) {
          console.error('Error uploading organigrama:', e);
        }
      }

      // Fetch cargos to show confirmation
      await fetchCargos(newUploadId);
    } catch (e) {
      if (!navigator.onLine) {
        setError('Sin conexion a internet. Verifica tu red.');
      } else if (e.message.includes('fetch')) {
        setError('No se pudo conectar con el servidor. El backend puede estar iniciandose (Render free tier tarda ~50s). Intenta en un momento.');
      } else {
        setError('Error: ' + e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Show confirmation after upload
  if (uploadId && cargos !== null) {
    const areas = [...new Set(cargos.map(c => c.area).filter(Boolean))];
    const empresaId = empresaData?.id || uploadId;
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-forest">Carga Exitosa</h2>
          <p className="text-slate-500 mt-1">El Excel se procesó correctamente</p>
          {detectedEmpresa && (
            <div className="inline-flex items-center gap-2 mt-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
              <CheckCircle size={16} className="text-emerald-600" />
              <span className="font-semibold text-emerald-800">Empresa: {detectedEmpresa}</span>
            </div>
          )}
        </motion.div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 text-center">
            <Briefcase size={20} className="mx-auto mb-1 text-blue-600" />
            <span className="text-2xl font-bold text-slate-800 block">{cargos.length}</span>
            <span className="text-xs text-slate-500">Cargos extraídos</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 text-center">
            <CheckCircle size={20} className="mx-auto mb-1 text-emerald-600" />
            <span className="text-2xl font-bold text-slate-800 block">{areas.length}</span>
            <span className="text-xs text-slate-500">Áreas distintas</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 text-center">
            <ArrowRight size={20} className="mx-auto mb-1 text-amber-600" />
            <span className="text-2xl font-bold text-slate-800 block">Paso 2</span>
            <span className="text-xs text-slate-500">Ir a Organización</span>
          </div>
        </div>

        {/* Company Context Form */}
        {empresaData && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Contexto de la Empresa</h3>
              <p className="text-xs text-slate-400 mt-1">Completa los datos de contexto antes de continuar</p>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Sector Económico</label>
                <input value={empresaContext.sector_economico} onChange={e => setEmpresaContext(s => ({ ...s, sector_economico: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tamaño</label>
                <select value={empresaContext.tamano_empresa} onChange={e => setEmpresaContext(s => ({ ...s, tamano_empresa: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                  <option value="">Seleccionar</option>
                  <option>Pequeña</option><option>Mediana</option><option>Grande</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo</label>
                <select value={empresaContext.tipo_empresa} onChange={e => setEmpresaContext(s => ({ ...s, tipo_empresa: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                  <option value="">Seleccionar</option>
                  <option>Privada</option><option>Pública</option><option>Mixta</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Ciudad</label>
                <input value={empresaContext.ciudad} onChange={e => setEmpresaContext(s => ({ ...s, ciudad: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Descripción del Negocio</label>
                <textarea value={empresaContext.descripcion_negocio} onChange={e => setEmpresaContext(s => ({ ...s, descripcion_negocio: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Modelo Operativo</label>
                <textarea value={empresaContext.modelo_operativo} onChange={e => setEmpresaContext(s => ({ ...s, modelo_operativo: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1">Motivación del Estudio</label>
                <textarea value={empresaContext.motivacion} onChange={e => setEmpresaContext(s => ({ ...s, motivacion: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Persona Contacto</label>
                <input value={empresaContext.persona_contacto} onChange={e => setEmpresaContext(s => ({ ...s, persona_contacto: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Email Contacto</label>
                <input value={empresaContext.email_contacto} onChange={e => setEmpresaContext(s => ({ ...s, email_contacto: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>
            </div>
            <div className="px-5 pb-5">
              <button onClick={saveEmpresaContext} disabled={savingContext || contextSaved}
                className={`px-6 py-2 rounded-xl text-sm font-semibold ${contextSaved ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}>
                {savingContext ? 'Guardando...' : contextSaved ? '✓ Datos guardados' : 'Guardar Contexto'}
              </button>
            </div>
          </motion.div>
        )}

        {/* Cargo table */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <button onClick={() => setShowCargos(!showCargos)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Briefcase size={16} /> Cargos Detectados ({cargos.length})
            </h3>
            {showCargos ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>
          {showCargos && (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left py-3 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-500">Cargo</th>
                    <th className="text-left py-3 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-500">Área</th>
                    <th className="text-left py-3 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-500">Cargo Homologado</th>
                    <th className="text-left py-3 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-500">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cargos.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-semibold text-slate-800">{c.nombre_cargo}</td>
                      <td className="py-3 px-4 text-slate-500">{c.area || '-'}</td>
                      <td className="py-3 px-4 text-slate-500">{c.homologacion?.cargo_homologado || '-'}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.estado === 'PENDIENTE' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                          {c.estado || 'PENDIENTE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Continue button */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
          <button onClick={() => onSuccess(empresaId)}
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg">
            Continuar a Organización <ArrowRight size={20} />
          </button>
          <p className="text-xs text-slate-400 mt-2">Podrás sincronizar los cargos a la estructura organizacional</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-forest">Carga de Requerimientos</h2>
        <p className="text-slate-500 mt-2">Sube el Excel de requerimientos. El nombre de la empresa se detecta automaticamente.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-lg p-8">
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500 transition-colors mb-6"
          onClick={() => excelRef.current?.click()}>
          <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelSelect} />
          {excelFile ? (
            <div className="flex items-center justify-center gap-3 text-emerald-600">
              <FileCheck className="w-10 h-10" />
              <div>
                <p className="font-bold text-lg">{excelFile.name}</p>
                <p className="text-sm text-emerald-500">Listo para procesar</p>
              </div>
            </div>
          ) : (
            <div className="text-slate-500">
              <UploadIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-bold text-lg">Selecciona el Excel de Requerimientos</p>
              <p className="text-sm mt-1">El archivo debe contener las pestañas "Datos Generales" e "Información por cargo"</p>
            </div>
          )}
        </div>

        <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-400 transition-colors mb-4"
          onClick={() => extraRef.current?.click()}>
          <input ref={extraRef} type="file" accept=".pdf,.xlsx,.xls,.doc,.docx" multiple className="hidden" onChange={handleExtraSelect} />
          <div className="text-slate-400 text-sm">
            <Files className="w-5 h-5 mx-auto mb-1" />
            Descripciones adicionales (opcional)
          </div>
        </div>

        {extraFiles.map((f, i) => (
          <div key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded text-sm mb-1">
            <span>{f.name}</span>
            <button onClick={() => removeExtra(i)} className="text-red-500 hover:text-red-700">X</button>
          </div>
        ))}

        <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-400 transition-colors mb-4"
          onClick={() => organigramaRef.current?.click()}>
          <input ref={organigramaRef} type="file" accept="image/*" className="hidden" onChange={handleOrganigramaSelect} />
          <div className="text-slate-400 text-sm">
            <UploadIcon className="w-5 h-5 mx-auto mb-1" />
            {organigramaFile ? `Organigrama: ${organigramaFile.name}` : 'Organigrama (imagen, opcional)'}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-600">{error}</span>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={handleSubmit} disabled={loading || !excelFile} className="btn-primary w-full py-4 text-lg disabled:opacity-50">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRight className="w-5 h-5 mr-2" />}
            {loading ? 'Procesando...' : 'Subir y Procesar'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default FormularioView;
