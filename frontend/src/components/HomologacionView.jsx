import React, { useState, useEffect } from 'react';
import { Link2, Play, Loader, Users, AlertCircle, Settings } from 'lucide-react';

const API = (import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com').replace(/\/$/, '');

function HomologacionView({ empresaId, onComplete }) {
  const [criterios, setCriterios] = useState({
    priorizar_funciones: true,
    priorizar_nivel: true,
    nivel_agresividad: 'medio',
    exigir_coincidencia_fuerte: false,
  });
  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (empresaId) {
      cargarCargos();
    }
  }, [empresaId]);

  const cargarCargos = async () => {
    const token = localStorage.getItem('token');
    console.log('=== cargarCargos called with empresaId:', empresaId);
    try {
      // Intentar primero con endpoint de empresa
      let res = await fetch(`${API}/empresas/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('/empresas response:', res.status);
      
      let data = [];
      if (res.ok) {
        const empresaData = await res.json();
        console.log('empresaData:', empresaData);
        data = empresaData.cargos || [];
      }
      
      // Si no hay datos, probar con uploads
      if (data.length === 0) {
        res = await fetch(`${API}/uploads/${empresaId}/cargos`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log('/uploads/cargos response:', res.status);
        if (res.ok) {
          data = await res.json();
          console.log('cargos data from uploads:', data);
        }
      }
      
      setCargos(data);
      console.log('=== setCargos:', data.length);
    } catch (e) {
      console.error('Error cargando:', e);
      setError('Error al cargar datos');
    }
  };

  const ejecutarHomologacion = async (conIA = false) => {
    const token = localStorage.getItem('token');
    setLoading(true);
    setError('');
    setMensaje(conIA ? 'Procesando con IA para los no encontrados...' : 'Procesando homologación...');
    
    console.log('=== ejecutarHomologacion called, empresaId:', empresaId, 'conIA:', conIA);
    
    try {
      const url = conIA 
        ? `${API}/homologacion/ejecutar?upload_id=${empresaId}&usar_ia=true`
        : `${API}/homologacion/ejecutar?upload_id=${empresaId}`;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(criterios),
      });
      
      console.log('homologacion response:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('homologacion data:', data);
        setMensaje(`Homologación completada: ${data.matched} coincidencia(s), ${data.not_matched} sin encontrar`);
        await cargarCargos();
      } else {
        const text = await res.text();
        setError(`Error ${res.status}: ${text.slice(0, 100)}`);
      }
    } catch (e) {
      setError('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Si no hay cargos
  if (cargos.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No hay datos</h2>
          <p className="text-slate-600 mb-4">
            Primero carga el archivo de requerimientos en la pestaña "Formulario"
          </p>
          {error && <p className="text-red-500">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link2 className="text-emerald-600 w-8 h-8" />
            <div>
              <h2 className="text-xl font-bold">2. Homologación de Cargos</h2>
              <p className="text-sm text-slate-500">
                {cargos.length} cargos cargados
              </p>
            </div>
          </div>
          
          <button
            onClick={() => {}}
            className="btn-secondary"
          >
            <Settings size={18} />
            Configurar Criterios
          </button>
        </div>
      </div>

      {/* Tabla de cargas */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-3">#</th>
                <th className="text-left p-3">Cargo</th>
                <th className="text-left p-3">Área</th>
                <th className="text-left p-3">Personas</th>
                <th className="text-left p-3">Homologado</th>
                <th className="text-left p-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cargos.map((cargo, i) => (
                <tr key={cargo.id || i} className="border-t">
                  <td className="p-3">{i + 1}</td>
                  <td className="p-3 font-medium">{cargo.nombre_cargo || cargo.nombre}</td>
                  <td className="p-3 text-slate-600">{cargo.area}</td>
                  <td className="p-3">{cargo.num_personas || 1}</td>
                  <td className="p-3">
                    {cargo.cargo_homologado || cargo.homologado ? (
                      <span className="text-emerald-600">{cargo.cargo_homologado || cargo.homologado}</span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      cargo.estado === 'HOMOLOGADO' ? 'bg-emerald-100 text-emerald-700' : 
                      cargo.estado === 'PROCESANDO' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {cargo.estado || 'PENDIENTE'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {cargos.length > 20 && (
          <p className="text-sm text-slate-500 mt-2">
            {cargos.length} cargos cargados
          </p>
        )}

        {mensaje && <p className="text-emerald-600 mt-4">{mensaje}</p>}
        {error && <p className="text-red-500 mt-4">{error}</p>}

        <div className="flex justify-end mt-6">
          <button onClick={ejecutarHomologacion} disabled={loading} className="btn-primary">
            {loading ? <Loader className="w-5 h-5 animate-spin mr-2" /> : <Play className="w-5 h-5 mr-2" />}
            {loading ? 'Procesando...' : 'Ejecutar Homologación'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomologacionView;