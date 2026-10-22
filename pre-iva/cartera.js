/* ============================================================
   pre-iva/cartera.js — Pre-IVA · Pantalla 1: Cartera de Pre-IVA del mes
   Una fila por cliente que el usuario puede ver (la RLS de `clientes` decide: Master/pagos/comercial ven todos,
   contable y RRHH solo los suyos). Solo LECTURA:
     clientes (id, rut, razon_social, plan, estado, analista_contable, analista_contable_usuario_id)
     planes (codigo, nombre, incluye_preiva)            → ¿el plan del cliente incluye Pre-IVA?
     preiva_historial (una fila por cliente y período)   → borrador (fecha_envio null) o enviado
     periodos (periodo, estado)                          → meses del selector
     rcv_consultas (cliente_id, tipo, estado, origen, finalizado_at) → última consulta al SII del mes (solo informativo)
   Preparada para el Pre-IVA AUTOMÁTICO (conector SII · RCV): columnas futuras de preiva_historial (fuente, calculado_at,
   revisado_at, facturas aceptadas / en plazo / reclamadas) se muestran si existen; hoy no existen y todo se ve "Manual".
   Nada se escribe desde esta pantalla. "No disponible" nunca se muestra como $0.
   El botón "Abrir Pre-IVA" lleva a la Pantalla 2 (index.html?cliente=<id>&periodo=AAAA-MM).
   Modo demostración: ver cartera-demo.js (solo ?demo=1 en localhost).
   ============================================================ */
(function(){
'use strict';

var HOST=location.hostname, LOCAL=(HOST==='localhost'||HOST==='127.0.0.1'||HOST==='[::1]');
var DEMO=window.PV_DEMO===true&&LOCAL&&!!window.PV_DEMO_API;   // candado 3: además del HTML y del archivo demo

/* ── Íconos (trazo estilo Lucide). Los del menú común vienen de gIcon (gestoor-menu.js) ── */
var PX={
  lupa:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'flecha-der':'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  recargar:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'
};
function ic(n){
  if(PX[n])return '<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+PX[n]+'</svg>';
  return window.gIcon?window.gIcon(n):'';
}
function I(n,c){return '<i class="ic '+(c||'')+'">'+ic(n)+'</i>';}

/* ── Formato (estilo contador: separador de miles chileno, sin decimales) ── */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function miles(n){return Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
function clpT(n){if(n==null||!isFinite(n))return 'No disponible';return (n<0?'−':'')+'$'+miles(n);}
function entero(n){return Number(n).toLocaleString('es-CL');}
function z(n){return (n<10?'0':'')+n;}
function fFechaHora(iso){if(!iso)return '';var d=new Date(iso);if(isNaN(d))return '';return z(d.getDate())+'-'+z(d.getMonth()+1)+'-'+d.getFullYear()+' · '+z(d.getHours())+':'+z(d.getMinutes());}
function fCorta(iso){var d=new Date(iso);if(isNaN(d))return '';return z(d.getDate())+'-'+z(d.getMonth()+1)+' '+z(d.getHours())+':'+z(d.getMinutes());}
function fDia(d){return z(d.getDate())+'-'+z(d.getMonth()+1)+'-'+d.getFullYear();}
var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
var DIAS=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
function $(id){return document.getElementById(id);}
function num(v){if(v==null||v==='')return null;var n=Number(v);return isFinite(n)?n:null;}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');}

/* ── Períodos (AAAA-MM, igual que preiva_historial y reportes_mensuales) ── */
var RE_PER=/^\d{4}-(0[1-9]|1[0-2])$/;
function perHoy(){var d=new Date();return d.getFullYear()+'-'+z(d.getMonth()+1);}
function perMover(p,k){var y=+p.slice(0,4), m=+p.slice(5,7)-1+k;y+=Math.floor(m/12);m=((m%12)+12)%12;return y+'-'+z(m+1);}
function perTxt(p){return MESES[+p.slice(5,7)-1].replace(/^./,function(c){return c.toUpperCase();})+' '+p.slice(0,4);}
/* Vencimiento del F29 del período P: día 20 del mes siguiente; si cae sábado o domingo se corre al lunes.
   (Los feriados no están en Gestoor: si el 20 es feriado, el plazo real es el día hábil siguiente.) */
function vencF29(p){
  var s=perMover(p,1), d=new Date(+s.slice(0,4),+s.slice(5,7)-1,20);
  while(d.getDay()===0||d.getDay()===6)d.setDate(d.getDate()+1);
  return d;
}
function diasA(d){var h=new Date();h.setHours(0,0,0,0);return Math.round((d-h)/86400000);}

/* ── Acceso a datos: real (supabase.js, JWT del usuario; falla cerrado sin sesión) o demostración local ── */
function errLeer(status,texto){var j=null;try{j=JSON.parse(texto);}catch(e){}var e=new Error((j&&j.message)||texto||('HTTP '+status));e.status=status;e.code=j&&j.code;return e;}
function leer(r){if(!r.ok)return r.text().then(function(t){throw errLeer(r.status,t);});return r.status===204?null:r.json();}
var API=DEMO?window.PV_DEMO_API:{
  // sbFetch pone el JWT del usuario; a diferencia de sbGet, un error de lectura se muestra (no se convierte en lista vacía).
  get:function(path){return sbFetch(path).then(leer);}
};
/* Lectura completa con paginación (PostgREST corta en 1000 filas por defecto) */
function getTodo(path){
  var out=[], P=1000;
  function pag(off){return API.get(path+(path.indexOf('?')<0?'?':'&')+'limit='+P+'&offset='+off).then(function(r){r=r||[];out=out.concat(r);return r.length<P||off>50000?out:pag(off+P);});}
  return pag(0);
}
function usuario(){if(DEMO)return API.usuario||{};try{return (typeof getUsuario==='function'?getUsuario():{})||{};}catch(e){return {};}}
function esMaster(){var u=usuario();return u.esMaster===true||u.rol==='master'||u.rol==='admin';}
function miUsId(){if(DEMO)return API.usId!=null?API.usId:null;try{return typeof gestoorMiUsuarioSistemaId==='function'?gestoorMiUsuarioSistemaId():null;}catch(e){return null;}}
function textoError(e){
  var m=(e&&e.message)||String(e||'');
  if(m==='GESTOOR_NO_SESSION'||m==='GESTOOR_SDK_TIMEOUT')return 'Tu sesión no está activa. Vuelve a ingresar a Gestoor.';
  if(e&&(e.status===401))return 'Tu sesión expiró. Vuelve a ingresar a Gestoor.';
  if(e&&(e.status===403||e.code==='42501'))return 'No tienes permiso para leer estos datos.';
  return 'Gestoor respondió: '+m;
}

/* Respaldo si assets/equipo.js no cargó (por ejemplo, un HTML antiguo en caché): la cartera sigue funcionando sin fotos ni filtro por responsable */
if(!window.GEquipo)window.GEquipo={TODOS:'todos',SIN:'sin',leerUrl:function(){return 'todos';},escribirUrl:function(){},valida:function(){return 'todos';},pasa:function(){return true;},
  opciones:function(){return [];},filtroHtml:function(){return '';},nombreDe:function(){return null;},
  celda:function(n){n=String(n||'').trim();return n?n.replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}):'<span class="nd">Sin asignar</span>';}};
/* ── Estado ── */
var URLP=new URLSearchParams(location.search);
var perPedido=URLP.get('periodo');
var S={
  per:RE_PER.test(perPedido||'')?perPedido:perHoy(),
  periodos:[], planes:null, errPlanes:null, clientes:null, hist:{}, errHist:null,
  cargando:true, cargandoMes:false, error:null, tok:0, tokMes:0, rcv:{}, errRcv:null,
  q:'', filtro:'todos', orden:'prioridad', mis:false,
  resp:window.GEquipo.leerUrl()   // filtro por responsable (?resp=, componente común assets/equipo.js)
};
/* Semáforo: color + texto (nunca solo color) + orden de prioridad */
var EST={
  PENDIENTE:['rojo','Pendiente',0],
  ACUSE:['ambar','Pendiente de acuse',1],                         // automático: hay facturas recibidas en plazo de reclamo
  CALCULADO:['lila','Calculado por el sistema · por revisar',2],  // automático: el sistema lo calculó desde el RCV y nadie lo revisó
  BORRADOR:['ambar','Borrador guardado',3],
  SIN_CONFIRMAR:['gris','Sin confirmar',4],
  ENVIADO:['verde','Enviado',5],
  NO_INCLUIDO:['gris','No incluido en el plan',6]
};
var FILTROS=[['todos','Todos'],['pendientes','Pendientes'],['revisar','Por revisar'],['borradores','Borradores'],['enviados','Enviados'],['remanente','Con remanente'],['noinc','No incluidos']];
var NOTA_SII='Disponible cuando se active la conexión con el SII';
var ORDENES=[['prioridad','Prioridad (pendientes primero)'],['f29','Mayor F29 estimado'],['iva','Mayor IVA · así vamos'],['ivaEst','Mayor IVA estimado a fin de mes'],['envio','Envío más reciente'],['nombre','Cliente (A–Z)'],['resp','Responsable']];

/* ── Carga ── */
function toast(t){var el=$('pvToast');el.innerHTML=t;el.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(function(){el.classList.remove('on');},3800);}
function app(html){$('pvApp').innerHTML=html;}
function iniciar(){
  if(DEMO){$('pvDemo').hidden=false;document.documentElement.classList.remove('auth-pending');}
  S.cargando=true;S.error=null;render();
  var tok=++S.tok;
  Promise.all([
    getTodo('clientes?select=id,rut,razon_social,plan,estado,analista_contable,analista_contable_usuario_id,iva_condicion&estado=eq.activo&order=razon_social.asc,id.asc'),
    API.get('planes?select=codigo,nombre,incluye_preiva').then(function(r){return r||[];},function(e){S.errPlanes=e;return null;}),
    API.get('periodos?select=periodo,estado&order=periodo.desc&limit=36').then(function(r){return r||[];},function(){return [];})
  ]).then(function(r){
    if(tok!==S.tok)return;
    S.clientes=r[0]||[];
    if(r[1]){S.planes={};r[1].forEach(function(p){if(p&&p.codigo)S.planes[String(p.codigo).toLowerCase()]=p;});}
    S.periodos=(r[2]||[]).map(function(p){return p&&p.periodo;}).filter(function(p){return RE_PER.test(p||'');});
    return cargarMes();
  }).catch(function(e){if(tok!==S.tok)return;S.cargando=false;S.error=e;render();});
}
function cargarMes(){
  // Token propio del mes: cambiar de mes nunca invalida la carga de clientes (revisión independiente)
  var tok=++S.tokMes;
  var per=S.per;S.cargandoMes=true;S.errHist=null;render();
  cargarRcv(per,tok);
  return getTodo('preiva_historial?periodo=eq.'+encodeURIComponent(per)+'&select=cliente_rut,periodo,debito_iva,credito_iva,remanente,f29,ppm,tasa_ppm,enviado_por,fecha_envio&order=id.asc')
    .then(function(rows){
      if(tok!==S.tokMes||per!==S.per)return;
      var h={};(rows||[]).forEach(function(x){if(x&&x.cliente_rut)h[x.cliente_rut]=x;});
      S.hist=h;
    },function(e){
      if(tok!==S.tokMes||per!==S.per)return;
      S.hist={};S.errHist=e;   // no se inventa "Pendiente": cada fila queda "Sin confirmar"
    }).then(function(){
      if(tok!==S.tokMes||per!==S.per)return;
      S.cargando=false;S.cargandoMes=false;animarBarras();render();
    });
}

/* Última consulta al SII del mes (rcv_consultas, solo lectura, RLS por cliente visible). Si falla, no bloquea la cartera. */
function cargarRcv(per,tok){
  S.rcv={};S.errRcv=null;
  getTodo('rcv_consultas?periodo=eq.'+encodeURIComponent(per)+'&select=cliente_id,tipo,estado,origen,finalizado_at&finalizado_at=not.is.null&order=finalizado_at.desc,id.desc')
    .then(function(rows){
      if(tok!==S.tokMes||per!==S.per)return;
      var m={};(rows||[]).forEach(function(x){var c=m[x.cliente_id]=m[x.cliente_id]||{};if(!c.ultima)c.ultima=x;if(x.estado==='completado'&&!c[x.tipo])c[x.tipo]=x;});
      S.rcv=m;if(!S.cargando&&!S.cargandoMes)render();
    },function(e){if(tok!==S.tokMes||per!==S.per)return;S.errRcv=e;});
}
/* ── Filas ── */
function filas(){
  var venc=vencF29(S.per), dias=diasA(venc);
  return (S.clientes||[]).map(function(c){
    var plan=c.plan?String(c.plan).toLowerCase():'';
    var pl=S.planes&&plan?S.planes[plan]:null;
    var incluye=pl?(pl.incluye_preiva===true?true:pl.incluye_preiva===false?false:null):null;
    var h=S.errHist?null:(S.hist[c.rut]||null);
    var f={id:c.id,rut:c.rut||'',nombre:c.razon_social||('Cliente #'+c.id),plan:plan,planNombre:pl?pl.nombre:(c.plan||''),incluye:incluye,
      resp:c.analista_contable||'',resp_id:c.analista_contable_usuario_id,h:h,motivos:[],chips:[],
      exenta:c.iva_condicion==='exento'};   // empresa exenta de IVA: el Pre-IVA es solo el PPM (si la ficha no lo indica, flujo normal)
    // Pre-IVA automático (futuro): h.fuente='SII' + facturas en plazo → "Pendiente de acuse"; sin revisar → "Calculado por el sistema"
    f.auto=!!(h&&h.fuente==='SII');
    f.fact=h&&h.facturas_aceptadas!=null?{ok:num(h.facturas_aceptadas),plazo:num(h.facturas_en_plazo),rec:num(h.facturas_reclamadas),vence:h.plazo_reclamo_vence||null}:null;
    f.estado=S.errHist?'SIN_CONFIRMAR':h?(h.fecha_envio?'ENVIADO':f.auto&&f.fact&&f.fact.plazo>0?'ACUSE':f.auto&&!h.revisado_at?'CALCULADO':'BORRADOR'):(incluye===false?'NO_INCLUIDO':'PENDIENTE');
    f.rcv=S.rcv[c.id]||null;
    // Montos guardados por la Pantalla 2 (solo si hay fila del mes)
    f.iva=null;f.ivaEst=null;f.ppm=null;f.f29=null;f.sinLibros=false;f.sinTasa=false;
    if(h){
      var deb=num(h.debito_iva), cred=num(h.credito_iva), rem=num(h.remanente);
      f.sinLibros=!f.exenta&&!(deb>0)&&!(cred>0);   // débito y crédito en 0: no se cargaron libros (no se asume IVA $0)
      f.iva=(!f.exenta&&!f.sinLibros&&deb!=null&&cred!=null&&rem!=null)?deb-cred-rem:null;
      var ppm=num(h.ppm), tasa=num(h.tasa_ppm);
      f.sinTasa=ppm===0&&!(tasa>0);
      f.ppm=f.sinTasa?null:ppm;
      var f29=num(h.f29);
      f.f29=(f.sinLibros&&!(f29>0))?null:f29;
      // Referencia estimada a fin de mes (solo el mes en curso): F29 guardado − PPM guardado (lo proyectado por el Pre-IVA)
      if(S.per===perHoy()&&!f.exenta&&f.f29!=null&&ppm!=null){var ivaE=f.f29-ppm;f.ivaEst=ivaE>0?ivaE:0;}   // F29 estimado ya incluye el PPM: aquí solo se separa para mostrar
    }
    // Motivos (orientación) y vencimiento
    if(f.estado==='PENDIENTE'||f.estado==='BORRADOR'||f.estado==='CALCULADO'||f.estado==='ACUSE'){
      if(f.estado==='BORRADOR')f.motivos.push('falta enviarlo al cliente');
      if(f.estado==='CALCULADO')f.motivos.push('revisar y enviar');
      if(f.estado==='ACUSE')f.motivos.push('esperar el acuse de las facturas recibidas en plazo');
      if(dias<0)f.motivos.push('el F29 de este mes ya venció');
      else if(dias<=3)f.motivos.push(dias===0?'el F29 vence hoy':'el F29 vence en '+dias+' día'+(dias===1?'':'s'));
    }
    if(f.exenta)f.chips.push(['lila','Exenta · solo PPM']);
    if(h&&incluye===false)f.chips.push(['gris','Fuera del plan ('+(f.planNombre||f.plan)+')']);
    if(incluye===null)f.chips.push(['gris',S.errPlanes?'Plan sin confirmar (no se pudo leer la tabla de planes)':(f.plan?'Plan "'+f.plan+'" sin regla de Pre-IVA':'Sin plan en la ficha')]);
    f.prio=EST[f.estado][2];
    return f;
  });
}
function pasaFiltro(f,filtro){
  switch(filtro){
    case 'pendientes':return f.estado==='PENDIENTE';
    case 'borradores':return f.estado==='BORRADOR';
    case 'revisar':return f.estado==='CALCULADO'||f.estado==='ACUSE';
    case 'enviados':return f.estado==='ENVIADO';
    case 'remanente':return f.iva!=null&&f.iva<0;
    case 'noinc':return f.estado==='NO_INCLUIDO';
  }
  return true;
}
function pasaMis(f){var id=miUsId();return !S.mis||id==null||Number(f.resp_id)===Number(id);}
function pasaResp(f){return window.GEquipo.pasa(f,S.resp);}
function visibles(todas){
  var q=norm(S.q.trim());
  var r=todas.filter(function(f){
    if(!pasaMis(f))return false;
    if(!pasaResp(f))return false;
    if(q&&norm(f.nombre+' '+f.rut+' '+f.resp).indexOf(q)<0)return false;
    return pasaFiltro(f,S.filtro);
  });
  var nom=function(a,b){return a.nombre.localeCompare(b.nombre,'es');};
  var n=function(x){return x==null?-Infinity:x;};
  var cmp={
    prioridad:function(a,b){return a.prio-b.prio||n(b.f29)-n(a.f29)||nom(a,b);},
    f29:function(a,b){return n(b.f29)-n(a.f29)||nom(a,b);},
    iva:function(a,b){return n(b.iva)-n(a.iva)||nom(a,b);},
    ivaEst:function(a,b){return n(b.ivaEst)-n(a.ivaEst)||nom(a,b);},
    envio:function(a,b){var fa=a.h&&a.h.fecha_envio||'', fb=b.h&&b.h.fecha_envio||'';return fa<fb?1:fa>fb?-1:nom(a,b);},
    nombre:nom,
    resp:function(a,b){return (a.resp||'~').localeCompare(b.resp||'~','es')||nom(a,b);}
  }[S.orden]||nom;
  return r.sort(cmp);
}
function totales(fs){
  var t={n:fs.length,env:0,bor:0,pend:0,noinc:0,sinc:0,rev:0,iva:0,rem:0,f29:0,nIva:0,nF29:0,conFila:0};
  fs.forEach(function(f){
    if(f.estado==='ENVIADO')t.env++;else if(f.estado==='BORRADOR')t.bor++;else if(f.estado==='CALCULADO'||f.estado==='ACUSE')t.rev++;else if(f.estado==='PENDIENTE')t.pend++;else if(f.estado==='NO_INCLUIDO')t.noinc++;else t.sinc++;
    if(f.h){t.conFila++;
      if(f.iva!=null){t.nIva++;if(f.iva>0)t.iva+=f.iva;else if(f.iva<0)t.rem+=-f.iva;}
      if(f.f29!=null){t.nF29++;t.f29+=f.f29;}
    }
  });
  return t;
}

/* ── Pantalla ── */
function animarBarras(){document.body.classList.add('pvc-animar');clearTimeout(animarBarras.t);animarBarras.t=setTimeout(function(){document.body.classList.remove('pvc-animar');},700);}
function urlEstado(){
  try{var p=new URLSearchParams(location.search);p.set('periodo',S.per);window.GEquipo.escribirUrl(p,S.resp);p.delete('q');/* la búsqueda no va a la URL */history.replaceState(null,'',location.pathname+'?'+p.toString());}catch(e){}
}
function opcionesMes(){
  var hoy=perHoy(), set={}, l=[];
  for(var i=0;i<13;i++)set[perMover(hoy,-i)]=1;
  S.periodos.forEach(function(p){set[p]=1;});set[S.per]=1;
  Object.keys(set).forEach(function(p){l.push(p);});
  l.sort().reverse();
  var abiertos={};S.periodos.forEach(function(p){abiertos[p]=1;});
  return l.map(function(p){return '<option value="'+esc(p)+'"'+(p===S.per?' selected':'')+'>'+esc(perTxt(p))+(p===hoy?' · mes en curso':abiertos[p]?' · abierto en Gestoor':'')+'</option>';}).join('');
}
function cabecera(){
  return '<div class="pvc-cab"><div><h2 class="pvc-titulo">Cartera de <span>Pre-IVA</span></h2><p class="pvc-preg">Cómo va el Pre-IVA de cada cliente en el mes: si ya se envió, quién lo hizo y cuánto le viene en el F29.</p></div>'
    +'<label class="pvc-mes"><span>Mes del Pre-IVA</span><select id="pvMes" aria-label="Mes del Pre-IVA"'+(S.cargando||S.cargandoMes?' disabled':'')+'>'+opcionesMes()+'</select></label></div>';
}
function render(){
  urlEstado();
  var act=document.activeElement, enBusqueda=act&&act.id==='pvBuscar', pos=enBusqueda?act.selectionStart:0;
  var h=cabecera();
  if(S.error){app(h+'<div class="aviso rojo">'+I('alerta','ic-roj')+'<span>No se pudo leer la cartera: '+esc(textoError(S.error))+'</span> <button type="button" class="btn sec chico" data-act="recargar">Reintentar</button></div>');return;}
  if(S.cargando||S.cargandoMes){app(h+'<div class="aviso lila"><span class="pvc-spin"></span>Cargando la cartera de Pre-IVA de '+esc(perTxt(S.per))+'…</div>');return;}
  var todas=filas(), EQ=window.GEquipo;
  // Filtro por responsable: opciones = analistas presentes (respetando "Mis clientes"); contador = clientes en la vista (estado y Mis clientes, sin la búsqueda)
  var rOpts=EQ.opciones(todas.filter(pasaMis),function(f){return pasaFiltro(f,S.filtro);});
  if(S.resp!==EQ.TODOS&&!rOpts.some(function(x){return x.clave===S.resp;})){S.resp=EQ.TODOS;urlEstado();}
  var rTot=rOpts.reduce(function(s,x){return s+x.n;},0), rNom=EQ.nombreDe(rOpts,S.resp);
  var fs=visibles(todas), t=totales(fs);
  var venc=vencF29(S.per), dias=diasA(venc);
  var vencTxt=dias>1?entero(dias)+' días':dias===1?'1 día':dias===0?'Vence hoy':'Vencido';
  var vencSub=(dias<0?'venció el ':'vence el ')+DIAS[venc.getDay()]+' '+fDia(venc)+' (F29 de '+perTxt(S.per).toLowerCase()+')';
  var incluidos=t.n-t.noinc, sinIva=t.conFila-t.nIva, sinF29=t.conFila-t.nF29;
  var pct=function(x){return incluidos>0?(x/incluidos*100):0;};
  h+='<section class="pvc-tot" aria-label="Totales de la cartera">'
    +'<div class="pvc-k"><small>Clientes</small><b>'+entero(t.n)+'</b><span>'+(rNom?'de '+esc(rNom)+' · ':'')+entero(incluidos)+' con Pre-IVA en su plan'+(t.noinc?' · '+entero(t.noinc)+' no incluido'+(t.noinc===1?'':'s'):'')+'</span></div>'
    +'<div class="pvc-k verde"><small>Enviados</small><b>'+entero(t.env)+'</b><span>ya los tiene el cliente</span></div>'
    +'<div class="pvc-k ambar"><small>Borradores</small><b>'+entero(t.bor)+'</b><span>guardados, falta enviarlos'+(t.rev?' · '+entero(t.rev)+' por revisar (SII)':'')+'</span></div>'
    +'<div class="pvc-k rojo"><small>Pendientes</small><b>'+entero(t.pend)+'</b><span>sin Pre-IVA este mes'+(t.sinc?' · '+entero(t.sinc)+' sin confirmar':'')+'</span></div>'
    +'<div class="pvc-k"><small>IVA total estimado a pagar</small><b>'+(t.nIva?clpT(t.iva):'No disponible')+'</b><span>de '+entero(t.conFila)+' Pre-IVA guardado'+(t.conFila===1?'':'s')+', solo saldos a pagar'+(sinIva?' · '+entero(sinIva)+' sin dato':'')+'</span></div>'
    +'<div class="pvc-k verde"><small>Remanentes a favor</small><b>'+(t.nIva?clpT(t.rem):'No disponible')+'</b><span>crédito mayor que el débito'+(sinIva?' · '+entero(sinIva)+' sin dato':'')+'</span></div>'
    +'<div class="pvc-k lila"><small>F29 total estimado</small><b>'+(t.nF29?clpT(t.f29):'No disponible')+'</b><span>de '+entero(t.conFila)+' Pre-IVA guardado'+(t.conFila===1?'':'s')+(t.pend?' · sin los '+entero(t.pend)+' pendientes':'')+(sinF29?' · '+entero(sinF29)+' sin dato':'')+'</span></div>'
    +'<div class="pvc-k '+(dias<0?'rojo':dias<=3?'ambar':'')+'"><small>Días al vencimiento del F29</small><b>'+vencTxt+'</b><span>'+esc(vencSub)+'</span></div>'
    +'<div class="pvc-k ancho"><small>Avance del mes</small>'
      +'<div class="pvc-av"><div class="pvc-av-barra" role="img" aria-label="'+esc(entero(t.env)+' enviados, '+entero(t.bor)+' borradores y '+entero(t.pend)+' pendientes de '+entero(incluidos)+' clientes con Pre-IVA')+'">'
      +(t.env?'<i class="verde" style="width:'+pct(t.env).toFixed(2)+'%"></i>':'')+(t.rev?'<i class="lila" style="width:'+pct(t.rev).toFixed(2)+'%"></i>':'')+(t.bor?'<i class="ambar" style="width:'+pct(t.bor).toFixed(2)+'%"></i>':'')+(t.pend?'<i class="rojo" style="width:'+pct(t.pend).toFixed(2)+'%"></i>':'')+'</div></div>'
      +'<div class="pvc-av-ley"><span><i class="verde"></i><b>'+entero(t.env)+'</b> enviados</span>'+(t.rev?'<span><i class="lila"></i><b>'+entero(t.rev)+'</b> por revisar</span>':'')+'<span><i class="ambar"></i><b>'+entero(t.bor)+'</b> borradores</span><span><i class="rojo"></i><b>'+entero(t.pend)+'</b> pendientes</span><span>'+(incluidos>0?Math.floor(pct(t.env)).toLocaleString('es-CL')+' % enviado':'—')+'</span></div></div>'
    +'</section>';
  if(S.errHist)h+='<div class="aviso ambar">'+I('alerta','ic-amb')+'<span>No se pudo leer el estado del Pre-IVA de '+esc(perTxt(S.per))+' desde Gestoor ('+esc(textoError(S.errHist))+'). Los estados quedan "Sin confirmar": no se asume que estén pendientes.</span> <button type="button" class="btn sec chico" data-act="recargar-mes">Reintentar</button></div>';
  h+='<div class="aviso gris pvc-sii" id="pvNotaSii">'+I('info','ic-cel')+'<span><b>Pre-IVA automático desde el SII:</b> cuando se active la conexión (RCV de compras y ventas), Gestoor consultará solo los días 2, 12 y 18, primero hará el acuse de las facturas recibidas y después calculará el Pre-IVA con las compras aceptadas (expresas o tácitas a los 8 días; las reclamadas no cuentan). El analista revisa y envía. Hoy todo es <b>Manual</b>. El botón "Actualizar desde el SII" estará '+esc(NOTA_SII.charAt(0).toLowerCase()+NOTA_SII.slice(1))+'.</span></div>';
  if(S.errPlanes)h+='<div class="aviso ambar">'+I('alerta','ic-amb')+'<span>No se pudo leer la tabla de planes: no se sabe qué clientes tienen Pre-IVA incluido. Se muestran todos como si lo tuvieran.</span></div>';
  // Herramientas
  var id=miUsId();
  h+='<div class="pvc-filtros"><label class="pvc-buscar"><span class="sr">Buscar cliente, RUT o responsable</span>'+I('lupa','ic-cel')+'<input type="search" id="pvBuscar" placeholder="Buscar cliente, RUT o responsable…" value="'+esc(S.q)+'" autocomplete="off"></label>'
    +(esMaster()&&id!=null?'<div class="g-seg pvc-seg" role="group" aria-label="Clientes"><button type="button" class="fb'+(S.mis?' on':'')+'" aria-pressed="'+S.mis+'" data-mis="1">Mis clientes</button><button type="button" class="fb'+(!S.mis?' on':'')+'" aria-pressed="'+!S.mis+'" data-mis="0">Todos</button></div>':'')
    +(rOpts.length?EQ.filtroHtml(rOpts,S.resp,rTot):'')
    +'<div class="g-seg pvc-seg" role="group" aria-label="Filtrar">'+FILTROS.map(function(x){
      var n=x[0]==='todos'?null:todas.filter(function(f){return pasaMis(f)&&pasaResp(f)&&pasaFiltro(f,x[0]);}).length;
      return '<button type="button" class="fb'+(S.filtro===x[0]?' on':'')+'" aria-pressed="'+(S.filtro===x[0])+'" data-filtro="'+x[0]+'">'+esc(x[1])+(n!=null?' <b>'+n+'</b>':'')+'</button>';}).join('')+'</div>'
    +'<label class="pvc-orden"><span>Orden</span><select id="pvOrden">'+ORDENES.map(function(x){return '<option value="'+x[0]+'"'+(S.orden===x[0]?' selected':'')+'>'+esc(x[1])+'</option>';}).join('')+'</select></label>'
    +'<button type="button" class="btn sec chico" data-act="csv">'+I('descargar','ic-ver')+'Descargar cartera (Excel/CSV)</button></div>';
  if(!fs.length)h+='<div class="aviso gris">'+I('info','ic-cel')+'<span>'+(todas.length?'Ningún cliente coincide con la búsqueda o el filtro.':'No hay clientes activos en tu cartera.')+'</span></div>';
  else h+='<div class="pvc-tabla-box"><table class="pvc-tabla"><caption class="sr">Cartera de Pre-IVA de '+esc(perTxt(S.per))+': una fila por cliente</caption><thead><tr>'
    +'<th scope="col">Cliente</th><th scope="col">Último guardado o envío</th><th scope="col">Fuente · SII</th><th scope="col" class="num">'+(S.per===perHoy()?'📍 Así vamos · IVA del mes':'IVA del mes')+'</th><th scope="col" class="num">PPM del mes</th><th scope="col" class="num">'+(S.per===perHoy()?'F29 estimado (referencia)':'F29')+'</th><th scope="col">Responsable</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead><tbody>'
    +fs.map(filaHtml).join('')+'</tbody></table></div>';
  h+='<p class="nota">📍 Así vamos · IVA del mes = débito − crédito − remanente del mes anterior, con lo registrado al último guardado del Pre-IVA (sin proyectar). El estimado a fin de mes es una proyección lineal y puede cambiar. F29 estimado = el que calculó y guardó el Pre-IVA (proyectado al cierre, con lo editado en "Editar reporte"). PPM = el del Pre-IVA. '
    +'"No disponible" nunca se asume en $0. Semáforo: rojo pendiente · ámbar borrador sin enviar · verde enviado · gris no incluido en el plan. El F29 vence el día 20 del mes siguiente (si cae fin de semana, el lunes; los feriados no se consideran).</p>';
  app(h);
  if(enBusqueda){var b=$('pvBuscar');if(b){b.focus();try{b.setSelectionRange(pos,pos);}catch(e){}}}
}
function montoCol(v,ndTxt,signo){
  if(v==null)return '<span class="nd">'+esc(ndTxt||'No disponible')+'</span>';
  if(signo&&v<0)return '<small class="t-verde">Remanente a favor</small><b class="t-verde">'+clpT(-v)+'</b>';
  if(signo)return '<small>'+(v>0?'A pagar':'Sin saldo')+'</small><b>'+clpT(v)+'</b>';
  return '<b>'+clpT(v)+'</b>';
}
function filaHtml(f){
  var e=EST[f.estado], h=f.h;
  var guard;
  if(f.estado==='ENVIADO')guard='<span class="pvc-fecha">Enviado el '+esc(fFechaHora(h.fecha_envio))+'</span><small>'+(h.enviado_por?'por '+esc(h.enviado_por):'quién lo envió: no registrado')+'</small>';
  else if(f.estado==='BORRADOR')guard='<span class="pvc-fecha">Borrador guardado</span><small>fecha y autor del borrador: no se registran aún</small>';
  else if(f.estado==='CALCULADO')guard='<span class="pvc-fecha">Calculado por el sistema'+(h.calculado_at?' el '+esc(fFechaHora(h.calculado_at)):'')+'</span><small>nadie lo ha revisado todavía</small>';
  else if(f.estado==='ACUSE')guard='<span class="pvc-fecha">Calculado con las compras aceptadas'+(h.calculado_at?' ('+esc(fFechaHora(h.calculado_at))+')':'')+'</span><small>hay facturas en plazo de reclamo: el monto puede cambiar</small>';
  else if(f.estado==='NO_INCLUIDO')guard='<span class="nd">No corresponde según el plan</span>';
  else if(f.estado==='SIN_CONFIRMAR')guard='<span class="nd">No se pudo leer</span>';
  else guard='<span class="nd">Sin Pre-IVA este mes</span>';
  var sinFila=!h?(f.estado==='SIN_CONFIRMAR'?'No disponible':'—'):null;
  var enCurso=S.per===perHoy();
  var iva=f.exenta?'<span class="nd">No aplica</span>':sinFila?'<span class="nd">'+sinFila+'</span>':montoCol(f.iva,f.sinLibros?'Sin libros cargados':'No disponible',true)
    +(enCurso?(f.ivaEst!=null?'<small class="pvc-ref">estimado a fin de mes '+clpT(f.ivaEst)+'</small>':''):(f.iva!=null?'<small class="pvc-ref">mes cerrado · valor final</small>':''));
  var ppm=sinFila?'<span class="nd">'+sinFila+'</span>':montoCol(f.ppm,f.sinTasa?'Sin tasa PPM':'No disponible',false);
  var f29=sinFila?'<span class="nd">'+sinFila+'</span>':montoCol(f.f29,f.sinLibros?'Sin libros cargados':'No disponible',false);
  // Fuente del dato + última consulta al SII + facturas recibidas (acuse). Hoy: "Manual" y facturas en blanco.
  var fuente=f.auto?'<span class="estado cel pvc-chip">SII automático'+(h.calculado_at?' (RCV del '+esc(fCorta(h.calculado_at))+')':'')+'</span>':(h?'<span class="estado gris pvc-chip">Manual</span>':'<span class="nd">—</span>');
  var r=f.rcv;
  fuente+=r&&r.ultima?'<small>Última consulta al SII: '+esc(fFechaHora(r.ultima.finalizado_at))+(r.ultima.estado==='completado'?'':' (con error)')+'</small>':'<small>Sin consultas al SII este mes</small>';
  fuente+=f.fact?'<small class="pvc-fact">Facturas recibidas: <b>'+entero(f.fact.ok||0)+'</b> aceptadas · <b>'+entero(f.fact.plazo||0)+'</b> en plazo de reclamo'+(f.fact.plazo>0&&f.fact.vence?' (vence '+esc(String(f.fact.vence).slice(8,10)+'-'+String(f.fact.vence).slice(5,7))+')':'')+' · <b>'+entero(f.fact.rec||0)+'</b> reclamadas</small>'
    :'<small class="pvc-fact nd">Facturas recibidas: — (con la conexión al SII)</small>';
  var url='index.html?cliente='+encodeURIComponent(String(f.id))+'&periodo='+encodeURIComponent(S.per);
  var bot='<a class="btn chico'+(f.estado==='NO_INCLUIDO'?' sec':'')+'" href="'+esc(url)+'" aria-label="Abrir el Pre-IVA de '+esc(f.nombre)+' ('+esc(perTxt(S.per))+')">'+I('flecha-der')+(f.estado==='NO_INCLUIDO'?'Abrir igual':'Abrir Pre-IVA')+'</a>'
    +'<button type="button" class="btn sec chico pvc-sii-btn" disabled aria-disabled="true" aria-describedby="pvNotaSii" title="'+esc(NOTA_SII)+'">'+I('recargar','ic-cel')+'Actualizar desde el SII</button>';
  return '<tr class="pvc-fila p-'+e[0]+'">'
    +'<td data-l="Cliente"><div class="pvc-cli"><span class="pvc-sem '+e[0]+'"><i aria-hidden="true"></i>'+esc(e[1])+'</span><b>'+esc(f.nombre)+'</b>'
      +'<small>'+esc([f.rut,f.planNombre].filter(Boolean).join(' · '))+'</small>'
      +(f.motivos.length?'<small class="pvc-mot">'+esc(f.motivos.join(' · '))+'</small>':'')
      +f.chips.map(function(c){return '<span class="estado '+c[0]+' pvc-chip">'+esc(c[1])+'</span>';}).join('')+'</div></td>'
    +'<td data-l="Último guardado"><div class="pvc-col">'+guard+'</div></td>'
    +'<td data-l="Fuente · SII"><div class="pvc-col pvc-fuente">'+fuente+'</div></td>'
    +'<td data-l="IVA del mes" class="num"><div class="pvc-col der">'+iva+'</div></td>'
    +'<td data-l="PPM del mes" class="num"><div class="pvc-col der">'+ppm+'</div></td>'
    +'<td data-l="F29 estimado" class="num"><div class="pvc-col der">'+f29+'</div></td>'
    +'<td data-l="Responsable">'+window.GEquipo.celda(f.resp)+'</td>'
    +'<td class="pvc-accs"><div class="pvc-accs-in">'+bot+'</div></td></tr>';
}

/* ── Descargar cartera: se arma en el navegador (CSV con ; y BOM para Excel en español). No se sube nada. ── */
function csvCelda(x){if(x==null)return '';if(typeof x==='number')return String(Math.round(x));var s=String(x);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[;"\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function descargarCsv(){
  var fs=visibles(filas()), hoy=new Date().toISOString().slice(0,10);
  var cab=['Estado','Motivo','Cliente','RUT','Plan','Responsable','Mes','Fuente','Fecha de envío','Enviado por','Débito IVA registrado','Crédito IVA registrado','Remanente mes anterior','IVA del mes a pagar','Remanente a favor','PPM del mes','F29 estimado'];
  var L=[cab.map(csvCelda).join(';')];
  fs.forEach(function(f){
    var h=f.h, nd=function(v){return h?(v==null?'No disponible':v):'';};
    L.push([EST[f.estado][1],f.motivos.concat(f.chips.map(function(c){return c[1];})).join(' · '),f.nombre,f.rut,f.planNombre||f.plan,f.resp||'Sin asignar',S.per,h?(f.auto?'SII automático':'Manual'):'',
      h&&h.fecha_envio?fFechaHora(h.fecha_envio):'',h&&h.enviado_por||'',
      f.exenta?'No aplica':h?(f.sinLibros?'Sin libros cargados':nd(num(h.debito_iva))):'',f.exenta?'No aplica':h?(f.sinLibros?'Sin libros cargados':nd(num(h.credito_iva))):'',f.exenta?'No aplica':h?nd(num(h.remanente)):'',
      f.exenta?'No aplica':h?(f.iva==null?'No disponible':(f.iva>0?f.iva:0)):'',f.exenta?'No aplica':h?(f.iva==null?'No disponible':(f.iva<0?-f.iva:0)):'',
      h?nd(f.ppm):'',h?nd(f.f29):''].map(csvCelda).join(';'));
  });
  var blob=new Blob(['﻿'+L.join('\r\n')],{type:'text/csv;charset=utf-8'}), url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download='PreIVA_cartera_'+S.per+'_'+hoy+'.csv';document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(url);a.remove();},500);
  toast(I('check','ic-ver')+' Cartera descargada ('+fs.length+' cliente'+(fs.length===1?'':'s')+', con los filtros actuales).');
}

/* ── Eventos ── */
document.addEventListener('click',function(e){
  var fl=e.target.closest('[data-filtro]');if(fl){S.filtro=fl.getAttribute('data-filtro');render();return;}
  var mi=e.target.closest('[data-mis]');if(mi){S.mis=mi.getAttribute('data-mis')==='1';render();return;}
  var rp=e.target.closest('[data-resp]');if(rp){S.resp=window.GEquipo.valida(rp.getAttribute('data-resp'));render();return;}
  var a=e.target.closest('[data-act]');if(!a)return;
  var act=a.getAttribute('data-act');
  if(act==='recargar')iniciar();
  else if(act==='recargar-mes')cargarMes();
  else if(act==='csv')descargarCsv();
});
document.addEventListener('change',function(e){
  if(e.target.id==='pvMes'){var p=e.target.value;if(RE_PER.test(p)&&p!==S.per){S.per=p;cargarMes();}}
  else if(e.target.id==='pvOrden'){S.orden=e.target.value;render();}
  else if(e.target.classList&&e.target.classList.contains('geq-sel-in')){S.resp=window.GEquipo.valida(e.target.value);render();}
});
document.addEventListener('input',function(e){if(e.target.id==='pvBuscar'){S.q=e.target.value;render();}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();
