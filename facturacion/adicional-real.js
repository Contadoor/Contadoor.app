/* ============================================================
   facturacion/adicional-real.js — "Facturación adicional" REAL (F1c)
   Factura puntual EXCEPCIONAL (decisión de Luciano 20-oct): el facturador la crea con motivo obligatorio,
   el Master la aprueba con la huella que vio y el facturador la emite (siempre factura exenta DTE 34).
   Motor: RPC factura_adicional_* (SQL 202610231900) · Emisión: Edge facturacion-emitir (OpenFactura).
   · PRUEBA: ambiente de pruebas de OpenFactura (sin SII, documento "sin validez tributaria").
   · PRODUCCION: bloqueado mientras facturacion_parametros.produccion_habilitada = false (el servidor lo exige igual).
   Solo se activa fuera del modo demo; en demo sigue el editor de adicional.js. Sin datos reales en este archivo.
   ============================================================ */
(function(){
'use strict';
if(window.FX_DEMO===true)return;                       // en demo manda adicional.js
var U=window.FX_UTIL, UI=window.FX_UI;
var ic=U.ic, I=U.I, esc=U.esc, clp=U.clp;
var modal=UI.modal, toast=UI.toast, cerrarModal=UI.cerrarModal;
var EDGE=(typeof SB_URL!=='undefined'?SB_URL:'')+'/functions/v1/facturacion-emitir';
var CTX={rol:'lectura',lista:[],clientes:{},clientesLista:[],prodHabilitada:false,ocupado:false,cargado:false,sel:null};
function $(id){return document.getElementById(id);}
function hoyCL(){var d=new Date(Date.now()-new Date().getTimezoneOffset()*60000);return d.toISOString().slice(0,10);}
function sumarDias(iso,n){var t=new Date(iso+'T12:00:00');t.setDate(t.getDate()+n);return t.toISOString().slice(0,10);}
function fFecha(iso){if(!iso)return '—';var p=String(iso).slice(0,10).split('-');return p[2]+'-'+p[1]+'-'+p[0];}

var EST={BORRADOR:['Borrador','gris'],EN_REVISION:['En revisión del Master','cel'],DEVUELTA:['Devuelta','amb'],APROBADA:['Aprobada · lista para emitir','ver'],
  EMITIENDO:['Emitiendo…','cel'],INCIERTO:['Incierta · por conciliar','ama'],EMITIDA:['Emitida','ver'],ERROR:['Rechazada por OpenFactura','roj'],ANULADA:['Anulada','gris']};
var ERR={
  SOLO_FACTURADOR:'Esta acción la hace solo el facturador (rol Pagos o módulo Facturación).',
  SOLO_MASTER:'Esta acción la hace solo el Master.',
  CAMPO_NO_PERMITIDO:'Hay un dato que no corresponde. Recarga la pantalla.',
  MOTIVO_OBLIGATORIO:'El motivo es obligatorio: explica por qué es una factura excepcional (10 a 500 caracteres).',
  MOTIVO_ANULACION:'El motivo de la anulación es obligatorio (mínimo 10 caracteres).',
  TEXTO_NO_PERMITIDO:'No uses la palabra "honorarios": escribe "nuestros servicios".',
  GLOSA_INVALIDA:'Cada glosa debe tener entre 3 y 80 caracteres.',
  DETALLE_INVALIDO:'El detalle de una línea es demasiado largo (máximo 1000).',
  CANTIDAD_INVALIDA:'La cantidad debe ser un número entero entre 1 y 1000.',
  MONTO_INVALIDO:'El precio debe ser en pesos enteros, mayor a $0.',
  LINEAS_INVALIDAS:'La factura debe tener entre 1 y 10 líneas.',
  LINEA_CAMPO_NO_PERMITIDO:'Una línea trae un dato que no corresponde. Recarga la pantalla.',
  FECHA_INVALIDA:'Revisa las fechas.',
  FECHA_EMISION_FUERA_DE_RANGO:'La fecha de emisión debe estar entre 5 días atrás y hoy (al emitir). Si cambió, el Master la devuelve y se corrige.',
  FECHA_VENCIMIENTO_OBLIGATORIA:'Con crédito indica la fecha de vencimiento.',
  FECHA_VENCIMIENTO_INVALIDA:'El vencimiento debe estar entre 1 y 90 días después de la emisión.',
  FORMA_PAGO_INVALIDA:'Elige contado o crédito.',
  CLIENTE_NO_EXISTE:'Elige un cliente de la lista.',
  FICHA_INCOMPLETA:'La ficha del cliente está incompleta.',
  NO_EDITABLE:'La factura ya no se puede modificar en su estado actual. Recarga.',
  NO_EN_REVISION:'La factura ya no está en revisión (otra persona pudo actuar). Recarga.',
  HUELLA_NO_COINCIDE:'La factura cambió desde que la abriste: recarga y revísala de nuevo antes de aprobar.',
  COMENTARIO_OBLIGATORIO:'El comentario es obligatorio (mínimo 5 caracteres).',
  NO_DEVOLVIBLE:'Ya no se puede devolver: hubo un intento de emisión.',
  NO_ANULABLE:'No se puede anular: pudo llegar a OpenFactura (concilia primero) o ya está emitida (se corrige con nota de crédito).',
  SIN_APROBACION:'Falta la aprobación del Master.',
  PRODUCCION_DESHABILITADA:'La emisión real está apagada: requiere el GO de producción.',
  PRODUCCION_NO_HABILITADA_EN_EDGE:'La emisión real está apagada en el servidor (falta el GO de producción).',
  YA_EMITIDA:'Esta factura ya está emitida: no se vuelve a emitir.',
  REQUIERE_CONCILIACION:'Resultado incierto: el Master debe conciliar con OpenFactura antes de cualquier reintento.',
  EN_CURSO:'La factura ya se está emitiendo. Espera y recarga.',
  NO_INCIERTA:'Solo se concilian facturas inciertas.',
  TOKEN_INVALIDO:'El token debe tener 64 caracteres (letras a–f y números).',
  SIN_SESION:'Tu sesión no está activa. Vuelve a ingresar.',
  SOLO_FACTURACION:'No tienes acceso a la lista de clientes de Facturación (Master, Pagos, Cobranza o módulo Facturación).',
  CONFIG_DEV_INCOMPLETA:'Falta configurar el ambiente de pruebas en el servidor. Avisa a soporte.'
};
function msg(e){
  var m=String(e&&(e.codigo||e.message)||'');
  var code=(m.match(/^([A-Z_]{4,})/)||[])[1];
  if(code==='FICHA_INCOMPLETA'){var d=m.split(':').slice(2).join(':').trim();return ERR.FICHA_INCOMPLETA+(d?' Completa en Clientes: '+d+'.':'');}
  if(code&&ERR[code])return ERR[code];
  if(m==='GESTOOR_NO_SESSION')return ERR.SIN_SESION;
  if(/Failed to fetch|NetworkError/i.test(m))return 'No hay conexión con el servidor. Revisa internet y vuelve a intentar.';
  return 'El motor rechazó la acción ('+(code||'error')+'). No se guardó nada.';
}

/* ── Datos ── */
function rpc(fn,args){
  return sbFetch('rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||{})}).then(function(r){
    if(r.ok)return r.status===204?null:r.json();
    return r.text().then(function(t){var j={};try{j=JSON.parse(t);}catch(x){}var e=new Error(j.message||t||('HTTP '+r.status));throw e;});
  });
}
function edge(accion,id,extra){
  var h;try{h=sbH();}catch(e){return Promise.reject(e);}   // JWT del usuario; sin sesión no se llama
  return fetch(EDGE,{method:'POST',headers:h,body:JSON.stringify(Object.assign({accion:accion,factura_id:id},extra||{}))}).then(function(r){
    return r.json().catch(function(){return {};}).then(function(j){if(!r.ok){var e=new Error(j.error||('HTTP '+r.status));e.codigo=j.error;throw e;}return j;});
  });
}
function cargar(){
  return Promise.all([
    sbGet('facturas_adicionales?select=id,codigo,modo,estado,cliente_id,motivo,lineas,total,fecha_emision,fecha_vencimiento,forma_pago,alertas,snapshot,snapshot_hash,comentario_devolucion,of_folio,of_track_id,total_dte,error,doc_estado,correo_estado,cobranza_documento_id,creado_at,aprobada_at,emitida_at&order=creado_at.desc&limit=200'),
    sbGet('facturacion_parametros?select=produccion_habilitada&id=eq.1'),
    CTX.clientesLista.length?Promise.resolve(null):rpc('fact_clientes_lista',{p_incluir_inactivos:true})   // RPC: Facturación ve todos los clientes sin abrir la RLS de clientes; el selector filtra 'activo' abajo
  ]).then(function(r){
    CTX.lista=r[0]||[];CTX.prodHabilitada=!!(r[1]&&r[1][0]&&r[1][0].produccion_habilitada);
    if(r[2]){CTX.clientesLista=r[2].filter(function(c){return String(c.estado||'').toLowerCase()==='activo';});r[2].forEach(function(c){CTX.clientes[c.id]=c;});}
    CTX.cargado=true;
  });
}

/* ── Vista ── */
function chipEst(e){var x=EST[e]||[e,'gris'];return '<span class="fx-est '+x[1]+'">'+esc(x[0])+'</span>';}
function cli(id){var c=CTX.clientes[id];return c?c.razon_social:'Cliente #'+id;}
function rutCli(id){var c=CTX.clientes[id];return c?c.rut:'';}
function esF(){return CTX.rol==='facturador';}
function esM(){return CTX.rol==='master';}
function bot(act,id,txt,icn,cls,ok,tip){
  return '<span class="tipw" tabindex="'+(ok?'-1':'0')+'" data-tip="'+esc(tip||'')+'"><button type="button" class="g-btn sm '+(cls||'')+'" data-fa="'+act+'" data-id="'+id+'"'+(ok&&!CTX.ocupado?'':' disabled')+'>'+I(icn,ok?'':'')+esc(txt)+'</button></span>';
}
function acciones(x){
  var a=[], prod=x.modo==='PRODUCCION';
  if(esF()&&(x.estado==='BORRADOR'||x.estado==='DEVUELTA')){a.push(bot('editar',x.id,'Editar','lapiz','',true,''));a.push(bot('enviar',x.id,'Enviar a aprobación','enviar','pri',true,'Congela el contenido y lo envía al Master.'));}
  if(esM()&&x.estado==='EN_REVISION'){a.push(bot('aprobar',x.id,'Aprobar','aprobar','pri',true,'Apruebas exactamente lo que ves (huella).'));a.push(bot('devolver',x.id,'Devolver','devolver','',true,''));}
  if(esM()&&x.estado==='APROBADA')a.push(bot('devolver',x.id,'Devolver','devolver','',true,'Solo si aún no hubo intento de emisión.'));
  if(x.estado==='APROBADA'||x.estado==='ERROR'||x.estado==='EN_REVISION'||x.estado==='BORRADOR'||x.estado==='DEVUELTA'){
    var puede=esF()&&(x.estado==='APROBADA'||x.estado==='ERROR')&&(!prod||CTX.prodHabilitada);
    var tip=!esF()?'Emite el facturador.':(x.estado!=='APROBADA'&&x.estado!=='ERROR'?'Bloqueado: falta la aprobación del Master.':(prod&&!CTX.prodHabilitada?'Bloqueado: la emisión real requiere el GO de producción.':(prod?'Emite la factura REAL en el SII.':'Emite en el ambiente de pruebas de OpenFactura (sin SII).')));
    a.push(bot('emitir',x.id,prod?'Emitir factura real':'Emitir (prueba)','enviar',puede?'pri':'',puede,tip));
  }
  if(esM()&&x.estado==='INCIERTO')a.push(bot('conciliar',x.id,'Conciliar con OpenFactura','repetir','pri',true,'Busca el documento con la misma clave; nunca emite dos veces.'));
  if(x.estado==='EMITIDA'&&x.doc_estado==='OBTENIDOS'){a.push(bot('pdf',x.id,'PDF','bajar','',true,'PDF oficial de OpenFactura'));a.push(bot('xml',x.id,'XML','bajar','',true,'XML firmado'));}
  if(x.estado==='EMITIDA'&&x.doc_estado!=='OBTENIDOS'&&(esF()||esM()))a.push(bot('documentos',x.id,'Traer PDF y XML','repetir','',true,'Vuelve a pedir los documentos (no reemite).'));
  if(esM()&&['BORRADOR','EN_REVISION','DEVUELTA','APROBADA','ERROR'].indexOf(x.estado)>=0)a.push(bot('anular',x.id,'Anular','basura','',true,''));
  return a.join('');
}
function tarjeta(x){
  var prod=x.modo==='PRODUCCION', lin=x.lineas||[];
  return '<div class="cot manual"><div class="h"><span class="chip c-manualf" title="Factura excepcional: motivo obligatorio y aprobación del Master">'+esc(x.codigo)+'</span>'
   +'<span class="'+(prod?'fx-est roj':'fx-est cel')+'" title="'+(prod?'Factura real (SII)':'Ambiente de pruebas, sin SII')+'">'+(prod?'REAL':'PRUEBA')+'</span>'+chipEst(x.estado)+'</div>'
   +'<b class="sv">'+esc(lin.length?lin[0].glosa+(lin.length>1?' + '+(lin.length-1)+' más':''):'—')+'</b>'
   +'<div class="fila"><span>Cliente</span><span>'+esc(cli(x.cliente_id))+'<span class="sub">'+esc(rutCli(x.cliente_id))+'</span></span></div>'
   +'<div class="fila"><span>Emisión · vencimiento</span><span>'+fFecha(x.fecha_emision)+' · '+(x.forma_pago===1?'Contado':fFecha(x.fecha_vencimiento))+'</span></div>'
   +'<div class="fila"><span>Monto exento (DTE 34)</span><span class="monto cifra">'+clp(+x.total)+'</span></div>'
   +(x.of_folio?'<div class="fila"><span>Folio</span><span class="cifra"><b>N° '+esc(x.of_folio)+'</b>'+(x.total_dte!=null&&+x.total_dte!==+x.total?' <span class="fx-est roj">total DTE '+clp(+x.total_dte)+'</span>':'')+'</span></div>':'')
   +'<div class="mot"><b>Motivo:</b> '+esc(x.motivo)+'</div>'
   +(x.comentario_devolucion&&x.estado==='DEVUELTA'?'<div class="mot" style="background:rgba(224,122,110,.08)"><b>Comentario del Master:</b> '+esc(x.comentario_devolucion)+'</div>':'')
   +((x.alertas||[]).length?'<div class="mot" style="background:rgba(255,210,77,.08)"><b>Alertas:</b> '+(x.alertas||[]).map(function(a){return esc({POSIBLE_DUPLICADO:'posible duplicado (mismo cliente y monto en 30 días)',TOTAL_DTE_DIFIERE:'el total del DTE difiere del aprobado',COBRANZA_NO_REGISTRADA:'no entró a Cobranza: registrarla a mano'}[a.codigo]||a.codigo);}).join(' · ')+'</div>':'')
   +(x.estado==='INCIERTO'?'<div class="mot" style="background:rgba(255,210,77,.1)"><b>No reemitir.</b> OpenFactura no confirmó el resultado. El Master concilia: Gestoor busca el documento con la misma clave (nunca emite dos veces).</div>':'')
   +(x.estado==='EMITIDA'&&prod?'<div class="fila"><span>Cobranza</span><span>'+(x.cobranza_documento_id?'Pendiente de pago en la cartera':'—')+'</span></div>':'')
   +'<div class="acc" style="flex-wrap:wrap;gap:8px">'+acciones(x)+'</div></div>';
}
function render(){
  var v=$('vistaAdic');if(!v)return;
  var nuevo=esF()?'<button type="button" class="g-btn sm pri" data-fa="nueva" data-id="0">'+I('mas')+'Nueva factura adicional</button>':'<span class="sub">Las crea el facturador; el Master las aprueba.</span>';
  v.innerHTML='<div class="g-sec-h"><i class="ic placa ic-ama" data-ic="factura"></i><h2>Facturación <span>adicional</span></h2><small>Factura puntual excepcional · siempre exenta (DTE 34) · motivo obligatorio y aprobación del Master</small></div>'
   +'<div class="flujo" aria-label="Pasos"><span class="fp">'+I('lapiz','ic-cel')+'<b>Facturador la crea</b></span><span class="fl">→</span><span class="fp">'+I('escudo','ic-mor')+'<b>Master aprueba</b></span><span class="fl">→</span><span class="fp">'+I('enviar','ic-ver')+'<b>Facturador emite</b></span><span class="fl">→</span><span class="fp">'+I('factura','ic-ama')+'<b>Folio, PDF y XML</b></span></div>'
   +'<div style="display:flex;gap:10px;align-items:center;margin:6px 0 14px">'+nuevo+'<span class="g-espacio" style="flex:1"></span><span class="sub">Emisión real: <b style="color:'+(CTX.prodHabilitada?'var(--ver)':'var(--amb)')+'">'+(CTX.prodHabilitada?'habilitada':'apagada (GO pendiente)')+'</b></span></div>'
   +(CTX.cargado?'':'<p class="ninguna">Cargando…</p>')
   +'<div class="cot-grid">'+(CTX.lista.map(tarjeta).join('')||(CTX.cargado?'<p class="ninguna">No hay facturas adicionales.</p>':''))+'</div>';
  var man=CTX.lista.length, rev=CTX.lista.filter(function(x){return x.estado==='EN_REVISION';}).length, inc=CTX.lista.filter(function(x){return x.estado==='INCIERTO';}).length;
  var emit=CTX.lista.filter(function(x){return x.estado==='EMITIDA';}).reduce(function(a,x){return a+ +x.total;},0);
  $('hero').innerHTML='<div class="hero-top"><div><small class="k">Facturas excepcionales</small><h2>Facturación <span>adicional</span></h2>'
   +'<div class="meta"><span class="it">'+I('factura','ic-mor')+'Factura exenta <b>DTE 34</b></span><span class="it">'+I('escudo','ic-cel')+'Siempre con aprobación del Master</span></div></div>'
   +'<div class="estado-lote"><span class="prueba">'+ic('probeta')+(CTX.prodHabilitada?'PRUEBA Y REAL':'MODO PRUEBA')+'</span></div></div>'
   +'<div class="fx-kpis"><div class="fx-kpi"><span class="l">Facturas</span><span class="v cifra">'+man+'</span><span class="s">Últimas 200</span></div>'
   +'<div class="fx-kpi"><span class="l">En revisión del Master</span><span class="v cifra">'+rev+'</span><span class="s">Esperan aprobar o devolver</span></div>'
   +'<div class="fx-kpi"><span class="l">Inciertas</span><span class="v cifra" style="color:'+(inc?'var(--ama)':'inherit')+'">'+inc+'</span><span class="s">El Master concilia</span></div>'
   +'<div class="fx-kpi"><span class="l">Emitido</span><span class="v cifra">'+clp(emit)+'</span><span class="s">Prueba + real</span></div></div>';
}
function recargar(){return cargar().then(render).catch(function(e){toast(I('alerta','ic-amb')+' '+esc(msg(e)));});}

/* ── Formulario (crear / editar) ── */
function filaLinea(l,i){
  l=l||{};
  return '<div class="fa-lin" data-i="'+i+'" style="display:grid;grid-template-columns:1fr 70px 120px 30px;gap:6px;margin-bottom:6px">'
   +'<input class="fa-g" maxlength="80" placeholder="Glosa (3 a 80 caracteres)" value="'+esc(l.glosa||'')+'" aria-label="Glosa línea '+(i+1)+'">'
   +'<input class="fa-q" type="number" min="1" max="1000" step="1" value="'+(l.cantidad||1)+'" aria-label="Cantidad">'
   +'<input class="fa-p" type="number" min="1" step="1" placeholder="Precio $" value="'+(l.precio||'')+'" aria-label="Precio unitario en pesos">'
   +'<button type="button" class="g-ico" data-fa-quitar="'+i+'" aria-label="Quitar línea">'+ic('cerrar')+'</button>'
   +'<input class="fa-d" maxlength="1000" placeholder="Detalle (opcional)" value="'+esc(l.detalle||'')+'" style="grid-column:1/-1" aria-label="Detalle"></div>';
}
function leerForm(){
  var lin=[].slice.call(document.querySelectorAll('#mBody .fa-lin')).map(function(r){
    var o={glosa:r.querySelector('.fa-g').value.trim(),cantidad:parseInt(r.querySelector('.fa-q').value,10),precio:Number(r.querySelector('.fa-p').value)};
    var d=r.querySelector('.fa-d').value.trim();if(d)o.detalle=d;return o;
  });
  var fp=+$('faFp').value;
  var o={motivo:$('faMot').value.trim(),fecha_emision:$('faFe').value,forma_pago:fp,lineas:lin};
  if(fp===2)o.fecha_vencimiento=$('faFv').value;
  return o;
}
function totalForm(){var t=0;document.querySelectorAll('#mBody .fa-lin').forEach(function(r){var q=parseInt(r.querySelector('.fa-q').value,10)||0,p=Number(r.querySelector('.fa-p').value)||0;t+=q*p;});var el=$('faTot');if(el)el.textContent=clp(t);}
function abrirForm(x){
  var nuevo=!x, hoy=hoyCL();
  var opts=CTX.clientesLista.map(function(c){return '<option value="'+c.id+'"'+(x&&x.cliente_id===c.id?' selected':'')+'>'+esc(c.razon_social+' · '+c.rut)+'</option>';}).join('');
  var b='<div class="fa-form" style="display:grid;gap:10px;max-height:62vh;overflow:auto;padding-right:4px">'
   +(nuevo?'<label>Cliente<select id="faCli" aria-label="Cliente"><option value="">Elige un cliente…</option>'+opts+'</select></label>'
          +'<label>Tipo<select id="faModo" aria-label="Modo"><option value="PRUEBA">Prueba (OpenFactura sin SII)</option><option value="PRODUCCION">Real (SII) · requiere GO para emitir</option></select></label>'
          :'<p class="sub">'+esc(x.codigo)+' · '+esc(cli(x.cliente_id))+' · '+(x.modo==='PRODUCCION'?'REAL':'PRUEBA')+'</p>')
   +'<label>Motivo (por qué es una factura excepcional)<textarea id="faMot" rows="2" maxlength="500" placeholder="Ej.: trabajo adicional solicitado por el cliente en octubre">'+esc(x?x.motivo:'')+'</textarea></label>'
   +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">'
   +'<label>Fecha de emisión<input id="faFe" type="date" value="'+(x?String(x.fecha_emision).slice(0,10):hoy)+'"></label>'
   +'<label>Condición de pago<select id="faFp"><option value="2"'+(!x||x.forma_pago===2?' selected':'')+'>Crédito</option><option value="1"'+(x&&x.forma_pago===1?' selected':'')+'>Contado</option></select></label>'
   +'<label>Vencimiento<input id="faFv" type="date" value="'+(x?String(x.fecha_vencimiento).slice(0,10):sumarDias(hoy,20))+'"></label></div>'
   +'<div><b style="font-size:13px">Líneas</b> <span class="sub">exentas · pesos enteros · máximo 10</span></div>'
   +'<div id="faLins">'+((x?x.lineas:[{}]).map(filaLinea).join(''))+'</div>'
   +'<div style="display:flex;align-items:center;gap:10px"><button type="button" class="btn-link" data-fa-mas="1">'+I('mas','ic-ama')+'Agregar línea</button><span style="margin-left:auto">Total exento: <b class="cifra" id="faTot">$0</b></span></div>'
   +'<p class="sub">Receptor: datos de la ficha del cliente (RUT, razón social, giro, dirección, comuna y correo). En prueba, OpenFactura usa un receptor de demostración y el correo va solo a info@contadoor.cl.</p></div>';
  modal({t:nuevo?'Nueva factura adicional':'Editar factura adicional',ic:'factura',icc:'ic-ama',b:b,ok:nuevo?'Crear borrador':'Guardar cambios',cb:function(){
    var o=leerForm();
    if(nuevo){var c=$('faCli').value;if(!c){modal.error(ERR.CLIENTE_NO_EXISTE);return false;}o.cliente_id=+c;o.modo=$('faModo').value;}
    if(o.motivo.length<10){modal.error(ERR.MOTIVO_OBLIGATORIO);return false;}
    if(/honorario/i.test(o.motivo+JSON.stringify(o.lineas))){modal.error(ERR.TEXTO_NO_PERMITIDO);return false;}
    for(var i=0;i<o.lineas.length;i++){var l=o.lineas[i];if(l.glosa.length<3)return modal.error(ERR.GLOSA_INVALIDA),false;if(!(l.cantidad>=1&&l.cantidad<=1000))return modal.error(ERR.CANTIDAD_INVALIDA),false;if(!(Number.isInteger(l.precio)&&l.precio>0))return modal.error(ERR.MONTO_INVALIDO),false;}
    correr(nuevo?rpc('factura_adicional_crear',{p:o}):rpc('factura_adicional_editar',{p_factura:x.id,p:o}),nuevo?'Borrador creado.':'Cambios guardados.',true);
    return false;
  }});
  var mm=$('modal');mm.classList.add('fa-ancho');mm.style.width='min(760px, calc(100% - 32px))';
  totalForm();
}
document.addEventListener('input',function(e){if(e.target.closest('#mBody .fa-form'))totalForm();});
document.addEventListener('click',function(e){
  var mas=e.target.closest('[data-fa-mas]'), q=e.target.closest('[data-fa-quitar]');
  if(mas){var c=$('faLins');if(c.children.length>=10)return;c.insertAdjacentHTML('beforeend',filaLinea({},c.children.length));return;}
  if(q){var cc=$('faLins');if(cc.children.length>1)q.closest('.fa-lin').remove();totalForm();return;}
});
// Al cerrar la ventana se restaura su ancho normal
new MutationObserver(function(){var m=$('modal');if(m&&!m.classList.contains('on')&&m.classList.contains('fa-ancho')){m.classList.remove('fa-ancho');m.style.width='';}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});

/* ── Ejecutar acciones ── */
function correr(p,ok,enModal){
  if(CTX.ocupado)return;CTX.ocupado=true;var si=document.querySelector('#mFoot [data-m="si"]');if(si){si.disabled=true;si.textContent='Procesando…';}
  render();
  return p.then(function(r){CTX.ocupado=false;if(enModal)cerrarModal();toast(I('aprobar','ic-ver')+' '+esc(typeof ok==='function'?ok(r):ok));return recargar();})
   .catch(function(e){CTX.ocupado=false;var m=msg(e);if(enModal&&$('modal').classList.contains('on')){modal.error(m);var b=document.querySelector('#mFoot [data-m="si"]');if(b){b.disabled=false;b.textContent='Reintentar';}}else toast(I('alerta','ic-amb')+' '+esc(m));render();});
}
function resultadoEmision(r){
  if(!r)return 'Listo.';
  if(r.estado==='EMITIDA')return 'Emitida: folio N° '+r.folio+(r.documentos==='OBTENIDOS'?' · PDF y XML guardados.':' · PDF/XML pendientes (usa "Traer PDF y XML").');
  if(r.estado==='INCIERTO')return 'Resultado incierto: NO se reemite. El Master debe conciliar.';
  if(r.estado==='ERROR')return 'OpenFactura rechazó el documento ('+(r.codigo_proveedor||'')+'). No se emitió.';
  if(r.liberada)return 'No se envió a OpenFactura: '+msg({codigo:r.codigo});
  return 'Estado: '+(r.estado||'—')+(r.codigo?' ('+r.codigo+')':'');
}
function descargar(x,tipo){
  sbGet('facturas_adicionales_documentos?select='+tipo+'_b64&factura_id=eq.'+x.id).then(function(r){
    var b=r&&r[0]&&r[0][tipo+'_b64'];if(!b){toast(I('alerta','ic-amb')+' Documento no disponible.');return;}
    var bin=atob(b),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    var url=URL.createObjectURL(new Blob([u],{type:tipo==='pdf'?'application/pdf':'application/xml'}));
    var a=document.createElement('a');a.href=url;a.download='Factura-34-'+(x.of_folio||x.codigo)+(x.modo==='PRUEBA'?'-PRUEBA':'')+'.'+tipo;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},4000);
  });
}
function resumenRevision(x){
  var s=x.snapshot||{}, rf=s.receptor_ficha||{};
  return '<div style="display:grid;gap:6px;font-size:13px;max-height:52vh;overflow:auto">'
   +'<div><b>'+esc(x.codigo)+'</b> · '+(x.modo==='PRODUCCION'?'<b style="color:var(--roj)">FACTURA REAL</b>':'prueba (sin SII)')+'</div>'
   +'<div>Receptor: <b>'+esc(rf.razon_social||cli(x.cliente_id))+'</b> · '+esc(rf.rut||'')+'<br><span class="sub">'+esc((rf.giro||'')+' · '+(rf.direccion||'')+', '+(rf.comuna||''))+'</span></div>'
   +'<div>Emisión '+fFecha(s.fecha_emision)+' · '+esc(s.termino_pago||'')+' · correo a '+esc(s.correo_destino||'')+'</div>'
   +(s.detalle||[]).map(function(d){return '<div style="display:flex;gap:10px;align-items:flex-start;border-top:1px solid rgba(255,255,255,.08);padding-top:6px"><div style="flex:1;min-width:0">'+esc(d.NmbItem)+(d.DscItem?'<br><span class="sub">'+esc(d.DscItem)+'</span>':'')+'</div><div style="white-space:nowrap" class="sub">'+d.QtyItem+' × '+clp(d.PrcItem)+'</div><div style="white-space:nowrap;min-width:90px;text-align:right" class="cifra">'+clp(d.MontoItem)+'</div></div>';}).join('')
   +'<div style="text-align:right">Total exento: <b class="cifra">'+clp(+(s.montos||{}).total||0)+'</b></div>'
   +'<div class="mot"><b>Motivo:</b> '+esc(x.motivo)+'</div>'
   +'<div class="sub">Emisor: '+esc((s.emisor||{}).RznSoc||'')+' · '+esc((s.emisor||{}).RUTEmisor||'')+' · '+esc((s.emisor||{}).DirOrigen||'')+'</div></div>';
}
function accion(act,id){
  var x=CTX.lista.filter(function(y){return y.id===id;})[0];
  if(act==='nueva')return abrirForm(null);
  if(!x)return;
  if(act==='editar')return abrirForm(x);
  if(act==='enviar')return modal({t:'Enviar a aprobación',ic:'enviar',b:'<p>Se congela el contenido de <b>'+esc(x.codigo)+'</b> ('+clp(+x.total)+') y se envía al Master. Si falta algo en la ficha del cliente, se te avisará.</p>',ok:'Enviar',cb:function(){correr(rpc('factura_adicional_enviar',{p_factura:x.id}),'Enviada al Master.',true);return false;}});
  if(act==='aprobar')return modal({t:'Aprobar factura',ic:'escudo',b:resumenRevision(x),ok:'Aprobar',cb:function(){correr(rpc('factura_adicional_aprobar',{p_factura:x.id,p_huella:x.snapshot_hash}),'Aprobada. El facturador ya puede emitir.',true);return false;}});
  if(act==='devolver')return modal({t:'Devolver al facturador',ic:'devolver',icc:'ic-amb',b:'<label>¿Qué hay que corregir?<textarea id="faCom" rows="3" maxlength="2000"></textarea></label>',ok:'Devolver',cls:'',cb:function(){var t=$('faCom').value.trim();if(t.length<5){modal.error(ERR.COMENTARIO_OBLIGATORIO);return false;}correr(rpc('factura_adicional_devolver',{p_factura:x.id,p_comentario:t}),'Devuelta al facturador.',true);return false;}});
  if(act==='anular')return modal({t:'Anular factura',ic:'basura',icc:'ic-roj',b:'<label>Motivo de la anulación (mínimo 10 caracteres)<textarea id="faAnu" rows="3" maxlength="1000"></textarea></label>',ok:'Anular',cls:'',cb:function(){var t=$('faAnu').value.trim();if(t.length<10){modal.error(ERR.MOTIVO_ANULACION);return false;}correr(rpc('factura_adicional_anular',{p_factura:x.id,p_motivo:t}),'Anulada.',true);return false;}});
  if(act==='emitir'){
    var prod=x.modo==='PRODUCCION';
    return modal({t:prod?'Emitir FACTURA REAL':'Emitir en prueba',ic:'enviar',icc:prod?'ic-roj':'ic-ver',
      b:resumenRevision(x)+(prod?'<p style="color:var(--roj)"><b>Atención:</b> esta factura se emite en el SII a nombre de Asesorías Contadoor. No se puede deshacer (solo con nota de crédito).</p>'
                                :'<p class="sub">Se emite en el ambiente de pruebas de OpenFactura: documento "sin validez tributaria", no va al SII.</p>'),
      ok:prod?'Sí, emitir factura real':'Emitir prueba',cls:prod?'pri':'pri',cb:function(){correr(edge('emitir',x.id),resultadoEmision,true);return false;}});
  }
  if(act==='conciliar')return modal({t:'Conciliar con OpenFactura',ic:'repetir',icc:'ic-ama',
      b:'<p>Gestoor consulta el documento por su token o reenvía el <b>mismo</b> documento con la <b>misma</b> clave (OpenFactura nunca lo emite dos veces).</p><label>Token del documento en OpenFactura (opcional: solo si lo encontraste en su panel)<input id="faTok" maxlength="64" placeholder="64 caracteres"></label>',
      ok:'Conciliar',cb:function(){var t=$('faTok').value.trim().toLowerCase();if(t&&!/^[0-9a-f]{64}$/.test(t)){modal.error(ERR.TOKEN_INVALIDO);return false;}
        correr(edge('conciliar',x.id,t?{token:t}:{}),function(r){return r.estado==='EMITIDA'?'Conciliada: emitida con folio N° '+r.folio+'.':(r.estado==='APROBADA'?'Confirmado: NO se emitió. Ya se puede emitir de nuevo.':'Sigue incierta: '+(r.ayuda||r.codigo||''));},true);return false;}});
  if(act==='documentos')return correr(edge('documentos',x.id),function(r){return r.documentos==='OBTENIDOS'?'PDF y XML guardados.':'OpenFactura aún no entrega los documentos; intenta en unos minutos.';},false);
  if(act==='pdf')return descargar(x,'pdf');
  if(act==='xml')return descargar(x,'xml');
}
document.addEventListener('click',function(e){
  var b=e.target.closest('#vistaAdic [data-fa]');if(!b||b.disabled)return;
  e.stopPropagation();accion(b.getAttribute('data-fa'),+b.getAttribute('data-id'));
});

window.FX_ADICIONAL={
  render:function(ctx){CTX.rol=ctx&&ctx.rol||'lectura';render();recargar();},
  cerrar:function(){}
};
})();
