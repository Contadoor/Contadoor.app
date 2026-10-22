/* ============================================================
   pre-iva/operativa-vista.js — Pre-IVA · Pantalla 2: piezas visuales nuevas (rediseño 22-oct, misma línea que MiRenta)
   SOLO PRESENTACIÓN. No calcula el F29, no guarda, no envía y no escribe en ningún elemento que use el cálculo:
     · LEE la pantalla que ya pinta el código existente (res-*, kpi-*, inp-*) y el estado (_clienteActual, _filaPreiva,
       _datos, _editOverrides, _periodoActual), y
     · ESCRIBE solo en elementos nuevos (ids pio-*) y en clases de presentación ("No disponible", sin tasa PPM).
   El IVA a pagar se muestra con la MISMA fórmula aprobada (PreIvaF29.calcularF29Estimado, pre-iva/f29-formula.js) sobre
   los montos que ya están en pantalla, y solo si su total cuadra exactamente con el F29 mostrado; si no, "No disponible".
   Se repinta cuando cambia la pantalla (MutationObserver) o se escribe un dato; un error aquí nunca rompe el cálculo.
   ============================================================ */
(function(){
'use strict';
var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
var PLANES={cumplimiento:'Plan Cumplimiento',asesoria:'Plan Asesoría',estrategico:'Plan Estratégico'};
function $(id){return document.getElementById(id);}
function txt(id){var e=$(id);return e?e.textContent:'';}
function val(id){var e=$(id);return e?String(e.value==null?'':e.value).trim():'';}
function pesos(t){return parseInt(String(t==null?'':t).replace(/[^0-9]/g,''),10)||0;}
function miles(n){return Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
function clp(n){return (n==null||!isFinite(n))?'No disponible':'$'+miles(n);}
function pon(id,t){var e=$(id);if(e&&e.textContent!==t)e.textContent=t;}
function clase(el,c,on){if(el)el.classList.toggle(c,!!on);}
function fCorta(iso){try{var d=new Date(iso);if(isNaN(d.getTime()))return '';return ('0'+d.getDate()).slice(-2)+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+d.getFullYear();}catch(e){return '';}}
function g(n){return typeof window[n]==='undefined'?undefined:window[n];}
function icono(n){return window.gIcon?window.gIcon(n):'';}

// Período abierto: 'AAAAMM' → datos para los textos
function periodo(){
  var p=String(g('_periodoActual')||''), y=parseInt(p.slice(0,4),10), m=parseInt(p.slice(4,6),10);
  if(!(y>2000)||!(m>=1&&m<=12))return null;
  var hoy=new Date(), vm=m===12?1:m+1, vy=m===12?y+1:y, am=m===1?12:m-1, ay=m===1?y-1:y;
  return {y:y,m:m,txt:MESES[m-1].charAt(0).toUpperCase()+MESES[m-1].slice(1)+' '+y,
    venc:'20 de '+MESES[vm-1]+(vy!==y?' '+vy:''), anterior:MESES[am-1]+' '+ay,
    actual:hoy.getFullYear()===y&&hoy.getMonth()+1===m};
}

// Chip de aviso (se crea una vez dentro de #pio-chips; texto con textContent)
function chip(id,cls,ic,texto){
  var cont=$('pio-chips');if(!cont)return;
  var el=$(id);
  if(!texto){if(el)el.hidden=true;return;}
  if(!el){el=document.createElement('span');el.id=id;el.innerHTML=icono(ic)+'<span></span>';cont.appendChild(el);}
  el.className='chip '+cls;el.hidden=false;
  var s=el.querySelector('span:last-child');if(s&&s.textContent!==texto)s.textContent=texto;
}

function pintar(){
  var c=g('_clienteActual');if(!c)return;
  var P=periodo(), datos=g('_datos')||{}, ov=g('_editOverrides')||{}, fila=g('_filaPreiva');

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
    est.className='estado '+e[0];pon('pio-estado',e[1]);pon('pio-estado-sub',sub);
  }
  var fu=$('pio-fuente');
  if(fu){var sii=!!(fila&&fila.fuente==='SII');fu.className='estado '+(sii?'cel':'gris');pon('pio-fuente',sii?'SII automático':'Manual');}

  // ── "No disponible" nunca $0: sin débito ni crédito escritos, o con montos inválidos ──
  var errores=(datos.erroresEntrada||[]).length>0;
  var sinDato=(val('inp-debito')===''&&val('inp-credito')==='')||errores;
  clase($('pio-kpis'),'pio-sin-dato',sinDato);clase($('pio-liq'),'pio-sin-dato',sinDato);
  pon('pio-hero-nd',errores?'Corrige los montos marcados en rojo en "Datos del mes".':'Carga los libros o escribe el débito y el crédito del mes.');
  var tasa=parseFloat(val('inp-tasa-ppm'))||0, sinTasa=!sinDato&&!(tasa>0);
  clase($('pio-kpi-ppm'),'sin-tasa',sinTasa);clase($('pio-fila-ppm'),'sin-tasa',sinTasa);
  pon('pio-ppm-nd',sinTasa?'Falta la tasa PPM':'Sin datos del mes');

  // ── IVA a pagar: misma fórmula aprobada, sobre los montos de la pantalla, y solo si cuadra con el F29 mostrado ──
  var iva='No disponible';
  if(window.PreIvaF29){
    var rr=window.PreIvaF29.calcularF29Estimado({debito:pesos(txt('res-debito')),credito:pesos(txt('res-credito')),remanente:pesos(txt('res-remanente')),ppm:pesos(txt('res-ppm'))});
    if(rr.total===pesos(txt('res-f29')))iva=clp(rr.ivaPagar);
  }
  pon('pio-kpi-iva',iva);pon('pio-liq-iva',iva);

  // ── Base del PPM (lo que ya calculó la pantalla) ──
  var base=Number(datos.ppmBase), t=Number(datos.tasaPPM);
  pon('pio-ppm-base',t>0&&isFinite(base)?'Base '+clp(base)+' (neto afecto + exento'+(P&&P.actual?', proyectada al cierre':'')+') × tasa '+String(t).replace('.',',')+' %':'Sin tasa PPM: no se suma PPM al F29');

  // ── Comparación con el mes anterior (solo si se escribió el F29 anterior) ──
  var f29Ant=parseInt(val('inp-f29-ant'),10)||0, vl=$('pio-var-linea');
  if(vl){vl.hidden=!(f29Ant>0);
    if(f29Ant>0){var v=txt('kpi-var').trim();pon('pio-var-ic',/^\+0%$|^0%$/.test(v)?'=':v.charAt(0)==='-'?'↘':'↗');pon('pio-f29-ant',clp(f29Ant));}}

  // ── Chips de aviso extra (los de PPM estimado y alcance del F29 los maneja el código existente) ──
  chip('pio-chip-tasa','ambar','alerta',sinTasa?'Falta la tasa PPM: el F29 estimado aún no incluye PPM':'');
  chip('pio-chip-rem','ambar','alerta',/no se pudo leer/i.test(txt('lbl-remanente-fuente'))?'No se pudo leer el remanente desde Contable: se usó $0':'');
  var nuevoRem=pesos(txt('kpi-remanente'));
  chip('pio-chip-nrem','verde','check',!sinDato&&nuevoRem>0?'Queda un remanente a favor de '+clp(nuevoRem)+' para el mes siguiente':'');
  var editado=['debito','credito','f29','ppm','remanente'].some(function(k){return ov[k]!==null&&ov[k]!==undefined;})||(ov.acciones&&ov.acciones.length>0)||!!(ov.obs&&String(ov.obs).trim());
  chip('pio-chip-edit','lila','lapiz',editado?'Reporte editado a mano: el correo usa lo de "Editar reporte"'+(ov.f29!=null?' (F29 '+ov.f29+')':'')+'. Revísalo en la vista previa.':'');

  // ── Avance del mes (barra con degradado) ──
  var dT=parseFloat(val('inp-dias-transc'))||0, dTot=parseFloat(val('inp-dias-tot'))||31;
  var actual=!!(P&&P.actual), pct=actual?Math.max(0,Math.min(100,Math.round(dT/dTot*100))):100;
  pon('pio-av-pct',pct+'%');pon('pio-av-det',actual?'(día '+dT+' de '+dTot+')':'· mes cerrado, libros completos');
  var bar=$('pio-av-barra'), fill=$('pio-av-fill');
  if(bar){clase(bar,'cerrado',!actual);bar.setAttribute('aria-valuenow',String(pct));}
  if(fill&&fill.style.width!==pct+'%')fill.style.width=pct+'%';
}

var pend=false;
function programar(){
  if(pend)return;pend=true;
  (window.requestAnimationFrame||function(f){return setTimeout(f,16);})(function(){pend=false;try{pintar();}catch(e){if(window.console)console.warn('[Pre-IVA vista]',e);}});
}
function iniciar(){
  if(window.MutationObserver){
    var mo=new MutationObserver(programar);
    ['res-f29','res-ppm','res-debito','res-credito','res-remanente','kpi-remanente','kpi-var','estado-guardado','cliente-sel-nombre','lbl-remanente-fuente','aviso-entradas','panel-simulacion']
      .forEach(function(id){var e=$(id);if(e)mo.observe(e,{childList:true,characterData:true,subtree:true,attributes:true});});
  }
  document.addEventListener('input',programar,true);
  document.addEventListener('change',programar,true);
  document.addEventListener('click',programar,true);
  programar();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();
