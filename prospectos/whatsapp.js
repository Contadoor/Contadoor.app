/* ============================================================
   prospectos/whatsapp.js — Botón "WhatsApp" de Prospectos (lista, ficha y bitácora)
   · Abre https://wa.me/<número>?text=<mensaje> en una pestaña nueva (target=_blank, rel=noopener).
     No envía nada por su cuenta: el mensaje se manda desde el WhatsApp de quien presiona.
   · Número desde el teléfono del lead, normalizado a formato Chile sin '+':
       11 dígitos que parten en 56 → tal cual · 9 dígitos que parten en 9 → se antepone 56
       8 dígitos → NO se adivina: botón deshabilitado ("le faltan dígitos") · cualquier otro → deshabilitado.
   · Menú pequeño para elegir el mensaje (editable antes de abrir).
   · No registra nada en la bitácora: aún no existe una función de la base pensada para eso.
   ============================================================ */
(function(root){
'use strict';

var VERDE='#25D366';
var AVISO_CORTO='Revisa el teléfono: le faltan dígitos';
var AVISO_FORMATO='Revisa el teléfono: el formato no es válido';
var AVISO_VACIO='Sin teléfono registrado';

var PLANTILLAS=[
  {k:'propuesta',t:'Propuesta enviada',m:'Hola {nombre} 👋 Soy Luciano de Contadoor. Te dejé en tu correo la propuesta para {empresa}. ¿Pudiste revisarla? Cualquier duda, conversemos por aquí.'},
  {k:'reunion',t:'Después de la reunión',m:'Hola {nombre} 👋 Soy Luciano de Contadoor. Gracias por la reunión de hoy. Te escribo por aquí para que tengas mi contacto directo.'},
  {k:'libre',t:'Libre',m:'Hola {nombre} 👋 Soy Luciano de Contadoor.'}
];

// ── Normalización del teléfono (formato Chile, sin '+') ──
function normalizar(tel){
  var s=String(tel==null?'':tel).trim();
  if(!s)return {ok:false,motivo:'vacio',aviso:AVISO_VACIO};
  s=s.replace(/[\s\-()]/g,'');
  if(s.charAt(0)==='+')s=s.slice(1);
  if(!/^\d+$/.test(s))return {ok:false,motivo:'formato',aviso:AVISO_FORMATO};
  if(s.length===11&&s.slice(0,2)==='56')return {ok:true,numero:s};
  if(s.length===9&&s.charAt(0)==='9')return {ok:true,numero:'56'+s};
  if(s.length===8)return {ok:false,motivo:'corto',aviso:AVISO_CORTO};
  return {ok:false,motivo:'formato',aviso:AVISO_FORMATO};
}
// "56912345678" → "+56 9 1234 5678" (solo para mostrar).
function mostrarNumero(n){
  n=String(n||'');
  return n.length===11?'+'+n.slice(0,2)+' '+n.slice(2,3)+' '+n.slice(3,7)+' '+n.slice(7):'+'+n;
}

// ── Armado del mensaje ──
function primerNombre(nombre){
  var p=String(nombre==null?'':nombre).trim().split(/\s+/)[0]||'';
  // "CAMILA" o "camila" → "Camila"; si ya viene con mayúsculas mixtas, se respeta.
  if(p&&(p===p.toUpperCase()||p===p.toLowerCase()))p=p.charAt(0).toUpperCase()+p.slice(1).toLowerCase();
  return p;
}
function empresaTexto(empresa){
  var e=String(empresa==null?'':empresa).trim();
  if(!e||/^a[uú]n no tiene\.?$/i.test(e))return 'tu empresa';
  return e;
}
function armar(clave,lead){
  lead=lead||{};
  var pl=PLANTILLAS.filter(function(x){return x.k===clave;})[0]||PLANTILLAS[PLANTILLAS.length-1];
  var nom=primerNombre(lead.nombre);
  var txt=pl.m.replace('{empresa}',empresaTexto(lead.empresa));
  // Sin nombre: "Hola 👋 …" (sin doble espacio).
  return nom?txt.replace('{nombre}',nom):txt.replace('Hola {nombre} ','Hola ').replace('{nombre}','');
}
function url(numero,texto){
  return 'https://wa.me/'+encodeURIComponent(String(numero||''))+(texto?'?text='+encodeURIComponent(texto):'');
}

// ── Interfaz (solo en el navegador) ──
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
// Globo de conversación con auricular (línea, estilo Lucide), en verde WhatsApp.
var SVG='<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
  +'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M14.05 14.5a1 1 0 0 0 .9-.3l.4-.5a1.2 1.2 0 0 1 .95-.45h1.2a.9.9 0 0 1 .9.9v1.2a.9.9 0 0 1-.9.9A7.6 7.6 0 0 1 8.3 7.5a.9.9 0 0 1 .9-.9h1.2a.9.9 0 0 1 .9.9v1.2a1.2 1.2 0 0 1-.45.95l-.5.4a1 1 0 0 0-.3.9 6 6 0 0 0 3.95 3.55"/></svg>';
function icono(){return '<i class="ic ic-wa">'+SVG+'</i>';}

var CSS='.wa-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:0 12px;border-radius:999px;border:1.5px solid rgba(37,211,102,.55);'
  +'background:rgba(37,211,102,.1);color:#B8F5CF;font:700 12.5px var(--g-texto,Inter,system-ui,sans-serif);cursor:pointer;white-space:nowrap;text-decoration:none;transition:background .15s,border-color .15s}'
  +'.wa-btn:hover{background:rgba(37,211,102,.2);border-color:'+VERDE+'}.wa-btn:focus-visible{outline:2px solid '+VERDE+';outline-offset:2px}'
  +'.wa-btn .ic-wa{display:inline-grid;place-items:center;color:'+VERDE+';font-style:normal}.wa-btn .g-ic{width:16px;height:16px}'
  +'.wa-btn:disabled{opacity:.5;cursor:not-allowed;background:rgba(255,255,255,.04);border-color:#4A2B50;color:#C9A8CC}.wa-btn:disabled .ic-wa{color:#8F6F94}'
  +'.wa-btn.mini{min-height:32px;width:32px;padding:0;flex:0 0 auto}'
  +'.wa-campo{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.wa-aviso{display:block;font-size:11.5px;color:#FFC85A;margin-top:4px}'
  +'.wa-velo{position:fixed;inset:0;z-index:90;background:rgba(5,2,8,.45)}'
  +'.wa-menu{box-sizing:border-box;position:fixed;z-index:91;max-height:calc(100vh - 24px);overflow-y:auto;width:min(380px,calc(100vw - 32px));background:#1C0E21;border:1px solid #4A2B50;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.55);padding:16px;color:#F3E9F4;font:500 13px var(--g-texto,Inter,system-ui,sans-serif)}'
  +'.wa-menu h2{display:flex;align-items:center;gap:8px;font:800 15px var(--g-titulo,Montserrat,system-ui,sans-serif);margin:0 0 2px;color:#F3E9F4}'
  +'.wa-menu h2 .ic-wa{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:10px;background:rgba(37,211,102,.16);color:'+VERDE+'}.wa-menu h2 .g-ic{width:17px;height:17px}'
  +'.wa-menu .wa-num{margin:0 0 12px 38px;color:#C9A8CC;font-size:12px;font-variant-numeric:tabular-nums}'
  +'.wa-ops{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}'
  +'.wa-ops button{min-height:34px;padding:0 12px;border-radius:999px;border:1px solid #4A2B50;background:transparent;color:#C9A8CC;font:700 12px var(--g-texto,Inter,system-ui,sans-serif);cursor:pointer}'
  +'.wa-ops button[aria-pressed="true"]{background:rgba(37,211,102,.16);border-color:'+VERDE+';color:#B8F5CF}'
  +'.wa-menu label{display:block;font:700 10px var(--g-texto,Inter,system-ui,sans-serif);letter-spacing:1px;text-transform:uppercase;color:#C9A8CC;margin-bottom:4px}'
  +'.wa-menu textarea{width:100%;box-sizing:border-box;min-height:110px;resize:vertical;padding:10px 12px;border-radius:12px;border:1px solid #4A2B50;background:#12080f;color:#F3E9F4;font:500 14px/1.45 var(--g-texto,Inter,system-ui,sans-serif)}'
  +'.wa-menu textarea:focus{outline:none;border-color:'+VERDE+';box-shadow:0 0 0 3px rgba(37,211,102,.18)}'
  +'.wa-pie{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}'
  +'.wa-pie button,.wa-pie a{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 16px;border-radius:999px;font:700 13px var(--g-texto,Inter,system-ui,sans-serif);cursor:pointer;text-decoration:none}'
  +'.wa-pie button{border:1px solid #4A2B50;background:transparent;color:#C9A8CC}'
  +'.wa-pie a{border:0;background:linear-gradient(160deg,#2FD872,#1DA851);color:#06210F}.wa-pie a .g-ic{width:16px;height:16px}'
  +'.wa-pie a[aria-disabled="true"]{opacity:.45;pointer-events:none}'
  +'.wa-nota{margin:8px 0 0;color:#8F6F94;font-size:11.5px}'
  +'@media(max-width:600px){#waSlot .wa-btn{width:34px;padding:0}#waSlot .wa-lbl{display:none}.wa-menu{left:0!important;right:0;bottom:0;top:auto!important;width:100%;border-radius:20px 20px 0 0;padding:18px 16px calc(16px + env(safe-area-inset-bottom))}'
  +'.wa-pie a,.wa-pie button{flex:1;justify-content:center;min-height:46px}.wa-menu textarea{font-size:16px}}';
function asegurarCss(){
  if(document.getElementById('wa-css'))return;
  var s=document.createElement('style');s.id='wa-css';s.textContent=CSS;document.head.appendChild(s);
}

// HTML del botón. opts.mini = solo ícono (lista); opts.aviso = muestra el aviso en texto bajo el botón (ficha).
function boton(lead,opts){
  opts=opts||{};lead=lead||{};
  var n=normalizar(lead.tel);
  var datos=' data-wa-nombre="'+esc(lead.nombre||'')+'" data-wa-empresa="'+esc(lead.empresa||'')+'"';
  if(n.ok){
    var et='WhatsApp a '+(primerNombre(lead.nombre)||'este prospecto');
    return '<button type="button" class="wa-btn'+(opts.mini?' mini':'')+'" data-wa="'+esc(n.numero)+'"'+datos+' title="'+esc(et)+'" aria-label="'+esc(et)+'" aria-haspopup="dialog">'
      +icono()+(opts.mini?'':'<span class="wa-lbl">WhatsApp</span>')+'</button>';
  }
  var b='<button type="button" class="wa-btn'+(opts.mini?' mini':'')+'" disabled aria-disabled="true" title="'+esc(n.aviso)+'" aria-label="WhatsApp no disponible: '+esc(n.aviso)+'">'
    +icono()+(opts.mini?'':'<span class="wa-lbl">WhatsApp</span>')+'</button>';
  return opts.aviso?'<span class="wa-campo">'+b+'<small class="wa-aviso" role="note">'+esc(n.aviso)+'</small></span>':b;
}

var abierto=null;
function cerrarMenu(){
  if(!abierto)return;
  var a=abierto;abierto=null;
  a.velo.remove();a.menu.remove();
  document.removeEventListener('keydown',a.tecla,true);
  try{a.origen.focus();}catch(e){}
}
function abrirMenu(btn){
  asegurarCss();cerrarMenu();
  var lead={nombre:btn.getAttribute('data-wa-nombre'),empresa:btn.getAttribute('data-wa-empresa')},numero=btn.getAttribute('data-wa');
  var nom=primerNombre(lead.nombre);
  var velo=document.createElement('div');velo.className='wa-velo';
  var menu=document.createElement('div');menu.className='wa-menu';menu.setAttribute('role','dialog');menu.setAttribute('aria-modal','true');menu.setAttribute('aria-labelledby','wa-tit');
  menu.innerHTML='<h2 id="wa-tit">'+icono()+'WhatsApp'+(nom?' a '+esc(nom):'')+'</h2><p class="wa-num">'+esc(mostrarNumero(numero))+'</p>'
    +'<div class="wa-ops" role="group" aria-label="Mensaje">'+PLANTILLAS.map(function(p,i){return '<button type="button" data-k="'+p.k+'" aria-pressed="'+(i===0)+'">'+esc(p.t)+'</button>';}).join('')+'</div>'
    +'<label for="wa-txt">Mensaje (puedes editarlo)</label><textarea id="wa-txt" maxlength="1500"></textarea>'
    +'<div class="wa-pie"><button type="button" class="wa-can">Cancelar</button><a class="wa-ir" target="_blank" rel="noopener">'+SVG+'Abrir WhatsApp</a></div>'
    +'<p class="wa-nota">Se abre tu WhatsApp con el mensaje listo; tú decides si lo envías.</p>';
  document.body.appendChild(velo);document.body.appendChild(menu);
  var txt=menu.querySelector('#wa-txt'),ir=menu.querySelector('.wa-ir');
  function actualizar(){
    var v=txt.value.trim();
    ir.href=url(numero,v);
    ir.setAttribute('aria-disabled',v?'false':'true');
  }
  function elegir(k){
    menu.querySelectorAll('.wa-ops button').forEach(function(b){b.setAttribute('aria-pressed',String(b.getAttribute('data-k')===k));});
    txt.value=armar(k,lead);actualizar();
  }
  menu.querySelectorAll('.wa-ops button').forEach(function(b){b.onclick=function(){elegir(b.getAttribute('data-k'));};});
  txt.addEventListener('input',actualizar);
  menu.querySelector('.wa-can').onclick=cerrarMenu;
  velo.onclick=cerrarMenu;
  ir.addEventListener('click',function(){setTimeout(cerrarMenu,0);});
  elegir(PLANTILLAS[0].k);
  // Posición: junto al botón en escritorio (hoja inferior en celular, por CSS).
  if(window.innerWidth>600){
    var r=btn.getBoundingClientRect(),h=menu.offsetHeight,w=menu.offsetWidth;
    var top=r.bottom+8;if(top+h>window.innerHeight-12)top=Math.max(12,r.top-h-8);
    var left=Math.min(Math.max(12,r.left),window.innerWidth-w-12);
    menu.style.top=top+'px';menu.style.left=left+'px';
  }
  var tecla=function(e){
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cerrarMenu();return;}
    if(e.key==='Tab'){var f=menu.querySelectorAll('button,textarea,a[href]'),a=f[0],z=f[f.length-1];
      if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}}
  };
  document.addEventListener('keydown',tecla,true);
  abierto={velo:velo,menu:menu,tecla:tecla,origen:btn};
  menu.querySelector('.wa-ops button').focus();
}

// Un solo manejador para todos los botones (las listas se repintan).
if(typeof document!=='undefined'){
  asegurarCss();
  document.addEventListener('click',function(e){
    var b=e.target&&e.target.closest?e.target.closest('button[data-wa]'):null;
    if(!b||b.disabled)return;
    e.preventDefault();e.stopPropagation();
    abrirMenu(b);
  },true);
}

root.ProsWA={PLANTILLAS:PLANTILLAS,normalizar:normalizar,mostrarNumero:mostrarNumero,primerNombre:primerNombre,empresaTexto:empresaTexto,
  armar:armar,url:url,boton:boton,icono:icono,abrirMenu:abrirMenu,cerrarMenu:cerrarMenu,AVISO_CORTO:AVISO_CORTO};
})(typeof window!=='undefined'?window:globalThis);
