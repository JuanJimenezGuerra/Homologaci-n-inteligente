import React, { useState } from 'react';
import { Upload as UploadIcon, FileCheck, Loader2, AlertCircle, Files, ArrowRight, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const UploadView = ({ onSuccess }) => {
  const [excelFile, setExcelFile] = useState(null);
  const [manualFiles, setManualFiles] = useState([]);
  const [uploadId, setUploadId] = useState(null);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detectedEmpresa, setDetectedEmpresa] = useState('');

  let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  if (apiUrl.endsWith('/')) {
    apiUrl = apiUrl.slice(0, -1);
  }

  const handleExcelUpload = async () => {
    if (!excelFile) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', excelFile);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${apiUrl}/uploads/requirements`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setUploadId(response.data.upload_id);
      if (response.data.empresa) {
        setDetectedEmpresa(response.data.empresa);
      }
      setStep(1);
    } catch (err) {
      console.error("Upload error:", err);
      if (!err.response) {
        if (!navigator.onLine) {
          setError('Sin conexion a internet. Verifica tu red.');
        } else {
          setError('No se pudo conectar con el servidor. El backend puede estar iniciandose (Render free tier tarda ~50s). Intenta en un momento.');
        }
      } else {
        setError(err.response?.data?.detail || 'Error al cargar el archivo. Verifica el formato.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualesUpload = async () => {
    if (!manualFiles.length) {
      onSuccess(uploadId);
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    for (let i = 0; i < manualFiles.length; i++) {
      formData.append('files', manualFiles[i]);
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${apiUrl}/uploads/${uploadId}/manuales`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      onSuccess(uploadId);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Error al cargar manuales';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-10">
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-bold text-forest tracking-tight">Nuevo Proceso de Homologación</h2>
        <p className="text-emerald-700/60 text-lg font-medium">El nombre de la empresa se detecta automaticamente del Excel</p>
      </div>

      {/* Progress Stepper */}
      <div className="flex items-center justify-center gap-4 mb-12">
        {[0, 1].map((s) => (
          <React.Fragment key={s}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all shadow-md ${step >= s ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'}`}>
              {step > s ? <CheckCircle size={20} /> : s + 1}
            </div>
            {s < 1 && <div className={`h-1 w-20 rounded transition-all ${step > s ? 'bg-primary' : 'bg-slate-200'}`} />}
          </React.Fragment>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div 
            key="step0"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h3 className="text-xl font-bold text-forest">Paso 1: Formulario de Requerimientos</h3>
              <p className="text-slate-500 font-medium">Sube el Excel que contiene los datos de la empresa y cargos</p>
            </div>

            <div className="glass-card p-12 rounded-3xl flex flex-col items-center justify-center border-dashed border-2 border-emerald-200 hover:border-primary transition-colors group cursor-pointer relative overflow-hidden bg-white/40">
              <input 
                type="file" 
                accept=".xlsx, .xls"
                onChange={(e) => setExcelFile(e.target.files[0])}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className={`w-20 h-20 ${excelFile ? 'bg-emerald-500' : 'bg-primary'} rounded-3xl flex items-center justify-center shadow-2xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
                {excelFile ? <FileCheck className="text-white" size={32} /> : <UploadIcon className="text-white" size={32} />}
              </div>
              <p className="text-lg font-bold text-forest">{excelFile ? excelFile.name : 'Selecciona el Excel de Requerimientos'}</p>
              {excelFile && <p className="text-sm text-emerald-600/60 mt-1">Listo para procesar</p>}
            </div>

            <button
              onClick={handleExcelUpload}
              disabled={!excelFile || loading}
              className="btn-primary w-full py-5 text-xl disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : <ArrowRight size={24} />}
              {loading ? 'Analizando Estructura...' : 'Subir y Procesar'}
            </button>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h3 className="text-xl font-bold text-forest">Paso 2: Descripciones Adicionales (Opcional)</h3>
              {detectedEmpresa && (
                <p className="text-emerald-600 font-bold mt-1">Empresa: {detectedEmpresa}</p>
              )}
              <p className="text-slate-500 font-medium">Sube manuales o PDFs para que la IA entienda mejor los cargos.</p>
            </div>

            <div className="glass-card p-12 rounded-3xl flex flex-col items-center justify-center border-dashed border-2 border-emerald-200 hover:border-emerald-500 transition-colors group cursor-pointer relative overflow-hidden bg-white/40">
              <input 
                type="file" 
                multiple
                onChange={(e) => setManualFiles(Array.from(e.target.files))}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className={`w-20 h-20 ${manualFiles.length > 0 ? 'bg-emerald-600' : 'bg-slate-200'} rounded-3xl flex items-center justify-center shadow-2xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
                <Files className={manualFiles.length > 0 ? "text-white" : "text-slate-400"} size={32} />
              </div>
              <p className="text-lg font-bold text-forest text-center">
                {manualFiles.length > 0 ? `${manualFiles.length} archivos seleccionados` : 'Arrastra aquí todos los manuales de funciones'}
              </p>
              <p className="text-sm text-emerald-600/60 mt-2 font-medium">PDF, DOCX, XLSX permitidos</p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => onSuccess(uploadId)}
                disabled={loading}
                className="btn-secondary flex-1"
              >
                No tengo manuales (Omitir)
              </button>
              <button
                onClick={handleManualesUpload}
                disabled={manualFiles.length === 0 || loading}
                className="btn-primary flex-[2] py-4"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : <FileCheck size={20} />}
                {loading ? 'Subiendo Manuales...' : 'Finalizar y Procesar'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 text-red-600 p-4 rounded-2xl flex items-center gap-3 justify-center font-bold"
        >
          <AlertCircle size={20} />
          {error}
        </motion.div>
      )}
    </div>
  );
};

export default UploadView;
