// ═══════════════════════════════════════════════════════════
// GESTOOR — CAMPANA DE NOTIFICACIONES (P0-Campana, catálogo de notificaciones §3.6)
// notifications.js — se carga en TODAS las páginas del menú (assets/gestoor-menu.js la agrega sola si la página no la trae).
// · Fuente única: RPC mis_alertas() → SOLO las alertas del usuario (destinatario = yo; la difusión a un rol se reparte al crear, una
//   fila por persona; constancias sin destinatario solo el Master). Títulos ≤ 120 y textos ≤ 300 se muestran COMPLETOS (sin recorte CSS);
//   en el historial, la línea abreviada lleva el texto completo en title. Corrige H3 (el Master veía las de todos) sin depender de la RLS.
// · Todos los módulos se muestran (H1): un módulo desconocido aparece como "Sistema"; nunca se oculta. Por módulo (Luciano 23-oct):
//   chips con contador de no leídas (solo módulos con avisos; la elección se recuerda), avisos agrupados Hoy / Ayer / Anteriores,
//   y en la página de un módulo la campana abre filtrada por él con "Ver todos".
// · Marcar = RPC alerta_marcar(id, 'leida'|'ejecutada'); sin PATCH directo a la tabla.
// · Enlaces normalizados a rutas absolutas /modulo/… (H7); cualquier otra cosa (http:, javascript:, //) se descarta.
// · V1 (localStorage) retirada: crearNotificacion() ahora solo muestra un aviso breve (toast) a quien hizo la acción.
// · Botón "Activar avisos en este celular" dentro del panel, para cualquier usuario (usa avisos-push.js).
// ═══════════════════════════════════════════════════════════
(function(){
if(window.__gestoorCampana) return;          // idempotente: la página y el menú pueden cargarla los dos
window.__gestoorCampana=true;

var BASE=(function(){                         // carpeta raíz del sitio, según dónde se cargó este archivo
  try{var s=document.currentScript&&document.currentScript.src;if(s)return s.replace(/notifications\.js(\?.*)?$/,'');}catch(e){}
  return '/';
})();

var _cache=[];        // filas de mis_alertas
var _cargando=false;
var _yaCargo=false;

// ── RPC ─────────────────────────────────────────────────────
function rpc(fn,args){
  if(typeof sbFetch!=='function') return Promise.reject(new Error('SIN_SUPABASE'));
  return sbFetch('rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||{})})
    .then(function(r){return r.json().catch(function(){return null;}).then(function(j){
      if(!r.ok) throw new Error((j&&(j.message||j.hint))||('HTTP '+r.status));
      return j;
    });});
}

// ── Enlaces: solo rutas absolutas del sitio ─────────────────
// '/facturacion/index.html?fa=1' → igual · '../reportes-contable/' → '/reportes-contable/' · 'facturacion/' → '/facturacion/'
function normEnlace(u){
  if(!u||typeof u!=='string') return null;
  u=u.trim();
  if(/^[a-z][a-z0-9+.-]*:/i.test(u)||u.indexOf('//')===0||u.indexOf('\\')>=0) return null;   // http:, javascript:, //host
  while(u.indexOf('../')===0) u=u.slice(3);
  if(u.indexOf('./')===0) u=u.slice(2);
  if(u.charAt(0)!=='/') u='/'+u;
  if(!/^\/[a-z0-9-]+\/[A-Za-z0-9._~\/?&=%#-]*$/.test(u)||u.indexOf('..')>=0||u.indexOf('//')>=0) return null;
  return u;
}

// ── Mapeo fila → UI ─────────────────────────────────────────
function mapRow(row){
  return {
    id:row.id, modulo:row.modulo||'sistema', tipo:row.tipo||'info', prioridad:row.prioridad||'media',
    clienteRut:row.cliente_rut||'', periodo:row.periodo||'', titulo:row.titulo||'', mensaje:row.descripcion||'',
    url:normEnlace(row.accion_url), pendiente:(row.estado||'pendiente')==='pendiente', leida:!!row.leida_at,
    accionRequerida:row.tipo==='accion_requerida'||row.tipo==='reapertura',
    resueltaPor:row.resuelta_por||'', resueltaTs:row.resuelta_at?new Date(row.resuelta_at).getTime():null,
    ts:row.created_at?new Date(row.created_at).getTime():Date.now(), creadaPor:row.creada_por||'', difusion:!!row.difusion
  };
}

// ── Carga ───────────────────────────────────────────────────
function cargarAlertas(){
  if(typeof sbFetch!=='function'||_cargando) return;
  _cargando=true;
  rpc('mis_alertas',{p_limite:100}).then(function(rows){
    _cargando=false; _yaCargo=true;
    _cache=(Array.isArray(rows)?rows:[]).map(mapRow);
    renderBadge(); if(panelAbierto()) renderPanel();
  }).catch(function(e){
    _cargando=false;
    if(!e||e.message!=='GESTOOR_NO_SESSION') console.warn('[Campana] No se pudieron cargar las alertas:',e&&e.message||e);
  });
}
window.gestoorCampanaRecargar=cargarAlertas;

// ── Módulos (todos visibles; desconocido = Sistema) ─────────
// Ícono de línea con color propio sobre placa con tinte suave (regla gestoor-iconos-color). ic = nombre de gIcon (assets/gestoor-menu.js);
// si la página no tiene el menú, se usa el emoji (em).
var MOD_CONFIG={
  facturacion:{label:'Facturación',   ic:'factura',    em:'📄', color:'#0E8FCF'},
  cobranza:   {label:'Cobranza',      ic:'cobranza',   em:'💳', color:'#924893'},
  trabajos:   {label:'Trabajos esp.', ic:'lista',      em:'🛠️', color:'#B7791F'},
  pagos:      {label:'Pagos',         ic:'pagos',      em:'💸', color:'#2F6FDB'},
  impuestos:  {label:'Contable',      ic:'contable',   em:'🧾', color:'#B7791F'},
  preiva:     {label:'Pre-IVA',       ic:'iva',        em:'🧮', color:'#1D9E75'},
  rrhh:       {label:'RRHH',          ic:'rrhh',       em:'👥', color:'#0F8A6A'},
  seguridad:  {label:'Seguridad',     ic:'candado',    em:'🔒', color:'#C2410C'},
  simpleapi:  {label:'SimpleAPI',     ic:'transferir', em:'🔌', color:'#0F766E'},
  mirenta:    {label:'MiRenta',       ic:'grafico',    em:'📊', color:'#7C3AED'},
  comercial:  {label:'Comercial',     ic:'objetivo',   em:'🎯', color:'#BE185D'},
  agenda:     {label:'Agenda',        ic:'calendario', em:'📅', color:'#4338CA'},
  sistema:    {label:'Sistema',       ic:'admin',      em:'⚙️', color:'#5c4a5d'}
};
var ORDEN_MOD=['facturacion','cobranza','trabajos','pagos','impuestos','preiva','rrhh','seguridad','simpleapi','mirenta','comercial','agenda','sistema'];
var ALIAS={contable:'impuestos',reportes:'impuestos',trabajos_especiales:'trabajos',te:'trabajos',prospectos:'comercial',crm:'comercial',
           asistente:'sistema',correos:'sistema',convenios:'pagos',aprobaciones:'pagos','pre-iva':'preiva',pre_iva:'preiva'};
function modKey(m){m=String(m||'sistema').toLowerCase();m=ALIAS[m]||m;return MOD_CONFIG[m]?m:'sistema';}
// Página actual → módulo (la campana abre filtrada por él).
var PAGINA_MOD={'facturacion':'facturacion','cobranza':'cobranza','trabajos-especiales':'trabajos','pagos':'pagos','reportes-pagos':'pagos',
  'convenios':'pagos','conciliacion':'pagos','reportes-contable':'impuestos','tributario-contable':'impuestos','pre-iva':'preiva',
  'reportes-rrhh':'rrhh','pir':'mirenta','prospectos':'comercial'};
function moduloDePagina(){try{var seg=(location.pathname.split('/')[1]||'').toLowerCase();return PAGINA_MOD[seg]||null;}catch(e){return null;}}
function tinte(hex,a){var h=hex.replace('#','');return 'rgba('+parseInt(h.substr(0,2),16)+','+parseInt(h.substr(2,2),16)+','+parseInt(h.substr(4,2),16)+','+a+')';}
function icono(k,tam){
  var c=MOD_CONFIG[k], svg=(typeof window.gIcon==='function')?window.gIcon(c.ic):'';
  return '<span class="not-ic" aria-hidden="true" style="width:'+tam+'px;height:'+tam+'px;background:'+tinte(c.color,.16)+';color:'+c.color+'">'+(svg||c.em)+'</span>';
}
function modCfg(m){return MOD_CONFIG[modKey(m)];}
var TIPO_CONFIG={
  accion_requerida:{label:'Acción requerida', color:'#C0392B', bg:'#fee2e2'},
  reapertura:      {label:'Acción requerida', color:'#C0392B', bg:'#fee2e2'},
  alerta:          {label:'Alerta',           color:'#C07A1A', bg:'#fef3c7'},
  info:            {label:'Info',             color:'#5c4a5d', bg:'#f0ebff'}
};

function pendientes(mod){return _cache.filter(function(n){return n.pendiente&&(!mod||modKey(n.modulo)===mod);});}
function noLeidas(mod){return pendientes(mod).filter(function(n){return !n.leida;});}

// ── Insignia ────────────────────────────────────────────────
function renderBadge(){
  var badge=document.getElementById('notBadge');
  if(!badge) return;
  var count=pendientes().length;
  badge.textContent=count>99?'99+':count;
  badge.style.display=count>0?'flex':'none';
  var btn=document.getElementById('notBtn');
  if(btn) btn.setAttribute('aria-label',count>0?('Notificaciones: '+count+' pendiente'+(count!==1?'s':'')):'Notificaciones');
}

// ── Helpers ─────────────────────────────────────────────────
var MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function timeAgo(ts){
  if(!ts) return '';
  var diff=Math.floor((Date.now()-ts)/1000);
  if(diff<60) return 'Hace un momento';
  if(diff<3600) return 'Hace '+Math.floor(diff/60)+' min';
  if(diff<86400) return 'Hace '+Math.floor(diff/3600)+' h';
  if(diff<604800){var dd=Math.floor(diff/86400);return 'Hace '+dd+(dd===1?' día':' días');}
  var d=new Date(ts); return d.getDate()+' '+MESES[d.getMonth()];
}
function hesc(s){
  if(s===null||s===undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function notToast(msg){
  if(typeof window.toast==='function'){try{window.toast(msg);return;}catch(e){}}
  var t=document.getElementById('notToast');
  if(!t){t=document.createElement('div');t.id='notToast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');
    t.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:min(92vw,520px);background:#1a0a1b;color:#fff;padding:10px 16px;border-radius:12px;font-size:13px;line-height:1.45;z-index:9999;box-shadow:0 8px 28px rgba(0,0,0,.25);display:none';
    document.body.appendChild(t);}
  t.textContent=msg; t.style.display='block';
  clearTimeout(t._h); t._h=setTimeout(function(){t.style.display='none';},5000);
}

// ── Marcar ──────────────────────────────────────────────────
function aplicar(id,res){
  var n=_cache.find(function(x){return x.id===id;}); if(!n||!res) return;
  n.pendiente=(res.estado||'pendiente')==='pendiente'; n.leida=!!res.leida_at;
  n.resueltaPor=res.resuelta_por||n.resueltaPor; n.resueltaTs=res.resuelta_at?new Date(res.resuelta_at).getTime():n.resueltaTs;
}
window.notMarcar=function(id,accion){
  return rpc('alerta_marcar',{p_id:id,p_accion:accion}).then(function(res){
    aplicar(id,res); renderBadge(); if(panelAbierto()) renderPanel(); return res;
  }).catch(function(e){
    console.warn('[Campana] alerta_marcar',id,accion,e&&e.message||e);
    notToast('⚠️ No se pudo marcar el aviso. Revisa tu conexión e intenta de nuevo.');
  });
};
// Compatibilidad con llamadas antiguas desde otras páginas
window.ejecutarNotificacion=function(id){return window.notMarcar(id,'ejecutada');};
window.ignorarNotificacion=function(id){return window.notMarcar(id,'leida');};
window.eliminarNotificacion=function(id){return window.notMarcar(id,'leida');};
// "Marcar todas como leídas": solo las informativas (las de acción requerida se marcan una a una al ejecutarlas).
window.marcarTodasEjecutadas=function(mod){
  var ids=pendientes(mod||null).filter(function(n){return !n.accionRequerida;}).map(function(n){return n.id;});
  return Promise.all(ids.map(function(id){return rpc('alerta_marcar',{p_id:id,p_accion:'leida'}).then(function(r){aplicar(id,r);}).catch(function(){});}))
    .then(function(){renderBadge();if(panelAbierto())renderPanel();});
};
window.notIr=function(id){        // "Ver →": una informativa queda leída al abrirla
  var n=_cache.find(function(x){return x.id===id;});
  if(n&&n.pendiente&&!n.accionRequerida) rpc('alerta_marcar',{p_id:id,p_accion:'leida'}).catch(function(){});
  return true;
};

// ── V1 retirada: solo aviso breve a quien hizo la acción ────
window.crearNotificacion=function(opts){
  var o=opts||{}; var m=o.mensaje||o.titulo||''; if(m) notToast(m);
};

// ── Panel ───────────────────────────────────────────────────
function panelAbierto(){var w=document.getElementById('notPanelWrap');return !!(w&&w.classList.contains('on'));}

function tarjeta(n){
  var m=modCfg(n.modulo), t=TIPO_CONFIG[n.tipo]||TIPO_CONFIG.info, nid=JSON.stringify(n.id);
  var h='<div class="not-card" style="border-left:3px solid '+m.color+'">';
  h+='<div style="display:flex;align-items:flex-start;gap:10px">';
  h+=icono(modKey(n.modulo),32);
  h+='<div style="flex:1;min-width:0">';
  h+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">';
  h+='<span style="font-size:10px;font-weight:700;color:'+m.color+'">'+hesc(m.label)+'</span>';
  h+='<span style="font-size:10px;font-weight:700;background:'+t.bg+';color:'+t.color+';border-radius:20px;padding:2px 8px">'+t.label+'</span>';
  if(n.prioridad==='alta') h+='<span style="font-size:9px;font-weight:700;background:#fee2e2;color:#C0392B;border-radius:20px;padding:1px 7px">● Alta</span>';
  h+='<span style="font-size:10px;color:#9a849b">'+timeAgo(n.ts)+'</span>';
  if(n.periodo) h+='<span style="font-size:9px;background:#f0ebff;color:#5c4a5d;border-radius:20px;padding:1px 7px">'+hesc(n.periodo)+'</span>';
  if(n.difusion) h+='<span style="font-size:9px;background:#f4f1f4;color:#5c4a5d;border-radius:20px;padding:1px 7px">Para el equipo</span>';
  h+='</div>';
  h+='<div class="not-tit">'+hesc(n.titulo)+'</div>';
  if(n.mensaje&&n.mensaje!==n.titulo) h+='<div class="not-msg">'+hesc(n.mensaje)+'</div>';
  if(n.clienteRut) h+='<div style="font-size:10px;color:#9a849b;margin-bottom:4px">RUT '+hesc(n.clienteRut)+'</div>';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">';
  if(n.accionRequerida) h+='<button type="button" class="not-b pri" onclick="notMarcar('+nid+',\'ejecutada\')">✅ Marcar ejecutado</button>';
  else h+='<button type="button" class="not-b pri" onclick="notMarcar('+nid+',\'leida\')">✓ Marcar leída</button>';
  if(n.url) h+='<a class="not-b" href="'+hesc(n.url)+'" onclick="return notIr('+nid+')">Ver →</a>';
  if(n.accionRequerida&&n.leida) h+='<span style="font-size:10px;color:#9a849b;align-self:center">Leída · falta ejecutar</span>';
  h+='</div></div></div></div>';
  return h;
}

// Grupo por fecha local: Hoy / Ayer / Anteriores.
function grupoFecha(ts){
  var d=new Date(ts), hoy=new Date(); hoy.setHours(0,0,0,0);
  var t=new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime(), h0=hoy.getTime();
  if(t>=h0) return 'Hoy'; if(t>=h0-86400000) return 'Ayer'; return 'Anteriores';
}
var _modPagina=moduloDePagina();
var _verTodos=false;                 // en la página de un módulo: el usuario pidió "Ver todos"
var CLAVE_TAB='gestoor.campana.modulo';
function leerTab(){try{return localStorage.getItem(CLAVE_TAB)||'todos';}catch(e){return 'todos';}}
function guardarTab(t){try{localStorage.setItem(CLAVE_TAB,t);}catch(e){}}
var _activeTab=leerTab();

function renderPanel(){
  var panel=document.getElementById('notPanel');
  if(!panel) return;
  // Chips: Todos + cada módulo con avisos (orden fijo), cada uno con su contador de NO leídas.
  var mods=ORDEN_MOD.filter(function(k){return _cache.some(function(n){return modKey(n.modulo)===k;});});
  var tab=_activeTab;
  if(_modPagina&&!_verTodos&&mods.indexOf(_modPagina)>=0) tab=_modPagina;      // en la página del módulo, abre filtrada
  if(tab!=='todos'&&mods.indexOf(tab)<0) tab='todos';
  var html='';
  if(_modPagina&&tab===_modPagina&&!_verTodos){
    html+='<div class="not-filtro"><span>Mostrando avisos de <b>'+hesc(MOD_CONFIG[_modPagina].label)+'</b></span><button type="button" class="not-b" onclick="notVerTodos()">Ver todos</button></div>';
  }
  var nl=noLeidas().length;
  html+='<div class="not-chips" role="tablist" aria-label="Módulos">';
  html+='<button type="button" role="tab" aria-selected="'+(tab==='todos')+'" class="not-chip'+(tab==='todos'?' on':'')+'" onclick="notSetTab(\'todos\')">Todos'+(nl?' <span class="not-cnt">'+nl+'</span>':'')+'</button>';
  mods.forEach(function(k){
    var cfg=MOD_CONFIG[k], cnt=noLeidas(k).length, on=tab===k;
    html+='<button type="button" role="tab" aria-selected="'+on+'" class="not-chip'+(on?' on':'')+'" data-mod="'+k+'" onclick="notSetTab(\''+k+'\')"'+(on?' style="border-color:'+cfg.color+';background:'+tinte(cfg.color,.12)+';color:'+cfg.color+'"':'')+'>'
      +'<i class="not-dot" style="background:'+cfg.color+'"></i>'+cfg.label+(cnt>0?' <span class="not-cnt" style="background:'+cfg.color+'">'+cnt+'</span>':'')+'</button>';
  });
  html+='</div>';

  var lista=_cache.filter(function(n){return tab==='todos'||modKey(n.modulo)===tab;});
  var pend=lista.filter(function(n){return n.pendiente;}).sort(function(a,b){return b.ts-a.ts;});
  var hechas=lista.filter(function(n){return !n.pendiente;}).slice(0,10);
  if(pend.length>0){
    var hayInfo=pend.some(function(n){return !n.accionRequerida;});
    html+='<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">';
    html+='<div class="not-sec">'+pend.length+' pendiente'+(pend.length!==1?'s':'')+'</div>';
    if(hayInfo) html+='<button type="button" class="not-b" onclick="marcarTodasEjecutadas(\''+(tab==='todos'?'':tab)+'\')">Marcar informativas como leídas</button>';
    html+='</div>';
  }
  if(!_yaCargo&&_cache.length===0){
    html+='<div class="not-vacio">Cargando avisos…</div>';
  }else if(pend.length===0&&hechas.length===0){
    html+='<div class="not-vacio"><div aria-hidden="true" style="font-size:28px;margin-bottom:8px">🔕</div>Sin notificaciones</div>';
  }
  var grupoActual=null;
  pend.forEach(function(n){
    var g=grupoFecha(n.ts);
    if(g!==grupoActual){grupoActual=g;html+='<div class="not-fecha">'+g+'</div>';}
    html+=tarjeta(n);
  });
  if(hechas.length>0){
    html+='<div class="not-sec" style="margin:12px 0 8px;color:#9a849b">Historial reciente</div>';
    hechas.forEach(function(n){
      var m=modCfg(n.modulo);
      html+='<div class="not-hecha"><span aria-hidden="true" style="font-size:13px;color:'+m.color+';flex-shrink:0;font-weight:700">✓</span>';
      html+='<div style="flex:1;min-width:0"><div title="'+hesc(n.titulo||n.mensaje)+'" style="font-size:11.5px;color:#5c4a5d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+hesc(n.titulo||n.mensaje)+'</div>';
      html+='<div style="font-size:10px;color:#9a849b">'+(n.resueltaPor?'Marcada por '+hesc(n.resueltaPor)+' · ':'')+timeAgo(n.resueltaTs||n.ts)+'</div></div>';
      if(n.url) html+='<a class="not-b" href="'+hesc(n.url)+'">Ver →</a>';
      html+='</div>';
    });
  }
  panel.innerHTML=html;
  panel.setAttribute('data-tab',tab);
}
window.notSetTab=function(t){_activeTab=t;guardarTab(t);if(_modPagina)_verTodos=(t!==_modPagina);renderPanel();};
window.notVerTodos=function(){_verTodos=true;_activeTab='todos';guardarTab('todos');renderPanel();};

window.toggleNotPanel=function(e){
  if(e) e.stopPropagation();
  var wrap=document.getElementById('notPanelWrap');
  if(!wrap) return;
  var abrir=!wrap.classList.contains('on');
  wrap.classList.toggle('on',abrir);
  var btn=document.getElementById('notBtn'); if(btn) btn.setAttribute('aria-expanded',abrir?'true':'false');
  if(abrir){ _verTodos=false; renderPanel(); cargarAlertas(); montarAvisosCelular(); }   // cada apertura en la página de un módulo vuelve a filtrar por él
};

// ── Botón "Activar avisos en este celular" (cualquier usuario) ──
var _avisosMontado=false;
function montarAvisosCelular(){
  var btn=document.getElementById('notAvisosBtn');
  if(!btn||_avisosMontado) return;
  var montar=function(){
    if(!window.GestoorAvisosPush||_avisosMontado) return;
    _avisosMontado=true;
    window.GestoorAvisosPush.montar(btn,notToast);
  };
  if(window.GestoorAvisosPush){montar();return;}
  if(document.querySelector('script[data-gestoor-avisos-push]')) return;
  var s=document.createElement('script'); s.src=BASE+'avisos-push.js'; s.async=true; s.setAttribute('data-gestoor-avisos-push','1');
  s.onload=montar; document.head.appendChild(s);
}

// ── Inyectar la campana en el topbar ────────────────────────
function injectNotUI(){
  var topbar=document.querySelector('.topbar');
  if(!topbar) return;
  var btn=document.getElementById('notBtn');
  if(btn){ btn.onclick=window.toggleNotPanel; }        // páginas con campana propia (p. ej. Aprobaciones): se reutiliza
  else{
    btn=document.createElement('button');
    btn.type='button'; btn.id='notBtn'; btn.onclick=window.toggleNotPanel;
    btn.style.cssText='position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;border:0;padding:0;background:rgba(255,255,255,.08);transition:.15s;flex-shrink:0;';
    btn.innerHTML='<i class="ti ti-bell" style="font-size:18px;color:rgba(255,255,255,.75)"></i>'
      +'<div id="notBadge" style="display:none;position:absolute;top:2px;right:2px;min-width:16px;height:16px;background:#C0392B;border-radius:20px;font-size:9px;font-weight:700;color:#fff;align-items:center;justify-content:center;padding:0 4px;border:1.5px solid #08040f;"></div>';
    var tbTitle=topbar.querySelector('.tb-title');
    if(tbTitle&&tbTitle.parentNode===topbar){topbar.insertBefore(btn,tbTitle.nextSibling);}
    else{topbar.appendChild(btn);}
  }
  btn.setAttribute('aria-haspopup','dialog'); btn.setAttribute('aria-expanded','false'); btn.setAttribute('aria-label','Notificaciones');
  if(!document.getElementById('notBadge')){
    var b=document.createElement('div'); b.id='notBadge';
    b.style.cssText='display:none;position:absolute;top:2px;right:2px;min-width:16px;height:16px;background:#C0392B;border-radius:20px;font-size:9px;font-weight:700;color:#fff;align-items:center;justify-content:center;padding:0 4px;';
    btn.appendChild(b);
  }

  if(!document.getElementById('notPanelWrap')){
    var panel=document.createElement('div');
    panel.id='notPanelWrap'; panel.setAttribute('role','dialog'); panel.setAttribute('aria-label','Notificaciones');
    panel.innerHTML='<div class="not-hdr"><div style="font-size:14px;font-weight:700;color:#1a0a1b">Notificaciones</div>'
      +'<button type="button" aria-label="Cerrar" onclick="toggleNotPanel(event)" style="background:none;border:none;color:#9a849b;cursor:pointer;font-size:18px;line-height:1">✕</button></div>'
      +'<button type="button" id="notAvisosBtn" class="not-b not-avisos" hidden>🔔 Activar avisos en este celular</button>'
      +'<div id="notPanel"></div>';
    var style=document.createElement('style');
    style.textContent='#notPanelWrap{display:none;position:absolute;top:54px;right:12px;width:420px;max-width:calc(100vw - 24px);max-height:80vh;overflow-y:auto;background:#fff;border:1px solid #e8dde8;border-radius:14px;padding:16px;z-index:200;box-shadow:0 8px 32px rgba(0,0,0,.15);box-sizing:border-box;text-align:left;font-family:Inter,system-ui,sans-serif}'
      +'#notPanelWrap.on{display:block!important}'
      +'.not-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #e8dde8}'
      +'.not-avisos{width:100%;justify-content:center;margin-bottom:12px}'
      +'.not-chips{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}'
      +'.not-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;border:1px solid #e8dde8;background:#fff;color:#5c4a5d;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap}'
      +'.not-chip:hover{background:#faf5fa}.not-chip.on{border-color:#924893;background:rgba(146,72,147,.1);color:#924893}'
      +'.not-chip .not-cnt{background:#924893}'
      +'.not-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}'
      +'.not-ic{display:inline-flex;align-items:center;justify-content:center;border-radius:9px;flex-shrink:0;font-size:15px;line-height:1}'
      +'.not-ic svg{width:17px;height:17px}'
      +'.not-fecha{font-size:10.5px;font-weight:700;color:#9a849b;text-transform:uppercase;letter-spacing:.7px;margin:10px 0 6px}'
      +'.not-filtro{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#faf5fa;border:1px solid #efe3ef;border-radius:10px;padding:8px 10px;margin-bottom:10px;font-size:12px;color:#5c4a5d}'
      +'.not-cnt{color:#fff;border-radius:10px;padding:1px 6px;font-size:9px}'
      +'.not-card{background:#fff;border:1px solid #e8dde8;border-radius:10px;padding:12px 14px;margin-bottom:8px}'
      +'.not-tit{font-size:13px;font-weight:600;color:#1a0a1b;line-height:1.4;margin-bottom:2px;overflow-wrap:anywhere}'
      +'.not-msg{font-size:12px;color:#5c4a5d;line-height:1.5;margin-bottom:4px;overflow-wrap:anywhere}'
      +'.not-sec{font-size:11px;font-weight:700;color:#5c4a5d;text-transform:uppercase;letter-spacing:.7px}'
      +'.not-b{display:inline-flex;align-items:center;gap:4px;background:transparent;color:#924893;border:1px solid #e8dde8;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;text-decoration:none;font-family:inherit}'
      +'.not-b.pri{background:#924893;color:#fff;border-color:#924893}.not-b:disabled{opacity:.6;cursor:default}'
      +'.not-hecha{padding:8px 12px;margin-bottom:6px;border-radius:8px;background:#faf7fa;border:1px solid #e8dde8;display:flex;align-items:center;gap:10px}'
      +'.not-vacio{text-align:center;padding:32px 16px;color:#9a849b;font-size:13px}'
      +'@media (max-width:600px){#notPanelWrap{position:fixed;top:64px;left:12px;right:12px;width:auto;max-height:calc(100vh - 80px)}}';
    document.head.appendChild(style);
    var layout=document.querySelector('.layout')||document.body;
    if(getComputedStyle(layout).position==='static') layout.style.position='relative';
    layout.appendChild(panel);
    panel.addEventListener('click',function(e){e.stopPropagation();});
    document.addEventListener('click',function(e){
      var w=document.getElementById('notPanelWrap'), b2=document.getElementById('notBtn');
      if(w&&b2&&w.classList.contains('on')&&!w.contains(e.target)&&!b2.contains(e.target)){w.classList.remove('on');b2.setAttribute('aria-expanded','false');}
    });
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape'&&panelAbierto()){window.toggleNotPanel();var b3=document.getElementById('notBtn');if(b3&&b3.focus)b3.focus();}
    });
  }
  renderBadge();
}

// ── Inicio ──────────────────────────────────────────────────
function init(){
  injectNotUI();
  if(window._sbAuthReady===true) cargarAlertas();
  window.addEventListener('gestoor-auth-ready',cargarAlertas);
  setInterval(function(){ if(!document.hidden) cargarAlertas(); },30000);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden) cargarAlertas(); });
}
window.__gestoorCampanaNorm=normEnlace;   // expuesto para pruebas
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
