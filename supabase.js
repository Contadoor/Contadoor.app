// ============================================================
// supabase.js — Cliente Supabase compartido · Gestoor v3
// <script src="../supabase.js"></script> en todos los módulos
// ============================================================

var SB_URL = 'https://ulxoxqbuxiuylaolaqxj.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVseG94cWJ1eGl1eWxhb2xhcXhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxNDMwNDcsImV4cCI6MjA5OTcxOTA0N30.bN_KeSJFEBKSBzwTixRQs92y6aEhBo-SJs4fGxZgAbA';

// ── CORE ─────────────────────────────────────────────────────
function sbH(extra){
  return Object.assign({'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json'},extra||{});
}
function sbFetch(path,opts){
  var o=opts||{};
  return fetch(SB_URL+'/rest/v1/'+path,Object.assign({},o,{headers:sbH(o.headers||{})}));
}
function sbGet(path){
  return sbFetch(path).then(function(r){return r.ok?r.json():[];}).catch(function(){return[];});
}
function sbPost(table,data,prefer){
  return sbFetch(table,{method:'POST',headers:{'Prefer':prefer||'resolution=merge-duplicates,return=representation'},body:JSON.stringify(data)})
    .then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
}
function sbPatch(path,data){
  return sbFetch(path,{method:'PATCH',headers:{'Prefer':'return=representation'},body:JSON.stringify(data)})
    .then(function(r){return r.ok?r.json():null;}).catch(function(){return null;});
}
function sbDelete(path){
  return sbFetch(path,{method:'DELETE'}).then(function(r){return r.ok;}).catch(function(){return false;});
}
function sbUpsert(table,data){return sbPost(table,data,'resolution=merge-duplicates,return=representation');}

// ── CACHÉ EN MEMORIA (TTL 5 min) ─────────────────────────────
var _sbCache={};
var SB_TTL=5*60*1000;
function sbCacheGet(k){
  var c=_sbCache[k];
  if(!c||!c.d) return null;
  if(Date.now()-c.ts>SB_TTL){delete _sbCache[k];return null;}
  return c.d;
}
function sbCacheSet(k,d){
  _sbCache[k]={d:d,ts:Date.now()};
  try{localStorage.setItem('sbc_'+k,JSON.stringify({d:d,ts:Date.now()}));}catch(e){}
}
function sbCacheInvalidate(k){
  delete _sbCache[k];
  try{localStorage.removeItem('sbc_'+k);}catch(e){}
}
// Lee caché memoria → localStorage → legado
function sbCacheOrLocal(k,legado){
  var m=sbCacheGet(k); if(m) return m;
  try{
    var raw=localStorage.getItem('sbc_'+k);
    if(raw){var p=JSON.parse(raw);if(p&&p.d&&Date.now()-p.ts<SB_TTL*2)return p.d;}
  }catch(e){}
  if(legado){try{return JSON.parse(localStorage.getItem(legado)||'null');}catch(e){}}
  return null;
}

// ── USUARIO ACTIVO ────────────────────────────────────────────
// MODIFICADO v3: sessionStorage('usuario_activo') es la fuente oficial.
// Fallback a localStorage('usuario_sesion') para módulos en transición.
function getUsuario(){
  try{
    var u=JSON.parse(sessionStorage.getItem('usuario_activo')||'null');
    if(u&&u.nombre) return u;
    return JSON.parse(localStorage.getItem('usuario_sesion')||'{}');
  }catch(e){return{};}
}

// ── CLIENTES ─────────────────────────────────────────────────
// Columnas reales: rut, razon_social, contacto, email, wa, tel, ciudad,
//   plan, estado, analista_rrhh, analista_contable, analista_pagos,
//   email_analista, wa_analista, tiene_rrhh, tiene_contabilidad,
//   moneda_plan, monto_base, trab_incluidos, valor_por_trab, hon_variable,
//   prioridad_rrhh, prioridad_contable, ...

function sbRowToCliente(row){
  if(!row) return null;
  return {
    id:              row.id,
    rut:             row.rut,
    razon:           row.razon_social,
    giro:            row.giro,
    email:           row.email,
    contacto:        row.contacto,
    tel:             row.tel,
    wa:              row.wa,
    ciudad:          row.ciudad,
    plan:            row.plan,
    estado:          row.estado||'activo',
    inicio:          row.fecha_inicio,
    reg:             row.regimen,
    iva:             row.iva_condicion,
    modalidad:       row.modalidad_pago,
    obsTrib:         row.obs_trib,
    moneda:          row.moneda_plan,
    monedaVar:       row.moneda_variable,
    monto:           row.monto_base,
    trab:            row.trab_incluidos||0,
    varTrab:         row.valor_por_trab||row.hon_variable,
    precioObs:       row.precio_obs,
    // Analistas
    contador:        row.analista_contable,
    rrhh:            row.analista_rrhh,
    analistaRrhh:    row.analista_rrhh,
    analistaContable:row.analista_contable,
    analistaPagos:   row.analista_pagos,
    emailAnalista:   row.email_analista,
    waAnalista:      row.wa_analista,
    prioRrhh:        row.prioridad_rrhh||'media',
    prioCont:        row.prioridad_contable||'media',
    // Credenciales
    siiU:    row.usuario_sii,    siiK:  row.clave_sii,
    prevU:   row.usuario_previred, prevK: row.clave_previred,
    cuU:     row.usuario_cu,     cuK:   row.clave_cu,
    factU:   row.usuario_fact,   factK: row.clave_fact,
    licU:    row.usuario_lic,    licK:  row.clave_lic,
    credsExtra: row.creds_extra||[],
    obsAcceso:  row.obs_acceso,
    obs:        row.obs,
    logo:       row.logo_base64,
    socios:     row.socios||[],
    // Flags servicio
    tieneRrhh:         row.tiene_rrhh!==false,
    tieneContabilidad: row.tiene_contabilidad!==false
  };
}

function sbClienteToRow(c){
  return {
    rut:               c.rut,
    razon_social:      c.razon,
    giro:              c.giro||null,
    email:             c.email||null,
    contacto:          c.contacto||null,
    tel:               c.tel||null,
    wa:                c.wa||null,
    ciudad:            c.ciudad||null,
    plan:              c.plan||null,
    estado:            c.estado||'activo',
    fecha_inicio:      c.inicio||null,
    regimen:           c.reg||null,
    iva_condicion:     c.iva||'afecto',
    modalidad_pago:    c.modalidad||'contadoor',
    obs_trib:          c.obsTrib||null,
    moneda_plan:       c.moneda||'UF',
    moneda_variable:   c.monedaVar||c.moneda||'UF',
    monto_base:        c.monto||null,
    trab_incluidos:    c.trab||0,
    valor_por_trab:    c.varTrab||null,
    hon_variable:      c.varTrab||null,
    precio_obs:        c.precioObs||null,
    analista_rrhh:     c.rrhh||c.analistaRrhh||null,
    analista_contable: c.contador||c.analistaContable||null,
    analista_pagos:    c.analistaPagos||null,
    email_analista:    c.emailAnalista||null,
    wa_analista:       c.waAnalista||null,
    prioridad_rrhh:    c.prioRrhh||'media',
    prioridad_contable:c.prioCont||'media',
    usuario_sii:       c.siiU||null,   clave_sii:       c.siiK||null,
    usuario_previred:  c.prevU||null,  clave_previred:  c.prevK||null,
    usuario_cu:        c.cuU||null,    clave_cu:        c.cuK||null,
    usuario_fact:      c.factU||null,  clave_fact:      c.factK||null,
    usuario_lic:       c.licU||null,   clave_lic:       c.licK||null,
    creds_extra:       c.credsExtra||[],
    obs_acceso:        c.obsAcceso||null,
    obs:               c.obs||null,
    logo_base64:       c.logo||null,
    socios:            c.socios||[],
    tiene_rrhh:        c.tieneRrhh!==false,
    tiene_contabilidad:c.tieneContabilidad!==false
  };
}

function sbGetClientes(cb){
  var cached=sbCacheOrLocal('clientes','clientes_bd');
  if(cached) cb(cached);  // inmediato con caché
  sbGet('clientes?select=*&order=razon_social.asc').then(function(rows){
    if(!rows||!rows.length){if(!cached)cb([]);return;}
    var mapped=rows.map(sbRowToCliente);
    sbCacheSet('clientes',mapped);
    try{localStorage.setItem('clientes_bd',JSON.stringify(mapped));}catch(e){}
    cb(mapped);
  }).catch(function(){if(!cached)cb([]);});
}

function sbUpsertCliente(c){
  var row=sbClienteToRow(c);
  if(c.id) return sbPatch('clientes?id=eq.'+c.id,row);
  return sbPost('clientes',row);
}

// ── PERIODOS ─────────────────────────────────────────────────
// Columnas reales: id, periodo, estado, uf, utm, fecha_apertura,
//   fecha_corta, abierto_por, venc_previred_*, venc_f29_*, tareas, calendario

function sbGetPeriodos(cb){
  var cached=sbCacheOrLocal('periodos','rpt_periodos');
  if(cached) cb(cached);
  sbGet('periodos?select=*&order=periodo.desc&limit=24').then(function(rows){
    if(!rows||!rows.length){if(!cached)cb([]);return;}
    sbCacheSet('periodos',rows);
    try{localStorage.setItem('rpt_periodos',JSON.stringify(rows));}catch(e){}
    cb(rows);
  }).catch(function(){if(!cached)cb([]);});
}

function sbUpsertPeriodo(p){
  return sbPost('periodos',p,'resolution=merge-duplicates');
}

// ── USUARIOS ─────────────────────────────────────────────────
function sbGetUsuarios(cb){
  var cached=sbCacheOrLocal('usuarios','usuarios_sistema');
  if(cached) cb(cached);
  sbGet('usuarios_sistema?select=*&activo=eq.true&order=nombre.asc').then(function(rows){
    if(!rows||!rows.length){if(!cached)cb([]);return;}
    var mapped=rows.map(function(r){
      return {
        id:r.id, nombre:r.nombre, iniciales:r.iniciales||'',
        email:r.email, wa:r.wa, rol:r.rol,
        rolLabel:r.rol_label, pin:r.pin,
        esMaster:r.es_master||false, activo:r.activo!==false,
        modulos:r.modulos||[], color:r.color
      };
    });
    sbCacheSet('usuarios',mapped);
    try{localStorage.setItem('usuarios_sistema',JSON.stringify(mapped));}catch(e){}
    cb(mapped);
  }).catch(function(){if(!cached)cb([]);});
}

// ── REPORTES MENSUALES ───────────────────────────────────────
// FK real: cliente_rut
// Notas de mapeo:
//   n_trabajadores       ↔ nTrab
//   total_descuentos     ↔ totalDesc
//   total_aportes        ↔ totalAportes  (nuevo; legado: aporte_patronal)
//   total_cotizaciones   ↔ totalCot      (nuevo; legado: total_cot)
//   debito_iva           ↔ ivaDebito
//   credito_iva          ↔ ivaCredito
//   f29                  ↔ totalImpInmediato
// IU: siempre separado → iu_sii → F29/imp2cat contable. NO en total_cotizaciones.

function sbReporteToRow(r){
  // ── Totales RRHH ─────────────────────────────────────────
  // Los campos legacy totalAportes y totalCot pueden contener cálculos
  // incompletos o incorrectos (versiones anteriores incluían IU u omitían
  // capInd/expVida/rentProt). No migrar valores legacy hacia los nuevos campos.
  //
  // Criterio: si existen componentes previsionales individuales disponibles,
  // siempre recalcular con la fórmula oficial. Los componentes individuales
  // son confiables porque vienen directamente de las columnas del libro.
  // Solo usar legacy como último fallback para registros manuales sin desglose.
  //
  // NUNCA incluir IU en total_cotizaciones.
  // NUNCA incluir otros_descuentos en total_cotizaciones.

  // ¿Hay desglose previsional en este registro?
  var _tieneDesglose =
    (r.afp||0)+(r.apv||0)+(r.salud||0)+(r.cesTrab||0) > 0 ||
    (r.sis||0)+(r.mutual||0)+(r.cesEmp||0)+(r.capInd||0)+(r.expVida||0)+(r.rentProt||0) > 0;

  // total_aportes — fórmula oficial: SIS+Mutual+CesEmp+CapInd+ExpVida+RentProt
  // Si hay desglose, siempre calcular. No confiar en totalAportes legacy.
  var _totalAportes = _tieneDesglose
    ? (r.sis||0)+(r.mutual||0)+(r.cesEmp||0)+(r.capInd||0)+(r.expVida||0)+(r.rentProt||0)
    : (r.totalAportes||0);   // fallback: registro manual sin ningún componente

  // total_cotizaciones — fórmula oficial: AFP+APV+Salud+CesTrab+SIS+Mutual+CesEmp+CapInd+ExpVida+RentProt
  // Prioridad:
  //   1. totalCotizaciones nuevo (campo explícito del procesamiento actual) — siempre confiable
  //   2. Si hay desglose, recalcular con fórmula oficial — ignora totalCot legacy
  //   3. totalCot legacy — solo para registros manuales sin ningún desglose previsional
  var _totalCot = r.totalCotizaciones != null
    ? r.totalCotizaciones
    : _tieneDesglose
      ? (r.afp||0)+(r.apv||0)+(r.salud||0)+(r.cesTrab||0)
        +(r.sis||0)+(r.mutual||0)+(r.cesEmp||0)
        +(r.capInd||0)+(r.expVida||0)+(r.rentProt||0)
      : (r.totalCot||0);     // fallback: registro manual sin ningún componente

  // costo_laboral — total_imponible + total_no_imponible + total_aportes
  // costoLaboral es campo nuevo; no existe en registros históricos.
  // Si hay datos de haberes, calcular. Sin haberes, intentar valor recibido.
  var _costoLaboral = (r.totalImponible||r.totalNoImponible)
    ? (r.totalImponible||0)+(r.totalNoImponible||0)+_totalAportes
    : (r.costoLaboral||0);

  var row = {
    cliente_rut:          r.rut,
    periodo:              r.periodo,
    estado:               r.estado||'borrador',
    // Info cliente desnormalizada
    cliente_nombre:       r.clienteNombre||null,
    cliente_wa:           r.clienteWa||null,
    cliente_email:        r.clienteEmail||null,
    cliente_plan:         r.clientePlan||null,
    quien_paga:           r.quienPaga||'contadoor',
    // ── RRHH — haberes ──────────────────────────────────────
    n_trabajadores:       r.nTrab||r.trabM||0,
    total_imponible:      r.totalImponible||0,
    total_no_imponible:   r.totalNoImponible||0,
    liquido_pagar:        r.liquidoPagar||r.liquidoM||0,
    // ── Descuentos trabajadores ──────────────────────────────
    afp:                  r.afp||0,
    salud:                r.salud||0,
    apv:                  r.apv||0,     // combinado; apv1+apv2 en tabla trabajadores
    ces_trab:             r.cesTrab||0,
    iu:                   r.iu||0,      // tributario → F29; NO en cotizaciones
    otros_desc:           r.otrosDesc||0,
    total_desc:           r.totalDesc||0,
    total_descuentos:     r.totalDesc||0,
    // ── Aportes patronales ───────────────────────────────────
    sis:                  r.sis||0,
    mutual:               r.mutual||0,
    ces_emp:              r.cesEmp||0,
    cap_ind:              r.capInd||0,
    exp_vida:             r.expVida||0,
    rent_prot:            r.rentProt||0,
    // ── Totales calculados correctamente ────────────────────
    total_aportes:        _totalAportes,
    total_cotizaciones:   _totalCot,
    costo_laboral:        _costoLaboral,
    // Compat legado (se mantienen para módulos existentes)
    aporte_patronal:      _totalAportes,
    total_cot:            _totalCot,
    impuesto_unico:       r.iu||r.iuSii||0,
    total_costo_empresa:  (r.liquidoPagar||0)+_totalAportes,
    obs_rrhh:             r.obsRrhh||null,
    // ── Contadores asistencia ────────────────────────────────
    n_con_licencia:       r.nConLicencia||0,
    n_con_vacaciones:     r.nConVacaciones||0,
    n_con_atrasos:        r.nConAtrasos||0,
    // ── Cuadratura ───────────────────────────────────────────
    // null = no evaluada / true = ok / false = diferencia detectada
    cuadratura_ok:        r.cuadraturaOk !== undefined ? r.cuadraturaOk : null,
    diferencia_cuadratura:r.diferenciaCuadratura||0,
    // ── Trazabilidad archivo ─────────────────────────────────
    archivo_nombre:       r.archivoNombre||null,
    procesado_at:         r.procesadoAt||null,
    procesado_por:        r.procesadoPor||null,
    // ── IVA ──────────────────────────────────────────────────
    debito_iva:           r.ivaDebito||0,
    credito_iva:          r.ivaCredito||0,
    remanente:            r.ivaRemanenteSig||r.ivaRemanente||0,
    iva_remanente_sig:    r.ivaRemanenteSig||0,
    iva_postergado:       r.ivaPostergado||0,
    postergar_iva:        r.postergarIva||false,
    iva_fecha_venc:       r.ivaFechaVenc||null,
    // ── F29 (IU va aquí vía flujo independiente, no tocar) ───
    f29:                  r.totalImpInmediato||0,
    total_imp_inmediato:  r.totalImpInmediato||0,
    ppm:                  r.ppm||0,
    ppm_tasa:             r.ppmTasa||0,
    ppm_base:             r.ppmBase||0,
    ret_hon:              r.retHon||0,
    ret2:                 r.ret2||0,
    iu_sii:               r.iuSii||r.iu||0,
    otros_imp:            r.otrosImp||0,
    obs_cont:             r.obsCont||null,
    // ── Honorarios ───────────────────────────────────────────
    hon_base:             r.honBase||0,
    hon_base_uf:          r.honBaseUf||0,
    hon_var:              r.honVar||0,
    hon_val_trab:         r.honValTrab||0,
    hon_ntrab:            r.honNtrab||0,
    hon_total:            r.honTotal||0,
    hon_moneda:           r.honMoneda||'CLP',
    hon_estado:           r.honEstado||'pendiente',
    factura:              r.factura||null,
    factura_fecha:        r.facturaFecha||null,
    uf_periodo:           r.ufPeriodo||0,
    // ── Totales generales ────────────────────────────────────
    total_general:        r.totalGeneral||0,
    total_atrasos:        r.totalAtrasos||0,
    atrasos:              r.atrasos||[],
    recomendaciones:      r.recomendaciones||null,
    obs_analista:         r.obsAnalista||null,
    // ── Flujo pago ───────────────────────────────────────────
    pre_reporte_enviado:  r.preReporteEnviado||false,
    pre_reporte_fecha:    r.preReporteFecha||null,
    ha_postergado:        r.haPostergado||false,
    fecha_postergacion:   r.fechaPostergacion||null,
    n_recordatorios:      r.nRecordatorios||0,
    ultimo_recordatorio:  r.ultimoRecordatorio||null,
    fecha_transferido:    r.fechaTransferido||null,
    quien_transferido:    r.quienTransferido||null,
    fecha_previred:       r.fechaPrevired||null,
    quien_previred:       r.quienPrevired||null,
    fecha_aprobacion:     r.fechaAprobacion||null,
    fecha_finalizado:     r.fechaFinalizado||null,
    quien_finalizado:     r.quienFinalizado||null,
    fecha_pago:           r.fechaPago||null,
    pagado:               r.pagado||false,
    pagos_validado:       r.pagosValidado||false,
    decision_cotiz:       r.decisionCotiz||null,
    // ── Analistas ────────────────────────────────────────────
    analista_rrhh:        r.preparado||r.analistaRrhh||null,
    analista_contable:    r.revisado||r.analistaContable||null,
    email_analista:       r.emailAnalista||null,
    preparado:            r.preparado||null,
    revisado:             r.revisado||null,
    // ── Flags ────────────────────────────────────────────────
    secciones:            r.secciones||{},
    usa_archivo:          r.usaArchivo||false,
    tiene_rrhh:           r.tieneRrhh!==false,
    tiene_cont:           r.tieneCont!==false,
    prioridad_rrhh:       r.prioridadRrhh||'media',
    prioridad_contable:   r.prioridadContable||'media',
    // ── Versionado RRHH ─────────────────────────────────────
    revision:            (r.revision != null && r.revision !== undefined) ? Number(r.revision) : undefined,
    reprocesado_at:      r.reprocesadoAt||null,
    reprocesado_por:     r.reprocesadoPor||null,
    motivo_reproceso:    r.motivoReproceso||null
  };
  // Eliminar undefined para no contaminar PATCH (evita sobreescribir campos que no cambian)
  Object.keys(row).forEach(function(k){ if(row[k]===undefined) delete row[k]; });
  return row;
}

function sbRowToReporte(row){
  if(!row) return null;
  return {
    id:               row.id,
    rut:              row.cliente_rut,
    periodo:          row.periodo,
    estado:           row.estado||'borrador',
    clienteNombre:    row.cliente_nombre,
    clienteWa:        row.cliente_wa,
    clienteEmail:     row.cliente_email,
    clientePlan:      row.cliente_plan,
    quienPaga:        row.quien_paga,
    // ── RRHH — haberes ──────────────────────────────────────
    nTrab:            row.n_trabajadores||0,
    totalImponible:   row.total_imponible||0,
    totalNoImponible: row.total_no_imponible||0,
    liquidoPagar:     row.liquido_pagar||0,
    // ── Descuentos trabajadores ──────────────────────────────
    afp:              row.afp||0,
    salud:            row.salud||0,
    apv:              row.apv||0,
    cesTrab:          row.ces_trab||0,
    iu:               row.iu||0,
    otrosDesc:        row.otros_desc||0,
    totalDesc:        row.total_desc||row.total_descuentos||0,
    // ── Aportes patronales ───────────────────────────────────
    sis:              row.sis||0,
    mutual:           row.mutual||0,
    cesEmp:           row.ces_emp||0,
    capInd:           row.cap_ind||0,
    expVida:          row.exp_vida||0,
    rentProt:         row.rent_prot||0,
    // ── Totales: nuevo campo primero, fallback legado ────────
    totalAportes:     row.total_aportes||row.aporte_patronal||0,
    totalCot:         row.total_cotizaciones||row.total_cot||0,
    costoLaboral:     row.costo_laboral||0,
    obsRrhh:          row.obs_rrhh,
    // ── Contadores asistencia ────────────────────────────────
    nConLicencia:     row.n_con_licencia||0,
    nConVacaciones:   row.n_con_vacaciones||0,
    nConAtrasos:      row.n_con_atrasos||0,
    // ── Cuadratura ───────────────────────────────────────────
    cuadraturaOk:           row.cuadratura_ok,   // null/true/false — no defaultear
    diferenciaCuadratura:   row.diferencia_cuadratura||0,
    // ── Trazabilidad ─────────────────────────────────────────
    archivoNombre:    row.archivo_nombre||null,
    procesadoAt:      row.procesado_at||null,
    procesadoPor:     row.procesado_por||null,
    // ── IVA ──────────────────────────────────────────────────
    ivaDebito:        row.debito_iva||0,
    ivaCredito:       row.credito_iva||0,
    ivaRemanenteSig:  row.iva_remanente_sig||row.remanente||0,
    ivaPostergado:    row.iva_postergado||0,
    postergarIva:     row.postergar_iva||false,
    ivaFechaVenc:     row.iva_fecha_venc,
    // ── F29 ──────────────────────────────────────────────────
    totalImpInmediato:row.f29||row.total_imp_inmediato||0,
    ppm:              row.ppm||0,
    ppmTasa:          row.ppm_tasa||0,
    ppmBase:          row.ppm_base||0,
    retHon:           row.ret_hon||0,
    ret2:             row.ret2||0,
    iuSii:            row.iu_sii||0,
    otrosImp:         row.otros_imp||0,
    obsCont:          row.obs_cont,
    // ── Honorarios ───────────────────────────────────────────
    honBase:          row.hon_base||0,
    honBaseUf:        row.hon_base_uf||0,
    honVar:           row.hon_var||0,
    honValTrab:       row.hon_val_trab||0,
    honNtrab:         row.hon_ntrab||0,
    honTotal:         row.hon_total||0,
    honMoneda:        row.hon_moneda||'CLP',
    honEstado:        row.hon_estado||'pendiente',
    factura:          row.factura,
    facturaFecha:     row.factura_fecha,
    ufPeriodo:        row.uf_periodo||0,
    // ── Totales generales ────────────────────────────────────
    totalGeneral:     row.total_general||0,
    totalAtrasos:     row.total_atrasos||0,
    atrasos:          row.atrasos||[],
    recomendaciones:  row.recomendaciones,
    obsAnalista:      row.obs_analista,
    // ── Flujo pago ───────────────────────────────────────────
    preReporteEnviado:row.pre_reporte_enviado||false,
    preReporteFecha:  row.pre_reporte_fecha,
    // Versionado RRHH
    revision:         row.revision!=null?row.revision:1,
    reprocesadoAt:    row.reprocesado_at||null,
    reprocesadoPor:   row.reprocesado_por||null,
    motivoReproceso:  row.motivo_reproceso||null,
    haPostergado:     row.ha_postergado||false,
    fechaPostergacion:row.fecha_postergacion,
    nRecordatorios:   row.n_recordatorios||0,
    ultimoRecordatorio:row.ultimo_recordatorio,
    fechaTransferido: row.fecha_transferido,
    quienTransferido: row.quien_transferido,
    fechaPrevired:    row.fecha_previred,
    quienPrevired:    row.quien_previred,
    fechaAprobacion:  row.fecha_aprobacion,
    fechaFinalizado:  row.fecha_finalizado,
    quienFinalizado:  row.quien_finalizado,
    fechaPago:        row.fecha_pago,
    pagado:           row.pagado||false,
    pagosValidado:    row.pagos_validado||false,
    decisionCotiz:    row.decision_cotiz,
    // ── Analistas ────────────────────────────────────────────
    preparado:        row.preparado||row.analista_rrhh,
    revisado:         row.revisado||row.analista_contable,
    emailAnalista:    row.email_analista,
    analistaRrhh:     row.analista_rrhh,
    analistaContable: row.analista_contable,
    // ── Flags ────────────────────────────────────────────────
    secciones:        row.secciones||{},
    usaArchivo:       row.usa_archivo||false,
    tieneRrhh:        row.tiene_rrhh!==false,
    tieneCont:        row.tiene_cont!==false,
    prioridadRrhh:    row.prioridad_rrhh||'media',
    prioridadContable:row.prioridad_contable||'media',
    ts:               new Date(row.created_at||Date.now()).getTime()
  };
}

function sbGetReportesPeriodo(periodo,cb){
  sbGet('reportes_mensuales?periodo=eq.'+encodeURIComponent(periodo)+'&select=*&order=cliente_rut.asc')
    .then(function(rows){cb((rows||[]).map(sbRowToReporte));})
    .catch(function(){cb([]);});
}

function sbUpsertReporte(r){
  var row=sbReporteToRow(r);
  // ID real = entero numérico puro asignado por Supabase.
  // IDs temporales como "nuevo_76.567.316-K_2026-07" no son numéricos
  // y deben ir siempre a POST, nunca a PATCH.
  var idReal = r.id !== undefined &&
               r.id !== null &&
               /^\d+$/.test(String(r.id));
  if(idReal){
    return sbPatch('reportes_mensuales?id=eq.'+encodeURIComponent(r.id),row);
  }
  return sbPost('reportes_mensuales',row);
}

function sbPatchReporte(id,data){
  return sbPatch('reportes_mensuales?id=eq.'+id,data);
}

// ── PAGOS ────────────────────────────────────────────────────
// SIN CAMBIOS — mantener intacto en esta fase

function sbGetPagos(filtros,cb){
  var q='pagos?select=*&order=created_at.desc';
  if(filtros&&filtros.periodo) q+='&periodo=eq.'+encodeURIComponent(filtros.periodo);
  if(filtros&&filtros.estado)  q+='&estado=eq.'+filtros.estado;
  sbGet(q).then(function(rows){cb(rows||[]);}).catch(function(){cb([]);});
}

function sbUpsertPago(p){
  var row=Object.assign({},p);
  if(row.rut&&!row.cliente_rut){row.cliente_rut=row.rut;delete row.rut;}
  return sbPost('pagos',row);
}

function sbPatchPago(id,data){return sbPatch('pagos?id=eq.'+id,data);}

// ── CONCILIACIÓN ─────────────────────────────────────────────
// SIN CAMBIOS

function sbGetMovimientos(cb){
  sbGet('concil_movimientos?select=*&order=fecha.desc&limit=1000')
    .then(function(rows){cb(rows||[]);}).catch(function(){cb([]);});
}
function sbUpsertMovimiento(mov){return sbPost('concil_movimientos',mov);}
function sbPatchMovimiento(id,data){return sbPatch('concil_movimientos?id=eq.'+id,data);}

// ── CONVENIOS ────────────────────────────────────────────────
// SIN CAMBIOS

function sbGetConvenios(rut,cb){
  var q='convenios?select=*'+(rut?'&cliente_rut=eq.'+encodeURIComponent(rut):'')+'&order=created_at.desc';
  sbGet(q).then(function(rows){cb(rows||[]);}).catch(function(){cb([]);});
}
function sbUpsertConvenio(c){
  var row=Object.assign({},c);
  if(row.rut&&!row.cliente_rut){row.cliente_rut=row.rut;delete row.rut;}
  if(row.cuotas!==undefined&&row.n_cuotas===undefined){row.n_cuotas=row.cuotas;delete row.cuotas;}
  return sbPost('convenios',row);
}

// ── PLANES ───────────────────────────────────────────────────
// SIN CAMBIOS

function sbGetPlanes(cb){
  var cached=sbCacheOrLocal('planes','planes_bd');
  if(cached) cb(cached);
  sbGet('planes?select=*&activo=eq.true&order=nombre.asc').then(function(rows){
    if(!rows||!rows.length){if(!cached)cb([]);return;}
    sbCacheSet('planes',rows);
    try{localStorage.setItem('planes_bd',JSON.stringify(rows));}catch(e){}
    cb(rows);
  }).catch(function(){if(!cached)cb([]);});
}

// ── SERVICIOS ADICIONALES ────────────────────────────────────
// SIN CAMBIOS

function sbGetServiciosAdicionales(cb){
  var cached=sbCacheOrLocal('servicios','servicios_adicionales');
  if(cached) cb(cached);
  sbGet('servicios_adicionales?select=*&activo=eq.true&order=nombre.asc').then(function(rows){
    if(!rows||!rows.length){if(!cached)cb([]);return;}
    sbCacheSet('servicios',rows);
    try{localStorage.setItem('servicios_adicionales',JSON.stringify(rows));}catch(e){}
    cb(rows);
  }).catch(function(){if(!cached)cb([]);});
}

// ── DETALLE TRABAJADORES RRHH ─────────────────────────────────
// Tabla: reporte_rrhh_trabajadores
// Fotografía histórica por trabajador y período.
// NO es ficha maestra: cada período tiene su propio registro.
// Las columnas total_aportes, total_cotizaciones, costo_laboral
// son GENERATED ALWAYS AS en PostgreSQL — NO enviar en INSERT/UPDATE.

function sbTrabajadorRrhhToRow(t, reporteId, clienteRut, periodo, revision){
  return {
    reporte_id:           reporteId,
    revision:             revision||1,
    cliente_rut:          clienteRut,
    periodo:              periodo,
    // Identificación
    rut:                  t.rut,
    apellido_paterno:     t.apellidoPaterno||null,
    apellido_materno:     t.apellidoMaterno||null,
    nombres:              t.nombres||null,
    centro_costo:         t.centroCosto||null,
    // Previsional
    salud_nombre:         t.saludNombre||null,
    plan_salud:           t.plan||null,
    afp_nombre:           t.afpNombre||null,
    pct_afp:              t.pctAfp||0,
    // Asistencia
    dias_trabajados:      t.diasTrabajados||0,
    atraso:               t.atraso||0,
    dias_vacaciones:      t.diasVacaciones||0,
    dias_licencia:        t.diasLicencia||0,
    en_licencia_completa: t.enLicenciaCompleta||false,
    // Contrato
    sueldo_base:          t.sueldoBase||0,
    // Haberes imponibles
    sueldo_mensual:       t.sueldoMensual||0,
    gratificacion:        t.gratificacion||0,
    total_imponible:      t.totalImponible||0,
    // Haberes no imponibles
    c_familiar:           t.cFamiliar||0,
    colacion:             t.colacion||0,
    movilizacion:         t.movilizacion||0,
    total_no_imponible:   t.totalNoImponible||0,
    // Descuentos trabajador
    dcto_afp:             t.dctoAfp||0,
    apv1:                 t.apv1||0,
    apv2:                 t.apv2||0,
    dcto_salud:           t.dctoSalud||0,
    ces_trab:             t.cesTrab||0,
    iu:                   t.iu||0,      // tributario → F29; NO en cotizaciones
    total_descuentos:     t.totalDescuentos||0,
    otros_descuentos:     t.otrosDescuentos||0,
    // Resultado
    liquido:              t.liquido||0,
    // Aportes patronales
    sis:                  t.sis||0,
    mutual:               t.mutual||0,
    ces_emp:              t.cesEmp||0,
    cap_ind:              t.capInd||0,
    exp_vida:             t.expVida||0,
    rent_prot:            t.rentProt||0,
    // Base tributaria
    tributable:           t.tributable||0
    // NO enviar: total_aportes, total_cotizaciones, costo_laboral
    // Son GENERATED ALWAYS AS STORED en PostgreSQL
  };
}

function sbGetTrabajadoresRrhh(reporteId, cb){
  sbGet(
    'reporte_rrhh_trabajadores?reporte_id=eq.'+encodeURIComponent(reporteId)
    +'&select=*&order=apellido_paterno.asc,nombres.asc'
  ).then(function(rows){cb(rows||[]);}).catch(function(){cb([]);});
}

function sbReplaceTrabajadoresRrhh(reporteId, clienteRut, periodo, trabajadores, revision){
  // revision: número de versión RRHH. Default 1. NUNCA eliminar revisiones anteriores.
  revision = revision || 1;
  // Validar antes de cualquier escritura
  if(!reporteId || !clienteRut || !periodo){
    return Promise.reject(new Error('sbReplaceTrabajadoresRrhh: reporteId, clienteRut y periodo son requeridos'));
  }
  if(!Array.isArray(trabajadores) || !trabajadores.length){
    return Promise.reject(new Error('sbReplaceTrabajadoresRrhh: trabajadores debe ser un array no vacío'));
  }

  // Construir rows ANTES de borrar — si falla el mapeo no hay DELETE
  var rows;
  try{
    rows = trabajadores.map(function(t){
      return sbTrabajadorRrhhToRow(t, reporteId, clienteRut, periodo, revision);
    });
  }catch(mapErr){
    return Promise.reject(new Error('sbReplaceTrabajadoresRrhh: error al mapear trabajadores — '+mapErr.message));
  }

  // DELETE SOLO la revisión actual (NUNCA borrar otras revisiones)
  return sbFetch(
    'reporte_rrhh_trabajadores?reporte_id=eq.'+encodeURIComponent(reporteId)
    +'&revision=eq.'+encodeURIComponent(revision),
    {method:'DELETE'}
  ).then(function(delRes){
    if(!delRes.ok){
      return Promise.reject(new Error('DELETE trabajadores rev'+revision+' falló: HTTP '+delRes.status));
    }
    // INSERT trabajadores con la revisión correspondiente
    return sbPost('reporte_rrhh_trabajadores', rows, 'return=representation');
  }).then(function(inserted){
    if(!inserted){
      return Promise.reject(new Error('INSERT trabajadores rev'+revision+' falló — sin respuesta de Supabase'));
    }
    return inserted;
  });
}

// Fotografiar consolidado RRHH en reporte_rrhh_versiones antes de reprocesar
function sbFotografiarVersionRrhh(r, revision, motivo, usuario){
  var row={
    reporte_id:         r.id,
    revision:           revision||1,
    cliente_rut:        r.rut||r.cliente_rut||null,
    periodo:            r.periodo||null,
    n_trabajadores:     r.nTrab||r.n_trabajadores||0,
    total_imponible:    r.totalImponible||r.total_imponible||0,
    total_no_imponible: r.totalNoImponible||r.total_no_imponible||0,
    liquido_pagar:      r.liquidoPagar||r.liquido_pagar||0,
    afp:                r.afp||0, salud:r.salud||0, apv:r.apv||0,
    ces_trab:           r.cesTrab||r.ces_trab||0,
    iu:                 r.iu||0,
    sis:                r.sis||0, mutual:r.mutual||0, ces_emp:r.cesEmp||r.ces_emp||0,
    cap_ind:            r.capInd||r.cap_ind||0,
    exp_vida:           r.expVida||r.exp_vida||0,
    rent_prot:          r.rentProt||r.rent_prot||0,
    total_aportes:      r.totalAportes||r.total_aportes||0,
    total_cotizaciones: r.totalCotizaciones||r.total_cotizaciones||r.totalCot||0,
    costo_laboral:      r.costoLaboral||r.costo_laboral||0,
    estado:             r.estado||null,
    decision_cotiz:     r.decisionCotiz||r.decision_cotiz||null,
    ha_postergado:      r.haPostergado||r.ha_postergado||false,
    archivo_nombre:     r.archivoNombre||r.archivo_nombre||null,
    creado_at:          new Date().toISOString(),
    creado_por:         usuario||null,
    motivo_reproceso:   motivo||null
  };
  return sbPost('reporte_rrhh_versiones', row, 'return=representation');
}

// ── UTILIDADES ───────────────────────────────────────────────
function sbNormRut(rut){
  if(!rut) return '';
  var s=String(rut).replace(/[.\-\s]/g,'').toUpperCase();
  if(s.length<2) return rut;
  return s.slice(0,-1).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+'-'+s.slice(-1);
}

console.log('✅ supabase.js v3 · Gestoor');

// ── SUPABASE AUTH SDK ────────────────────────────────────────────────────────
// Carga el SDK oficial de Supabase para autenticación real.
// No interfiere con sbFetch/sbGet/sbPatch existentes (que usan anon key + fetch directo).
// Los módulos actuales siguen funcionando sin cambios.
(function(){
  if(window._sbAuthReady) return;
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
  s.crossOrigin='anonymous';
  s.onload=function(){
    // window.supabase = el objeto del CDN; distinto de este archivo
    window._sbAuthClient=window.supabase.createClient(SB_URL,SB_KEY,{
      auth:{
        autoRefreshToken:true,
        persistSession:true,
        detectSessionInUrl:true
      }
    });
    window._sbAuthReady=true;
    window.dispatchEvent(new Event('gestoor-auth-ready'));
  };
  s.onerror=function(){
    console.error('[Gestoor Auth] Error al cargar Supabase SDK. Verifique conexión.');
  };
  document.head.appendChild(s);
})();
