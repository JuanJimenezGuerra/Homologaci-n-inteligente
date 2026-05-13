import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, Download, TrendingUp, AlertTriangle, CheckCircle, Loader2, Filter, Layers, DollarSign, Target } from 'lucide-react';
import { motion } from 'framer-motion';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const getToken = () => localStorage.getItem('token') || '';

// ─── Chart Components ─────────────────────────────────────────────────────────

function ScatterChart({ data, curves, varKey, areaFilter }) {
  const filtered = areaFilter === 'all' ? data : data.filter(d => d.area === areaFilter);
  if (!filtered.length || !curves?.[varKey]?.length) return null;

  const allPts = filtered.map(d => d.puntos);
  const allVals = [
    ...filtered.map(d => d[`salario_${varKey}`] || 0),
    ...curves[varKey].map(c => c.valor),
  ].filter(v => v > 0);

  if (!allPts.length || !allVals.length) return null;

  const minPts = Math.min(...allPts);
  const maxPts = Math.max(...allPts);
  const maxVal = Math.max(...allVals) * 1.1;
  const minVal = 0;

  const w = 700, h = 350;
  const pad = { top: 20, right: 30, bottom: 50, left: 90 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const scaleX = (v) => pad.left + ((v - minPts) / (maxPts - minPts || 1)) * cw;
  const scaleY = (v) => pad.top + ch - ((v - minVal) / (maxVal - minVal || 1)) * ch;

  const curvePath = curves[varKey]
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(c.puntos)} ${scaleY(c.valor)}`)
    .join(' ');

  const varLabels = { g: 'Garantizado', gv: 'Garantizado + Variable', ct: 'Compensacion Total' };
  const varColors = { g: '#3b82f6', gv: '#10b981', ct: '#f59e0b' };
  const color = varColors[varKey];

  const formatSalary = (v) => {
    if (!v) return '-';
    if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
    return `$${v}`;
  };

  const xTicks = 5;
  const yTicks = 5;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" style={{ maxWidth: 700 }}>
        <text x={w / 2} y={h - 5} textAnchor="middle" className="fill-slate-500 text-[11px] font-bold">
          Puntos SHR
        </text>
        <text x={15} y={h / 2} textAnchor="middle" transform={`rotate(-90, 15, ${h / 2})`} className="fill-slate-500 text-[11px] font-bold">
          {varLabels[varKey]} (COP)
        </text>

        {/* X axis ticks */}
        {Array.from({ length: xTicks + 1 }).map((_, i) => {
          const val = minPts + (maxPts - minPts) * (i / xTicks);
          const x = scaleX(val);
          return (
            <g key={`x-${i}`}>
              <line x1={x} y1={pad.top} x2={x} y2={pad.top + ch} stroke="#e2e8f0" strokeWidth="0.5" />
              <text x={x} y={h - pad.bottom + 20} textAnchor="middle" className="fill-slate-400 text-[10px]">
                {Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* Y axis ticks */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const val = minVal + (maxVal - minVal) * (i / yTicks);
          const y = scaleY(val);
          return (
            <g key={`y-${i}`}>
              <line x1={pad.left} y1={y} x2={pad.left + cw} y2={y} stroke="#e2e8f0" strokeWidth="0.5" />
              <text x={pad.left - 5} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
                {formatSalary(val)}
              </text>
            </g>
          );
        })}

        {/* Curve */}
        <path d={curvePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Scatter points */}
        {filtered.map((d, i) => {
          const salary = d[`salario_${varKey}`];
          if (!salary) return null;
          const cx = scaleX(d.puntos);
          const cy = scaleY(salary);
          const ratio = d[`ratio_${varKey}`] || 1;
          const dotColor = ratio < 0.8 ? '#ef4444' : ratio > 1.2 ? '#f59e0b' : '#10b981';

          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r="5" fill={dotColor} opacity="0.8" stroke="#fff" strokeWidth="1.5" />
              <title>{d.nombre_cargo}{"\n"}Puntos: {d.puntos}{"\n"}Salario: {formatSalary(salary)}{"\n"}Ratio: {(ratio * 100).toFixed(0)}%</title>
            </g>
          );
        })}

        {/* Legend */}
        <circle cx={w - pad.right - 130} cy={pad.top + 10} r="4" fill={color} />
        <text x={w - pad.right - 120} y={pad.top + 14} className="fill-slate-600 text-[10px] font-bold">
          Curva esperada
        </text>
        <circle cx={w - pad.right - 130} cy={pad.top + 25} r="4" fill="#10b981" />
        <text x={w - pad.right - 120} y={pad.top + 29} className="fill-slate-600 text-[10px] font-bold">
          Competitivo
        </text>
        <circle cx={w - pad.right - 130} cy={pad.top + 40} r="4" fill="#ef4444" />
        <text x={w - pad.right - 120} y={pad.top + 44} className="fill-slate-600 text-[10px] font-bold">
          Subpago
        </text>
        <circle cx={w - pad.right - 130} cy={pad.top + 55} r="4" fill="#f59e0b" />
        <text x={w - pad.right - 120} y={pad.top + 59} className="fill-slate-600 text-[10px] font-bold">
          Sobrepago
        </text>
      </svg>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

function EquidadView({ uploadData, onBack }) {
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [indicadores, setIndicadores] = useState(null);
  const [regresiones, setRegresiones] = useState({});
  const [curves, setCurves] = useState({});
  const [varSelected, setVarSelected] = useState('g');
  const [areaFilter, setAreaFilter] = useState('all');
  const [sortBy, setSortBy] = useState('puntos');

  const uploadId = typeof uploadData === 'number' ? uploadData : null;

  const areas = useMemo(() => {
    const a = new Set(resultados.map(r => r.area).filter(Boolean));
    return ['all', ...Array.from(a)];
  }, [resultados]);

  const filteredResults = useMemo(() => {
    let list = areaFilter === 'all' ? resultados : resultados.filter(r => r.area === areaFilter);
    if (sortBy === 'puntos') list.sort((a, b) => a.puntos - b.puntos);
    else if (sortBy === 'ratio') list.sort((a, b) => (a.ratio_g || 0) - (b.ratio_g || 0));
    else if (sortBy === 'desviacion') list.sort((a, b) => (a.desviacion_g || 0) - (b.desviacion_g || 0));
    else if (sortBy === 'ajuste') list.sort((a, b) => (b.ajuste_g || 0) - (a.ajuste_g || 0));
    return list;
  }, [resultados, areaFilter, sortBy]);

  const ejecutarModelo = async () => {
    if (!uploadId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/modelo-equidad/${uploadId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Error ejecutando modelo');
      const data = await res.json();
      setResultados(data.resultados || []);
      setIndicadores(data.indicadores);
      setRegresiones(data.regresiones);
      setCurves(data.curvas);
    } catch (e) {
      console.error('Error modelo equidad:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (uploadId) ejecutarModelo();
  }, [uploadId]);

  const formatMoney = (v) => {
    if (v == null || isNaN(v)) return '-';
    return `$${Math.round(v).toLocaleString('es-CO')}`;
  };

  const varLabels = { g: 'Garantizado', gv: 'Garantizado + Variable', ct: 'Compensacion Total' };
  const varKeys = ['g', 'gv', 'ct'];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-4">
        <strong>Funcionalidad Legacy</strong> — Esta pestaña ha sido reemplazada por el nuevo flujo.
        Ve a <strong>Formulario → Organización → Sesiones</strong> para usar el pipeline actualizado.
      </div>
      {/* Header */}
      <div className="glass-card rounded-2xl p-6 border border-emerald-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl">
              <Layers className="text-primary" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-forest">Equidad Salarial - Modelo de Regresion</h2>
              <p className="text-sm text-emerald-700/60">Piecewise Linear Regression con segmentacion por percentiles</p>
            </div>
          </div>

          <button
            onClick={ejecutarModelo}
            disabled={loading}
            className="flex items-center gap-2 bg-forest text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-primary transition-all shadow-sm disabled:opacity-60"
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Ejecutando...</> : '⟳ Ejecutar Modelo'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      {indicadores && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-4 border border-red-100">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="text-xs text-slate-500 font-bold uppercase">Subpago (&lt;80%)</span>
            </div>
            <p className="text-3xl font-black text-red-600">{indicadores.pct_subpago}%</p>
            <p className="text-sm text-slate-400">{indicadores.subpago_count} cargos</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20, delay: 0.1 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-4 border border-emerald-100">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={16} className="text-emerald-500" />
              <span className="text-xs text-slate-500 font-bold uppercase">Competitivo (80-120%)</span>
            </div>
            <p className="text-3xl font-black text-emerald-600">{indicadores.pct_competitivo}%</p>
            <p className="text-sm text-slate-400">{indicadores.competitivo_count} cargos</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20, delay: 0.2 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-4 border border-amber-100">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={16} className="text-amber-500" />
              <span className="text-xs text-slate-500 font-bold uppercase">Sobrepago (&gt;120%)</span>
            </div>
            <p className="text-3xl font-black text-amber-600">{indicadores.pct_sobrepago}%</p>
            <p className="text-sm text-slate-400">{indicadores.sobrepago_count} cargos</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20, delay: 0.3 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-4 border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={16} className="text-blue-500" />
              <span className="text-xs text-slate-500 font-bold uppercase">Costo Nivelacion Anual</span>
            </div>
            <p className="text-2xl font-black text-blue-600">{formatMoney(indicadores.costo_ajuste_anual_g)}</p>
            <p className="text-sm text-slate-400">Mensual: {formatMoney(indicadores.costo_ajuste_mensual_g)}</p>
          </motion.div>
        </div>
      )}

      {/* Segment info */}
      {indicadores && (
        <div className="bg-white rounded-xl p-4 border border-emerald-100">
          <h4 className="text-sm font-bold text-slate-600 mb-2">Segmentacion (percentiles 33% y 66%)</h4>
          <div className="flex gap-4 text-sm">
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-bold">Segmento 1: 0 - {indicadores.p1_segmento} pts</span>
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold">Segmento 2: {indicadores.p1_segmento} - {indicadores.p2_segmento} pts</span>
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 font-bold">Segmento 3: &gt;{indicadores.p2_segmento} pts</span>
          </div>
        </div>
      )}

      {/* Variable selector + filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-2">
          {varKeys.map(v => (
            <button
              key={v}
              onClick={() => setVarSelected(v)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                varSelected === v
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {varLabels[v]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Filter size={14} className="text-slate-400" />
          <select
            value={areaFilter}
            onChange={e => setAreaFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-emerald-200 text-sm font-bold bg-white"
          >
            {areas.map(a => (
              <option key={a} value={a}>{a === 'all' ? 'Todas las areas' : a}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-xl border border-emerald-200 text-sm font-bold bg-white"
          >
            <option value="puntos">Ordenar por puntos</option>
            <option value="ratio">Ordenar por ratio</option>
            <option value="desviacion">Ordenar por desviacion</option>
            <option value="ajuste">Ordenar por ajuste</option>
          </select>
        </div>
      </div>

      {/* Chart */}
      {curves && resultados.length > 0 && (
        <div className="glass-card rounded-2xl p-6 border border-emerald-100">
          <h3 className="font-bold text-lg text-forest mb-4">Dispersion Puntos vs {varLabels[varSelected]}</h3>
          <ScatterChart data={resultados} curves={curves} varKey={varSelected} areaFilter={areaFilter} />
        </div>
      )}

      {/* Regression models */}
      {Object.keys(regresiones).length > 0 && (
        <div className="glass-card rounded-2xl p-6 border border-emerald-100">
          <h3 className="font-bold text-lg text-forest mb-4">Parametros de Regresion por Segmento</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {varKeys.map(v => (
              <div key={v} className="bg-white rounded-xl p-4 border border-emerald-100">
                <h4 className="font-bold text-sm text-slate-600 mb-3">{varLabels[v]}</h4>
                {Object.entries(regresiones[v] || {}).map(([seg, params]) => (
                  <div key={seg} className="text-sm mb-2">
                    <span className="font-bold text-slate-500">Seg {seg}:</span>{' '}
                    <span className="text-slate-700">y = {params.m?.toFixed(2)}x + {params.b?.toLocaleString()}</span>{' '}
                    <span className="text-slate-400">(R²={params.r2?.toFixed(3)}, n={params.n})</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results table */}
      {filteredResults.length > 0 && (
        <div className="glass-card rounded-2xl p-6 border border-emerald-100">
          <h3 className="font-bold text-lg text-forest mb-4">
            Resultados por Cargo ({filteredResults.length} cargos)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="text-left p-3 font-bold">Cargo</th>
                  <th className="text-left p-3 font-bold">Area</th>
                  <th className="text-center p-3 font-bold">Puntos</th>
                  <th className="text-center p-3 font-bold">Seg</th>
                  <th className="text-right p-3 font-bold">Salario Actual</th>
                  <th className="text-right p-3 font-bold">Salario Esperado</th>
                  <th className="text-right p-3 font-bold">Desviacion</th>
                  <th className="text-center p-3 font-bold">Ratio</th>
                  <th className="text-right p-3 font-bold">Ajuste</th>
                  <th className="text-center p-3 font-bold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r, i) => {
                  const salActual = r[`salario_${varSelected}`];
                  const salEsperado = r[`salario_${varSelected}_esperado`];
                  const desv = r[`desviacion_${varSelected}`];
                  const ratio = r[`ratio_${varSelected}`];
                  const ajuste = r[`ajuste_${varSelected}`];

                  const estadoColor = ratio != null && ratio < 0.8
                    ? 'bg-red-100 text-red-700'
                    : ratio != null && ratio > 1.2
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700';
                  const estadoText = ratio != null && ratio < 0.8
                    ? 'Subpago'
                    : ratio != null && ratio > 1.2
                    ? 'Sobrepago'
                    : 'Competitivo';

                  return (
                    <tr key={i} className="border-t border-emerald-50 hover:bg-emerald-50/50 transition-colors">
                      <td className="p-3 font-medium">{r.nombre_cargo}</td>
                      <td className="p-3 text-slate-500">{r.area || '-'}</td>
                      <td className="p-3 text-center font-bold">{r.puntos}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          r.segmento === 1 ? 'bg-blue-100 text-blue-700' :
                          r.segmento === 2 ? 'bg-emerald-100 text-emerald-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          S{r.segmento}
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium">{formatMoney(salActual)}</td>
                      <td className="p-3 text-right text-slate-600">{formatMoney(salEsperado)}</td>
                      <td className={`p-3 text-right font-bold ${desv < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatMoney(desv)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-bold">{ratio ? `${(ratio * 100).toFixed(0)}%` : '-'}</span>
                      </td>
                      <td className={`p-3 text-right font-bold ${ajuste > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {ajuste > 0 ? `+${formatMoney(ajuste)}` : '-'}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${estadoColor}`}>
                          {estadoText}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="glass-card rounded-2xl p-12 text-center space-y-4">
          <Loader2 size={48} className="mx-auto animate-spin text-primary" />
          <h3 className="text-xl font-bold text-forest">Ejecutando modelo de equidad...</h3>
          <p className="text-slate-500">Segmentando datos, calculando regresiones y generando curvas</p>
        </div>
      )}

      {/* No data */}
      {!loading && resultados.length === 0 && (
        <div className="max-w-7xl mx-auto">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-4">
            <strong>Funcionalidad Legacy</strong> — Esta pestaña ha sido reemplazada por el nuevo flujo.
            Ve a <strong>Formulario → Organización → Sesiones</strong> para usar el pipeline actualizado.
          </div>
          <div className="glass-card rounded-2xl p-12 text-center space-y-4">
            <Target size={48} className="mx-auto text-slate-300" />
            <h3 className="text-xl font-bold text-forest">Sin datos suficientes</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Completa la <strong>Valuacion</strong> de cargos para ejecutar el modelo de equidad salarial.
            </p>
          </div>
        </div>
      )}

      {onBack && (
        <div className="flex justify-start">
          <button onClick={onBack} className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-all shadow-sm">
            ← Volver a Análisis
          </button>
        </div>
      )}
    </div>
  );
}

export default EquidadView;
