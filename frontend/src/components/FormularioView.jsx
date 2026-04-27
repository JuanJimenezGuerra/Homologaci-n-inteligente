import React, { useState, useRef, useEffect } from 'react';
import { Building2, Upload as UploadIcon, FileCheck, Loader2, AlertCircle, Files, ArrowRight, CheckCircle, FileText } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com';

function FormularioView({ empresaId, onEmpresaCreated }) {
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(0); // 0: Empresa, 1: Excel, 2: PDFs
  
  // Datos empresa
  const [empresaNombre, setEmpresaNombre] = useState('');
  
  // Archivos
  const [excelFile, setExcelFile] = useState(null);
  const [pdfFiles, setPdfFiles] = useState([]);
  const [uploadId, setUploadId] = useState(null);
  
  const excelInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // Si ya tiene empresaId, mostrar que ya está procesado
  useEffect(() => {
    if (empresaId) {
      verificarEstado();
    }
  }, [empresaId]);

  const verificarEstado = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/empresas/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.cargos && data.cargos.length > 0) {
          setStep(3); // Ya procesado
        }
      }
    } catch (e) {
      console.error('Error:', e);
    }
  };

  const handleExcelChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setExcelFile(file);
      setError('');
    }
  };

  const handlePdfChange = (e) => {
    const files = Array.from(e.target.files);
    setPdfFiles([...pdfFiles, ...files]);
  };

  const removePdf = (index) => {
    setPdfFiles(pdfFiles.filter((_, i) => i !== index));
  };

  const procesarPaso1 = async () => {
    if (!empresaNombre.trim()) {
      setError('Ingresa el nombre de la empresa');
      return;
    }
    setStep(1);
  };

  const procesarExcel = async () => {
    if (!excelFile && !empresaId) {
      setError('Selecciona un archivo Excel');
      return;
    }

    setLoading(true);
    setError('');
    setMensaje('Procesando archivo Excel de requerimientos...');

    const formData = new FormData();
    formData.append('empresa', empresaNombre.trim().toUpperCase());
    if (excelFile) {
      formData.append('file', excelFile);
    }

    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`${API}/procesar/formulario`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadId(data.upload_id || data.empresa_id);
        setMensaje('Excel procesado correctamente');
        
        // Si hay PDFs, ir a step 2, sino terminar
        if (pdfFiles.length > 0) {
          setStep(2);
        } else {
          // Finalizar
          onEmpresaCreated(data.empresa_id);
        }
      } else {
        setError(data.detail || 'Error al procesar');
      }
    } catch (e) {
      setError('Error de conexión: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const procesarPDFs = async () => {
    if (!pdfFiles.length || !uploadId) {
      onEmpresaCreated(uploadId || empresaId);
      return;
    }

    setLoading(true);
    setMensaje(`Procesando ${pdfFiles.length} archivos...`);

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
        setError(data.detail || 'Error al procesar PDFs');
      }
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Si ya está procesado, mostrar opción de continuar o recargar
  if (step === 3 && empresaId) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Datos Cargados</h2>
          <p className="text-slate-600 mb-6">Los datos de la empresa han sido cargados.</p>
          <button onClick={() => onEmpresaCreated(empresaId)} className="btn-primary">
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
          3. PDFs (opcional)
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
          {error && step === 0 && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
          <button
            onClick={procesarPaso1}
            className="btn-primary mt-4"
            disabled={!empresaNombre.trim()}
          >
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
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleExcelChange}
            />
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

          {/* Mensajes */}
          {mensaje && step === 1 && (
            <div className="flex items-center gap-2 text-emerald-600 mt-4">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{mensaje}</span>
            </div>
          )}
          {error && step === 1 && (
            <div className="flex items-center gap-2 text-red-600 mt-4">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep(0)} className="btn-secondary">
              Atrás
            </button>
            <button
              onClick={procesarExcel}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Procesar Excel
            </button>
          </div>
        </div>
      )}

      {/* Step 2: PDFs opcionales */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-lg font-bold mb-4">Descripciones de Cargos (Opcional)</h2>
          <p className="text-sm text-slate-500 mb-4">
            Sube archivos PDF con descripciones de cargos (manuales, perfiles, etc.)
          </p>
          
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-500"
            onClick={() => pdfInputRef.current?.click()}
          >
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf"
              multiple
              className="hidden"
              onChange={handlePdfChange}
            />
            <Files className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-slate-500">Agregar más PDFs</p>
          </div>

          {/* Lista de PDFs */}
          {pdfFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              {pdfFiles.map((file, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-red-500" />
                    <span className="text-sm">{file.name}</span>
                  </div>
                  <button onClick={() => removePdf(i)} className="text-red-500 text-sm">
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && step === 2 && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={() => setStep(1)} className="btn-secondary">
              Atrás
            </button>
            <button onClick={procesarPDFs} disabled={loading} className="btn-primary">
              {loading ? 'Procesando...' : 'Finalizar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormularioView;