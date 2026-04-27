import React, { useState, useEffect, useRef } from 'react';
import { Building2, Save, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com';

function FormularioView({ empresaId, onEmpresaCreated }) {
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [empresaNombre, setEmpresaNombre] = useState('');
  const [file, setFile] = useState(null);
  const [procesado, setProcesado] = useState(false);
  const fileInputRef = useRef(null);

  // Si ya tiene empresaId, cargar datos existentes
  useEffect(() => {
    if (empresaId) {
      cargarDatosExistentes();
    }
  }, [empresaId]);

  const cargarDatosExistentes = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/empresas/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProcesado(true);
        setEmpresaNombre(data.nombre_empresa);
      }
    } catch (e) {
      console.error('Error:', e);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setError('');
    }
  };

  const procesarExcel = async () => {
    if (!file && !empresaNombre) {
      setError('Selecciona un archivo Excel');
      return;
    }

    const nombreEmpresa = empresaNombre.trim() || 'EMPRESA';
    setLoading(true);
    setError('');
    setMensaje('Procesando archivo Excel...');

    const formData = new FormData();
    formData.append('empresa', nombreEmpresa);
    if (file) {
      formData.append('file', file);
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
        setMensaje('Archivo procesado correctamente');
        setProcesado(true);
        onEmpresaCreated(data.empresa_id);
      } else {
        setError(data.detail || 'Error al procesar');
      }
    } catch (e) {
      setError('Error de conexión: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Si ya está procesado, mostrar resumen
  if (procesado && empresaId) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Archivo Procesado</h2>
          <p className="text-slate-600 mb-4">
            Los datos de <strong>{empresaNombre}</strong> han sido cargados exitosamente
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <button
              onClick={() => onEmpresaCreated(empresaId)}
              className="btn-primary"
            >
              Ir a Homologación
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <FileSpreadsheet className="text-emerald-600 w-8 h-8" />
          <div>
            <h2 className="text-xl font-bold">1. Cargar Archivo de Requerimientos</h2>
            <p className="text-sm text-slate-500">Sube el Excel del formulario de requerimientos</p>
          </div>
        </div>
      </div>

      {/* Formulario de carga */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="space-y-6">
          {/* Nombre empresa */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nombre de la Empresa *
            </label>
            <input
              type="text"
              className="input-field"
              value={empresaNombre}
              onChange={(e) => setEmpresaNombre(e.target.value)}
              placeholder="Ej: EXTRUSIONES S.A."
            />
          </div>

          {/* Upload Excel */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Archivo Excel de Requerimientos
            </label>
            <div
              className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-emerald-600">
                  <FileSpreadsheet className="w-8 h-8" />
                  <span className="font-medium">{file.name}</span>
                </div>
              ) : (
                <div className="text-slate-500">
                  <Upload className="w-8 h-8 mx-auto mb-2" />
                  <p>Haz clic para seleccionar el archivo</p>
                  <p className="text-xs mt-1">Formatos: .xlsx, .xls</p>
                </div>
              )}
            </div>
          </div>

          {/* Mensajes */}
          {mensaje && (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-lg">
              <Loader className="w-5 h-5 animate-spin" />
              <span>{mensaje}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Botón procesar */}
          <button
            onClick={procesarExcel}
            disabled={loading || (!file && !empresaNombre)}
            className="btn-primary w-full justify-center"
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin mr-2" />
                Procesando...
              </>
            ) : (
              <>
              <Building2 className="w-5 h-5 mr-2" />
              Procesar Archivo
            </>
          )}
        </div>
      </div>

      {/* Info help */}
      <div className="mt-6 bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
        <p><strong>Nota:</strong> El archivo Excel debe contener las pestañas:</p>
        <ul className="mt-2 list-disc list-inside space-y-1">
          <li>Datos Generales - Información de la empresa</li>
          <li>Prácticas de Compensación - Políticas y primas</li>
          <li>Información por Cargo - Lista de cargos con compensaciones</li>
        </ul>
      </div>
    </div>
  );
}

export default FormularioView;