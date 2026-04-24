import React, { useState } from 'react';
import { Upload as UploadIcon, FileCheck, Loader2, AlertCircle, Files, ArrowRight } from 'lucide-react';
import axios from 'axios';

const UploadView = ({ onSuccess }) => {
  const [excelFile, setExcelFile] = useState(null);
  const [manualFiles, setManualFiles] = useState([]);
  const [uploadId, setUploadId] = useState(null);
  const [step, setStep] = useState(1); // 1: Excel, 2: Manuales
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleExcelUpload = async () => {
    if (!excelFile) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', excelFile);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:8000/uploads/requirements', formData, {
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
      await axios.post(`http://localhost:8000/uploads/${uploadId}/manuales`, formData, {
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
        <h2 className="text-4xl font-bold text-white tracking-tight">Iniciar Nuevo Proceso</h2>
        <p className="text-slate-400 text-lg">Sigue los pasos para cargar la información de la empresa</p>
      </div>

      {/* Progress Stepper */}
      <div className="flex items-center justify-center gap-4 mb-12">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-500'}`}>1</div>
        <div className={`h-1 w-20 rounded ${step >= 2 ? 'bg-primary-600' : 'bg-slate-800'}`} />
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-primary-600 text-white' : 'bg-slate-800 text-slate-500'}`}>2</div>
      </div>

      {step === 1 ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-white">Paso 1: Formulario de Requerimientos</h3>
            <p className="text-slate-400 mt-1">Sube el archivo Excel con la estructura de cargos (.xlsx)</p>
          </div>

          <div className="glass-card p-12 rounded-3xl flex flex-col items-center justify-center border-dashed border-2 border-slate-700 hover:border-primary-500/50 transition-colors group cursor-pointer relative overflow-hidden">
            <input 
              type="file" 
              accept=".xlsx, .xls"
              onChange={(e) => setExcelFile(e.target.files[0])}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className={`w-16 h-16 ${excelFile ? 'bg-green-500' : 'bg-primary-600'} rounded-2xl flex items-center justify-center shadow-2xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
              {excelFile ? <FileCheck className="text-white" size={28} /> : <UploadIcon className="text-white" size={28} />}
            </div>
            <p className="text-lg font-medium text-white">{excelFile ? excelFile.name : 'Selecciona el Excel de Requerimientos'}</p>
          </div>

          <button
            onClick={handleExcelUpload}
            disabled={!excelFile || loading}
            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <FileCheck size={20} />}
            {loading ? 'Guardando en Base de Datos...' : 'Guardar y Continuar'}
          </button>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-white">Paso 2: Subir Descripciones de la Empresa</h3>
            <p className="text-slate-400 mt-1">Sube los manuales o PDFs (Opcional - Ayuda a la IA a ser más precisa)</p>
          </div>

          <div className="glass-card p-12 rounded-3xl flex flex-col items-center justify-center border-dashed border-2 border-slate-700 hover:border-indigo-500/50 transition-colors group cursor-pointer relative overflow-hidden">
            <input 
              type="file" 
              multiple
              onChange={(e) => setManualFiles(Array.from(e.target.files))}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className={`w-16 h-16 ${manualFiles.length > 0 ? 'bg-indigo-500' : 'bg-slate-700'} rounded-2xl flex items-center justify-center shadow-2xl mb-6 group-hover:scale-110 transition-transform duration-300`}>
              <Files className="text-white" size={28} />
            </div>
            <p className="text-lg font-medium text-white">
              {manualFiles.length > 0 ? `${manualFiles.length} archivos seleccionados` : 'Seleccionar Archivos (PDF, Word, etc.)'}
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => onSuccess()}
              disabled={loading}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all"
            >
              No tengo descripciones (Omitir)
            </button>
            <button
              onClick={handleManualesUpload}
              disabled={manualFiles.length === 0 || loading}
              className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <FileCheck size={20} />}
              {loading ? 'Subiendo y Vinculando...' : 'Guardar Manuales y Finalizar'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-center gap-3 justify-center">
          <AlertCircle size={20} />
          {error}
        </div>
      )}
    </div>
  );
};

export default UploadView;
