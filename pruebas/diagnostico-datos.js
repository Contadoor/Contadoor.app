// DIAGNÓSTICO «AQUÍ PARTIMOS» · respuestas FICTICIAS de diag_datos_cliente / diag_datos_prospecto / sii_historial_anual (sin datos de clientes).
// «Empresa Ficticia SpA»: 72 meses de F29 con atrasados, un observado y rectificados; F22 con observación; notificación; compras pendientes.
(function (raiz) {
  var hoy = new Date(2026, 10, 24), meses = [], tot = { declarados: 0, no_declarados: 0, observados: 0, en_revision: 0, rectificados: 0, sin_dato: 0, total_a_pagar_declarado: 0 };
  for (var k = 72; k >= 1; k--) {
    var d = new Date(hoy.getFullYear(), hoy.getMonth() - k, 1), per = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
    var vence = new Date(d.getFullYear(), d.getMonth() + 1, 20).toISOString().slice(0, 10), m;
    if (k === 1) m = { periodo: per, estado: 'declarado', vence: vence, rectificada: false, montos: true, total_a_pagar: 412300, iva_determinado: 352000, ppm: 60300, remanente: 0 };
    else if (k >= 2 && k <= 9) m = { periodo: per, estado: 'no_declarado', vence: vence };
    else if (k === 14) m = { periodo: per, estado: 'observado', vence: vence, rectificada: false, montos: true, total_a_pagar: 0, iva_determinado: 0, ppm: 0, remanente: 120000 };
    else { var pag = 180000 + (k % 5) * 41000; m = { periodo: per, estado: 'declarado', vence: vence, rectificada: k === 20 || k === 31 || k === 44, montos: true, total_a_pagar: pag, iva_determinado: pag - 40000, ppm: 40000, remanente: 0 }; }
    if (m.estado === 'declarado' || m.estado === 'observado') { tot.declarados++; tot.total_a_pagar_declarado += m.total_a_pagar; if (m.rectificada) tot.rectificados++; }
    if (m.estado === 'observado') tot.observados++;
    if (m.estado === 'no_declarado') tot.no_declarados++;
    meses.push(m);
  }
  var CATALOGO = {
    planes: [{ codigo: 'estrategico', nombre: 'Contadoor Estratégico', precio_uf: 0, valor_por_trab_uf: 0.39, por_propuesta: true },
             { codigo: 'cumplimiento', nombre: 'Cumplimiento', precio_uf: 1, valor_por_trab_uf: 0.39, por_propuesta: false },
             { codigo: 'asesoria', nombre: 'Contadoor PRO', precio_uf: 3, valor_por_trab_uf: 0.39, por_propuesta: false }],
    servicios: [{ id: 'svc_f29', nombre: 'Regularización F29', moneda: 'CLP', precio: 18990, precio_hasta: null, tipo: 'por_propuesta' },
                { id: 'svc_renta', nombre: 'Operación Renta · Contadoor PRO', moneda: 'UF', precio: null, precio_hasta: null, tipo: 'formula' }],
    uf: { periodo: '2026-11', valor: 39750.5 }
  };
  raiz.DIAG_DEMO_CLIENTE = {
    formato: 'DIAG_DATOS_V1', tipo: 'cliente', generado_en: '2026-11-24T12:00:00Z', hoy: '2026-11-24',
    actor: { nombre: 'Analista Ficticia', rol: 'contable', puede_emitir: true, puede_levantamiento: true },
    cliente: { id: 9001, razon_social: 'Empresa Ficticia SpA', rut: '76.000.000-0', giro: 'Comercio ficticio', regimen: 'pro_pyme_general', plan: 'asesoria', estado: 'onboarding', fecha_inicio: '2026-11-17', comuna: 'Maipú', tiene_rrhh: false, tiene_contabilidad: true },
    equipo: { contable: { id: 104, nombre: 'Analista Ficticia', cargo: 'Asesora Contable' }, rrhh: null },
    conexion: { estado: 'conectada', carga_inicial_lista: true, conectada_en: '2026-11-18T12:00:00Z' },
    datos_al: '2026-11-24T08:00:00Z',
    f29: { desde: meses[0].periodo, hasta: meses[71].periodo, lista_completa: true, meses: meses, totales: tot },
    f22: { lista_completa: true, anios: [
      { anio_tributario: 2026, estado: 'observado', fecha_ingreso: '2026-04-28', codigo_conclusion: '2200319', estado_sii: 'Tu declaración presenta observaciones.', rectificatorias: 1, remanente_solicitado: 0, remanente_devuelto: 0,
        observaciones: [{ codigo: 'F135', descripcion: 'Contribuyente Pro Pyme con créditos observados en su DJ 1948' }] },
      { anio_tributario: 2025, estado: 'declarado', fecha_ingreso: '2025-04-25', codigo_conclusion: '1100012', estado_sii: 'Tu declaración no presenta diferencias.', rectificatorias: 0, observaciones: [] },
      { anio_tributario: 2024, estado: 'declarado', fecha_ingreso: '2024-04-30', codigo_conclusion: '1100012', estado_sii: 'Tu declaración no presenta diferencias.', rectificatorias: 0, observaciones: [] },
      { anio_tributario: 2023, estado: 'sin_declaracion' }, { anio_tributario: 2022, estado: 'declarado', fecha_ingreso: '2022-04-29', estado_sii: 'Sin diferencias.', rectificatorias: 0, observaciones: [] },
      { anio_tributario: 2021, estado: 'declarado', fecha_ingreso: '2021-04-30', estado_sii: 'Sin diferencias.', rectificatorias: 0, observaciones: [] }] },
    cartas: { total_vigentes: 3, items: [
      { categoria: 'notificacion', titulo: 'Notificación de Giro por Fuera de Plazo de Formulario 29', fecha: '2026-08-12', periodo: '202606', plazo: '15 días hábiles', asunto: 'Giro F29' },
      { categoria: 'carta', titulo: 'Solicitud de corrección o nuevo requerimiento', fecha: '2026-05-03', periodo: null, plazo: null, asunto: 'Requerimiento' },
      { categoria: 'carta', titulo: 'Modificación del registro de contribuyentes', fecha: '2025-12-01', periodo: null, plazo: null, asunto: 'Registro' }] },
    cumplimiento: { cumple: false, estado: 'No cumple sus obligaciones tributarias', actualizado_en: '2026-11-24', condiciones_no_cumple: [{ codigo: 'C1', titulo: 'Declaraciones de IVA (F29) al día' }] },
    rcv: { compras_pendientes: [{ periodo: '202610', documentos: 4, iva: 76000, total: 476000 }], compras_reclamadas: [], ventas_reclamadas: { documentos: 1, total: 59500 } },
    onboarding: { caso_id: 70, lista_version: 2, estado: 'en_curso', plan: 'asesoria', valor_uf: 3, gestion_laboral: false, valor_trab_uf: null, fecha_inicio: '2026-11-17',
                  paso9: { estado: 'en_curso', con_enlace: false, actualizado: '2026-11-20T13:00:00Z' } },
    catalogo: CATALOGO, anteriores: []
  };
  raiz.DIAG_DEMO_PROSPECTO = {
    formato: 'DIAG_DATOS_V1', tipo: 'prospecto', generado_en: '2026-11-24T12:00:00Z', hoy: '2026-11-24',
    actor: { nombre: 'Comercial Ficticia', rol: 'comercial', puede_emitir: true, puede_levantamiento: false },
    prospecto: { id: 30, empresa: 'Prospecto Ficticio SpA', atencion: 'Persona Ficticia', plan_interes: 'pro', n_trabajadores: 4, etapa: 'propuesta' },
    cliente_id: null, conexion: { estado: 'sin_conexion' },
    cotizacion: { id: 500, codigo: 'COT-2026-0500', version: 1, tipo: 'plan', plan_codigo: 'asesoria', trabajadores: 4, moneda: 'UF', periodicidad: 'mensual', monto_final: 3, items: [], soluciones: [], estado: 'enviada', vigencia_hasta: '2026-12-09' },
    catalogo: CATALOGO, anteriores: []
  };
  // sii_historial_anual (HIST_ANUAL_V1, contrato de feat/reporte-historial-sii): solo lo que usa el diagnóstico.
  var hm = [];
  for (var i = 1; i <= 12; i++) {
    var p = '2026' + String(i).padStart(2, '0'), fut = i >= 11, e = i >= 2 && i <= 9 ? null : (i === 1 ? 'pagado' : (i === 10 ? 'pendiente' : null));
    hm.push({ periodo: p, mes: i, futuro: fut, f29: { estado: e ? 'declarado' : 'no_declarado', total_a_pagar: e ? 412300 : null }, pago: fut ? null : { estado: e || 'sin_informacion', fuente: e ? 'contadoor' : null } });
  }
  raiz.DIAG_DEMO_HIST = { anio: 2026, version: 'HIST_ANUAL_V1', meses: hm };
})(typeof window !== 'undefined' ? window : globalThis);
