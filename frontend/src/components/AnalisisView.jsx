import React, { useState, useEffect } from 'react';
import { BarChart3, Download, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

const API = 'https://shr-backend-prod.onrender.com';

function AnalisisView({ empresaId: uploadId, onBack }) {
  const [reportes, setReportes] = useState({});
  const [activeReport, setActiveReport] = useState('equidad');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (uploadId) {
      cargarReportes();
    }
  }, [uploadId]);

  const cargarReportes = async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    
    try {
      const res = await fetch(`${API}/analisis/reporte/upload/${uploadId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReportes(data);
      }
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  };

  const calcularCurvas = async () => {
    const token = localStorage.getItem('token');
    setLoading(true);
    
    try {
      await fetch(`${API}/analisis/curvas/upload/${uploadId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await cargarReportes();
    } catch (e) {
      console.error('Error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Check if we have data
  const tieneDatos = Object.keys(reportes).length > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-emerald-600" size={28} />
            <div>
              <h2 className="text-xl font-bold">Análisis y Reportes</h2>
              <p className="text-sm text-slate-500">
                Curvas, equidad y competitividad
              </p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button onClick={calcularCurvas} disabled={loading} className="btn-secondary">
              {loading ? 'Calculando...' : 'Recalcular Curvas'}
            </button>
            <button className="btn-primary">
              <Download size={18} /> Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Tabs de Reportes */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveReport('equidad')}
            className={`px-4 py-2 rounded-full ${
              activeReport === 'equidad' ? 'bg-emerald-600 text-white' : 'bg-slate-100'
            }`}
          >
            Equidad
          </button>
          <button
            onClick={() => setActiveReport('competitividad')}
            className={`px-4 py-2 rounded-full ${
              activeReport === 'competitividad' ? 'bg-emerald-600 text-white' : 'bg-slate-100'
            }`}
          >
            Competitividad
          </button>
          <button
            onClick={() => setActiveReport('curvas')}
            className={`px-4 py-2 rounded-full ${
              activeReport === 'curvas' ? 'bg-emerald-600 text-white' : 'bg-slate-100'
            }`}
          >
            Curvas
          </button>
          <button
            onClick={() => setActiveReport('nivelacion')}
            className={`px-4 py-2 rounded-full ${
              activeReport === 'nivelacion' ? 'bg-emerald-600 text-white' : 'bg-slate-100'
            }`}
          >
            Nivelación
          </button>
        </div>

        {/* Contenido del Reporte */}
        {activeReport === 'equidad' && (
          <div>
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <TrendingUp size={20} /> Nivel de Equidad
            </h3>
            
            {reportes.equidad?.total > 0 ? (
              <div className="space-y-6">
                {/* Resumen */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-red-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {reportes.equidad.pct_subpago}%
                    </p>
                    <p className="text-sm text-red-600">Subpago (&lt;80%)</p>
                    <p className="text-xl font-bold">{reportes.equidad.subpago}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-emerald-600">
                      {reportes.equidad.pct_competitivo}%
                    </p>
                    <p className="text-sm text-emerald-600">Competitivo (80-120%)</p>
                    <p className="text-xl font-bold">{reportes.equidad.competitivo}</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">
                      {reportes.equidad.pct_sobrepago}%
                    </p>
                    <p className="text-sm text-amber-600">Sobrepago (&gt;120%)</p>
                    <p className="text-xl font-bold">{reportes.equidad.sobrepago}</p>
                  </div>
                </div>

                {/* Detalles */}
                <div>
                  <h4 className="font-medium mb-2">Detalles por Cargo</h4>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left p-2">Cargo</th>
                        <th className="text-left p-2">Actual</th>
                        <th className="text-left p-2">Referencia</th>
                        <th className="text-left p-2">Posición %</th>
                        <th className="text-left p-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportes.equidad.detalles?.slice(0, 10).map((d, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{d.cargo}</td>
                          <td className="p-2">${d.actual?.toLocaleString()}</td>
                          <td className="p-2">${d.referencia?.toLocaleString()}</td>
                          <td className="p-2">{d.posicion}%</td>
                          <td className="p-2">
                            {d.posicion < 80 ? (
                              <span className="text-red-600">Subpago</span>
                            ) : d.posicion > 120 ? (
                              <span className="text-amber-600">Sobrepago</span>
                            ) : (
                              <span className="text-emerald-600">Competitivo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <AlertTriangle size={48} className="mx-auto mb-4 text-slate-300" />
                <p>No hay datos suficientes para análisis</p>
                <p className="text-sm">Complete la valoración primero</p>
              </div>
            )}
          </div>
        )}

        {activeReport === 'nivelacion' && (
          <div>
            <h3 className="font-bold mb-4">Costos de Nivelación</h3>
            
            <div className="grid grid-cols-4 gap-4">
              {[0.7, 0.8, 0.9, 1.0].map(target => (
                <div key={target} className="bg-slate-50 rounded-xl p-4">
                  <p className="text-sm text-slate-600">Target {target * 100}%</p>
                  <p className="text-xl font-bold">
                    ${(reportes.nivelacion?.[`target_${target * 100}`]?.costo_anual || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">anual</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeReport === 'curvas' && (
          <div>
            <h3 className="font-bold mb-4">Curvas por Categoría</h3>
            <p className="text-slate-500">Ver curvas de equidad generadas</p>
          </div>
        )}

        {activeReport === 'competitividad' && (
          <div>
            <h3 className="font-bold mb-4">Competitividad vs Mercado</h3>
            <p className="text-slate-500">Comparación con datos de mercado externo</p>
          </div>
        )}
      </div>

      {/* Volver */}
      <div className="flex justify-start">
        <button onClick={onBack} className="btn-secondary">
          Volver a Valoración
        </button>
      </div>
    </div>
  );
}

export default AnalisisView;