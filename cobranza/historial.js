/* ============================================================
   cobranza/historial.js — Cobranza · HISTORIAL POR CLIENTE (todas las facturas y todos los pagos)
   Solo lectura. No escribe nada ni llama a funciones que cambien datos.
   Fuente real (las mismas lecturas que ya usa cartera.js, con el JWT del usuario y la RLS cob_lectura = cob_puede_leer():
   Master, Cobranza y Pagos; migración 202610201630_cobranza_c1, GRANT SELECT a authenticated):
     cobranza_documentos (todos los estados) · cobranza_pagos (vigentes y anulados) · cobranza_aplicaciones (pago → documento)
     · cobranza_notas_credito · clientes.plan (si la RLS de clientes lo deja ver; si no, "—").
   No se leen columnas de auditoría (registrado_por, clave_idem, anulado_por…).
   Modo demostración: cartera-demo.js entrega COB_DEMO_API.historial con datos de ejemplo (solo ?demo=1 en localhost).
   Expone window.GC_HIST = { cargarReal, armar, html, estadoDoc }.
   ============================================================ */
(function(){
'use strict';
var G=window.GC;
if(!G)return;
var esc=G.esc, clp=G.clp, clpT=G.clpT, I=G.I;

var ORIGEN={MENSUALIDAD:'Factura',SALDO_INICIAL:'Saldo inicial',TRABAJO_ESPECIAL:'Trabajo especial',CUOTA_REPACTACION:'Cuota de repactación'};
var MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function periodoTxt(p){var m=/^(\d{4})-(\d{2})$/.exec(p||'');return m?MESES[+m[2]-1]+' '+m[1]:(p||'');}
function n(x){return Number(x)||0;}
function lotes(a,t){var r=[];for(var i=0;i<a.length;i+=t)r.push(a.slice(i,i+t));return r;}

/* ── Adaptador real: solo GET (lectura) ── */
function cargarReal(A,id){
  var q=encodeURIComponent(id);
  return Promise.all([
    A.get('cobranza_documentos?select=id,origen,folio,periodo,concepto,cuota_n,cuotas_total,fecha_emision,fecha_vencimiento,monto,pagado,rebajado,saldo,pagado_fecha,estado,ref_externa&cliente_id=eq.'+q+'&order=fecha_emision.desc,id.desc&limit=2000'),
    A.get('cobranza_pagos?select=id,fecha_pago,monto,monto_abono,medio,referencia,estado,movimiento_id&cliente_id=eq.'+q+'&order=fecha_pago.desc,id.desc&limit=2000'),
    A.get('cobranza_notas_credito?select=id,documento_id,folio_nc,fecha,monto,estado&cliente_id=eq.'+q+'&order=fecha.desc&limit=500').catch(function(){return [];}),
    A.get('clientes?select=plan&id=eq.'+q).then(function(r){return r&&r[0]?r[0].plan:null;}).catch(function(){return null;})
  ]).then(function(r){
    var pagos=r[1]||[], ids=pagos.map(function(p){return p.id;});
    var apl=!ids.length?Promise.resolve([]):Promise.all(lotes(ids,150).map(function(l){
      return A.get('cobranza_aplicaciones?select=pago_id,documento_id,monto,anulada,desde_abono&pago_id=in.('+l.map(function(x){return encodeURIComponent(x);}).join(',')+')');
    })).then(function(rs){return [].concat.apply([],rs);});
    return apl.then(function(a){return {documentos:r[0]||[],pagos:pagos,aplicaciones:a,notas:r[2]||[],plan:r[3]};});
  });
}

/* ── Estado de cada documento (para mostrar; el estado del cliente lo calcula el motor en el servidor) ── */
function estadoDoc(d,hoy){
  if(d.estado==='PAGADO')return {k:'PAGADO',t:'Pagado',c:'verde'};
  if(d.estado==='ANULADO')return {k:'ANULADO',t:'Anulado',c:'gris'};
  if(d.estado==='REPACTADO')return {k:'REPACTADO',t:'Repactado',c:'cel'};
  if(d.estado==='CASTIGADO')return {k:'CASTIGADO',t:'Castigado',c:'rojo'};
  if(!(n(d.saldo)>0))return {k:'PAGADO',t:'Pagado',c:'verde'};
  var dd=G.dias(d.fecha_vencimiento,hoy);
  if(dd!=null&&dd>0)return {k:'VENCIDO',t:'Vencido',c:'rojo',dias:dd};
  var faltan=G.dias(hoy,d.fecha_vencimiento);
  if(faltan!=null&&faltan<=7)return {k:'POR_VENCER',t:'Por vencer',c:'ambar'};
  return {k:'AL_DIA',t:'Al día',c:'verde'};
}

/* ── Arma el modelo: una sola línea de tiempo (facturas, pagos y notas de crédito) ordenada por fecha ── */
function armar(datos,hoy){
  datos=datos||{};
  var docs=datos.documentos||[], pagos=datos.pagos||[], apl=datos.aplicaciones||[], ncs=datos.notas||[];
  var porId={};docs.forEach(function(d){porId[d.id]=d;});
  function nombreDoc(d){if(!d)return 'documento';return d.folio?'folio '+d.folio:(d.cuota_n?'cuota '+d.cuota_n+' de '+d.cuotas_total:(ORIGEN[d.origen]||'documento').toLowerCase());}
  var filas=[];
  docs.forEach(function(d){
    var e=estadoDoc(d,hoy);
    filas.push({tipo:'FACTURA',fecha:d.fecha_emision,orden:2,id:d.id,doc:d,est:e,monto:n(d.monto),saldo:e.k==='ANULADO'?0:n(d.saldo)});
  });
  pagos.forEach(function(p){
    var a=apl.filter(function(x){return String(x.pago_id)===String(p.id)&&!x.anulada;});
    filas.push({tipo:'PAGO',fecha:p.fecha_pago,orden:1,id:p.id,pago:p,aplicado:a.map(function(x){return {doc:porId[x.documento_id],nombre:nombreDoc(porId[x.documento_id]),monto:n(x.monto),desdeAbono:!!x.desde_abono};}),
      monto:n(p.monto),est:p.estado==='ANULADO'?{k:'ANULADO',t:'Anulado',c:'gris'}:{k:'CONFIRMADO',t:'Confirmado',c:'verde'}});
  });
  ncs.forEach(function(x){
    filas.push({tipo:'NC',fecha:x.fecha,orden:0,id:x.id,nc:x,doc:porId[x.documento_id],nombreDoc:nombreDoc(porId[x.documento_id]),monto:n(x.monto),
      est:x.estado==='ANULADA'?{k:'ANULADA',t:'Anulada',c:'gris'}:{k:'VIGENTE',t:'Rebaja vigente',c:'cel'}});
  });
  // Más reciente primero; el mismo día: factura, después pago, después nota de crédito.
  filas.sort(function(a,b){return a.fecha<b.fecha?1:a.fecha>b.fecha?-1:(b.orden-a.orden)||(n(b.id)-n(a.id));});
  var anios={};filas.forEach(function(f){if(f.fecha)anios[String(f.fecha).slice(0,4)]=1;});
  // Saldo y vencidos: siempre a hoy (no dependen del filtro de año).
  var saldo=0,nVenc=0,montoVenc=0;
  docs.forEach(function(d){var e=estadoDoc(d,hoy);if((d.estado==='PENDIENTE'||d.estado==='CASTIGADO')&&n(d.saldo)>0){saldo+=n(d.saldo);if(e.k==='VENCIDO'||d.estado==='CASTIGADO'){nVenc++;montoVenc+=n(d.saldo);}}});
  return {filas:filas,anios:Object.keys(anios).sort().reverse(),saldo:saldo,nVencidos:nVenc,montoVencido:montoVenc,plan:datos.plan||null,hoy:hoy,
    vacio:!docs.length&&!pagos.length&&!ncs.length};
}

/* Totales del período elegido. Facturado = facturas emitidas (sin anuladas ni cuotas de repactación, que solo reordenan deuda ya facturada).
   Pagado = pagos confirmados (incluye la parte que quedó como abono). */
function totales(filas){
  var fact=0,pag=0,nc=0,nf=0,np=0;
  filas.forEach(function(f){
    if(f.tipo==='FACTURA'&&f.est.k!=='ANULADO'&&f.doc.origen!=='CUOTA_REPACTACION'){fact+=f.monto;nf++;}
    else if(f.tipo==='PAGO'&&f.est.k==='CONFIRMADO'){pag+=f.monto;np++;}
    else if(f.tipo==='NC'&&f.est.k==='VIGENTE')nc+=f.monto;
  });
  return {facturado:fact,pagado:pag,nc:nc,nFacturas:nf,nPagos:np};
}

/* ── Render ── */
function filaFactura(f){
  var d=f.doc, tit=(d.origen==='MENSUALIDAD'?(d.folio?'Factura folio '+d.folio:'Factura'):(ORIGEN[d.origen]||'Documento')+(d.folio?' · folio '+d.folio:''))+(d.cuota_n?' · cuota '+d.cuota_n+' de '+d.cuotas_total:'');
  var sub=[];if(d.concepto)sub.push(esc(d.concepto));if(n(d.pagado)>0&&n(d.saldo)>0)sub.push('abonado '+clpT(d.pagado));if(n(d.rebajado)>0)sub.push('rebaja NC '+clpT(d.rebajado));
  if(d.estado==='PAGADO'&&d.pagado_fecha)sub.push('pagada el '+G.fFecha(d.pagado_fecha));
  return '<tr class="h-fac'+(f.est.k==='VENCIDO'?' borde-rojo':f.est.k==='POR_VENCER'?' borde-ambar':'')+'"><td>'+G.fFecha(f.fecha)+'</td>'
    +'<td><span class="h-mov">'+I('archivo','ic-mor')+'<b>'+esc(tit)+'</b></span>'+(sub.length?'<span class="sub">'+sub.join(' · ')+'</span>':'')+'</td>'
    +'<td>'+(d.periodo?esc(periodoTxt(d.periodo)):'<span class="t3">—</span>')+'</td>'
    +'<td>'+G.fFecha(d.fecha_vencimiento)+(f.est.k==='VENCIDO'?'<span class="sub t-rojo">hace '+f.est.dias+' d</span>':'')+'</td>'
    +'<td class="num">'+clp(f.monto)+'</td>'
    +'<td class="num">'+(f.saldo>0?'<b class="'+(f.est.k==='VENCIDO'?'t-rojo':'')+'">'+clp(f.saldo)+'</b>':'<span class="t3">$0</span>')+'</td>'
    +'<td><span class="estado '+f.est.c+'">'+esc(f.est.t)+'</span></td></tr>';
}
function filaPago(f){
  var p=f.pago, sub=[];
  if(f.aplicado.length)sub.push('Aplicado a '+f.aplicado.map(function(a){return esc(a.nombre)+(f.aplicado.length>1?' ('+clpT(a.monto)+')':'')+(a.desdeAbono?' desde abono':'');}).join(', '));
  else sub.push('Sin documento aplicado');
  if(n(p.monto_abono)>0)sub.push('abono (saldo a favor) '+clpT(p.monto_abono));
  if(p.referencia)sub.push(esc(p.referencia));
  if(p.movimiento_id)sub.push('desde la cartola');
  var medio=p.medio==='TRANSFERENCIA'||!p.medio?'Transferencia':String(p.medio).charAt(0)+String(p.medio).slice(1).toLowerCase();
  return '<tr class="h-pag"><td>'+G.fFecha(f.fecha)+'</td>'
    +'<td><span class="h-mov">'+I('moneda',f.est.k==='ANULADO'?'':'ic-ver')+'<b>Pago · '+esc(medio)+'</b></span><span class="sub">'+sub.join(' · ')+'</span></td>'
    +'<td><span class="t3">—</span></td><td><span class="t3">—</span></td>'
    +'<td class="num"><b class="'+(f.est.k==='ANULADO'?'t3 h-tachado':'t-verde')+'">'+clp(f.monto)+'</b></td>'
    +'<td class="num"><span class="t3">—</span></td>'
    +'<td><span class="estado '+f.est.c+'">'+esc(f.est.t)+'</span></td></tr>';
}
function filaNC(f){
  return '<tr class="h-nc"><td>'+G.fFecha(f.fecha)+'</td>'
    +'<td><span class="h-mov">'+I('archivo','ic-cel')+'<b>Nota de crédito '+esc(f.nc.folio_nc||'')+'</b></span><span class="sub">Rebaja '+esc(f.nombreDoc)+'</span></td>'
    +'<td><span class="t3">—</span></td><td><span class="t3">—</span></td>'
    +'<td class="num">'+(f.est.k==='ANULADA'?'<span class="t3 h-tachado">':'<span>')+'−'+clp(f.monto)+'</span></td><td class="num"><span class="t3">—</span></td>'
    +'<td><span class="estado '+f.est.c+'">'+esc(f.est.t)+'</span></td></tr>';
}
function tarjetaM(f){
  var t,der,sub;
  if(f.tipo==='FACTURA'){var d=f.doc;t=I('archivo','ic-mor')+'<b>'+esc(d.folio?'Folio '+d.folio:(ORIGEN[d.origen]||'Documento'))+'</b>';
    der='<b>'+clp(f.monto)+'</b>';sub=(d.periodo?'<span>Período '+esc(periodoTxt(d.periodo))+'</span>':'')+'<span>Vence '+G.fFecha(d.fecha_vencimiento)+'</span><span>Saldo <b class="'+(f.est.k==='VENCIDO'?'t-rojo':'')+'">'+clpT(f.saldo)+'</b></span>';}
  else if(f.tipo==='PAGO'){t=I('moneda','ic-ver')+'<b>Pago</b>';der='<b class="t-verde">'+clp(f.monto)+'</b>';
    sub='<span>'+(f.aplicado.length?'A '+esc(f.aplicado.map(function(a){return a.nombre;}).join(', ')):'Sin documento aplicado')+'</span>';}
  else{t=I('archivo','ic-cel')+'<b>NC '+esc(f.nc.folio_nc||'')+'</b>';der='<b>−'+clp(f.monto)+'</b>';sub='<span>Rebaja '+esc(f.nombreDoc)+'</span>';}
  return '<div class="h-card"><div class="l1"><span class="h-mov">'+t+'</span>'+der+'</div><div class="l2"><span>'+G.fFecha(f.fecha)+'</span>'+sub+'<span class="estado '+f.est.c+'">'+esc(f.est.t)+'</span></div></div>';
}

/* m = modelo de armar(); o = {anio:'TODOS'|'2026', demo:bool} */
function html(m,o){
  o=o||{};var anio=o.anio&&o.anio!=='TODOS'&&m.anios.indexOf(o.anio)>=0?o.anio:'TODOS';
  var h='';
  if(o.demo)h+='<div class="aviso cel h-demo" role="note">'+I('info','ic-cel')+'<span><b>Datos de ejemplo.</b> Facturas y pagos ficticios para revisar la pantalla: no vienen de Supabase y nada se guarda.</span></div>';
  if(m.vacio)return h+'<div class="gc-vacio">'+I('historial','ic-mor')+'<br>Este cliente aún no tiene facturas ni pagos en Cobranza.<br><small>Las facturas aparecen cuando Facturación las emite y los pagos cuando Cobranza los registra.</small></div>';
  var filas=anio==='TODOS'?m.filas:m.filas.filter(function(f){return String(f.fecha).slice(0,4)===anio;});
  var t=totales(filas), et=anio==='TODOS'?'histórico':'en '+anio;
  h+='<div class="h-res">'
    +'<div><small>'+I('archivo','ic-mor')+' Total facturado</small><b>'+clp(t.facturado)+'</b><p>'+t.nFacturas+' documento(s) · '+esc(et)+'</p></div>'
    +'<div><small>'+I('moneda','ic-ver')+' Total pagado</small><b class="t-verde">'+clp(t.pagado)+'</b><p>'+t.nPagos+' pago(s) confirmado(s) · '+esc(et)+'</p></div>'
    +'<div><small>'+I('tendencia','ic-amb')+' Saldo pendiente</small><b class="'+(m.saldo>0?'t-ambar':'')+'">'+clp(m.saldo)+'</b><p>a hoy</p></div>'
    +'<div><small>'+I('info','ic-roj')+' Documentos vencidos</small><b class="'+(m.nVencidos>0?'t-rojo':'')+'">'+m.nVencidos+'</b><p>'+(m.nVencidos?clpT(m.montoVencido)+' a hoy':'nada vencido a hoy')+'</p></div>'
    +'</div>';
  if(t.nc>0)h+='<p class="nota">Notas de crédito vigentes '+esc(et)+': '+clpT(t.nc)+' (rebajan el saldo de la factura).</p>';
  if(m.anios.length>1||anio!=='TODOS'){
    h+='<div class="gc-filtros h-anios" role="group" aria-label="Filtrar por año">'+['TODOS'].concat(m.anios).map(function(a){
      return '<button type="button" class="f'+(anio===a?' on':'')+'" data-act="hist-anio" data-anio="'+esc(a)+'" aria-pressed="'+(anio===a)+'">'+(a==='TODOS'?'Todos los años':esc(a))+'</button>';}).join('')+'</div>';
  }
  if(!filas.length)return h+'<div class="gc-vacio">Sin facturas ni pagos en '+esc(anio)+'.</div>';
  h+='<div class="tabla-box h-tabla"><table class="gt"><thead><tr><th>Fecha</th><th>Movimiento</th><th>Período</th><th>Vence</th><th class="num">Monto</th><th class="num">Saldo</th><th>Estado</th></tr></thead><tbody>'
    +filas.map(function(f){return f.tipo==='FACTURA'?filaFactura(f):f.tipo==='PAGO'?filaPago(f):filaNC(f);}).join('')
    +'</tbody></table></div>';
  h+='<div class="h-lista-m">'+filas.map(tarjetaM).join('')+'</div>';
  h+='<p class="nota">Ordenado por fecha (lo más reciente arriba): las facturas por fecha de emisión y los pagos por fecha de pago. Un pago figura como <b>confirmado</b> cuando Cobranza lo registró; los ingresos del banco aún sin registrar están en «Pagos detectados en el banco».</p>';
  return h;
}

window.GC_HIST={cargarReal:cargarReal,armar:armar,html:html,estadoDoc:estadoDoc,totales:totales};
})();
