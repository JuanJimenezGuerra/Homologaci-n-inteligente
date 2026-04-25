import React, { useState } from 'react';
import { Upload as UploadIcon, FileCheck, Loader2, AlertCircle, Files, ArrowRight, Building, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

const UploadView = ({ onSuccess }) => {
  const [empresa, setEmpresa] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  const [manualFiles, setManualFiles] = useState([]);
  const [uploadId, setUploadId] = useState(null);
  const [step, setStep] = useState(0); // 0: Empresa, 1: Excel, 2: Manuales
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // URL de la API: Sanitizar para evitar doble barra si el usuario pone una barra al final en Render
  let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  if (apiUrl.endsWith('/')) {
    apiUrl = apiUrl.slice(0, -1);
  }

  const handleExcelUpload = async () => {
    if (!excelFile || !empresa) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', excelFile);
    formData.append('empresa', empresa);

    try {
      const token = localStorage.getItem('token');
      // Enviamos todo en el formData para mayor estabilidad
      const response = await axios.post(`${apiUrl}/uploads/requirements`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setUploadId(response.data.upload_id);
      setStep(2); // Mover a manuales opcionales
    } catch (err) {
      console.error("Upload error:", err);
      if (!err.response) {
        setError('No se pudo conectar con el servidor. Revisa la URL en Render.');
      } else {
        setError(err.response?.data?.detail || 'Error al cargar el archivo. Verifica el formato.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualesUpload = async () => {
    if (!manualFiles.length) {
      onSuccess(uploadId); // Pass upload_id so Dashboard can auto-select it
      return;
    }
    
    setLoading(true);
    const formData = new FormData();
    for (let i = 0; i < manualFiles.length; i++) {
      formData.append('files', manualFiles[i]);
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${apiUrl}/uploads/${uploadId}/manuales`, formData, {
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
        <p className="text-emerald-700/60 text-lg font-medium">Configura la valoración salarial de tu cliente</p>
      </div>

      {/* Progress Stepper */}
      <div className="flex items-center justify-center gap-4 mb-12">
        {[0, 1, 2].map((s) => (
          <React.Fragment key={s}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all shadow-md ${step >= s ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'}`}>
              {step > s ? <CheckCircle size={20} /> : s + 1}
            </div>
            {s < 2 && <div className={`h-1 w-20 rounded transition-all ${step > s ? 'bg-primary' : 'bg-slate-200'}`} />}
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
            className="space-y-8 glass-card p-10 bg-white/60"
          >
            <div className="text-center">
              <h3 className="text-xl font-bold text-forest">Paso 1: Identificación del Cliente</h3>
              <p className="text-slate-500 font-medium">¿Para qué empresa estamos realizando esta valoración?</p>
            </div>
            
            <div className="space-y-4">
              <label className="text-sm font-bold text-emerald-900 ml-1">Nombre de la Empresa Cliente</label>
              <div className="relative">
                <Building className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-600" size={24} />
                <input 
                  type="text"
                  placeholder="Ej: COLANTA S.A.S"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value.toUpperCase())}
                  className="w-full bg-white border-2 border-emerald-100 rounded-2xl py-5 pl-16 pr-6 text-xl font-bold text-forest focus:outline-none focus:border-primary transition-all shadow-inner"
                />
              </div>
            </div>

            <button 
              disabled={!empresa.trim()}
              onClick={() => setStep(1)}
              className="btn-primary w-full py-5 text-xl disabled:opacity-50"
            >
              Continuar a Carga de Datos
              <ArrowRight size={24} />
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
              <h3 className="text-xl font-bold text-forest">Paso 2: Formulario de Requerimientos</h3>
              <p className="text-slate-500 font-medium italic">Empresa: {empresa}</p>
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
            </div>

            <div className="flex gap-4">
              <button onClick={() => setStep(0)} className="btn-secondary flex-1">Atrás</button>
              <button
                onClick={handleExcelUpload}
                disabled={!excelFile || loading}
                className="btn-primary flex-[3] py-4 text-lg"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : <FileCheck size={20} />}
                {loading ? 'Analizando Estructura...' : 'Guardar y Continuar'}
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h3 className="text-xl font-bold text-forest">Paso 3: Descripciones Adicionales (Opcional)</h3>
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
