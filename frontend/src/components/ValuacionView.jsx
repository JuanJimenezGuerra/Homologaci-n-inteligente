import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  BarChart2, ChevronDown, ChevronUp, Download, Loader2, Play,
  CheckCircle, AlertCircle, RefreshCw, Sparkles, ClipboardList,
  ArrowRight, Building, FileSpreadsheet, Info, X, HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants ──────────────────────────────────────────────────────────────

const CRITERIA_DEFS = {
  conocimientos: {
    label: 'Conocimientos',
    options: ['A','B','C','D','E','F','G','H'],
    descriptions: {
      A: 'Rutinas de trabajo simples / manual',
      B: 'Procesos y procedimientos / equipos simples',
      C: 'Técnica o método complejo / equipos especializados',
      D: 'Teoría, principios o leyes de una disciplina profesional',
      E: 'Ciencia/disciplina profesional o técnica avanzada',
      F: 'Conocimiento profundo de disciplina o amplio en área funcional',
      G: 'Maestría en disciplina / conocimiento amplio en varias áreas',
      H: 'Maestría excepcional / conocimiento en TODAS las áreas',
    }
  },
  experiencia: {
    label: 'Experiencia Específica',
    options: ['-','o','+'],
    descriptions: {
      '-': 'Menos de 6 meses (A-C) / menos de 2 años (D-H)',
      'o': '6 meses a 1 año (A-C) / 2 a 5 años (D-H)',
      '+': 'Más de 1 año (A-C) / más de 5 años (D-H)',
    }
  },
  habilidadGerencial: {
    label: 'Habilidad Gerencial',
    options: ['I','II','III','IV','V','VI','VII'],
    descriptions: {
      I: 'INEXISTENTE – Ejecución de actividades semejantes',
      II: 'MÍNIMA – Supervisión de tareas propias/homogéneas',
      III: 'MODERADA – Coordinación de actividades/procesos',
      IV: 'MEDIA – Planeación y dirección de área funcional',
      V: 'ALTA – Dirección estratégica de varias áreas',
      VI: 'MUY ALTA – Dirección e integración de toda la empresa',
      VII: 'MÁXIMA – Dirección de grupo empresarial/corporativo',
    }
  },
  rolCargo: {
    label: 'Rol del Cargo',
    options: ['1','2','3','4'],
    descriptions: {
      '1': 'MIEMBRO DE EQUIPO',
      '2': 'MIEMBRO DE VARIOS EQUIPOS',
      '3': 'LÍDER DE EQUIPO',
      '4': 'LÍDER DE VARIOS EQUIPOS',
    }
  },
  contacto: {
    label: 'Contacto',
    options: ['A','B','C'],
    descriptions: {
      A: 'INTERNO – Misma área funcional',
      B: 'EXTERNO – Otras áreas / entidades externas',
      C: 'AMBOS (INTERNO Y EXTERNO)',
    }
  },
  frecuenciaContacto: {
    label: 'Frecuencia del Contacto',
    options: ['1','2','3','4'],
    descriptions: {
      '1': 'OCASIONAL',
      '2': 'MENSUAL',
      '3': 'SEMANAL',
      '4': 'DIARIO',
    }
  },
  contenidoRelaciones: {
    label: 'Contenido de las Relaciones',
    options: ['I','II','III','IV','V'],
    descriptions: {
      I: 'BÁSICO – Solicitar/transmitir información rutinaria',
      II: 'MODERADO – Indagar asuntos del cargo',
      III: 'IMPORTANTE – Negociar, persuadir, representar',
      IV: 'SUPERIOR – Lograr acuerdos de alto impacto',
      V: 'MUY SUPERIOR – Negociar en cualquier situación estratégica',
    }
  },
  complejidadConceptual: {
    label: 'Complejidad Conceptual',
    options: ['1','2','3','4','5'],
    descriptions: {
      '1': 'IDÉNTICOS – Situaciones simples y repetitivas',
      '2': 'SEMEJANTES – Situaciones típicas con elementos nuevos',
      '3': 'DIVERSOS – Diferentes frentes de acción por varias áreas',
      '4': 'NUEVOS – Situaciones poco comunes sin solución previa',
      '5': 'INCERTIDUMBRE – Alta complejidad sin soluciones conocidas',
    }
  },
  tendenciaCC: {
    label: 'Tendencia Complejidad',
    options: ['-','o','+'],
    descriptions: {
      '-': 'Tendencia baja dentro del nivel',
      'o': 'Nivel estándar',
      '+': 'Tendencia alta dentro del nivel',
    }
  },
  guiasApoyo: {
    label: 'Guías de Apoyo',
    options: ['A','B','C','D','E','F','G','H'],
    descriptions: {
      A: 'INSTRUCCIONES ESPECÍFICAS – Reglas simples y detalladas',
      B: 'INSTRUCCIONES GENERALES – Rutinas definidas',
      C: 'NORMAS ESTRUCTURADAS – Métodos/procedimientos claros',
      D: 'PROCEDIMIENTOS DEFINIDOS – Define el qué, elige el cómo',
      E: 'POLÍTICAS DEFINIDAS – Políticas amplias de organización',
      F: 'POLÍTICAS GENERALES – Objetivos del plan estratégico',
      G: 'GLOBAL – Análisis de asuntos complejos e investigación',
      H: 'ABSTRACTO – Múltiples conceptos complejos',
    }
  },
  tendenciaGA: {
    label: 'Tendencia Guías',
    options: ['-','o','+'],
    descriptions: {
      '-': 'Tendencia baja dentro del nivel',
      'o': 'Nivel estándar',
      '+': 'Tendencia alta dentro del nivel',
    }
  },
  impacto: {
    label: 'Impacto del Cargo',
    options: ['I','II','III','IV'],
    descriptions: {
      I: 'INFORMATIVO – Da información/servicios usados por otros',
      II: 'APOYO INDIRECTO – Análisis y asesoría que influyen decisiones',
      III: 'APOYO DIRECTO – Responsable de resultados del área',
      IV: 'ÚNICOS – Enteramente responsable de resultados finales',
    }
  },
  autonomia: {
    label: 'Autonomía',
    options: ['A','B','C','D','E','F','G'],
    descriptions: {
      A: 'INEXISTENTE – Sujeto a aprobación continua del jefe',
      B: 'RESTRINGIDA – Decisiones menores con alta supervisión',
      C: 'NORMALIZADA – Decisiones según instrucciones generales',
      D: 'ESTANDARIZADA – Decisiones complejas con políticas específicas',
      E: 'DIRIGIDA – Independencia para lograr objetivos del área',
      F: 'ORIENTADA – Decisiones que afectan objetivos empresariales',
      G: 'ESTRATÉGICA – Fijación de metas globales del negocio',
    }
  },
  magnitud: {
    label: 'Magnitud de Cifras',
    options: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14'],
    descriptions: {
      '1': '$0 (sin cifras directas)',
      '2': 'Hasta $0.5M USD anuales',
      '3': '$0.5M – $2M USD',
      '4': '$2M – $6M USD',
      '5': '$6M – $12M USD',
      '6': '$12M – $24M USD',
      '7': '$24M – $48M USD',
      '8': '$48M – $96M USD',
      '9': '$96M – $192M USD',
      '10': '$192M – $384M USD',
      '11': '$384M – $768M USD',
      '12': '$768M – $1,508M USD',
      '13': '$1,508M – $3,072M USD',
      '14': 'Más de $3,072M USD',
    }
  },
  criterio1: { label: 'Criterio Criticidad 1', options: ['0','1'], descriptions: { '0': 'No aplica', '1': 'Requiere conocimientos específicos de estrategia del negocio' } },
  criterio2: { label: 'Criterio Criticidad 2', options: ['0','1'], descriptions: { '0': 'No aplica', '1': 'Pertenece al core del negocio o procesos críticos' } },
  criterio3: { label: 'Criterio Criticidad 3', options: ['0','1'], descriptions: { '0': 'No aplica', '1': 'Oferta escasa en mercado laboral para este cargo' } },
};

// ─── Point calculation tables (SHR/HAY methodology) ─────────────────────────

const POINTS_CONOCIMIENTOS = { A: 112, B: 129, C: 147, D: 165, E: 184, F: 208, G: 240, H: 275 };
const POINTS_EXPERIENCIA = { '-': 0.87, 'o': 1.0, '+': 1.15 };
const POINTS_HABILIDAD = { I: 19, II: 38, III: 57, IV: 76, V: 95, VI: 114, VII: 133 };
const POINTS_ROL = { '1': 14, '2': 29, '3': 43, '4': 57 };
const POINTS_CONTACTO = { A: 14, B: 29, C: 43 };
const POINTS_FRECUENCIA = { '1': 5, '2': 19, '3': 33, '4': 47 };
const POINTS_CONTENIDO = { I: 9, II: 22, III: 38, IV: 57, V: 76 };
const POINTS_COMPLEJIDAD = { '1': 22, '2': 43, '3': 67, '4': 95, '5': 122 };
const POINTS_TENDENCIA = { '-': 0.87, 'o': 1.0, '+': 1.15 };
const POINTS_GUIAS = { A: 10, B: 19, C: 29, D: 43, E: 57, F: 71, G: 90, H: 108 };
const POINTS_IMPACTO = { I: 14, II: 29, III: 43, IV: 57 };
const POINTS_AUTONOMIA = { A: 5, B: 19, C: 33, D: 47, E: 62, F: 76, G: 95 };
const POINTS_MAGNITUD = { '1': 0, '2': 19, '3': 38, '4': 57, '5': 76, '6': 95, '7': 114, '8': 133, '9': 152, '10': 171, '11': 190, '12': 209, '13': 228, '14': 247 };

// Category ranges (from Excel Categorias sheet)
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
  const baseConoc = POINTS_CONOCIMIENTOS[v.conocimientos] || 0;
  const multExp = POINTS_EXPERIENCIA[v.experiencia] || 1;
  const f1 = baseConoc * multExp + (POINTS_HABILIDAD[v.habilidadGerencial] || 0) + (POINTS_ROL[v.rolCargo] || 0);

  const f2 = (POINTS_CONTACTO[v.contacto] || 0) + (POINTS_FRECUENCIA[v.frecuenciaContacto] || 0) + (POINTS_CONTENIDO[v.contenidoRelaciones] || 0);

  const baseCC = POINTS_COMPLEJIDAD[v.complejidadConceptual] || 0;
  const multCC = POINTS_TENDENCIA[v.tendenciaCC] || 1;
  const baseGA = POINTS_GUIAS[v.guiasApoyo] || 0;
  const multGA = POINTS_TENDENCIA[v.tendenciaGA] || 1;
  const f3 = baseCC * multCC + baseGA * multGA;

  const f4 = (POINTS_IMPACTO[v.impacto] || 0) + (POINTS_AUTONOMIA[v.autonomia] || 0) + (POINTS_MAGNITUD[v.magnitud] || 0);

  const criticidad = ((v.criterio1 === '1' ? 1 : 0) + (v.criterio2 === '1' ? 1 : 0) + (v.criterio3 === '1' ? 1 : 0));

  const raw = f1 + f2 + f3 + f4;
  const total = raw * (1 + criticidad * 0.15);
  const cat = getCategory(Math.round(total));
  
  return { 
    f1: Math.round(f1), 
    f2: Math.round(f2), 
    f3: Math.round(f3), 
    f4: Math.round(f4), 
    criticidad, 
    raw: Math.round(raw), 
    total: Math.round(total),
    categoria: cat,
    categoriaLabel: getCategoryLabel(cat)
  };
}

// ─── AI prompt builder ───────────────────────────────────────────────────────

const buildPrompt = (cargo, area, homologado, descripcion) => `
Eres un analista experto en valoración de cargos y compensación con la metodología HAY/SHR.
Debes evaluar el siguiente cargo y seleccionar el nivel correcto para CADA UNO de los 13 criterios.

CARGO: ${cargo}
ÁREA: ${area}
CARGO HOMOLOGADO: ${homologado || cargo}
DESCRIPCIÓN DEL CARGO: ${descripcion || 'No disponible'}

Responde EXCLUSIVAMENTE con un objeto JSON válido, sin texto adicional, con esta estructura:
{
  "conocimientos": "<A|B|C|D|E|F|G|H>",
  "experiencia": "<-|o|+>",
  "habilidadGerencial": "<I|II|III|IV|V|VI|VII>",
  "rolCargo": "<1|2|3|4>",
  "contacto": "<A|B|C>",
  "frecuenciaContacto": "<1|2|3|4>",
  "contenidoRelaciones": "<I|II|III|IV|V>",
  "complejidadConceptual": "<1|2|3|4|5>",
  "tendenciaCC": "<-|o|+>",
  "guiasApoyo": "<A|B|C|D|E|F|G|H>",
  "tendenciaGA": "<-|o|+>",
  "impacto": "<I|II|III|IV>",
  "autonomia": "<A|B|C|D|E|F|G>",
  "magnitud": "<1|2|3|4|5|6|7|8|9|10|11|12|13|14>",
  "criterio1": "<0|1>",
  "criterio2": "<0|1>",
  "criterio3": "<0|1>",
  "justificacion": "Breve análisis del cargo en 2-3 líneas"
}

REGLAS DE VALORACIÓN:
- Gerente General / CEO: Conocimientos G-H, Habilidad VI-VII, Autonomía F-G, Impacto IV
- Directores / Gerentes de área: Conocimientos F-G, Habilidad IV-V, Autonomía E-F, Impacto III-IV
- Coordinadores / Jefes: Conocimientos E-F, Habilidad III-IV, Autonomía D-E, Impacto III
- Analistas / Especialistas: Conocimientos D-E, Habilidad I-II, Autonomía C-D, Impacto II
- Auxiliares / Técnicos: Conocimientos B-C, Habilidad I, Autonomía A-B, Impacto I-II
- La magnitud refleja el presupuesto/volumen de negocio que maneja el cargo directamente
- Los criterios de criticidad (1, 2, 3) se activan con 1 si aplica al cargo
`;

// ─── Sub-components ──────────────────────────────────────────────────────────

const HelpTooltip = ({ text, label }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className="text-slate-400 hover:text-primary transition-colors"
        title={`Ayuda: ${label}`}
      >
        <HelpCircle size={12}/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 bg-white border border-emerald-200 rounded-xl shadow-xl p-3 text-[11px] text-slate-600 leading-relaxed">
            <p className="font-bold text-forest mb-1">{label}</p>
            <p>{text}</p>
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

  if (!editing) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 truncate">{def.label}</span>
          <HelpTooltip text="Selecciona el nivel que mejor describe este criterio para el cargo." label={def.label}/>
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
        <HelpTooltip text="Haz clic para ver las opciones disponibles y seleccionar el nivel adecuado." label={def.label}/>
      </div>
      <button
        onClick={() => setOpen(!open)}
        className="font-bold text-forest text-sm bg-white border-2 border-primary/30 hover:border-primary rounded-lg px-2 py-1 inline-flex items-center gap-1 min-w-[3rem] justify-between"
      >
        {value || '—'}
        <ChevronDown size={10}/>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-emerald-200 rounded-xl shadow-xl min-w-[220px] py-1">
          {def.options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(name, opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-start gap-2 ${value === opt ? 'bg-emerald-50 text-primary font-bold' : 'text-slate-700'}`}
            >
              <span className="font-bold shrink-0 text-forest w-6">{opt}</span>
              <span className="text-slate-500 text-[10px] leading-tight">{def.descriptions[opt]}</span>
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

const fetchValoracionesFromUpload = async (uploadId) => {
  const res = await fetch(`${API_BASE}/uploads/${uploadId}/valoraciones`, {
    headers: { Authorization: `Bearer ${getToken()}` }
  });
  if (!res.ok) throw new Error('Error fetching valoraciones');
  return res.json();
};

// ─── Main Component ──────────────────────────────────────────────────────────

const ValuacionView = ({ uploadId, cargosIniciales, valoracionesIniciales, onCargosChange, onValoracionesChange, onComplete, onBack }) => {
  const [cargos, setCargos] = useState(() => cargosIniciales || []);
  const [valoraciones, setValoraciones] = useState(() => valoracionesIniciales || {});
  const [loading, setLoading] = useState(!cargosIniciales || cargosIniciales.length === 0);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [processAll, setProcessAll] = useState(false);
  const [processAllProgress, setProcessAllProgress] = useState(0);
  const [error, setError] = useState(null);
  const abortRef = useRef(false);

  useEffect(() => {
    const loadCargos = async () => {
      let loadedFromLocalStorage = false;

      // 1. Intentar localStorage primero
      try {
        const saved = localStorage.getItem('shr_valoracion_cargos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.length > 0) {
            setCargos(parsed);
            loadedFromLocalStorage = true;
          }
        }
      } catch {}

      // 2. Si tenemos cargos iniciales, usarlos
      if (cargosIniciales && cargosIniciales.length > 0) {
        setCargos(cargosIniciales);
        setLoading(false);
        return;
      }

      // 3. Intentar API
      const uploadIdNum = Number(uploadId);
      if (uploadIdNum && !isNaN(uploadIdNum)) {
        setLoading(true);
        setError(null);
        try {
          const fetched = await fetchCargosFromUpload(uploadIdNum);
          setCargos(fetched);
          try { localStorage.setItem('shr_valoracion_cargos', JSON.stringify(fetched)); } catch {}
        } catch (e) {
          console.warn('Error cargando de API:', e.message);
          if (!loadedFromLocalStorage) {
            setError('No se pudieron cargar los cargos del servidor. Ve a la pestaña de Homologación primero.');
          }
        } finally {
          setLoading(false);
        }
        return;
      }

      // 4. Fallback final
      if (!loadedFromLocalStorage) {
        setError('No hay datos disponibles. Ve a la pestaña de Homologación primero.');
      }
    };

    loadCargos();
  }, [uploadId, cargosIniciales]);

  // Cargar cargos y valoraciones
  useEffect(() => {
    const loadData = async () => {
      let loadedFromLocalStorage = false;

      // 1. Intentar localStorage primero
      try {
        const saved = localStorage.getItem('shr_valoracion_cargos');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.length > 0) {
            setCargos(parsed);
            loadedFromLocalStorage = true;
          }
        }
      } catch {}

      // 2. Si tenemos cargos iniciales, usarlos
      if (cargosIniciales && cargosIniciales.length > 0) {
        setCargos(cargosIniciales);
        setLoading(false);
        return;
      }

      // 3. Intentar API
      const uploadIdNum = Number(uploadId);
      if (uploadIdNum && !isNaN(uploadIdNum)) {
        setLoading(true);
        setError(null);
        try {
          const fetched = await fetchCargosFromUpload(uploadIdNum);
          setCargos(fetched);
          try { localStorage.setItem('shr_valoracion_cargos', JSON.stringify(fetched)); } catch {}
        } catch (e) {
          console.warn('Error cargando de API:', e.message);
          if (!loadedFromLocalStorage) {
            setError('No se pudieron cargar los cargos del servidor. Ve a la pestaña de Homologación primero.');
          }
        } finally {
          setLoading(false);
        }
        return;
      }

      // 4. Fallback final
      if (!loadedFromLocalStorage) {
        try {
          const saved = localStorage.getItem('shr_valoracion_cargos');
          if (saved) {
            setCargos(JSON.parse(saved));
          } else {
            setError('No hay datos disponibles. Ve a la pestaña de Homologación primero.');
          }
        } catch {}
      }
    };

    loadData();
  }, [uploadId, cargosIniciales]);

  // Cargar valoraciones existentes del backend
  useEffect(() => {
    const loadValoraciones = async () => {
      // Si tenemos valoraciones iniciales, usarlas
      if (valoracionesIniciales && Object.keys(valoracionesIniciales).length > 0) {
        setValoraciones(valoracionesIniciales);
        return;
      }

      const uploadIdNum = Number(uploadId);
      if (uploadIdNum && !isNaN(uploadIdNum)) {
        try {
          const vals = await fetchValoracionesFromUpload(uploadIdNum);
          const map = {};
          vals.forEach(v => {
            if (v.valoracion) {
              map[v.id] = v.valoracion;
            }
          });
          setValoraciones(map);
          if (onValoracionesChange) onValoracionesChange(map);
          try { localStorage.setItem('shr_valoraciones', JSON.stringify(map)); } catch {}
        } catch {
          // Fallback a localStorage
          try {
            const saved = localStorage.getItem('shr_valoraciones');
            if (saved) {
              const parsed = JSON.parse(saved);
              setValoraciones(parsed);
            }
          } catch {}
        }
      }
    };
    
    loadValoraciones();
  }, [uploadId, valoracionesIniciales]);

  const saveValoraciones = (updated) => {
    setValoraciones(updated);
    try { localStorage.setItem('shr_valoraciones', JSON.stringify(updated)); } catch {}
    if (onValoracionesChange) onValoracionesChange(updated);
  };

  const callIA = async (cargoId) => {
    const response = await fetch(`${API_BASE}/valoracion/${cargoId}/evaluar-ia`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      }
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
      const result = await callIA(cargo.id);
      const updated = { ...valoraciones, [id]: { ...result.valoracion, estado: 'valorado', justificacion: result.justificacion_ia || result.valoracion?.justificacion || '' } };
      saveValoraciones(updated);
      
      // Recargar valoraciones del backend para asegurar consistencia
      const uploadId = Number(uploadData);
      if (uploadId && !isNaN(uploadId)) {
        try {
          const vals = await fetchValoracionesFromUpload(uploadId);
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

    for (let i = 0; i < cargos.length; i++) {
      if (abortRef.current) break;
      const cargo = cargos[i];
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

    // Recargar valoraciones del backend después del proceso
    if (uploadId) {
      try {
        const vals = await fetchValoracionesFromUpload(uploadId);
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

  if (cargos.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-6">
        <div className="inline-flex p-5 bg-emerald-50 rounded-3xl text-primary mb-2">
          <BarChart2 size={48}/>
        </div>
        <h2 className="text-3xl font-bold text-forest">Valoración de Cargos</h2>
        <p className="text-slate-500 text-lg max-w-md mx-auto">
          Para iniciar la valoración, primero completa el <strong>Paso 1: Homologación</strong> y procesa al menos un proceso.
          Los cargos aparecerán aquí automáticamente.
        </p>
        <div className="glass-card p-6 rounded-2xl border border-emerald-100 text-sm text-emerald-700 bg-emerald-50/50 flex items-start gap-3">
          <Info size={18} className="shrink-0 mt-0.5"/>
          <p>Los datos se transfieren automáticamente del Paso 1 al Paso 2. No se pierde información al cambiar de pestaña.</p>
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

      <div className="space-y-3">
        {cargos.map((cargo, idx) => {
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
