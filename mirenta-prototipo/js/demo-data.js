// ═══════════════════════════════════════════════════════════════════════
// mirenta-demo-data · ÚNICA fuente de cifras del prototipo (DATOS DEMO).
//
// Simula lo que el backend versionado entregará: todas las cifras vienen YA calculadas
// (base, tasa, impuesto, cobertura, diferencias…). El frontend solo las presenta:
// no contiene tasas, fórmulas, topes ni reglas de régimen. Códigos F22 y layouts: referenciales, viven aquí (simulan el backend versionado por AT).
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

  // Hoy vs diciembre: lo que sabemos hoy y hacia dónde vamos (sin inventar: lo que el motor no entrega va null).
  hoyVsDiciembre: [
    { concepto: 'Resultado', hoy: 50700000, diciembre: 67600000 },
    { concepto: 'Impuesto', hoy: null, diciembre: 8450000 },
    { concepto: 'PPM', hoy: 5100000, diciembre: 7300000 },
    { concepto: 'Saldo', hoy: null, diciembre: 1150000 },
  ],
  caja: { saldoProyectado: 3350000, reservaConsiderada: 1500000, diferencia: 1850000 },

  // Proyección al cierre (resultado contable) · real vs. proyectado
  proyeccion: {
    actualAcumulado: 50700000, mesesRestantes: 16900000, anualProyectado: 67600000,
    meses: MESES.map((m, i) => ({ mes: m, tipo: i < 9 ? 'REAL' : 'PROYECTADO',
      resultado: [4.9, 5.3, 6.1, 5.4, 6.0, 5.2, 5.8, 5.9, 6.1, 5.6, 5.6, 5.7][i] * 1e6 })),
    // cómo fue cambiando la renta (impuesto) proyectada mes a mes
    evolucion: [2.1, 2.7, 3.4, 4.6, 5.3, 5.9, 6.4, 6.6, 6.8].map((v, i) => ({ mes: MESES[i], impuestoProyectado: v * 1e6 })),
    impuestoCierre: 8450000,
    motores: [   // ranking por impacto estimado en el resultado anual (demo)
      { nombre: 'Ventas por servicios', efecto: '↑', impacto: 4200000, detalle: 'Ritmo estable de facturación (promedio últimos 3 meses).' },
      { nombre: 'Remuneraciones', efecto: '↓', impacto: -1100000, detalle: 'Centralización registrada solo en abril: revisar meses faltantes.' },
      { nombre: 'Gastos generales', efecto: '·', impacto: null, detalle: 'Sin cambio relevante.' },
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
    { id: 'r1', categoria: 'RIESGO', nivel: 'URGENTE', titulo: 'PPM bajo respecto de la renta proyectada', decision: 'Evaluar nivel de PPM y planificación de caja', impacto: 'Saldo relevante en abril', monto: 3350000,
      evidencia: 'Cobertura actual 60 % · PPM pagados ene–sep', porque: 'Si la tendencia se mantiene, podría existir un saldo relevante al presentar la renta.',
      accion: 'Revisar nivel de PPM con el cliente', estado: 'ABIERTO' },
    { id: 'r2', categoria: 'INCONSISTENCIA', nivel: 'REVISAR', titulo: 'Remuneraciones registradas solo en abril', decision: 'Confirmar las centralizaciones mensuales con el cliente', impacto: 'Resultado posiblemente sobrestimado', monto: null,
      evidencia: '1 asiento de centralización en el año', porque: 'Si hubo sueldos en otros meses, la base tributaria proyectada sería menor.',
      accion: 'Confirmar centralizaciones mensuales', estado: 'ABIERTO' },
    { id: 'r3', categoria: 'OPORTUNIDAD', nivel: 'INFORMATIVO', titulo: 'Inversión planificada antes del cierre', decision: 'Simular la inversión con su costo neto en Escenarios', impacto: 'Posible efecto tributario y de caja', monto: null,
      evidencia: 'Mencionada por el cliente en reunión anterior', porque: 'Conviene evaluarla con su costo económico neto, no solo por su efecto tributario.',
      accion: 'Simular en Escenarios', estado: 'ABIERTO' },
    { id: 'r4', categoria: 'DESVIACIÓN', nivel: 'INFORMATIVO', titulo: 'Proyección subió 0,2 MM vs. el mes anterior', decision: 'Sin decisión necesaria por ahora', impacto: 'Mayor impuesto proyectado', monto: 200000,
      evidencia: 'Proyección agosto 6,6 MM → septiembre 6,8 MM', porque: 'Las ventas de septiembre superaron el promedio.', accion: 'Sin acción', estado: 'INFORMATIVO' },
  ],

  pendientes: [
    { titulo: 'Conciliar apertura del año', nivel: 'URGENTE', explicacion: 'El Diario 2026 no trae saldos iniciales; afecta balance y registros.' },
    { titulo: 'Revisar saldo previsional', nivel: 'REVISAR', explicacion: 'Leyes sociales por pagar con saldo al revés (pagos de 2025 sin provisión).' },
    { titulo: 'Confirmar tratamiento de gasto de representación', nivel: 'REVISAR', explicacion: 'Puede requerir ajuste en la base tributaria.' },
    { titulo: 'Completar RCV faltante', nivel: 'REVISAR', explicacion: 'Solo hay RCV de julio 2026.' },
  ],

  decisiones: [
    { titulo: 'Revisar nivel de PPM', impacto: 'Alto', urgencia: 'Antes de noviembre', evidencia: 'La cobertura de PPM está en 60 %', accion: 'Conversar ajuste de PPM' },
    { titulo: 'Revisar provisión de impuesto', impacto: 'Medio', urgencia: 'Cierre', evidencia: 'Saldo estimado 3,35 MM', accion: 'Conversar planificación de caja' },
    { titulo: 'Evaluar inversión planificada', impacto: 'Medio', urgencia: 'Antes del 31-12', evidencia: 'Radar · oportunidad', accion: 'Simular escenario' },
    { titulo: 'Revisar retiros de socios', impacto: 'Por definir', urgencia: '—', evidencia: 'Sin datos de propietarios', accion: 'Cargar antecedentes' },
  ],

  calidad: [
    { fuente: 'Contabilidad', estado: 'OK', cliente: 'Completa', detalle: 'Diario y Balance 2026 procesados' },
    { fuente: 'Diario ↔ Balance', estado: 'OK', cliente: 'Conciliados', detalle: 'Cuadra · 0 diferencias' },
    { fuente: 'Apertura', estado: 'REVISAR', cliente: 'Pendiente', detalle: 'Sin asiento de apertura' },
    { fuente: 'Plan de cuentas', estado: 'OK', cliente: 'Completo', detalle: 'Cuentas clasificadas' },
    { fuente: 'RCV', estado: 'REVISAR', cliente: 'Parcial', detalle: 'Cobertura parcial (1 de 9 meses)' },
    { fuente: 'PPM / F29', estado: 'SIN_DATOS', cliente: 'Pendiente', detalle: 'No integrado' },
    { fuente: 'Propietarios', estado: 'SIN_DATOS', cliente: 'No disponible', detalle: 'No cargados' },
    { fuente: 'Registros tributarios', estado: 'SIN_DATOS', cliente: 'Pendiente', detalle: 'Faltan saldos iniciales AT 2026' },
  ],

  timeline: [
    { etapa: 'ENE–SEP', tipo: 'REAL', texto: 'Contabilidad real' }, { etapa: 'OCT–DIC', tipo: 'PROYECTADO', texto: 'Proyección' },
    { etapa: 'MAR', tipo: 'HITO', texto: 'Declaraciones juradas' }, { etapa: 'ABR', tipo: 'HITO', texto: 'Operación renta' },
  ],

  // Escenarios: cifras YA calculadas por el backend (demo). Ahorro permanente ≠ diferimiento ≠ caja.
  escenarios: [
    { id: 'base', nombre: 'Base', descripcion: 'Situación actual, sin decisiones nuevas', ventas: 210000000, gastos: 142400000, resultado: 67600000,
      impuesto: 8450000, ppm: 7300000, saldoAbril: 1150000, cajaDespuesImpuesto: 59150000, ahorroPermanente: 0, diferimiento: 0, costoDecision: 0 },
    { id: 'a', nombre: 'A · Comprar activo', descripcion: 'Activo de $10 MM antes del 31-12 (tratamiento a definir por el motor)', ventas: 210000000, gastos: 142400000,
      resultado: 57600000, impuesto: 7200000, ppm: 7300000, saldoAbril: -100000, cajaDespuesImpuesto: 50400000, ahorroPermanente: 0, diferimiento: 1250000, costoDecision: 10000000,
      activo: { costo: 10000000, desembolso: 10000000, efectoTributario: -1250000, credito33bis: null, costoNeto: 8750000 } },
    { id: 'b', nombre: 'B · Contratar trabajador', descripcion: 'Contratación desde noviembre ($1,2 MM/mes)', ventas: 210000000, gastos: 144800000,
      resultado: 65200000, impuesto: 8150000, ppm: 7300000, saldoAbril: 850000, cajaDespuesImpuesto: 57050000, ahorroPermanente: 300000, diferimiento: 0, costoDecision: 2400000 },
  ],
  decisionesEvaluables: ['Comprar un activo', 'Contratar una persona', 'Aumentar remuneraciones', 'Realizar una inversión', 'Distribuir utilidades', 'Cambiar proyección de ventas', 'Cambiar gastos proyectados', 'Otra decisión'],
  ideasEscenario: ['Contratar trabajador', 'Comprar activo', 'Aumentar remuneración', 'Realizar inversión', 'Postergar inversión', 'Distribuir utilidades', 'No distribuir', 'Cambiar supuesto de ventas', 'Cambiar gastos proyectados'],

  // Registros tributarios 14 D N°3 (estructura demo; montos ilustrativos)
  registros: [
    { id: 'RLI', tipo: 'DETERMINACION', concepto: 'Cómo se determina tu renta', nombre: 'Renta líquida imponible', explicacion: 'Así pasamos del resultado contable a la base sobre la que se calcula el impuesto.',
      saldoInicial: null, movimientos: null, resultadoContable: 67150000, ajustesNetos: 450000, saldoProyectado: 67600000, estado: 'PRELIMINAR', ultimaValidacion: '—',
      partidas: [
        { grupo: 'RESULTADO', concepto: 'Resultado contable del ejercicio (proyectado)', monto: 67150000, fuente: 'Libro Diario + Balance' },
        { grupo: 'AGREGADOS', concepto: 'Gastos rechazados (ej. representación sin respaldo)', monto: 450000, fuente: 'Regla de ajuste (backend)' },
        { grupo: 'AGREGADOS', concepto: 'Impuesto a la renta contabilizado como gasto', monto: 0, fuente: 'Regla de ajuste (backend)' },
        { grupo: 'AGREGADOS', concepto: 'Multas e intereses fiscales', monto: 0, fuente: 'Regla de ajuste (backend)' },
        { grupo: 'AGREGADOS', concepto: 'Otros agregados', monto: 200000, fuente: 'Dato del asesor' },
        { grupo: 'DEDUCCIONES', concepto: 'Ingresos no constitutivos de renta / exentos', monto: 0, fuente: 'Regla de ajuste (backend)' },
        { grupo: 'DEDUCCIONES', concepto: 'Otras deducciones', monto: -200000, fuente: 'Dato del asesor' },
        { grupo: 'DEDUCCIONES', concepto: 'Pérdida tributaria de ejercicios anteriores', monto: null, fuente: 'F22 AT 2026 (pendiente)' },
      ],
      historia: [{ anio: 2024, saldo: 41500000 }, { anio: 2025, saldo: 55400000 }, { anio: 2026, saldo: 67600000 }] },
    { id: 'CPTS', concepto: 'Capital tributario', nombre: 'Capital propio tributario simplificado', explicacion: 'Muestra el patrimonio de la empresa medido con criterios tributarios.',
      saldoInicial: 120000000, movimientos: 59150000, saldoProyectado: 179150000, estado: 'PRELIMINAR', ultimaValidacion: '—',
      historia: [{ anio: 2024, saldo: 78000000 }, { anio: 2025, saldo: 120000000 }, { anio: 2026, saldo: 179150000 }] },
    { id: 'RAI', concepto: 'Utilidades afectas a impuestos', nombre: 'Rentas afectas a impuestos', explicacion: 'Ayuda a determinar cómo se imputan futuras distribuciones a los propietarios.',
      saldoInicial: 41000000, incorporaciones: 59150000, imputaciones: 0, saldoProyectado: 100150000, estado: 'PRELIMINAR', ultimaValidacion: '—',
      historia: [{ anio: 2024, saldo: 22000000 }, { anio: 2025, saldo: 41000000 }, { anio: 2026, saldo: 100150000 }] },
    { id: 'REX', concepto: 'Rentas exentas o con tratamiento especial', nombre: 'Rentas exentas e ingresos no renta', explicacion: 'Rentas que, al distribuirse, no pagan impuestos finales o tienen un tratamiento especial.',
      saldoInicial: null, incorporaciones: null, imputaciones: null, saldoProyectado: null, estado: 'SIN_DATOS', ultimaValidacion: '—', historia: [] },
    { id: 'SAC', concepto: 'Créditos disponibles', nombre: 'Saldo acumulado de créditos', explicacion: 'Créditos tributarios acumulados que podrían acompañar futuras distribuciones a los propietarios.', disponibleHoy: 6200000, proyectadoCierre: 14650000,
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

  regimenInfo: {   // TEXTO DEMO: el contenido real lo define y valida el asesor
    resumen: 'Tu empresa está actualmente acogida al régimen Pro Pyme General.',
    puntos: [
      { t: 'Cómo determina su resultado', d: 'A partir de su contabilidad, con los ajustes tributarios que corresponden al régimen.' },
      { t: 'Cómo tributa la empresa', d: 'Paga impuesto de primera categoría sobre su renta imponible, con pagos provisionales mensuales (PPM) durante el año.' },
      { t: 'Qué relación tiene con los propietarios', d: 'Los propietarios tributan cuando reciben retiros o distribuciones, con los créditos que correspondan.' },
      { t: 'Qué registros debe mantener', d: 'Registros de capital, utilidades, rentas exentas y créditos (ver Determinación y registros).' },
    ],
    tecnico: 'Art. 14 letra D N°3 LIR · parámetros desde reglas versionadas (backend).',
  },

  // Detalle técnico (solo modo Asesor)
  tecnico: {
    snapshot: 'Foto de clasificación #1 · huella c1213b7d…', reglas: 'Parámetros AT 2027 · versión demo (sin regla certificada)',
    conciliaciones: 'Diario ↔ Balance: CUADRA (199 cuentas)', completitud: '22/22 cuentas clasificadas · 0 confirmadas',
    incidencias: ['APERTURA_NO_DETECTADA', 'SALDO_CONTRARIO_A_NATURALEZA × 2'],
  },
};

// ── R2.1 · Determinación con estructura SII, incentivo al ahorro, propietarios y consolidado ──
// Todo YA calculado (demo). Los códigos F22 y el layout son REFERENCIALES: versionados por AT y por certificar.
// estado por partida: OK · PENDIENTE (falta el dato) · REVISAR (dato con observación). Lo entregará el backend.
const p = (glosa, monto, codigo = null, fuente = 'Libro Diario (percibido / pagado)', estado = monto === null ? 'PENDIENTE' : 'OK') => ({ glosa, monto, codigo, fuente, estado });
base.rli = {
  layout: { registro_layout_version: 'RLI-14D3-AT2027-demo.0', regimen: '14 D N°3', anio_tributario: 2027,
    fuente_oficial: 'Por certificar · referencia: SII, paso a paso ProPyme General', estado: 'DEMO / ESTRUCTURA REFERENCIAL' },
  ingresos: [
    p('Ingresos del giro percibidos', 205000000, '1400'),
    p('Ingresos del giro devengados en ejercicios anteriores y percibidos en el ejercicio actual', 4200000, null, 'Libro Diario (percibido / pagado)', 'REVISAR'),
    p('Rentas de fuente extranjera percibidas', 0),
    p('Intereses percibidos', 800000),
    p('Mayor valor percibido por rescate o enajenación de inversiones o bienes no depreciables', 0),
    p('Ingresos percibidos o devengados por operaciones con empresas relacionadas Art. 14 A', 0),
    p('Otros ingresos percibidos o devengados', 0),
    p('Ingreso diferido imputado en el ejercicio', 0),
    p('Otros conceptos que correspondan según AT', null, null, 'Estructura AT 2027 por certificar'),
  ],
  totalIngresos: 210000000,
  egresos: [
    p('Saldo inicial de existencias / insumos por cambio de régimen', 0),
    p('Saldo inicial de activos fijos por cambio de régimen', 0),
    p('Pérdida tributaria por cambio de régimen', 0),
    p('Existencias, insumos y servicios pagados', 64500000),
    p('Existencias, insumos y servicios de ejercicios anteriores pagados en el ejercicio', 2300000),
    p('Gastos asociados a rentas de fuente extranjera', 0),
    p('Remuneraciones pagadas', 52800000, null, 'Libro Diario · centralización solo en abril', 'REVISAR'),
    p('Honorarios pagados', 9800000),
    p('Adquisición de bienes del activo fijo pagados', 3900000),
    p('Arriendos pagados', 7200000),
    p('Intereses y reajustes pagados', 650000),
    p('Partidas Art. 21', 0),
    p('Pérdidas por rescate / enajenación', 0),
    p('Otros gastos deducibles', 1250000, null, 'Libro Diario · incluye representación', 'REVISAR'),
    p('Operaciones con empresas relacionadas', 0),
    p('Pérdidas tributarias de ejercicios anteriores', null, '1426', 'F22 AT 2026 (pendiente)'),
    p('Créditos incobrables', 0),
    p('Donaciones aceptadas', 0),
    p('Otros conceptos según estructura del AT', null, null, 'Estructura AT 2027 por certificar'),
  ],
  totalEgresos: 142400000,
  otrasPartidas: 0,
  baseAntesIncentivo: 67600000,
  beneficios: [
    { glosa: 'Incentivo al Ahorro Art. 14 E', monto: 0, codigo: '1432', nota: 'No aplicado en la Base · evaluable en Escenarios' },
    { glosa: 'IDPC voluntario', monto: 0, codigo: null, nota: 'No aplicado' },
  ],
  baseImponible: 67600000, codigoBase: '1440',
  resumenCliente: { ingresos: 210000000, egresos: -142400000, otrosAjustes: 0, baseAntes: 67600000, incentivo: 0, baseImponible: 67600000 },
};
// Ficha de cada registro (qué es / por qué importa / estructura tributaria referencial)
const ficha = {
  RLI: { porQue: 'Es la base sobre la que se calcula el impuesto de la empresa.' },
  CPTS: { porQue: 'Mide el patrimonio tributario y sirve para controlar retiros y distribuciones.',
    estructura: [p('Capital aportado', 10000000, null, 'Escritura / aportes'), p('Utilidades tributarias acumuladas (RAI)', 100150000, null, 'Registro RAI'), p('Rentas exentas e ingresos no renta (REX)', null, null, 'Registro REX (sin datos)'), p('Otros componentes del patrimonio tributario', 69000000, null, 'Balance tributario'), p('CPTS final proyectado', 179150000, null, 'Total')] },
  RAI: { porQue: 'Determina qué retiros tributan en los propietarios y con qué crédito.',
    estructura: [p('Saldo inicial', 41000000, null, 'Registro AT 2026'), p('Incorporaciones del ejercicio', 59150000, null, 'Determinación AC 2026'), p('Imputación de retiros / distribuciones proyectados', null, null, 'Se determina al cierre (motor)'), p('Saldo final proyectado', 100150000, null, 'Total')] },
  REX: { porQue: 'Permite distribuir rentas que no pagan impuestos finales o tienen un tratamiento especial.',
    estructura: [p('Saldo inicial', null, null, 'Sin datos'), p('Rentas exentas del ejercicio', null, null, 'Sin datos'), p('Ingresos no constitutivos de renta', null, null, 'Sin datos'), p('Saldo final', null, null, 'Sin datos')] },
  SAC: { porQue: 'Define el crédito que acompaña los retiros y distribuciones de los propietarios.',
    estructura: [p('Saldo inicial de créditos', 6200000, null, 'Registro AT 2026'), p('IDPC del ejercicio (proyectado)', 8450000, null, 'Determinación AC 2026'), p('Crédito asignado a retiros proyectados', null, null, 'Se determina al cierre (motor)'), p('Saldo final proyectado', 14650000, null, 'Total')] },
};
base.registros.forEach((r) => Object.assign(r, ficha[r.id], { ultimaValidacion: 'Sin validar (prototipo)' }));
base.layouts = ['RLI', 'CPTS', 'RAI', 'REX', 'SAC'].map((id) => ({ registro: id, registro_layout_version: `${id}-14D3-AT2027-demo.0`, regimen: '14 D N°3', anio_tributario: 2027, fuente_oficial: 'Por certificar' }));

// Incentivo al ahorro (Art. 14 E) · cifras ya calculadas (demo). El tope en UF se valoriza con la UF del cierre (parámetro del período).
base.incentivo = {
  rliAntes: 67600000, invertido: 47600000, notaInvertido: 'RLI menos retiros proyectados del ejercicio ($20 MM)',
  deduccionPotencial: 23800000, tope: '5.000 UF', topeMonto: null, deduccionUtilizada: 23800000, nuevaBase: 43800000,
  idpcSin: 8450000, idpcCon: 5475000, diferencia: 2975000,
  efectos: [
    { t: 'Efecto empresa', d: 'Menor impuesto de la empresa en el AT 2027: $2.975.000.' },
    { t: 'Efecto propietarios', d: 'La utilidad deducida tributará cuando se retire, y el crédito asociado a futuros retiros es menor.' },
    { t: 'Efecto caja', d: 'Paga $2.975.000 menos en abril, pero exige mantener $47,6 MM invertidos en la empresa.' },
    { t: 'Condiciones / elegibilidad', d: 'Empresa acogida al régimen Pro Pyme · opción anual al declarar · deducción de hasta el 50 % de la RLI que permanece invertida · tope 5.000 UF.' },
  ],
  avisoDemo: 'Texto demo: requisitos y efectos los valida el asesor antes de usarse.',
  exige: 'Mantener los $47,6 MM invertidos (sin retirarlos) durante el ejercicio. Su conveniencia depende de los retiros planificados y de la caja.',
  comparacion: [
    { t: 'Base antes de incentivo', base: 67600000, con: 67600000 },
    { t: 'Deducción Art. 14 E', base: null, con: -23800000, baseTxt: '—' },
    { t: 'Base afecta a IDPC', base: 67600000, con: 43800000, fuerte: true },
    { t: 'IDPC empresa', base: 8450000, con: 5475000, fuerte: true },
    { t: 'PPM al cierre', base: 7300000, con: 7300000 },
    { t: 'Saldo empresa (abril)', base: 1150000, con: -1825000, nota: 'negativo = excedente' },
    { t: 'Caja después de impuesto', base: 59150000, con: 62125000 },
    { t: 'Efecto propietario', base: null, con: null, baseTxt: '—', conTxt: 'Menor crédito en retiros futuros' },
  ],
  separacion: [{ t: 'Ahorro permanente', v: null, txt: 'Por determinar: depende de retiros futuros' }, { t: 'Diferimiento', v: 2975000 }, { t: 'Efecto caja (abril)', v: 2975000 }],
};
base.escenarios.push({ id: 'c', nombre: 'C · Incentivo al Ahorro', descripcion: 'Art. 14 E: mantener $47,6 MM invertidos en la empresa', incentivo: true, ventas: 210000000, gastos: 142400000,
  resultado: 67600000, impuesto: 5475000, ppm: 7300000, saldoAbril: -1825000, cajaDespuesImpuesto: 62125000, ahorroPermanente: null, diferimiento: 2975000, costoDecision: null });
base.decisionesEvaluables = [
  { t: 'Aplicar Incentivo al Ahorro', sub: 'Art. 14 letra E', esc: 'c', nuevo: true }, { t: 'Comprar un activo', esc: 'a' }, { t: 'Contratar una persona', esc: 'b' },
  { t: 'Retirar utilidades', esc: 'retiro' }, { t: 'Aumentar remuneraciones' }, { t: 'Realizar una inversión' }, { t: 'Cambiar proyección de ventas' }, { t: 'Otra decisión' },
];

// Propietarios (sin datos personales: identificadores genéricos). Cada socio con perfil tributario independiente.
base.propietarios = [
  { id: 'A', nombre: 'Socio A', tipo: 'Persona natural residente', participacion: 70, retiros: 14000000, rentasAsignadas: 14000000, creditos: 2000000,
    tipoCredito: 'Crédito IDPC · derecho a devolución por determinar', estado: 'PRELIMINAR',
    gc: { rentas: [{ t: 'Retiros de la empresa', v: 14000000 }, { t: 'Incremento por crédito IDPC', v: 2000000 }, { t: 'Otras rentas (sueldo empresarial, demo)', v: 24000000 }],
      base: 40000000, tramo: 'Según tabla del AT 2027 (la aplica el motor; no cargada)', rebaja: null, igcDeterminado: 2950000,
      creditoIdpc: -2000000, restitucion: 0, notaRestitucion: 'Sin restitución en 14 D N°3 (por validar)', retenciones: -1100000, ppmPersonales: 0, otrosCreditos: 0,
      saldoFinal: -150000, resultado: { tipo: 'EXCEDENTE', valor: 150000 }, posibleDevolucion: null,
      notaDevolucion: 'Solo hay devolución si el excedente proviene de créditos con derecho a devolución: lo determina el motor.' } },
  { id: 'B', nombre: 'Socio B', tipo: 'Persona natural residente', participacion: 30, retiros: 6000000, rentasAsignadas: 6000000, creditos: 857000,
    tipoCredito: 'Crédito IDPC · derecho a devolución por determinar', estado: 'PRELIMINAR',
    gc: { rentas: [{ t: 'Retiros de la empresa', v: 6000000 }, { t: 'Incremento por crédito IDPC', v: 857000 }, { t: 'Otras rentas', v: 0 }],
      base: 6857000, tramo: 'Según tabla del AT 2027 (la aplica el motor; no cargada)', rebaja: null, igcDeterminado: 0,
      creditoIdpc: -857000, restitucion: 0, notaRestitucion: 'Sin restitución en 14 D N°3 (por validar)', retenciones: 0, ppmPersonales: 0, otrosCreditos: 0,
      saldoFinal: -857000, resultado: { tipo: 'EXCEDENTE', valor: 857000 }, posibleDevolucion: null,
      notaDevolucion: 'Solo hay devolución si el excedente proviene de créditos con derecho a devolución: lo determina el motor.' } },
];
base.consolidado = {
  empresa: { idpc: 8450000, ppm: 7300000, saldo: 1150000 },
  socios: { igc: 2950000, creditosIdpc: -2857000, restitucion: 0, retenciones: -1100000, saldoPersonal: -1007000 },
  total: { impuestoEmpresa: 8450000, impuestoPersonalNeto: 93000, carga: 8543000, pagadoAnticipado: 8400000, posibleDevolucion: null, salidaNetaAbril: 143000 },
};
// Comparador empresa + socios (demo, ya calculado). Columnas = escenarios.
base.comparador = {
  columnas: ['Base', 'Incentivo al Ahorro', 'Retiro $30 MM'],
  grupos: [
    { g: 'Empresa', filas: [{ t: 'Base imponible', v: [67600000, 43800000, 67600000] }, { t: 'IDPC', v: [8450000, 5475000, 8450000] }, { t: 'Saldo empresa (abril)', v: [1150000, -1825000, 1150000] }] },
    { g: 'Socios', filas: [{ t: 'Retiros', v: [20000000, 20000000, 30000000] }, { t: 'IGC determinado', v: [2950000, 2950000, 4900000] }, { t: 'Créditos IDPC', v: [-2857000, -2857000, -4286000] }, { t: 'Resultado personal', v: [-1007000, -1007000, -486000], nota: 'negativo = excedente' }] },
    { g: 'Consolidado', filas: [{ t: 'Salida neta de caja (abril)', v: [143000, -2832000, 664000] }, { t: 'Carga tributaria total', v: [8543000, 5568000, 9064000], fuerte: true }] },
  ],
};
base.calidad = base.calidad.map((c) => c.fuente === 'Propietarios' ? { ...c, estado: 'REVISAR', cliente: 'Parcial', detalle: '2 socios (datos demo)' } : c);

// ── Variantes de estado (para revisar cómo se ve cada situación) ───────
const clonar = (o) => JSON.parse(JSON.stringify(o));
function variante(cambios) { const v = clonar(base); cambios(v); return v; }

export const ESTADOS = {
  completo: variante((v) => {
    v.caso.estadoAnalisis = 'COMPLETO'; v.caso.corte = 'Contabilidad al 31-12-2026';
    v.calidad = v.calidad.map((c) => ({ ...c, estado: 'OK', cliente: 'Completo', detalle: 'Validado' }));
    v.pendientes = []; v.resumen.cobertura = { porcentaje: 100, faltante: 0 };
    v.resumen.ppmDisponible.valor = 8450000; v.resumen.saldo = { tipo: 'POR_PAGAR', valor: 0 };
    v.caja = { saldoProyectado: 0, reservaConsiderada: 0, diferencia: 0 };
  }),
  preliminar: base,
  faltan_datos: variante((v) => {
    v.caso.estadoAnalisis = 'FALTAN_DATOS';
    v.resumen.ppmDisponible.valor = null; v.resumen.cobertura = { porcentaje: null, faltante: null }; v.resumen.saldo = { tipo: 'POR_PAGAR', valor: null };
    v.ppm.pagado = null; v.ppm.disponible = null; v.ppm.deficitEstimado = null; v.ppm.coberturaCierre = null;
    v.puente.find((p) => p.id === 'ppm').valor = null; v.puente.find((p) => p.id === 'saldo').valor = null;
    v.hoyVsDiciembre = v.hoyVsDiciembre.map((f) => (f.concepto === 'PPM' || f.concepto === 'Saldo') ? { ...f, hoy: null, diciembre: null } : f);
    v.caja = { saldoProyectado: null, reservaConsiderada: 1500000, diferencia: null };
  }),
  riesgo: variante((v) => {
    v.caso.estadoAnalisis = 'RIESGO';
    v.resumen.ppmDisponible.valor = 2950000; v.resumen.cobertura = { porcentaje: 35, faltante: 5500000 }; v.resumen.saldo = { tipo: 'POR_PAGAR', valor: 5500000 };
    v.ppm.pagado = 2950000; v.ppm.disponible = 2950000; v.ppm.proyectadoDiciembre = 4200000; v.ppm.deficitEstimado = 4250000; v.ppm.coberturaCierre = 50;
    v.hoyVsDiciembre = v.hoyVsDiciembre.map((f) => f.concepto === 'PPM' ? { ...f, hoy: 2950000, diciembre: 4200000 } : f.concepto === 'Saldo' ? { ...f, diciembre: 4250000 } : f);
    v.caja = { saldoProyectado: 5500000, reservaConsiderada: 1500000, diferencia: 4000000 };
  }),
  sin_info: variante((v) => {
    v.caso.estadoAnalisis = 'SIN_INFORMACION'; v.caso.corte = 'Sin contabilidad cargada'; v.caso.mesesReales = 0;
    v.resumen = { baseTributaria: { valor: null }, impuesto: { valor: null, tasaAplicable: null }, ppmDisponible: { valor: null }, saldo: { tipo: 'POR_PAGAR', valor: null }, cobertura: { porcentaje: null, faltante: null } };
    v.proyeccion.meses = []; v.proyeccion.evolucion = []; v.ppm.curva = []; v.radar = []; v.decisiones = [];
    v.hoyVsDiciembre = v.hoyVsDiciembre.map((f) => ({ ...f, hoy: null, diciembre: null })); v.caja = { saldoProyectado: null, reservaConsiderada: null, diferencia: null };
    v.calidad = v.calidad.map((c) => ({ ...c, estado: 'SIN_DATOS', cliente: 'No disponible', detalle: 'Sin información' }));
    v.pendientes = [{ titulo: 'Cargar la contabilidad del año', nivel: 'URGENTE', explicacion: 'Sin Libro Diario ni Balance no es posible proyectar.' }];
  }),
};
export const ETIQUETA_ESTADO = { COMPLETO: 'Análisis completo', PRELIMINAR: 'Proyección preliminar', FALTAN_DATOS: 'Faltan datos', RIESGO: 'Riesgo', SIN_INFORMACION: 'Sin información' };
