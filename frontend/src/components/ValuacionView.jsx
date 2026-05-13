import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  BarChart2, ChevronDown, ChevronUp, Download, Loader2, Play,
  CheckCircle, AlertCircle, RefreshCw, Sparkles, ClipboardList,
  ArrowRight, Building, FileSpreadsheet, Info, X, HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants ──────────────────────────────────────────────────────────────
//
// DESCRIPCIONES EXTRAÍDAS DEL EXCEL "Herramienta de Estructura Salarial"
//[Pestaña "Conocimiento"] para Conocimientos
//[Pestaña "Experiencia"] para Experiencia Específica
//[Pestaña "Habilidad"] para Habilidad Gerencial
// ... etc para todos los criterios

// Factor options sincronizados con SesionesView y scoring_service.py
const FACTOR_OPTIONS = {
  conocimientos: ['Básico', 'Medio', 'Avanzado', 'Experto'],
  experiencia: ['Mínima', '1-2 años', '3-5 años', '5-7 años', '7+ años'],
  habilidadGerencial: ['No requiere', 'Baja', 'Media', 'Alta'],
  rolCargo: ['Individual', 'Supervisión', 'Táctico', 'Estratégico', 'Dirección'],
  contacto: ['Interno', 'Mixto', 'Externo', 'Cliente'],
  frecuenciaContacto: ['Esporádica', 'Mensual', 'Semanal', 'Diaria', 'Permanente'],
  contenidoRelaciones: ['Informativo', 'Coordinación', 'Negociación', 'Asesoría'],
  complejidadConceptual: ['Repetitiva', 'Procedimental', 'Analítica', 'Creativa', 'Estratégica'],
  tendenciaCC: ['Estable', 'Creciente', 'Decreciente'],
  guiasApoyo: ['Específicas', 'Generales', 'Políticas', 'Autonomía total'],
  tendenciaGA: ['Estable', 'Creciente', 'Decreciente'],
  impacto: ['Mínimo', 'Medio', 'Alto', 'Crítico'],
  autonomia: ['Nula', 'Supervisada', 'Guiada', 'Total'],
  magnitud: ['Pequeña', 'Mediana', 'Grande', 'Corporativa'],
};

const CRITERIA_DEFS = {
  conocimientos: {
    options: FACTOR_OPTIONS.conocimientos,
    descriptions: {
      'Básico': 'Conocimiento fundamental de rutinas y procesos simples para tareas manuales o administrativas básicas.',
      'Medio': 'Conocimiento de técnicas, métodos o procedimientos que requieren integración de varias rutinas.',
      'Avanzado': 'Conocimiento profundo de una disciplina, teoría o principios profesionales con capacidad analítica.',
      'Experto': 'Maestría en una ciencia o arte profesional. Conocimiento amplio y profundo en múltiples áreas funcionales.',
    }
  },
  experiencia: {
    label: 'Experiencia Previa en Roles Similares',
    options: FACTOR_OPTIONS.experiencia,
    descriptions: {
      'Mínima': 'Menos de 1 año de experiencia en roles similares.',
      '1-2 años': 'Entre 1 y 2 años de experiencia comprobable.',
      '3-5 años': 'Entre 3 y 5 años de experiencia relevante.',
      '5-7 años': 'Entre 5 y 7 años de experiencia significativa.',
      '7+ años': 'Más de 7 años de experiencia con resultados demostrables.',
    }
  },
  habilidadGerencial: {
    label: 'Habilidad Gerencial',
    options: FACTOR_OPTIONS.habilidadGerencial,
    descriptions: {
      'No requiere': 'No requiere supervisar ni coordinar trabajo de otros. Ejecuta actividades individuales.',
      'Baja': 'Supervisa tareas propias y de otros homogéneas. Coordinación operativa básica.',
      'Media': 'Coordina actividades y procesos. Define prioridades y asigna trabajo en un área funcional.',
      'Alta': 'Define metas y políticas para múltiples áreas. Integración estratégica y gestión de recursos.',
    }
  },
  rolCargo: {
    label: 'Rol del Cargo',
    options: FACTOR_OPTIONS.rolCargo,
    descriptions: {
      'Individual': 'Ejecuta actividades definidas como parte de un equipo. Sin responsabilidad de supervisión.',
      'Supervisión': 'Supervisa un equipo pequeño. Asigna tareas y verifica resultados.',
      'Táctico': 'Coordina equipos y procesos. Traduce estrategias en planes operativos.',
      'Estratégico': 'Define estrategias y políticas. Lidera áreas funcionales o de negocio.',
      'Dirección': 'Lidera la organización o unidades de negocio. Define visión y rumbo estratégico.',
    }
  },
  contacto: {
    label: 'Contacto',
    options: FACTOR_OPTIONS.contacto,
    descriptions: {
      'Interno': 'Relacionamiento dentro de la misma área funcional.',
      'Mixto': 'Relacionamiento con otras áreas funcionales y/o entidades externas.',
      'Externo': 'Contacto predominante con clientes, proveedores, autoridades y entes externos.',
      'Cliente': 'Contacto permanente con clientes externos como función principal del cargo.',
    }
  },
  frecuenciaContacto: {
    label: 'Frecuencia del Contacto',
    options: FACTOR_OPTIONS.frecuenciaContacto,
    descriptions: {
      'Esporádica': 'Contactos ocasionales o poco frecuentes. Comunicación irregular.',
      'Mensual': 'Contactos regulares mensuales. Interacciones programadas.',
      'Semanal': 'Contactos frecuentes varias veces por semana.',
      'Diaria': 'Contactos diarios como parte rutinaria del trabajo.',
      'Permanente': 'Comunicación continua y permanente requerida para la operación.',
    }
  },
  contenidoRelaciones: {
    label: 'Contenido de las Relaciones',
    options: FACTOR_OPTIONS.contenidoRelaciones,
    descriptions: {
      'Informativo': 'Intercambio de información de rutina. Coordinación básica.',
      'Coordinación': 'Coordinación de actividades y aclaración de asuntos operativos.',
      'Negociación': 'Negociación, persuasión e influencia para lograr acuerdos.',
      'Asesoría': 'Asesoría estratégica. Representación de la organización en negociaciones complejas.',
    }
  },
  complejidadConceptual: {
    label: 'Complejidad Conceptual',
    options: FACTOR_OPTIONS.complejidadConceptual,
    descriptions: {
      'Repetitiva': 'Situaciones idénticas y repetitivas. Soluciones aprendidas previamente.',
      'Procedimental': 'Situaciones típicas con elementos nuevos que requieren aplicar procedimientos conocidos.',
      'Analítica': 'Análisis de información diversa para resolver problemas no estructurados.',
      'Creativa': 'Desarrollo de nuevas soluciones, métodos o enfoques para situaciones complejas.',
      'Estratégica': 'Análisis estratégico de alto nivel. Decisiones que afectan el rumbo organizacional.',
    }
  },
  tendenciaCC: {
    label: 'Tendencia Complejidad',
    options: FACTOR_OPTIONS.tendenciaCC,
    descriptions: {
      'Estable': 'La complejidad se mantiene estable. Situaciones predecibles y recurrentes.',
      'Creciente': 'La complejidad tiende a aumentar. Nuevos desafíos y escenarios emergentes.',
      'Decreciente': 'La complejidad tiende a disminuir. Mayor estandarización y procesos definidos.',
    }
  },
  guiasApoyo: {
    label: 'Guías de Apoyo',
    options: FACTOR_OPTIONS.guiasApoyo,
    descriptions: {
      'Específicas': 'Instrucciones detalladas y específicas. Procedimientos paso a paso definidos.',
      'Generales': 'Normas y políticas generales. El ocupante decide cómo ejecutar.',
      'Políticas': 'Políticas amplias de organización. Objetivos definidos estratégicamente.',
      'Autonomía total': 'Autonomía completa. Solo guiado por la visión y estrategia global.',
    }
  },
  tendenciaGA: {
    label: 'Tendencia Guías',
    options: FACTOR_OPTIONS.tendenciaGA,
    descriptions: {
      'Estable': 'El nivel de guías se mantiene estable. Procesos y procedimientos consolidados.',
      'Creciente': 'Se requiere mayor autonomía. Guías menos definidas, más interpretación.',
      'Decreciente': 'Mayor estructuración. Procesos más definidos y estandarizados.',
    }
  },
  impacto: {
    label: 'Impacto del Cargo',
    options: FACTOR_OPTIONS.impacto,
    descriptions: {
      'Mínimo': 'El cargo existe para dar servicios o información. Impacto indirecto en resultados.',
      'Medio': 'Apoya la consecución de resultados de su área. Influye en decisiones operativas.',
      'Alto': 'Responsable directo de resultados del área o unidad. Impacto en resultados del negocio.',
      'Crítico': 'Enteramente responsable por los resultados finales de la empresa o unidad de negocio.',
    }
  },
  autonomia: {
    label: 'Autonomía',
    options: FACTOR_OPTIONS.autonomia,
    descriptions: {
      'Nula': 'Actúa bajo instrucciones exactas y supervisión continua. Sin capacidad de decisión.',
      'Supervisada': 'Decisiones menores bajo supervisión. Sigue procedimientos específicos.',
      'Guiada': 'Decisiones dentro de políticas generales. Autonomía para lograr objetivos definidos.',
      'Total': 'Autonomía estratégica total. Define metas globales y rumbo del negocio.',
    }
  },
  magnitud: {
    label: 'Magnitud',
    options: FACTOR_OPTIONS.magnitud,
    descriptions: {
      'Pequeña': 'Presupuesto o volumen pequeño. Impacto limitado a un área o equipo.',
      'Mediana': 'Presupuesto o volumen mediano. Impacto en múltiples áreas o procesos.',
      'Grande': 'Presupuesto o volumen grande. Impacto significativo en la organización.',
      'Corporativa': 'Presupuesto o volumen corporativo. Impacto en todo el grupo empresarial.',
    }
  },
  criterio1: { 
    label: 'Criterio Criticidad 1', 
    options: ['0','1'], 
    descriptions: { 
      '0': 'NO – El cargo NO requiere conocimientos específicos relacionados con la estrategia del negocio.',
      '1': 'SÍ – El cargo requiere conocimientos específicos relacionados con la estrategia del negocio.' 
    } 
  },
  criterio2: { 
    label: 'Criterio Criticidad 2', 
    options: ['0','1'], 
    descriptions: { 
      '0': 'NO – El cargo NO pertenece al core del negocio ni a procesos críticos para la organización.',
      '1': 'SÍ – El cargo pertenece al core del negocio o a procesos críticos para la organización.' 
    } 
  },
  criterio3: { 
    label: 'Criterio Criticidad 3', 
    options: ['0','1'], 
    descriptions: { 
      '0': 'NO – La oferta de personas con los conocimientos requeridos en el mercado laboral NO es escasa para este cargo.',
      '1': 'SÍ – La oferta de personas con los conocimientos requeridos en el mercado laboral es escasa para este cargo.' 
    } 
  },
};

// ─── Point calculation tables (SHR/HAY methodology) ──────────────────────────
// Sincronizados con backend analisis_service._estimar_puntos

const CATEGORY_RANGES = [
  { cat: 1, min: 87, max: 100 },
  { cat: 2, min: 101, max: 115 },
  { cat: 3, min: 116, max: 132 },
  { cat: 4, min: 133, max: 152 },
  { cat: 5, min: 153, max: 175 },
  { cat: 6, min: 176, max: 201 },
  { cat: 7, min: 202, max: 231 },
  { cat: 8, min: 232, max: 266 },
  { cat: 9, min: 267, max: 306 },
  { cat: 10, min: 307, max: 352 },
  { cat: 11, min: 353, max: 405 },
  { cat: 12, min: 406, max: 466 },
  { cat: 13, min: 467, max: 536 },
  { cat: 14, min: 537, max: 616 },
  { cat: 15, min: 617, max: 708 },
  { cat: 16, min: 709, max: 814 },
  { cat: 17, min: 815, max: 936 },
  { cat: 18, min: 937, max: 1076 },
  { cat: 19, min: 1077, max: 1237 },
  { cat: 20, min: 1238, max: 1423 },
  { cat: 21, min: 1424, max: 1636 },
  { cat: 22, min: 1637, max: 1881 },
  { cat: 23, min: 1882, max: 2163 },
  { cat: 24, min: 2164, max: 2487 },
  { cat: 25, min: 2488, max: 2860 },
];

// Points sincronizados con scoring_service.py
const PTS = {
  conocimientos: { 'Básico': 20, 'Medio': 40, 'Avanzado': 60, 'Experto': 80 },
  experiencia: { 'Mínima': 0.6, '1-2 años': 0.8, '3-5 años': 1.0, '5-7 años': 1.2, '7+ años': 1.4 },
  habilidadGerencial: { 'No requiere': 10, 'Baja': 20, 'Media': 30, 'Alta': 40 },
  rolCargo: { 'Individual': 10, 'Supervisión': 15, 'Táctico': 25, 'Estratégico': 35, 'Dirección': 45 },
  contacto: { 'Interno': 5, 'Mixto': 10, 'Externo': 15, 'Cliente': 20 },
  frecuenciaContacto: { 'Esporádica': 2, 'Mensual': 4, 'Semanal': 6, 'Diaria': 8, 'Permanente': 10 },
  contenidoRelaciones: { 'Informativo': 5, 'Coordinación': 10, 'Negociación': 15, 'Asesoría': 20 },
  complejidadConceptual: { 'Repetitiva': 10, 'Procedimental': 20, 'Analítica': 30, 'Creativa': 40, 'Estratégica': 50 },
  tendencia: { 'Estable': 0.85, 'Creciente': 1.0, 'Decreciente': 1.15 },
  guiasApoyo: { 'Específicas': 10, 'Generales': 20, 'Políticas': 30, 'Autonomía total': 40 },
  impacto: { 'Mínimo': 10, 'Medio': 20, 'Alto': 30, 'Crítico': 40 },
  autonomia: { 'Nula': 10, 'Supervisada': 20, 'Guiada': 30, 'Total': 40 },
  magnitud: { 'Pequeña': 5, 'Mediana': 10, 'Grande': 15, 'Corporativa': 20 },
};

function getCategory(score) {
  for (const range of CATEGORY_RANGES) {
    if (score >= range.min && score <= range.max) {
      return range.cat;
    }
  }
  if (score < 87) return 1;
  return 25;
}

function getCategoryLabel(cat) {
  const labels = {
    1: 'Operativo',
    2: 'Operativo',
    3: 'Operativo/Analista',
    4: 'Analista Jr',
    5: 'Analista',
    6: 'Analista Sr',
    7: 'Especialista Jr',
    8: 'Especialista',
    9: 'Especialista Sr',
    10: 'Coordinador Jr',
    11: 'Coordinador',
    12: 'Coordinador Sr',
    13: 'Jefe Jr',
    14: 'Jefe',
    15: 'Jefe Sr/Gerente Jr',
    16: 'Gerente Jr',
    17: 'Gerente',
    18: 'Gerente Sr',
    19: 'Gerente Director',
    20: 'Director Jr',
    21: 'Director',
    22: 'Director Sr',
    23: 'Vicepresidente Jr',
    24: 'Vicepresidente',
    25: 'Presidente',
  };
  return labels[cat] || `Cat ${cat}`;
}

function calcTotalPoints(v) {
  const pts = PTS;
  const f1_saber = (
    (pts.conocimientos[v.conocimientos] || 40) *
    (pts.experiencia[v.experiencia] || 1.0) +
    (pts.habilidadGerencial[v.habilidadGerencial] || 20) +
    (pts.rolCargo[v.rolCargo] || 15)
  );

  const f2_contacto = (
    (pts.contacto[v.contacto] || 10) +
    (pts.frecuenciaContacto[v.frecuenciaContacto] || 4) +
    (pts.contenidoRelaciones[v.contenidoRelaciones] || 10)
  );

  const f3_complejidad = (
    (pts.complejidadConceptual[v.complejidadConceptual] || 20) *
    (pts.tendencia[v.tendenciaCC] || 1.0) +
    (pts.guiasApoyo[v.guiasApoyo] || 20) *
    (pts.tendencia[v.tendenciaGA] || 1.0)
  );

  const f4_impacto = (
    (pts.impacto[v.impacto] || 20) +
    (pts.autonomia[v.autonomia] || 20) +
    (pts.magnitud[v.magnitud] || 10)
  );

  const crit = (parseInt(v.criterio1) === 1 ? 1 : 0) + (parseInt(v.criterio2) === 1 ? 1 : 0) + (parseInt(v.criterio3) === 1 ? 1 : 0);
  const raw = Math.round(f1_saber + f2_contacto + f3_complejidad + f4_impacto);
  const total = Math.round(raw * (1 + crit * 0.05));

  const cat = getCategory(total);
  
  return { 
    f1: Math.round(f1_saber), 
    f2: Math.round(f2_contacto), 
    f3: Math.round(f3_complejidad), 
    f4: Math.round(f4_impacto), 
    criticidad: crit, 
    raw,
    total,
    categoria: cat,
    categoriaLabel: getCategoryLabel(cat)
  };
}

// ─── AI prompt builder ───────────────────────────────────────────────────────

const buildPrompt = (cargo, area, homologado, descripcion) => `
Eres un analista experto en valoración de cargos y compensación con la metodología HAY/SHR.
Debes evaluar el siguiente cargo y seleccionar EXACTAMENTE UN (1) nivel por cada criterio.

CARGO: ${cargo}
ÁREA: ${area}
CARGO HOMOLOGADO: ${homologado || cargo}
DESCRIPCIÓN DEL CARGO: ${descripcion || 'No disponible'}

CRITICO: Cada campo debe tener UN SOLO VALOR. NUNCA uses rangos.

Responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional, con esta estructura exacta:
{
  "conocimientos": "Medio",
  "experiencia": "3-5 años",
  "habilidadGerencial": "Media",
  "rolCargo": "Individual",
  "contacto": "Interno",
  "frecuenciaContacto": "Semanal",
  "contenidoRelaciones": "Coordinación",
  "complejidadConceptual": "Analítica",
  "tendenciaCC": "Creciente",
  "guiasApoyo": "Generales",
  "tendenciaGA": "Estable",
  "impacto": "Medio",
  "autonomia": "Guiada",
  "magnitud": "Mediana",
  "criterio1": 0,
  "criterio2": 0,
  "criterio3": 0,
  "justificacion": "Breve análisis del cargo en 2-3 líneas"
}

Opciones validas (SOLO UNA por campo, NUNCA un rango):
- conocimientos: Básico, Medio, Avanzado, Experto
- experiencia: Mínima, 1-2 años, 3-5 años, 5-7 años, 7+ años
- habilidadGerencial: No requiere, Baja, Media, Alta
- rolCargo: Individual, Supervisión, Táctico, Estratégico, Dirección
- contacto: Interno, Mixto, Externo, Cliente
- frecuenciaContacto: Esporádica, Mensual, Semanal, Diaria, Permanente
- contenidoRelaciones: Informativo, Coordinación, Negociación, Asesoría
- complejidadConceptual: Repetitiva, Procedimental, Analítica, Creativa, Estratégica
- tendenciaCC: Estable, Creciente, Decreciente
- guiasApoyo: Específicas, Generales, Políticas, Autonomía total
- tendenciaGA: Estable, Creciente, Decreciente
- impacto: Mínimo, Medio, Alto, Crítico
- autonomia: Nula, Supervisada, Guiada, Total
- magnitud: Pequeña, Mediana, Grande, Corporativa
- criterio1, criterio2, criterio3: SOLO 0 o 1 (NUNCA 2, 3 ni otro número)

REGLAS DE VALORACIÓN:
- Gerente General / CEO: Conocimientos Avanzado-Experto, Habilidad Alta, Autonomía Total, Impacto Crítico, Magnitud Corporativa
- Directores / Gerentes de área: Conocimientos Avanzado, Habilidad Media-Alta, Autonomía Guiada-Total, Impacto Alto-Crítico, Magnitud Grande-Corporativa
- Coordinadores / Jefes: Conocimientos Medio-Avanzado, Habilidad Media, Autonomía Guiada, Impacto Alto, Magnitud Mediana-Grande
- Analistas / Especialistas: Conocimientos Medio, Habilidad Baja-Media, Autonomía Supervisada-Guiada, Impacto Medio, Magnitud Pequeña-Mediana
- Auxiliares / Técnicos: Conocimientos Básico-Medio, Habilidad No requiere-Baja, Autonomía Nula-Supervisada, Impacto Mínimo-Medio, Magnitud Pequeña
`;

// ─── Sub-components ──────────────────────────────────────────────────────────

const HelpTooltip = ({ text, label }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className="text-slate-400 hover:text-primary transition-colors p-0.5"
        title={text}
      >
        <HelpCircle size={14}/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
          <div className="absolute left-full top-0 ml-2 z-50 w-72 bg-white border border-emerald-200 rounded-xl shadow-xl p-3 text-[11px] text-slate-600 leading-relaxed max-h-48 overflow-y-auto">
            <p className="font-bold text-forest mb-1 text-[10px] uppercase tracking-wider">{label}</p>
            <div className="text-[10px] whitespace-pre-wrap">{text}</div>
          </div>
        </>
      )}
    </div>
  );
};

const CriterioChip = ({ name, value, onChange, editing }) => {
  const def = CRITERIA_DEFS[name];
  if (!def) return null;
  const [open, setOpen] = useState(false);

  const tooltipText = def.options.map(opt => 
    `${opt}: ${def.descriptions[opt] || ''}`
  ).join('\n');

  if (!editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 truncate">{def.label}</span>
          <HelpTooltip text={tooltipText} label={def.label}/>
        </div>
        <span className="font-bold text-forest text-sm bg-emerald-50 rounded-lg px-2 py-1 inline-block text-center min-w-[2rem]">
          {value || '—'}
        </span>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 truncate">{def.label}</span>
        <HelpTooltip text={tooltipText} label={def.label}/>
      </div>
      <button
        onClick={() => setOpen(!open)}
        className="font-bold text-forest text-sm bg-white border-2 border-primary/30 hover:border-primary rounded-lg px-2 py-1 inline-flex items-center gap-1 min-w-[3rem] justify-between"
      >
        {value || '—'}
        <ChevronDown size={10}/>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-emerald-200 rounded-xl shadow-xl min-w-[320px] py-1 max-h-72 overflow-y-auto">
          {def.options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(name, opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-start gap-3 ${value === opt ? 'bg-emerald-100 text-primary font-bold' : 'text-slate-700'}`}
            >
              <span className="font-bold shrink-0 text-forest w-6 text-center bg-slate-100 rounded px-1">{opt}</span>
              <span className="text-[10px] leading-relaxed">{def.descriptions[opt]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const StatusIcon = ({ estado }) => {
  if (estado === 'valorado') return <CheckCircle size={14} className="text-emerald-500"/>;
  if (estado === 'procesando') return <Loader2 size={14} className="text-primary animate-spin"/>;
  if (estado === 'error') return <AlertCircle size={14} className="text-red-400"/>;
  return <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200"/>;
};

// ─── API helpers ─────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.VITE_API_URL || 'https://shr-backend-prod.onrender.com').replace(/\/$/, '');

const getToken = () => localStorage.getItem('token') || '';

const fetchCargosFromUpload = async (uploadId) => {
  const res = await fetch(`${API_BASE}/uploads/${uploadId}/cargos`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  if (!res.ok) throw new Error('Error fetching cargos');
  return res.json();
};

const fetchExtraDescriptions = async (uploadId) => {
  const res = await fetch(`${API_BASE}/uploads/${uploadId}/extra-descriptions`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.cargos || [];
};

const uploadExtraDescriptions = async (uploadId, files) => {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  const res = await fetch(`${API_BASE}/uploads/${uploadId}/extra-descriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData
  });
  if (!res.ok) throw new Error('Error uploading files');
  return res.json();
};

const fetchValoracionesFromUpload = async (uploadId) => {
  const res = await fetch(`${API_BASE}/uploads/${uploadId}/valoraciones`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  if (!res.ok) throw new Error('Error fetching valoraciones');
  return res.json();
};

// ─── Main Component ──────────────────────────────────────────────────────────

const ValuacionView = ({ uploadId, onValoracionesChange, onComplete, onBack }) => {
  const [cargos, setCargos] = useState([]);
  const [valoraciones, setValoraciones] = useState({});
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [processAll, setProcessAll] = useState(false);
  const [processAllProgress, setProcessAllProgress] = useState(0);
  const [error, setError] = useState(null);
  const [searchArea, setSearchArea] = useState('todas');
  const [extraDescriptions, setExtraDescriptions] = useState({});
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [hasExtraFiles, setHasExtraFiles] = useState(false);
  const abortRef = useRef(false);

  // Load extra descriptions and create cargos from them
  useEffect(() => {
    const loadData = async () => {
      const uploadIdNum = Number(uploadId);
      console.log('ValuacionView: loading with uploadId:', uploadId, 'parsed:', uploadIdNum);
      
      if (!uploadIdNum || isNaN(uploadIdNum)) {
        console.log('ValuacionView: no valid uploadId, skipping');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      // Clear old localStorage data
      try { localStorage.removeItem('shr_valoracion_cargos'); } catch {}
      
      try {
        // Load all cargos from the upload (from Excel requirements)
        console.log('ValuacionView: fetching cargos from upload...');
        let cargosList = await fetchCargosFromUpload(uploadIdNum);
        console.log('ValuacionView: got cargos:', cargosList);

        // Also try extra descriptions (PDF/DOCX) for supplementary descriptions
        const extraRes = await fetchExtraDescriptions(uploadIdNum);
        const extraMap = {};
        if (extraRes && extraRes.length > 0) {
          extraRes.forEach(c => { extraMap[c.nombre_cargo] = c.descripcion; });
          setHasExtraFiles(true);
        }

        if (cargosList && cargosList.length > 0) {
          // Map descripcion_empresa to descripcion for consistency
          cargosList = cargosList.map(c => ({
            ...c,
            descripcion: c.descripcion_empresa || extraMap[c.nombre_cargo] || '',
          }));
          setCargos(cargosList);
          setExtraDescriptions(extraMap);
          try { localStorage.setItem('shr_valoracion_cargos', JSON.stringify(cargosList)); } catch {}
        } else {
          setCargos([]);
          setHasExtraFiles(false);
          console.log('ValuacionView: no cargos found in upload');
        }

        // Load existing valoraciones from API
        const savedValoraciones = localStorage.getItem('shr_valoraciones');
        if (savedValoraciones) {
          try {
            const parsed = JSON.parse(savedValoraciones);
            setValoraciones(parsed);
          } catch {}
        }
      } catch (e) {
        console.error('ValuacionView: error loading data:', e);
        console.warn('Error loading data:', e.message);
        setError('Error cargando datos del upload. Verifica que el archivo Excel de requerimientos se haya subido correctamente.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [uploadId]);

  const saveValoraciones = (updated) => {
    setValoraciones(updated);
    try { localStorage.setItem('shr_valoraciones', JSON.stringify(updated)); } catch {}
    if (onValoracionesChange) onValoracionesChange(updated);
  };

  const callIA = async (cargoId, cargo) => {
    const extraDesc = cargo?.descripcion || extraDescriptions[cargo?.nombre_cargo] || '';
    const response = await fetch(`${API_BASE}/valoracion/${cargoId}/evaluar-ia`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({
        descripcion_cargo: extraDesc,
        nombre_cargo: cargo?.nombre_cargo || ''
      })
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(err || 'Error al evaluar con IA');
    }
    return response.json();
  };

  const processCargo = async (cargo) => {
    const id = cargo.id || cargo.nombre_cargo;
    setProcessingIds(prev => new Set([...prev, id]));

    try {
      const result = await callIA(id, cargo);
      const updated = { ...valoraciones, [id]: { ...result.valoracion, estado: 'valorado', justificacion: result.justificacion_ia || result.valoracion?.justificacion || '' } };
      saveValoraciones(updated);
      
      const uploadIdNum = Number(uploadId);
      if (uploadIdNum && !isNaN(uploadIdNum)) {
        try {
          const vals = await fetchValoracionesFromUpload(uploadIdNum);
          const map = {};
          vals.forEach(v => { if (v.valoracion) map[v.id] = v.valoracion; });
          setValoraciones(map);
          try { localStorage.setItem('shr_valoraciones', JSON.stringify(map)); } catch {}
        } catch {}
      }
    } catch (err) {
      const updated = { ...valoraciones, [id]: { estado: 'error', error: String(err) } };
      saveValoraciones(updated);
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const processAllCargos = async () => {
    abortRef.current = false;
    setProcessAll(true);
    setProcessAllProgress(0);

    for (let i = 0; i < filteredCargos.length; i++) {
      if (abortRef.current) break;
      const cargo = filteredCargos[i];
      const id = cargo.id || cargo.nombre_cargo;
      if (valoraciones[id]?.estado === 'valorado') {
        setProcessAllProgress(i + 1);
        continue;
      }
      await processCargo(cargo);
      setProcessAllProgress(i + 1);
      await new Promise(r => setTimeout(r, 800));
    }

    setProcessAll(false);

    const uploadIdNum = Number(uploadId);
    if (uploadIdNum && !isNaN(uploadIdNum)) {
      try {
        const vals = await fetchValoracionesFromUpload(uploadIdNum);
        const map = {};
        vals.forEach(v => { if (v.valoracion) map[v.id] = v.valoracion; });
        setValoraciones(map);
        try { localStorage.setItem('shr_valoraciones', JSON.stringify(map)); } catch {}
        if (onValoracionesChange) onValoracionesChange(map);
      } catch (e) {
        console.error('Error recargando valoraciones:', e);
      }
    }
  };

  const updateCriterio = (cargoId, field, value) => {
    const updated = {
      ...valoraciones,
      [cargoId]: { ...(valoraciones[cargoId] || {}), [field]: value, estado: 'valorado' }
    };
    saveValoraciones(updated);
  };

  const downloadExcel = () => {
    const headers = [
      'Cargo', 'Área', 'Cargo Homologado', 'Puntos Totales',
      'Conocimientos', 'Experiencia', 'Habilidad Gerencial', 'Rol del Cargo',
      'Contacto', 'Frecuencia Contacto', 'Contenido Relaciones',
      'Complejidad Conceptual', 'Tendencia CC', 'Guías de Apoyo', 'Tendencia GA',
      'Impacto', 'Autonomía', 'Magnitud',
      'Criterio 1', 'Criterio 2', 'Criterio 3',
      'Justificación', 'Estado'
    ];

    const rows = cargos.map(c => {
      const id = c.id || c.nombre_cargo;
      const v = valoraciones[id] || {};
      const pts = calcTotalPoints(v);
      return [
        c.nombre_cargo, c.area, c.homologacion?.cargo_homologado || '', pts.total,
        v.conocimientos || '', v.experiencia || '', v.habilidadGerencial || '', v.rolCargo || '',
        v.contacto || '', v.frecuenciaContacto || '', v.contenidoRelaciones || '',
        v.complejidadConceptual || '', v.tendenciaCC || '', v.guiasApoyo || '', v.tendenciaGA || '',
        v.impacto || '', v.autonomia || '', v.magnitud || '',
        v.criterio1 || '', v.criterio2 || '', v.criterio3 || '',
        (v.justificacion || '').replace(/,/g, ';'), v.estado || 'pendiente'
      ].map(x => `"${x}"`).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'valoracion_cargos_shr.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const valorados = Object.values(valoraciones).filter(v => v.estado === 'valorado').length;
  const total = cargos.length;
  const pct = total > 0 ? Math.round((valorados / total) * 100) : 0;

  const areas = ['todas', ...new Set(cargos.map(c => c.area).filter(Boolean))];
  const filteredCargos = searchArea === 'todas' ? cargos : cargos.filter(c => c.area === searchArea);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-primary">
        <Loader2 className="animate-spin" size={24}/>
        <span className="font-medium">Cargando cargos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
        <div className="inline-flex p-4 bg-red-50 rounded-2xl text-red-500">
          <AlertCircle size={40}/>
        </div>
        <p className="text-red-600 font-medium">{error}</p>
        <button onClick={() => { setError(null); setActiveTab('dashboard'); }}
          className="btn-primary">
          Volver al Dashboard
        </button>
      </div>
    );
  }

  if (cargos.length === 0 && !loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-6">
        <div className="inline-flex p-5 bg-emerald-50 rounded-3xl text-primary mb-2">
          <BarChart2 size={48}/>
        </div>
        <h2 className="text-3xl font-bold text-forest">Valoración de Cargos</h2>
        <p className="text-slate-500 text-lg max-w-md mx-auto">
          No hay cargos cargados. <strong>Sube el archivo Excel de requerimientos</strong> para iniciar la valoración.
        </p>
        <p className="text-sm text-slate-400">
          El archivo debe contener los datos de los cargos (nombre, área, descripción) en el formato de requerimientos.
        </p>
        <div className="glass-card p-6 rounded-2xl border border-emerald-100 text-sm text-emerald-700 bg-emerald-50/50 flex items-start gap-3">
          <Info size={18} className="shrink-0 mt-0.5"/>
          <p>Ve a la pestaña de Formulario para subir el archivo de requerimientos en formato Excel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-forest">📊 Paso 2 · Valoración de Cargos</h1>
          <p className="text-sm text-emerald-700/60 font-medium">
            {valorados}/{total} cargos valorados · {pct}% completado
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {processAll ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <Loader2 size={16} className="animate-spin"/>
                Procesando {processAllProgress}/{total}…
              </div>
              <button
                onClick={() => { abortRef.current = true; setProcessAll(false); }}
                className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-red-100 transition-all"
              >
                <X size={12}/> Detener
              </button>
            </div>
          ) : (
            <button
              onClick={processAllCargos}
              className="flex items-center gap-1.5 bg-forest text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-primary transition-all shadow-sm"
            >
              <Sparkles size={14}/> Valorar Todo con IA
            </button>
          )}
          <button
            onClick={downloadExcel}
            className="flex items-center gap-1.5 bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-50 transition-all shadow-sm"
          >
            <Download size={14}/> Exportar CSV
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-4 border border-emerald-100">
        <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
          <span>Progreso de valoración</span>
          <span className="text-primary">{pct}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-400 to-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        {processAll && (
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary/30 rounded-full"
              animate={{ width: `${(processAllProgress / total) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl p-4 border border-emerald-100 flex items-center gap-4">
          <span className="text-xs font-bold text-slate-500 shrink-0">Filtrar por área:</span>
          <select
            value={searchArea}
            onChange={(e) => setSearchArea(e.target.value)}
            className="flex-1 text-xs border border-emerald-200 rounded-lg px-3 py-2 bg-white text-slate-600 font-medium focus:outline-none focus:border-primary"
          >
            {areas.map(a => (
              <option key={a} value={a}>{a === 'todas' ? 'Todas las áreas' : a}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400">{filteredCargos.length} de {cargos.length} cargos</span>
        </div>

      <div className="space-y-3">
        {filteredCargos.map((cargo, idx) => {
          const id = cargo.id || cargo.nombre_cargo;
          const v = valoraciones[id] || {};
          const isProcessing = processingIds.has(id);
          const isExpanded = expandedId === id;
          const isEditing = editingId === id;
          const estado = isProcessing ? 'procesando' : (v.estado || 'pendiente');
          const pts = estado === 'valorado' ? calcTotalPoints(v) : null;

          return (
            <motion.div
              key={id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className={`glass-card rounded-2xl border-2 transition-all ${
                estado === 'valorado' ? 'border-emerald-200' :
                estado === 'error' ? 'border-red-200' :
                'border-white/60'
              }`}
            >
              <div className="flex items-center gap-3 p-4">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-slate-300 w-5 text-right">{idx + 1}</span>
                  <StatusIcon estado={estado}/>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-forest text-sm truncate">{cargo.nombre_cargo}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{cargo.area}</span>
                    {cargo.homologacion?.cargo_homologado && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                        → {cargo.homologacion.cargo_homologado}
                      </span>
                    )}
                    {pts && (
                      <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                        {pts.total} pts
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  {estado !== 'valorado' && !isProcessing && (
                    <button
                      onClick={() => processCargo(cargo)}
                      className="flex items-center gap-1 bg-primary text-white px-2.5 py-1.5 rounded-lg font-bold text-[11px] hover:bg-forest transition-all"
                    >
                      <Play size={10} fill="currentColor"/> IA
                    </button>
                  )}
                  {estado === 'valorado' && (
                    <button
                      onClick={() => setEditingId(isEditing ? null : id)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-[11px] transition-all border ${
                        isEditing ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary'
                      }`}
                    >
                      {isEditing ? <CheckCircle size={10}/> : <ClipboardList size={10}/>}
                      {isEditing ? 'Listo' : 'Editar'}
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-emerald-50 transition-all"
                  >
                    {isExpanded ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                  </button>
                </div>
              </div>

              {estado === 'valorado' && !isExpanded && pts && (
                <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[10px]">
                  {[
                    { label: 'F1 Conocimiento', val: pts.f1 },
                    { label: 'F2 Comunicación', val: pts.f2 },
                    { label: 'F3 Solución Prob.', val: pts.f3 },
                    { label: 'F4 Responsabilidad', val: pts.f4 },
                    { label: 'Criticidad', val: `+${pts.criticidad * 15}%` },
                  ].map(f => (
                    <div key={f.label} className="flex justify-between">
                      <span className="text-slate-400">{f.label}:</span>
                      <span className="font-bold text-primary">{f.val}</span>
                    </div>
                  ))}
                  <div className="flex justify-between col-span-2 sm:col-span-4 mt-1 pt-1 border-t border-emerald-100">
                    <span className="font-bold text-forest">Total Score:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-forest">{pts.total} pts</span>
                      <span className="bg-forest/10 text-forest px-2 py-0.5 rounded-full text-xs font-bold">CAT {pts.categoria}</span>
                      <span className="text-forest/70 text-xs">({pts.categoriaLabel})</span>
                    </div>
                  </div>
                </div>
              )}

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-emerald-100 px-4 py-4 space-y-4">
                      {v.justificacion && (
                        <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">🤖 Análisis IA</p>
                          <p className="text-xs text-slate-600 leading-relaxed">{v.justificacion}</p>
                        </div>
                      )}

                      {pts && (
                        <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100 grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {[
                            { label: 'F1 Conocimiento', val: pts.f1 },
                            { label: 'F2 Comunicación', val: pts.f2 },
                            { label: 'F3 Solución Prob.', val: pts.f3 },
                            { label: 'F4 Responsabilidad', val: pts.f4 },
                            { label: 'Total', val: pts.total },
                          ].map(f => (
                            <div key={f.label} className="text-center">
                              <p className="text-[9px] font-bold uppercase text-amber-600">{f.label}</p>
                              <p className={`font-bold text-lg ${f.label === 'Total' ? 'text-forest' : 'text-amber-700'}`}>{f.val}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-600 mb-2 pb-1 border-b border-emerald-100">
                          Factor 1 · Conocimiento &amp; Habilidad Gerencial
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {['conocimientos','experiencia','habilidadGerencial','rolCargo'].map(k => (
                            <CriterioChip
                              key={k} name={k} value={v[k]}
                              editing={isEditing}
                              onChange={(field, val) => updateCriterio(id, field, val)}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-600 mb-2 pb-1 border-b border-blue-100">
                          Factor 2 · Habilidades de Comunicación
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {['contacto','frecuenciaContacto','contenidoRelaciones'].map(k => (
                            <CriterioChip
                              key={k} name={k} value={v[k]}
                              editing={isEditing}
                              onChange={(field, val) => updateCriterio(id, field, val)}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-purple-600 mb-2 pb-1 border-b border-purple-100">
                          Factor 3 · Solución de Problemas
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {['complejidadConceptual','tendenciaCC','guiasApoyo','tendenciaGA'].map(k => (
                            <CriterioChip
                              key={k} name={k} value={v[k]}
                              editing={isEditing}
                              onChange={(field, val) => updateCriterio(id, field, val)}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-600 mb-2 pb-1 border-b border-amber-100">
                          Factor 4 · Responsabilidad sobre los Resultados
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {['impacto','autonomia','magnitud'].map(k => (
                            <CriterioChip
                              key={k} name={k} value={v[k]}
                              editing={isEditing}
                              onChange={(field, val) => updateCriterio(id, field, val)}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-red-500 mb-2 pb-1 border-b border-red-100">
                          Criticidad (1 = Sí aplica / 0 = No aplica)
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                          {['criterio1','criterio2','criterio3'].map(k => (
                            <CriterioChip
                              key={k} name={k} value={v[k]}
                              editing={isEditing}
                              onChange={(field, val) => updateCriterio(id, field, val)}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() => processCargo(cargo)}
                          disabled={isProcessing}
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-primary font-medium transition-all"
                        >
                          <RefreshCw size={12}/> Reprocesar con IA
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default ValuacionView;
