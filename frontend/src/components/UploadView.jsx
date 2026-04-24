import React, { useState } from 'react';
import { Upload as UploadIcon, FileCheck, Loader2, AlertCircle, Files, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { motion } from 'framer-motion';

const UploadView = ({ onSuccess }) => {
  const [excelFile, setExcelFile] = useState(null);
  const [manualFiles, setManualFiles] = useState([]);
  const [uploadId, setUploadId] = useState(null);
  const [step, setStep] = useState(1); // 1: Excel, 2: Manuales
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setUploadId(response.data.upload_id);
      setStep(2); // Move to optional manuales
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar el Excel de requerimientos');
    } finally {
      setLoading(false);
    }
  };

  const handleManualesUpload = async () => {
    if (!manualFiles.length) {
      onSuccess(); // If no manuals, just finish
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
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      onSuccess();
    } catch (err) {
      setError('Error al cargar manuales de funciones');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-10">
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-bold text-forest tracking-tight">Iniciar Nuevo Proceso</h2>
        <p className="text-emerald-700/60 text-lg font-medium">Sigue los pasos para cargar la información de la empresa</p>
      </div>

      {/* Progress Stepper */}
      <div className="flex items-center justify-center gap-4 mb-12">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step >= 1 ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-slate-200 text-slate-400'}`}>1</div>
        <div className={`h-1 w-20 rounded transition-all ${step >= 2 ? 'bg-primary' : 'bg-slate-200'}`} />
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step >= 2 ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-slate-200 text-slate-400'}`}>2</div>
      </div>

      {step === 1 ? (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-800">Paso 1: Formulario de Requerimientos</h3>
            <p className="text-slate-500 mt-1 font-medium">Sube el archivo Excel con la estructura de cargos (.xlsx)</p>
          </div>

          <div className="glass-card p-12 rounded-3xl flex flex-col items-center justify-center border-dashed border-2 border-emerald-200 hover:border-primary transition-colors group cursor-pointer relative overflow-hidden bg-white/40">
            <input 
              type="file" 
              accept=".xlsx, .xls"
              onChange={(e) => setExcelFile(e.target.files[0])}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className={`w-16 h-16 ${excelFile ? 'bg-emerald-500' : 'bg-primary'} rounded-2xl flex items-center justify-center shadow-2xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
              {excelFile ? <FileCheck className="text-white" size={28} /> : <UploadIcon className="text-white" size={28} />}
            </div>
            <p className="text-lg font-bold text-forest">{excelFile ? excelFile.name : 'Selecciona el Excel de Requerimientos'}</p>
          </div>

          <button
            onClick={handleExcelUpload}
            disabled={!excelFile || loading}
            className="btn-primary w-full py-4 text-lg"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : <FileCheck size={20} />}
            {loading ? 'Guardando en Base de Datos...' : 'Guardar y Continuar'}
          </button>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <div className="text-center">
            <h3 className="text-xl font-bold text-slate-800">Paso 2: Subir Descripciones de la Empresa</h3>
            <p className="text-slate-500 mt-1 font-medium">Sube los manuales o PDFs (Opcional - Ayuda a la IA a ser más precisa)</p>
          </div>

          <div className="glass-card p-12 rounded-3xl flex flex-col items-center justify-center border-dashed border-2 border-emerald-200 hover:border-emerald-500 transition-colors group cursor-pointer relative overflow-hidden bg-white/40">
            <input 
              type="file" 
              multiple
              onChange={(e) => setManualFiles(Array.from(e.target.files))}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className={`w-16 h-16 ${manualFiles.length > 0 ? 'bg-emerald-600' : 'bg-slate-200'} rounded-2xl flex items-center justify-center shadow-2xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
              <Files className={manualFiles.length > 0 ? "text-white" : "text-slate-400"} size={28} />
            </div>
            <p className="text-lg font-bold text-forest">
              {manualFiles.length > 0 ? `${manualFiles.length} archivos seleccionados` : 'Seleccionar Archivos (PDF, Word, etc.)'}
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => onSuccess()}
              disabled={loading}
              className="btn-secondary flex-1"
            >
              Omitir este paso
            </button>
            <button
              onClick={handleManualesUpload}
              disabled={manualFiles.length === 0 || loading}
              className="btn-primary flex-[2] py-4"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : <FileCheck size={20} />}
              {loading ? 'Subiendo y Vinculando...' : 'Finalizar Carga'}
            </button>
          </div>
        </motion.div>
      )}

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/20 text-red-600 p-4 rounded-2xl flex items-center gap-3 justify-center font-medium"
        >
          <AlertCircle size={20} />
          {error}
        </motion.div>
      )}
    </div>
  );
};

export default UploadView;
