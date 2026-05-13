import React, { useState, useEffect } from 'react';
import { BarChart3, Download, TrendingUp, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com').replace(/\/$/, '');
const getToken = () => localStorage.getItem('token') || '';

const EQUIDAD_COLORS = { subpago: '#ef4444', competitivo: '#10b981', sobrepago: '#f59e0b' };

function BarV({ label, value, color, maxVal }) {
  const pct = maxVal > 0 ? Math.min((value / maxVal) * 100, 100) : 0;
  return (
    <div className="text-center">
      <div className="h-32 flex items-end justify-center">
        <motion.div
          className="rounded-t-lg w-12"
          style={{ backgroundColor: color }}
          initial={{ height: 0 }}
          animate={{ height: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <p className="text-[10px] text-slate-500 mt-1 truncate max-w-[80px]">{label}</p>
      <p className="text-xs font-bold">{value}</p>
    </div>
  );
}

function MiniCurve({ data, color }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(d => d.valor), 1);
  const pts = data.map((d, i) => {
    const x = 20 + (i / (data.length - 1)) * 260;
    const y = 100 - (d.valor / max) * 80;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 300 120" className="w-full h-24">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((d, i) => {
        const x = 20 + (i / (data.length - 1)) * 260;
        const y = 100 - (d.valor / max) * 80;
        return <circle key={i} cx={x} cy={y} r="3" fill={color}/>;
      })}
    </svg>
  );
}

function AnalisisView({ uploadData, onBack }) {
  const [reportes, setReportes] = useState({});
  const [activeReport, setActiveReport] = useState('equidad');
  const [loading, setLoading] = useState(false);
  const [curvesData, setCurvesData] = useState(null);
  const [cargosData, setCargosData] = useState([]);
  const [loadingCurves, setLoadingCurves] = useState(false);

  const uploadId = typeof uploadData === 'number' ? uploadData : null;

  useEffect(() => {
    if (uploadId) {
      cargarReportes();
      cargarCargos();
    }
  }, [uploadId]);

  const cargarReportes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/analisis/reporte/upload/${uploadId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReportes(data);
      }
    } catch (e) {
      console.error('Error cargando reportes:', e);
    } finally {
      setLoading(false);
    }
  };

  const cargarCargos = async () => {
    try {
      const res = await fetch(`${API_BASE}/uploads/${uploadId}/cargos`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCargosData(data);
      }
    } catch (e) {
      console.error('Error cargando cargos:', e);
    }
  };

  const calcularCurvas = async () => {
    setLoadingCurves(true);
    try {
      const res = await fetch(`${API_BASE}/analisis/curvas/upload/${uploadId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCurvesData(data.curvas || data);
        await cargarReportes();
      }
    } catch (e) {
      console.error('Error calculando curvas:', e);
      // Generate local curves from valuation data
      generateLocalCurves();
    } finally {
      setLoadingCurves(false);
    }
  };

  const generateLocalCurves = () => {
    const valoraciones = JSON.parse(localStorage.getItem('shr_valoraciones') || '{}');
    const points = [];

    cargosData.forEach(cargo => {
      const id = cargo.id || cargo.nombre_cargo;
      const v = valoraciones[id];
      if (v && v.estado === 'valorado') {
        const f1 = calcF1(v);
        const f2 = calcF2(v);
        const f3 = calcF3(v);
        const f4 = calcF4(v);
        const total = f1 + f2 + f3 + f4;

        const salario = v.garantizado
          || v.basico
          || 0;

        points.push({
          cargo: cargo.nombre_cargo,
          area: cargo.area,
          puntos: total,
          salario,
          homologado: cargo.homologacion?.cargo_homologado || '',
          garantizado: v.garantizado,
          garantizadoVariable: v.garantizadoVariable,
          compensacionTotal: v.compensacionTotal,
        });
      }
    });

    points.sort((a, b) => a.puntos - b.puntos);

    const curveData = {
      min: points.map(p => ({ puntos: p.puntos, valor: p.salario, cargo: p.cargo, minimo: p.salario * 0.85, medio: p.salario * 1.15, maximo: p.salario * 1.3 })),
      mid: points.map(p => ({ puntos: p.puntos, valor: p.salario * 1.15, cargo: p.cargo })),
      max: points.map(p => ({ puntos: p.puntos, valor: p.salario * 1.3, cargo: p.cargo })),
      detalles: points,
    };

    setCurvesData(curveData);
  };

  const calcF1 = (v) => {
    const ptsC = { A: 20, B: 40, C: 60, D: 80, E: 100, F: 120, G: 140, H: 160 };
    const multE = { '-': 0.8, 'o': 1.0, '+': 1.2 };
    const ptsH = { I: 10, II: 20, III: 30, IV: 40, V: 50, VI: 60, VII: 70 };
    const ptsR = { '1': 10, '2': 15, '3': 25, '4': 35 };
    return (ptsC[v.conocimientos] || 0) * (multE[v.experiencia] || 1) + (ptsH[v.habilidadGerencial] || 0) + (ptsR[v.rolCargo] || 0);
  };

  const calcF2 = (v) => {
    const ptsC = { A: 5, B: 10, C: 15 };
    const ptsF = { '1': 2, '2': 4, '3': 6, '4': 8 };
    const ptsCR = { I: 5, II: 10, III: 15, IV: 20, V: 25 };
    return (ptsC[v.contacto] || 0) + (ptsF[v.frecuenciaContacto] || 0) + (ptsCR[v.contenidoRelaciones] || 0);
  };

  const calcF3 = (v) => {
    const ptsCC = { '1': 10, '2': 20, '3': 30, '4': 40, '5': 50 };
    const multT = { '-': 0.85, 'o': 1.0, '+': 1.15 };
    const ptsG = { A: 10, B: 20, C: 30, D: 40, E: 50, F: 60, G: 70, H: 80 };
    return (ptsCC[v.complejidadConceptual] || 0) * (multT[v.tendenciaCC] || 1) + (ptsG[v.guiasApoyo] || 0) * (multT[v.tendenciaGA] || 1);
  };

  const calcF4 = (v) => {
    const ptsI = { I: 10, II: 20, III: 30, IV: 40 };
    const ptsA = { A: 10, B: 20, C: 30, D: 40, E: 50, F: 60, G: 70 };
    const ptsM = { '1': 0, '2': 5, '3': 10, '4': 15, '5': 20, '6': 25, '7': 30, '8': 35, '9': 40, '10': 45, '11': 50, '12': 55, '13': 60, '14': 65 };
    return (ptsI[v.impacto] || 0) + (ptsA[v.autonomia] || 0) + (ptsM[v.magnitud] || 0);
  };

  const tieneDatos = Object.keys(reportes).length > 0 || cargosData.length > 0;

  const tabs = [
    { id: 'equidad', label: 'Equidad', icon: TrendingUp },
    { id: 'competitividad', label: 'Competitividad', icon: BarChart3 },
    { id: 'curvas', label: 'Curvas Salariales', icon: CheckCircle },
    { id: 'nivelacion', label: 'Nivelación', icon: AlertTriangle },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-4">
        <strong>Funcionalidad Legacy</strong> — Esta pestaña ha sido reemplazada por el nuevo flujo.
        Ve a <strong>Formulario → Organización → Sesiones</strong> para usar el pipeline actualizado.
      </div>
      <div className="glass-card rounded-2xl p-6 border border-emerald-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl">
              <BarChart3 className="text-primary" size={24}/>
            </div>
            <div>
              <h2 className="text-xl font-bold text-forest">📈 Paso 3 · Análisis y Reportes</h2>
              <p className="text-sm text-emerald-700/60">Curvas, equidad y competitividad salarial</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={calcularCurvas}
              disabled={loadingCurves}
              className="flex items-center gap-2 bg-forest text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-primary transition-all shadow-sm disabled:opacity-60"
            >
              {loadingCurves ? <><Loader2 size={16} className="animate-spin"/> Calculando...</> : '⟳ Generar Curvas'}
            </button>
            <button className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-all shadow-sm">
              <Download size={14}/> Exportar
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
              activeReport === tab.id
                ? 'bg-primary text-white shadow-md'
                : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <tab.icon size={14}/> {tab.label}
          </button>
        ))}
      </div>

      {!tieneDatos && !loading ? (
        <div className="max-w-7xl mx-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-4">
            <strong>Funcionalidad Legacy</strong> — Esta pestaña ha sido reemplazada por el nuevo flujo.
            Ve a <strong>Formulario → Organización → Sesiones</strong> para usar el pipeline actualizado.
          </div>
          <div className="glass-card rounded-2xl p-12 text-center space-y-4">
            <div className="inline-flex p-5 bg-amber-50 rounded-3xl text-amber-500 mb-2">
              <AlertTriangle size={48}/>
            </div>
            <h3 className="text-xl font-bold text-forest">Sin datos suficientes</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Completa la <strong>Homologación</strong> y <strong>Valoración</strong> de cargos primero para generar los análisis.
            </p>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-6 border border-emerald-100">
          {activeReport === 'equidad' && (
            <div className="space-y-6">
              <h3 className="font-bold text-lg text-forest flex items-center gap-2">
                <TrendingUp size={20} className="text-primary"/> Nivel de Equidad Salarial
              </h3>

              {reportes.equidad?.total > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
                      <p className="text-3xl font-black text-red-600">{reportes.equidad.pct_subpago || 0}%</p>
                      <p className="text-xs text-red-600/80 font-medium">Subpago (&lt;80%)</p>
                      <p className="text-lg font-bold text-red-700">{reportes.equidad.subpago || 0} cargos</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-4 text-center border border-emerald-100">
                      <p className="text-3xl font-black text-emerald-600">{reportes.equidad.pct_competitivo || 0}%</p>
                      <p className="text-xs text-emerald-600/80 font-medium">Competitivo (80-120%)</p>
                      <p className="text-lg font-bold text-emerald-700">{reportes.equidad.competitivo || 0} cargos</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
                      <p className="text-3xl font-black text-amber-600">{reportes.equidad.pct_sobrepago || 0}%</p>
                      <p className="text-xs text-amber-600/80 font-medium">Sobrepago (&gt;120%)</p>
                      <p className="text-lg font-bold text-amber-700">{reportes.equidad.sobrepago || 0} cargos</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <h4 className="font-bold text-sm text-slate-500 mb-3">Detalles por Cargo</h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500">
                          <th className="text-left p-3 font-bold">Cargo</th>
                          <th className="text-left p-3 font-bold">Salario Actual</th>
                          <th className="text-left p-3 font-bold">Referencia</th>
                          <th className="text-left p-3 font-bold">Posición %</th>
                          <th className="text-left p-3 font-bold">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportes.equidad.detalles || []).slice(0, 10).map((d, i) => (
                          <tr key={i} className="border-t border-emerald-50 hover:bg-emerald-50/50 transition-colors">
                            <td className="p-3 font-medium">{d.cargo}</td>
                            <td className="p-3">${(d.actual || 0).toLocaleString()}</td>
                            <td className="p-3">${(d.referencia || 0).toLocaleString()}</td>
                            <td className="p-3 font-bold">{d.posicion || 0}%</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                (d.posicion || 100) < 80 ? 'bg-red-100 text-red-700' :
                                (d.posicion || 100) > 120 ? 'bg-amber-100 text-amber-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {(d.posicion || 100) < 80 ? 'Subpago' : (d.posicion || 100) > 120 ? 'Sobrepago' : 'Competitivo'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>No hay datos de equidad disponibles</p>
                  <p className="text-sm">Haz clic en "Generar Curvas" para calcular</p>
                </div>
              )}
            </div>
          )}

          {activeReport === 'competitividad' && (
            <div className="space-y-6">
              <h3 className="font-bold text-lg text-forest flex items-center gap-2">
                <BarChart3 size={20} className="text-primary"/> Competitividad vs Mercado
              </h3>

              {reportes.competitividad?.cargos?.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                      <p className="text-xs text-emerald-600/80 font-medium">Competitividad Promedio</p>
                      <p className="text-3xl font-black text-emerald-700">{reportes.competitividad.promedio || 0}%</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                      <p className="text-xs text-blue-600/80 font-medium">Cargos por encima del mercado</p>
                      <p className="text-3xl font-black text-blue-700">{reportes.competitividad.sobre_mercado || 0}</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500">
                          <th className="text-left p-3 font-bold">Cargo</th>
                          <th className="text-left p-3 font-bold">Nuestro Salario</th>
                          <th className="text-left p-3 font-bold">Mercado P50</th>
                          <th className="text-left p-3 font-bold">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportes.competitividad.cargos || []).slice(0, 10).map((c, i) => (
                          <tr key={i} className="border-t border-emerald-50 hover:bg-emerald-50/50">
                            <td className="p-3 font-medium">{c.cargo}</td>
                            <td className="p-3">${(c.salario_empresa || 0).toLocaleString()}</td>
                            <td className="p-3">${(c.mercado_p50 || 0).toLocaleString()}</td>
                            <td className="p-3 font-bold">
                              <span className={((c.diferencia_pct || 0) >= 0) ? 'text-emerald-600' : 'text-red-600'}>
                                {((c.diferencia_pct || 0) >= 0) ? '+' : ''}{c.diferencia_pct || 0}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>Datos de competitividad no disponibles aún</p>
                </div>
              )}
            </div>
          )}

          {activeReport === 'curvas' && (
            <div className="space-y-6">
              <h3 className="font-bold text-lg text-forest flex items-center gap-2">
                <CheckCircle size={20} className="text-primary"/> Curvas Salariales por Puntos
              </h3>

              {curvesData || reportes.curvas ? (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl p-4 border border-emerald-100">
                      <p className="text-xs font-bold text-slate-500 mb-2">Curva Mínima (P25)</p>
                      <MiniCurve data={curvesData?.min || reportes.curvas?.min || []} color="#10b981"/>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-emerald-100">
                      <p className="text-xs font-bold text-slate-500 mb-2">Curva Media (P50)</p>
                      <MiniCurve data={curvesData?.mid || reportes.curvas?.mid || []} color="#3b82f6"/>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-emerald-100 lg:col-span-2">
                      <p className="text-xs font-bold text-slate-500 mb-2">Curva Máxima (P75)</p>
                      <MiniCurve data={curvesData?.max || reportes.curvas?.max || []} color="#f59e0b"/>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <h4 className="font-bold text-sm text-slate-500 mb-3">Datos de la Curva</h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500">
                          <th className="text-left p-3 font-bold">Cargo</th>
                          <th className="text-left p-3 font-bold">Puntos</th>
                          <th className="text-left p-3 font-bold">Salario Actual</th>
                          <th className="text-left p-3 font-bold">Mínimo (P25)</th>
                          <th className="text-left p-3 font-bold">Medio (P50)</th>
                          <th className="text-left p-3 font-bold">Máximo (P75)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(curvesData?.min || []).map((d, i) => (
                          <tr key={i} className="border-t border-emerald-50 hover:bg-emerald-50/50">
                            <td className="p-3 font-medium">{d.cargo || `Cargo ${i + 1}`}</td>
                            <td className="p-3 font-bold">{d.puntos || 0}</td>
                            <td className="p-3">${(d.valor || 0).toLocaleString()}</td>
                            <td className="p-3 text-emerald-600">${(d.minimo || d.valor * 0.9 || 0).toLocaleString()}</td>
                            <td className="p-3 text-blue-600">${(d.medio || d.valor * 1.15 || 0).toLocaleString()}</td>
                            <td className="p-3 text-amber-600">${(d.maximo || d.valor * 1.3 || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <AlertTriangle size={48} className="mx-auto mb-4 text-slate-300"/>
                  <p>Curvas no generadas</p>
                  <p className="text-sm">Haz clic en "Generar Curvas" para calcularlas</p>
                </div>
              )}
            </div>
          )}

          {activeReport === 'nivelacion' && (
            <div className="space-y-6">
              <h3 className="font-bold text-lg text-forest flex items-center gap-2">
                <AlertTriangle size={20} className="text-primary"/> Costos de Nivelación Salarial
              </h3>

              {reportes.nivelacion ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[0.7, 0.8, 0.9, 1.0].map(target => {
                      const key = `target_${target * 100}`;
                      const costo = reportes.nivelacion[key]?.costo_anual || 0;
                      return (
                        <div key={target} className="bg-white rounded-xl p-4 border border-emerald-100 text-center">
                          <p className="text-xs text-slate-500 font-medium">Target {target * 100}%</p>
                          <p className="text-2xl font-black text-forest">${costo.toLocaleString()}</p>
                          <p className="text-xs text-slate-400">Costo anual estimado</p>
                        </div>
                      );
                    })}
                  </div>

                  {reportes.nivelacion.detalles?.length > 0 && (
                    <div className="overflow-x-auto">
                      <h4 className="font-bold text-sm text-slate-500 mb-3">Detalle de Ajustes por Cargo</h4>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500">
                            <th className="text-left p-3 font-bold">Cargo</th>
                            <th className="text-left p-3 font-bold">Salario Actual</th>
                            <th className="text-left p-3 font-bold">Salario Target</th>
                            <th className="text-left p-3 font-bold">Ajuste Necesario</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportes.nivelacion.detalles.slice(0, 10).map((d, i) => (
                            <tr key={i} className="border-t border-emerald-50 hover:bg-emerald-50/50">
                              <td className="p-3 font-medium">{d.cargo}</td>
                              <td className="p-3">${(d.salario_actual || 0).toLocaleString()}</td>
                              <td className="p-3">${(d.salario_target || 0).toLocaleString()}</td>
                              <td className="p-3 font-bold text-red-600">+${(d.ajuste || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>Datos de nivelación no disponibles</p>
                  <p className="text-sm">Genera las curvas primero</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {onBack && (
        <div className="flex justify-start">
          <button onClick={onBack} className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-all shadow-sm">
            ← Volver a Valuación
          </button>
        </div>
      )}
    </div>
  );
}

export default AnalisisView;
