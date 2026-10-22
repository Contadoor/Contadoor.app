/* ============================================================
   pre-iva/operativa-vista.js — Pre-IVA · Pantalla 2: piezas visuales (misma línea que MiRenta)
   SOLO PRESENTACIÓN. No calcula el F29, no guarda, no envía y no escribe en ningún elemento que use el cálculo:
     · LEE la pantalla que ya pinta el código existente (res-*, kpi-*, inp-*) y el estado (_clienteActual, _filaPreiva,
       _datos, _editOverrides, _periodoActual), más los datos de solo lectura de operativa-datos.js, y
     · ESCRIBE solo en elementos nuevos (ids pio-*) y en clases de presentación.
   El IVA a pagar se muestra con la MISMA fórmula aprobada (PreIvaF29.calcularF29Estimado, pre-iva/f29-formula.js) sobre
   los montos que ya están en pantalla, y solo si su total cuadra exactamente con el F29 mostrado; si no, "No disponible".
   ============================================================ */
(function(){
'use strict';
/* Interruptores (fáciles de revertir):
   · recomendacionesNuevas: true = "Qué puedes hacer" muestra el motor pre-iva/recomendaciones.js; false = vuelve a las
     acciones del sistema anterior (las de #acciones-grid, que son las que HOY van en el correo).
   · cargaManual: 'auto' = la carga manual de libros se oculta cuando la conexión con el SII está activa para el cliente;
     'siempre' = se muestra siempre; 'nunca' = no se muestra.  */
var CFG=window.PIO_CONFIG=Object.assign({recomendacionesNuevas:true,cargaManual:'auto',filasDocs:200},window.PIO_CONFIG||{});
var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
var MES3=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
var PLANES={cumplimiento:'Plan Cumplimiento',asesoria:'Plan Asesoría',estrategico:'Plan Estratégico'};
var VOUCHER=[48];
function $(id){return document.getElementById(id);}
function txt(id){var e=$(id);return e?e.textContent:'';}
function val(id){var e=$(id);return e?String(e.value==null?'':e.value).trim():'';}
function pesos(t){return parseInt(String(t==null?'':t).replace(/[^0-9]/g,''),10)||0;}
function miles(n){return Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
function clp(n){return (n==null||!isFinite(n))?'No disponible':(n<0?'−':'')+'$'+miles(n);}
function corto(n){if(n==null||!isFinite(n))return '';var a=Math.abs(n),s=n<0?'−':'';if(a>=1e6)return s+'$'+(Math.round(a/1e5)/10).toString().replace('.',',')+' M';if(a>=1e3)return s+'$'+Math.round(a/1e3)+' mil';return s+'$'+Math.round(a);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function pon(id,t){var e=$(id);if(e&&e.textContent!==t)e.textContent=t;}
function clase(el,c,on){if(el&&el.classList.contains(c)!==!!on)el.classList.toggle(c,!!on);}
// Escrituras idempotentes: no tocar el DOM si el valor no cambió (evita que el MutationObserver repinte en bucle)
function cls(el,v){if(el&&el.className!==v)el.className=v;}
function oculto(el,v){if(el&&el.hidden!==!!v)el.hidden=!!v;}
function attr(el,k,v){if(el&&el.getAttribute(k)!==v)el.setAttribute(k,v);}
function z(n){return (n<10?'0':'')+n;}
function fCorta(iso){try{var d=new Date(iso);if(isNaN(d.getTime()))return '';return z(d.getDate())+'-'+z(d.getMonth()+1)+'-'+d.getFullYear();}catch(e){return '';}}
function fDM(iso){var s=String(iso||'');if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s.slice(8,10)+'-'+s.slice(5,7);try{var d=new Date(iso);return isNaN(d.getTime())?'':z(d.getDate())+'-'+z(d.getMonth()+1);}catch(e){return '';}}
function fDMH(iso){try{var d=new Date(iso);return isNaN(d.getTime())?'':z(d.getDate())+'-'+z(d.getMonth()+1)+' '+z(d.getHours())+':'+z(d.getMinutes());}catch(e){return '';}}
function g(n){return typeof window[n]==='undefined'?undefined:window[n];}
function icono(n){return window.gIcon?window.gIcon(n):'';}
function hoyIso(){var d=new Date();return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());}
function pct(v){return (v>0?'+':v<0?'−':'')+Math.round(Math.abs(v)*100)+' %';}

// Período abierto: 'AAAAMM' → datos para los textos
function periodo(){
  var p=String(g('_periodoActual')||''), y=parseInt(p.slice(0,4),10), m=parseInt(p.slice(4,6),10);
  if(!(y>2000)||!(m>=1&&m<=12))return null;
  var hoy=new Date(), vm=m===12?1:m+1, vy=m===12?y+1:y, am=m===1?12:m-1, ay=m===1?y-1:y;
  return {y:y,m:m,db:y+'-'+z(m),txt:MESES[m-1].charAt(0).toUpperCase()+MESES[m-1].slice(1)+' '+y,
    venc:'20 de '+MESES[vm-1]+(vy!==y?' '+vy:''), vencIso:vy+'-'+z(vm)+'-20', finIso:y+'-'+z(m)+'-'+z(new Date(y,m,0).getDate()),
    anterior:MESES[am-1]+' '+ay, actual:hoy.getFullYear()===y&&hoy.getMonth()+1===m};
}

// Chip de aviso (se crea una vez dentro de #pio-chips; texto con textContent)
function chip(id,tipo,ic,texto){
  var cont=$('pio-chips');if(!cont)return;
  var el=$(id);
  if(!texto){oculto(el,true);return;}
  if(!el){el=document.createElement('span');el.id=id;el.innerHTML=icono(ic)+'<span></span>';cont.appendChild(el);}
  cls(el,'chip '+tipo);oculto(el,false);
  var s=el.querySelector('span:last-child');if(s&&s.textContent!==texto)s.textContent=texto;
}

/* ── Datos de solo lectura (SII, documentos, historial, MiRenta) ── */
var S={key:null,D:null,cargando:false,libro:'ventas',q:'',tipo:'',acuse:'',lim:CFG.filasDocs,firmas:{}};
function asegurarDatos(c,P){
  if(!window.PioDatos||!P)return;
  var key=c.id+'|'+P.db;
  if(S.key===key)return;
  S.key=key;S.D=null;S.cargando=true;S.lim=CFG.filasDocs;S.firmas={};
  window.PioDatos.cargar({id:c.id,rut:c.rut,plan:c.plan},P.db).then(function(d){if(S.key!==key)return;S.D=d;S.cargando=false;programar();},
    function(e){if(S.key!==key)return;S.cargando=false;S.D={error:e&&e.message||String(e),extra:{},sii:{estado:'error'},docs:{disponible:false,actual:{ventas:[],compras:[]},previos:{},resumen:{}},hist:{filas:[]},renta:null};programar();});
}
function siiActiva(){var e=S.D&&S.D.sii&&S.D.sii.estado;return e==='al_dia'||e==='desactualizado'||e==='sin_datos';}
function esExenta(){return !!(S.D&&S.D.extra&&S.D.extra.ivaCondicion==='exento');}
// Firma: solo se vuelve a dibujar una pieza si cambió lo que muestra
function cambio(nombre,obj){var f=JSON.stringify(obj);if(S.firmas[nombre]===f)return false;S.firmas[nombre]=f;return true;}

function pintar(){
  var c=g('_clienteActual');if(!c)return;
  var P=periodo(), datos=g('_datos')||{}, ov=g('_editOverrides')||{}, fila=g('_filaPreiva');
  asegurarDatos(c,P);
  var exenta=esExenta();

  // ── Franja del cliente ──
  pon('pio-plan',PLANES[c.plan]||(c.plan?'Plan '+c.plan:'Sin plan'));
  if(P){pon('pio-periodo',P.txt);pon('pio-venc','Cierre del F29: '+P.venc);pon('pio-venc-corto',P.venc);pon('pio-av-venc',P.venc);pon('pio-var-mes',P.anterior);}
  var r=$('pio-resp'), nom=String(c.analistaContable||'').trim();
  if(r&&r.getAttribute('data-n')!==nom){
    r.setAttribute('data-n',nom);
    r.innerHTML=window.GEquipo?window.GEquipo.celda(nom):'';
    if(!window.GEquipo)r.textContent=nom||'Sin asignar';
  }
  var est=$('pio-estado'), sub='';
  if(est){
    var e;
    if(fila===undefined){e=['rojo','No se pudo leer'];sub='Recarga la página';}
    else if(!fila){e=['ambar','Pendiente'];sub='Aún no se envía este mes';}
    else if(fila.fecha_envio){e=['verde','Enviado'];sub='El '+fCorta(fila.fecha_envio)+(fila.enviado_por?' · '+fila.enviado_por:'');}
    else{e=['lila','Borrador'];sub='Guardado en Gestoor, sin enviar';}
    cls(est,'estado '+e[0]);pon('pio-estado',e[1]);pon('pio-estado-sub',sub);
  }
  var fu=$('pio-fuente');
  if(fu){var sii=!!(fila&&fila.fuente==='SII');cls(fu,'estado '+(sii?'cel':'gris'));pon('pio-fuente',sii?'SII automático':'Manual');}

  // ── Empresa exenta de IVA: el F29 es solo el PPM (misma fórmula con débito = crédito = remanente = 0) ──
  var panel=$('panel-simulacion');
  clase(panel,'pio-modo-exenta',exenta);
  oculto($('pio-exenta'),!exenta);
  oculto($('pio-iva-sin-dato'),!(S.D&&S.D.extra&&!S.D.extra.error&&!S.D.extra.ivaCondicion));
  ['inp-debito','inp-credito'].forEach(function(id){var i=$(id);if(i)clase(i.closest('.campo-iva'),'con-valor',val(id)!=='');});
  pon('pio-hero-lbl',exenta?'F29 estimado (solo PPM)':'F29 estimado a pagar');
  pon('pio-op-ppm',exenta?'':'+');
  pon('pio-lbl-exento',exenta?'Ingresos exentos (neto)':'Ventas exentas (neto)');

  // ── "No disponible" nunca $0: sin datos de entrada o con montos inválidos ──
  var errores=(datos.erroresEntrada||[]).length>0;
  var sinDato=(val('inp-debito')===''&&val('inp-credito')===''&&(!exenta||val('inp-exento-ventas')===''))||errores;
  clase($('pio-kpis'),'pio-sin-dato',sinDato);clase($('pio-liq'),'pio-sin-dato',sinDato);
  pon('pio-hero-nd',errores?'Corrige los montos marcados en rojo en "Datos del mes".':exenta?'Escribe los ingresos exentos del mes y la tasa PPM.':'Carga los libros o escribe el débito y el crédito del mes.');
  var tasa=parseFloat(val('inp-tasa-ppm'))||0, sinTasa=!sinDato&&!(tasa>0);
  clase($('pio-kpi-ppm'),'sin-tasa',sinTasa);clase($('pio-fila-ppm'),'sin-tasa',sinTasa);
  pon('pio-ppm-nd',sinTasa?'Falta la tasa PPM':'Sin datos del mes');

  // ── IVA a pagar: misma fórmula aprobada, sobre los montos de la pantalla, y solo si cuadra con el F29 mostrado ──
  var iva='No disponible', ivaNum=null;
  if(window.PreIvaF29){
    var rr=window.PreIvaF29.calcularF29Estimado({debito:pesos(txt('res-debito')),credito:pesos(txt('res-credito')),remanente:pesos(txt('res-remanente')),ppm:pesos(txt('res-ppm'))});
    if(rr.total===pesos(txt('res-f29'))){iva=clp(rr.ivaPagar);ivaNum=rr.ivaPagar;}
  }
  pon('pio-kpi-iva',iva);pon('pio-liq-iva',iva);

  // ── Base del PPM (lo que ya calculó la pantalla) ──
  var base=Number(datos.ppmBase), t=Number(datos.tasaPPM);
  pon('pio-ppm-base',t>0&&isFinite(base)?'Base '+clp(base)+(exenta?' (ingresos exentos':' (neto afecto + exento')+(P&&P.actual?', proyectada al cierre':'')+') × tasa '+String(t).replace('.',',')+' %':'Sin tasa PPM: no se suma PPM al F29');

  // ── Comparación con el mes anterior (solo si se escribió el F29 anterior) ──
  var f29Ant=parseInt(val('inp-f29-ant'),10)||0, vl=$('pio-var-linea');
  if(vl){oculto(vl,!(f29Ant>0));
    if(f29Ant>0){var v=txt('kpi-var').trim();pon('pio-var-ic',/^\+0%$|^0%$/.test(v)?'=':v.charAt(0)==='-'?'↘':'↗');pon('pio-f29-ant',clp(f29Ant));}}

  // ── Chips de aviso extra ──
  chip('pio-chip-tasa','ambar','alerta',sinTasa?'Falta la tasa PPM: el F29 estimado aún no incluye PPM':'');
  chip('pio-chip-rem','ambar','alerta',!exenta&&/no se pudo leer/i.test(txt('lbl-remanente-fuente'))?'No se pudo leer el remanente desde Contable: se usó $0':'');
  var nuevoRem=pesos(txt('kpi-remanente'));
  chip('pio-chip-nrem','verde','check',!exenta&&!sinDato&&nuevoRem>0?'Queda un remanente a favor de '+clp(nuevoRem)+' para el mes siguiente':'');
  chip('pio-chip-exrem','ambar','alerta',exenta&&pesos(txt('res-remanente'))>0?'Empresa exenta: hay un remanente de '+txt('res-remanente')+' desde Contable que se resta del F29; revísalo con Contable.':'');
  chip('pio-chip-exppm','gris','alerta',exenta&&val('inp-debito')===''?'Empresa exenta: sin débito, el neto afecto es $0 y la base del PPM son solo los ingresos exentos.':'');
  chip('pio-chip-exiva','ambar','alerta',exenta&&(val('inp-debito')!==''||val('inp-credito')!=='')?'Empresa exenta: el débito o crédito escritos se suman al F29; déjalos vacíos si no corresponden':'');
  var editado=['debito','credito','f29','ppm','remanente'].some(function(k){return ov[k]!==null&&ov[k]!==undefined;})||(ov.acciones&&ov.acciones.length>0)||!!(ov.obs&&String(ov.obs).trim());
  chip('pio-chip-edit','lila','lapiz',editado?'Reporte editado a mano: el correo usa lo de "Editar reporte"'+(ov.f29!=null?' (F29 '+ov.f29+')':'')+'. Revísalo en la vista previa.':'');

  // ── Avance del mes ──
  var dT=parseFloat(val('inp-dias-transc'))||0, dTot=parseFloat(val('inp-dias-tot'))||31;
  var actual=!!(P&&P.actual), pc=actual?Math.max(0,Math.min(100,Math.round(dT/dTot*100))):100;
  pon('pio-av-pct',pc+'%');pon('pio-av-det',actual?'(día '+dT+' de '+dTot+')':'· mes cerrado, libros completos');
  var bar=$('pio-av-barra'), fill=$('pio-av-fill');
  if(bar){clase(bar,'cerrado',!actual);attr(bar,'aria-valuenow',String(pc));}
  if(fill&&fill.style.width!==pc+'%')fill.style.width=pc+'%';

  // ── Piezas con datos del SII, historial y MiRenta ──
  var ctx={P:P,exenta:exenta,sinDato:sinDato,ivaNum:ivaNum,tasa:tasa,sinTasa:sinTasa,datos:datos,nuevoRem:nuevoRem};
  pintarSii();pintarManual();pintarRecos(ctx);pintarHistorial(ctx);pintarTendencias(ctx);pintarDocs(ctx);
}

/* ── Sincronización con el SII ── */
function pintarSii(){
  var D=S.D, s=D&&D.sii, chipEl=$('pio-sii-chip'), btn=$('pio-sii-btn');if(!chipEl)return;
  var e=s?s.estado:'cargando', m={
    cargando:['gris','Revisando la conexión con el SII…',''],
    pendiente:['gris','Conexión con el SII pendiente de activación','Mientras tanto, los montos se cargan a mano en "Carga manual".'],
    error:['gris','No se pudo leer el estado del SII','Puedes seguir trabajando con la carga manual.'],
    al_dia:['verde','SII al día'+(s&&s.ultima?' (RCV del '+fDMH(s.ultima)+')':''),''],
    desactualizado:['ambar','Desactualizado: actualiza antes de calcular',s&&(s.motivo||s.aviso)||''],
    sin_datos:['ambar','Sin datos del SII','Aún no hay RCV de este período: actualiza antes de calcular.']}[e]||['gris',e,''];
  if(!cambio('sii',[e,m]))return;
  cls(chipEl,'estado '+m[0]);chipEl.textContent=m[1];pon('pio-sii-det',m[2]);
  var activa=siiActiva();
  if(btn&&btn.disabled!==!activa)btn.disabled=!activa;if(btn){btn.title=activa?'Usa 2 consultas de la bolsa manual (compras y ventas)':'Se habilita cuando se active la conexión con el SII';}
  pon('pio-sii-nota',activa?'Bolsa manual: hasta 10 actualizaciones por cliente al mes.':'Se habilita cuando se active la conexión con el SII · bolsa manual: hasta 10 por cliente al mes.');
}
function actualizarSii(){
  var c=g('_clienteActual'), P=periodo();if(!c||!P||!siiActiva()||!window.PioDatos)return;
  if(!confirm('¿Actualizar compras y ventas de '+P.txt+' desde el SII?\n\nUsa 2 consultas de la bolsa manual (tope: 10 por cliente al mes).'))return;
  var btn=$('pio-sii-btn');if(btn){btn.disabled=true;}
  var msj=[];
  window.PioDatos.actualizarSii(c,P.db,'compras').then(function(r){msj.push('Compras: '+((r&&r.codigo)||(r&&r.ok?'ok':'sin respuesta')));return window.PioDatos.actualizarSii(c,P.db,'ventas');})
    .then(function(r){msj.push('Ventas: '+((r&&r.codigo)||(r&&r.ok?'ok':'sin respuesta')));})
    .catch(function(e){msj.push('Error: '+(e&&e.message||e));})
    .then(function(){if(window.mostrarToast)window.mostrarToast('SII · '+msj.join(' · '));S.key=null;programar();});
}

/* ── Carga manual (respaldo temporal) ── */
function pintarManual(){
  var d=$('pio-manual');if(!d)return;
  var ver=CFG.cargaManual==='siempre'||(CFG.cargaManual==='auto'&&!siiActiva());
  oculto(d,!ver);
}

/* ── Recomendaciones (motor pre-iva/recomendaciones.js) ── */
function ctxRecos(x){
  var D=S.D||{}, per=x.P.db, docs=D.docs||{}, res=docs.resumen||{};
  var rp={};Object.keys(res).forEach(function(p){if(p!==per)rp[p]=res[p].ventas||{};});
  return {hoy:hoyIso(),periodo:per,mesEnCurso:x.P.actual,exenta:x.exenta,vencF29:x.P.vencIso,finMes:x.P.finIso,
    actual:{ivaPagar:x.ivaNum,ppm:x.sinTasa?null:pesos(txt('res-ppm')),f29:pesos(txt('res-f29')),nuevoRemanente:x.nuevoRem,debito:pesos(txt('res-debito')),credito:pesos(txt('res-credito')),
      ventasBase:isFinite(Number(x.datos.ppmBase))?Number(x.datos.ppmBase):null,tasaPPM:x.tasa,sinDato:x.sinDato},
    historial:(D.hist&&D.hist.filas)||[],
    docs:{disponible:!!docs.disponible,actual:docs.actual||{ventas:[],compras:[]},previos:docs.previos||{},resumenActual:(res[per]||{}).ventas||{},resumenPrevios:rp},
    sii:D.sii||{estado:'cargando'},renta:D.renta||null};
}
function pintarRecos(x){
  var cont=$('pio-recos'), acc=$('pio-correo-acc');if(!cont||!x.P)return;
  var nuevo=!!CFG.recomendacionesNuevas&&!!window.PreIvaRecos;
  oculto(cont,!nuevo);
  if(acc){if(!nuevo&&!acc.open)acc.open=true;clase(acc,'solo',!nuevo);}
  // Proyección de renta (MiRenta): fecha de la última actualización y enlace
  var R=S.D&&S.D.renta, rb=$('pio-renta');
  if(rb){var conCaso=nuevo&&R&&R.casoId;oculto(rb,!conCaso);
    if(conCaso){var est={VIGENTE:'vigente',DESACTUALIZADA:'desactualizada',CONGELADA:'congelada',SIN_PROYECCION:'sin calcular'}[R.estado]||String(R.estado).toLowerCase();
      pon('pio-renta-txt','Proyección de renta '+est+(R.finalizado?' · actualizada el '+fDM(R.finalizado):'')+(R.corte?' · datos al '+fDM(R.corte):''));
      attr($('pio-renta-link'),'href','../pir/proyeccion.html?caso='+encodeURIComponent(R.casoId));}}
  if(!nuevo)return;
  if(!S.D){if(cambio('recos','cargando'))cont.innerHTML='<p class="nota">Cargando los datos del SII, el historial y la proyección de renta…</p>';return;}
  var l=window.PreIvaRecos.generar(ctxRecos(x));
  if(!cambio('recos',l))return;
  if(!l.length){cont.innerHTML='<div class="aviso gris">'+icono('alerta')+'<span>Sin recomendaciones con los datos de hoy. Aparecen cuando hay documentos del SII, historial de meses anteriores o proyección de renta (nada de recomendaciones genéricas).</span></div>';return;}
  cont.innerHTML=l.map(function(o){
    return '<article class="reco c-'+esc(o.color)+'"><div class="reco-h"><b>“'+esc(o.frase)+'”</b><span class="estado '+(o.quien==='Tú'?'lila':'cel')+'">'+esc(o.quien==='Tú'?'Lo haces tú':'Lo hace tu analista')+'</span></div>'
      +'<p class="reco-det">'+esc(o.detectado)+'</p>'
      +'<p class="reco-l"><span>Impacto</span>'+esc(o.impacto)+'</p>'
      +'<p class="reco-l"><span>Qué hacer</span>'+esc(o.accion)+(o.plazo?' <em class="reco-plazo">Plazo: '+esc(fDM(o.plazo))+'</em>':'')+'</p></article>';
  }).join('');
}

/* ── Gráfico de barras SVG (degradado de marca, sin librerías) ── */
var GRADS='<defs><linearGradient id="pgL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E39BE5"/><stop offset="1" stop-color="#803889"/></linearGradient>'
  +'<linearGradient id="pgV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9BEBC4"/><stop offset="1" stop-color="#2E8F64"/></linearGradient>'
  +'<linearGradient id="pgC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9FDBFF"/><stop offset="1" stop-color="#2A7FB8"/></linearGradient></defs>';
function svgBarras(meses,series,prom){
  var W=640,H=230,top=26,bot=40,left=8,right=8,ah=H-top-bot, n=meses.length, gw=(W-left-right)/n;
  var max=0;series.forEach(function(s){s.v.forEach(function(x){if(x!=null&&x>max)max=x;});});if(prom!=null&&prom>max)max=prom;if(!(max>0))max=1;
  var bw=Math.min(46,(gw-14)/series.length), h='<svg viewBox="0 0 '+W+' '+H+'" class="pio-svg" role="img" aria-label="'+esc(series.map(function(s){return s.nombre;}).join(' y '))+' por mes">'+GRADS;
  h+='<line x1="'+left+'" x2="'+(W-right)+'" y1="'+(top+ah)+'" y2="'+(top+ah)+'" stroke="rgba(255,255,255,.12)"/>';
  meses.forEach(function(mes,i){
    var x0=left+i*gw+(gw-bw*series.length-(series.length-1)*4)/2;
    series.forEach(function(s,k){
      var v=s.v[i], x=x0+k*(bw+4), act=i===n-1;
      if(v==null){h+='<rect x="'+x+'" y="'+(top+ah-24)+'" width="'+bw+'" height="24" rx="7" fill="none" stroke="#7A4A82" stroke-dasharray="4 3"/><text x="'+(x+bw/2)+'" y="'+(top+ah-30)+'" text-anchor="middle" class="sv-nd">Sin dato</text>';return;}
      var bh=Math.max(3,Math.round(Math.max(v,0)/max*ah)), y=top+ah-bh;
      h+='<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+bh+'" rx="7" fill="url(#'+s.grad+')"'+(act?' opacity=".55" stroke="'+s.borde+'" stroke-dasharray="5 3"':'')+'><title>'+esc(mes+': '+clp(v))+'</title></rect>';
      if(series.length===1||bw>=30)h+='<text x="'+(x+bw/2)+'" y="'+(y-6)+'" text-anchor="middle" class="sv-v">'+esc(corto(v))+'</text>';
    });
    h+='<text x="'+(left+i*gw+gw/2)+'" y="'+(H-bot+18)+'" text-anchor="middle" class="sv-m'+(i===n-1?' act':'')+'">'+esc(mes)+'</text>';
    if(i===n-1)h+='<text x="'+(left+i*gw+gw/2)+'" y="'+(H-bot+33)+'" text-anchor="middle" class="sv-s">'+esc(series[0].etqActual||'estimado')+'</text>';
  });
  if(prom!=null){var yp=top+ah-Math.round(prom/max*ah);h+='<line x1="'+left+'" x2="'+(W-right)+'" y1="'+yp+'" y2="'+yp+'" class="sv-prom"><title>Promedio '+esc(clp(prom))+'</title></line>';}
  return h+'</svg>';
}
function etiquetaMes(p){return MES3[+p.slice(5,7)-1]+' '+p.slice(2,4);}

/* ── Historial de 6 meses: IVA a pagar (o PPM en exentas) ── */
function pintarHistorial(x){
  var gEl=$('pio-hist-graf');if(!gEl)return;
  var D=S.D, campo=x.exenta?'ppm':'iva';
  var tit=$('pio-hist-tit');
  if(!D){if(cambio('hist','c')){tit.innerHTML=x.exenta?'Tu PPM <span>de los últimos 6 meses</span>':'Tu IVA <span>de los últimos 6 meses</span>';gEl.innerHTML='<p class="nota">Cargando el historial…</p>';}return;}
  var filas=(D.hist&&D.hist.filas)||[];
  var cur=x.sinDato?null:(x.exenta?(x.sinTasa?null:pesos(txt('res-ppm'))):x.ivaNum);
  var vals=filas.map(function(f){return f[campo];}), st=window.PreIvaRecos?window.PreIvaRecos.stats(vals):{n:0};
  var firma=[campo,vals,cur,x.P.db];if(!cambio('hist',firma))return;
  tit.innerHTML=x.exenta?'Tu PPM <span>de los últimos 6 meses</span>':'Tu IVA a pagar <span>· últimos 6 meses</span>';
  var meses=filas.map(function(f){return etiquetaMes(f.periodo);}).concat([etiquetaMes(x.P.db)]);
  var prom=st.n>=3?st.prom:null;
  gEl.innerHTML=svgBarras(meses,[{nombre:x.exenta?'PPM':'IVA a pagar',grad:'pgL',borde:'#E39BE5',v:vals.concat([cur]),etqActual:'estimado'}],prom);
  var cmp='';
  if(prom!=null&&cur!=null&&prom>0){var d=(cur-prom)/prom;cmp=Math.abs(d)<0.005?'Igual a tu promedio de 6 meses':pct(d)+(d>0?' sobre':' bajo')+' tu promedio de 6 meses';}
  if(prom!=null)cmp+=(cmp?' · ':'')+'promedio '+clp(prom)+' (línea amarilla)';
  else if(prom==null)cmp='Faltan meses con dato para el promedio';
  pon('pio-hist-cmp',cmp);
  var nC=filas.filter(function(f){return f.fuente==='Contable';}).length, nP=filas.filter(function(f){return f.fuente==='Pre-IVA enviado';}).length;
  pon('pio-hist-fuente','Fuente: '+(x.exenta?'PPM pagado':'IVA a pagar = débito − crédito − remanente')+' del F29 validado por Contable ('+nC+' mes'+(nC===1?'':'es')+')'+(nP?' y del Pre-IVA enviado cuando Contable aún no lo tiene ('+nP+')':'')+'. "Sin dato" = mes sin información (nunca $0). Mes en curso: estimado de esta pantalla.'+(D.hist&&D.hist.error?' ⚠ No se pudo leer reportes_mensuales.':''));
}

/* ── Tendencias de ventas y compras netas ── */
function netoLibro(l){var t=0,hay=false;Object.keys(l||{}).forEach(function(k){if(VOUCHER.indexOf(+k)>=0)return;var x=l[k];hay=true;t+=(+k===61?-1:1)*((Number(x.neto)||0)+(Number(x.exento)||0));});return hay?t:null;}
function pintarTendencias(x){
  var gEl=$('pio-tend-graf');if(!gEl)return;
  var D=S.D;if(!D){if(cambio('tend','c'))gEl.innerHTML='<p class="nota">Cargando…</p>';return;}
  var per=x.P.db, prev=window.PioDatos.previos(per), res=(D.docs&&D.docs.resumen)||{}, filas=(D.hist&&D.hist.filas)||[];
  var mesesConRes=prev.filter(function(p){return res[p];}).length, fuente, V, C;
  if(D.docs&&D.docs.disponible&&mesesConRes>=3){
    V=prev.map(function(p){return res[p]?netoLibro(res[p].ventas):null;}).concat([netoLibro((res[per]||{}).ventas)]);
    C=prev.map(function(p){return res[p]?netoLibro(res[p].compras):null;}).concat([netoLibro((res[per]||{}).compras)]);
    fuente='Fuente: RCV del SII (neto + exento; las notas de crédito restan; sin comprobantes de pago electrónico). Mes en curso: a la fecha.';
  }else{
    var tasa=0.19;
    V=filas.map(function(f){return x.exenta?f.ventas:(f.debito!=null?Math.round(f.debito/tasa):f.ventas);}).concat([x.sinDato?null:(x.exenta?(isFinite(Number(x.datos.ppmBase))?Number(x.datos.ppmBase):null):Math.round(pesos(txt('res-debito'))/tasa))]);
    C=filas.map(function(f){return f.credito!=null?Math.round(f.credito/tasa):null;}).concat([x.sinDato||x.exenta?null:Math.round(pesos(txt('res-credito'))/tasa)]);
    fuente='Fuente: F29 validado por Contable (neto estimado desde el IVA ÷ 0,19) y, en el mes en curso, esta pantalla (proyectado al cierre). Con la conexión al SII se usará el RCV.';
  }
  if(!cambio('tend',[V,C,x.P.db]))return;
  var meses=prev.map(etiquetaMes).concat([etiquetaMes(per)]);
  var series=[{nombre:'Ventas netas',grad:'pgL',borde:'#E39BE5',v:V,etqActual:'a la fecha'}];
  if(!x.exenta||C.some(function(v){return v!=null;}))series.push({nombre:'Compras netas',grad:'pgC',borde:'#9FDBFF',v:C});
  gEl.innerHTML='<div class="pio-ley"><span><i class="l"></i>Ventas netas</span>'+(series[1]?'<span><i class="c"></i>Compras netas</span>':'')+'</div>'+svgBarras(meses,series,null);
  var T=window.PreIvaRecos, tv=T&&T.tendencia(V.slice(0,-1),V[V.length-1]), tc=T&&T.tendencia(C.slice(0,-1),C[C.length-1]);
  pon('pio-tend-res',[tv?'Ventas '+pct(tv.var)+' vs promedio':'', tc?'Compras '+pct(tc.var)+' vs promedio':''].filter(Boolean).join(' · ')||'Faltan meses con dato para comparar');
  pon('pio-tend-fuente',fuente);
}

/* ── Documentos del período ── */
function pintarDocs(x){
  var tabla=$('pio-docs-tabla');if(!tabla)return;
  var D=S.D, docs=D&&D.docs, libro=S.libro, hoy=hoyIso(), R=window.PreIvaRecos;
  oculto($('pio-docs-acuse'),libro!=='compras');
  if(!D){if(cambio('docs','c')){tabla.innerHTML='<p class="nota">Cargando documentos del SII…</p>';pon('pio-docs-tot','');}return;}
  var lista=(docs&&docs.actual&&docs.actual[libro])||[], res=((docs&&docs.resumen&&docs.resumen[x.P.db])||{})[libro]||{};
  pon('pio-n-ventas',String(((docs&&docs.actual&&docs.actual.ventas)||[]).length));pon('pio-n-compras',String(((docs&&docs.actual&&docs.actual.compras)||[]).length));
  if(!cambio('docs',[S.key,libro,S.q,S.tipo,S.acuse,S.lim,lista.length,docs&&docs.disponible,hoy]))return;
  pon('pio-docs-fuente',docs&&docs.consultaAt?'RCV del SII · consulta del '+fDMH(docs.consultaAt):'RCV del SII');
  // Opciones de tipo
  var sel=$('pio-docs-tipo'), tipos={};lista.forEach(function(d){tipos[d.tipo_dte]=d.label;});Object.keys(res).forEach(function(k){if(!tipos[k])tipos[k]=res[k].label||('Tipo '+k);});
  if(sel){var cur=S.tipo;sel.innerHTML='<option value="">Todos los tipos</option>'+Object.keys(tipos).sort(function(a,b){return a-b;}).map(function(k){return '<option value="'+esc(k)+'"'+(String(cur)===k?' selected':'')+'>'+esc(k+' · '+tipos[k])+'</option>';}).join('');}
  var tot=$('pio-docs-tot');
  if(!docs||docs.error){tabla.innerHTML='<div class="aviso gris">'+icono('alerta')+'<span>No se pudieron leer los documentos del SII'+(docs&&docs.error?': '+esc(docs.error):'')+'.</span></div>';if(tot)tot.innerHTML='';return;}
  if(!docs.disponible){tabla.innerHTML='<div class="aviso gris pio-vacio">'+icono('contable')+'<span>'+(S.D.sii&&S.D.sii.estado==='pendiente'?'<b>Disponible cuando se active la conexión con el SII.</b> Por ahora no hay documentos del SII para este período.':'<b>Sin documentos del SII para este período.</b> Actualiza desde el SII para traer el RCV.')+'</span></div>';if(tot)tot.innerHTML='';return;}
  // Estado de acuse (compras)
  var filas=lista.map(function(d){return {d:d,a:libro==='compras'&&R?R.estadoAcuse(d,hoy):null};});
  var q=S.q.toLowerCase();
  filas=filas.filter(function(f){var d=f.d;
    if(S.tipo&&String(d.tipo_dte)!==String(S.tipo))return false;
    if(libro==='compras'&&S.acuse&&(!f.a||f.a.estado!==S.acuse))return false;
    return !q||(d.folio+' '+d.rut+' '+d.razon).toLowerCase().indexOf(q)>=0;});
  // Totales por tipo (las notas de crédito restan); tipos solo con totales del SII (boletas, comprobantes de pago)
  var porTipo={};
  lista.forEach(function(d){var s=+d.tipo_dte===61?-1:1, t=porTipo[d.tipo_dte]=porTipo[d.tipo_dte]||{label:d.label,n:0,neto:0,exento:0,iva:0,total:0};
    t.n++;t.neto+=s*d.neto;t.exento+=s*d.exento;t.iva+=s*d.iva;t.total+=s*d.total;});
  Object.keys(res).forEach(function(k){if(porTipo[k])return;var x2=res[k], s=+k===61?-1:1;porTipo[k]={label:x2.label||('Tipo '+k),n:x2.n,neto:s*(x2.neto||0),exento:s*(x2.exento||0),iva:x2.iva!=null?s*x2.iva:null,total:s*x2.total,soloRes:true};});
  var T={n:0,neto:0,exento:0,iva:0,total:0};
  var th='<table class="pio-t"><thead><tr><th>Tipo</th><th class="num">Docs</th><th class="num">Neto</th><th class="num">Exento</th><th class="num">IVA</th><th class="num">Total</th></tr></thead><tbody>'
    +Object.keys(porTipo).sort(function(a,b){return a-b;}).map(function(k){var t=porTipo[k];T.n+=t.n;T.neto+=t.neto;T.exento+=t.exento;T.iva+=t.iva||0;T.total+=t.total;
      return '<tr><td>'+esc(k+' · '+t.label)+(t.soloRes?' <small class="t3">(solo totales del SII)</small>':'')+(VOUCHER.indexOf(+k)>=0?' <small class="t3">(comprobante de pago)</small>':'')+'</td><td class="num">'+t.n+'</td><td class="num">'+clp(t.neto)+'</td><td class="num">'+clp(t.exento)+'</td><td class="num">'+(t.iva==null?'<span class="nd">No disponible</span>':clp(t.iva))+'</td><td class="num">'+clp(t.total)+'</td></tr>';}).join('')
    +'</tbody><tfoot><tr><td>Total del libro</td><td class="num">'+T.n+'</td><td class="num">'+clp(T.neto)+'</td><td class="num">'+clp(T.exento)+'</td><td class="num">'+clp(T.iva)+'</td><td class="num">'+clp(T.total)+'</td></tr></tfoot></table>';
  if(tot)tot.innerHTML='<div class="pio-tbox">'+th+'</div>';
  if(!filas.length){tabla.innerHTML='<p class="nota">Sin documentos que calcen con la búsqueda o el filtro.</p>';return;}
  var ver=filas.slice(0,S.lim);
  var ACU={pendiente:['ambar','Pendiente'],aceptada:['verde','Aceptada'],tacita:['verde','Aceptada (plazo vencido)'],reclamada:['rojo','Reclamada'],sin_dato:['gris','Sin dato']};
  tabla.innerHTML='<div class="pio-tbox"><table class="pio-t pio-t-docs"><thead><tr><th>Tipo</th><th>Folio</th><th>Contraparte</th><th>Fecha</th><th class="num">Neto</th><th class="num">Exento</th><th class="num">IVA</th><th class="num">Total</th>'+(libro==='compras'?'<th>Acuse</th>':'')+'</tr></thead><tbody>'
    +ver.map(function(f){var d=f.d, s=+d.tipo_dte===61?-1:1, a=f.a&&ACU[f.a.estado];
      return '<tr'+(s<0?' class="nc"':'')+'><td>'+esc(d.tipo_dte)+' <small class="t3">'+esc(d.label)+'</small></td><td>'+esc(d.folio)+'</td><td><b>'+esc(d.razon||'—')+'</b><small class="t3">'+esc(d.rut)+'</small></td><td>'+esc(fDM(d.fecha)||'—')+'</td>'
        +'<td class="num">'+clp(s*d.neto)+'</td><td class="num">'+clp(s*d.exento)+'</td><td class="num">'+clp(s*d.iva)+'</td><td class="num">'+clp(s*d.total)+'</td>'
        +(libro==='compras'?'<td>'+(a?'<span class="estado '+a[0]+'">'+esc(a[1])+(f.a.estado==='pendiente'?' · '+f.a.quedan+' día'+(f.a.quedan===1?'':'s'):'')+'</span>'+(f.a.vence?'<small class="t3">plazo '+esc(fDM(f.a.vence))+'</small>':''):'')+'</td>':'')+'</tr>';}).join('')
    +'</tbody></table></div>'+(filas.length>ver.length?'<button type="button" class="btn sec chico pio-mas" id="pio-docs-mas">Mostrar '+Math.min(CFG.filasDocs,filas.length-ver.length)+' más (de '+filas.length+')</button>':'')
    +(docs.truncado?'<p class="nota">⚠ Hay más documentos de los que se pueden leer de una vez: se muestran los primeros.</p>':'');
}

var pend=false;
function programar(){
  if(pend)return;pend=true;
  (window.requestAnimationFrame||function(f){return setTimeout(f,16);})(function(){pend=false;try{pintar();}catch(e){if(window.console)console.warn('[Pre-IVA vista]',e);}});
}
function iniciar(){
  if(window.PIO_DEMO){var dm=$('pioDemo');if(dm)dm.hidden=false;}
  if(window.MutationObserver){
    var mo=new MutationObserver(programar);
    ['res-f29','res-ppm','res-debito','res-credito','res-remanente','kpi-remanente','kpi-var','estado-guardado','cliente-sel-nombre','lbl-remanente-fuente','aviso-entradas']
      .forEach(function(id){var e=$(id);if(e)mo.observe(e,{childList:true,characterData:true,subtree:true,attributes:true});});
    var ps=$('panel-simulacion');if(ps)mo.observe(ps,{attributes:true,attributeFilter:['style']});   // solo cuando se muestra u oculta
  }
  document.addEventListener('input',function(e){if(e.target&&e.target.id==='pio-docs-q'){S.q=e.target.value.trim();S.lim=CFG.filasDocs;}programar();},true);
  document.addEventListener('change',function(e){var t=e.target;if(t&&t.id==='pio-docs-tipo'){S.tipo=t.value;S.lim=CFG.filasDocs;}if(t&&t.id==='pio-docs-acuse'){S.acuse=t.value;S.lim=CFG.filasDocs;}programar();},true);
  document.addEventListener('click',function(e){
    var tab=e.target.closest&&e.target.closest('.pio-tabs [data-libro]');
    if(tab){S.libro=tab.getAttribute('data-libro');S.tipo='';S.acuse='';S.lim=CFG.filasDocs;var a=$('pio-docs-acuse');if(a)a.value='';
      document.querySelectorAll('.pio-tabs [data-libro]').forEach(function(b){var on=b===tab;b.classList.toggle('on',on);b.setAttribute('aria-selected',on?'true':'false');});}
    if(e.target.closest&&e.target.closest('#pio-docs-mas'))S.lim+=CFG.filasDocs;
    if(e.target.closest&&e.target.closest('#pio-sii-btn'))actualizarSii();
    programar();
  },true);
  programar();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();
