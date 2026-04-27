import React, { useState, useEffect } from 'react';
import { Building2, Save, Upload, Plus, Trash2 } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function FormularioView({ empresaId, onEmpresaCreated }) {
  const [empresa, setEmpresa] = useState({
    nombre_empresa: '',
    razon_social: '',
    nit: '',
    direccion: '',
    telefono: '',
    departamento: '',
    ciudad: '',
    persona_contacto: '',
    cargo_contacto: '',
    telefono_contacto: '',
    email_contacto: '',
    sector_economico: '',
    actividad_economica: '',
    tipo_empresa: 'Privada',
    num_personas_contratadas: 0,
    empleados_presenciales: 0,
  });

  const [cargos, setCargos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: empresa, 2: cargos

  useEffect(() => {
    if (empresaId) {
      cargarDatos();
    }
  }, [empresaId]);

  const cargarDatos = async () => {
    if (!empresaId) return;
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch(`${API}/empresas/${empresaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setEmpresa(data);
    } catch (e) {
      console.error('Error cargando empresa:', e);
    }
  };

  const guardarEmpresa = async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    
    try {
      const method = empresaId ? 'PUT' : 'POST';
      const url = empresaId ? `${API}/empresas/${empresaId}` : `${API}/empresas`;
      
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(empresa),
      });
      
      const data = await res.json();
      setStep(2);
      onEmpresaCreated(data.id);
    } catch (e) {
      console.error('Error guardando empresa:', e);
    } finally {
      setLoading(false);
    }
  };

  const agregarCargo = () => {
    setCargos([
      ...cargos,
      {
        nombre_cargo: '',
        area: '',
        num_personas: 1,
        descripcion: '',
        basico: 0,
        modalidad: 'Presencial',
      },
    ]);
  };

  const actualizarCargo = (index, campo, valor) => {
    const nuevos = [...cargos];
    nuevos[index][campo] = valor;
    setCargos(nuevos);
  };

  const eliminarCargo = (index) => {
    setCargos(cargos.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-4 mb-8">
        <div className={`px-4 py-2 rounded-full ${step >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>
          1. Datos Empresa
        </div>
        <div className="flex-1 h-1 bg-slate-200">
          <div className={`h-full bg-emerald-600 transition-all ${step >= 2 ? 'w-full' : 'w-0'}`} />
        </div>
        <div className={`px-4 py-2 rounded-full ${step >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>
          2. Cargos
        </div>
      </div>

      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="text-emerald-600" size={24} />
            <h2 className="text-xl font-bold">Datos de la Empresa</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Empresa *</label>
              <input
                type="text"
                className="input-field"
                value={empresa.nombre_empresa}
                onChange={(e) => setEmpresa({ ...empresa, nombre_empresa: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NIT</label>
              <input
                type="text"
                className="input-field"
                value={empresa.nit}
                onChange={(e) => setEmpresa({ ...empresa, nit: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Razón Social</label>
              <input
                type="text"
                className="input-field"
                value={empresa.razon_social}
                onChange={(e) => setEmpresa({ ...empresa, razon_social: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
              <input
                type="text"
                className="input-field"
                value={empresa.direccion}
                onChange={(e) => setEmpresa({ ...empresa, direccion: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input
                type="text"
                className="input-field"
                value={empresa.telefono}
                onChange={(e) => setEmpresa({ ...empresa, telefono: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Departamento</label>
              <input
                type="text"
                className="input-field"
                value={empresa.departamento}
                onChange={(e) => setEmpresa({ ...empresa, departamento: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
              <input
                type="text"
                className="input-field"
                value={empresa.ciudad}
                onChange={(e) => setEmpresa({ ...empresa, ciudad: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sector Económico</label>
              <select
                className="input-field"
                value={empresa.sector_economico}
                onChange={(e) => setEmpresa({ ...empresa, sector_economico: e.target.value })}
              >
                <option value="">Seleccionar...</option>
                <option value="Industria y Manufactura">Industria y Manufactura</option>
                <option value="Comercio">Comercio</option>
                <option value="Servicios">Servicios</option>
                <option value="Tecnología">Tecnología</option>
                <option value="Financiero">Financiero</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Persona Contacto</label>
              <input
                type="text"
                className="input-field"
                value={empresa.persona_contacto}
                onChange={(e) => setEmpresa({ ...empresa, persona_contacto: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cargo Contacto</label>
              <input
                type="text"
                className="input-field"
                value={empresa.cargo_contacto}
                onChange={(e) => setEmpresa({ ...empresa, cargo_contacto: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Contacto</label>
              <input
                type="email"
                className="input-field"
                value={empresa.email_contacto}
                onChange={(e) => setEmpresa({ ...empresa, email_contacto: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Empresa</label>
              <select
                className="input-field"
                value={empresa.tipo_empresa}
                onChange={(e) => setEmpresa({ ...empresa, tipo_empresa: e.target.value })}
              >
                <option value="Privada">Privada</option>
                <option value="Pública">Pública</option>
                <option value="Mixta">Mixta</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1"># Personas Contratadas</label>
              <input
                type="number"
                className="input-field"
                value={empresa.num_personas_contratadas}
                onChange={(e) => setEmpresa({ ...empresa, num_personas_contratadas: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Empresa</label>
              <input
                type="number"
                className="input-field"
                value={empresa.empleados_presenciales}
                onChange={(e) => setEmpresa({ ...empresa, empleados_presenciales: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={guardarEmpresa}
              disabled={loading || !empresa.nombre_empresa}
              className="btn-primary"
            >
              <Save size={18} />
              {loading ? 'Guardando...' : 'Continuar'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Users className="text-emerald-600" size={24} />
              <h2 className="text-xl font-bold">Información por Cargo</h2>
            </div>
            <button onClick={agregarCargo} className="btn-secondary">
              <Plus size={18} /> Agregar Cargo
            </button>
          </div>

          {cargos.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No hay cargos agregados</p>
              <button onClick={agregarCargo} className="btn-primary mt-4">
                <Plus size={18} /> Agregar Primer Cargo
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left p-3">#</th>
                    <th className="text-left p-3">Nombre Cargo *</th>
                    <th className="text-left p-3">Área</th>
                    <th className="text-left p-3">Personas</th>
                    <th className="text-left p-3">Modalidad</th>
                    <th className="text-left p-3">Básico</th>
                    <th className="text-left p-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cargos.map((cargo, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">{i + 1}</td>
                      <td className="p-3">
                        <input
                          type="text"
                          className="input-field"
                          value={cargo.nombre_cargo}
                          onChange={(e) => actualizarCargo(i, 'nombre_cargo', e.target.value)}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          className="input-field"
                          value={cargo.area}
                          onChange={(e) => actualizarCargo(i, 'area', e.target.value)}
                        />
                      </td>
                      <td className="p-3 w-20">
                        <input
                          type="number"
                          className="input-field"
                          value={cargo.num_personas}
                          onChange={(e) => actualizarCargo(i, 'num_personas', parseInt(e.target.value) || 0)}
                        />
                      </td>
                      <td className="p-3">
                        <select
                          className="input-field"
                          value={cargo.modalidad}
                          onChange={(e) => actualizarCargo(i, 'modalidad', e.target.value)}
                        >
                          <option value="Presencial">Presencial</option>
                          <option value="Híbrido">Híbrido</option>
                          <option value="Remoto">Remoto</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          className="input-field"
                          value={cargo.basico}
                          onChange={(e) => actualizarCargo(i, 'basico', parseInt(e.target.value) || 0)}
                        />
                      </td>
                      <td className="p-3">
                        <button onClick={() => eliminarCargo(i)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(1)} className="btn-secondary">
              Volver
            </button>
            <button onClick={() => {}} className="btn-primary">
              <Save size={18} /> Guardar y Continuar a Homologación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FormularioView;