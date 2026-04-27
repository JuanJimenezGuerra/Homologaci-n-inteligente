import React, { useState, useEffect } from 'react';
import { Link2, Settings, Play, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com';

function HomologacionView({ empresaId, onComplete }) {
  const [criterios, setCriterios] = useState({
    priorizar_funciones: true,
    priorizar_nivel: true,
    nivel_agresividad: 'medio',
    exigir_coincidencia_fuerte: false,
  });
  const [cargos, setCargos] = useState([]);
  const [homologaciones, setHomologaciones] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [procesado, setProcesado] = useState(false);

  useEffect(() => {
    if (empresaId) {
      cargarCargos();
    }
  }, [empresaId]);

  const cargarCargos = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API}/empresas/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCargos(data.cargos || []);
      
      // Verificar si ya están homologados
      const homologados = (data.cargos || []).filter(c => c.homologado);
      if (homologados.length > 0) {
        setProcesado(true);
      }
    } catch (e) {
      console.error('Error:', e);
    }
  };

  const ejecutarHomologacion = async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    
    try {
      const res = await fetch(`${API}/homologacion/ejecutar?empresa_id=${empresaId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(criterios),
      });
      
      await cargarCargos();
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const editarHomologacion = (cargoId, valor) => {
    setHomologaciones({ ...homologaciones, [cargoId]: valor });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link2 className="text-emerald-600" size={28} />
            <div>
              <h2 className="text-xl font-bold">Homologación de Cargos</h2>
              <p className="text-sm text-slate-500">
                Matching de cargos al catálogo maestro
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn-secondary"
          >
            <Settings size={18} />
            Configurar Criterios
          </button>
        </div>
      </div>

      {/* Configuración de Criterios */}
      {showSettings && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="font-bold mb-4">Criterios de Homologación</h3>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="priorizar_funciones"
                checked={criterios.priorizar_funciones}
                onChange={(e) => setCriterios({ ...criterios, priorizar_funciones: e.target.checked })}
                className="w-5 h-5 text-emerald-600"
              />
              <label htmlFor="priorizar_funciones" className="text-sm">
                Priorizar funciones sobre nombre
              </label>
            </div>
            
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="priorizar_nivel"
                checked={criterios.priorizar_nivel}
                onChange={(e) => setCriterios({ ...criterios, priorizar_nivel: e.target.checked })}
                className="w-5 h-5 text-emerald-600"
              />
              <label htmlFor="priorizar_nivel" className="text-sm">
                Considerar nivel jerárquico
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Nivel de Agresividad</label>
              <select
                className="input-field"
                value={criterios.nivel_agresividad}
                onChange={(e) => setCriterios({ ...criterios, nivel_agresividad: e.target.value })}
              >
                <option value="conservador">Conservador (solo matches &gt;90%)</option>
                <option value="medio">Medio (matches &gt;70%)</option>
                <option value="agresivo">Agresivo (matches &gt;50%)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="exigir_coincidencia"
                checked={criterios.exigir_coincidencia_fuerte}
                onChange={(e) => setCriterios({ ...criterios, exigir_coincidencia_fuerte: e.target.checked })}
                className="w-5 h-5 text-emerald-600"
              />
              <label htmlFor="exigir_coincidencia" className="text-sm">
                Exigir coincidencia fuerte en responsabilidades
              </label>
            </div>
          </div>
          
          <div className="flex justify-end mt-4">
            <button
              onClick={ejecutarHomologacion}
              disabled={loading || cargos.length === 0}
              className="btn-primary"
            >
              <Play size={18} />
              {loading ? 'Procesando...' : 'Ejecutar Homologación'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de Cargos */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="font-bold mb-4">
          Cargos a Homologar ({cargos.length})
        </h3>
        
        {cargos.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <AlertCircle size={48} className="mx-auto mb-4 text-slate-300" />
            <p>No hay cargos para homologar</p>
            <p className="text-sm">Primero complete el formulario de la empresa</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50">
                  <th className="text-left p-3">#</th>
                  <th className="text-left p-3">Cargo Empresa</th>
                  <th className="text-left p-3">Área</th>
                  <th className="text-left p-3">Cargo Homologado</th>
                  <th className="text-left p-3">Nivel</th>
                  <th className="text-left p-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {cargos.map((cargo, i) => (
                  <tr key={cargo.id} className="border-t hover:bg-slate-50">
                    <td className="p-3">{i + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Briefcase size={16} className="text-slate-400" />
                        {cargo.nombre_cargo}
                      </div>
                    </td>
                    <td className="p-3 text-slate-600">{cargo.area}</td>
                    <td className="p-3">
                      {cargo.homologado ? (
                        <span className="text-emerald-600 font-medium">
                          {cargo.homologado}
                        </span>
                      ) : (
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Editar..."
                          value={homologaciones[cargo.id] || ''}
                          onChange={(e) => editarHomologacion(cargo.id, e.target.value)}
                        />
                      )}
                    </td>
                    <td className="p-3 text-slate-500">
                      {cargo.homologado ? 'Nivel' : '-'}
                    </td>
                    <td className="p-3">
                      {cargo.estado === 'HOMOLOGADO' ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle size={16} />
                          Homologado
                        </span>
                      ) : cargo.estado === 'PENDIENTE' ? (
                        <span className="text-amber-600">Pendiente</span>
                      ) : (
                        <span className="text-red-600">{cargo.estado}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {cargos.some(c => c.estado === 'HOMOLOGADO') && (
          <div className="flex justify-end mt-6">
            <button onClick={onComplete} className="btn-primary">
              Continuar a Valoración
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default HomologacionView;