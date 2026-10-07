// ═══════════════════════════════════════════════════════════════════════
// mirenta-demo-data · ÚNICA fuente de cifras del prototipo (DATOS DEMO).
//
// Simula lo que el backend versionado entregará: todas las cifras vienen YA calculadas
// (base, tasa, impuesto, cobertura, diferencias…). El frontend solo las presenta:
// no contiene tasas, fórmulas, topes, códigos F22 ni reglas de régimen.
// Un valor `null` significa NO DISPONIBLE (nunca se muestra como $0).
// ═══════════════════════════════════════════════════════════════════════

const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

// ── Caso base: proyección preliminar a septiembre ──────────────────────
const base = {
  caso: {
    empresa: 'Asesorías Contadoor', empresas: ['Asesorías Contadoor', 'Empresa Demo Dos SpA'],
    anioComercial: 2026, aniosComerciales: [2024, 2025, 2026], anioTributario: 2027,
    regimen: { nombre: 'Pro Pyme General', articulo: 'Art. 14 D N°3', codigo: '14D3' },
    estadoAnalisis: 'PRELIMINAR', ultimaActualizacion: '07-10-2026 15:27', corte: 'Contabilidad al 30-09-2026',
    mesesReales: 9,
  },

  resumen: {
    baseTributaria: { valor: 67600000, nota: 'Estimación al cierre del año según información disponible.' },
    impuesto: { valor: 8450000, tasaAplicable: 12.5, nota: 'Impuesto de primera categoría estimado.' },
    ppmDisponible: { valor: 5100000, nota: 'Pagos provisionales efectivamente reconocidos como disponibles.' },
    saldo: { tipo: 'POR_PAGAR', valor: 3350000 },             // POR_PAGAR | EXCEDENTE
    cobertura: { porcentaje: 60, faltante: 3350000 },
  },

  // Proyección al cierre (resultado contable) · real vs. proyectado
  proyeccion: {
    actualAcumulado: 50700000, mesesRestantes: 16900000, anualProyectado: 67600000,
    meses: MESES.map((m, i) => ({ mes: m, tipo: i < 9 ? 'REAL' : 'PROYECTADO',
      resultado: [4.9, 5.3, 6.1, 5.4, 6.0, 5.2, 5.8, 5.9, 6.1, 5.6, 5.6, 5.7][i] * 1e6 })),
    // cómo fue cambiando la renta (impuesto) proyectada mes a mes
    evolucion: [2.1, 2.7, 3.4, 4.6, 5.3, 5.9, 6.4, 6.6, 6.8].map((v, i) => ({ mes: MESES[i], impuestoProyectado: v * 1e6 })),
    impuestoCierre: 8450000,
    motores: [
      { nombre: 'Ventas por servicios', efecto: '+', detalle: 'Ritmo estable de facturación (promedio últimos 3 meses).' },
      { nombre: 'Remuneraciones', efecto: '−', detalle: 'Centralización registrada solo en abril: revisar meses faltantes.' },
      { nombre: 'Gastos generales', efecto: '·', detalle: 'Sin variaciones relevantes.' },
    ],
  },

  ppm: {
    determinado: 5300000, declarado: 5300000, pagado: 5100000, disponible: 5100000,
    proyectadoDiciembre: 7300000, impuestoProyectado: 8450000, deficitEstimado: 1150000,
    coberturaCierre: 86,
    curva: MESES.map((m, i) => ({ mes: m, tipo: i < 9 ? 'REAL' : 'PROYECTADO',
      ppmAcumulado: [0.55, 1.1, 1.7, 2.3, 2.8, 3.4, 3.9, 4.5, 5.1, 5.85, 6.55, 7.3][i] * 1e6,
      impuestoProyectado: [2.1, 2.7, 3.4, 4.6, 5.3, 5.9, 6.4, 6.6, 6.8, 7.4, 7.9, 8.45][i] * 1e6 })),
  },

  reserva: { saldoEsperado: 3350000, reservaAcumulada: 1500000, reservaAdicional: 1850000, formulaDisponible: false },

  // Puente de la renta (vista cliente: 5 pasos; vista asesor: detalle expandible)
  puente: [
    { id: 'resultado', etiqueta: 'Resultado contable', valor: 67150000, tipo: 'inicio',
      detalle: [{ t: 'Resultado acumulado ene–sep', v: 50700000 }, { t: 'Proyección oct–dic', v: 16900000 }, { t: 'Ajuste de cierre estimado', v: -450000 }],
      fuente: { nombre: 'Libro Diario + Balance 8 columnas', fecha: '07-10-2026', periodo: 'ENE–SEP 2026', estado: 'PROCESADO' } },
    { id: 'agregados', etiqueta: 'Agregados', valor: 650000, tipo: 'suma',
      detalle: [{ t: 'Gastos que requieren ajuste (ej. representación)', v: 450000 }, { t: 'Otros agregados', v: 200000 }],
      fuente: { nombre: 'Regla de ajuste versionada (backend)', fecha: '—', periodo: 'AC 2026', estado: 'PRELIMINAR' } },
    { id: 'deducciones', etiqueta: 'Deducciones', valor: -200000, tipo: 'resta',
      detalle: [{ t: 'Beneficios / deducciones identificadas', v: -200000 }],
      fuente: { nombre: 'Regla de ajuste versionada (backend)', fecha: '—', periodo: 'AC 2026', estado: 'PRELIMINAR' } },
    { id: 'base', etiqueta: 'Base tributaria', valor: 67600000, tipo: 'subtotal' },
    { id: 'impuesto', etiqueta: 'Impuesto (IDPC)', valor: 8450000, tipo: 'subtotal', nota: 'Tasa aplicable estimada informada por el motor: 12,5 %' },
    { id: 'ppm', etiqueta: 'PPM disponibles', valor: -5100000, tipo: 'resta',
      fuente: { nombre: 'F29 (pendiente de integrar) · dato demo', fecha: '—', periodo: 'ENE–SEP 2026', estado: 'SIN FUENTE' } },
    { id: 'creditos', etiqueta: 'Créditos', valor: null, tipo: 'resta', nota: 'No disponibles todavía' },
    { id: 'saldo', etiqueta: 'Saldo proyectado', valor: 3350000, tipo: 'total' },
  ],

  radar: [
    { id: 'r1', categoria: 'RIESGO', nivel: 'URGENTE', titulo: 'PPM bajo respecto de la renta proyectada', impacto: 'Saldo relevante en abril', monto: 3350000,
      evidencia: 'Cobertura actual 60 % · PPM pagados ene–sep', porque: 'Si la tendencia se mantiene, podría existir un saldo relevante al presentar la renta.',
      accion: 'Revisar nivel de PPM con el cliente', estado: 'ABIERTO' },
    { id: 'r2', categoria: 'INCONSISTENCIA', nivel: 'REVISAR', titulo: 'Remuneraciones registradas solo en abril', impacto: 'Resultado posiblemente sobrestimado', monto: null,
      evidencia: '1 asiento de centralización en el año', porque: 'Si hubo sueldos en otros meses, la base tributaria proyectada sería menor.',
      accion: 'Confirmar centralizaciones mensuales', estado: 'ABIERTO' },
    { id: 'r3', categoria: 'OPORTUNIDAD', nivel: 'INFORMATIVO', titulo: 'Inversión planificada antes del cierre', impacto: 'Posible efecto tributario y de caja', monto: null,
      evidencia: 'Mencionada por el cliente en reunión anterior', porque: 'Conviene evaluarla con su costo económico neto, no solo por su efecto tributario.',
      accion: 'Simular en Escenarios', estado: 'ABIERTO' },
    { id: 'r4', categoria: 'DESVIACIÓN', nivel: 'INFORMATIVO', titulo: 'Proyección subió 0,2 MM vs. el mes anterior', impacto: 'Mayor impuesto proyectado', monto: 200000,
      evidencia: 'Proyección agosto 6,6 MM → septiembre 6,8 MM', porque: 'Las ventas de septiembre superaron el promedio.', accion: 'Sin acción', estado: 'INFORMATIVO' },
  ],

  pendientes: [
    { titulo: 'Conciliar apertura del año', nivel: 'URGENTE', explicacion: 'El Diario 2026 no trae saldos iniciales; afecta balance y registros.' },
    { titulo: 'Revisar saldo previsional', nivel: 'REVISAR', explicacion: 'Leyes sociales por pagar con saldo al revés (pagos de 2025 sin provisión).' },
    { titulo: 'Confirmar tratamiento de gasto de representación', nivel: 'REVISAR', explicacion: 'Puede requerir ajuste en la base tributaria.' },
    { titulo: 'Completar RCV faltante', nivel: 'REVISAR', explicacion: 'Solo hay RCV de julio 2026.' },
  ],

  decisiones: [
    { titulo: 'Revisar nivel de PPM', impacto: 'Alto', urgencia: 'Antes de nov.', evidencia: 'Cobertura 60 %', accion: 'Evaluar aumento de tasa PPM' },
    { titulo: 'Revisar provisión de impuesto', impacto: 'Medio', urgencia: 'Cierre', evidencia: 'Saldo estimado 3,35 MM', accion: 'Separar reserva' },
    { titulo: 'Evaluar inversión planificada', impacto: 'Medio', urgencia: 'Antes del 31-12', evidencia: 'Radar · oportunidad', accion: 'Simular escenario' },
    { titulo: 'Revisar retiros de socios', impacto: 'Por definir', urgencia: '—', evidencia: 'Sin datos de propietarios', accion: 'Cargar antecedentes' },
  ],

  calidad: [
    { fuente: 'Contabilidad', estado: 'OK', detalle: 'Diario y Balance 2026 procesados' },
    { fuente: 'Diario ↔ Balance', estado: 'OK', detalle: 'Cuadra · 0 diferencias' },
    { fuente: 'Apertura', estado: 'REVISAR', detalle: 'Sin asiento de apertura' },
    { fuente: 'Plan de cuentas', estado: 'OK', detalle: 'Cuentas clasificadas' },
    { fuente: 'RCV', estado: 'REVISAR', detalle: 'Cobertura parcial (1 de 9 meses)' },
    { fuente: 'F29', estado: 'SIN_DATOS', detalle: 'No integrado' },
    { fuente: 'Propietarios', estado: 'SIN_DATOS', detalle: 'No cargados' },
    { fuente: 'Registros tributarios', estado: 'SIN_DATOS', detalle: 'Faltan saldos iniciales AT 2026' },
  ],

  timeline: [
    { etapa: 'ENE–SEP', tipo: 'REAL', texto: 'Contabilidad real' }, { etapa: 'OCT–DIC', tipo: 'PROYECTADO', texto: 'Proyección' },
    { etapa: 'MAR', tipo: 'HITO', texto: 'Declaraciones juradas' }, { etapa: 'ABR', tipo: 'HITO', texto: 'Operación renta' },
  ],

  // Escenarios: cifras YA calculadas por el backend (demo). Ahorro permanente ≠ diferimiento ≠ caja.
  escenarios: [
    { id: 'base', nombre: 'Base', descripcion: 'Situación actual, sin decisiones nuevas', ventas: 210000000, gastos: 142400000, resultado: 67600000,
      impuesto: 8450000, ppm: 7300000, saldoAbril: 1150000, cajaDespuesImpuesto: 59150000, ahorroPermanente: 0, diferimiento: 0 },
    { id: 'a', nombre: 'A · Comprar activo', descripcion: 'Activo de $10 MM antes del 31-12 (tratamiento a definir por el motor)', ventas: 210000000, gastos: 142400000,
      resultado: 57600000, impuesto: 7200000, ppm: 7300000, saldoAbril: -100000, cajaDespuesImpuesto: 50400000, ahorroPermanente: 0, diferimiento: 1250000,
      activo: { costo: 10000000, desembolso: 10000000, efectoTributario: -1250000, credito33bis: null, costoNeto: 8750000 } },
    { id: 'b', nombre: 'B · Contratar trabajador', descripcion: 'Contratación desde noviembre ($1,2 MM/mes)', ventas: 210000000, gastos: 144800000,
      resultado: 65200000, impuesto: 8150000, ppm: 7300000, saldoAbril: 850000, cajaDespuesImpuesto: 57050000, ahorroPermanente: 300000, diferimiento: 0 },
  ],
  ideasEscenario: ['Contratar trabajador', 'Comprar activo', 'Aumentar remuneración', 'Realizar inversión', 'Postergar inversión', 'Distribuir utilidades', 'No distribuir', 'Cambiar supuesto de ventas', 'Cambiar gastos proyectados'],

  // Registros tributarios 14 D N°3 (estructura demo; montos ilustrativos)
  registros: [
    { id: 'CPTS', nombre: 'Capital propio tributario simplificado', explicacion: 'Muestra el patrimonio de la empresa medido con criterios tributarios.',
      saldoInicial: 120000000, movimientos: 59150000, saldoProyectado: 179150000, estado: 'PRELIMINAR', ultimaValidacion: '—',
      historia: [{ anio: 2024, saldo: 78000000 }, { anio: 2025, saldo: 120000000 }, { anio: 2026, saldo: 179150000 }] },
    { id: 'RAI', nombre: 'Rentas afectas a impuestos', explicacion: 'Ayuda a determinar cómo se imputan futuras distribuciones a los propietarios.',
      saldoInicial: 41000000, incorporaciones: 59150000, imputaciones: 0, saldoProyectado: 100150000, estado: 'PRELIMINAR', ultimaValidacion: '—',
      historia: [{ anio: 2024, saldo: 22000000 }, { anio: 2025, saldo: 41000000 }, { anio: 2026, saldo: 100150000 }] },
    { id: 'REX', nombre: 'Rentas exentas e ingresos no renta', explicacion: 'Rentas que, al distribuirse, no pagan impuestos finales o tienen un tratamiento especial.',
      saldoInicial: null, incorporaciones: null, imputaciones: null, saldoProyectado: null, estado: 'SIN_DATOS', ultimaValidacion: '—', historia: [] },
    { id: 'SAC', nombre: 'Saldo acumulado de créditos', explicacion: 'Créditos por impuesto pagado por la empresa que podrán usar los propietarios.',
      saldoInicial: 6200000, movimientos: 8450000, saldoProyectado: 14650000, estado: 'PRELIMINAR', ultimaValidacion: '—',
      lotes: [
        { origen: 'IDPC AT 2024', anio: 2024, tipo: 'Crédito IDPC', original: 3100000, utilizado: 3100000, disponible: 0, estado: 'FULLY_USED' },
        { origen: 'IDPC AT 2025', anio: 2025, tipo: 'Crédito IDPC', original: 4800000, utilizado: 1700000, disponible: 3100000, estado: 'PARCIAL' },
        { origen: 'IDPC AT 2026', anio: 2026, tipo: 'Crédito IDPC', original: 3100000, utilizado: 0, disponible: 3100000, estado: 'DISPONIBLE' },
        { origen: 'IDPC AT 2027 (proyectado)', anio: 2027, tipo: 'Crédito IDPC', original: 8450000, utilizado: 0, disponible: 8450000, estado: 'DISPONIBLE' },
      ],
      historia: [{ anio: 2024, saldo: 3100000 }, { anio: 2025, saldo: 6200000 }, { anio: 2026, saldo: 14650000 }] },
  ],

  historico: [
    { anio: 2024, resultado: 41000000, impuesto: 5100000, ppm: 4600000, saldo: 500000, tasaEfectiva: 12.4 },
    { anio: 2025, resultado: 55000000, impuesto: 6900000, ppm: 7400000, saldo: -500000, tasaEfectiva: 12.5 },
    { anio: 2026, resultado: 67600000, impuesto: 8450000, ppm: 7300000, saldo: 1150000, tasaEfectiva: 12.5, proyectado: true },
  ],

  // Detalle técnico (solo modo Asesor)
  tecnico: {
    snapshot: 'Foto de clasificación #1 · huella c1213b7d…', reglas: 'Parámetros AT 2027 · versión demo (sin regla certificada)',
    conciliaciones: 'Diario ↔ Balance: CUADRA (199 cuentas)', completitud: '22/22 cuentas clasificadas · 0 confirmadas',
    incidencias: ['APERTURA_NO_DETECTADA', 'SALDO_CONTRARIO_A_NATURALEZA × 2'],
  },
};

// ── Variantes de estado (para revisar cómo se ve cada situación) ───────
const clonar = (o) => JSON.parse(JSON.stringify(o));
function variante(cambios) { const v = clonar(base); cambios(v); return v; }

export const ESTADOS = {
  completo: variante((v) => {
    v.caso.estadoAnalisis = 'COMPLETO'; v.caso.corte = 'Contabilidad al 31-12-2026';
    v.calidad = v.calidad.map((c) => ({ ...c, estado: 'OK', detalle: 'Validado' }));
    v.pendientes = []; v.resumen.cobertura = { porcentaje: 100, faltante: 0 };
    v.resumen.ppmDisponible.valor = 8450000; v.resumen.saldo = { tipo: 'POR_PAGAR', valor: 0 };
  }),
  preliminar: base,
  faltan_datos: variante((v) => {
    v.caso.estadoAnalisis = 'FALTAN_DATOS';
    v.resumen.ppmDisponible.valor = null; v.resumen.cobertura = { porcentaje: null, faltante: null }; v.resumen.saldo = { tipo: 'POR_PAGAR', valor: null };
    v.ppm.pagado = null; v.ppm.disponible = null; v.ppm.deficitEstimado = null; v.ppm.coberturaCierre = null;
    v.puente.find((p) => p.id === 'ppm').valor = null; v.puente.find((p) => p.id === 'saldo').valor = null;
  }),
  riesgo: variante((v) => {
    v.caso.estadoAnalisis = 'RIESGO';
    v.resumen.ppmDisponible.valor = 2950000; v.resumen.cobertura = { porcentaje: 35, faltante: 5500000 }; v.resumen.saldo = { tipo: 'POR_PAGAR', valor: 5500000 };
    v.ppm.pagado = 2950000; v.ppm.disponible = 2950000; v.ppm.proyectadoDiciembre = 4200000; v.ppm.deficitEstimado = 4250000; v.ppm.coberturaCierre = 50;
  }),
  sin_info: variante((v) => {
    v.caso.estadoAnalisis = 'SIN_INFORMACION'; v.caso.corte = 'Sin contabilidad cargada'; v.caso.mesesReales = 0;
    v.resumen = { baseTributaria: { valor: null }, impuesto: { valor: null, tasaAplicable: null }, ppmDisponible: { valor: null }, saldo: { tipo: 'POR_PAGAR', valor: null }, cobertura: { porcentaje: null, faltante: null } };
    v.proyeccion.meses = []; v.proyeccion.evolucion = []; v.ppm.curva = []; v.radar = []; v.decisiones = [];
    v.calidad = v.calidad.map((c) => ({ ...c, estado: 'SIN_DATOS', detalle: 'Sin información' }));
    v.pendientes = [{ titulo: 'Cargar la contabilidad del año', nivel: 'URGENTE', explicacion: 'Sin Libro Diario ni Balance no es posible proyectar.' }];
  }),
};
export const ETIQUETA_ESTADO = { COMPLETO: 'Análisis completo', PRELIMINAR: 'Proyección preliminar', FALTAN_DATOS: 'Faltan datos', RIESGO: 'Riesgo', SIN_INFORMACION: 'Sin información' };
