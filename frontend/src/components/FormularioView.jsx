import React, { useState, useRef, useEffect } from 'react';
import { Building2, Upload as UploadIcon, FileCheck, Loader2, AlertCircle, Files, ArrowRight, CheckCircle, FileText, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com';

function FormularioView({ empresaId, onEmpresaCreated }) {
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  
  // Datos
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [uploadId, setUploadId] = useState(null);
  
  const excelInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Si ya tiene empresaId, cargar estado
  useEffect(() => {
    if (empresaId) {
      cargarDatos();
    }
  }, [empresaId]);

  const cargarDatos = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/empresas/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setEmpresaNombre((await res.json()).nombre_empresa || '');
        setStep(3); // Ya cargado
      }
    } catch (e) {
      console.error('Error:', e);
    }
  };

  const handleExcelChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setExcelFile(file);
      setError('');
    } else {
      setError('Archivo debe ser .xlsx o .xls');
    }
  };

  const handlePdfChange = (e) => {
    const files = Array.from(e.target.files).filter(f => f.name.endsWith('.pdf'));
    setPdfFiles([...pdfFiles, ...files]);
  };

  const removePdf = (index) => {
    setPdfFiles(pdfFiles.filter((_, i) => i !== index));
  };

  // Paso 1: Nombre empresa
  const handlePaso1 = () => {
    if (!empresaNombre.trim()) {
      setError('Ingresa el nombre de la empresa');
      return;
    }
    setError('');
    setStep(1);
  };

  // Paso 2: Subir Excel usando endpoint existente
  const handleSubirExcel = async () => {
    if (!excelFile && !empresaNombre) {
      setError('Selecciona un archivo Excel');
      return;
    }

    setLoading(true);
    setError('');
    setMensaje('Procesando archivo Excel...');

    const formData = new FormData();
    formData.append('file', excelFile);
    formData.append('empresa', empresaNombre.trim().toUpperCase());

    const token = localStorage.getItem('token');

    try {
      // Usar endpoint existente que funcionaba
      const res = await fetch(`${API}/uploads/requirements`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadId(data.upload_id);
        setMensaje('Excel procesado correctamente');
        
        // Si hay PDFs, ir a step 2
        if (pdfFiles.length > 0) {
          setStep(2);
        } else {
          // Ir a homologación
          onEmpresaCreated(data.upload_id);
        }
      } else {
        setError(data.detail || 'Error al procesar Excel');
      }
    } catch (e) {
      setError('Error de conexión: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Paso 3: Subir PDFs opcionales
  const handleSubirPDFs = async () => {
    if (!pdfFiles.length || !uploadId) {
      onEmpresaCreated(uploadId);
      return;
    }

    setLoading(true);
    setMensaje(`Subiendo ${pdfFiles.length} archivos...`);

    const formData = new FormData();
    for (const file of pdfFiles) {
      formData.append('files', file);
    }

    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`${API}/uploads/${uploadId}/manuales`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        onEmpresaCreated(uploadId);
      } else {
        const data = await res.json();
        setError(data.detail || 'Error al subir PDFs');
      }
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Si ya está cargado, mostrar resumen
  if (step === 3 && empresaId) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Datos Cargados</h2>
          <p className="text-slate-600">{empresaNombre}</p>
          <button onClick={() => onEmpresaCreated(empresaId)} className="btn-primary mt-6">
            Ir a Homologación
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`px-3 py-1 rounded-full text-sm ${step >= 0 ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>
          1. Empresa
        </div>
        <ArrowRight className="text-slate-300" size={16} />
        <div className={`px-3 py-1 rounded-full text-sm ${step >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>
          2. Excel
        </div>
        <ArrowRight className="text-slate-300" size={16} />
        <div className={`px-3 py-1 rounded-full text-sm ${step >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>
          3. PDFs
        </div>
      </div>

      {/* Step 0: Empresa */}
      {step === 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold mb-4">Nombre de la Empresa</h2>
          <input
            type="text"
            className="input-field"
            value={empresaNombre}
            onChange={(e) => setEmpresaNombre(e.target.value)}
            placeholder="Ej: EXTRUSIONES S.A."
          />
          {error && step === 0 && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <button onClick={handlePaso1} className="btn-primary mt-4" disabled={!empresaNombre.trim()}>
            Continuar
          </button>
        </div>
      )}

      {/* Step 1: Excel */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold mb-4">Archivo de Requerimientos (Excel)</h2>
          
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500"
            onClick={() => excelInputRef.current?.click()}
          >
            <input ref={excelInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelChange} />
            {excelFile ? (
              <div className="flex items-center justify-center gap-2 text-emerald-600">
                <FileCheck className="w-8 h-8" />
                <span className="font-medium">{excelFile.name}</span>
              </div>
            ) : (
              <div className="text-slate-500">
                <UploadIcon className="w-8 h-8 mx-auto mb-2" />
                <p>Seleccionar archivo Excel</p>
                <p className="text-xs">Formatos: .xlsx, .xls</p>
              </div>
            )}
          </div>

          {mensaje && step === 1 && <p className="text-emerald-600 mt-3">{mensaje}</p>}
          {error && step === 1 && <p className="text-red-500 mt-3">{error}</p>}

          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep(0)} className="btn-secondary">Atrás</button>
            <button onClick={handleSubirExcel} disabled={loading || !excelFile} className="btn-primary">
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Procesar
            </button>
          </div>
        </div>
      )}

      {/* Step 2: PDFs */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold mb-2">Descripciones de Cargos (Opcional)</h2>
          <p className="text-sm text-slate-500 mb-4">Sube PDFs con descripciones de cargos</p>
          
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-500" onClick={() => pdfInputRef.current?.click()}>
            <input ref={pdfInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handlePdfChange} />
            <Files className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-500">Agregar PDFs</p>
          </div>

          {pdfFiles.map((file, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg mt-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-500" />
                <span className="text-sm">{file.name}</span>
              </div>
              <button onClick={() => removePdf(i)} className="text-red-500"><X size={16}/></button>
            </div>
          ))}

          {error && step === 2 && <p className="text-red-500 mt-3">{error}</p>}

          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep(1)} className="btn-secondary">Atrás</button>
            <button onClick={handleSubirPDFs} disabled={loading} className="btn-primary">
              {loading ? 'Procesando...' : 'Finalizar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormularioView;