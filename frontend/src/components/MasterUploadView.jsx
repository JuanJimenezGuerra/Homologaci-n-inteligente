import React, { useState } from 'react';
import { Database, FileCheck, Loader2, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { motion } from 'framer-motion';

const MasterUploadView = ({ onSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  let apiUrl = import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com';
  if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const token = localStorage.getItem('token');
      await axios.post(`${apiUrl}/uploads/master`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al cargar la base maestra. Verifica el formato del archivo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 space-y-10">
      <div className="text-center space-y-3">
        <div className="inline-flex p-4 bg-emerald-100 rounded-3xl text-primary mb-2 shadow-inner">
          <Database size={40} />
        </div>
        <h2 className="text-4xl font-bold text-forest tracking-tight">Base Maestra de Referencia</h2>
        <p className="text-emerald-700/60 text-lg font-medium max-w-lg mx-auto">
          Actualiza la biblioteca de cargos y descripciones que la IA usará como estándar de oro.
        </p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-10 bg-white/60 space-y-8"
      >
        <div className="relative group">
          <input 
            type="file" 
            accept=".xlsx, .xls"
            onChange={(e) => setFile(e.target.files[0])}
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
          />
          <div className={`p-16 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 bg-white/40 ${file ? 'border-primary bg-emerald-50/50' : 'border-emerald-200 group-hover:border-primary'}`}>
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${file ? 'bg-primary text-white' : 'bg-emerald-100 text-emerald-600'}`}>
              {file ? <FileCheck size={32} /> : <Database size={32} />}
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-forest">
                {file ? file.name : 'Selecciona el archivo Excel Maestro'}
              </p>
              <p className="text-slate-400 font-medium mt-1">Arrastra aquí o haz clic para buscar</p>
            </div>
          </div>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-4 text-primary animate-bounce">
            <CheckCircle size={60} />
            <p className="text-2xl font-bold">¡Base Maestra Actualizada!</p>
          </div>
        ) : (
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="btn-primary w-full py-5 text-xl shadow-xl disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : <ArrowRight size={24} />}
            {loading ? 'Procesando Base Maestra...' : 'Cargar Base Maestra'}
          </button>
        )}
      </motion.div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-600 p-6 rounded-3xl flex items-center gap-4 justify-center font-bold shadow-lg">
          <AlertCircle size={24} />
          {error}
        </div>
      )}
    </div>
  );
};

export default MasterUploadView;
