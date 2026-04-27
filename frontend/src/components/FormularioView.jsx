import React, { useState, useEffect, useRef } from 'react';
import { Building2, Upload as UploadIcon, FileCheck, Loader2, AlertCircle, Files, ArrowRight, CheckCircle, FileText, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com';

function FormularioView({ empresaId, onEmpresaCreated }) {
  // Si ya hay empresa cargada, mostrar estado
  if (empresaId) {
    return <YaCargado empresaId={empresaId} onContinuar={() => onEmpresaCreated(empresaId)} />;
  }

  // Vista principal de carga
  return <CargaPrincipal onSuccess={onEmpresaCreated} />;
}

function YaCargado({ empresaId, onContinuar }) {
  const [nombre, setNombre] = useState('');

  useEffect(() => {
    const cargar = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await fetch(`${API}/empresas/${empresaId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setNombre(data.nombre_empresa || 'Empresa');
        }
      } catch (e) {
        console.error(e);
      }
    };
    cargar();
  }, [empresaId]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Datos ya cargados</h2>
        <p className="text-slate-600 mb-4">{nombre}</p>
        <button onClick={onContinuar} className="btn-primary">
          Ir a Homologación
        </button>
      </div>
    </div>
  );
}

function CargaPrincipal({ onSuccess }) {
  const [step, setStep] = useState(0);
  const [empresa, setEmpresa] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const excelRef = useRef(null);
  const pdfRef = useRef(null);

  const handleExcel = () => {
    if (!empresa.trim()) {
      setError('Escribe el nombre de la empresa');
      return;
    }
    setStep(1);
    setError('');
  };

  const handleUpload = async () => {
    if (!excelFile) {
      setError('Selecciona un archivo Excel');
      return;
    }

    setLoading(true);
    setError('');
    setMensaje('Procesando Excel de requerimientos...');

    const formData = new FormData();
    formData.append('empresa', empresa.trim().toUpperCase());
    formData.append('file', excelFile, excelFile.name);

    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`${API}/uploads/requirements`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      let data = {};
      try {
        data = await res.json();
      } catch (e) {
        console.log('Response text:', await res.text());
      }

      if (res.ok) {
        setMensaje('Procesando archivos adicionales...');
        
        if (pdfFiles.length > 0) {
          const pdfData = new FormData();
          pdfFiles.forEach(f => pdfData.append('files', f));
          await fetch(`${API}/uploads/${data.upload_id}/manuales`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: pdfData,
          });
        }

        setMensaje('Completado!');
        onSuccess(data.upload_id);
      } else {
        setError(data.detail || `Error ${res.status}`);
      }
    } catch (e) {
      console.error('Error upload:', e);
      setError('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePdfChange = (e) => {
    const files = Array.from(e.target.files).filter(f => f.name.endsWith('.pdf'));
    setPdfFiles([...pdfFiles, ...files]);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`px-3 py-1 rounded-full text-sm ${step >= 0 ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>
          1. Empresa
        </div>
        <ArrowRight className="text-slate-300" size={16} />
        <div className={`px-3 py-1 rounded-full text-sm ${step >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>
          2. Archivos
        </div>
      </div>

      {/* Step 0: Empresa */}
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
          {error && step === 0 && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <button
            onClick={handleExcel}
            className="btn-primary mt-4"
            disabled={!empresa.trim()}
          >
            Continuar
          </button>
        </div>
      )}

      {/* Step 1: Archivos */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold mb-4">Cargar Archivos</h2>

          {/* Excel */}
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-500 mb-4"
            onClick={() => excelRef.current?.click()}
          >
            <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setExcelFile(e.target.files[0])} />
            {excelFile ? (
              <div className="flex items-center justify-center gap-2 text-emerald-600">
                <FileCheck className="w-8 h-8" />
                <span>{excelFile.name}</span>
              </div>
            ) : (
              <div className="text-slate-500">
                <UploadIcon className="w-8 h-8 mx-auto mb-2" />
                <p>Archivo Excel de Requerimientos</p>
              </div>
            )}
          </div>

          {/* PDFs opcionales - permite xlsx, doc, pdf */}
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-500 mb-4"
            onClick={() => pdfRef.current?.click()}
          >
            <input ref={pdfRef} type="file" accept=".pdf,.xlsx,.xls,.doc,.docx" multiple className="hidden" onChange={handlePdfChange} />
            <div className="text-slate-500 text-sm">
              <Files className="w-6 h-6 mx-auto mb-1" />
              Descripciones (PDF, Excel, Word) - opcional
            </div>
          </div>

          {pdfFiles.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded text-sm mb-1">
              <span>{f.name}</span>
              <button onClick={() => setPdfFiles(pdfFiles.filter((_, j) => j !== i))} className="text-red-500">X</button>
            </div>
          ))}

          {mensaje && <p className="text-emerald-600 text-sm mt-2">{mensaje}</p>}
          {error && step === 1 && <p className="text-red-500 text-sm mt-2">{error}</p>}

          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep(0)} className="btn-secondary">Atrás</button>
            <button onClick={handleUpload} disabled={loading || !excelFile} className="btn-primary">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Procesar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormularioView;