/* ============================================================
   assets/equipo.js — Responsables con FOTO (componente común de Gestoor)
   Regla de Luciano (22-oct): siempre que se muestre un responsable (analista) va su foto; si no hay foto,
   sus iniciales en un círculo con el color de la marca. Toda cartera se puede filtrar por responsable.

   Mismo mecanismo que el Dashboard ("Avance del equipo", index.html): la foto es assets/equipo/<slug>.jpg,
   donde <slug> es el nombre en minúsculas, sin tildes y con guiones (por ejemplo "Catalina Armingol" → catalina-armingol).
   FOTOS es la ÚNICA lista de fotos disponibles: al agregar una foto nueva en assets/equipo/, agregar aquí su slug.
   Solo se pide la imagen si el slug está en la lista (sin errores 404 en la consola); si aun así falla, quedan las iniciales.

   API (window.GEquipo):
     avatar(nombre, {tam})          → <span class="geq-av"> con foto o iniciales (alt = nombre)
     celda(nombre)                  → avatar + nombre (o "Sin asignar")
     clave(nombre, usuarioId)       → clave estable para filtrar y para ?resp= (id del usuario; si no hay, slug del nombre)
     opciones(filas, cuenta)        → [{clave, nombre, n}] de los responsables presentes (más "Sin asignar" si corresponde)
     filtroHtml(opts, actual, n)    → chips con foto (escritorio) + selector compacto (celular)
     leerUrl() / escribirUrl(params, clave)
   Los eventos los maneja cada página: clic en [data-resp] y cambio en select.geq-sel-in.
   ============================================================ */
(function(){
'use strict';
var FOTOS=['catalina-armingol','daniela-caceres','diego-moya','fernanda-montero','gabriela-moreno','leandro-sanchez',
  'leticia-romero','luciano-duarte','mauro-pizarro','viviana-garcia'];
// Carpeta de fotos resuelta desde la ubicación de este archivo (sirve igual en /pir/, /pre-iva/ o la raíz)
var BASE=(function(){try{var s=document.currentScript&&document.currentScript.src;return s?new URL('equipo/',s).href:'assets/equipo/';}catch(e){return 'assets/equipo/';}})();
var EXTRA={};   // slug → URL (solo lo usa el modo demo local para una foto genérica; nunca fotos reales)
var SIN='sin', TODOS='todos';

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function limpio(n){return String(n==null?'':n).replace(/\s+/g,' ').trim();}
function slug(n){return limpio(n).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
// Iniciales: primera letra del primer y del último nombre ("Ana María Pérez" → AP; "Analista Demo B" → AB)
function iniciales(n){var p=limpio(n).split(' ').filter(Boolean);if(!p.length)return '?';var a=p[0].charAt(0), b=p.length>1?p[p.length-1].charAt(0):'';return (a+b).toUpperCase();}
function foto(n){
  var s=slug(n);if(!s)return null;
  if(EXTRA[s])return EXTRA[s];
  if(FOTOS.indexOf(s)>=0)return BASE+s+'.jpg';
  // Nombre con segundo apellido o segundo nombre: se prueba "primer nombre + primer apellido"
  var p=s.split('-');
  if(p.length>2){var c1=p[0]+'-'+p[1], c2=p[0]+'-'+p[p.length-2];if(FOTOS.indexOf(c1)>=0)return BASE+c1+'.jpg';if(FOTOS.indexOf(c2)>=0)return BASE+c2+'.jpg';}
  return null;
}
function avatar(nombre,o){
  o=o||{};var n=limpio(nombre), tam=o.tam?' geq-'+o.tam:'';
  if(!n)return '<span class="geq-av geq-sin'+tam+'" role="img" aria-label="Sin asignar">?</span>';
  var url=foto(n), ini=iniciales(n);
  if(!url)return '<span class="geq-av'+tam+'" role="img" aria-label="'+esc(n)+'" data-ini="'+esc(ini)+'">'+esc(ini)+'</span>';
  return '<span class="geq-av'+tam+'" data-ini="'+esc(ini)+'"><img class="geq-img" src="'+esc(url)+'" alt="'+esc(n)+'" loading="lazy" decoding="async"></span>';
}
function celda(nombre){
  var n=limpio(nombre);
  return '<span class="geq-resp">'+avatar(n)+(n?'<span class="geq-nom">'+esc(n)+'</span>':'<span class="geq-nom nd">Sin asignar</span>')+'</span>';
}
function clave(nombre,usuarioId){
  if(usuarioId!=null&&usuarioId!==''&&isFinite(Number(usuarioId)))return 'u'+Number(usuarioId);
  var s=slug(nombre).slice(0,80).replace(/-$/,'');return s?'n-'+s:SIN;
}
/* filas: [{resp, resp_id}]; cuenta(f) → true si la fila cuenta en la vista actual (todos los filtros menos el de responsable) */
function opciones(filas,cuenta){
  var m={}, orden=[];
  (filas||[]).forEach(function(f){
    var k=clave(f.resp,f.resp_id);
    if(!m[k]){m[k]={clave:k,nombre:k===SIN?'':limpio(f.resp),n:0};orden.push(k);}
    if(!m[k].nombre&&f.resp)m[k].nombre=limpio(f.resp);
    if(!cuenta||cuenta(f))m[k].n++;
  });
  return orden.map(function(k){return m[k];}).sort(function(a,b){
    if(a.clave===SIN)return 1;if(b.clave===SIN)return -1;
    return a.nombre.localeCompare(b.nombre,'es');
  });
}
function filtroHtml(opts,actual,nTotal,etiqueta){
  etiqueta=etiqueta||'Responsable';
  var sel=null;opts.forEach(function(x){if(x.clave===actual)sel=x;});
  var chips='<div class="g-seg geq-chips" role="group" aria-label="Filtrar por '+esc(etiqueta.toLowerCase())+'">'
    +'<button type="button" class="fb'+(!sel?' on':'')+'" aria-pressed="'+!sel+'" data-resp="'+TODOS+'">Todos <b>'+nTotal+'</b></button>'
    +opts.map(function(x){var on=sel===x, nom=x.clave===SIN?'Sin asignar':(x.nombre||'Usuario sin nombre');
      return '<button type="button" class="fb geq-chip'+(on?' on':'')+(x.n?'':' cero')+'" aria-pressed="'+on+'" data-resp="'+esc(x.clave)+'" title="'+esc(nom)+': '+x.n+' cliente'+(x.n===1?'':'s')+' en esta vista">'
        +avatar(x.clave===SIN?'':x.nombre,{tam:'xs'})+'<span>'+esc(nom)+'</span> <b>'+x.n+'</b></button>';}).join('')
    +'</div>';
  var compacto='<label class="geq-sel">'+(sel?avatar(sel.clave===SIN?'':sel.nombre,{tam:'xs'}):'<span class="geq-av geq-xs geq-todos" aria-hidden="true">'+nTotal+'</span>')
    +'<span class="sr">'+esc(etiqueta)+'</span><select class="geq-sel-in" aria-label="Filtrar por '+esc(etiqueta.toLowerCase())+'">'
    +'<option value="'+TODOS+'"'+(!sel?' selected':'')+'>'+esc(etiqueta)+': todos ('+nTotal+')</option>'
    +opts.map(function(x){return '<option value="'+esc(x.clave)+'"'+(sel===x?' selected':'')+'>'+esc(x.clave===SIN?'Sin asignar':(x.nombre||'Usuario sin nombre'))+' ('+x.n+')</option>';}).join('')
    +'</select></label>';
  return '<div class="geq-filtro">'+chips+compacto+'</div>';
}
function valida(k){return typeof k==='string'&&/^(sin|u\d{1,12}|n-[a-z0-9-]{1,80})$/.test(k)?k:TODOS;}
function leerUrl(){try{return valida(new URLSearchParams(location.search).get('resp'));}catch(e){return TODOS;}}
function escribirUrl(p,k){if(k&&k!==TODOS)p.set('resp',k);else p.delete('resp');}
function pasa(f,actual){return !actual||actual===TODOS||clave(f.resp,f.resp_id)===actual;}
function nombreDe(opts,actual){var r=null;opts.forEach(function(x){if(x.clave===actual)r=x.clave===SIN?'Sin asignar':x.nombre;});return r;}

// Si una foto no carga, queda el círculo con las iniciales (sin manejadores en línea)
document.addEventListener('error',function(e){
  var t=e.target;if(!t||t.tagName!=='IMG'||!t.classList||!t.classList.contains('geq-img'))return;
  var av=t.parentNode;if(!av)return;var nom=t.getAttribute('alt')||'';
  av.textContent=av.getAttribute('data-ini')||'?';av.setAttribute('role','img');av.setAttribute('aria-label',nom);
},true);

window.GEquipo={avatar:avatar,celda:celda,clave:clave,opciones:opciones,filtroHtml:filtroHtml,leerUrl:leerUrl,escribirUrl:escribirUrl,
  pasa:pasa,nombreDe:nombreDe,valida:valida,slug:slug,iniciales:iniciales,TODOS:TODOS,SIN:SIN,
  // Solo modo demo local: registra una foto GENÉRICA para un responsable ficticio
  fotoDemo:function(nombre,url){var h=location.hostname;if(h==='localhost'||h==='127.0.0.1'||h==='[::1]')EXTRA[slug(nombre)]=url;}};
})();
