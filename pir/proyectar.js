/* ============================================================
   pir/proyectar.js — MiRenta · Asistente "Proyectar" (5 pasos)
   1 Cliente y caso → 2 F22 del año anterior (apertura tributaria) → 3 Libro Diario y Balance (importación y conciliación)
   → 4 Mapeo de cuentas → 5 Ejecutar proyección → Pantalla de proyección.
   Solo orquesta lo que YA está instalado en producción (nada nuevo en la base):
     RPC  renta_yo · renta_cliente_habilitar · renta_cliente_resolver · renta_caso_crear · renta_fuente_registrar ·
          renta_apertura_vigente · renta_e1_entrada · renta_conciliar_diario_balance · renta_conciliar_apertura ·
          renta_asiento_confirmar_clase · renta_apertura_contable_aceptar · renta_mapeo_calcular · renta_mapeo_confirmar ·
          renta_supuesto_forecast_crear · renta_supuesto_forecast_activar · renta_e1_proyectar
     Edge mirenta-f22-leer (lectura del F22) · mirenta-importar (Diario / Balance / Plan de Masconta)
     Storage bucket privado mirenta-fuentes (ruta cliente/AC/clave_sha, exigida por su política)
   Cada RPC valida rol y cartera; la pantalla nunca calcula impuestos. La revisión fina de la apertura tributaria se hace en la
   pantalla ya existente (index.html), a la que se va y desde la que se vuelve aquí.
   Modo demostración: proyectar-demo.js (solo ?demo=1 en localhost).
   ============================================================ */
(function(){
'use strict';
var L=window.ProyectarLogica, AL=window.AperturaLogica;
var HOST=location.hostname, LOCAL=(HOST==='localhost'||HOST==='127.0.0.1'||HOST==='[::1]');
var DEMO=window.MR_DEMO===true&&LOCAL&&!!window.MR_PROY_DEMO_API;
var URLP=new URLSearchParams(location.search);

/* ── Íconos (trazo estilo Lucide); los comunes vienen de gIcon (gestoor-menu.js) ── */
var PX={
  'flecha-izq':'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>','flecha-der':'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  archivo:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  libro:'<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  balanza:'<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  etiqueta:'<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  rayo:'<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  persona:'<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',lupa:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  tendencia:'<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',cerrar:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
};
function ic(n){if(PX[n])return '<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+PX[n]+'</svg>';return window.gIcon?window.gIcon(n):'';}
function I(n,c){return '<i class="ic '+(c||'')+'">'+ic(n)+'</i>';}
function pintarIconos(root){(root||document).querySelectorAll('[data-ic]').forEach(function(el){el.innerHTML=ic(el.getAttribute('data-ic'));el.removeAttribute('data-ic');});}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function clp(n){if(n==null||n===''||isNaN(n))return '<span class="nd">No disponible</span>';n=Number(n);return (n<0?'−':'')+'$'+Math.round(Math.abs(n)).toLocaleString('es-CL');}
function num(n){return Number(n||0).toLocaleString('es-CL');}
function $(id){return document.getElementById(id);}
var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

/* ── Acceso a datos: real (sesión del usuario) o demostración local ── */
function errDe(status,texto){var j=null;try{j=JSON.parse(texto);}catch(e){}var e=new Error((j&&j.message)||texto||('HTTP '+status));e.code=j&&j.code;return e;}
function leer(r){if(!r.ok)return r.text().then(function(t){throw errDe(r.status,t);});return r.status===204?null:r.json();}
function sesion(){return window._sbAuthReady?Promise.resolve():new Promise(function(ok){window.addEventListener('gestoor-auth-ready',ok,{once:true});});}
var API=DEMO?window.MR_PROY_DEMO_API:{
  get:function(path){return sbFetch(path).then(leer);},
  rpc:function(fn,args){return sbFetch('rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||{})}).then(leer);},
  subir:function(ruta,archivo,tipo){return sesion().then(function(){return window._sbAuthClient.storage.from('mirenta-fuentes').upload(ruta,archivo,{contentType:tipo,upsert:false});})
    .then(function(r){if(r.error)throw new Error('No se pudo subir el archivo ('+r.error.message+').');});},
  invocar:function(fn,body){return sesion().then(function(){return window._sbAuthClient.functions.invoke(fn,{body:body});}).then(function(r){
    if(!r.error)return {ok:true,data:r.data};
    var ctx=r.error.context;return (ctx&&typeof ctx.json==='function'?ctx.json().catch(function(){return null;}):Promise.resolve(null)).then(function(j){return {ok:false,data:j,mensaje:(j&&(j.error||j.mensaje||j.codigo))||r.error.message};});});}
};
function getTodo(path){var out=[],P=1000;function pag(off){return API.get(path+(path.indexOf('?')<0?'?':'&')+'limit='+P+'&offset='+off).then(function(r){r=r||[];out=out.concat(r);return r.length<P||off>20000?out:pag(off+P);});}return pag(0);}
function espera(ms){return new Promise(function(ok){setTimeout(ok,ms);});}
function sha256(buf){return crypto.subtle.digest('SHA-256',buf).then(function(h){return Array.prototype.map.call(new Uint8Array(h),function(b){return b.toString(16).padStart(2,'0');}).join('');});}

/* ── Estado ── */
var S={yo:null,clientes:[],casosTodos:[],rcTodos:[],q:'',cliente:null,rc:null,caso:null,d:null,P:null,abierto:null,ocupado:null,aviso:null,cat:null,verTodas:false,corte:null,mesHasta:null,cargando:true,error:null};

/* ── Carga ── */
function iniciar(){
  pintarIconos();
  if(DEMO){$('mrDemo').hidden=false;document.documentElement.classList.remove('auth-pending');}
  API.rpc('renta_yo',{}).then(function(r){
    S.yo=Array.isArray(r)?r[0]:r;
    if(!S.yo||!(S.yo.es_master||S.yo.rol==='contable')){S.cargando=false;app('<div class="aviso rojo">'+I('candado','ic-roj')+'<span>MiRenta es solo para el Master y los analistas contables con cartera asignada.</span></div>');return;}
    return cargarCartera();
  }).catch(function(e){S.cargando=false;S.error=e;render();});
}
function cargarCartera(){
  return Promise.all([
    getTodo('clientes?select=id,razon_social,estado,regimen,tiene_contabilidad,analista_contable_usuario_id&order=razon_social.asc,id.asc'),
    getTodo('renta_casos?select=id,cliente_id,anio_comercial,anio_tributario,regimen,estado,version&estado=neq.RECTIFIED&order=anio_comercial.desc,id.desc'),
    getTodo('renta_clientes?select=cliente_id,modalidad,estado')
  ]).then(function(r){
    var cls=r[0]||[];if(!S.yo.es_master)cls=cls.filter(function(c){return c.analista_contable_usuario_id===S.yo.id;});   // misma regla que renta_clientes_visibles()
    S.clientes=cls;S.casosTodos=r[1]||[];S.rcTodos=r[2]||[];
    var idCaso=+URLP.get('caso'), idCli=+URLP.get('cliente');
    if(idCaso){var k=S.casosTodos.filter(function(c){return c.id===idCaso;})[0];if(k)idCli=k.cliente_id;}
    if(idCli&&cls.some(function(c){return c.id===idCli;}))return elegirCliente(idCli,true);
    S.cargando=false;render();
  });
}
function casoDe(cid){
  var ks=S.casosTodos.filter(function(k){return k.cliente_id===cid&&k.anio_comercial===L.AC_DEFECTO;});
  return ks.filter(function(k){return k.regimen==='14D3';})[0]||ks[0]||null;
}
function elegirCliente(cid,inicial){
  S.cliente=S.clientes.filter(function(c){return c.id===+cid;})[0]||null;S.abierto=null;S.aviso=null;S.verTodas=false;S.corte=null;
  if(!S.cliente){S.caso=null;S.d=null;S.P=null;render();return Promise.resolve();}
  if(!inicial)try{history.pushState(null,'',location.pathname+'?'+(DEMO?'demo=1&':'')+'cliente='+S.cliente.id);}catch(e){}
  return recargar();
}
function recargar(){
  S.cargando=true;render();
  var cid=S.cliente.id;
  return Promise.all([
    API.get('renta_clientes?select=cliente_id,modalidad,estado&cliente_id=eq.'+cid),
    API.get('renta_casos?select=id,cliente_id,anio_comercial,anio_tributario,regimen,estado,version&cliente_id=eq.'+cid+'&estado=neq.RECTIFIED&order=id.desc')
  ]).then(function(r){
    S.rc=(r[0]||[])[0]||null;
    S.casosTodos=S.casosTodos.filter(function(k){return k.cliente_id!==cid;}).concat(r[1]||[]);
    S.caso=casoDe(cid);
    var d={yo:S.yo,cliente:S.cliente,rc:S.rc,caso:S.caso};
    if(!S.caso||S.caso.regimen!=='14D3')return d;
    var id=S.caso.id;
    return Promise.all([
      getTodo('renta_fuentes?select=id,tipo_fuente,origen,nombre_original,estado,metadatos,sha256_estado,cargado_at&caso_id=eq.'+id+'&order=id.asc'),
      getTodo('renta_corridas?select=id,fuente_id,tipo_fuente,estado,anio_detectado,n_asientos,n_lineas,total_debe,total_haber,resultado_tipo,resultado_monto,n_bloqueantes,n_revision,n_advertencias,error_codigo,error_mensaje,finalizado_at&caso_id=eq.'+id+'&order=id.asc'),
      getTodo('renta_f22_lecturas?select=id,fuente_id,estado,blocking_count,resultado,error_codigo,creado_at&caso_id=eq.'+id+'&order=id.desc'),
      API.rpc('renta_apertura_vigente',{p_caso_id:id}).catch(function(){return null;}),
      API.rpc('renta_e1_entrada',{p_caso_id:id}).catch(function(){return null;}),
      API.get('renta_mapeo_snapshots?select=id,catalogo_version,corrida_diario,corrida_balance,cuentas_usadas,cuentas_mapeadas,cuentas_resueltas,cuentas_unknown,creado_at&caso_id=eq.'+id+'&estado=eq.VIGENTE'),
      API.get('renta_supuestos_forecast?select=id,version,forecast_method,parameters,estado&caso_id=eq.'+id+'&estado=eq.ACTIVE'),
      API.get('renta_motor_corridas?select=id,cutoff_date,estado,resultado_estado,final_bloqueos,finalizado_at,error_codigo&caso_id=eq.'+id+'&motor=eq.T1_RLI_14D3&order=id.desc&limit=1')
    ]).then(function(x){
      d.fuentes=x[0];d.corridas=x[1];d.lecturas=x[2];d.aperturaVigente=x[3];d.entrada=x[4];d.snapshot=(x[5]||[])[0]||null;d.supuesto=(x[6]||[])[0]||null;d.motor=(x[7]||[])[0]||null;
      var extras=[];
      if(d.snapshot){
        extras.push(getTodo('renta_mapeo_resultados?select=cuenta_codigo,cuenta_nombre,n_lineas,saldo,categoria,clase,estado,origen&snapshot_id=eq.'+d.snapshot.id+'&order=cuenta_codigo.asc').then(function(rs){d.resultados=rs;}));
        if(!S.cat||S.cat.v!==d.snapshot.catalogo_version)extras.push(getTodo('renta_semantica_catalogo?select=categoria,clase,descripcion,requiere_confirmacion&version=eq.'+encodeURIComponent(d.snapshot.catalogo_version)+'&order=categoria.asc').then(function(c){S.cat={v:d.snapshot.catalogo_version,lista:c||[]};}));
      }
      var dia=d.entrada&&d.entrada.efectivo&&d.entrada.efectivo.diario;
      if(dia&&dia.corrida_id)extras.push(API.get('renta_asientos?select=fecha&corrida_id=eq.'+dia.corrida_id+'&order=fecha.desc&limit=1').then(function(a){var f=a&&a[0]&&a[0].fecha;S.mesHasta=f?+String(f).slice(5,7):null;}).catch(function(){S.mesHasta=null;}));
      else S.mesHasta=null;
      return Promise.all(extras).then(function(){return d;});
    });
  }).then(function(d){
    S.d=d;S.P=L.pasos(d);S.cargando=false;
    var actual=S.abierto&&S.P[S.abierto-1];
    if(!S.abierto)S.abierto=+URLP.get('paso')||L.pasoActivo(S.P);
    else if(actual&&actual.estado==='listo')S.abierto=L.pasoActivo(S.P,S.abierto+1);   // al completar un paso, avanza solo
    render();
  }).catch(function(e){S.cargando=false;S.error=e;render();});
}

/* ── Render ── */
function app(h){$('mrApp').innerHTML=h;pintarIconos($('mrApp'));}
function chipEstado(e){var x=L.ETIQUETA_ESTADO[e]||['gris',e];var icn={verde:I('check'),rojo:I('alerta'),ambar:I('alerta'),lila:'<span class="mrp-spin"></span>'}[x[0]]||'';return '<span class="estado '+x[0]+'">'+icn+esc(x[1])+'</span>';}
function avisoHtml(){if(!S.aviso)return '';var t=S.aviso.tipo;return '<div class="aviso '+t+'" role="'+(t==='rojo'?'alert':'status')+'">'+I(t==='verde'?'check':t==='rojo'?'alerta':'info',t==='verde'?'ic-ver':t==='rojo'?'ic-roj':'ic-cel')+'<span>'+S.aviso.texto+'</span></div>';}
function ocup(clave,txt){return S.ocupado===clave?'<span class="mrp-spin"></span>'+esc(txt||'Trabajando…'):null;}

function render(){
  if(S.error){app('<div class="aviso rojo">'+I('alerta','ic-roj')+'<span>No se pudo cargar MiRenta: '+esc(S.error.message||S.error)+'</span><button type="button" class="btn sec chico" data-act="recargar">Reintentar</button></div>');return;}
  if(S.cargando&&!S.d&&!S.clientes.length){app('<div class="aviso lila"><span class="mrp-spin"></span>Cargando…</div>');return;}
  var h='<section class="pry-intro"><h2 class="mrp-titulo">Proyectar la renta <span>AT '+(L.AC_DEFECTO+1)+'</span></h2>'
    +'<p class="mrp-lead">Carga el <b>F22 del año anterior</b> y la <b>contabilidad '+L.AC_DEFECTO+'</b> (Libro Diario y Balance de Masconta). El sistema los lee, los cuadra y calcula la proyección.</p></section>';
  if(!S.cliente){app(h+selectorCliente());return;}
  h+=cabecera()+avisoHtml();
  if(S.cargando&&!S.P){app(h+'<div class="aviso lila"><span class="mrp-spin"></span>Cargando el caso…</div>');return;}
  h+=stepper()+'<div class="pry-pasos">'+S.P.map(tarjetaPaso).join('')+'</div>';
  app(h);
}
function selectorCliente(){
  var q=S.q.trim().toLowerCase();
  var fs=S.clientes.filter(function(c){return (c.estado==='activo'&&c.tiene_contabilidad!==false)||casoDe(c.id);})
    .filter(function(c){return !q||String(c.razon_social||'').toLowerCase().indexOf(q)>=0;});
  var filas=fs.slice(0,60).map(function(c){
    var k=casoDe(c.id), rc=S.rcTodos.filter(function(x){return x.cliente_id===c.id;})[0];
    var est=!rc?'<span class="estado gris">Sin habilitar en MiRenta</span>':rc.estado!=='OPERATIONAL'?'<span class="estado ambar">Habilitación pendiente</span>':!k?'<span class="estado ambar">Sin caso '+L.AC_DEFECTO+'</span>':'<span class="estado verde">'+I('check')+'Caso '+L.AC_DEFECTO+'</span>';
    return '<button type="button" class="pry-cli" data-act="cliente" data-id="'+c.id+'"><b>'+esc(c.razon_social||('Cliente #'+c.id))+'</b><span class="pry-cli-e">'+(c.regimen&&c.regimen!=='14D3'?'<span class="estado gris">Régimen '+esc(c.regimen)+'</span>':'')+est+'</span>'+I('flecha-der','ic-mor')+'</button>';
  }).join('');
  return '<section class="card"><div class="h"><h2>Paso 1 · ¿A qué <span>cliente</span> vas a proyectar?</h2></div>'
    +'<label class="pry-buscar">'+I('lupa','ic-cel')+'<input type="search" id="pryBuscar" placeholder="Buscar por razón social…" value="'+esc(S.q)+'" autocomplete="off" aria-label="Buscar cliente"></label>'
    +(filas?'<div class="pry-clis">'+filas+'</div>':'<div class="aviso gris">'+I('info','ic-cel')+'<span>'+(S.clientes.length?'Ningún cliente coincide con la búsqueda.':'No tienes clientes con contabilidad en tu cartera.')+'</span></div>')
    +(fs.length>60?'<p class="nota">Se muestran los primeros 60. Escribe para buscar.</p>':'')+'</section>';
}
function cabecera(){
  var k=S.caso;
  return '<section class="pry-cab"><div class="pry-cab-cli">'+I('persona','ic-mor')+'<div><b>'+esc(S.cliente.razon_social||('Cliente #'+S.cliente.id))+'</b><small>'
    +(k?'Año comercial '+k.anio_comercial+' · AT '+k.anio_tributario+' · '+(k.regimen==='14D3'?'Pro Pyme General (14 D N°3)':esc(k.regimen)):'Año comercial '+L.AC_DEFECTO+' · AT '+(L.AC_DEFECTO+1))+'</small></div></div>'
    +'<div class="pry-cab-acc">'+(S.cargando?'<span class="mrp-spin" aria-label="Actualizando"></span>':'')
    +'<button type="button" class="btn sec chico" data-act="cambiar">Cambiar cliente</button>'
    +(S.d&&S.d.motor&&S.d.motor.estado==='COMPLETED'?'<a class="btn chico" href="proyeccion.html?'+(DEMO?'demo=1&':'')+'caso='+k.id+'">'+I('tendencia')+'Ver proyección</a>':'')+'</div></section>';
}
function stepper(){
  return '<ol class="pry-stepper" aria-label="Pasos para proyectar">'+S.P.map(function(p){
    var x=L.ETIQUETA_ESTADO[p.estado]||['gris',''];
    return '<li class="e-'+x[0]+(S.abierto===p.n?' act':'')+'"><button type="button" data-paso="'+p.n+'" aria-current="'+(S.abierto===p.n?'step':'false')+'"><b>'+(p.estado==='listo'?ic('check'):p.n)+'</b><span>'+esc(p.titulo)+'<small>'+esc(x[1])+'</small></span></button></li>';
  }).join('')+'</ol>';
}
var ACC={caso:'acc-CAP',f22:'acc-RAI',contabilidad:'acc-SAC',mapeo:'acc-CPTS',proyectar:'acc-PPM'};
var ICONO={caso:['persona','ic-mor'],f22:['archivo','ic-amb'],contabilidad:['libro','ic-cel'],mapeo:['etiqueta','ic-cel'],proyectar:['rayo','ic-ver']};
function tarjetaPaso(p){
  var abierto=S.abierto===p.n, ico=ICONO[p.clave];
  var h='<section class="card pry-paso '+ACC[p.clave]+(abierto?' abierto':'')+(p.estado==='bloqueado'?' apagado':'')+'" id="paso-'+p.n+'">'
    +'<button type="button" class="pry-paso-h" data-paso="'+p.n+'" aria-expanded="'+abierto+'"><span class="pry-num">'+p.n+'</span>'+I(ico[0],ico[1])
    +'<span class="pry-paso-t"><b>'+esc(p.titulo)+(p.recomendado?' <em>Recomendado</em>':'')+'</b><small>'+esc(p.detalle[0]||'')+'</small></span>'+chipEstado(p.estado)+'</button>';
  if(abierto)h+='<div class="pry-paso-c">'+(p.estado==='bloqueado'?'<div class="aviso gris">'+I('info','ic-cel')+'<span>Completa primero el paso anterior.</span></div>':CUERPO[p.clave](p))+'</div>';
  return h+'</section>';
}
function detalles(p,desde){return p.detalle.slice(desde||0).map(function(t){return '<p class="t2">'+esc(t)+'</p>';}).join('');}

var CUERPO={
  caso:function(p){
    var h=detalles(p,1), es=S.yo.es_master;
    if(!S.rc){
      h+=es?'<div class="mrp-acciones"><button type="button" class="btn" data-act="habilitar">'+(ocup('habilitar','Habilitando…')||I('check')+'Habilitar en MiRenta')+'</button></div><p class="nota">Como Master lo dejas operativo de inmediato (queda registrado en la bitácora).</p>'
        :'<div class="aviso ambar">'+I('alerta','ic-amb')+'<span>Pide al Master que habilite este cliente en MiRenta (Cartera de Renta → Proyectar).</span></div>';
    } else if(S.rc.estado!=='OPERATIONAL'){
      h+=es?'<div class="mrp-acciones"><button type="button" class="btn" data-act="activar">'+(ocup('activar','Activando…')||I('check')+(S.rc.estado==='PENDING_MASTER_APPROVAL'?'Aprobar y activar':'Activar'))+'</button></div>':'<div class="aviso ambar">'+I('reloj','ic-amb')+'<span>Esperando que el Master active al cliente.</span></div>';
    } else if(!S.caso){
      var reg=S.cliente.regimen;
      if(reg&&reg!=='14D3')return h+'<div class="aviso gris">'+I('info','ic-cel')+'<span>Cuando el motor incluya otros regímenes podrás proyectarlo aquí.</span></div>';
      h+='<div class="mrp-acciones"><button type="button" class="btn" data-act="crear-caso">'+(ocup('crear','Creando…')||I('mas')+'Crear caso '+L.AC_DEFECTO+' · Pro Pyme General (14 D N°3)')+'</button></div>'
        +(reg?'':'<p class="nota">La ficha del cliente no indica régimen: confirma que es Pro Pyme General antes de crear el caso.</p>');
    } else if(p.estado==='listo') h+='<div class="mrp-acciones"><button type="button" class="btn" data-paso="2">Continuar '+I('flecha-der')+'</button></div>';
    return h;
  },
  f22:function(p){
    var h=detalles(p,1), lec=p.lectura, k=S.caso;
    var vig=S.d.aperturaVigente||{}, tiene=vig.effective||vig.working;
    if(lec&&lec.estado==='PROPUESTA'||tiene)h+=saldosPropuestos(lec);
    if(!tiene&&lec&&lec.estado==='PROPUESTA')
      h+='<div class="mrp-acciones"><a class="btn" href="index.html?caso='+k.id+'&volver=proyectar">'+I('lupa')+'Revisar y confirmar los saldos</a><button type="button" class="btn sec" data-paso="3">Seguir con la contabilidad '+I('flecha-der')+'</button></div>'
        +'<p class="nota">La revisión se hace en la pantalla de Apertura tributaria (cada saldo con su respaldo y un motivo). Al terminar, vuelves aquí con “Volver a Proyectar”.</p>';
    if(tiene)h+='<div class="mrp-acciones"><a class="btn sec" href="index.html?caso='+k.id+'&volver=proyectar">'+I('ver')+'Ver la apertura tributaria</a><button type="button" class="btn" data-paso="3">Continuar '+I('flecha-der')+'</button></div>';
    if(!tiene&&(!lec||lec.estado!=='PROPUESTA')){
      var f=p.f22;
      h+='<div class="pry-archivo acc-RAI"><div class="pry-arch-t">'+I('archivo','ic-amb')+'<div><b>F22 AT '+k.anio_comercial+' (Compacto del SII, en PDF)</b><small>SII → Servicios online → Renta → Consulta y seguimiento → “Compacto” del año tributario '+k.anio_comercial+'.</small></div></div>'
        +(f?'<p class="pry-arch-f">'+I('check','ic-ver')+esc(f.nombre_original)+' <span class="t3">· subido el '+L.fecha(f.cargado_at)+'</span></p>':'')
        +'<div class="pry-subir"><input type="file" id="pryF22" accept="application/pdf,.pdf" aria-label="Elegir el PDF del F22">'
        +'<button type="button" class="btn" data-act="subir-f22"'+(S.ocupado?' disabled':'')+'>'+(ocup('f22','Subiendo y leyendo…')||I('subir')+(f?'Reemplazar y leer':'Subir y leer'))+'</button>'
        +(f&&(!lec||lec.estado!=='EN_PROCESO')?'<button type="button" class="btn sec" data-act="leer-f22" data-id="'+f.id+'"'+(S.ocupado?' disabled':'')+'>'+(ocup('leer','Leyendo…')||'Volver a leer')+'</button>':'')+'</div></div>'
        +'<div class="mrp-acciones"><button type="button" class="btn sec" data-paso="3">Seguir sin F22 por ahora '+I('flecha-der')+'</button></div>';
    }
    return h;
  },
  contabilidad:function(p){
    var h=p.estado==='problema'?'<div class="aviso rojo">'+I('alerta','ic-roj')+'<span>'+esc(p.detalle[0]||'')+'</span></div>':'';
    h+='<div class="pry-archivos">'+p.archivos.map(filaArchivo).join('')+'</div>';
    var cdb=p.conciliacion, apc=p.aperturaContable||{}, ant=p.conciliacionAnterior;
    if(cdb)h+='<div class="aviso '+(cdb.evaluacion==='CUADRA'?'verde':'rojo')+'">'+I(cdb.evaluacion==='CUADRA'?'check':'alerta',cdb.evaluacion==='CUADRA'?'ic-ver':'ic-roj')+'<span><b>Diario ↔ Balance:</b> '+(cdb.evaluacion==='CUADRA'?'cuadran las '+num(cdb.cuentas)+' cuentas.':num(cdb.diferencias)+' cuenta(s) con diferencia de '+num(cdb.cuentas)+'.')+'</span></div>';
    if(ant)h+='<div class="aviso '+(['CUADRA','TRASPASO_RESULTADO'].indexOf(ant.evaluacion)>=0?'verde':'ambar')+'">'+I('balanza',['CUADRA','TRASPASO_RESULTADO'].indexOf(ant.evaluacion)>=0?'ic-ver':'ic-amb')+'<span><b>Apertura ↔ cierre del año anterior:</b> '
      +({CUADRA:'cuadra.',TRASPASO_RESULTADO:'cuadra (con el traspaso del resultado del año anterior).',OPENING_NOT_RECONCILED:'el Diario no trae una apertura comparable.'}[ant.evaluacion]||num(ant.diferencias)+' diferencia(s): revísalas con el Master.')+'</span></div>';
    if(apc.estado==='A3'||apc.estado==='A1')
      h+='<div class="pry-bloque"><p><b>Asiento de apertura N° '+esc(apc.asiento_numero||'—')+'</b> '+(apc.estado==='A3'?'detectado por el sistema.':'confirmado; falta aceptar sus saldos.')+' Confírmalo para dejar aceptados los saldos iniciales de las cuentas (recomendado; necesario para la proyección FINAL).</p>'
        +'<div class="mrp-acciones"><button type="button" class="btn sec" data-act="apertura-contable"'+(S.ocupado?' disabled':'')+'>'+(ocup('apc','Confirmando…')||I('check','ic-ver')+'Confirmar asiento de apertura')+'</button></div></div>';
    if(p.estado==='listo'||p.estado==='revisar')h+='<div class="mrp-acciones"><button type="button" class="btn" data-paso="4">Continuar '+I('flecha-der')+'</button></div>';
    return h;
  },
  mapeo:function(p){
    var h='', s=p.snapshot;
    if(!s||p.estado==='pendiente'){
      return h+detalles(p,1)+'<div class="mrp-acciones"><button type="button" class="btn" data-act="mapeo-calcular"'+(S.ocupado?' disabled':'')+'>'+(ocup('mapeo','Calculando…')||I('etiqueta')+'Calcular mapeo de cuentas')+'</button></div>'
        +'<p class="nota">El sistema clasifica cada cuenta (ingresos, gastos, activo fijo, retiros…) con las reglas ya aprobadas. Tú solo confirmas lo que propone.</p>';
    }
    h+='<div class="pry-kpis"><div><small>Cuentas con movimiento</small><b>'+num(s.cuentas_usadas)+'</b></div><div><small>Clasificadas por regla</small><b class="t-verde">'+num(s.cuentas_resueltas)+'</b></div>'
      +'<div><small>Propuestas por confirmar</small><b class="t-ambar">'+num(p.porConfirmar.length-p.sinClasificar)+'</b></div><div><small>Sin clasificar</small><b class="'+(p.sinClasificar?'t-rojo':'')+'">'+num(p.sinClasificar)+'</b></div></div>';
    if(!p.porConfirmar.length)return h+'<div class="aviso verde">'+I('check','ic-ver')+'<span>Todas las cuentas están clasificadas.</span></div><div class="mrp-acciones"><button type="button" class="btn" data-paso="5">Continuar '+I('flecha-der')+'</button></div>';
    var inf=p.porConfirmar.filter(function(r){return r.estado==='INFERRED';}).length;
    h+='<p class="t2">Revisa la clasificación propuesta. Si está bien, confírmala; si no, elige otra y escribe el motivo.</p>';
    var lista=S.verTodas?p.porConfirmar:p.porConfirmar.slice(0,12);
    h+='<div class="pry-map">'+lista.map(filaMapeo).join('')+'</div>';
    if(p.porConfirmar.length>lista.length)h+='<button type="button" class="link pry-ver" data-act="ver-todas">Ver las '+p.porConfirmar.length+' cuentas</button>';
    h+='<div class="mrp-acciones">'+(inf?'<button type="button" class="btn" data-act="confirmar-todas"'+(S.ocupado?' disabled':'')+'>'+(ocup('todas','Confirmando…')||I('check')+'Confirmar las '+inf+' propuestas')+'</button>':'')
      +'<button type="button" class="btn sec" data-paso="5">Seguir a proyectar '+I('flecha-der')+'</button></div>'
      +'<p class="nota">Puedes proyectar con cuentas por confirmar: la proyección sale PRELIMINAR. Las cuentas sin clasificar no suman en ninguna partida hasta que las confirmes.</p>';
    return h;
  },
  proyectar:function(p){
    var h='', k=S.caso, m=p.motor;
    var mh=S.mesHasta||0, ops=L.cortes(k.anio_comercial,mh);
    if(!S.corte||ops.indexOf(S.corte)<0)S.corte=ops[ops.length-1]||null;
    if(m&&m.estado==='COMPLETED')h+=resultado(m);
    else if(m&&m.estado==='FAILED')h+='<div class="aviso rojo">'+I('alerta','ic-roj')+'<span>La última corrida falló ('+esc(m.error_codigo||'sin código')+'). Revisa los pasos anteriores y vuelve a intentarlo.</span></div>';
    h+='<div class="pry-bloque"><div class="pry-g2"><label class="mrp-campo"><span>Contabilidad al (fin de mes)</span><select id="pryCorte">'
      +(ops.length?ops.map(function(o){return '<option value="'+o+'"'+(o===S.corte?' selected':'')+'>'+L.fecha(o)+' ('+MESES[+o.slice(5,7)-1]+')</option>';}).join(''):'<option value="">Sin meses cubiertos</option>')+'</select></label>'
      +'<div class="pry-sup"><span>Proyección al cierre de diciembre</span>'+(p.supuesto?'<p>'+I('check','ic-ver')+'Supuesto activo v'+p.supuesto.version+' · lineal'+(p.supuesto.parameters&&p.supuesto.parameters.sim_retiros_adicionales?' con retiros simulados':'')+'</p>'
        :'<label class="mrc-check"><input type="checkbox" id="prySup" checked> Proyectar los meses que faltan con el promedio del año (supuesto estándar)</label>')+'</div></div>'
      +'<div class="mrp-acciones"><button type="button" class="btn pry-go" data-act="proyectar"'+(S.ocupado||!ops.length?' disabled':'')+'>'+(ocup('proy','Calculando la proyección…')||I('rayo')+(m&&m.estado==='COMPLETED'?'Volver a ejecutar la proyección':'Ejecutar proyección'))+'</button></div>'
      +'<p class="nota">Si nada cambió desde la última corrida, el motor la reutiliza. El resultado es PRELIMINAR mientras haya pendientes para FINAL (no reemplaza la declaración de renta).</p></div>';
    return h;
  }
};
function saldosPropuestos(lec){
  var props=(lec&&lec.resultado&&lec.resultado.propuesta)||[];
  var grupos=[['RAI','acc-RAI',function(k){return k==='opening.rai';}],['SAC','acc-SAC',function(k){return k.indexOf('opening.sac.')===0;}],['CPTS','acc-CPTS',function(k){return k==='opening.cpts'||k==='opening.cpts_negative';}]];
  if(!props.length)return '';
  return '<div class="pry-saldos">'+grupos.map(function(g){
    var it=props.filter(function(x){return g[2](x.item_key);}), con=it.filter(function(x){return x.monto!=null;});
    var tot=con.reduce(function(a,x){return a+(x.item_key==='opening.cpts_negative'?-1:1)*Number(x.monto);},0);
    var rev=it.some(function(x){return x.estado==='REVIEW'||x.estado==='PENDING';});
    return '<div class="pry-saldo '+g[1]+'"><span class="chip">'+g[0]+'</span><b>'+(con.length?clp(tot):'<span class="nd">No leído</span>')+'</b><small>'+(rev?'Requiere revisión':'Leído desde el F22')+'</small></div>';
  }).join('')+'</div><p class="nota">Saldos propuestos por la lectura automática del F22 (aún sin confirmar si no está declarada la apertura).</p>';
}
function filaArchivo(a){
  var c=a.corrida, f=a.fuente, def=a.def, k=S.caso, per=a.periodo, id='pryArch-'+def.clave;
  var res='';
  if(c&&c.estado==='PROCESSED'){
    res='<span>'+(def.tipo==='LIBRO_DIARIO'?num(c.n_asientos)+' asientos · '+num(c.n_lineas)+' líneas':def.tipo==='BALANCE'?num(c.n_lineas)+' cuentas'+(c.resultado_tipo?' · '+(c.resultado_tipo==='UTILIDAD'?'utilidad ':'pérdida ')+clp(c.resultado_monto):''):num(c.n_lineas)+' cuentas')+(c.anio_detectado?' · año '+c.anio_detectado:'')+'</span>';
    if(+c.n_bloqueantes||+c.n_revision)res+='<span class="t-ambar">'+(+c.n_bloqueantes?num(c.n_bloqueantes)+' error(es) · ':'')+(+c.n_revision?num(c.n_revision)+' por revisar':'')+'</span>';
  } else if(c&&c.estado==='ERROR') res='<span class="t-rojo">No se pudo leer: '+esc(c.error_mensaje||c.error_codigo||'formato no reconocido')+'</span>';
  var tituloT=def.titulo+(per?' '+per:'');
  return '<div class="pry-archivo '+(a.estado==='listo'?'ok':a.estado==='problema'?'mal':'')+'"><div class="pry-arch-t">'+I(def.tipo==='BALANCE'?'balanza':'libro',def.obligatorio?'ic-cel':'ic-mor')
    +'<div><b>'+esc(tituloT)+' <em class="'+(def.obligatorio?'obl':'opc')+'">'+(def.obligatorio?'Obligatorio':def.clave==='BALANCE_ANT'?'Recomendado':'Opcional')+'</em></b><small>'+esc(def.ayuda.replace('del año','del año'+(per?' '+per:'')))+'</small></div>'+chipEstado(a.estado)+'</div>'
    +(f?'<p class="pry-arch-f">'+I('archivo','ic-cel')+esc(f.nombre_original)+' <span class="t3">· '+L.fecha(f.cargado_at)+'</span></p>':'')
    +(res?'<p class="pry-arch-r">'+res+'</p>':'')
    +'<div class="pry-subir"><input type="file" id="'+id+'" accept=".xls,.xlsx,.html,.htm" aria-label="Elegir '+esc(tituloT)+'">'
    +'<button type="button" class="btn'+(f?' sec':'')+' chico" data-act="subir-arch" data-clave="'+def.clave+'"'+(S.ocupado?' disabled':'')+'>'+(ocup('arch-'+def.clave,'Subiendo e importando…')||I('subir')+(f?'Reemplazar':'Subir e importar'))+'</button>'
    +(f&&(!c||c.estado==='ERROR')?'<button type="button" class="btn sec chico" data-act="importar" data-id="'+f.id+'"'+(S.ocupado?' disabled':'')+'>'+(ocup('imp-'+f.id,'Importando…')||'Importar de nuevo')+'</button>':'')+'</div></div>';
}
function catOpts(sel){
  var l=(S.cat&&S.cat.lista)||[];
  return '<option value="">Elegir otra…</option>'+l.map(function(c){return '<option value="'+esc(c.categoria)+'"'+(c.categoria===sel?' selected':'')+'>'+esc(c.descripcion||c.categoria)+'</option>';}).join('');
}
function descCat(c){var x=((S.cat&&S.cat.lista)||[]).filter(function(y){return y.categoria===c;})[0];return x?(x.descripcion||c):(c||'');}
function filaMapeo(r){
  var key=esc(r.cuenta_codigo);
  return '<div class="pry-map-f'+(r.estado==='UNKNOWN'?' unk':'')+'"><div class="pry-map-c"><b>'+key+'</b><span>'+esc(r.cuenta_nombre||'')+'</span><small>'+num(r.n_lineas)+' líneas · saldo '+clp(r.saldo)+'</small></div>'
    +'<div class="pry-map-p">'+(r.estado==='UNKNOWN'?'<span class="estado rojo">Sin clasificar</span>':'<small>Propuesta del sistema</small><b>'+esc(descCat(r.categoria))+'</b>')+'</div>'
    +'<div class="pry-map-a"><select data-map-cat="'+key+'" aria-label="Clasificación de la cuenta '+key+'">'+catOpts('')+'</select>'
    +'<input type="text" data-map-mot="'+key+'" placeholder="Motivo (si cambias)" aria-label="Motivo para la cuenta '+key+'">'
    +'<button type="button" class="btn chico" data-act="confirmar-cuenta" data-cta="'+key+'" data-prop="'+esc(r.categoria||'')+'"'+(S.ocupado?' disabled':'')+'>'+(ocup('cta-'+r.cuenta_codigo,'…')||(r.estado==='UNKNOWN'?'Clasificar':'Confirmar'))+'</button></div></div>';
}
function resultado(m){
  var fin=m.resultado_estado==='FINAL', bl=(S.P[4].bloqueos||[]);
  var h='<div class="pry-res '+(fin?'fin':'pre')+'"><div class="pry-res-h">'+I(fin?'check':'tendencia',fin?'ic-ver':'ic-amb')+'<div><b>Proyección '+(fin?'FINAL':'PRELIMINAR')+' calculada</b><small>Contabilidad al '+L.fecha(m.cutoff_date)+' · corrida #'+m.id+' · '+L.fecha(m.finalizado_at)+'</small></div>'
    +'<a class="btn" href="proyeccion.html?'+(DEMO?'demo=1&':'')+'caso='+S.caso.id+'">'+I('flecha-der')+'Ver la proyección</a></div>';
  if(!fin&&bl.length){
    var vis=bl.slice(0,8);
    h+='<p class="t2">Para que sea FINAL falta:</p><ul class="pry-falta">'+vis.map(function(b){return '<li>'+esc(L.textoBloqueo(b))+'</li>';}).join('')+'</ul>'+(bl.length>vis.length?'<p class="nota">y '+(bl.length-vis.length)+' más (ver en la proyección, modo técnico).</p>':'');
  }
  return h+'</div>';
}

/* ── Acciones ── */
function hecho(tipo,texto){S.ocupado=null;S.aviso={tipo:tipo,texto:texto};return recargar();}
function fallo(e){S.ocupado=null;S.aviso={tipo:'rojo',texto:esc(L.mensajeError(e&&e.message||e))};render();}
function rpc(fn,args){return API.rpc(fn,args);}

function pedirMotivo(titulo,cuerpo,ok,def,cb){
  $('mrModalCuerpo').innerHTML='<h3 id="mrModalTit">'+esc(titulo)+'</h3>'+cuerpo+'<label class="mrp-campo"><span>Motivo (queda en la bitácora)</span><textarea id="mrMotivo" rows="2">'+esc(def||'')+'</textarea></label>'
    +'<p class="mrp-merr" id="mrMerr" role="alert"></p><div class="mrp-acciones fin"><button type="button" class="btn sec" data-m="no">Cancelar</button><button type="button" class="btn" data-m="si">'+esc(ok)+'</button></div>';
  pedirMotivo.cb=cb;$('mrModal').hidden=false;$('mrMvelo').classList.add('on');setTimeout(function(){var t=$('mrMotivo');if(t)t.focus();},30);
}
function cerrarModal(){$('mrModal').hidden=true;$('mrMvelo').classList.remove('on');pedirMotivo.cb=null;}
function confirmarModal(){var m=($('mrMotivo').value||'').trim();if(m.length<5){$('mrMerr').textContent='Escribe un motivo (mínimo 5 caracteres).';return;}var cb=pedirMotivo.cb;cerrarModal();if(cb)cb(m);}

function accHabilitar(){
  pedirMotivo('Habilitar '+(S.cliente.razon_social||'el cliente')+' en MiRenta','<p>Queda como cliente <b>recurrente</b> de MiRenta y operativo de inmediato.</p>','Habilitar','Cliente con contabilidad '+L.AC_DEFECTO+': proyección de renta AT '+(L.AC_DEFECTO+1),function(m){
    S.ocupado='habilitar';render();
    rpc('renta_cliente_habilitar',{p_cliente_id:S.cliente.id,p_modalidad:'RECURRENTE',p_motivo:m}).then(function(){return hecho('verde','Cliente habilitado en MiRenta.');}).catch(fallo);});
}
function accActivar(){
  pedirMotivo('Activar '+(S.cliente.razon_social||'el cliente')+' en MiRenta','','Activar','Aprobado para proyección de renta',function(m){
    S.ocupado='activar';render();
    var p=S.rc.estado==='PENDING_MASTER_APPROVAL'?rpc('renta_cliente_resolver',{p_cliente_id:S.cliente.id,p_accion:'APROBAR',p_motivo:m}):Promise.resolve();
    p.then(function(){return rpc('renta_cliente_resolver',{p_cliente_id:S.cliente.id,p_accion:'ACTIVAR',p_motivo:m});}).then(function(){return hecho('verde','Cliente activado en MiRenta.');}).catch(fallo);});
}
function accCrearCaso(){
  S.ocupado='crear';render();
  rpc('renta_caso_crear',{p_cliente_id:S.cliente.id,p_anio_comercial:L.AC_DEFECTO,p_regimen:'14D3'}).then(function(){S.abierto=2;return hecho('verde','Caso '+L.AC_DEFECTO+' creado. Ahora sube el F22 del año anterior.');}).catch(fallo);
}
// Sube un archivo al bucket privado y lo registra como fuente del caso (reintenta si Storage aún no informa el tamaño).
function subirFuente(archivo,tipo,origen,reemplazaA,metadatos){
  var clave=crypto.randomUUID(), ct=archivo.type||(tipo==='F22_ANTERIOR'?'application/pdf':'application/vnd.ms-excel');
  return archivo.arrayBuffer().then(sha256).then(function(sha){
    return API.subir(L.rutaFuente(S.caso,clave,sha),archivo,ct).then(function(){
      var intento=0;
      function reg(){return rpc('renta_fuente_registrar',{p_caso_id:S.caso.id,p_clave:clave,p_tipo_fuente:tipo,p_origen:origen,p_nombre_original:archivo.name,p_sha256:sha,p_reemplaza_a:reemplazaA||null,p_metadatos:metadatos||{}})
        .catch(function(e){if(/reintentar/.test(e.message)&&++intento<5)return espera(1500).then(reg);throw e;});}
      return reg();
    });
  });
}
function validarArchivo(inp,pdf){
  var f=inp&&inp.files&&inp.files[0];
  if(!f)throw new Error('Elige el archivo primero.');
  if(f.size<=0||f.size>50*1024*1024)throw new Error('El archivo está vacío o supera 50 MB.');
  if(pdf&&f.type!=='application/pdf'&&!/\.pdf$/i.test(f.name))throw new Error('El F22 debe ser el PDF del Compacto descargado del SII.');
  if(!pdf&&!/\.(xls|xlsx|html?|htm)$/i.test(f.name))throw new Error('Usa el archivo exportado de Masconta (.xls o .html).');
  return f;
}
function leerF22(fuenteId){
  return API.invocar('mirenta-f22-leer',{caso_id:S.caso.id,fuente_id:fuenteId}).then(function(r){
    if(!r.ok)throw new Error(/SIN_ACCESO/.test(r.mensaje)?'No tienes acceso a este caso.':/FUENTE_INVALIDA/.test(r.mensaje)?'El documento no es un F22 válido para este caso.':'La lectura no se pudo completar ('+r.mensaje+').');
  });
}
function accSubirF22(){
  var f;try{f=validarArchivo($('pryF22'),true);}catch(e){S.aviso={tipo:'ambar',texto:esc(e.message)};render();return;}
  S.ocupado='f22';S.aviso=null;render();
  var prev=AL.reemplazoF22(S.d.fuentes);
  subirFuente(f,'F22_ANTERIOR','SII',prev).then(function(r){return leerF22(r.id);})
    .then(function(){return hecho('verde','F22 leído. Revisa los saldos propuestos (RAI, SAC y CPTS).');}).catch(function(e){S.ocupado=null;S.aviso={tipo:'rojo',texto:esc(L.mensajeError(e.message))};return recargar();});
}
function accLeerF22(id){S.ocupado='leer';render();leerF22(+id).then(function(){return hecho('verde','F22 leído.');}).catch(function(e){S.ocupado=null;S.aviso={tipo:'rojo',texto:esc(e.message)};return recargar();});}

// Importa una fuente con la Edge mirenta-importar; si la respuesta es incierta, consulta la corrida hasta 60 s.
function importar(fuenteId){
  return API.invocar('mirenta-importar',{fuente_id:fuenteId}).then(function(r){
    var d=r.data||{};
    if(r.ok&&d.estado==='PROCESSED')return d;
    if(d.estado==='DESCONOCIDO'||(r.ok&&!d.estado)){
      var n=0;
      return (function mirar(){return espera(5000).then(function(){return API.get('renta_corridas?select=id,estado,error_mensaje&fuente_id=eq.'+fuenteId+'&order=id.desc&limit=1');}).then(function(c){
        c=c&&c[0];if(c&&c.estado!=='PROCESSING'){if(c.estado==='PROCESSED')return c;throw new Error('No se pudo leer el archivo: '+(c.error_mensaje||c.estado));}
        if(++n<12)return mirar();throw new Error('La importación sigue en curso. Recarga en unos minutos.');});})();
    }
    throw new Error(d.mensaje||d.error||r.mensaje||'No se pudo importar el archivo.');
  });
}
// Cálculos automáticos que siguen a una importación (no son decisiones: conciliar y mapear son deterministas y quedan en la bitácora).
function cadena(){
  return rpc('renta_e1_entrada',{p_caso_id:S.caso.id}).then(function(ent){
    var ef=ent.efectivo||{}, bl=ent.bloqueos_final||[], hechos=[], p=Promise.resolve();
    var dia=ef.diario&&ef.diario.corrida_id, bal=ef.balance_ac&&ef.balance_ac.corrida_id, bal1=ef.balance_ac1&&ef.balance_ac1.corrida_id;
    if(dia&&bal&&bl.indexOf('CONCILIACION_DIARIO_BALANCE_PENDIENTE')>=0)p=p.then(function(){return rpc('renta_conciliar_diario_balance',{p_corrida_diario:dia,p_corrida_balance:bal}).then(function(k){hechos.push('Diario y Balance '+(k.resultado==='CUADRA'?'cuadran':'con '+k.diferencias+' diferencia(s)'));});});
    if(dia&&(bl.indexOf('SIN_SNAPSHOT_MAPEO')>=0||bl.indexOf('SNAPSHOT_MAPEO_DESACTUALIZADO')>=0))p=p.then(function(){return rpc('renta_mapeo_calcular',{p_caso_id:S.caso.id}).then(function(){hechos.push('mapeo de cuentas calculado');});});
    if(dia&&bal1&&bl.indexOf('CONCILIACION_AC1_PENDIENTE')>=0)p=p.then(function(){return rpc('renta_conciliar_apertura',{p_corrida_diario:dia,p_corrida_balance_anterior:bal1}).then(function(){hechos.push('apertura conciliada con el año anterior');});});
    return p.then(function(){return hechos;});
  });
}
function accSubirArchivo(clave){
  var a=S.P[2].archivos.filter(function(x){return x.def.clave===clave;})[0], f;
  try{f=validarArchivo($('pryArch-'+clave),false);}catch(e){S.aviso={tipo:'ambar',texto:esc(e.message)};render();return;}
  S.ocupado='arch-'+clave;S.aviso=null;render();
  var meta=a.def.tipo==='BALANCE'?{periodo:String(a.periodo)}:{};
  subirFuente(f,a.def.tipo,'MASCONTABLE',a.fuente?a.fuente.id:null,meta).then(function(r){return importar(r.id);}).then(cadena)
    .then(function(hs){return hecho('verde',esc(a.def.titulo+(a.periodo?' '+a.periodo:''))+' importado'+(hs.length?' · '+esc(hs.join(' · ')):'')+'.');})
    .catch(function(e){S.ocupado=null;S.aviso={tipo:'rojo',texto:esc(L.mensajeError(e.message))};return recargar();});
}
function accImportar(id){S.ocupado='imp-'+id;render();importar(+id).then(cadena).then(function(hs){return hecho('verde','Archivo importado'+(hs.length?' · '+esc(hs.join(' · ')):'')+'.');}).catch(function(e){S.ocupado=null;S.aviso={tipo:'rojo',texto:esc(L.mensajeError(e.message))};return recargar();});}
function accAperturaContable(){
  var apc=S.P[2].aperturaContable;
  pedirMotivo('Confirmar el asiento de apertura N° '+(apc.asiento_numero||''),'<p>Confirmas que ese asiento es la apertura del año y aceptas sus saldos como saldos iniciales de cada cuenta.</p>','Confirmar','Asiento de apertura revisado: saldos iniciales completos',function(m){
    S.ocupado='apc';render();
    (apc.clase_confirmada==='OPENING_BALANCE'?Promise.resolve():rpc('renta_asiento_confirmar_clase',{p_asiento_id:apc.asiento_id,p_clase:'OPENING_BALANCE',p_motivo:m}))
      .then(function(){return rpc('renta_e1_entrada',{p_caso_id:S.caso.id});})
      .then(function(ent){var h=ent.efectivo.apertura_contable.huella_saldos;if(!/^[0-9a-f]{64}$/.test(h||''))throw new Error('El sistema no entregó la huella de los saldos: avisa al Master.');
        return rpc('renta_apertura_contable_aceptar',{p_caso_id:S.caso.id,p_huella_esperada:h,p_motivo:m});})
      .then(cadena).then(function(){return hecho('verde','Apertura contable confirmada.');}).catch(fallo);});
}
function accMapeoCalcular(){S.ocupado='mapeo';render();rpc('renta_mapeo_calcular',{p_caso_id:S.caso.id}).then(function(){return hecho('verde','Mapeo calculado.');}).catch(fallo);}
function accConfirmarCuenta(cta,prop){
  var sel=document.querySelector('[data-map-cat="'+CSS.escape(cta)+'"]'), mot=document.querySelector('[data-map-mot="'+CSS.escape(cta)+'"]');
  var cat=(sel&&sel.value)||prop, m=(mot&&mot.value||'').trim();
  if(!cat){S.aviso={tipo:'ambar',texto:'Elige la clasificación de la cuenta '+esc(cta)+'.'};render();return;}
  if((cat!==prop||!prop)&&m.length<5){S.aviso={tipo:'ambar',texto:'Para clasificar o cambiar la cuenta '+esc(cta)+' escribe un motivo (mínimo 5 caracteres).'};render();return;}
  S.ocupado='cta-'+cta;S.aviso=null;render();
  rpc('renta_mapeo_confirmar',{p_caso_id:S.caso.id,p_snapshot_id:S.d.snapshot.id,p_cuenta_codigo:cta,p_categoria:cat,p_motivo:m||null}).then(function(){return hecho('verde','Cuenta '+esc(cta)+' confirmada.');}).catch(fallo);
}
function accConfirmarTodas(){
  var inf=S.P[3].porConfirmar.filter(function(r){return r.estado==='INFERRED';});
  if(!window.confirm('Se confirmará la clasificación propuesta de '+inf.length+' cuentas. ¿Continuar?'))return;
  S.ocupado='todas';render();
  var snap=S.d.snapshot.id, i=0;
  // Cada confirmación recalcula el mapeo y entrega el snapshot nuevo: la siguiente se hace contra ese.
  (function una(){if(i>=inf.length)return Promise.resolve();var r=inf[i++];
    return rpc('renta_mapeo_confirmar',{p_caso_id:S.caso.id,p_snapshot_id:snap,p_cuenta_codigo:r.cuenta_codigo,p_categoria:r.categoria,p_motivo:null}).then(function(x){snap=(x&&x.snapshot_id)||snap;return una();});})()
    .then(function(){return hecho('verde',inf.length+' cuentas confirmadas.');}).catch(function(e){S.ocupado=null;S.aviso={tipo:'rojo',texto:'Se confirmaron '+(i-1)+' de '+inf.length+'. '+esc(L.mensajeError(e.message))};return recargar();});
}
function accProyectar(){
  var c=$('pryCorte')&&$('pryCorte').value, sup=$('prySup')&&$('prySup').checked;
  if(!c){S.aviso={tipo:'ambar',texto:'Elige la fecha de corte.'};render();return;}
  S.corte=c;S.ocupado='proy';S.aviso=null;render();
  var p=Promise.resolve();
  if(!S.P[4].supuesto&&sup)p=rpc('renta_supuesto_forecast_crear',{p_caso_id:S.caso.id,p_metodo:'MANUAL',p_parametros:{metodo:'LINEAL_PROMEDIO_V1'},p_motivo:'Supuesto estándar del asistente Proyectar: meses restantes con el promedio del año'})
    .then(function(r){return rpc('renta_supuesto_forecast_activar',{p_supuesto_id:r.id,p_motivo:'Supuesto estándar del asistente Proyectar'});});
  p.then(function(){return rpc('renta_e1_proyectar',{p_caso_id:S.caso.id,p_corte:c,p_supuesto_id:null});}).then(function(r){
    if(r&&r.estado==='FALLIDA')throw new Error((r.mensaje||r.codigo||'La corrida falló'));
    return hecho('verde',r&&r.reutilizada?'Sin cambios: la proyección vigente ya corresponde a estos datos.':'Proyección calculada (corrida #'+(r&&r.corrida_id)+').');
  }).catch(fallo);
}

/* ── Eventos ── */
document.addEventListener('click',function(e){
  var m=e.target.closest('#mrModal [data-m]');if(m){if(m.getAttribute('data-m')==='si')confirmarModal();else cerrarModal();return;}
  var ps=e.target.closest('[data-paso]');
  if(ps&&!ps.disabled){var n=+ps.getAttribute('data-paso');S.abierto=(S.abierto===n&&ps.classList.contains('pry-paso-h'))?null:n;S.aviso=null;render();var el=$('paso-'+n);if(el&&!ps.classList.contains('pry-paso-h'))el.scrollIntoView({behavior:'smooth',block:'start'});return;}
  var a=e.target.closest('[data-act]');if(!a||a.disabled)return;
  var act=a.getAttribute('data-act');
  if(act==='cliente')elegirCliente(a.getAttribute('data-id'));
  else if(act==='cambiar'){S.cliente=null;S.caso=null;S.d=null;S.P=null;S.aviso=null;try{history.pushState(null,'',location.pathname+(DEMO?'?demo=1':''));}catch(x){}render();}
  else if(act==='recargar'){S.error=null;S.cliente?recargar():iniciar();}
  else if(S.ocupado)return;
  else if(act==='habilitar')accHabilitar();
  else if(act==='activar')accActivar();
  else if(act==='crear-caso')accCrearCaso();
  else if(act==='subir-f22')accSubirF22();
  else if(act==='leer-f22')accLeerF22(a.getAttribute('data-id'));
  else if(act==='subir-arch')accSubirArchivo(a.getAttribute('data-clave'));
  else if(act==='importar')accImportar(a.getAttribute('data-id'));
  else if(act==='apertura-contable')accAperturaContable();
  else if(act==='mapeo-calcular')accMapeoCalcular();
  else if(act==='confirmar-cuenta')accConfirmarCuenta(a.getAttribute('data-cta'),a.getAttribute('data-prop'));
  else if(act==='confirmar-todas')accConfirmarTodas();
  else if(act==='ver-todas'){S.verTodas=true;render();}
  else if(act==='proyectar')accProyectar();
});
document.addEventListener('input',function(e){if(e.target.id==='pryBuscar'){S.q=e.target.value;var pos=e.target.selectionStart;render();var b=$('pryBuscar');if(b){b.focus();try{b.setSelectionRange(pos,pos);}catch(x){}}}});
document.addEventListener('change',function(e){if(e.target.id==='pryCorte')S.corte=e.target.value;});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('mrModal').hidden)cerrarModal();});
window.addEventListener('popstate',function(){URLP=new URLSearchParams(location.search);var c=+URLP.get('cliente');if(c)elegirCliente(c,true);else{S.cliente=null;S.d=null;S.P=null;render();}});
window.addEventListener('beforeunload',function(e){if(S.ocupado){e.preventDefault();e.returnValue='';}});
document.addEventListener('DOMContentLoaded',function(){$('mrMvelo').addEventListener('click',cerrarModal);iniciar();});
})();
