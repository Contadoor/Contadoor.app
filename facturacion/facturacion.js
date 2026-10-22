/* ============================================================
   facturacion/facturacion.js — Pantalla "Facturación" de Gestoor (F1b)
   Lee el motor SQL F1a (facturacion_lotes, facturacion, facturacion_adicionales,
   facturacion_eventos, facturacion_historial) y llama SOLO sus RPC reales:
     facturacion_yo · facturacion_lote_preparar · facturacion_adicional_agregar ·
     facturacion_adicional_eliminar · facturacion_trabajadores_registrar ·
     facturacion_lote_enviar_revision · facturacion_lote_aprobar ·
     facturacion_lote_devolver · facturacion_lote_anular
   La emisión (reclamar/resultado/conciliar/correo) es de F1c/F1d: aquí "Emitir"
   queda siempre deshabilitado. En pantalla se dice "grupo" (en el motor: lote).
   Modo demostración: ver demo-datos.js (solo ?demo=1 en localhost).
   ============================================================ */
(function(){
'use strict';
var DEMO=window.FX_DEMO===true&&!!window.FX_DEMO_API;
var MODO='PRUEBA';   // F1b/F1c trabajan solo en PRUEBA; PRODUCCION llega con el GO de F1d.

/* ── Íconos (trazos Lucide, mismos que gestoor-menu.js) ── */
var P={
 clientes:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
 aprobar:'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
 calc:'<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8"/><path d="M16 14v4"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/>',
 factura:'<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>',
 grafico:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
 lista:'<path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="M18 9v6"/><path d="M21 12h-6"/>',
 correo:'<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
 calendario:'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
 personas:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
 enviar:'<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
 ver:'<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
 check:'<path d="M20 6 9 17l-5-5"/>',
 reloj:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
 alerta:'<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
 lapiz:'<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
 candado:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
 repetir:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
 devolver:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
 basura:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
 mas:'<path d="M5 12h14"/><path d="M12 5v14"/>',
 cerrar:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
 escudo:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
 probeta:'<path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/><path d="M14.5 16h-5"/>',
 pausa:'<circle cx="12" cy="12" r="10"/><path d="M10 15V9"/><path d="M14 15V9"/>',
 buscar:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
 regalo:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
 edificio:'<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/>',
 transferir:'<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
 subir:'<path d="m18 15-6-6-6 6"/>',
 bajar:'<path d="m6 9 6 6 6-6"/>'
};
function ic(n){return P[n]?'<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+P[n]+'</svg>':'';}
function I(n,c){return '<i class="ic '+(c||'')+'">'+ic(n)+'</i>';}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function clp(n){n=Number(n)||0;var s=Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');return (n<0?'−':'')+'$'+s;}
function sig(n){return n>0?'+'+clp(n):(n<0?clp(n):'$0');}
function ufFmt(n){var p=(Number(n)||0).toFixed(2).split('.');return p[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+p[1];}
function dec(n){return String(+(+n).toFixed(6)).replace('.',',');}
function fFecha(iso){if(!iso)return '—';var p=String(iso).slice(0,10).split('-');return p[2]+'-'+p[1]+'-'+p[0];}
function fHora(iso){if(!iso)return '';var d=new Date(iso);if(isNaN(d))return '';function z(n){return (n<10?'0':'')+n;}return z(d.getDate())+'-'+z(d.getMonth()+1)+'-'+d.getFullYear()+' · '+z(d.getHours())+':'+z(d.getMinutes());}
var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function mesTxt(per,cap){if(!per)return '';var m=MESES[+per.slice(5,7)-1]+' '+per.slice(0,4);return cap?m.charAt(0).toUpperCase()+m.slice(1):m;}
function rutN(r){return String(r||'').replace(/\./g,'').toUpperCase();}
window.FX_UTIL={ic:ic,I:I,esc:esc,clp:clp,sig:sig,ufFmt:ufFmt,dec:dec,fFecha:fFecha};

/* ── Acceso a datos: real (supabase.js) o demostración local ── */
function errMotor(status,texto){
  var j=null;try{j=JSON.parse(texto);}catch(e){}
  var e=new Error((j&&j.message)||texto||('HTTP '+status));
  e.fx={code:j&&j.code,message:(j&&j.message)||texto||'',status:status};
  return e;
}
var API=DEMO?window.FX_DEMO_API:{
  get:function(path){return sbGet(path);},   // sbGet: JWT del usuario, nunca la clave anon como Bearer
  rpc:function(fn,args){
    return sbFetch('rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||{})})
      .then(function(r){if(!r.ok)return r.text().then(function(t){throw errMotor(r.status,t);});return r.status===204?null:r.json();});
  }
};

/* ── Errores del motor → mensajes claros en español ── */
var ERRORES={
  SIN_SESION:'Tu sesión no está activa. Vuelve a ingresar a Gestoor.',
  SOLO_FACTURADOR:'Esta acción la hace solo el facturador (rol Pagos o módulo Facturación habilitado en Administración).',
  SOLO_MASTER:'Esta acción la hace solo el Master.',
  PERIODO_INVALIDO:'El período elegido no es válido.',
  TIPO_INVALIDO:'El grupo elegido no es válido (FIJO o VARIABLE).',
  MODO_INVALIDO:'El modo no es válido.',
  UF_NO_DISPONIBLE:'El período contable no está abierto en Panel de Control con la UF del día 1 del mes siguiente. Ábrelo allí y vuelve a intentar.',
  LOTE_NO_EDITABLE:'El grupo ya no se puede modificar: solo se edita en Borrador o Devuelto. Recarga para ver su estado actual.',
  LINEA_NO_EDITABLE:'Esta línea ya no se puede modificar en su estado actual.',
  LOTE_NO_EXISTE:'El grupo ya no existe. Recarga la pantalla.',
  LINEA_NO_EXISTE:'La línea ya no existe. Recarga la pantalla.',
  ADICIONAL_NO_EXISTE:'Ese adicional ya fue eliminado. Recarga la pantalla.',
  GLOSA_INVALIDA:'La glosa del adicional debe tener entre 3 y 80 caracteres.',
  MONTO_INVALIDO:'El monto debe ser en pesos enteros y mayor a $0.',
  NO_APLICA:'Los trabajadores solo se ingresan en el grupo VARIABLE.',
  CANTIDAD_INVALIDA:'La cantidad de trabajadores no es válida.',
  NOTA_OBLIGATORIA:'La nota es obligatoria: indica de dónde sale la cantidad (mínimo 5 caracteres).',
  REPORTE_FINALIZADO_EXISTE:'Este cliente ya tiene el reporte de remuneraciones del mes finalizado: manda esa cantidad, no se ingresa a mano. Usa "Recalcular grupo".',
  LOTE_BLOQUEADO:'El grupo está bloqueado por empresas con un tratamiento de facturación inválido (por ejemplo, "a través de" sin empresa relacionada o con la relacionada inactiva). Corrígelo en la ficha de Clientes y recalcula.',
  SIN_LINEAS_LISTAS:'No hay clientes listos para facturar en este grupo. Resuelve las líneas pendientes y recalcula.',
  LOTE_NO_EN_REVISION:'El grupo ya no está en revisión (otra persona pudo actuar). Recarga la pantalla.',
  HUELLA_NO_COINCIDE:'El grupo cambió desde que lo abriste: no es lo que revisaste. Recarga la pantalla y revísalo de nuevo antes de aprobar.',
  COMENTARIO_OBLIGATORIO:'El comentario es obligatorio: explica qué corregir (mínimo 5 caracteres).',
  MOTIVO_OBLIGATORIO:'El motivo es obligatorio (mínimo 10 caracteres).',
  LOTE_ANULADO:'El grupo ya está anulado.',
  LOTE_CON_EMISIONES:'No se puede anular: hay facturas emitidas, en emisión o por conciliar.',
  REDONDEO_INCONSISTENTE:'El motor detectó un problema de redondeo en una línea y no guardó nada. Avisa a soporte con el nombre del cliente.',
  DETALLE_NO_CUADRA:'El detalle de la factura no cuadra con el total y el motor no guardó nada. Avisa a soporte.'
};
function mensajeError(e){
  var fx=e&&e.fx||{}, m=fx.message||(e&&e.message)||'';
  if(e&&e.message==='GESTOOR_NO_SESSION')return ERRORES.SIN_SESION;
  var code=(m.match(/^([A-Z_]{4,}):?/)||[])[1];
  if(code&&ERRORES[code]){
    var extra='';
    if(code==='UF_NO_DISPONIBLE'||code==='LOTE_NO_EDITABLE'||code==='LINEA_NO_EDITABLE'||code==='LOTE_NO_EN_REVISION'){var d=m.split(':').slice(1).join(':').trim().replace(/\blote\b/g,'grupo').replace(/\bBORRADOR\b/,'Borrador').replace(/\bDEVUELTO\b/,'Devuelto').replace(/\bEN_REVISION\b/,'En revisión').replace(/\bAPROBADO\b/,'Aprobado').replace(/\bANULADO\b/,'Anulado');if(d)extra=' (Detalle del motor: '+d+')';}
    if(code==='LOTE_BLOQUEADO'){try{var b=JSON.parse(m.slice(m.indexOf('[')));extra=' Empresas: '+b.map(function(x){return x.rut+' ('+({SIN_PAGADOR:'sin empresa relacionada',PAGADOR_INACTIVO:'relacionada inactiva',PAGADOR_NO_NORMAL:'relacionada no factura normal'}[x.motivo]||x.motivo)+')';}).join(', ')+'.';}catch(x){}}
    return ERRORES[code]+extra;
  }
  if(fx.code==='23505')return 'Ya existe un grupo vigente para ese período y tipo. Recarga la pantalla.';
  if(fx.code==='42501'||fx.status===401||fx.status===403)return 'No tienes permiso para esta acción. Si crees que es un error, pídele al Master que revise tu acceso en Administración.';
  if(/Failed to fetch|NetworkError/i.test(m))return 'No hay conexión con el servidor. Revisa internet y vuelve a intentar.';
  return 'El motor rechazó la acción: '+(m||'error desconocido')+'. No se guardó nada.';
}

/* ── Estado de la pantalla ── */
var S={yo:null,periodos:[],periodo:null,vista:'FIJO',lote:null,lineas:[],adic:{},eventos:[],anterior:{},tab:'lineas',filtro:false,sel:null,dtab:'glosa',ocupado:false,cargando:true};
var $=function(id){return document.getElementById(id);};

var EST_LOTE={
 BORRADOR:['Borrador','fx-est gris','El facturador está preparando el grupo.'],
 DEVUELTO:['Devuelto','fx-est amb','El Master lo devolvió con un comentario. El facturador corrige y reenvía.'],
 EN_REVISION:['En revisión del Master','fx-est cel','Esperando que el Master apruebe o devuelva.'],
 APROBADO:['Aprobado','fx-est ver','Aprobado por el Master. La emisión se habilita en F1c (solo prueba).'],
 EMITIENDO:['Emitiendo','fx-est cel','Hay facturas en emisión.'],
 EMITIDO:['Emitido','fx-est ver','Todas las facturas aprobadas fueron emitidas.'],
 EMITIDO_PARCIAL:['Emitido parcial','fx-est ama','Hay líneas emitidas y otras con error o por conciliar.'],
 ANULADO:['Anulado','fx-est roj','El Master anuló el grupo.']
};
var EST_LINEA={BORRADOR:['No lista','fx-est amb'],LISTA:['Lista','fx-est ver'],EMITIENDO:['Emitiendo','fx-est cel'],INCIERTO:['Incierta','fx-est ama'],EMITIDA:['Emitida','fx-est ver'],ERROR:['Error','fx-est roj'],EXCLUIDA:['Excluida','fx-est gris'],ANULADA:['Anulada','fx-est roj']};
var ALERTA={
 CLIENTE_NUEVO:['Cliente nuevo','c-nuevo','No tuvo factura el mes anterior.'],
 CLIENTE_FALTA:['Cliente que falta','c-falta','Se facturó el mes anterior y hoy no está listo o no está activo.'],
 CAMBIO_FICHA:['Cambio de ficha','c-ficha','Plan, monto base o valor por trabajador distintos al mes anterior.'],
 TRABAJADORES_BAJAN:['Bajan trabajadores','c-bajan','Bajan 2 o más, o un 30 % o más: posible omisión.'],
 VARIACION_ALTA:['Diferencia > $1.000','c-var','Diferencia sin explicar por UF, trabajadores ni adicionales, mayor al umbral.'],
 DATO_MANUAL:['Dato manual','c-manual','Trabajadores ingresados a mano (sin reporte finalizado).'],
 ADICIONAL:['Adicional del mes','c-adic','La línea tiene cobros adicionales ingresados este mes.'],
 CUBRE:['Paga por otra','c-cubre','Esta empresa paga también por otra (empresa relacionada o cortesía).']
};
var MOTIVO={
 'FICHA_INCOMPLETA:razon_social':'Ficha incompleta: falta la razón social','FICHA_INCOMPLETA:giro':'Ficha incompleta: falta el giro',
 'FICHA_INCOMPLETA:direccion':'Ficha incompleta: falta la dirección','FICHA_INCOMPLETA:comuna':'Ficha incompleta: falta la comuna',
 'FICHA_INCOMPLETA:email':'Ficha incompleta: falta el correo','FICHA_INCOMPLETA:email_invalido':'Ficha incompleta: el correo no es válido',
 'FICHA_INCOMPLETA:monto_base':'Ficha incompleta: falta el monto del plan','FICHA_INCOMPLETA:moneda_plan':'Ficha incompleta: falta la moneda del plan',
 'FICHA_INCOMPLETA:moneda_variable':'Ficha incompleta: falta la moneda del valor por trabajador',
 SIN_TRABAJADORES:'Sin trabajadores del mes: no hay reporte finalizado ni dato manual',
 GATE_REPORTES_PENDIENTES:'Reportes del mes pendientes (modo estricto)',TOTAL_CERO:'El total queda en $0'
};
function motivoTxt(m){return MOTIVO[m]||m;}

/* ── Roles ── */
function esFact(){return !!(S.yo&&S.yo.puede_preparar);}
function esMaster(){return !!(S.yo&&S.yo.puede_aprobar);}
function editable(){return !!S.lote&&(S.lote.estado==='BORRADOR'||S.lote.estado==='DEVUELTO');}
function enEmision(){return !!S.lote&&['EMITIENDO','EMITIDO','EMITIDO_PARCIAL'].indexOf(S.lote.estado)>=0;}

/* ── Carga ── */
function iniciar(){
  pintarIconosEstaticos();
  if(DEMO){
    $('fxDemo').hidden=false;$('verComo').hidden=false;
    document.documentElement.classList.remove('auth-pending');
  }
  API.rpc('facturacion_yo',{}).then(function(yo){
    S.yo=yo||{};
    if(!S.yo.puede_leer){sinPermiso();return;}
    pintarQuien();
    return API.get('periodos?select=periodo,uf&order=periodo.desc&limit=12').then(function(rows){
      S.periodos=(rows||[]).filter(function(r){return r&&r.periodo;});
      var sel=$('selPeriodo');
      sel.innerHTML=S.periodos.map(function(r){return '<option value="'+esc(r.periodo)+'">'+esc(mesTxt(r.periodo,true))+(r.uf?'':' · sin UF')+'</option>';}).join('')||'<option value="">Sin períodos abiertos</option>';
      S.periodo=S.periodos.length?S.periodos[0].periodo:null;
      sel.value=S.periodo||'';
      return cargar();
    });
  }).catch(function(e){
    var m=mensajeError(e);
    if(e&&e.fx&&(e.fx.code==='42501'||/SIN_SESION|SOLO_/.test(e.fx.message||'')))sinPermiso(m);
    else errorCarga(m);
  });
}
function sinPermiso(m){
  $('fxMain').innerHTML='<div class="g-card fx-aviso" style="margin:0">'+I('candado','placa ic-amb')+'<div><b>No tienes acceso a Facturación.</b><p>'+esc(m||'Facturación es para el facturador (rol Pagos o módulo Facturación habilitado en Administración) y el Master.')+' Si lo necesitas, pídeselo al Master.</p></div></div>';
}
function errorCarga(m){
  $('fxEstado').innerHTML='<div class="fx-aviso" style="background:rgba(224,122,110,.08);border-color:rgba(224,122,110,.4)">'+I('alerta','placa ic-roj')+'<div><b>No se pudo cargar Facturación.</b><p>'+esc(m)+'</p><p><button type="button" class="g-btn sm" data-act="recargar">'+I('repetir','ic-cel')+'Reintentar</button></p></div></div>';
}
function cargar(){
  S.cargando=true;S.sel=null;cerrarDrawer();
  if(S.vista==='ADICIONAL'||S.vista==='HISTORIAL'){S.cargando=false;render();return Promise.resolve();}
  if(!S.periodo){S.lote=null;S.lineas=[];S.cargando=false;render();return Promise.resolve();}
  $('fxEstado').innerHTML='<p class="ninguna">Cargando el grupo '+esc(S.vista)+' de '+esc(mesTxt(S.periodo))+'…</p>';
  return API.get('facturacion_lotes?select=*&periodo=eq.'+encodeURIComponent(S.periodo)+'&tipo=eq.'+S.vista+'&modo=eq.'+MODO+'&order=id.desc&limit=10').then(function(lotes){
    lotes=lotes||[];
    S.lote=lotes.filter(function(l){return l.estado!=='ANULADO';})[0]||lotes[0]||null;
    if(!S.lote){S.lineas=[];S.adic={};S.eventos=[];S.anterior={};return;}
    var lid=S.lote.id;
    return Promise.all([
      API.get('facturacion?select=id,cliente_id,cliente_rut,razon_social,plan,moneda,monto_base,valor_por_trab,moneda_variable,trab_incluidos,n_trabajadores,origen_trabajadores,trab_manual_nota,adicionales_total,descuento,total_clp,estado,motivos,alertas,calculo,detalle,snapshot,of_folio,doc_estado,correo_estado,error,tipo_lote&lote_id=eq.'+lid+'&order=razon_social.asc'),
      API.get('facturacion_eventos?select=id,linea_id,tipo,actor,actor_usuario_id,detalle,creado_at&lote_id=eq.'+lid+'&order=creado_at.desc&limit=300'),
      cargarAnterior(S.lote)
    ]).then(function(r){
      S.lineas=r[0]||[];S.eventos=r[1]||[];S.anterior=r[2]||{};
      var ids=S.lineas.map(function(l){return l.id;});
      if(!ids.length){S.adic={};return;}
      return API.get('facturacion_adicionales?select=id,linea_id,glosa,detalle,monto,creado_at&linea_id=in.('+ids.join(',')+')&order=id.asc').then(function(ad){
        S.adic={};(ad||[]).forEach(function(a){(S.adic[a.linea_id]=S.adic[a.linea_id]||[]).push(a);});
      });
    });
  }).then(function(){S.cargando=false;$('fxEstado').innerHTML='';render();})
    .catch(function(e){S.cargando=false;errorCarga(mensajeError(e));});
}
/* Total del mes anterior por RUT (misma fuente que usó el motor para el comparativo) */
function cargarAnterior(l){
  var a=l.totales&&l.totales.anterior;if(!a||!a.periodo)return Promise.resolve({});
  if(a.fuente==='GESTOOR')return API.get('facturacion?select=cliente_rut,total_clp,n_trabajadores&periodo=eq.'+a.periodo+'&modo=eq.PRODUCCION&estado=eq.EMITIDA').then(function(rows){
    var m={};(rows||[]).forEach(function(r){m[rutN(r.cliente_rut)]={total:+r.total_clp,n:r.n_trabajadores};});return m;});
  return API.get('facturacion_historial?select=cliente_rut,total,n_trabajadores,estatus&periodo=eq.'+a.periodo).then(function(rows){
    var m={};(rows||[]).forEach(function(r){if(String(r.estatus||'').toUpperCase().trim()!=='ACTIVO'||!(+r.total>0))return;var k=rutN(r.cliente_rut);if(!m[k]||+r.total>m[k].total)m[k]={total:+r.total,n:r.n_trabajadores};});return m;});
}

/* ── Presentación de alertas (decisión 2 de Luciano: con CAMBIO_FICHA no se muestra VARIACION_ALTA) ── */
function alertasVista(l){
  var a=(l.alertas||[]), cods=[], cubre=[];
  a.forEach(function(x){if(x.codigo==='CUBRE'){cubre.push(x);return;}if(cods.indexOf(x.codigo)<0)cods.push(x.codigo);});
  if(cods.indexOf('CAMBIO_FICHA')>=0)cods=cods.filter(function(c){return c!=='VARIACION_ALTA';});
  if(cubre.length)cods.push('CUBRE');
  return {cods:cods,cubre:cubre};
}
function chip(code,cubre){var a=ALERTA[code]||[code,'c-cubre',''];var extra=code==='CUBRE'&&cubre?' ('+cubre.length+')':'';
  var t=code+': '+a[2]+(code==='CUBRE'&&cubre?' '+cubre.map(function(x){return x.razon_social;}).join(', '):'');
  return '<span class="chip '+a[1]+'" title="'+esc(t)+'">'+esc(a[0])+extra+'</span>';}
function prevDe(l){return S.anterior[rutN(l.cliente_rut)]||null;}

/* ── Botones con explicación ── */
function btn(o){
  var b='<button type="button" class="g-btn '+(o.cls||'')+'"'+(o.ok&&!S.ocupado?'':' disabled')+' data-act="'+(o.act||'')+'"'+(o.id!=null?' data-id="'+o.id+'"':'')+'>'+(o.ic?I(o.ic,o.ok?o.icc:''):'')+esc(o.txt)+'</button>';
  return '<span class="tipw" tabindex="'+(o.ok?'-1':'0')+'" data-tip="'+esc(o.tip)+'">'+b+'</span>';
}

/* ── Render ── */
function render(){
  var ad=S.vista==='ADICIONAL', hi=S.vista==='HISTORIAL';
  $('vistaGrupo').hidden=ad||hi;$('vistaAdic').hidden=!ad;$('vistaHist').hidden=!hi;$('fxPeriodoBox').hidden=hi;
  $('tbSub').textContent=hi?'historial por cliente':(ad?'adicional':'mensual');
  document.querySelectorAll('[data-vista]').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-vista')===S.vista);b.setAttribute('aria-pressed',b.getAttribute('data-vista')===S.vista?'true':'false');});
  if(hi){if(window.FX_HISTORIAL)window.FX_HISTORIAL.render({demo:DEMO});return;}
  if(ad){if(window.FX_ADICIONAL)window.FX_ADICIONAL.render({demo:DEMO,rol:esMaster()?'master':(esFact()?'facturador':'lectura'),periodo:S.periodo,uf:ufPeriodo()});return;}
  renderHero();renderPasos();renderAcciones();renderTabla();renderAnalisis();renderNoFact();renderBitacora();
  if(S.sel)renderDrawer();
}
function ufPeriodo(){var r=S.periodos.filter(function(p){return p.periodo===S.periodo;})[0];return r&&r.uf?+r.uf:null;}
function renderHero(){
  var l=S.lote, per=S.periodo;
  if(!l){
    var uf=ufPeriodo();
    $('hero').innerHTML='<div class="hero-top"><div><small class="k">Período contable</small><h2>'+esc(mesTxt(per,true)||'Sin período')+' · <span>Grupo '+S.vista+'</span></h2>'
      +'<div class="meta"><span class="it">'+I('grafico','ic-cel')+(uf?'UF <b class="cifra">$'+ufFmt(uf)+'</b> (día 1 del mes siguiente)':'<b>Sin UF</b>: abre el período en Panel de Control')+'</span><span class="it">'+I('factura','ic-mor')+'Factura exenta <b>DTE 34</b></span></div></div>'
      +'<div class="estado-lote"><span class="fx-est gris grande">Sin preparar</span><span class="prueba">'+ic('probeta')+'MODO PRUEBA</span></div></div>'
      +'<div class="desfase">'+I('alerta','ic-cel')+'<span>'+(esFact()?'Aún no se prepara este grupo. Usa "Preparar grupo": el motor toma los clientes activos del grupo '+S.vista+' y calcula cada línea.':'Aún no se prepara este grupo. Lo prepara el facturador.')+'</span></div>';
    return;
  }
  var t=l.totales||{}, a=t.anterior||{}, e=l.estado, dif=+t.diferencia||0, pct=t.diferencia_pct;
  var cls=dif>0?'sube':(dif<0?'baja':'neutro'), mesAnt=a.periodo?mesTxt(a.periodo):'mes anterior';
  var nl=+t.n_lineas||0, nok=+t.n_listas||0;
  $('hero').innerHTML=
   '<div class="hero-top"><div><small class="k">Período contable</small><h2>'+esc(mesTxt(l.periodo,true))+' · <span>Grupo '+esc(l.tipo)+'</span></h2>'
   +'<div class="meta"><span class="it">'+I('grafico','ic-cel')+'UF <b class="cifra">$'+ufFmt(l.uf_valor)+'</b> ('+fFecha(l.uf_fecha)+')</span>'
   +'<span class="it">'+I('calendario','ic-ver')+'Emisión <b>'+fFecha(l.fecha_emision)+'</b></span><span class="it">'+I('reloj','ic-amb')+'Vencimiento <b>'+fFecha(l.fecha_vencimiento)+'</b></span>'
   +'<span class="it">'+I('factura','ic-mor')+'Factura exenta <b>DTE 34</b></span></div></div>'
   +'<div class="estado-lote"><span class="'+(EST_LOTE[e]||['',''])[1]+' grande">'+esc((EST_LOTE[e]||[e])[0])+'</span><span class="prueba">'+ic('probeta')+'MODO '+esc(l.modo)+'</span></div></div>'
   +'<div class="fx-kpis">'
   +'<div class="fx-kpi"><span class="l">Líneas listas</span><span class="v cifra">'+nok+' <small style="font-size:15px;color:var(--t2)">de '+nl+'</small></span><span class="s">'+(nl-nok)+' no lista(s) quedan fuera al aprobar</span></div>'
   +'<div class="fx-kpi"><span class="l">Monto total</span><span class="v cifra">'+clp(t.monto_listas)+'</span><span class="s">Solo líneas listas</span></div>'
   +'<div class="fx-kpi"><span class="l">'+esc(mesTxt(a.periodo,true)||'Mes anterior')+'</span><span class="v cifra">'+clp(a.monto)+'</span><span class="s">'+(a.uf?'UF $'+ufFmt(a.uf)+' · ':'')+'fuente: '+(a.fuente==='GESTOOR'?'Gestoor':'historial Excel')+'</span></div>'
   +'<div class="fx-kpi"><span class="l">Diferencia vs '+esc(mesAnt)+'</span><span class="v cifra '+cls+'">'+sig(dif)+'</span><span class="s '+cls+'">'+(pct==null?'sin base':(pct>=0?'+':'−')+Math.abs(pct).toFixed(1).replace('.',',')+' %')+' · ver "Análisis"</span></div>'
   +'</div>'
   +'<div class="desfase">'+I('alerta','ic-cel')+'<span>Emisión desfasada: la factura siempre lleva fecha '+fFecha(l.fecha_emision)+' y vence el '+fFecha(l.fecha_vencimiento)+', aunque el grupo se prepare otro día.</span></div>'
   +(e==='DEVUELTO'&&l.comentario_devolucion?'<div class="desfase" style="color:var(--amb)">'+I('devolver','ic-amb')+'<span><b>Comentario del Master:</b> '+esc(l.comentario_devolucion)+'</span></div>':'')
   +(e==='ANULADO'&&l.motivo_anulacion?'<div class="desfase" style="color:var(--roj)">'+I('basura','ic-roj')+'<span><b>Motivo de la anulación:</b> '+esc(l.motivo_anulacion)+'</span></div>':'')
   +((l.bloqueos||[]).length?'<div class="desfase" style="color:var(--roj)">'+I('alerta','ic-roj')+'<span><b>Grupo bloqueado:</b> '+l.bloqueos.length+' empresa(s) con tratamiento de facturación inválido. Corrígelo en Clientes y recalcula.</span></div>':'');
}
function renderPasos(){
  var e=S.lote?S.lote.estado:null;
  var PS=[['Preparar','Calcular líneas'],['Revisar alertas','Facturador'],['Enviar a aprobación','Aviso al Master'],['Aprobado (Master)','Huella congelada'],['Emitir','Bloqueado hasta F1c/F1d'],['Documentos y correo','PDF, XML y aviso']];
  var actual=e==null?0:({BORRADOR:1,DEVUELTO:1,EN_REVISION:3,APROBADO:4,EMITIENDO:5,EMITIDO:6,EMITIDO_PARCIAL:5,ANULADO:-1}[e]);
  $('pasos').innerHTML=PS.map(function(p,i){
    var c=i<actual?'hecho':(i===actual?'actual':'');
    if(i===4&&e==='APROBADO')c='actual bloq';
    if(e==='ANULADO')c='';
    var n=i<actual?ic('check'):(i===4&&c.indexOf('bloq')>=0?ic('candado'):(i+1));
    return '<div class="fx-paso '+c+'"><span class="n">'+n+'</span><span><b>'+p[0]+'</b><small>'+p[1]+'</small></span></div>';
  }).join('');
}
function renderAcciones(){
  var l=S.lote, e=l?l.estado:null, h='';
  var noListas=S.lineas.filter(function(x){return x.estado==='BORRADOR';}).length;
  if(esFact()){
    if(!l||e==='ANULADO')h+=btn({txt:'Preparar grupo',ic:'repetir',cls:'pri',ok:!!S.periodo,act:'preparar',tip:'Crea el grupo '+S.vista+' de '+mesTxt(S.periodo)+' con los clientes activos y calcula cada línea con la UF del período.'});
    else h+=btn({txt:'Recalcular grupo',ic:'repetir',icc:'ic-cel',ok:editable(),act:'preparar',tip:editable()?'Vuelve a calcular todas las líneas con la ficha y la UF vigentes.':'Solo se recalcula en Borrador o Devuelto. Ahora el grupo está "'+(EST_LOTE[e]||[e])[0]+'".'});
    h+=btn({txt:'Enviar a aprobación',ic:'enviar',cls:'pri',ok:editable(),act:'enviar',tip:editable()?'Congela el grupo y avisa al Master.'+(noListas?' Las '+noListas+' línea(s) no listas quedarán EXCLUIDAS al aprobar.':''):(l?'Ya se envió o el grupo no está editable (estado: '+(EST_LOTE[e]||[e])[0]+').':'Primero prepara el grupo.')});
    h+=btn({txt:'Emitir',ic:'candado',icc:'ic-amb',ok:false,act:'emitir',tip:'Bloqueado hasta F1c/F1d: en F1c se emite solo en el ambiente de pruebas (sin SII) y la emisión real llega con el GO de F1d.'});
  }
  if(esMaster()){
    var rev=e==='EN_REVISION';
    h+=btn({txt:'Aprobar grupo',ic:'aprobar',cls:'pri',ok:rev,act:'aprobar',tip:rev?'Aprueba lo que estás viendo (se envía la huella de revisión). Si algo cambió, el motor lo rechaza.':'Solo se aprueba un grupo "En revisión". Estado actual: '+(l?(EST_LOTE[e]||[e])[0]:'sin preparar')+'.'});
    h+=btn({txt:'Devolver',ic:'devolver',icc:'ic-amb',ok:rev,act:'devolver',tip:rev?'Devuelve el grupo al facturador con un comentario obligatorio.':'Solo se devuelve un grupo "En revisión".'});
    var anulable=!!l&&e!=='ANULADO'&&!S.lineas.some(function(x){return ['EMITIENDO','INCIERTO','EMITIDA'].indexOf(x.estado)>=0;});
    h+=btn({txt:'Anular',ic:'basura',icc:'ic-roj',cls:'peligro',ok:anulable,act:'anular',tip:anulable?'Anula el grupo completo con un motivo. Solo mientras no haya emisiones.':(!l?'No hay grupo que anular.':(e==='ANULADO'?'El grupo ya está anulado.':'No se puede anular: ya hay facturas emitidas o por conciliar.'))});
  }
  var quien=esFact()?I('factura','ic-ama')+'<span><b>Facturador</b>: prepara, recalcula, edita trabajadores y adicionales, y envía a aprobación. No aprueba.</span>'
    :esMaster()?I('escudo','ic-cel')+'<span><b>Master</b>: aprueba, devuelve o anula. Nunca emite.</span>'
    :I('ver','ic-mor')+'<span><b>Solo lectura</b>: puedes revisar el grupo, pero no hacer acciones.</span>';
  $('acciones').innerHTML='<div class="quien">'+quien+'</div>'+h;
}
function trabCelda(l){
  if(l.tipo_lote==='FIJO'||!(+l.valor_por_trab>0))return '<span class="ninguna">No aplica</span>';
  if(l.n_trabajadores==null)return '<span class="chip c-motivo">Falta dato</span>';
  var adic=l.calculo?l.calculo.adicionales_trab:Math.max(0,l.n_trabajadores-(l.trab_incluidos||0));
  return '<span class="trab"><span title="Liquidados">'+l.n_trabajadores+'</span>/<span title="Incluidos en el plan">'+(l.trab_incluidos||0)+'</span>/<span class="adic" title="Adicionales">'+adic+'</span></span>'
   +'<span class="sub">'+(l.origen_trabajadores==='MANUAL'?'Ingreso manual':'Reporte RRHH finalizado')+'</span>';
}
function planCelda(l){
  var nom=l.plan?String(l.plan).charAt(0).toUpperCase()+String(l.plan).slice(1):'—';
  var s=l.moneda==='UF'?'<b class="cifra">'+dec(l.monto_base)+' UF</b><span class="sub">Plan '+esc(nom)+'</span>':'<b class="cifra">'+(l.monto_base!=null?clp(l.monto_base):'—')+'</b><span class="sub">Plan '+esc(nom)+(l.moneda==='CLP'?' · CLP fijo':'')+'</span>';
  if(+l.valor_por_trab>0)s+='<span class="sub">+ '+(l.moneda_variable==='UF'?dec(l.valor_por_trab)+' UF':clp(l.valor_por_trab))+' por trabajador adic.</span>';
  return s;
}
function accionesLinea(l){
  var h='';
  if(enEmision()&&l.estado==='INCIERTO'){
    h+=btn({txt:'Conciliar',ic:'buscar',cls:'sm',ok:false,act:'conciliar',id:l.id,tip:'Conciliar llega en F1c: buscará el documento en OpenFactura por su clave. Nunca se reemite.'});
  }else if(enEmision()&&l.estado==='EMITIDA'&&l.correo_estado==='FALLIDO'){
    h+=btn({txt:'Reenviar correo',ic:'correo',cls:'sm',ok:false,act:'reenviar',id:l.id,tip:'El reenvío de correo llega en F1c (en prueba, solo a info@contadoor.cl).'});
  }else if(!enEmision()&&l.tipo_lote==='VARIABLE'&&+l.valor_por_trab>0&&(l.n_trabajadores==null||l.origen_trabajadores==='MANUAL')&&['BORRADOR','LISTA'].indexOf(l.estado)>=0){
    var ok=esFact()&&editable();
    h+=btn({txt:l.n_trabajadores==null?'Ingresar trabajadores':'Editar trabajadores',ic:'lapiz',icc:'ic-ama',cls:'sm',ok:ok,act:'trabajadores',id:l.id,
      tip:!esFact()?'Solo el facturador edita trabajadores.':(editable()?'Ingreso manual con nota obligatoria (queda la alerta "Dato manual").':'Solo con el grupo en Borrador o Devuelto.')});
  }else if(!enEmision()&&['BORRADOR','LISTA'].indexOf(l.estado)>=0){
    var ok2=esFact()&&editable();
    h+='<span class="tipw" data-tip="'+esc(!esFact()?'Solo el facturador agrega adicionales.':(editable()?'Agregar un cobro adicional del mes (por ejemplo, emisión de documentos).':'Solo con el grupo en Borrador o Devuelto.'))+'"><button type="button" class="g-ico" aria-label="Agregar adicional a '+esc(l.razon_social)+'" data-act="adicional" data-id="'+l.id+'"'+(ok2&&!S.ocupado?'':' disabled')+'>'+I('mas',ok2?'ic-ver':'')+'</button></span>';
  }
  return h;
}
function renderTabla(){
  var porResolver=S.lineas.filter(function(x){return x.estado==='BORRADOR';});
  if(!porResolver.length)S.filtro=false;
  var ls=S.filtro?porResolver:S.lineas, h='';
  ls.forEach(function(l){
    var est=EST_LINEA[l.estado]||[l.estado,'fx-est gris'], av=alertasVista(l), p=prevDe(l);
    var noLista=l.estado==='BORRADOR';
    var difN=p&&l.total_clp!=null?(+l.total_clp)-p.total:null;
    var dif=noLista?'<span class="ninguna" title="No se factura mientras no esté lista">—</span>':(difN==null?'<span class="ninguna">Sin mes anterior</span>':'<b class="cifra '+(difN>0?'sube':(difN<0?'baja':'neutro'))+'">'+sig(difN)+'</b>');
    var chips=av.cods.map(function(c){return chip(c,av.cubre);}).join('');
    if(noLista)chips+=(l.motivos||[]).map(function(m){return '<span class="chip c-motivo" title="Motivo por el que no está lista">'+esc(motivoTxt(m).split(':')[0])+'</span>';}).join('');
    var mini='';
    if(l.estado==='EMITIDA'){var dd={OBTENIDOS:'ok',PENDIENTE:'pen',ERROR:'err'}[l.doc_estado]||'', cc={ENVIADO:'ok',PENDIENTE:'pen',ENVIANDO:'inf',FALLIDO:'err'}[l.correo_estado]||'';
      mini='<span class="mini-est"><span class="mini">Folio '+esc(l.of_folio||'—')+'</span><span class="mini"><span class="dot '+dd+'"></span>PDF/XML '+esc(String(l.doc_estado||'').toLowerCase())+'</span><span class="mini"><span class="dot '+cc+'"></span>Correo '+esc(String(l.correo_estado||'').toLowerCase())+'</span></span>';}
    else if(l.estado==='INCIERTO')mini='<span class="mini-est"><span class="mini"><span class="dot pen"></span>Conciliar · nunca reemitir</span></span>';
    var ads=S.adic[l.id]||[];
    var monto=l.total_clp==null||(noLista&&l.tipo_lote==='VARIABLE'&&l.n_trabajadores==null)?'<span class="ninguna">—</span>':(noLista?'<span class="cifra" style="color:var(--t2)">'+clp(l.total_clp)+'</span>':'<b class="cifra">'+clp(l.total_clp)+'</b>');
    var adic=+l.adicionales_total>0?'<b class="cifra" style="color:var(--ver)">'+clp(l.adicionales_total)+'</b><span class="sub">'+esc(ads[0]?ads[0].glosa:'')+(ads.length>1?' + '+(ads.length-1):'')+'</span>':'<span class="ninguna">—</span>';
    var rcls=(noLista?'nolista':'')+(l.estado==='INCIERTO'?' incierto':'');
    h+='<tr class="'+rcls+'" data-id="'+l.id+'" tabindex="0" aria-label="Ver detalle de '+esc(l.razon_social)+'">'
     +'<td class="cli"><b>'+esc(l.razon_social||'—')+'</b><small>'+esc(l.cliente_rut)+'</small></td>'
     +'<td>'+planCelda(l)+'</td><td>'+trabCelda(l)+'</td><td class="num">'+adic+'</td>'
     +'<td class="num">'+monto+'</td><td class="num">'+dif+'</td>'
     +'<td><div class="chips">'+(chips||'<span class="ninguna">Sin alertas</span>')+'</div></td>'
     +'<td><span class="'+est[1]+'">'+est[0]+'</span>'+mini+'</td>'
     +'<td style="white-space:nowrap">'+accionesLinea(l)+' <button type="button" class="g-ico" aria-label="Ver detalle" data-act="ver" data-id="'+l.id+'">'+I('ver','ic-mor')+'</button></td></tr>';
  });
  if(!S.lote)h='<tr><td colspan="9" class="ninguna" style="padding:22px;cursor:default">'+(esFact()?'Aún no hay grupo. Usa "Preparar grupo".':'Aún no hay grupo preparado para este período.')+'</td></tr>';
  else if(!ls.length)h='<tr><td colspan="9" class="ninguna" style="padding:22px;cursor:default">El grupo no tiene líneas.</td></tr>';
  $('tbody').innerHTML=h;
  $('tLote').textContent='grupo '+S.vista;
  $('cntLineas').textContent=S.lineas.length;
  var t=S.lote&&S.lote.totales||{};
  $('porResolver').innerHTML=porResolver.length?'<button type="button" class="ind-ind'+(S.filtro?' on':'')+'" data-act="filtro" aria-pressed="'+(S.filtro?'true':'false')+'" title="'+(S.filtro?'Ver todas las líneas':'Ver solo las líneas por resolver')+'">'+I('alerta')+' <b>'+porResolver.length+'</b> por resolver'+(S.filtro?' · ver todas':'')+'</button>':(S.lote?'<span class="fx-est ver">Todas las líneas listas</span>':'');
  $('pie').innerHTML=S.lote?'<span>'+I('check','ic-ver')+' '+(+t.n_listas||0)+' listas · '+clp(t.monto_listas)+'</span><span>'+I('alerta','ic-amb')+' '+porResolver.length+' no listas (quedan EXCLUIDAS al aprobar)</span><span>'+I('correo','ic-cel')+' Modo prueba: correos solo a info@contadoor.cl</span>':'';
}
function renderAnalisis(){
  var t=S.lote&&S.lote.totales;
  if(!t){$('expl').innerHTML='<p class="ninguna">Sin grupo preparado.</p>';$('alist').innerHTML='';$('cntAlertas').textContent='0';return;}
  var ex=t.explicacion||{}, ant=t.anterior||{};
  var filas=[['Variación de la UF',+ex.uf||0,'var(--cel)'],['Trabajadores',+ex.trabajadores||0,'var(--amb)'],['Adicionales del mes',+ex.adicionales||0,'var(--ver)'],['Descuentos',+ex.descuentos||0,'var(--mor2)'],['Clientes nuevos',+ex.clientes_nuevos||0,'var(--mor)'],['Clientes que salen o no están listos',+ex.clientes_que_salen||0,'var(--roj)'],['Otras (sin explicar)',+ex.otras||0,'var(--ama)']];
  var max=Math.max.apply(null,filas.map(function(f){return Math.abs(f[1]);}))||1, h='';
  filas.forEach(function(f){var w=Math.abs(f[1])/max*50;
    h+='<div class="expl-row"><span>'+f[0]+'</span><span class="fx-bar"><i style="background:'+f[2]+';'+(f[1]>=0?'left:50%':'right:50%')+';width:'+w+'%"></i></span><span class="m '+(f[1]>0?'sube':(f[1]<0?'baja':'neutro'))+'">'+sig(f[1])+'</span></div>';});
  h+='<div class="expl-total"><span>Diferencia total vs '+esc(mesTxt(ant.periodo)||'mes anterior')+'</span><span class="cifra">'+sig(t.diferencia)+'</span></div>'
   +'<p class="nota">'+I('check','ic-ver')+'<span>La suma de la explicación da exactamente la diferencia (lo garantiza el motor). Mes anterior: '+clp(ant.monto)+' · Este mes: '+clp(t.monto_listas)+'.</span></p>';
  $('expl').innerHTML=h;
  $('tExplMes').textContent='vs '+(mesTxt(ant.periodo)||'mes anterior');
  var cuenta={};
  S.lineas.forEach(function(l){var av=alertasVista(l);av.cods.forEach(function(c){(cuenta[c]=cuenta[c]||[]).push(l.razon_social);});});
  var cmp=S.lote.comparativo||{};
  (cmp.universo_sin_linea||[]).forEach(function(x){if(x.codigo==='CLIENTE_FALTA')(cuenta.CLIENTE_FALTA=cuenta.CLIENTE_FALTA||[]).push((x.razon_social||x.rut)+' ('+({NO_EXISTE_EN_BASE:'no existe en la base',NO_INCLUIDO:'no incluido'}[x.motivo]||String(x.motivo||'').replace('ESTADO_','').toLowerCase())+')');});
  var orden=['VARIACION_ALTA','CLIENTE_FALTA','TRABAJADORES_BAJAN','CAMBIO_FICHA','DATO_MANUAL','CLIENTE_NUEVO','ADICIONAL','CUBRE'], a='', tot=0;
  (S.lote.bloqueos||[]).forEach(function(b){a+='<div class="arow"><span class="chip c-falta">Bloqueo</span><div><p>'+esc(b.rut+' · '+({SIN_PAGADOR:'"A través de" sin empresa relacionada',PAGADOR_INACTIVO:'empresa relacionada inactiva',PAGADOR_NO_NORMAL:'la relacionada no factura normal'}[b.motivo]||b.motivo))+'</p></div><span class="q">!</span></div>';tot++;});
  orden.forEach(function(k){if(!cuenta[k])return;tot+=k==='CUBRE'||k==='ADICIONAL'?0:cuenta[k].length;
    a+='<div class="arow">'+chip(k)+'<div><p>'+esc(cuenta[k].join(' · '))+'</p></div><span class="q">'+cuenta[k].length+'</span></div>';});
  $('alist').innerHTML=a||'<p class="ninguna">Sin alertas.</p>';
  $('cntAlertas').textContent=tot;
}
var TIPO_NF={A_TRAVES:['Facturado a través de empresa relacionada','fx-est mor','transferir','ic-mor'],CORTESIA:['Cortesía','fx-est ver','regalo','ic-ver'],PROPIA:['Empresa propia','fx-est cel','edificio','ic-cel'],
  EN_OTRO_LOTE:['En el otro grupo','fx-est gris','transferir','ic-cel'],CLIENTE_FALTA:['Sale o inactivo','fx-est gris','pausa','ic-roj']};
function renderNoFact(){
  var cmp=S.lote&&S.lote.comparativo||{}, items=[];
  (cmp.tratamientos||[]).forEach(function(x){items.push({t:x.tratamiento,nom:x.razon_social,rut:x.rut,pag:x.pagador,mot:x.justificacion});});
  (cmp.universo_sin_linea||[]).forEach(function(x){
    if(x.codigo==='EN_OTRO_LOTE')items.push({t:'EN_OTRO_LOTE',nom:x.razon_social||x.rut,rut:x.rut,mot:'Se factura en el otro grupo de este período.'});
    else if(x.codigo==='CLIENTE_FALTA'&&/^ESTADO_/.test(x.motivo||''))items.push({t:'CLIENTE_FALTA',nom:x.razon_social||x.rut,rut:x.rut,mot:'Estado en la ficha: '+String(x.motivo).replace('ESTADO_','').toLowerCase()+'. El mes anterior se facturó '+clp(x.total_anterior)+'.',falta:true});
  });
  $('nfgrid').innerHTML=items.map(function(n){var t=TIPO_NF[n.t]||[n.t,'fx-est gris','pausa','ic-amb'];
    return '<div class="nf"><div class="top">'+I(t[2],'placa '+t[3])+'<div><b>'+esc(n.nom)+'</b><small>'+esc(n.rut)+'</small></div></div>'
     +'<span class="'+t[1]+'">'+esc(t[0])+'</span>'+(n.falta?' '+chip('CLIENTE_FALTA'):'')
     +(n.pag?'<div class="pag">'+I('transferir','ic-cel')+'<span>Empresa relacionada que paga: <b>'+esc(n.pag)+'</b></span></div>':'')
     +'<p>'+esc(n.mot)+'</p></div>';}).join('')||'<p class="ninguna">'+(S.lote?'Todas las empresas activas se facturan normalmente.':'Sin grupo preparado.')+'</p>';
  $('cntNF').textContent=items.length;
}
var EV={
 LOTE_CREADO:['Grupo preparado','repetir','ic-cel'],LOTE_RECALCULADO:['Grupo recalculado','repetir','ic-cel'],ADICIONAL_AGREGADO:['Adicional agregado','mas','ic-ver'],
 ADICIONAL_ELIMINADO:['Adicional eliminado','basura','ic-roj'],TRABAJADORES_MANUAL:['Trabajadores a mano','lapiz','ic-ama'],ENVIADO_REVISION:['Enviado a aprobación','enviar','ic-mor'],
 APROBADO:['Aprobado','aprobar','ic-ver'],DEVUELTO:['Devuelto','devolver','ic-amb'],ANULADO:['Anulado','basura','ic-roj']
};
function actorTxt(e){
  if(e.actor==='servicio')return 'Sistema';
  if(S.yo&&e.actor_usuario_id!=null&&e.actor_usuario_id===S.yo.usuario_id)return 'Tú';
  return ['APROBADO','DEVUELTO','ANULADO'].indexOf(e.tipo)>=0?'Master':'Facturador';
}
function detalleEv(e){
  var d=e.detalle||{}, p=[];
  if(d.glosa)p.push(d.glosa+(d.monto!=null?' '+clp(d.monto):''));
  if(d.ahora!=null&&e.tipo==='TRABAJADORES_MANUAL')p.push(d.ahora+' trabajadores'+(d.nota?' · nota: '+d.nota:''));
  if(d.comentario)p.push('Comentario: '+d.comentario);
  if(d.motivo)p.push('Motivo: '+d.motivo);
  if(d.uf)p.push('UF $'+ufFmt(d.uf));
  if(d.n_listas!=null)p.push(d.n_listas+' líneas listas');
  if(d.lineas_aprobadas!=null)p.push(d.lineas_aprobadas+' aprobadas · '+(d.lineas_excluidas||0)+' excluidas');
  if(e.linea_id){var l=S.lineas.filter(function(x){return x.id===e.linea_id;})[0];if(l)p.unshift(l.razon_social);}
  return p.join(' · ');
}
function listaEventos(evs){
  return evs.map(function(e){var m=EV[e.tipo]||[e.tipo,'reloj','ic-cel'];
    return '<li><time>'+esc(fHora(e.creado_at))+'</time>'+I(m[1],'placa '+m[2])+'<div><code>'+esc(e.tipo)+'</code> <b>'+esc(actorTxt(e))+'</b><div class="q">'+esc(m[0]+(detalleEv(e)?' · '+detalleEv(e):''))+'</div></div></li>';}).join('');
}
function renderBitacora(){$('bitLote').innerHTML=listaEventos(S.eventos)||'<li class="ninguna" style="display:block">Sin movimientos.</li>';}

/* ── Panel de detalle ── */
function lineaSel(){return S.lineas.filter(function(x){return x.id===S.sel;})[0];}
function glosa(l){
  var d=l.detalle||{}, items=d.items||[], snap=l.snapshot||null, rec=snap&&snap.receptor;
  var h='<div class="dte"><div class="dte-h"><div><b>Receptor: '+esc(rec?rec.razon_social:l.razon_social)+'</b><small>RUT '+esc(l.cliente_rut)+' · '+(rec?esc([rec.giro,rec.direccion,rec.comuna].filter(Boolean).join(' · ')):'<span id="drReceptor">giro, dirección y comuna desde la ficha</span>')+'</small></div>'
   +'<div class="tipo">FACTURA NO AFECTA<br>O EXENTA · DTE 34<br>'+(l.of_folio?'N° '+esc(l.of_folio):'Folio al emitir')+'</div></div>'
   +'<div class="kv"><div><span>Fecha de emisión</span>'+fFecha(S.lote.fecha_emision)+'</div><div><span>Fecha de vencimiento</span>'+fFecha(S.lote.fecha_vencimiento)+'</div><div><span>Forma de pago</span>Crédito</div><div><span>Término de pago</span>Paga hasta el '+fFecha(S.lote.fecha_vencimiento)+'</div></div>'
   +'<table class="det"><thead><tr><th>Detalle (NmbItem / DscItem)</th><th class="num">Cant. × precio</th><th class="num">Monto</th></tr></thead><tbody>';
  items.forEach(function(it,i){var nm={PLAN:'PLAN BASE',TRABAJADORES:'TRABAJADORES',ADICIONAL:'ADICIONAL'}[it.linea]||it.linea;
    h+='<tr><td><span class="ln">LÍNEA '+(i+1)+' · '+esc(nm)+'</span><span class="nm">'+esc(it.NmbItem)+'</span>'+(it.DscItem?'<span class="ds">'+esc(it.DscItem)+'</span>':'')+'</td><td class="num cifra" style="white-space:nowrap">'+dec(it.QtyItem)+' × '+(Number(it.PrcItem)%1?'$'+ufFmt(it.PrcItem):clp(it.PrcItem))+'</td><td class="num cifra"><b>'+clp(it.MontoItem)+'</b></td></tr>';});
  if(!items.length)h+='<tr><td colspan="3" class="ninguna">Sin detalle: la línea aún no se puede calcular.</td></tr>';
  if(d.descuento_global)h+='<tr><td><span class="ln">DESCUENTO</span><span class="nm">'+esc(d.descuento_global.GlosaDR||'Descuento')+'</span></td><td></td><td class="num cifra"><b>−'+clp(d.descuento_global.ValorDR)+'</b></td></tr>';
  h+='</tbody></table><div class="dte-tot"><span>Monto exento</span><b class="cifra">'+clp(d.MntExe!=null?d.MntExe:l.total_clp)+'</b></div></div>';
  h+='<p class="nota">'+I('check','ic-ver')+'<span>El total del DTE calza exacto con el cálculo del grupo (el motor lo verifica). Redondeo a peso entero solo en el total de la línea.</span></p>';
  if(!rec&&!DEMO)setTimeout(function(){cargarReceptor(l);},0);
  return h;
}
function cargarReceptor(l){
  API.get('clientes?select=giro,direccion,comuna&id=eq.'+Number(l.cliente_id)).then(function(r){
    var el=$('drReceptor');if(!el)return;var c=r&&r[0];
    el.textContent=c?[c.giro||'giro: falta',c.direccion||'dirección: falta',c.comuna||'comuna: falta'].join(' · '):'giro, dirección y comuna desde la ficha';
  });
}
function calculo(l){
  var c=l.calculo||{}, h='<ol class="calc">';
  if(l.moneda==='UF')h+='<li><span>Plan base<small>'+dec(l.monto_base)+' UF × $'+ufFmt(c.uf)+' = $'+ufFmt(c.base_clp_exacto)+'</small></span><span class="m">'+clp(c.L1_plan)+'</span></li>';
  else h+='<li><span>Plan base mensual<small>Monto fijo en pesos de la ficha</small></span><span class="m">'+clp(c.L1_plan)+'</span></li>';
  if(l.tipo_lote==='VARIABLE'&&+l.valor_por_trab>0){
    if(l.n_trabajadores==null)h+='<li><span>Trabajadores<small>Falta el dato del mes (reporte no finalizado y sin ingreso manual)</small></span><span class="m">—</span></li>';
    else h+='<li><span>Trabajadores adicionales<small>máx(0, '+l.n_trabajadores+' liquidados − '+(l.trab_incluidos||0)+' incluidos) = '+c.adicionales_trab+' × '+(l.moneda_variable==='UF'?dec(l.valor_por_trab)+' UF ($'+ufFmt(c.valor_trab_clp_exacto)+')':clp(l.valor_por_trab))+' · fuente: '+(l.origen_trabajadores==='MANUAL'?'ingreso manual':'reporte RRHH finalizado')+'</small></span><span class="m">'+clp(c.L2_trabajadores)+'</span></li>';
  }
  h+='<li><span>Descuento vigente<small>'+(c.descuento_vigente?'Según la ficha del cliente':'Sin descuento en la ficha')+'</small></span><span class="m">'+(c.descuento?'−'+clp(c.descuento):'$0')+'</span></li>';
  var ads=S.adic[l.id]||[], puede=esFact()&&editable()&&['BORRADOR','LISTA'].indexOf(l.estado)>=0;
  ads.forEach(function(a){h+='<li><span>Adicional: '+esc(a.glosa)+'<small>'+esc(a.detalle||'')+'</small></span><span class="m">'+clp(a.monto)+(puede?' <button type="button" class="g-ico" style="width:30px;height:30px;margin-left:6px" aria-label="Quitar adicional '+esc(a.glosa)+'" data-act="quitar-adicional" data-id="'+a.id+'"'+(S.ocupado?' disabled':'')+'>'+I('basura','ic-roj')+'</button>':'')+'</span></li>';});
  h+='<li class="tot"><span><b>Total de la línea</b><small>Redondeo a peso entero, mitad hacia arriba, solo al final</small></span><span class="m">'+clp(c.total!=null?c.total:l.total_clp)+'</span></li></ol>';
  var p=prevDe(l);
  if(p&&l.estado!=='BORRADOR'){
    var al=(l.alertas||[]), va=al.filter(function(x){return x.codigo==='VARIACION_ALTA';})[0], cf=al.filter(function(x){return x.codigo==='CAMBIO_FICHA';})[0];
    h+='<div class="bloque-t">'+I('grafico','ic-cel')+'Diferencia vs mes anterior: '+sig(l.total_clp-p.total)+'</div><ol class="calc">'
     +'<li><span>Mes anterior<small>'+(p.n!=null?p.n+' trabajadores':'')+'</small></span><span class="m">'+clp(p.total)+'</span></li>'
     +(cf?'<li><span>Cambio de ficha<small>Antes: '+esc(cf.antes&&cf.antes.base)+' '+esc(cf.antes&&cf.antes.moneda)+' · Ahora: '+esc(cf.ahora&&cf.ahora.base)+' '+esc(cf.ahora&&cf.ahora.moneda)+'</small></span><span class="m">—</span></li>':'')
     +(va&&!cf?'<li><span>Sin explicar<small>Umbral de alerta: '+clp(va.umbral)+'</small></span><span class="m" style="color:var(--roj)">'+sig(va.sin_explicar)+'</span></li>':'')
     +'</ol>';
  }
  if(l.trab_manual_nota&&l.origen_trabajadores==='MANUAL')h+='<p class="nota">'+I('lapiz','ic-ama')+'<span><b>Nota del ingreso manual:</b> '+esc(l.trab_manual_nota)+'</span></p>';
  if(l.estado==='BORRADOR'&&(l.motivos||[]).length)h+='<p class="nota">'+I('alerta','ic-amb')+'<span><b>No está lista:</b> '+esc((l.motivos||[]).map(motivoTxt).join('; '))+'. Si no se corrige antes de aprobar, queda EXCLUIDA.</span></p>';
  return h;
}
function historial(l){
  var box='<div id="drHist"><p class="ninguna">Cargando historial…</p></div>';
  setTimeout(function(){
    API.get('facturacion_historial?select=periodo,total,n_trabajadores,estado_pago&cliente_rut=eq.'+encodeURIComponent(rutN(l.cliente_rut))+'&order=periodo.desc&limit=6').then(function(rows){
      var el=$('drHist');if(!el)return;
      rows=(rows||[]).sort(function(a,b){return a.periodo<b.periodo?-1:1;});
      var h='<table class="hist"><thead><tr><th>Período</th><th>Trab.</th><th class="num">Monto</th><th>Pago</th></tr></thead><tbody>';
      rows.forEach(function(r){var pg=String(r.estado_pago||'').toUpperCase();h+='<tr><td>'+esc(mesTxt(r.periodo,true))+'</td><td class="cifra">'+(r.n_trabajadores!=null?esc(r.n_trabajadores):'—')+'</td><td class="num cifra"><b>'+clp(r.total)+'</b></td><td><span class="fx-est '+(pg==='PAGADA'||pg==='PAGADO'?'ver':(pg?'amb':'gris'))+'">'+esc(r.estado_pago||'—')+'</span></td></tr>';});
      h+='<tr><td><b>'+esc(mesTxt(S.lote.periodo,true))+'</b><span class="sub">este grupo</span></td><td class="cifra">'+(l.n_trabajadores!=null?l.n_trabajadores:'—')+'</td><td class="num cifra"><b style="color:var(--mor)">'+clp(l.total_clp)+'</b></td><td><span class="fx-est gris">'+esc((EST_LINEA[l.estado]||[l.estado])[0])+'</span></td></tr>';
      h+='</tbody></table><p class="nota">'+I('alerta','ic-cel')+'<span>Fuente: historial importado del Excel de facturación'+(rows.length?'':' (sin filas para este RUT)')+'.</span></p>';
      el.innerHTML=h;
    });
  },0);
  return box;
}
function eventosLinea(l){var ev=S.eventos.filter(function(e){return e.linea_id===l.id;});return ev.length?'<ul class="bit" style="padding:0">'+listaEventos(ev)+'</ul>':'<p class="ninguna">Sin movimientos propios de esta línea. Ver la bitácora del grupo.</p>';}
function renderDrawer(){
  var l=lineaSel();if(!l){cerrarDrawer();return;}
  $('drTitulo').textContent=l.razon_social||'—';
  $('drSub').textContent='RUT '+l.cliente_rut+' · Grupo '+l.tipo_lote+' · '+(EST_LINEA[l.estado]||[l.estado])[0];
  var av=alertasVista(l);$('drChips').innerHTML=av.cods.map(function(c){return chip(c,av.cubre);}).join('');
  var b={glosa:glosa,calculo:calculo,historial:historial,eventos:eventosLinea}[S.dtab](l);
  var acc=accionesLinea(l);
  if(acc&&S.dtab!=='eventos'&&/<button(?![^>]*disabled)/.test(acc))b='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'+acc+'</div>'+b;
  if(l.estado==='INCIERTO')b='<div class="fx-aviso" style="background:rgba(255,210,77,.08);border-color:rgba(255,210,77,.4)">'+I('alerta','placa ic-ama')+'<div><b>Línea incierta: no se debe reemitir.</b><p>'+esc(l.error||'El proveedor no confirmó la emisión.')+' En F1c se concilia buscando el documento por su clave.</p></div></div>'+b;
  $('drBody').innerHTML=b;
  document.querySelectorAll('[data-dtab]').forEach(function(t){var on=t.getAttribute('data-dtab')===S.dtab;t.classList.toggle('on',on);t.setAttribute('aria-selected',on?'true':'false');});
}
var focoPrevio=null;
function abrirDrawer(id){focoPrevio=document.activeElement;S.sel=+id;S.dtab='glosa';renderDrawer();$('drawer').classList.add('on');$('drawer').setAttribute('aria-hidden','false');$('velo').classList.add('on');$('drCerrar').focus();}
function cerrarDrawer(){var d=$('drawer');if(!d)return;var abierto=d.classList.contains('on');d.classList.remove('on');d.setAttribute('aria-hidden','true');$('velo').classList.remove('on');S.sel=null;if(abierto&&focoPrevio&&focoPrevio.focus)focoPrevio.focus();}

/* ── Modal y aviso ── */
var toastT;
function toast(t){var el=$('toast');el.innerHTML=t;el.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){el.classList.remove('on');},4200);}
function modal(o){
  var icEl=$('mIc');icEl.className='ic placa '+(o.icc||'ic-mor');icEl.innerHTML=ic(o.ic||'lapiz');
  $('mTitulo').textContent=o.t;$('mBody').innerHTML=o.b+'<div class="m-err" id="mErr" role="alert" hidden></div>';
  $('mFoot').innerHTML='<button type="button" class="g-btn sm" data-m="no">Cancelar</button>'+(o.ok?'<button type="button" class="g-btn sm '+(o.cls||'pri')+'" data-m="si">'+esc(o.ok)+'</button>':'');
  $('modal').classList.add('on');$('mvelo').classList.add('on');
  var f=document.querySelector('#mBody textarea,#mBody input');(f||document.querySelector('#mFoot [data-m="si"]')||document.querySelector('#mFoot [data-m="no"]')).focus();
  modal.cb=o.cb;
}
modal.error=function(m){var e=$('mErr');if(!e)return toast(I('alerta','ic-amb')+' '+esc(m));e.textContent=m;e.hidden=false;};
function cerrarModal(){$('modal').classList.remove('on');$('mvelo').classList.remove('on');modal.cb=null;}
window.FX_UI={modal:modal,cerrarModal:cerrarModal,toast:toast,btn:btn};

/* Ejecuta una RPC del motor: bloquea botones, muestra el error en español y recarga al terminar */
function ejecutar(fn,args,okMsg,enModal){
  if(S.ocupado)return Promise.resolve(false);
  S.ocupado=true;var si=document.querySelector('#mFoot [data-m="si"]');if(si){si.disabled=true;si.textContent='Guardando…';}
  render();
  return API.rpc(fn,args).then(function(r){
    S.ocupado=false;if(enModal)cerrarModal();toast(okMsg);return cargar().then(function(){return r||true;});
  }).catch(function(e){
    S.ocupado=false;var m=mensajeError(e);
    if(enModal&&$('modal').classList.contains('on')){modal.error(m);var b=document.querySelector('#mFoot [data-m="si"]');if(b){b.disabled=false;b.textContent=b.getAttribute('data-txt')||'Reintentar';}}
    else toast(I('alerta','ic-amb')+' '+esc(m));
    render();return false;
  });
}

/* ── Acciones ── */
function accion(act,id){
  var l=id!=null?S.lineas.filter(function(x){return x.id===+id;})[0]:null, lt=S.lote;
  if(act==='recargar'){$('fxEstado').innerHTML='';iniciar();return;}
  if(act==='ver'){abrirDrawer(id);return;}
  if(act==='filtro'){S.filtro=!S.filtro;renderTabla();var b=document.querySelector('[data-act="filtro"]');if(b)b.focus();return;}
  if(act==='preparar'){
    var nuevo=!lt||lt.estado==='ANULADO';
    modal({t:nuevo?'Preparar grupo '+S.vista:'Recalcular grupo '+S.vista,ic:'repetir',icc:'ic-cel',ok:nuevo?'Preparar':'Recalcular',
      b:'<p>'+(nuevo?'Se creará el <b>grupo '+S.vista+'</b> de <b>'+esc(mesTxt(S.periodo))+'</b> en modo <b>PRUEBA</b> con los clientes activos que corresponden a este grupo.':'Se vuelven a calcular todas las líneas del <b>grupo '+S.vista+'</b> con la ficha y la UF vigentes del período.')+'</p>'
       +'<p>La UF sale de la fila del período en Panel de Control (UF del día 1 del mes siguiente).</p>'
       +'<label class="chk"><input type="checkbox" id="mEstricto"'+(lt&&lt.gate_estricto?' checked':'')+'> Modo estricto: exigir reportes del mes completados (contable y remuneraciones)</label>',
      cb:function(){ejecutar('facturacion_lote_preparar',{p_periodo:S.periodo,p_tipo:S.vista,p_modo:MODO,p_estricto:$('mEstricto').checked},I('repetir','ic-cel')+' Grupo '+S.vista+(nuevo?' preparado.':' recalculado.'),true);return false;}});
    return;
  }
  if(act==='enviar'){var t=lt.totales||{}, nr=S.lineas.filter(function(x){return x.estado==='BORRADOR';}).length;
    modal({t:'Enviar a aprobación',ic:'enviar',icc:'ic-mor',ok:'Enviar al Master',b:'<p>Se enviará el <b>grupo '+esc(lt.tipo)+'</b> de '+esc(mesTxt(lt.periodo))+' al Master: <b>'+(+t.n_listas||0)+' líneas listas por '+clp(t.monto_listas)+'</b>.</p><p>El motor recalcula todo antes de congelarlo.'+(nr?' <b>'+nr+' línea(s) no listas</b> quedarán EXCLUIDAS al aprobar.':'')+'</p>',
      cb:function(){ejecutar('facturacion_lote_enviar_revision',{p_lote:lt.id},I('enviar','ic-mor')+' Grupo enviado a aprobación. Se avisó al Master.',true);return false;}});return;}
  if(act==='aprobar'){var t2=lt.totales||{};
    modal({t:'Aprobar grupo '+lt.tipo,ic:'aprobar',icc:'ic-ver',ok:'Aprobar grupo',b:'<p>Apruebas <b>'+(+t2.n_listas||0)+' facturas por '+clp(t2.monto_listas)+'</b> (diferencia vs mes anterior '+sig(t2.diferencia)+').</p><p>Se envía la huella de lo que estás viendo: si el grupo cambió, el motor lo rechaza y tendrás que recargar.</p>',
      cb:function(){ejecutar('facturacion_lote_aprobar',{p_lote:lt.id,p_huella:lt.huella_revision},I('aprobar','ic-ver')+' Grupo aprobado. Se avisó al facturador.',true);return false;}});return;}
  if(act==='devolver'){modal({t:'Devolver con comentario',ic:'devolver',icc:'ic-amb',ok:'Devolver al facturador',b:'<p>El grupo vuelve a <b>Devuelto</b> y el facturador recibe tu comentario.</p><label for="mCom">Comentario (obligatorio, mínimo 5 caracteres)</label><textarea id="mCom" maxlength="2000" placeholder="Ej.: revisar la diferencia de un cliente antes de reenviar"></textarea>',
    cb:function(){var v=$('mCom').value.trim();if(v.length<5){modal.error(ERRORES.COMENTARIO_OBLIGATORIO);$('mCom').focus();return false;}ejecutar('facturacion_lote_devolver',{p_lote:lt.id,p_comentario:v},I('devolver','ic-amb')+' Grupo devuelto con comentario.',true);return false;}});return;}
  if(act==='anular'){modal({t:'Anular grupo',ic:'basura',icc:'ic-roj',ok:'Anular grupo',cls:'peligro',b:'<p>Se anulará el <b>grupo '+esc(lt.tipo)+'</b> completo. Solo es posible porque no hay facturas emitidas. Después se puede preparar uno nuevo para el mismo período.</p><label for="mMot">Motivo (obligatorio, mínimo 10 caracteres)</label><textarea id="mMot" maxlength="1000" placeholder="Ej.: se preparó con la UF equivocada"></textarea>',
    cb:function(){var v=$('mMot').value.trim();if(v.length<10){modal.error(ERRORES.MOTIVO_OBLIGATORIO);$('mMot').focus();return false;}ejecutar('facturacion_lote_anular',{p_lote:lt.id,p_motivo:v},I('basura','ic-roj')+' Grupo anulado.',true);return false;}});return;}
  if(act==='trabajadores'&&l){modal({t:'Trabajadores de '+mesTxt(lt.periodo),ic:'lapiz',icc:'ic-ama',ok:'Guardar dato manual',b:'<p><b>'+esc(l.razon_social)+'</b> no tiene reporte de remuneraciones finalizado. Ingresa la cantidad liquidada en el mes.</p><label for="mTrab">Trabajadores liquidados</label><input id="mTrab" type="number" min="0" max="100000" step="1" inputmode="numeric" value="'+(l.n_trabajadores!=null?l.n_trabajadores:'')+'"><label for="mNota">Nota (obligatoria, mínimo 5 caracteres)</label><textarea id="mNota" maxlength="500" placeholder="Ej.: dato confirmado con el analista de RRHH">'+esc(l.origen_trabajadores==='MANUAL'?l.trab_manual_nota||'':'')+'</textarea><p style="margin-top:10px">Quedará la alerta <b>Dato manual</b> con tu nombre y la fecha.</p>',
    cb:function(){var n=$('mTrab').value.trim(), v=$('mNota').value.trim();if(!/^\d+$/.test(n)||+n>100000){modal.error('Ingresa una cantidad entera entre 0 y 100.000.');$('mTrab').focus();return false;}if(v.length<5){modal.error(ERRORES.NOTA_OBLIGATORIA);$('mNota').focus();return false;}
      ejecutar('facturacion_trabajadores_registrar',{p_linea:l.id,p_n:+n,p_nota:v},I('lapiz','ic-ama')+' Trabajadores guardados para '+esc(l.razon_social)+'.',true);return false;}});return;}
  if(act==='adicional'&&l){modal({t:'Agregar adicional del mes',ic:'mas',icc:'ic-ver',ok:'Agregar',b:'<p>Cobro extra solo para este mes en <b>'+esc(l.razon_social)+'</b>. Saldrá como una línea más del DTE.</p><label for="mG">Glosa (3 a 80 caracteres)</label><input id="mG" maxlength="80" placeholder="Ej.: Emisión de documentos"><label for="mD">Detalle (opcional)</label><input id="mD" maxlength="300" placeholder="Ej.: Emisión de 50 documentos en el mes"><label for="mM">Monto en pesos</label><input id="mM" type="number" min="1" step="1" inputmode="numeric" placeholder="25000">',
    cb:function(){var g=$('mG').value.trim(), m=$('mM').value.trim(), d=$('mD').value.trim();if(g.length<3||g.length>80){modal.error(ERRORES.GLOSA_INVALIDA);$('mG').focus();return false;}if(!/^\d+$/.test(m)||+m<=0){modal.error(ERRORES.MONTO_INVALIDO);$('mM').focus();return false;}
      ejecutar('facturacion_adicional_agregar',{p_linea:l.id,p_glosa:g,p_monto:+m,p_detalle:d||null},I('mas','ic-ver')+' Adicional agregado a '+esc(l.razon_social)+'.',true);return false;}});return;}
  if(act==='quitar-adicional'){var ad=null;Object.keys(S.adic).forEach(function(k){S.adic[k].forEach(function(a){if(a.id===+id)ad=a;});});if(!ad)return;
    modal({t:'Quitar adicional',ic:'basura',icc:'ic-roj',ok:'Quitar',cls:'peligro',b:'<p>Se quitará <b>'+esc(ad.glosa)+'</b> ('+clp(ad.monto)+') y la línea se recalcula.</p>',
      cb:function(){ejecutar('facturacion_adicional_eliminar',{p_adicional:ad.id},I('basura','ic-roj')+' Adicional quitado.',true);return false;}});return;}
}

/* ── Eventos ── */
function pintarIconosEstaticos(root){(root||document).querySelectorAll('[data-ic]').forEach(function(el){el.innerHTML=ic(el.getAttribute('data-ic'));el.removeAttribute('data-ic');});}
function pintarQuien(){
  var m=esMaster(), f=esFact();
  $('nomRol').textContent=S.yo&&S.yo.nombre?S.yo.nombre:(m?'Master':(f?'Facturador':'Lectura'));
  $('subRol').textContent=m?'aprueba · devuelve · anula':(f?'prepara · edita · envía':'solo lectura');
}
document.addEventListener('click',function(e){
  var m=e.target.closest('#mFoot [data-m]');
  if(m){if(m.getAttribute('data-m')==='si'&&modal.cb){if(modal.cb()===false)return;}cerrarModal();return;}
  var b=e.target.closest('[data-act]');
  if(b&&!b.disabled&&!e.target.closest('#vistaAdic,#ed,#pdf')){e.stopPropagation();accion(b.getAttribute('data-act'),b.getAttribute('data-id'));return;}
  var tr=e.target.closest('#tbody tr[data-id]');
  if(tr&&!e.target.closest('.tipw'))abrirDrawer(tr.getAttribute('data-id'));
});
document.addEventListener('DOMContentLoaded',function(){
  $('tbody').addEventListener('keydown',function(e){var tr=e.target.closest('tr[data-id]');if(tr&&e.target===tr&&(e.key==='Enter'||e.key===' ')){e.preventDefault();abrirDrawer(tr.getAttribute('data-id'));}});
  $('velo').addEventListener('click',cerrarDrawer);
  $('drCerrar').addEventListener('click',cerrarDrawer);
  $('mvelo').addEventListener('click',cerrarModal);
  document.addEventListener('keydown',function(e){if(e.key!=='Escape')return;
    if($('modal').classList.contains('on'))cerrarModal();
    else if($('pdf')&&$('pdf').classList.contains('on'))$('pdf').classList.remove('on');
    else if($('ed')&&$('ed').classList.contains('on')){if(window.FX_ADICIONAL)window.FX_ADICIONAL.cerrar();}
    else cerrarDrawer();});
  document.querySelectorAll('[data-dtab]').forEach(function(t){t.addEventListener('click',function(){S.dtab=t.getAttribute('data-dtab');renderDrawer();});});
  document.querySelectorAll('[data-tab]').forEach(function(t){t.addEventListener('click',function(){S.tab=t.getAttribute('data-tab');
    document.querySelectorAll('[data-tab]').forEach(function(x){x.classList.toggle('on',x===t);x.setAttribute('aria-selected',x===t?'true':'false');});
    document.querySelectorAll('.fx-panel').forEach(function(p){p.classList.toggle('on',p.id==='p-'+S.tab);});});});
  document.querySelectorAll('[data-vista]').forEach(function(b){b.addEventListener('click',function(){if(S.ocupado)return;S.vista=b.getAttribute('data-vista');S.filtro=false;cargar();});});
  $('selPeriodo').addEventListener('change',function(e){S.periodo=e.target.value||null;cargar();});
  if(DEMO){
    document.querySelectorAll('[data-rol]').forEach(function(b){b.addEventListener('click',function(){
      window.FX_DEMO_API.rol=b.getAttribute('data-rol');
      document.querySelectorAll('[data-rol]').forEach(function(x){x.classList.toggle('on',x===b);x.setAttribute('aria-pressed',x===b?'true':'false');});
      API.rpc('facturacion_yo',{}).then(function(yo){S.yo=yo;pintarQuien();render();toast(esMaster()?I('escudo','ic-cel')+' Viendo como Master (demo)':I('factura','ic-ama')+' Viendo como Facturador (demo)');});
    });});
  }
  iniciar();
});
})();
