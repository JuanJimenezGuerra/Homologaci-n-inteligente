import React, { useState, useRef } from 'react';
import { Building2, Upload as UploadIcon, FileCheck, Loader2, Files, ArrowRight, CheckCircle } from 'lucide-react';

const API = 'https://shr-backend-prod.onrender.com';

function FormularioView({ empresaId, onEmpresaCreated }) {
  if (empresaId) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold">Datos ya cargados</h2>
          <button onClick={() => onEmpresaCreated(empresaId)} className="btn-primary mt-4">
            Ir a Homologación
          </button>
        </div>
      </div>
    );
  }

  return <CargaPrincipal onSuccess={onEmpresaCreated} />;
}

function CargaPrincipal({ onSuccess }) {
  const [step, setStep] = useState(0);
  const [empresa, setEmpresa] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  const [extraFiles, setExtraFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const excelRef = useRef(null);
  const extraRef = useRef(null);

  const handleP1 = () => {
    if (!empresa.trim()) {
      setError('Nombre de empresa requerido');
      return;
    }
    setStep(1);
    setError('');
  };

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
    formData.append('empresa', empresa.trim().toUpperCase());
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
        setError(`Error ${res.status}: ${text.slice(0, 100)}`);
        return;
      }

      const data = await res.json();
      const uploadId = data.upload_id;

      // Subir archivos extra si hay
      if (extraFiles.length > 0) {
        const extraForm = new FormData();
        extraFiles.forEach(f => extraForm.append('files', f));
        try {
          await fetch(`${API}/uploads/${uploadId}/manuales`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: extraForm,
          });
        } catch {}
      }

      onSuccess(uploadId);
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`px-3 py-1 rounded-full text-sm ${step >= 0 ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>1. Empresa</div>
        <ArrowRight className="text-slate-300" size={16} />
        <div className={`px-3 py-1 rounded-full text-sm ${step >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>2. Archivos</div>
      </div>

      {step === 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold mb-4">Nombre de la Empresa</h2>
          <input
            type="text"
            className="input-field"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            placeholder="Ej: EXTRUSIONES S.A."
          />
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <button onClick={handleP1} className="btn-primary mt-4" disabled={!empresa.trim()}>
            Continuar
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold mb-4">Cargar Archivo de Requerimientos</h2>

          {/* Excel required */}
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-500 mb-4"
            onClick={() => excelRef.current?.click()}
          >
            <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelSelect} />
            {excelFile ? (
              <div className="flex items-center justify-center gap-2 text-emerald-600">
                <FileCheck className="w-8 h-8" />
                <span>{excelFile.name}</span>
              </div>
            ) : (
              <div className="text-slate-500">
                <UploadIcon className="w-8 h-8 mx-auto mb-2" />
                <p>Archivo Excel de Requerimientos *</p>
              </div>
            )}
          </div>

          {/* Extra files optional */}
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-500 mb-4"
            onClick={() => extraRef.current?.click()}
          >
            <input ref={extraRef} type="file" accept=".pdf,.xlsx,.xls,.doc,.docx" multiple className="hidden" onChange={handleExtraSelect} />
            <div className="text-slate-500 text-sm">
              <Files className="w-6 h-6 mx-auto mb-1" />
              Descripciones adicionales (opcional)
            </div>
          </div>

          {extraFiles.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded text-sm mb-1">
              <span>{f.name}</span>
              <button onClick={() => removeExtra(i)} className="text-red-500">X</button>
            </div>
          ))}

          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep(0)} className="btn-secondary">Atrás</button>
            <button onClick={handleSubmit} disabled={loading || !excelFile} className="btn-primary">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              {loading ? 'Procesando...' : 'Procesar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormularioView;