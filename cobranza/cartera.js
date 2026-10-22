/* ============================================================
   cobranza/cartera.js — Cobranza C1 · cartera por cliente (pantalla v1)
   Conectada SOLO a lo que expone la migración 202610201630_cobranza_c1 (backend en producción, main 49ca3629):
     RPC   cobranza_yo · cobranza_estado_cuenta · cobranza_indicadores (solo Master) · cobranza_movimientos_sugeridos ·
           cobranza_pago_registrar (Cobranza/Leandro, Pagos, Master) · cobranza_repactacion_solicitar (Cobranza o Master) ·
           cobranza_repactacion_validar (solo Master)
     Tablas (solo lectura, RLS cob_puede_leer = Master, Cobranza, Pagos): cobranza_documentos · cobranza_clientes ·
           cobranza_repactaciones · cobranza_pausas · cobranza_tareas · cobranza_pagos · cobranza_avisos · cobranza_gestiones
     clientes (solo nombre y RUT; la RLS de clientes decide qué ve cada persona) · cobte_cartera_nombres (backend COBTE-NOMBRES:
           razón social y RUT de la cartera para el Master y los gestores de cobranza, p. ej. Leandro; el servidor valida el permiso)
   Reglas: el estado del cliente (al día, mora, riesgo, suspensión programada…) lo calcula el MOTOR en el servidor; la pantalla
   solo lo muestra. MODO PRUEBA hasta el 31-12-2026: no se envían avisos ni se suspende (esta pantalla no envía nada).
   Modo demostración: cartera-demo.js (solo ?demo=1 en localhost).
   ============================================================ */
(function(){
'use strict';
var G=window.GC, esc=G.esc, clp=G.clp, clpT=G.clpT, I=G.I, $=G.$;
var DEMO=window.GC_DEMO===true&&G.LOCAL&&!!window.COB_DEMO_API;

/* ── Errores del motor → mensajes claros ── */
var ERR={
  SIN_SESION:'No hay una sesión activa en Gestoor.',SIN_PERMISO:'Tu usuario no tiene acceso a Cobranza (Master, Cobranza o Pagos).',
  SOLO_PAGOS:'Solo Cobranza (Leandro), Pagos o el Master registran pagos.',SOLO_COBRANZA:'Solo Cobranza o el Master pueden hacer esta acción.',
  SOLO_MASTER:'Solo el Master puede hacer esta acción.',CLIENTE_NO_EXISTE:'El cliente no existe.',
  FECHA_PAGO_INVALIDA:'La fecha del pago no es válida (desde el 01-01-2026 y nunca futura).',ABONO_INVALIDO:'El abono no es válido.',
  APLICACIONES_INVALIDAS:'Revisa los documentos y montos del pago.',PAGO_VACIO:'Indica al menos un documento o un abono.',
  DOCUMENTO_REPETIDO:'Un documento aparece dos veces.',CLAVE_IDEM_USADA:'Este pago ya se registró con otros datos. Cierra la ventana y vuelve a abrirla.',
  DOCUMENTO_INVALIDO:'Un documento no es de este cliente.',DOCUMENTO_NO_COBRABLE:'Un documento ya no está pendiente (recarga la cartera).',
  SUPERA_SALDO_DOCUMENTO:'El monto supera el saldo del documento.',TRABAJOS_ESPECIALES_NO_INSTALADO:'Trabajos especiales no está instalado.',
  MOVIMIENTO_NO_EXISTE:'El ingreso de la cartola no existe.',MOVIMIENTO_NO_DISPONIBLE:'El ingreso de la cartola ya no está disponible.',
  MOVIMIENTO_SIN_CLIENTE:'Asigna primero el ingreso al cliente en Conciliación.',MOVIMIENTO_DE_OTRO_CLIENTE:'El ingreso es de otro cliente.',
  SUPERA_SALDO_MOVIMIENTO:'El pago supera el saldo del ingreso de la cartola.',FECHA_DISTINTA_AL_MOVIMIENTO:'La fecha debe ser la del ingreso de la cartola.',
  CUOTA_YA_PAGADA:'Trabajos especiales indica que la cuota ya estaba pagada; no se registró nada.',SIN_FACTURA:'La cuota de trabajo especial no tiene factura emitida; no se registró nada.',
  TRABAJO_CERRADO:'El trabajo especial está cerrado; no se registró nada.',
  CUOTAS_INVALIDAS:'La repactación es de 2 o 3 cuotas.',CLIENTE_EN_TERMINO:'El cliente está en término: decide el Master.',
  REPACTACION_ACTIVA:'El cliente ya tiene una repactación en curso.',SIN_DEUDA_VENCIDA:'No hay deuda vencida para repactar (las cuotas de trabajos especiales no se repactan).',
  DECISION_OBLIGATORIA:'Falta la decisión.',REPACTACION_NO_EXISTE:'La repactación no existe.',REPACTACION_NO_EN_VALIDACION:'La repactación ya no está en validación.',
  MOTIVO_OBLIGATORIO:'Escribe un motivo de al menos 10 caracteres.',FECHA_FUTURA:'La fecha no puede ser futura.'
};
function mErr(e){return G.msgError(e,ERR);}

/* ── Acceso a datos (real con JWT del usuario, o demostración local) ── */
var A=G.API;
function enLotes(ids,tam){var r=[];for(var i=0;i<ids.length;i+=tam)r.push(ids.slice(i,i+tam));return r;}
var REAL={
  yo:function(){return A.rpc('cobranza_yo');},
  cartera:function(yo){
    var hoy=G.hoyCL(), mes=hoy.slice(0,8)+'01';
    return Promise.all([
      A.get('cobranza_documentos?select=id,cliente_id,origen,folio,periodo,concepto,cuota_n,cuotas_total,fecha_emision,fecha_vencimiento,monto,pagado,rebajado,saldo,estado,te_cuota_id,ref_externa&estado=in.(PENDIENTE,CASTIGADO)&order=fecha_vencimiento.asc,id.asc&limit=5000'),
      A.get('cobranza_clientes?select=cliente_id,estado,estado_desde,deuda_desde,suspendido,suspension_desde,suspension_sugerida_desde,en_termino,ultima_evaluacion&limit=5000'),
      A.get('cobranza_repactaciones?select=id,cliente_id,estado,canal,n_cuotas,monto_total,monto_cuota,monto_ultima,pie_vence,validacion_limite,solicitada_dia,pie_pagado,nota&estado=in.(EN_VALIDACION,APROBADA,VIGENTE)&order=solicitada_at.asc'),
      A.get('cobranza_pausas?select=id,cliente_id,tipo,origen,hasta,compromiso_fecha,compromiso_monto&terminada_at=is.null&hasta=gte.'+hoy),
      A.get('cobranza_tareas?select=id,cliente_id,tipo,plazo,creada_at&estado=eq.ABIERTA&order=plazo.asc&limit=200'),
      A.get('cobranza_pagos?select=monto&estado=eq.VIGENTE&fecha_pago=gte.'+mes+'&limit=5000')
    ]).then(function(r){
      var ids={};r[0].forEach(function(d){ids[d.cliente_id]=1;});r[1].forEach(function(c){ids[c.cliente_id]=1;});
      r[2].forEach(function(x){ids[x.cliente_id]=1;});r[4].forEach(function(x){ids[x.cliente_id]=1;});
      return REAL.nombres(Object.keys(ids),yo).then(function(nom){
        return {documentos:r[0],clientes:r[1],repactaciones:r[2],pausas:r[3],tareas:r[4],pagosMes:r[5],nombres:nom.nombres,ruts:nom.ruts};
      });
    });
  },
  // Nombres y RUT. (1) La RLS de clientes decide qué ve cada persona (Pagos ve todos; un analista solo los suyos). (2) Si el servidor dice
  // que es gestor de cobranza o Master (cobranza_yo.puede_gestionar), cobte_cartera_nombres completa razón social y RUT de TODA la cartera
  // (la función vuelve a validar el permiso). Si la función aún no está instalada o falla, queda lo de (1) y el resto como "Cliente N.º".
  nombres:function(ids,yo){
    var m={},ruts={};
    function poner(id,n,rut){if(id==null)return;if(n)m[id]=n;if(rut)ruts[id]=rut;}
    var rls=!ids.length?Promise.resolve([]):Promise.all(enLotes(ids,150).map(function(l){
      return A.get('clientes?select=id,razon_social,rut&id=in.('+l.map(function(x){return encodeURIComponent(x);}).join(',')+')').catch(function(){return [];});
    })).then(function(rs){rs.forEach(function(r){(r||[]).forEach(function(c){poner(c.id,c.razon_social,c.rut);});});});
    var cartera=(yo&&yo.puede_gestionar)?A.rpc('cobte_cartera_nombres',{}).then(function(rs){(rs||[]).forEach(function(c){poner(c.cliente_id,c.razon_social,c.rut);});})
      .catch(function(e){console.warn('[cobranza] cobte_cartera_nombres no disponible; se usan solo los nombres visibles por la RLS de clientes.',e&&e.message);}):Promise.resolve();
    return Promise.all([rls,cartera]).then(function(){return {nombres:m,ruts:ruts};});
  },
  indicadores:function(){return A.rpc('cobranza_indicadores',{});},
  movimientos:function(){return A.rpc('cobranza_movimientos_sugeridos',{p_cliente_id:null});},
  avisos:function(){return A.get('cobranza_avisos?select=id,cliente_id,codigo,variante,es_gestion,dia,programado_para,estado,motivo_cancelacion,enviado_at&order=programado_para.desc&limit=200');},
  ficha:function(id){
    var q=encodeURIComponent(id);
    return Promise.all([
      A.rpc('cobranza_estado_cuenta',{p_cliente_id:Number(id)}),
      A.get('cobranza_pagos?select=id,fecha_pago,monto,monto_abono,referencia,estado,movimiento_id&cliente_id=eq.'+q+'&order=fecha_pago.desc,id.desc&limit=20'),
      A.get('cobranza_avisos?select=id,codigo,variante,es_gestion,dia,programado_para,estado,motivo_cancelacion,enviado_at&cliente_id=eq.'+q+'&order=programado_para.desc&limit=30'),
      A.get('cobranza_gestiones?select=id,tipo,dia,nota&cliente_id=eq.'+q+'&order=registrado_at.desc&limit=10'),
      A.get('cobranza_repactaciones?select=id,estado,n_cuotas,monto_total,monto_cuota,monto_ultima,pie_vence,solicitada_dia,pie_pagado,motivo_rechazo&cliente_id=eq.'+q+'&order=solicitada_at.desc&limit=5')
    ]).then(function(r){return {estado:r[0],pagos:r[1],avisos:r[2],gestiones:r[3],repactaciones:r[4]};});
  },
  pagoRegistrar:function(a){return A.rpc('cobranza_pago_registrar',a);},
  repactacionSolicitar:function(a){return A.rpc('cobranza_repactacion_solicitar',a);},
  repactacionValidar:function(a){return A.rpc('cobranza_repactacion_validar',a);}
};
var D=DEMO?window.COB_DEMO_API:REAL;

/* ── Catálogos de presentación ── */
var ETAPA={
  AL_DIA:{t:'Al día',c:'verde',s:'verde',e:'✅'},POR_VENCER:{t:'Por vencer',c:'cel',s:'ambar',e:'📅'},VENCIDO:{t:'En mora',c:'ambar',s:'ambar',e:'⏰'},
  RIESGO:{t:'Riesgo de suspensión',c:'naranja',s:'naranja',e:'⚠️'},SUSPENSION_PROGRAMADA:{t:'Suspensión programada',c:'rojo',s:'rojo',e:'🛑'},
  SUSPENDIDO:{t:'Suspendido',c:'rojo',s:'rojo',e:'⛔'},EN_TERMINO:{t:'En término',c:'gris',s:'lila',e:'📁'},
  SIN_EVALUAR:{t:'Sin evaluar',c:'gris',s:'gris',e:'⏳'}
};
var ORIGEN={MENSUALIDAD:'Mensualidad',SALDO_INICIAL:'Saldo inicial',TRABAJO_ESPECIAL:'Trabajo especial',CUOTA_REPACTACION:'Cuota de repactación'};
var REP={EN_VALIDACION:{t:'En validación (Master)',c:'ambar'},APROBADA:{t:'Aprobada · esperando el pie',c:'cel'},VIGENTE:{t:'Vigente',c:'verde'},
  CUMPLIDA:{t:'Cumplida',c:'verde'},INCUMPLIDA:{t:'Incumplida',c:'rojo'},RECHAZADA:{t:'Rechazada',c:'gris'},ANULADA:{t:'Anulada (pie no pagado)',c:'gris'}};
var AVISO={
  TRANSICION:['Aviso de transición','Estado de cuenta + 3 días hábiles sin acciones (deuda anterior al arranque)'],
  M1:['Recordatorio amable','Mes 1 · día 18, solo si no ha pagado'],V:['Factura vencida','Martes y jueves desde el día 22 (variantes V1–V4)'],
  RS:['Riesgo de suspensión','Martes y jueves desde el día 22 del mes 2 (RS1–RS3)'],M7:['Aviso de suspensión','Último día hábil del mes 2, 10:00'],
  SP:['Suspensión programada','Tras la revisión obligatoria de obligaciones'],M8:['Suspensión efectiva','Un solo aviso'],
  R4:['Repactación incumplida','Toda la deuda se acumula'],M9:['Término y aviso previo de derivación','Fin de la cadencia automática'],
  M10:['Reactivación','Al pagar o repactar'],P1:['Gracias por tu pago','Al confirmar el pago'],P5:['Pago parcial','Al confirmar un pago parcial'],
  P2:['"Ya transferí" recibido','Pausa de 3 días hábiles'],P3:['Compromiso de pago registrado','Pausa de recordatorios'],
  RQ:['Repactación solicitada','En validación del Master'],R2:['Repactación aprobada','Plan de cuotas'],RX:['Repactación rechazada','Con motivo'],
  RA:['Repactación anulada','El pie no se pagó a tiempo'],EC:['Estado de cuenta','A pedido'],D2:['Derivación confirmada','Bloqueada sin validación jurídica'],
  D3:['Aclaración del registro','Pagó después de derivado']
};
var AV_EST={PENDIENTE:{t:'En cola · no se envía',c:'ambar'},ENVIANDO:{t:'Enviando',c:'cel'},ENVIADO:{t:'Enviado',c:'verde'},FALLIDO:{t:'Fallido',c:'rojo'},
  CANCELADO:{t:'Cancelado',c:'gris'},EXPIRADO:{t:'Expirado',c:'gris'}};
var TAREA={LLAMAR_CLIENTE:'📞 Llamar al cliente',ACLARAR_DICOM:'🧾 Aclarar registro externo',REVISAR_OBLIGACIONES:'📋 Revisar obligaciones antes de suspender',REACTIVAR_CLIENTE:'🔓 Reactivar cliente'};
function chip(o,txt){return '<span class="estado '+(o?o.c:'gris')+'">'+esc(txt||(o?o.t:'—'))+'</span>';}

/* ── Estado de la pantalla ── */
var S={yo:null,datos:null,filas:[],tab:'cartera',filtro:'TODOS',buscar:'',ind:null,indErr:null,mov:null,movErr:null,avisos:null,avisosErr:null,hoy:G.hoyCL()};

function nombreCli(id){var n=S.datos&&S.datos.nombres[id];return n?n:'Cliente N.º '+id;}
function nombreVisible(id){return !!(S.datos&&S.datos.nombres[id]);}
function rutCli(id){return (S.datos&&S.datos.ruts&&S.datos.ruts[id])||'';}

/* Arma una fila por cliente con lo que viene del servidor (documentos + estado del motor). */
function armarFilas(){
  var d=S.datos, por={}, hoy=S.hoy;
  function fila(id){if(!por[id])por[id]={id:id,docs:[],deuda:0,vencido:0,tr:[0,0,0],nVenc:0,diasMora:null,prox:null,teDeuda:0,motor:null,rep:null,pausa:null,tareas:[]};return por[id];}
  d.documentos.forEach(function(x){
    if(!(x.saldo>0))return;
    var f=fila(x.cliente_id);f.docs.push(x);f.deuda+=Number(x.saldo);
    if(x.origen==='TRABAJO_ESPECIAL')f.teDeuda+=Number(x.saldo);
    var dd=G.dias(x.fecha_vencimiento,hoy);
    if(dd!=null&&dd>0){f.vencido+=Number(x.saldo);f.nVenc++;f.tr[dd<=30?0:dd<=60?1:2]+=Number(x.saldo);if(f.diasMora==null||dd>f.diasMora)f.diasMora=dd;}
    else if(!f.prox||x.fecha_vencimiento<f.prox)f.prox=x.fecha_vencimiento;
  });
  d.clientes.forEach(function(c){fila(c.cliente_id).motor=c;});
  d.repactaciones.forEach(function(r){fila(r.cliente_id).rep=r;});
  d.pausas.forEach(function(p){var f=fila(p.cliente_id);if(!f.pausa||p.origen==='COMPROMISO')f.pausa=p;});
  d.tareas.forEach(function(t){fila(t.cliente_id).tareas.push(t);});
  S.filas=Object.keys(por).map(function(k){var f=por[k];f.etapa=f.motor?f.motor.estado:'SIN_EVALUAR';f.nombre=nombreCli(f.id);return f;})
    .filter(function(f){return f.deuda>0||f.motor&&f.etapa!=='AL_DIA'||f.rep||f.tareas.length;});
  var orden={SUSPENSION_PROGRAMADA:0,SUSPENDIDO:1,RIESGO:2,VENCIDO:3,EN_TERMINO:4,POR_VENCER:5,SIN_EVALUAR:6,AL_DIA:7};
  S.filas.sort(function(a,b){return (orden[a.etapa]-orden[b.etapa])||(b.vencido-a.vencido)||(b.deuda-a.deuda);});
}

/* ── Carga ── */
function cargar(){
  return D.yo().then(function(yo){
    S.yo=yo;
    if(!yo||!yo.puede_leer){render();return;}
    return D.cartera(S.yo).then(function(d){S.datos=d;armarFilas();render();});
  }).catch(function(e){S.err=mErr(e);render();});
}
function recargar(msg){
  return D.cartera(S.yo).then(function(d){S.datos=d;armarFilas();S.mov=null;S.avisos=null;render();if(msg)G.toast(msg);});
}

/* ── Render principal ── */
function bannerPrueba(){
  var yo=S.yo||{}, hasta=yo.prueba_hasta?G.fFecha(yo.prueba_hasta):'31-12-2026';
  var auto=yo.modo==='AUTOMATICO';
  var tit=auto?'Modo AUTOMÁTICO'+(yo.terminos_contractuales_vigentes?'':': la suspensión sigue bloqueada sin términos contractuales vigentes')+(yo.envio_habilitado?'':' · envío de avisos deshabilitado'):'Modo prueba hasta el '+esc(hasta)+': no se envían avisos ni se suspende.';
  return '<div class="gc-prueba" role="note">'+I('escudo','ic-cel')+'<div><b>'+tit+'</b> '
    +(auto?'':'Los estados se calculan, pero suspender, terminar o derivar solo queda como sugerencia para el Master. ')
    +(yo.envio_habilitado?'':'El envío de avisos está <b>deshabilitado</b>. ')
    +(yo.arranque_fecha?'Motor en marcha desde el '+G.fFecha(yo.arranque_fecha)+'.':'El motor aún no arranca (sin fecha de arranque): los clientes aparecen como «Sin evaluar».')
    +'</div></div>';
}
function render(){
  var app=$('gcApp');
  if(S.err){app.innerHTML=bannerPruebaSeguro()+'<div class="aviso rojo">'+I('alerta','ic-roj')+'<span>No se pudo cargar Cobranza: '+esc(S.err)+'</span><button type="button" class="btn chico sec" data-act="recargar">Reintentar</button></div>';return;}
  if(!S.yo){return;}
  if(!S.yo.puede_leer){app.innerHTML=bannerPrueba()+'<div class="aviso ambar">'+I('candado','ic-amb')+'<span>Tu usuario no tiene acceso a Cobranza. La ven el Master, Cobranza (rol o módulo, p. ej. Leandro) y Pagos. Pide el módulo en Administración.</span></div>';return;}
  var h=bannerPrueba()+heroHtml()+navHtml();
  if(S.tab==='cartera')h+=carteraHtml();
  else if(S.tab==='movimientos')h+=movimientosHtml();
  else if(S.tab==='avisos')h+=avisosHtml();
  else if(S.tab==='validaciones')h+=validacionesHtml();
  else if(S.tab==='analisis')h+=analisisHtml();
  app.innerHTML=h;
}
function bannerPruebaSeguro(){try{return bannerPrueba();}catch(e){return '';}}

function heroHtml(){
  var f=S.filas, tot=0,venc=0,tr=[0,0,0],prox7=0,nProx7=0,riesgo=0,susp=0,teTot=0, hoy=S.hoy;
  f.forEach(function(x){tot+=x.deuda;venc+=x.vencido;tr[0]+=x.tr[0];tr[1]+=x.tr[1];tr[2]+=x.tr[2];teTot+=x.teDeuda;
    if(x.etapa==='RIESGO')riesgo++;if(x.etapa==='SUSPENSION_PROGRAMADA')susp++;
    x.docs.forEach(function(d){var dd=G.dias(hoy,d.fecha_vencimiento);if(dd!=null&&dd>=0&&dd<=7){prox7+=Number(d.saldo);nProx7++;}});});
  var reps=S.datos.repactaciones, repVal=reps.filter(function(r){return r.estado==='EN_VALIDACION';}).length,
      repVig=reps.filter(function(r){return r.estado!=='EN_VALIDACION';}), repMonto=repVig.reduce(function(s,r){return s+Number(r.monto_total);},0);
  var cobrado=S.datos.pagosMes.reduce(function(s,p){return s+Number(p.monto);},0);
  var pc=function(v){return venc>0?(100*v/venc).toFixed(1):0;};
  var fechaLarga=(function(){var p=hoy.split('-');var M=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];return Number(p[2])+' de '+M[Number(p[1])-1];})();
  return '<section class="card hero"><div class="gc-kicker">Cuentas por cobrar · servicios Contadoor</div>'
    +'<h2 class="gc-titulo">Cartera al <span>'+esc(fechaLarga)+'</span></h2>'
    +'<p class="nota">📅 Vence el día 21 (si es inhábil, el siguiente día hábil) · mora desde el día siguiente · riesgo desde el día 22 del mes 2 · suspensión programada el último día hábil del mes 2. Sin multas ni intereses.</p>'
    +'<div class="gc-kpis">'
    +'<div class="kpi acc-lila"><small>💰 Total por cobrar</small><b>'+clp(tot)+'</b><p>'+f.length+' cliente(s) con saldo'+(teTot?' · incluye '+clpT(teTot)+' de trabajos especiales':'')+'</p></div>'
    +'<div class="kpi acc-rojo"><small>⏰ Vencido por tramos</small><b>'+clp(venc)+'</b>'
      +'<div class="gc-tramos" role="img" aria-label="Vencido por tramos de días"><i class="tr1" style="width:'+pc(tr[0])+'%"></i><i class="tr2" style="width:'+pc(tr[1])+'%"></i><i class="tr3" style="width:'+pc(tr[2])+'%"></i></div>'
      +'<div class="gc-leyenda"><span><i class="tr1"></i>1–30 d '+clpT(tr[0])+'</span><span><i class="tr2"></i>31–60 d '+clpT(tr[1])+'</span><span><i class="tr3"></i>+60 d '+clpT(tr[2])+'</span></div></div>'
    +'<div class="kpi acc-ambar"><small>📅 Por vencer en 7 días</small><b>'+clp(prox7)+'</b><p>'+nProx7+' documento(s)</p></div>'
    +'<div class="kpi acc-naranja clic" data-act="filtro" data-f="RIESGO"><small>⚠️ Riesgo / suspensión programada</small><b>'+riesgo+' / '+susp+'</b><p>clientes · en prueba solo se sugiere</p></div>'
    +'<div class="kpi acc-cel clic" data-act="tab" data-tab="validaciones"><small>🤝 Repactaciones</small><b>'+repVig.length+(repVig.length===1?' vigente':' vigentes')+'</b><p>'+clpT(repMonto)+' en cuotas · '+repVal+' en validación</p></div>'
    +'<div class="kpi acc-verde"><small>✅ Cobrado este mes</small><b class="t-verde">'+clp(cobrado)+'</b><p>pagos confirmados por Cobranza desde el día 1</p></div>'
    +'<div class="kpi acc-lila clic" data-act="tab" data-tab="validaciones"><small>📋 Tareas abiertas</small><b>'+S.datos.tareas.length+'</b><p>reactivar, revisar obligaciones, llamar</p></div>'
    +'<div class="kpi acc-lila clic" data-act="tab" data-tab="analisis"><small>📈 Morosidad</small><b>'+(tot>0?G.pct(100*venc/tot):'<span class="nd">No disponible</span>')+'</b><p>vencido / total por cobrar (hoy)</p></div>'
    +'</div></section>';
}
function navHtml(){
  var val=S.datos.repactaciones.filter(function(r){return r.estado==='EN_VALIDACION';}).length+S.datos.tareas.length;
  var t=[['cartera','persona','Cartera por cliente',S.filas.length],['movimientos','banco','Pagos detectados en el banco',S.mov?S.mov.length:null],
    ['avisos','campana','Avisos que se enviarían',null],['validaciones','aprobar','Validaciones y tareas',val],['analisis','grafico','Análisis',null]];
  return '<nav class="gc-nav" aria-label="Secciones de Cobranza">'+t.map(function(x){
    return '<button type="button" class="sn'+(S.tab===x[0]?' on':'')+'" data-act="tab" data-tab="'+x[0]+'"'+(S.tab===x[0]?' aria-current="page"':'')+'>'+I(x[1])+esc(x[2])+(x[3]!=null?'<span class="cnt">'+x[3]+'</span>':'')+'</button>';
  }).join('')+'</nav>';
}

/* ── Pestaña: cartera por cliente ── */
var FILTROS=[['TODOS','Todos'],['AL_DIA','Al día'],['POR_VENCER','Por vencer'],['VENCIDO','En mora'],['RIESGO','Riesgo'],['SUSPENSION_PROGRAMADA','Suspensión programada'],
  ['SUSPENDIDO','Suspendido'],['EN_TERMINO','En término'],['REPACTACION','Repactación'],['SIN_EVALUAR','Sin evaluar']];
function pasaFiltro(f){
  if(S.filtro==='REPACTACION'&&!f.rep)return false;
  if(S.filtro!=='TODOS'&&S.filtro!=='REPACTACION'&&f.etapa!==S.filtro)return false;
  if(S.buscar){var q=S.buscar.toLowerCase(),qr=q.replace(/[.\s]/g,''),r=rutCli(f.id).toLowerCase().replace(/\./g,'');if(f.nombre.toLowerCase().indexOf(q)<0&&String(f.id)!==q&&!(qr&&r&&r.indexOf(qr)>=0))return false;}
  return true;
}
function carteraHtml(){
  var cnt={};S.filas.forEach(function(f){cnt[f.etapa]=(cnt[f.etapa]||0)+1;if(f.rep)cnt.REPACTACION=(cnt.REPACTACION||0)+1;});cnt.TODOS=S.filas.length;
  var lista=S.filas.filter(pasaFiltro);
  var h='<section class="card"><div class="h"><h2>Cartera <span>por cliente</span></h2><input type="search" class="gc-buscar der" id="gcBuscar" placeholder="Buscar cliente…" value="'+esc(S.buscar)+'" aria-label="Buscar cliente"></div>'
    +'<div class="gc-filtros" role="group" aria-label="Filtrar por etapa">'+FILTROS.filter(function(x){return x[0]==='TODOS'||cnt[x[0]];}).map(function(x){
      return '<button type="button" class="f'+(S.filtro===x[0]?' on':'')+'" data-act="filtro" data-f="'+x[0]+'" aria-pressed="'+(S.filtro===x[0])+'">'+esc(x[1])+' <span class="cnt">'+(cnt[x[0]]||0)+'</span></button>';}).join('')+'</div>';
  if(!lista.length){
    h+='<div class="gc-vacio">'+(S.filas.length?'Ningún cliente en este filtro.':'🎉 No hay deuda registrada en Cobranza. Las facturas entran cuando Facturación las emite en producción (y el saldo inicial cuando el Master lo carga).')+'</div></section>';
    return h;
  }
  h+='<div class="tabla-box gc-tabla-d"><table class="gt"><thead><tr><th>Cliente</th><th class="num">Docs.</th><th class="num">Deuda total</th><th class="num">Vencido</th><th class="num">Días de mora</th><th>Próx. vencimiento</th><th>Compromiso / repactación</th><th>Etapa</th></tr></thead><tbody>';
  lista.forEach(function(f){
    var e=ETAPA[f.etapa]||ETAPA.SIN_EVALUAR, borde={rojo:'borde-rojo',naranja:'borde-naranja',ambar:'borde-ambar'}[e.c]||'';
    h+='<tr class="clic '+borde+'" data-act="ficha" data-id="'+esc(f.id)+'" tabindex="0">'
      +'<td class="cli"><b>'+esc(f.nombre)+'</b>'+(nombreVisible(f.id)?(rutCli(f.id)?'<span class="sub">RUT '+esc(rutCli(f.id))+'</span>':''):'<span class="sub">Nombre no visible con tu permiso</span>')+(f.pausa?'<span class="sub">'+I('pausa','ic-amb')+' '+(f.pausa.origen==='COMPROMISO'?'Compromiso hasta '+G.fFecha(f.pausa.hasta):'Recordatorios en pausa hasta '+G.fFecha(f.pausa.hasta))+'</span>':'')+'</td>'
      +'<td class="num">'+f.docs.length+'</td><td class="num"><b>'+clp(f.deuda)+'</b></td>'
      +'<td class="num '+(f.vencido>0?'t-ambar':'t3')+'">'+clp(f.vencido)+'</td>'
      +'<td class="num">'+(f.diasMora!=null?'<b class="'+(f.diasMora>60?'t-rojo':f.diasMora>30?'t-ambar':'')+'">'+f.diasMora+' d</b><span class="sub">'+f.nVenc+' doc. vencido(s)</span>':'<span class="t3">—</span>')+'</td>'
      +'<td>'+(f.prox?G.fFecha(f.prox)+'<span class="sub">en '+G.dias(S.hoy,f.prox)+' d</span>':'<span class="t3">—</span>')+'</td>'
      +'<td>'+(f.rep?chip(REP[f.rep.estado]):(f.pausa&&f.pausa.origen==='COMPROMISO'?'<span class="estado cel">'+clpT(f.pausa.compromiso_monto)+' al '+G.fFecha(f.pausa.compromiso_fecha)+'</span>':'<span class="t3">—</span>'))+'</td>'
      +'<td><span class="estado sin '+e.c+'">'+e.e+' '+esc(e.t)+'</span>'+(f.motor&&f.motor.suspension_sugerida_desde?'<span class="sub">Sugerencia al Master: suspender</span>':'')+'</td></tr>';
  });
  h+='</tbody></table></div><div class="gc-lista-m">';
  lista.forEach(function(f){
    var e=ETAPA[f.etapa]||ETAPA.SIN_EVALUAR;
    h+='<button type="button" class="gc-fila-m" data-act="ficha" data-id="'+esc(f.id)+'"><div class="l1"><b>'+esc(f.nombre)+'</b><span class="estado sin '+e.c+'">'+e.e+' '+esc(e.t)+'</span></div>'
      +'<div class="l2"><span>Deuda <b>'+clpT(f.deuda)+'</b></span><span>Vencido <b class="'+(f.vencido>0?'t-ambar':'')+'">'+clpT(f.vencido)+'</b></span>'
      +(f.diasMora!=null?'<span>Mora <b>'+f.diasMora+' d</b></span>':'')+(f.rep?'<span>🤝 '+esc(REP[f.rep.estado].t)+'</span>':'')+'</div></button>';
  });
  h+='</div><p class="nota">Los días de mora y el vencido se muestran según la fecha de vencimiento del documento. La etapa (y si el vencimiento corre al siguiente día hábil por feriado) la decide el motor de Cobranza en el servidor.</p></section>';
  return h;
}

/* ── Ficha del cliente (estado de cuenta consolidado) ── */
function abrirFicha(id){
  var f=S.filas.find(function(x){return String(x.id)===String(id);});
  G.abrirDet('<div class="aviso lila"><span class="gc-spin"></span>Cargando el estado de cuenta…</div>');
  D.ficha(id).then(function(x){G.$('gcDetCuerpo').innerHTML=fichaHtml(id,f,x);pintar(G.$('gcDetCuerpo'));})
   .catch(function(e){G.$('gcDetCuerpo').innerHTML='<div class="aviso rojo">'+I('alerta','ic-roj')+'<span>'+esc(mErr(e))+'</span></div>';});
}
function fichaHtml(id,f,x){
  var yo=S.yo, ec=x.estado||{}, mot=f?f.motor:(S.datos.clientes.find(function(c){return String(c.cliente_id)===String(id);})||null), e=ETAPA[f?f.etapa:(mot?mot.estado:'SIN_EVALUAR')]||ETAPA.SIN_EVALUAR;
  var h='<div class="det-cab"><small>Ficha de cobranza'+(rutCli(id)?' · RUT '+esc(rutCli(id)):'')+'</small><h3>'+esc(nombreCli(id))+'</h3><span class="estado sin '+e.c+'">'+e.e+' '+esc(e.t)+'</span>'
    +(mot&&mot.estado_desde?' <span class="t3" style="font-size:12px">desde el '+G.fFecha(mot.estado_desde)+'</span>':'')+'</div>';
  h+='<div class="gc-tri"><div><small>💰 Deuda</small><b>'+clp(ec.total_deuda)+'</b></div><div><small>⏰ Vencido</small><b class="t-ambar">'+clp(ec.total_vencido)+'</b></div><div><small>🎁 Abonos</small><b class="t-verde">'+clp(ec.total_abonos)+'</b></div></div>';
  h+='<div class="cl fin"><span>Total a pagar (deuda − abonos)</span><b>'+clp(ec.total)+'</b></div>';
  var acc='';
  if(yo.puede_registrar_pagos)acc+='<button type="button" class="btn verde" data-act="pago" data-id="'+esc(id)+'">'+I('moneda')+'Registrar pago</button>';
  if(yo.puede_gestionar&&!(f&&f.rep))acc+='<button type="button" class="btn sec" data-act="repactar" data-id="'+esc(id)+'">🤝 Solicitar repactación</button>';
  if(acc)h+='<div class="acciones">'+acc+'</div>';
  else h+='<p class="nota">Tu permiso es de solo lectura en Cobranza.</p>';
  // Documentos por tipo
  h+='<section><h4>🧾 Estado de cuenta consolidado</h4>';
  var grupos=ec.grupos||[];
  if(!grupos.length)h+='<div class="gc-vacio">Sin documentos pendientes.</div>';
  grupos.forEach(function(g){
    h+='<div class="tabla-box"><table class="gt"><thead><tr><th colspan="2">'+esc(g.titulo)+'</th><th class="num">Saldo</th></tr></thead><tbody>';
    (g.lineas||[]).forEach(function(l){
      h+='<tr><td>'+(l.vencido?'<span class="gc-semaforo sem-rojo" title="Vencido"></span>':'<span class="gc-semaforo sem-verde" title="Por vencer"></span>')+'</td><td>'+esc(l.concepto)
        +'<span class="sub">'+(l.folio?'Folio '+esc(l.folio)+' · ':'')+(l.periodo?'Período '+esc(l.periodo)+' · ':'')+(l.cuota?'Cuota '+esc(l.cuota)+' · ':'')+'vence '+G.fFecha(l.vencimiento)+(l.rebajado_nc>0?' · NC '+clpT(l.rebajado_nc):'')+'</span></td>'
        +'<td class="num"><b class="'+(l.vencido?'t-ambar':'')+'">'+clp(l.monto)+'</b></td></tr>';
    });
    h+='<tr class="tot"><td></td><td>Subtotal</td><td class="num">'+clp(g.subtotal)+'</td></tr></tbody></table></div>';
  });
  if((ec.notas_credito||[]).length)h+='<p class="nota">Notas de crédito (180 días): '+ec.notas_credito.map(function(n){return 'NC '+esc(n.folio_nc)+' '+clpT(n.monto);}).join(' · ')+'</p>';
  if(ec.comentario_transferencia)h+='<p class="nota">💬 Comentario sugerido para la transferencia: «'+esc(ec.comentario_transferencia)+'»</p>';
  h+='</section>';
  // Repactaciones
  if((x.repactaciones||[]).length){
    h+='<section><h4>🤝 Repactaciones</h4>'+x.repactaciones.map(function(r){
      return '<div class="cl"><span>'+chip(REP[r.estado])+' '+r.n_cuotas+' cuotas · pie '+clpT(r.monto_cuota)+(r.estado==='EN_VALIDACION'||r.estado==='APROBADA'?' (vence '+G.fFecha(r.pie_vence)+')':'')+(r.motivo_rechazo?'<br><small class="t3">'+esc(r.motivo_rechazo)+'</small>':'')+'</span><b>'+clp(r.monto_total)+'</b></div>';}).join('')+'</section>';
  }
  // Pagos
  h+='<section><h4>✅ Pagos registrados</h4>';
  if(!(x.pagos||[]).length)h+='<p class="t3">Sin pagos registrados en Cobranza.</p>';
  else h+=x.pagos.map(function(p){return '<div class="cl"><span>'+G.fFecha(p.fecha_pago)+(p.referencia?' · '+esc(p.referencia):'')+(p.movimiento_id?' · desde la cartola':'')+(p.monto_abono>0?' · abono '+clpT(p.monto_abono):'')+(p.estado==='ANULADO'?' <span class="estado gris">Anulado</span>':'')+'</span><b class="'+(p.estado==='ANULADO'?'t3':'t-verde')+'">'+clp(p.monto)+'</b></div>';}).join('');
  h+='</section>';
  // Avisos que se enviarían
  h+='<section><h4>🔔 Avisos de este cliente (cola)</h4>'+(S.yo.envio_habilitado?'':'<div class="aviso cel">'+I('info','ic-cel')+'<span>Envío deshabilitado (modo prueba): ningún aviso sale al cliente.</span></div>');
  if(!(x.avisos||[]).length)h+='<p class="t3">Aún no hay avisos en cola para este cliente.</p>';
  else h+='<ul class="gc-tl">'+x.avisos.map(function(a){var n=AVISO[a.codigo]||[a.codigo,''],est=AV_EST[a.estado]||{t:a.estado,c:'gris'};
    return '<li style="--c:var(--'+(est.c==='verde'?'verde':est.c==='rojo'?'rojo':est.c==='ambar'?'ambar':'t3')+')"><b>'+esc(n[0])+(a.variante>1?' (variante '+a.variante+')':'')+'</b> '+chip(est)+'<small>'+G.fHora(a.programado_para)+(a.motivo_cancelacion?' · '+esc(a.motivo_cancelacion):'')+(a.es_gestion?' · cuenta para la Ley 21.320':'')+'</small></li>';}).join('')+'</ul>';
  h+='</section>';
  if((x.gestiones||[]).length){
    var GT={LLAMADA:'📞 Llamada',WHATSAPP_MANUAL:'💬 WhatsApp manual',NOTA:'📝 Nota',YA_TRANSFERI:'🏦 "Ya transferí"'};
    h+='<section><h4>🗂️ Últimas gestiones</h4>'+x.gestiones.map(function(g){return '<div class="cl"><span>'+esc(GT[g.tipo]||g.tipo)+(g.nota?' · '+esc(g.nota):'')+'</span><span>'+G.fFecha(g.dia)+'</span></div>';}).join('')+'</section>';
  }
  return h;
}

/* ── Registrar pago (Cobranza/Leandro, Pagos o Master) con confirmación ── */
function abrirPago(id,mov){
  var f=S.filas.find(function(x){return String(x.id)===String(id);});
  var docs=(f?f.docs:[]).filter(function(d){return d.saldo>0;});
  var clave=G.uuid();   // misma clave mientras la ventana esté abierta: un doble clic o reintento no duplica el pago
  var paso=1;
  var html='<p>Cliente: <b>'+esc(nombreCli(id))+'</b>'+(mov?'<br>Ingreso de la cartola del '+G.fFecha(mov.fecha)+' por '+clpT(mov.saldo!=null?mov.saldo:mov.monto)+(mov.nombre_origen?' · '+esc(mov.nombre_origen):''):'')+'</p>'
    +'<div id="gcPagoP1"><p class="t2" style="font-size:12.5px">Marca los documentos que paga y ajusta el monto si el pago es parcial. Lo más antiguo primero.</p>'
    +(docs.length?docs.map(function(d,i){
      var pre=mov?(mov.propuesta||[]).find(function(p){return String(p.documento_id)===String(d.id);}):null, chk=mov?!!pre:i===0, val=pre?pre.monto:d.saldo;
      return '<label class="gc-apl"><input type="checkbox" data-doc="'+esc(d.id)+'"'+(chk?' checked':'')+'><span>'+esc(ORIGEN[d.origen]||d.origen)+(d.folio?' · folio '+esc(d.folio):'')+(d.periodo?' · '+esc(d.periodo):'')+(d.cuota_n?' · cuota '+d.cuota_n+' de '+d.cuotas_total:'')
        +'<br><small class="t3">Saldo '+clpT(d.saldo)+' · vence '+G.fFecha(d.fecha_vencimiento)+'</small></span><input type="number" min="1" max="'+esc(d.saldo)+'" step="1" value="'+esc(val)+'" data-monto="'+esc(d.id)+'" aria-label="Monto a aplicar"></label>';
    }).join(''):'<div class="gc-vacio">Este cliente no tiene documentos pendientes. Puedes registrar el pago como abono (saldo a favor).</div>')
    +'<div class="campos2"><label class="campo"><span>Fecha del pago</span><input type="date" id="gcPFecha" value="'+esc(mov?mov.fecha:S.hoy)+'" max="'+esc(S.hoy)+'" min="2026-01-01"'+(mov?' readonly':'')+'></label>'
    +'<label class="campo"><span>Abono (saldo a favor, opcional)</span><input type="number" id="gcPAbono" min="0" step="1" value="0"></label></div>'
    +'<label class="campo"><span>Referencia (opcional)</span><input type="text" id="gcPRef" maxlength="200" placeholder="N.º de operación o comentario"></label>'
    +'<div class="gc-resumen" id="gcPTot"></div></div>'
    +'<div id="gcPagoP2" hidden></div>';
  G.modal({titulo:'💵 Registrar pago',html:html,ok:'Revisar y confirmar',okClase:'verde',
    alAbrir:function(m){
      function tot(){var r=leerPago(m);m.querySelector('#gcPTot').innerHTML='Total del pago: <b>'+clpT(r.total)+'</b> · '+r.apl.length+' documento(s)'+(r.abono>0?' + abono '+clpT(r.abono):'');}
      m.addEventListener('input',tot);m.addEventListener('change',tot);tot();
    },
    alAceptar:function(m){
      var r=leerPago(m), si=m.querySelector('[data-m="si"]');
      if(paso===1){
        if(r.error)throw new Error(r.error);
        if(mov&&r.total>Number(mov.saldo!=null?mov.saldo:mov.monto))throw new Error('El pago supera el saldo del ingreso de la cartola ('+clpT(mov.saldo)+').');
        paso=2;m.querySelector('#gcPagoP1').hidden=true;var p2=m.querySelector('#gcPagoP2');p2.hidden=false;
        p2.innerHTML='<div class="gc-resumen"><div class="cl"><span>Cliente</span><b>'+esc(nombreCli(id))+'</b></div><div class="cl"><span>Fecha</span><b>'+G.fFecha(r.fecha)+'</b></div>'
          +r.apl.map(function(a){var d=docs.find(function(z){return String(z.id)===String(a.documento_id);});return '<div class="cl"><span>'+esc(d?(ORIGEN[d.origen]||d.origen)+(d.folio?' · folio '+d.folio:''):'Documento')+'</span><b>'+clpT(a.monto)+'</b></div>';}).join('')
          +(r.abono>0?'<div class="cl"><span>Abono (saldo a favor)</span><b>'+clpT(r.abono)+'</b></div>':'')+'<div class="cl fin"><span>Total</span><b>'+clpT(r.total)+'</b></div></div>'
          +'<label class="chk"><input type="checkbox" id="gcPConf"><span>Confirmo que este pago está en la cartola de Contadoor. Registrarlo lo deja <b>confirmado</b> (si salda una cuota de un trabajo especial, se informa a Trabajos especiales).</span></label>'
          +'<p class="nota">En modo prueba no se envía el aviso de "gracias por tu pago": queda en cola.</p>';
        si.textContent='Registrar pago confirmado';return false;
      }
      if(!m.querySelector('#gcPConf').checked)throw new Error('Marca la confirmación para registrar el pago.');
      return D.pagoRegistrar({p_cliente_id:Number(id),p_fecha_pago:r.fecha,p_aplicaciones:r.apl,p_clave_idem:clave,p_movimiento_id:mov?Number(mov.movimiento_id):null,p_referencia:r.ref||null,p_abono:r.abono})
        .then(function(res){G.cerrarDet();recargar(res&&res.resultado==='existente'?'Ese pago ya estaba registrado (no se duplicó).':'Pago registrado y confirmado por '+clpT(res&&res.monto));return true;})
        .catch(function(e){throw new Error(mErr(e));});
    }});
}
function leerPago(m){
  var apl=[],err=null;
  m.querySelectorAll('input[data-doc]').forEach(function(c){
    if(!c.checked)return;var id=c.getAttribute('data-doc'),inp=m.querySelector('input[data-monto="'+id+'"]'),v=Number(inp.value),mx=Number(inp.getAttribute('max'));
    if(!(v>0)||Math.floor(v)!==v)err='Cada monto debe ser un número entero mayor que 0.';else if(v>mx)err='Un monto supera el saldo del documento.';
    apl.push({documento_id:Number(id),monto:v});
  });
  var abono=Number(m.querySelector('#gcPAbono').value||0),fecha=m.querySelector('#gcPFecha').value,ref=m.querySelector('#gcPRef').value.trim();
  if(!(abono>=0)||Math.floor(abono)!==abono)err='El abono debe ser un número entero (0 si no hay).';
  if(!apl.length&&!(abono>0))err=err||'Marca al menos un documento o indica un abono.';
  if(!fecha||fecha>S.hoy||fecha<'2026-01-01')err=err||'La fecha del pago no puede ser futura ni anterior al 01-01-2026.';
  var total=apl.reduce(function(s,a){return s+(a.monto||0);},0)+(abono>0?abono:0);
  return {apl:apl,abono:abono>0?abono:0,fecha:fecha,ref:ref,total:total,error:err};
}

/* ── Repactación: máx. 3 cuotas, pie inmediato, validación del Master ── */
function abrirRepactar(id){
  var f=S.filas.find(function(x){return String(x.id)===String(id);});
  var rep=(f?f.docs:[]).filter(function(d){return d.estado==='PENDIENTE'&&d.origen!=='TRABAJO_ESPECIAL'&&G.dias(d.fecha_vencimiento,S.hoy)>0;});
  var total=rep.reduce(function(s,d){return s+Number(d.saldo);},0);
  function plan(n){var c=Math.floor(total/n),u=total-c*(n-1);return {c:c,u:u};}
  var html='<p>Cliente: <b>'+esc(nombreCli(id))+'</b></p>'
    +'<div class="gc-resumen"><div class="cl"><span>Deuda vencida repactable</span><b>'+clp(total)+'</b></div><p class="nota">Incluye mensualidades, saldo inicial y cuotas de una repactación incumplida. Las cuotas de trabajos especiales no se repactan. El servidor recalcula el monto exacto con el vencimiento efectivo.</p></div>'
    +'<div class="gc-seg" role="radiogroup" aria-label="Número de cuotas" style="margin:6px 0">'+[2,3].map(function(n){return '<button type="button" class="fb'+(n===3?' on':'')+'" data-n="'+n+'" role="radio" aria-checked="'+(n===3)+'">'+n+' cuotas</button>';}).join('')+'</div>'
    +'<div id="gcRPlan"></div>'
    +'<label class="campo"><span>Nota (opcional)</span><textarea id="gcRNota" maxlength="500" placeholder="Qué pidió el cliente"></textarea></label>'
    +'<ul class="nota" style="padding-left:18px"><li>La 1.ª cuota es el <b>pie</b>: se paga de inmediato (2 días hábiles) o la repactación se anula.</li><li>Queda <b>en validación del Master</b> (alerta al día 1, escalamiento al día 2, tope 3 días hábiles). Mientras tanto la suspensión queda en espera.</li><li>Si después se incumple una cuota, toda la deuda se acumula y pasa a suspensión programada.</li></ul>';
  var n=3;
  G.modal({titulo:'🤝 Solicitar repactación',html:html,ok:'Solicitar repactación',
    alAbrir:function(m){
      function pint(){var p=plan(n);m.querySelector('#gcRPlan').innerHTML=total<n?'<div class="aviso ambar"><span>No hay deuda vencida para repactar.</span></div>':
        '<div class="cl"><span>Pie (cuota 1, inmediato)</span><b>'+clpT(p.c)+'</b></div>'+(n===3?'<div class="cl"><span>Cuota 2</span><b>'+clpT(p.c)+'</b></div>':'')+'<div class="cl"><span>Cuota '+n+' (última, con el redondeo)</span><b>'+clpT(p.u)+'</b></div>';}
      m.querySelectorAll('[data-n]').forEach(function(b){b.addEventListener('click',function(){n=Number(b.getAttribute('data-n'));m.querySelectorAll('[data-n]').forEach(function(x){var on=x===b;x.classList.toggle('on',on);x.setAttribute('aria-checked',on);});pint();});});
      pint();
    },
    alAceptar:function(m){
      if(total<n)throw new Error('No hay deuda vencida para repactar.');
      return D.repactacionSolicitar({p_cliente_id:Number(id),p_n_cuotas:n,p_nota:m.querySelector('#gcRNota').value.trim()||null})
        .then(function(r){G.cerrarDet();recargar('Repactación solicitada: total '+clpT(r.total)+', pie '+clpT(r.pie)+' hasta el '+G.fFecha(r.pie_vence)+'. Queda en validación del Master.');return true;})
        .catch(function(e){throw new Error(mErr(e));});
    }});
}

/* ── Pestaña: pagos detectados en la cartola (Conciliación) ── */
function movimientosHtml(){
  if(!S.mov&&!S.movErr){D.movimientos().then(function(r){S.mov=r||[];render();}).catch(function(e){S.movErr=mErr(e);render();});
    return '<section class="card"><div class="aviso lila" style="margin-top:16px"><span class="gc-spin"></span>Buscando ingresos de la cartola…</div></section>';}
  if(S.movErr)return '<section class="card"><div class="aviso rojo" style="margin-top:16px"><span>'+esc(S.movErr)+'</span></div></section>';
  var h='<section class="card"><div class="h"><h2>Pagos detectados <span>en el banco</span></h2></div><p class="t2">Ingresos de la cartola (Conciliación) que pueden ser pagos de clientes con deuda. Un ingreso detectado <b>no</b> cuenta como pago hasta que Cobranza lo registra.</p>';
  if(!S.mov.length)return h+'<div class="gc-vacio">No hay ingresos por aplicar.</div></section>';
  h+='<div class="tabla-box"><table class="gt"><thead><tr><th>Fecha</th><th>Cliente</th><th>Origen</th><th class="num">Saldo del ingreso</th><th>Propuesta</th><th></th></tr></thead><tbody>';
  S.mov.forEach(function(m,i){
    h+='<tr><td>'+G.fFecha(m.fecha)+'</td><td><b>'+esc(m.razon_social||nombreCli(m.cliente_id))+'</b><span class="sub">'+(m.via==='MEMORIA'?'por memoria de RUT':'asignado')+'</span></td><td>'+esc(m.nombre_origen||'—')+'</td>'
      +'<td class="num"><b>'+clp(m.estado==='descartado'?m.monto:m.saldo)+'</b></td><td>'+(m.exacto?'<span class="estado verde">Calza exacto</span>':'<span class="estado ambar">Revisar</span>')+'</td>'
      +'<td>'+(S.yo.puede_registrar_pagos?'<button type="button" class="btn chico verde" data-act="aplicar-mov" data-i="'+i+'">Aplicar</button>':'')+'</td></tr>';
  });
  return h+'</tbody></table></div></section>';
}

/* ── Pestaña: avisos que se enviarían (sin enviar) ── */
function avisosHtml(){
  var yo=S.yo;
  var h='<section class="card"><div class="h"><h2>Secuencia de avisos <span>que se enviarían</span></h2></div>'
    +'<div class="aviso cel">'+I('info','ic-cel')+'<span><b>Nada se envía desde esta pantalla.</b> '+(yo.envio_habilitado?'El envío está habilitado por el Master.':'El envío está deshabilitado (modo prueba): los avisos quedan en cola y se muestran aquí.')+' El envío por correo y app es un paquete aparte (Edge de envío).</span></div>'
    +'<div class="tabla-box" style="margin-top:12px"><table class="gt"><thead><tr><th>Cuándo</th><th>Etapa</th><th>Aviso</th></tr></thead><tbody>'
    +[['Mes 1 · día 18','Por vencer','M1'],['Mes 1 · desde el día 22, martes y jueves 10:30','En mora','V'],['Mes 2 · desde el día 22, martes y jueves','Riesgo','RS'],
      ['Mes 2 · último día hábil, 10:00','Riesgo','M7'],['Tras la revisión de obligaciones','Suspensión programada','SP'],['Mes 3 · 1.er día hábil (un solo aviso)','Suspendido','M8'],
      ['Mes 4 · 1.er día hábil','En término','M9'],['Al pagar o repactar','Reactivación','M10']].map(function(r){var a=AVISO[r[2]];
        return '<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td><td><b>'+esc(a[0])+'</b><span class="sub">'+esc(a[1])+'</span></td></tr>';}).join('')
    +'</tbody></table></div><p class="nota">⚖️ Ley 21.320: máximo 2 gestiones escritas por semana, con al menos 2 días entre ellas, de lunes a sábado entre 08:00 y 20:00 (aplicación según el tipo de deuda a validar por el abogado). Los avisos con fecha fija reemplazan el envío más cercano de esa semana.</p></section>';
  h+='<section class="card"><div class="h"><h2>Cola <span>de avisos</span></h2></div>';
  if(!S.avisos&&!S.avisosErr){D.avisos().then(function(r){S.avisos=r||[];render();}).catch(function(e){S.avisosErr=mErr(e);render();});
    return h+'<div class="aviso lila"><span class="gc-spin"></span>Cargando la cola…</div></section>';}
  if(S.avisosErr)return h+'<div class="aviso rojo"><span>'+esc(S.avisosErr)+'</span></div></section>';
  if(!S.avisos.length)return h+'<div class="gc-vacio">La cola está vacía.</div></section>';
  h+='<div class="tabla-box"><table class="gt"><thead><tr><th>Programado</th><th>Cliente</th><th>Aviso</th><th>Estado</th></tr></thead><tbody>';
  S.avisos.forEach(function(a){var n=AVISO[a.codigo]||[a.codigo,''];
    h+='<tr class="clic" data-act="ficha" data-id="'+esc(a.cliente_id)+'" tabindex="0"><td>'+G.fHora(a.programado_para)+'</td><td>'+esc(nombreCli(a.cliente_id))+'</td><td><b>'+esc(n[0])+'</b>'+(a.variante>1?' <span class="t3">v'+a.variante+'</span>':'')+(a.es_gestion?'<span class="sub">Cuenta para la Ley 21.320</span>':'')+'</td><td>'+chip(AV_EST[a.estado]||{t:a.estado,c:'gris'})+(a.motivo_cancelacion?'<span class="sub">'+esc(a.motivo_cancelacion)+'</span>':'')+'</td></tr>';});
  return h+'</tbody></table></div></section>';
}

/* ── Pestaña: validaciones (Master) y tareas ── */
function validacionesHtml(){
  var yo=S.yo, val=S.datos.repactaciones.filter(function(r){return r.estado==='EN_VALIDACION';});
  var h='<section class="card"><div class="h"><h2>Repactaciones <span>por validar</span></h2></div>';
  if(!val.length)h+='<div class="gc-vacio">No hay repactaciones esperando validación.</div>';
  val.forEach(function(r){
    var atras=r.validacion_limite&&Date.parse(r.validacion_limite)<Date.now();
    h+='<div class="aviso '+(atras?'rojo':'ambar')+'" style="margin-bottom:8px"><span><b>'+esc(nombreCli(r.cliente_id))+'</b> · '+r.n_cuotas+' cuotas · total '+clpT(r.monto_total)+' · pie '+clpT(r.monto_cuota)+' (vence '+G.fFecha(r.pie_vence)+')'
      +'<br><small>Solicitada el '+G.fFecha(r.solicitada_dia)+(atras?' · ⚠️ validación atrasada':' · validar antes de '+G.fHora(r.validacion_limite))+(r.nota?' · «'+esc(r.nota)+'»':'')+'</small></span>'
      +(yo.puede_decidir?'<button type="button" class="btn chico verde" data-act="rep-ok" data-id="'+esc(r.id)+'">Aprobar</button><button type="button" class="btn chico peligro" data-act="rep-no" data-id="'+esc(r.id)+'">Rechazar</button>':'<small>La valida el Master.</small>')+'</div>';
  });
  h+='</section><section class="card"><div class="h"><h2>Tareas <span>abiertas</span></h2></div>';
  if(!S.datos.tareas.length)h+='<div class="gc-vacio">Sin tareas abiertas.</div>';
  else h+='<div class="tabla-box"><table class="gt"><thead><tr><th>Tarea</th><th>Cliente</th><th>Plazo</th></tr></thead><tbody>'+S.datos.tareas.map(function(t){
    var atr=G.dias(t.plazo,S.hoy)>0;return '<tr class="clic" data-act="ficha" data-id="'+esc(t.cliente_id)+'" tabindex="0"><td>'+esc(TAREA[t.tipo]||t.tipo)+'</td><td>'+esc(nombreCli(t.cliente_id))+'</td><td class="'+(atr?'t-rojo':'')+'">'+G.fFecha(t.plazo)+'</td></tr>';}).join('')+'</tbody></table></div>'
    +'<p class="nota">La reactivación nunca es automática: con el pago confirmado se crea la tarea «Reactivar cliente». Cerrar tareas y reactivar desde esta pantalla queda para la versión siguiente.</p>';
  return h+'</section>';
}
function decidirRep(id,aprobar){
  var r=S.datos.repactaciones.find(function(x){return String(x.id)===String(id);});if(!r)return;
  G.modal({titulo:aprobar?'✅ Aprobar repactación':'✖️ Rechazar repactación',okClase:aprobar?'verde':'peligro',ok:aprobar?'Aprobar':'Rechazar',
    html:'<p><b>'+esc(nombreCli(r.cliente_id))+'</b> · '+r.n_cuotas+' cuotas · total '+clpT(r.monto_total)+' · pie '+clpT(r.monto_cuota)+'</p>'
      +(aprobar?'<p class="t2">Queda APROBADA y se vuelve vigente cuando Cobranza registre el pago del pie.</p>':'<label class="campo"><span>Motivo (mínimo 10 caracteres)</span><textarea id="gcRMot" maxlength="500"></textarea></label>'),
    alAceptar:function(m){
      var mot=aprobar?null:m.querySelector('#gcRMot').value.trim();
      if(!aprobar&&mot.length<10)throw new Error('Escribe un motivo de al menos 10 caracteres.');
      return D.repactacionValidar({p_repactacion_id:Number(id),p_aprobar:aprobar,p_motivo:mot}).then(function(res){recargar('Repactación '+(res&&res.estado==='RECHAZADA'?'rechazada':'aprobada')+'.');return true;})
        .catch(function(e){throw new Error(mErr(e));});
    }});
}

/* ── Pestaña: análisis (indicadores del Master) ── */
function analisisHtml(){
  var h='<section class="card"><div class="h"><h2>Análisis <span>de cobranza</span></h2></div>';
  if(!S.yo.puede_decidir)return h+'<div class="aviso gris">'+I('candado')+'<span>Los indicadores históricos (6 meses) los ve solo el Master.</span></div></section>';
  if(!S.ind&&!S.indErr){D.indicadores().then(function(r){S.ind=r;render();}).catch(function(e){S.indErr=mErr(e);render();});return h+'<div class="aviso lila"><span class="gc-spin"></span>Calculando indicadores…</div></section>';}
  if(S.indErr)return h+'<div class="aviso rojo"><span>'+esc(S.indErr)+'</span></div></section>';
  var ms=(S.ind&&S.ind.meses)||[];
  var maxC=ms.reduce(function(m,x){return Math.max(m,Number(x.cartera)||0);},0);
  h+='<div class="tabla-box"><table class="gt"><thead><tr><th>Mes</th><th class="num">Cartera</th><th class="num">Vencido</th><th class="num">Morosidad</th><th class="num">Pagado en el mes</th><th class="num">Días prom. de pago</th><th class="num">Recuperación</th><th class="num">Repact. cumplidas</th><th class="num">Incobrab. 12 m</th></tr></thead><tbody>';
  ms.forEach(function(x){
    var w=maxC>0?Math.round(100*(Number(x.cartera)||0)/maxC):0;
    h+='<tr><td><b>'+esc(x.mes)+'</b></td><td class="num">'+clp(x.cartera)+'<div class="gc-avance" aria-hidden="true"><i style="width:'+w+'%;background:linear-gradient(90deg,#9A4E9C,#C77BC9)"></i></div></td><td class="num">'+clp(x.vencido)+'</td>'
      +'<td class="num">'+G.pct(x.morosidad_pct)+'</td><td class="num">'+G.pct(x.pagado_en_el_mes_pct)+'</td><td class="num">'+(G.esNum(x.dias_promedio_pago)?Number(x.dias_promedio_pago).toLocaleString('es-CL',{maximumFractionDigits:1})+' d':'<span class="nd">No disponible</span>')+'</td>'
      +'<td class="num">'+clp(x.recuperacion)+'</td><td class="num">'+G.pct(x.repactaciones_cumplidas_pct)+'</td><td class="num">'+G.pct(x.incobrabilidad_12m_pct)+'</td></tr>';
  });
  return h+'</tbody></table></div><p class="nota">Fuente: cobranza_indicadores (servidor). «No disponible» = no hay base para calcular ese mes (nunca se muestra como 0).</p></section>';
}

/* ── Eventos ── */
function pintar(root){(root||document).querySelectorAll('[data-gc-ic]').forEach(function(el){el.innerHTML=G.svg(el.getAttribute('data-gc-ic'));el.removeAttribute('data-gc-ic');});}
document.addEventListener('click',function(ev){
  var b=ev.target.closest('[data-act]');if(!b)return;
  var a=b.getAttribute('data-act');
  if(a==='tab'){S.tab=b.getAttribute('data-tab');render();window.scrollTo({top:0});}
  else if(a==='filtro'){S.filtro=b.getAttribute('data-f');S.tab='cartera';render();}
  else if(a==='ficha')abrirFicha(b.getAttribute('data-id'));
  else if(a==='pago')abrirPago(b.getAttribute('data-id'));
  else if(a==='repactar')abrirRepactar(b.getAttribute('data-id'));
  else if(a==='aplicar-mov'){var m=S.mov[Number(b.getAttribute('data-i'))];if(m)abrirPago(m.cliente_id,m);}
  else if(a==='rep-ok')decidirRep(b.getAttribute('data-id'),true);
  else if(a==='rep-no')decidirRep(b.getAttribute('data-id'),false);
  else if(a==='recargar'){S.err=null;cargar();}
});
document.addEventListener('keydown',function(ev){
  if(ev.key!=='Enter'&&ev.key!==' ')return;var t=ev.target;
  if(t&&t.tagName==='TR'&&t.getAttribute('data-act')==='ficha'){ev.preventDefault();abrirFicha(t.getAttribute('data-id'));}
});
document.addEventListener('input',function(ev){
  if(ev.target&&ev.target.id==='gcBuscar'){S.buscar=ev.target.value.trim();var pos=ev.target.selectionStart;render();var i=$('gcBuscar');if(i){i.focus();try{i.setSelectionRange(pos,pos);}catch(e){}}}
});

function iniciar(){
  pintar();
  var c=$('gcDetCerrar');if(c)c.addEventListener('click',G.cerrarDet);
  var v=$('gcVelo');if(v)v.addEventListener('click',G.cerrarDet);
  if(DEMO){$('gcDemo').hidden=false;document.documentElement.classList.remove('auth-pending');if(window.COB_DEMO_UI)window.COB_DEMO_UI(function(){S.ind=null;S.indErr=null;S.mov=null;S.avisos=null;cargar();});}
  cargar();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();
