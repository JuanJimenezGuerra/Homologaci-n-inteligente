import React, { useState, useRef } from 'react';
import { Upload as UploadIcon, FileCheck, Loader2, ArrowRight, CheckCircle, AlertCircle, Files } from 'lucide-react';
import { motion } from 'framer-motion';

const API = (import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com').replace(/\/$/, '');

function FormularioView({ empresaId, onEmpresaCreated }) {
  if (empresaId) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold">Datos ya cargados</h2>
          <p className="text-slate-500 mb-4">Empresa ID: {empresaId}</p>
          <button onClick={() => onEmpresaCreated(empresaId)} className="btn-primary mt-4">
            Ir a Homologación
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadId, setUploadId] = useState(null);
  const [detectedEmpresa, setDetectedEmpresa] = useState('');

  const excelRef = useRef(null);
  const extraRef = useRef(null);

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

  const handleSubmit = async () => {
    if (!excelFile) {
      setError('Selecciona el Excel de requerimientos');
      return;
    }

    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', excelFile);

    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`${API}/uploads/requirements`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
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

      // Subir archivos extra si hay
      if (extraFiles.length > 0) {
        const extraForm = new FormData();
        extraFiles.forEach(f => extraForm.append('files', f));
        try {
          await fetch(`${API}/uploads/${newUploadId}/extra-descriptions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: extraForm,
          });
        } catch {}
      }

      onSuccess(newUploadId);
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <h2 className="text-3xl font-bold text-forest">Carga de Requerimientos</h2>
        <p className="text-slate-500 mt-2">Sube el Excel de requerimientos. El nombre de la empresa se detecta automaticamente.</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg p-8"
      >
        {/* Excel required */}
        <div
          className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500 transition-colors mb-6"
          onClick={() => excelRef.current?.click()}
        >
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
              <p className="text-sm mt-1">El archivo debe contener las pestanas "Datos Generales" e "Informacion por cargo"</p>
            </div>
          )}
        </div>

        {/* Extra files optional */}
        <div
          className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-400 transition-colors mb-4"
          onClick={() => extraRef.current?.click()}
        >
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

        {detectedEmpresa && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-700">Empresa detectada: {detectedEmpresa}</span>
          </div>
        )}

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
