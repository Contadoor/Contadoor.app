/* ============================================================
   facturacion/nota-credito.js — F1e · Notas de crédito (DTE 61 exenta) sobre una factura adicional EMITIDA
   Módulo AUTÓNOMO para tocar lo mínimo la pantalla (rediseño de Facturación, PR #84 ya publicado): expone window.FX_NC y el
   detalle de la factura lo llama en UN punto, la caja reservada ".fa-nc" (antes "Próximamente"):
       FX_NC.cajaHtml(factura, {rol, yo, prod})   → HTML de la caja "Nota de crédito" (lista de NC, saldo y botones)
       FX_NC.cargar(idsDeFacturasEmitidas)        → trae las NC de esas facturas (RLS de Facturación) · devuelve Promise
       FX_NC.alCambiar(fn)                        → la pantalla se vuelve a dibujar después de cada acción
   Flujo (igual que F1c): crear (facturador o Master) → aprobar (Master; auto-aprobación con el monto reescrito si la creó él)
   → emitir (Edge facturacion-emitir, accion nc_emitir; mismos 3 candados para lo real) → conciliar si queda incierta.
   Línea del rediseño: toda factura nueva es REAL; en una NC REAL la emisión pide escribir REAL y reescribir el monto (franja roja
   del detalle + botón rojo), igual que "Emitir factura real". Las PRUEBAS antiguas siguen funcionando con su chip.
   El servidor valida TODO (saldo no anulado, una sola anulación total, mismo receptor, referencia exacta); aquí solo se guía.
   Motor: RPC nota_credito_* (SQL 202610241200). Sin datos reales en este archivo.
   ============================================================ */
(function(){
'use strict';
if(window.FX_DEMO===true)return;
var U=window.FX_UTIL, UI=window.FX_UI;
var ic=U.ic, I=U.I, esc=U.esc, clp=U.clp;
var modal=UI.modal, toast=UI.toast, cerrarModal=UI.cerrarModal;
var EDGE=(typeof SB_URL!=='undefined'?SB_URL:'')+'/functions/v1/facturacion-emitir';
var S={porFactura:{},facturas:{},ocupado:false,redibujar:null,ctx:{rol:'lectura',yo:null,prod:false}};
var CAMPOS='id,codigo,factura_id,modo,estado,cod_ref,razon_ref,motivo,monto,fecha_emision,creado_por,auto_aprobada_master,snapshot,snapshot_hash,of_folio,of_track_id,total_dte,error,alertas,doc_estado,cobranza_estado,cobranza_detalle,creado_at';
function $(id){return document.getElementById(id);}
function fFecha(iso){if(!iso)return '—';var p=String(iso).slice(0,10).split('-');return p[2]+'-'+p[1]+'-'+p[0];}

var EST={EN_REVISION:['En revisión del Master','cel'],APROBADA:['Aprobada · lista para emitir','ver'],EMITIENDO:['Emitiendo…','cel'],INCIERTO:['Incierta · por conciliar','ama'],
  EMITIDA:['Emitida','ver'],ERROR:['Rechazada por OpenFactura','roj'],ANULADA:['Descartada','gris']};
var COB={PENDIENTE:null,NO_APLICA:['gris','Prueba: no toca Cobranza'],AJUSTADA:['ver','Cobranza ajustada'],REQUIERE_REVISION:['amb','Cobranza por revisar a mano']};
var ERR={
  SOLO_FACTURADOR:'Esta acción la hace el facturador o el Master.',SOLO_MASTER:'Esta acción la hace solo el Master.',
  FACTURA_NO_EMITIDA:'Solo una factura emitida se corrige con nota de crédito.',
  FACTURA_TOTAL_DTE_DIFIERE:'El total del documento emitido no coincide con el aprobado: revísalo a mano antes de hacer una nota de crédito.',
  YA_TIENE_NOTA_CREDITO:'Esta factura ya tiene una nota de crédito: lo que queda se rebaja con "Corregir monto".',
  SUPERA_SALDO_NO_ANULADO:'El monto supera el saldo no anulado de la factura.',MONTO_ES_TOTAL:'Para dejar sin efecto toda la factura usa "Anular la factura completa".',
  MONTO_ANULACION_TOTAL:'La anulación es por el total de la factura.',MONTO_INVALIDO:'El monto debe ser en pesos enteros, mayor a $0.',MONTO_OBLIGATORIO:'Indica el monto a rebajar.',
  RAZON_REF_INVALIDA:'La razón que va en el documento debe tener entre 5 y 90 caracteres.',MOTIVO_OBLIGATORIO:'Explica el motivo (mínimo 10 caracteres).',
  TEXTO_NO_PERMITIDO:'No uses la palabra "honorarios": escribe "nuestros servicios".',HUELLA_NO_COINCIDE:'La nota cambió desde que la abriste: recarga y revísala de nuevo.',
  AUTOAPROBACION_REQUIERE_CONFIRMACION:'Creaste esta nota: usa "Auto-aprobar", que pide confirmar y reescribir el monto.',NO_ES_TUYA:'Solo puedes auto-aprobar notas que creaste tú.',
  CONFIRMACION_OBLIGATORIA:'Marca la casilla de confirmación.',TOTAL_CONFIRMADO_NO_COINCIDE:'El monto que escribiste no coincide con el de la nota.',
  TOTAL_CONFIRMADO_FORMATO:'Escribe el monto solo con números, por ejemplo 10000 o 10.000.',SIN_APROBACION:'Falta la aprobación del Master.',
  PRODUCCION_DESHABILITADA:'La emisión real está apagada: requiere el GO de producción.',PRODUCCION_NO_HABILITADA_EN_EDGE:'La emisión real está apagada en el servidor.',
  YA_EMITIDA:'Esta nota ya está emitida: no se vuelve a emitir.',REQUIERE_CONCILIACION:'Resultado incierto: el Master debe conciliar antes de cualquier reintento.',
  EN_CURSO:'La nota ya se está emitiendo. Espera y recarga.',NO_ANULABLE:'No se puede descartar: pudo llegar a OpenFactura (concilia primero) o ya está emitida.',
  RECEPTOR_NO_COINCIDE:'El receptor de la nota no es el de la factura. Descártala y crea otra.',REFERENCIA_NO_COINCIDE:'La referencia no corresponde a la factura. Descártala y crea otra.',
  FECHA_EMISION_FUERA_DE_RANGO:'La nota es de hace más de 5 días: descártala y crea otra.',NC_EXTERNA_DETECTADA:'OpenFactura ya tiene otra nota de crédito sobre esta factura que Gestoor no conoce. No se emitió: revisa con el Master.',
  NO_SE_PUDO_VERIFICAR_NC_PREVIA:'No se pudo verificar en OpenFactura si ya existe otra nota de crédito. No se emitió; intenta en unos minutos.',
  PALABRA_REAL:'Escribe REAL (en mayúsculas o minúsculas) para confirmar la emisión real.',
  TOKEN_INVALIDO:'El token debe tener 64 caracteres (letras a–f y números).',NO_CORRESPONDE:'Esta acción ya no corresponde. Recarga.',SIN_SESION:'Tu sesión no está activa. Vuelve a ingresar.'
};
function msg(e){
  var m=String(e&&(e.codigo||e.message)||''), code=(m.match(/^([A-Z_]{4,})/)||[])[1];
  if(code&&ERR[code])return ERR[code];
  if(m==='GESTOOR_NO_SESSION')return ERR.SIN_SESION;
  if(/Failed to fetch|NetworkError/i.test(m))return 'No hay conexión con el servidor. Revisa internet y vuelve a intentar.';
  return 'El motor rechazó la acción ('+(code||'error')+'). No se guardó nada.';
}
function rpc(fn,args){
  return sbFetch('rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||{})}).then(function(r){
    if(r.ok)return r.status===204?null:r.json();
    return r.text().then(function(t){var j={};try{j=JSON.parse(t);}catch(x){}throw new Error(j.message||t||('HTTP '+r.status));});
  });
}
function edge(accion,id,extra){
  var h;try{h=sbH();}catch(e){return Promise.reject(e);}
  return fetch(EDGE,{method:'POST',headers:h,body:JSON.stringify(Object.assign({accion:accion,nota_id:id},extra||{}))}).then(function(r){
    return r.json().catch(function(){return {};}).then(function(j){if(!r.ok){var e=new Error(j.error||('HTTP '+r.status));e.codigo=j.error;throw e;}return j;});
  });
}
/* Monto reescrito (mismo formato que la auto-aprobación de facturas): "10000" o "10.000", texto completo. */
function montoDesdeTexto(txt){
  var t=String(txt==null?'':txt).trim();
  if(!/^(?:[1-9][0-9]*|[1-9][0-9]{0,2}(?:\.[0-9]{3})+)$/.test(t))return null;
  var n=Number(t.replace(/\./g,''));return Number.isSafeInteger(n)&&n>0?n:null;
}
function esM(){return S.ctx.rol==='master';}
function esOp(){return S.ctx.rol==='facturador'||esM();}
function esMia(n){return S.ctx.yo!==null&&+n.creado_por===+S.ctx.yo;}
function ncs(fid){return S.porFactura[fid]||[];}
function porId(id){for(var k in S.porFactura){var x=S.porFactura[k].filter(function(n){return n.id===id;})[0];if(x)return x;}return null;}
function saldoLocal(f){   // orientativo para la pantalla; el servidor manda (incluye las NC emitidas fuera de Gestoor)
  var v=ncs(f.id).filter(function(n){return n.estado!=='ANULADA';});
  var emit=v.filter(function(n){return n.estado==='EMITIDA';}).reduce(function(a,n){return a+ +n.monto;},0);
  var comp=v.reduce(function(a,n){return a+ +n.monto;},0);
  return {noAnulado:Math.max(+f.total-emit,0),disponible:Math.max(+f.total-comp,0),hay:v.length>0,anulada:v.some(function(n){return n.cod_ref===1&&n.estado==='EMITIDA';})};
}
function bot(act,id,txt,icn,cls,ok,tip){
  return '<span class="tipw" tabindex="'+(ok?'-1':'0')+'" data-tip="'+esc(tip||'')+'"><button type="button" class="g-btn sm '+(cls||'')+'" data-nc="'+act+'" data-id="'+id+'"'+(ok&&!S.ocupado?'':' disabled')+'>'+I(icn,'')+esc(txt)+'</button></span>';
}
function accionesNc(n){
  var a=[], prod=n.modo==='PRODUCCION';
  if(esM()&&n.estado==='EN_REVISION'&&esMia(n))a.push(bot('autoaprobar',n.id,'Auto-aprobar (la creaste tú)','escudo','pri',true,'Confirmas y reescribes el monto. Se avisa al equipo.'));
  else if(esM()&&n.estado==='EN_REVISION')a.push(bot('aprobar',n.id,'Aprobar','aprobar','pri',true,'Apruebas exactamente lo que ves (huella).'));
  if(n.estado==='APROBADA'||n.estado==='ERROR'){var ok=esOp()&&(!prod||S.ctx.prod);
    a.push(bot('emitir',n.id,prod?'Emitir nota de crédito real':'Emitir (prueba)','enviar',ok?'pri':'',ok,!esOp()?'Emite el facturador o el Master.':(prod&&!S.ctx.prod?'Bloqueado: la emisión real requiere el GO de producción.':'')));}
  if(esM()&&n.estado==='INCIERTO')a.push(bot('conciliar',n.id,'Conciliar con OpenFactura','repetir','pri',true,'Busca el documento con la misma clave; nunca emite dos veces.'));
  if(n.estado==='EMITIDA'&&n.doc_estado==='OBTENIDOS'){a.push(bot('pdf',n.id,'PDF','bajar','',true,''));a.push(bot('xml',n.id,'XML','bajar','',true,''));}
  if(n.estado==='EMITIDA'&&n.doc_estado!=='OBTENIDOS'&&esOp())a.push(bot('documentos',n.id,'Traer PDF y XML','repetir','',true,'No reemite.'));
  if(esM()&&n.estado==='EMITIDA'&&n.cobranza_estado==='REQUIERE_REVISION')a.push(bot('cobranza',n.id,'Reintentar Cobranza','repetir','',true,'Vuelve a ajustar Cobranza con la función oficial.'));
  if((esM()&&['EN_REVISION','APROBADA','ERROR'].indexOf(n.estado)>=0)||(esMia(n)&&n.estado==='EN_REVISION'))a.push(bot('anular',n.id,'Descartar','basura','',true,'Solo si no llegó al SII.'));
  return a.join('');
}
function filaNc(n){
  var e=EST[n.estado]||[n.estado,'gris'], cob=n.estado==='EMITIDA'?COB[n.cobranza_estado]:null;
  var marca=S.marca&&S.marca.id===n.id&&Date.now()<S.marca.hasta?';outline:2px solid var(--ama);outline-offset:3px':'';
  return '<div class="nc-fila" data-nc-fila="'+n.id+'" style="border-top:1px solid rgba(255,255,255,.08);padding:8px 0;display:grid;gap:6px'+marca+'">'
   +'<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><b>'+esc(n.codigo)+'</b><span class="fx-est '+e[1]+'">'+esc(e[0])+'</span>'
   +'<span class="fx-est '+(n.cod_ref===1?'roj':'amb')+'">'+(n.cod_ref===1?'Anula la factura':'Corrige monto')+'</span>'
   +(n.of_folio?'<span class="cifra">NC N° <b>'+esc(n.of_folio)+'</b></span>':'')+'<span class="cifra" style="margin-left:auto">−'+clp(+n.monto)+'</span></div>'
   +'<div class="sub">'+esc(n.razon_ref)+' · '+fFecha(n.fecha_emision)+(n.auto_aprobada_master?' · auto-aprobada por el Master':'')+'</div>'
   +(cob?'<div class="sub"><span class="fx-est '+cob[0]+'">'+esc(cob[1])+'</span>'+(n.cobranza_estado==='REQUIERE_REVISION'&&n.cobranza_detalle?' '+esc(String(n.cobranza_detalle.motivo||'').split(':')[0]):'')+'</div>':'')
   +(n.estado==='INCIERTO'?'<div class="mot" style="background:rgba(255,210,77,.1)"><b>No reemitir.</b> El Master concilia con OpenFactura.</div>':'')
   +(n.estado==='ERROR'&&n.error?'<div class="sub" style="color:var(--roj)">'+esc(n.error)+'</div>':'')
   +'<div style="display:flex;flex-wrap:wrap;gap:6px">'+accionesNc(n)+'</div></div>';
}
/* ── Punto de integración único: caja "Nota de crédito" del detalle de la factura ── */
function cajaHtml(f,ctx){
  if(ctx)S.ctx={rol:ctx.rol||'lectura',yo:ctx.yo==null?null:+ctx.yo,prod:!!ctx.prod};
  if(!f)return '';
  if(f.estado!=='EMITIDA')return '<div class="fa-caja fa-nc"><h4>'+I('devolver','ic-amb')+'Nota de crédito</h4><p class="sub">Disponible cuando la factura esté emitida.</p></div>';
  S.facturas[f.id]=f;
  var s=saldoLocal(f), lista=ncs(f.id), prod=f.modo==='PRODUCCION';
  var puede=esOp()&&s.disponible>0;
  var tip=!esOp()?'Las crean Facturación o el Master; el Master aprueba.':(s.disponible<=0?'La factura no tiene saldo disponible para otra nota de crédito.':(prod?'Nota de crédito REAL (SII): pasa por la aprobación del Master.':'Nota de crédito de prueba (sin SII).'));
  return '<div class="fa-caja fa-nc" data-nc-caja="'+f.id+'"><h4>'+I('devolver','ic-amb')+'Nota de crédito</h4>'
   +(s.anulada?'<div class="mot" style="background:rgba(224,122,110,.1)"><b>Factura anulada con nota de crédito.</b> El documento sigue existiendo en el SII; la nota lo deja sin efecto.</div>':'')
   +'<div class="fa-dato"><span>Saldo no anulado</span><b class="cifra">'+clp(s.noAnulado)+' de '+clp(+f.total)+'</b></div>'
   +lista.map(filaNc).join('')
   +'<div class="fa-det-acc" style="margin-top:8px">'+bot('nueva',f.id,s.hay?'Nueva nota de crédito':'Anular con nota de crédito','basura',puede&&prod?'fa-btn-real':'',puede,tip)+'</div></div>';
}
function cargar(ids){
  ids=(ids||[]).filter(function(x){return /^[0-9]{1,18}$/.test(String(x));});
  if(!ids.length){S.porFactura={};return Promise.resolve();}
  return sbGet('facturas_adicionales_nc?select='+CAMPOS+'&factura_id=in.('+ids.join(',')+')&order=creado_at.asc').then(function(r){
    var m={};(r||[]).forEach(function(n){(m[n.factura_id]=m[n.factura_id]||[]).push(n);});S.porFactura=m;
  }).catch(function(){S.porFactura={};});
}
function anchoModal(){var mm=$('modal');if(mm){mm.classList.add('fa-ancho');mm.style.width='min(760px, calc(100% - 32px))';}}
function redibujar(){if(typeof S.redibujar==='function')return S.redibujar();}
function correr(p,ok,enModal){
  if(S.ocupado)return;S.ocupado=true;var si=document.querySelector('#mFoot [data-m="si"]');if(si){si.disabled=true;si.textContent='Procesando…';}
  return p.then(function(r){S.ocupado=false;if(enModal)cerrarModal();toast(I('aprobar','ic-ver')+' '+esc(typeof ok==='function'?ok(r):ok));return redibujar();})
   .catch(function(e){S.ocupado=false;var m=msg(e);if(enModal&&$('modal').classList.contains('on')){modal.error(m);var b=document.querySelector('#mFoot [data-m="si"]');if(b){b.disabled=false;b.textContent='Reintentar';}}else toast(I('alerta','ic-amb')+' '+esc(m));});
}
function resumenNc(n){
  var s=n.snapshot||{}, r=s.receptor_ficha||s.receptor||{}, ref=s.referencia||{};
  return '<div style="display:grid;gap:6px;font-size:13px;max-height:52vh;overflow:auto">'
   +'<div><b>'+esc(n.codigo)+'</b> · '+(n.modo==='PRODUCCION'?'<b style="color:var(--roj)">NOTA DE CRÉDITO REAL</b>':'prueba (sin SII)')+' · DTE 61 exenta</div>'
   +'<div>Referencia: <b>factura 34 N° '+esc(ref.FolioRef)+'</b> del '+fFecha(ref.FchRef)+' · código '+esc(ref.CodRef)+' ('+(+ref.CodRef===1?'anula el documento':'corrige monto')+')<br><span class="sub">Razón en el documento: '+esc(ref.RazonRef)+'</span></div>'
   +'<div>Receptor (el mismo de la factura): <b>'+esc(r.razon_social||'')+'</b> · '+esc(r.rut||'')+'</div>'
   +(s.detalle||[]).map(function(d){return '<div style="display:flex;gap:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:6px"><div style="flex:1;min-width:0">'+esc(d.NmbItem)+'</div><div class="sub">'+d.QtyItem+' × '+clp(d.PrcItem)+'</div><div class="cifra" style="min-width:90px;text-align:right">'+clp(d.MontoItem)+'</div></div>';}).join('')
   +'<div style="text-align:right">Total exento de la nota: <b class="cifra">'+clp(+(s.montos||{}).total||0)+'</b></div>'
   +'<div class="mot"><b>Motivo:</b> '+esc(n.motivo)+'</div>'
   +'<div class="sub">Emisor: '+esc((s.emisor||{}).RznSoc||'')+' · '+esc((s.emisor||{}).RUTEmisor||'')+'</div></div>';
}
function abrirNueva(fid){
  var f=S.facturas[fid]||null;
  rpc('nota_credito_saldos',{p_factura:fid}).then(function(sal){
    var hayOtra=+sal.n_nc>0||+sal.n_externas>0, disp=+sal.disponible, prod=f&&f.modo==='PRODUCCION';
    var b='<div style="display:grid;gap:10px">'
     +'<p class="sub">Factura '+esc(f?f.codigo:'#'+fid)+(f&&f.of_folio?' · N° <b>'+esc(f.of_folio)+'</b>':'')+' · total '+clp(+sal.total)+' · saldo disponible <b>'+clp(disp)+'</b>. Receptor, detalle y referencia salen de la factura: no se escriben a mano.</p>'
     +'<label style="display:flex;gap:8px;align-items:center"><input type="radio" name="ncCod" value="1"'+(hayOtra?' disabled':' checked')+' style="width:18px;height:18px;margin:0"> Anular la factura completa ('+clp(+sal.total)+')'+(hayOtra?' <span class="sub">— no disponible: ya hay otra nota</span>':'')+'</label>'
     +'<label style="display:flex;gap:8px;align-items:center"><input type="radio" name="ncCod" value="3"'+(hayOtra?' checked':'')+' style="width:18px;height:18px;margin:0"> Corregir monto (rebaja parcial)</label>'
     +'<label id="ncMontoBox"'+(hayOtra?'':' hidden')+'>Monto a rebajar (pesos, máximo '+clp(Math.min(disp,+sal.total-1))+')<input id="ncMonto" inputmode="numeric" placeholder="Ej.: 10.000" autocomplete="off"></label>'
     +'<label>Razón que va en el documento (5 a 90)<input id="ncRazon" maxlength="90" value="'+(hayOtra?'Corrige monto':'Anula factura emitida por error')+'"></label>'
     +'<label>Motivo interno (10 a 500)<textarea id="ncMot" rows="2" maxlength="500" placeholder="Ej.: el cliente pidió anular porque el servicio no se prestó"></textarea></label>'
     +(prod?'<div class="fa-modal-real">'+I('alerta','ic-roj')+'<div><b>Nota de crédito REAL:</b> al emitirse va al SII y deja sin efecto (total o parcialmente) la factura. Pasa por la aprobación del Master.</div></div>':'<div class="fa-modal-prueba">'+I('probeta','ic-cel')+'<div><b>Factura de prueba:</b> la nota se emite en el ambiente de pruebas de OpenFactura (sin SII).</div></div>')
     +'</div>';
    modal({t:prod?'Nota de crédito REAL':'Nota de crédito (prueba)',ic:'devolver',icc:prod?'ic-roj':'ic-amb',b:b,ok:'Crear y enviar al Master',cls:prod?'pri fa-btn-real':'pri',cb:function(){
      var cod=+((document.querySelector('#mBody input[name=ncCod]:checked')||{}).value||0);
      var p={cod_ref:cod,razon_ref:$('ncRazon').value.trim(),motivo:$('ncMot').value.trim()};
      if(cod!==1&&cod!==3){modal.error('Elige anular o corregir monto.');return false;}
      if(cod===3){var m=montoDesdeTexto($('ncMonto').value);if(m===null){modal.error(ERR.TOTAL_CONFIRMADO_FORMATO);return false;}if(m>disp){modal.error(ERR.SUPERA_SALDO_NO_ANULADO);return false;}p.monto=m;}
      if(p.razon_ref.length<5||p.razon_ref.length>90){modal.error(ERR.RAZON_REF_INVALIDA);return false;}
      if(p.motivo.length<10){modal.error(ERR.MOTIVO_OBLIGATORIO);return false;}
      if(/honorario/i.test(p.razon_ref+' '+p.motivo)){modal.error(ERR.TEXTO_NO_PERMITIDO);return false;}
      correr(rpc('nota_credito_crear',{p_factura:fid,p:p}),function(r){return 'Nota '+(r&&r.codigo||'')+' creada y enviada al Master.';},true);return false;}});
    anchoModal();
  }).catch(function(e){toast(I('alerta','ic-amb')+' '+esc(msg(e)));});
}
document.addEventListener('change',function(e){
  if(e.target&&e.target.name==='ncCod'){var bx=$('ncMontoBox');if(bx)bx.hidden=e.target.value!=='3';var rz=$('ncRazon');if(rz&&(rz.value==='Corrige monto'||rz.value==='Anula factura emitida por error'))rz.value=e.target.value==='3'?'Corrige monto':'Anula factura emitida por error';}
});
function descargar(n,tipo){
  sbGet('facturas_adicionales_nc_documentos?select='+tipo+'_b64&nota_id=eq.'+n.id).then(function(r){
    var b=r&&r[0]&&r[0][tipo+'_b64'];if(!b){toast(I('alerta','ic-amb')+' Documento no disponible.');return;}
    var bin=atob(b),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    var url=URL.createObjectURL(new Blob([u],{type:tipo==='pdf'?'application/pdf':'application/xml'}));
    var a=document.createElement('a');a.href=url;a.download='NotaCredito-61-'+(n.of_folio||n.codigo)+(n.modo==='PRUEBA'?'-PRUEBA':'')+'.'+tipo;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},4000);
  });
}
function resultado(r){
  if(!r)return 'Listo.';
  if(r.estado==='EMITIDA')return 'Nota de crédito emitida: N° '+r.folio+(r.documentos==='OBTENIDOS'?' · PDF y XML guardados.':' · PDF/XML pendientes.')+(r.cobranza==='REQUIERE_REVISION'?' Cobranza quedó por revisar a mano.':'');
  if(r.estado==='INCIERTO')return 'Resultado incierto: NO se reemite. El Master debe conciliar.';
  if(r.estado==='ERROR')return 'OpenFactura rechazó la nota ('+(r.codigo_proveedor||'')+'). No se emitió.';
  if(r.liberada)return 'No se envió a OpenFactura: '+msg({codigo:r.codigo});
  return 'Estado: '+(r.estado||'—');
}
function accion(act,id){
  if(act==='nueva')return abrirNueva(id);
  var n=porId(id);if(!n)return;
  if(act==='aprobar')return modal({t:'Aprobar nota de crédito',ic:'escudo',b:resumenNc(n),ok:'Aprobar',cb:function(){correr(rpc('nota_credito_aprobar',{p_nota:n.id,p_huella:n.snapshot_hash}),'Aprobada. Ya se puede emitir.',true);return false;}});
  if(act==='autoaprobar')return modal({t:'Auto-aprobar nota de crédito',ic:'escudo',icc:'ic-amb',
    b:'<p style="color:var(--amb)"><b>Estás aprobando una nota de crédito que creaste tú.</b> Quedará marcada y se avisará al equipo.</p>'+resumenNc(n)
     +'<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="ncConf" style="width:18px;height:18px;flex:none;margin:0"> Confirmo que revisé la nota y la apruebo</label>'
     +'<label style="margin-top:8px;display:block">Reescribe el monto de la nota (ej.: 10000 o 10.000)<input id="ncMontoConf" inputmode="numeric" autocomplete="off"></label>',
    ok:'Auto-aprobar',cb:function(){
      if(!$('ncConf').checked){modal.error(ERR.CONFIRMACION_OBLIGATORIA);return false;}
      var m=montoDesdeTexto($('ncMontoConf').value);if(m===null){modal.error(ERR.TOTAL_CONFIRMADO_FORMATO);return false;}
      if(m!==Number(n.monto)){modal.error(ERR.TOTAL_CONFIRMADO_NO_COINCIDE);return false;}
      correr(rpc('nota_credito_autoaprobar',{p_nota:n.id,p_huella:n.snapshot_hash,p_monto_confirmado:m,p_confirmo:true}),'Auto-aprobada. Ahora puedes emitirla en un paso aparte.',true);return false;}});
  if(act==='emitir'){var prod=n.modo==='PRODUCCION';
    if(prod){   // misma confirmación que "Emitir factura real" del rediseño: escribir REAL + reescribir el monto
      modal({t:'Emitir NOTA DE CRÉDITO REAL',ic:'factura',icc:'ic-roj',
        b:'<div class="fa-modal-real">'+I('alerta','ic-roj')+'<div><b>Atención: esta nota de crédito se emite en el SII</b> a nombre de Asesorías Contadoor Ltda. No se puede deshacer.</div></div>'+resumenNc(n)
         +'<div class="fa-confirma-real"><label for="faRealPal">1 · Escribe <b>REAL</b> para confirmar</label><input id="faRealPal" autocomplete="off" spellcheck="false" placeholder="REAL">'
         +'<label for="faRealTot">2 · Reescribe el monto de la nota (ej.: 10000 o 10.000)</label><input id="faRealTot" inputmode="numeric" placeholder="Ej.: 10.000" autocomplete="off"></div>',
        ok:'Sí, emitir nota de crédito real',cls:'pri fa-btn-real',cb:function(){
          if(String($('faRealPal').value||'').trim().toUpperCase()!=='REAL'){modal.error(ERR.PALABRA_REAL);$('faRealPal').focus();return false;}
          var m=montoDesdeTexto($('faRealTot').value);if(m===null){modal.error(ERR.TOTAL_CONFIRMADO_FORMATO);$('faRealTot').focus();return false;}
          if(m!==Number(n.monto)){modal.error(ERR.TOTAL_CONFIRMADO_NO_COINCIDE);$('faRealTot').focus();return false;}
          correr(edge('nc_emitir',n.id),resultado,true);return false;}});
      anchoModal();return;
    }
    modal({t:'Emitir nota de crédito (prueba)',ic:'probeta',icc:'ic-cel',
      b:'<div class="fa-modal-prueba">'+I('probeta','ic-cel')+'<div><b>Prueba · sin validez tributaria.</b> Se emite en el ambiente de pruebas de OpenFactura.</div></div>'+resumenNc(n),
      ok:'Emitir prueba',cb:function(){correr(edge('nc_emitir',n.id),resultado,true);return false;}});
    anchoModal();return;}
  if(act==='conciliar')return modal({t:'Conciliar nota de crédito',ic:'repetir',icc:'ic-ama',
      b:'<p>Gestoor consulta el documento por su token o reenvía el <b>mismo</b> documento con la <b>misma</b> clave (nunca se emite dos veces).</p><label>Token en OpenFactura (opcional)<input id="ncTok" maxlength="64" placeholder="64 caracteres"></label>',
      ok:'Conciliar',cb:function(){var t=$('ncTok').value.trim().toLowerCase();if(t&&!/^[0-9a-f]{64}$/.test(t)){modal.error(ERR.TOKEN_INVALIDO);return false;}
        correr(edge('nc_conciliar',n.id,t?{token:t}:{}),function(r){return r.estado==='EMITIDA'?'Conciliada: emitida con N° '+r.folio+'.':(r.estado==='APROBADA'?'Confirmado: NO se emitió. Ya se puede emitir de nuevo.':'Sigue incierta: '+(r.ayuda||r.codigo||''));},true);return false;}});
  if(act==='anular')return modal({t:'Descartar nota de crédito',ic:'basura',icc:'ic-roj',b:'<label>Motivo (mínimo 10 caracteres)<textarea id="ncAnu" rows="3" maxlength="1000"></textarea></label>',ok:'Descartar',cls:'',
      cb:function(){var t=$('ncAnu').value.trim();if(t.length<10){modal.error(ERR.MOTIVO_OBLIGATORIO);return false;}correr(rpc('nota_credito_anular',{p_nota:n.id,p_motivo:t}),'Nota descartada.',true);return false;}});
  if(act==='cobranza')return correr(rpc('nota_credito_cobranza_reintentar',{p_nota:n.id}),function(r){return r&&r.cobranza_estado==='AJUSTADA'?'Cobranza ajustada.':'Cobranza sigue por revisar a mano.';},false);
  if(act==='documentos')return correr(edge('nc_documentos',n.id),function(r){return r.documentos==='OBTENIDOS'?'PDF y XML guardados.':'OpenFactura aún no entrega los documentos.';},false);
  if(act==='pdf'||act==='xml')return descargar(n,act);
}
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-nc]');if(!b||b.disabled)return;
  e.stopPropagation();accion(b.getAttribute('data-nc'),+b.getAttribute('data-id'));
});
/* Enlace de los avisos: ?nc=<id> → resalta la NC (la pantalla ya ubicó la factura con ?fa=). */
var ENLACE_NC=(function(){try{var v=new URLSearchParams(location.search).get('nc');return v&&/^[0-9]{1,18}$/.test(v)?+v:null;}catch(e){return null;}})();
function resaltarEnlace(){
  if(ENLACE_NC===null)return;var el=document.querySelector('[data-nc-fila="'+ENLACE_NC+'"]');if(!el)return;
  S.marca={id:ENLACE_NC,hasta:Date.now()+6000};ENLACE_NC=null;   // sobrevive a un redibujo durante 6 s
  if(el.scrollIntoView)el.scrollIntoView({behavior:'smooth',block:'center'});el.style.outline='2px solid var(--ama)';el.style.outlineOffset='3px';
  setTimeout(function(){var x=document.querySelector('[data-nc-fila="'+(S.marca&&S.marca.id)+'"]');if(x)x.style.outline='';S.marca=null;},6000);
}
window.FX_NC={cajaHtml:cajaHtml,cargar:cargar,alCambiar:function(fn){S.redibujar=fn;},resaltarEnlace:resaltarEnlace,_montoDesdeTexto:montoDesdeTexto};
})();
