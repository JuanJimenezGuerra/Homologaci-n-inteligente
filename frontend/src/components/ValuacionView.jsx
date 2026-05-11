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

const CRITERIA_DEFS = {
  conocimientos: {
    options: ['A','B','C','D','E','F','G','H'],
    descriptions: {
      A: 'Conocimiento de rutinas de trabajo simples necesarias para la realización de un trabajo manual.',
      B: 'Conocimiento de procesos y procedimientos (integración de varias rutinas) necesarias para operar equipos o máquinas simples.',
      C: 'Conocimiento de una técnica o métodos de trabajo complejos que pueden requerir la operación de equipos especializados.',
      D: 'Conocimiento de una teoría, principios o leyes generales de una ciencia, arte o disciplina profesional.',
      E: 'Conocimiento de una ciencia, arte o disciplina profesional. / Conocimiento avanzado de una técnica o práctica.',
      F: 'Conocimiento profundo de una ciencia, arte o disciplina profesional específica. / Amplio conocimiento en todas o la mayoría de áreas específicas dentro de un área funcional.',
      G: 'Maestría en una ciencia, arte o disciplina profesional. / Conocimiento y experiencia amplio y profundo en varias áreas funcionales.',
      H: 'Maestría excepcional en una ciencia, arte o disciplina profesional. / Conocimiento y experiencia amplio y profundo en TODAS las áreas funcionales.',
    }
  },
  experiencia: {
    label: 'Experiencia Previa en Roles Similares',
    options: ['-','o','+'],
    descriptions: {
      '-': 'Si Conocimiento A-C: de 0 a 6 meses (incluyendo el 6). Si Conocimiento D-H: de 0 a 2 años (incluyendo el 2).',
      'o': 'Si Conocimiento A-C: de 6 meses hasta 1 año (incluyendo el 1). Si Conocimiento D-H: de 2 hasta 5 años (incluyendo el 5).',
      '+': 'Si Conocimiento A-C: más de 1 año. Si Conocimiento D-H: más de 5 años.',
    }
  },
  habilidadGerencial: {
    label: 'Habilidad Gerencial',
    options: ['I','II','III','IV','V','VI','VII'],
    descriptions: {
      I: 'INEXISTENTE – Ejecuta actividades prettamente semelhantes. No planifica ni supervisa el trabajo de otros.',
      II: 'MÍNIMA – Supervisa tareas propias y de otros homogeneous. Dirige el trabajo sin participar directamente.',
      III: 'MODERADA – Coordina actividades y procesos. Aclara tareas ambiguas y resuelve conflictos operativos.',
      IV: 'MEDIA – Planea y dirige el trabajo de un área funcional. Asigna trabajos y evalúa desempeño.',
      V: 'ALTA – Define metas y políticas para varias áreas funcionales. Integración y administración de recursos.',
      VI: 'MUY ALTA – Dirige e integra toda la empresa. Establece visión estratégica y administra el cambio.',
      VII: 'MÁXIMA – Dirige un grupo empresarial o corporativo. Define estrategia de largo plazo en entornos complejos.',
    }
  },
  rolCargo: {
    label: 'Rol del Cargo',
    options: ['1','2','3','4'],
    descriptions: {
      '1': 'MIEMBRO DE EQUIPO – Trabaja como parte de un equipo en actividades definidas y especializadas.',
      '2': 'MIEMBRO DE VARIOS EQUIPOS – Participa en múltiples equipos con diferentes enfoques y responsabilidades.',
      '3': 'LÍDER DE EQUIPO – Coordina y dirige un equipo hacia objetivos comunes.',
      '4': 'LÍDER DE VARIOS EQUIPOS – Coordina múltiples equipos con diferentes líderes y hacia múltiples objetivos.',
    }
  },
  contacto: {
    label: 'Contacto',
    options: ['A','B','C'],
    descriptions: {
      A: 'INTERNO – Relacionamiento con representantes de cargos que pertenecen a la misma área funcional.',
      B: 'EXTERNO – Relacionamiento con representantes de cargos de otras áreas funcionales y/o de entidades externas a la organización, tales como: clientes, proveedores, autoridades, etc.',
      C: 'AMBOS (INTERNO Y EXTERNO) – La dedicación de tiempo invertido en el relacionamiento está muy repartido entre interno y externo.',
    }
  },
  frecuenciaContacto: {
    label: 'Frecuencia del Contacto',
    options: ['1','2','3','4'],
    descriptions: {
      '1': 'OCASIONAL – Contactos poco frecuentes o irregulares.',
      '2': 'MENSUAL – Contactos regulares pero no frecuentes. Interacciones mensuales.',
      '3': 'SEMANAL – Contactos frecuentes, varias veces por semana.',
      '4': 'DIARIO – Contactos diarios o permanentes. Comunicación continua requerida.',
    }
  },
  contenidoRelaciones: {
    label: 'Contenido de las Relaciones',
    options: ['I','II','III','IV','V'],
    descriptions: {
      I: 'BÁSICO – Solicitar o transmitir información, prestar servicios y obtener cooperación en asuntos rutinarios.',
      II: 'MODERADO – Indagar o aclarar asuntos relacionados con las funciones y/o responsabilidades del cargo.',
      III: 'IMPORTANTE – Negociar, persuadir o influenciar a otros. Capacidad para escuchar y desarrollar un mutuo entendimiento. Capacidad para representar al área y/o empresa.',
      IV: 'SUPERIOR – Lograr acuerdos satisfactorios generando un alto impacto en los resultados. Capacidad para diseñar, preparar y proponer estrategias de negociación. Capacidad de representar a la empresa.',
      V: 'MUY SUPERIOR – Negociar ante cualquier situación, generando posiciones estratégicas que permitan determinar aspectos vitales para la empresa con otras organizaciones y autoridades.',
    }
  },
  complejidadConceptual: {
    label: 'Complejidad Conceptual',
    options: ['1','2','3','4','5'],
    descriptions: {
      '1': 'IDÉNTICOS – Situaciones idénticas, simples y repetitivas, se resuelven aplicando soluciones sencillas aprendidas previamente.',
      '2': 'SEMEJANTES – Situaciones típicas relacionadas con el conocimiento específico requerido para el cargo, cada vez que se presentan tienen elementos nuevos.',
      '3': 'DIVERSOS – Las situaciones corresponden a diferentes frentes de acción derivados de la responsabilidad sobre varias áreas funcionales (financiera, operaciones, gestión humana, etc).',
      '4': 'NUEVOS – Situaciones poco comunes en donde la solución no se conoce previamente en la compañía.',
      '5': 'INCERTIDUMBRE – Situaciones de alta complejidad en dónde no existen soluciones conocidas previamente a nivel mundial.',
    }
  },
  tendenciaCC: {
    label: 'Tendencia Complejidad',
    options: ['-','o','+'],
    descriptions: {
      '-': 'Tendencia BAJA dentro del nivel – Situaciones más simples que el promedio del nivel.',
      'o': 'Tendencia MEDIA – Nivel estándar, situaciones representativas del promedio.',
      '+': 'Tendencia ALTA dentro del nivel – Situaciones más complejas que el promedio del nivel.',
    }
  },
  guiasApoyo: {
    label: 'Guías de Apoyo',
    options: ['A','B','C','D','E','F','G','H'],
    descriptions: {
      A: 'INSTRUCCIONES ESPECÍFICAS – Reglas e instrucciones simples, sencillas, detalladas y específicas.',
      B: 'INSTRUCCIONES GENERALES – Rutinas e Instrucciones de trabajo definidas.',
      C: 'NORMAS ESTRUCTURADAS – Normas estructuradas y claras, métodos, procedimientos y ejemplos bien definidos o situaciones presentadas anteriormente.',
      D: 'PROCEDIMIENTOS DEFINIDOS – Políticas funcionales definidas claramente. El ocupante del cargo tiene definido el "qué" pero de acuerdo a su juicio debe decidir el "cómo" hacerlo.',
      E: 'POLÍTICAS DEFINIDAS – Políticas amplias de organización.',
      F: 'POLÍTICAS GENERALES – Objetivos definidos en el plan estratégico de la organización.',
      G: 'GLOBAL – Análisis de asuntos complejos, resultados de investigaciones, concepto de expertos.',
      H: 'ABSTRACTO – Múltiples conceptos.',
    }
  },
  tendenciaGA: {
    label: 'Tendencia Guías',
    options: ['-','o','+'],
    descriptions: {
      '-': 'Tendencia BAJA dentro del nivel – Guías más específicas que el promedio.',
      'o': 'Tendencia MEDIA – Nivel estándar de generalidad en las guías.',
      '+': 'Tendencia ALTA dentro del nivel – Guías más abstractas que el promedio.',
    }
  },
  impacto: {
    label: 'Impacto del Cargo',
    options: ['I','II','III','IV'],
    descriptions: {
      I: 'INFORMATIVO – El cargo existe para dar servicios o información para ser utilizados por otros con relación a algún resultado.',
      II: 'APOYO INDIRECTO – El cargo es responsable de proporcionar servicios de análisis, apoyo, asesoría, consejo o consulta que influencian las decisiones de otros cargos.',
      III: 'APOYO DIRECTO – El cargo es responsable por la consecución de resultados de su área y en conjunto con otros cargos de similar responsabilidad apoyan al logro de los resultados finales para la empresa.',
      IV: 'ÚNICOS – El cargo es enteramente responsable por los resultados finales de la empresa o unidad de negocio.',
    }
  },
  autonomia: {
    label: 'Autonomía',
    options: ['A','B','C','D','E','F','G'],
    descriptions: {
      A: 'INEXISTENTE – El titular del cargo está sujeto a las órdenes y aprobación del jefe. Actúa bajo instrucciones exactas, precisas y supervisión continua.',
      B: 'RESTRINGIDA – El titular del cargo puede tomar decisiones menores en las actividades que realiza, ajustándose a instrucciones y procedimientos muy específicos. Recibe alta supervisión.',
      C: 'NORMALIZADA – El titular del cargo toma decisiones de acuerdo a instrucciones generales y guías de acción. Se controla periódicamente el desarrollo del trabajo.',
      D: 'ESTANDARIZADA – El titular del cargo toma decisiones complejas respaldadas en políticas muy específicas. Se controla periódicamente el resultado después de los hechos.',
      E: 'DIRIGIDA – El titular del cargo posee el grado de independencia necesario para lograr los objetivos de su área acorde con los planes y objetivos de ésta.',
      F: 'ORIENTADA – El titular del cargo toma decisiones de envergadura que afectan el logro de los objetivos empresariales.',
      G: 'ESTRATÉGICA – El titular del cargo es el principal responsable en la fijación de las metas globales del negocio y más alto nivel de autonomía para proponer redireccionamientos ante la Junta Directiva.',
    }
  },
  magnitud: {
    label: 'Magnitud de Cifras',
    options: ['1','2','3','4','5','6','7','8','9','10','11','12','13','14'],
    descriptions: {
      '1': 'Desde $0 hasta $0 millones USD anuales.',
      '2': 'Desde $0 hasta $1 millones USD anuales.',
      '3': 'Desde $1 hasta $2 millones USD anuales.',
      '4': 'Desde $2 hasta $6 millones USD anuales.',
      '5': 'Desde $6 hasta $12 millones USD anuales.',
      '6': 'Desde $12 hasta $24 millones USD anuales.',
      '7': 'Desde $24 hasta $48 millones USD anuales.',
      '8': 'Desde $48 hasta $96 millones USD anuales.',
      '9': 'Desde $96 hasta $192 millones USD anuales.',
      '10': 'Desde $192 hasta $384 millones USD anuales.',
      '11': 'Desde $384 hasta $768 millones USD anuales.',
      '12': 'Desde $768 hasta $1,509 millones USD anuales.',
      '13': 'Desde $1,509 hasta $3,072 millones USD anuales.',
      '14': 'Desde $3,072 millones USD en adelante.',
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

// ─── Point calculation placeholders (TODO: Update from Excel) ──────────────────
//
// Para actualizar, extraer datos de la pestaña "Plantilla de Valoración" del Excel
//
// FORMATO ESPERADO:
// POINTS_CONOCIMIENTOS = { A: ?, B: ?, C: ?, D: ?, E: ?, F: ?, G: ?, H: ? }
// POINTS_EXPERIENCIA = { '-': ?, 'o': ?, '+': ? }
// POINTS_HABILIDAD = { I: ?, II: ?, III: ?, IV: ?, V: ?, VI: ?, VII: ? }
// ... (todos los factores)
//
// CATEGORY_RANGES: extraer de pestaña "Categorías" del Excel
// [TODO] Verificar rangos correctos del archivo Excel
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

// ─── Point calculation tables (SHR/HAY methodology) - PLACEHOLDER VALUES ──────
// [TODO] Reemplazar con valores exactos del Excel

// Factor 1: Conocimientos (A-H)
// [TODO] Extraer de columna "Conocimiento" de Plantilla de Valoración
const POINTS_CONOCIMIENTOS = { A: 112, B: 129, C: 147, D: 165, E: 184, F: 208, G: 240, H: 275 };

// Factor 1: Experiencia Específica
// [TODO] Extraer de columna "Experiencia" de Plantilla de Valoración
const POINTS_EXPERIENCIA = { '-': 0.87, 'o': 1.0, '+': 1.15 };

// Factor 1: Habilidad Gerencial (I-VII)
// [TODO] Extraer de columna "Habilidad Gerencial" de Plantilla de Valoración
const POINTS_HABILIDAD = { I: 19, II: 38, III: 57, IV: 76, V: 95, VI: 114, VII: 133 };

// Factor 1: Rol del Cargo (1-4)
// [TODO] Extraer de columna "Rol del Cargo" de Plantilla de Valoración
const POINTS_ROL = { '1': 14, '2': 29, '3': 43, '4': 57 };

// Factor 2: Contacto (A-C)
// [TODO] Extraer de columna "Contacto" de Plantilla de Valoración
const POINTS_CONTACTO = { A: 14, B: 29, C: 43 };

// Factor 2: Frecuencia de Contacto (1-4)
// [TODO] Extraer de columna "Frecuencia" de Plantilla de Valoración
const POINTS_FRECUENCIA = { '1': 5, '2': 19, '3': 33, '4': 47 };

// Factor 2: Contenido de las Relaciones (I-V)
// [TODO] Extraer de columna "Contenido" de Plantilla de Valoración
const POINTS_CONTENIDO = { I: 9, II: 22, III: 38, IV: 57, V: 76 };

// Factor 3: Complejidad Conceptual (1-5)
// [TODO] Extraer de columna "Complejidad" de Plantilla de Valoración
const POINTS_COMPLEJIDAD = { '1': 22, '2': 43, '3': 67, '4': 95, '5': 122 };

// Factor 3: Tendencia (multiplicador)
// [TODO] Extraer de columna "Tendencia" de Plantilla de Valoración
const POINTS_TENDENCIA = { '-': 0.87, 'o': 1.0, '+': 1.15 };

// Factor 3: Guías de Apoyo (A-H)
// [TODO] Extraer de columna "Guías" de Plantilla de Valoración
const POINTS_GUIAS = { A: 10, B: 19, C: 29, D: 43, E: 57, F: 71, G: 90, H: 108 };

// Factor 4: Impacto (I-IV)
// [TODO] Extraer de columna "Impacto" de Plantilla de Valoración
const POINTS_IMPACTO = { I: 14, II: 29, III: 43, IV: 57 };

// Factor 4: Autonomía (A-G)
// [TODO] Extraer de columna "Autonomía" de Plantilla de Valoración
const POINTS_AUTONOMIA = { A: 5, B: 19, C: 33, D: 47, E: 62, F: 76, G: 95 };

// Factor 4: Magnitud (1-14)
// [TODO] Extraer de columna "Magnitud" de Plantilla de Valoración
const POINTS_MAGNITUD = { '1': 0, '2': 19, '3': 38, '4': 57, '5': 76, '6': 95, '7': 114, '8': 133, '9': 152, '10': 171, '11': 190, '12': 209, '13': 228, '14': 247 };

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
- Gerente General / CEO: Conocimientos G-H, Habilidad VI-VII, Autonomía F-G, Impacto IV, Magnitud 13-14
- Directores / Gerentes de área: Conocimientos F-G, Habilidad IV-V, Autonomía E-F, Impacto III-IV, Magnitud 10-12
- Coordinadores / Jefes: Conocimientos E-F, Habilidad III-IV, Autonomía D-E, Impacto III, Magnitud 7-9
- Analistas / Especialistas: Conocimientos D-E, Habilidad I-II, Autonomía C-D, Impacto II, Magnitud 4-6
- Auxiliares / Técnicos: Conocimientos B-C, Habilidad I, Autonomía A-B, Impacto I-II, Magnitud 1-3
- La magnitud refleja el presupuesto/volumen de negocio que maneja el cargo directamente
- Los criterios de criticidad (1, 2, 3) se activan con 1 si aplica al cargo
- Experiencia: -=0 a 6 meses (A-C) o 0 a 2 años (D-H), o=6 meses a 1 año (A-C) o 2 a 5 años (D-H), +=más de 1 año (A-C) o más de 5 años (D-H)
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

  const tooltipText = value && def.descriptions[value] 
    ? `Valor actual: ${value}\n\n${def.descriptions[value]}`
    : def.options.map(opt => `${opt}: ${def.descriptions[opt]?.substring(0, 80)}...`).join('\n');

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
        <div className="absolute top-full left-0 z-50 mt-1 bg-white border border-emerald-200 rounded-xl shadow-xl min-w-[280px] py-1 max-h-64 overflow-y-auto">
          {def.options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(name, opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-start gap-2 ${value === opt ? 'bg-emerald-100 text-primary font-bold' : 'text-slate-700'}`}
            >
              <span className="font-bold shrink-0 text-forest w-6 text-center">{opt}</span>
              <span className="text-slate-600 text-[10px] leading-tight">{def.descriptions[opt]}</span>
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
      if (!uploadIdNum || isNaN(uploadIdNum)) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      // Clear old localStorage data
      try { localStorage.removeItem('shr_valoracion_cargos'); } catch {}
      
      try {
        // Load extra descriptions (cargos with descriptions) from backend
        const extraCargos = await fetchExtraDescriptions(uploadIdNum);
        
        if (extraCargos && extraCargos.length > 0) {
          // Use the cargos from extra descriptions directly
          setCargos(extraCargos);
          setHasExtraFiles(true);
          try { localStorage.setItem('shr_valoracion_cargos', JSON.stringify(extraCargos)); } catch {}
        } else {
          setCargos([]);
          setHasExtraFiles(false);
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
        console.warn('Error loading data:', e.message);
        setError('Error cargando datos. Sube archivos de descripción anexos primero.');
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
          <strong>Sube archivos de descripción anexos</strong> para iniciar la valoración.
          Estos archivos (PDF, DOCX, XLSX) contienen las descripciones de los cargos.
        </p>
        <p className="text-sm text-slate-400">
          El nombre del archivo debe coincidir con el nombre del cargo (ej: "Auxiliar Contable.pdf").
        </p>
        <div className="glass-card p-6 rounded-2xl border border-emerald-100 text-sm text-emerald-700 bg-emerald-50/50 flex items-start gap-3">
          <Info size={18} className="shrink-0 mt-0.5"/>
          <p>Ve a la pestaña de Formulario para subir los archivos de descripción anexos junto con el archivo de requerimientos.</p>
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
