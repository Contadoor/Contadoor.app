// ═══════════════════════════════════════════════════════════
// CONTADOOR — CENTRO DE NOTIFICACIONES
// notifications.js — cargar en todos los módulos
// ═══════════════════════════════════════════════════════════

(function(){

// ── STORAGE ─────────────────────────────────────────────────
function getNots(){
  try{return JSON.parse(localStorage.getItem('notificaciones_sistema')||'[]');}
  catch(e){return[];}
}
function setNots(arr){
  localStorage.setItem('notificaciones_sistema',JSON.stringify(arr));
  renderBadge();
  if(document.getElementById('notPanel')&&document.getElementById('notPanel').classList.contains('on'))
    renderPanel();
}

// ── CREAR NOTIFICACIÓN (función global) ──────────────────────
window.crearNotificacion=function(opts){
  // opts: {modulo, tipo, prioridad, clienteNombre, clienteRut, periodo, mensaje, accion, accionLabel}
  var arr=getNots();
  arr.unshift({
    id:Date.now(),
    modulo:opts.modulo||'sistema',
    tipo:opts.tipo||'info',
    prioridad:opts.prioridad||'media',
    clienteNombre:opts.clienteNombre||'',
    clienteRut:opts.clienteRut||'',
    periodo:opts.periodo||'',
    mensaje:opts.mensaje||'',
    accion:opts.accion||null,
    accionLabel:opts.accionLabel||'Marcar ejecutado',
    accionUrl:opts.accionUrl||null,
    ejecutado:false,
    ejecutadoPor:null,
    ejecutadoTs:null,
    ts:Date.now()
  });
  if(arr.length>500) arr.splice(500);
  setNots(arr);
};

// ── ROL DEL USUARIO ─────────────────────────────────────────
function getRol(){
  try{
    var u=JSON.parse(localStorage.getItem('usuario_sesion')||'{}');
    return u.rol||'admin';
  }catch(e){return'admin';}
}
function getNombre(){
  try{
    var u=JSON.parse(localStorage.getItem('usuario_sesion')||'{}');
    return u.nombre||'Analista';
  }catch(e){return'Analista';}
}

// Módulos que puede ver cada rol
var ROL_MODULOS={
  admin:    ['rrhh','impuestos','pagos','cobranza','sistema'],
  rrhh:     ['rrhh'],
  contable: ['impuestos'],
  pagos:    ['pagos','cobranza'],
  cobranza: ['cobranza']
};

function modulosDelRol(){
  var rol=getRol();
  return ROL_MODULOS[rol]||['sistema'];
}

function canVerModulo(mod){
  return modulosDelRol().indexOf(mod)>=0;
}

// ── FILTRAR PENDIENTES ───────────────────────────────────────
function getPendientes(modulo){
  return getNots().filter(function(n){
    if(n.ejecutado) return false;
    if(modulo&&n.modulo!==modulo) return false;
    if(!canVerModulo(n.modulo)) return false;
    return true;
  });
}

// ── BADGE COUNT ──────────────────────────────────────────────
function renderBadge(){
  var badge=document.getElementById('notBadge');
  if(!badge) return;
  var count=getPendientes().length;
  badge.textContent=count>99?'99+':count;
  badge.style.display=count>0?'flex':'none';
}

// ── HELPERS ─────────────────────────────────────────────────
var MESES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function timeAgo(ts){
  var diff=Math.floor((Date.now()-ts)/1000);
  if(diff<60) return'Hace un momento';
  if(diff<3600) return'Hace '+Math.floor(diff/60)+' min';
  if(diff<86400) return'Hace '+Math.floor(diff/3600)+' h';
  if(diff<604800) return'Hace '+Math.floor(diff/86400)+' días';
  var d=new Date(ts);
  return d.getDate()+' '+MESES[d.getMonth()];
}

var MOD_CONFIG={
  rrhh:     {label:'RRHH',      icon:'ti-users',        color:'#1D9E75', bg:'#E1F5EE'},
  impuestos:{label:'Impuestos', icon:'ti-file-invoice', color:'#BA7517', bg:'#FAEEDA'},
  pagos:    {label:'Pagos',     icon:'ti-credit-card',  color:'#3B82F6', bg:'#E6F1FB'},
  cobranza: {label:'Cobranza',  icon:'ti-receipt',      color:'#904891', bg:'#F5EAF5'},
  sistema:  {label:'Sistema',   icon:'ti-settings',     color:'#5c4a5d', bg:'#f0ebff'}
};

var TIPO_CONFIG={
  accion_requerida:{label:'Acción requerida', color:'#C0392B', bg:'#fee2e2'},
  alerta:          {label:'Alerta',           color:'#C07A1A', bg:'#fef3c7'},
  info:            {label:'Info',             color:'#5c4a5d', bg:'#f0ebff'}
};

function hesc(s){if(!s)return '';return String(s).replace(/&/g,'\x26amp;').replace(/</g,'\x26lt;').replace(/>/g,'\x26gt;');}

// ── EJECUTAR NOTIFICACIÓN ────────────────────────────────────
window.ejecutarNotificacion=function(id){
  var arr=getNots();
  var idx=arr.findIndex(function(n){return n.id===id;});
  if(idx<0) return;
  arr[idx].ejecutado=true;
  arr[idx].ejecutadoPor=getNombre();
  arr[idx].ejecutadoTs=Date.now();
  setNots(arr);
};

window.eliminarNotificacion=function(id){
  setNots(getNots().filter(function(n){return n.id!==id;}));
};

window.marcarTodasEjecutadas=function(modulo){
  var arr=getNots();
  arr.forEach(function(n){
    if(!n.ejecutado&&(!modulo||n.modulo===modulo)&&canVerModulo(n.modulo)){
      n.ejecutado=true;n.ejecutadoPor=getNombre();n.ejecutadoTs=Date.now();
    }
  });
  setNots(arr);
};

// ── RENDER PANEL ─────────────────────────────────────────────
var _activeTab='todos';

function renderPanel(){
  var panel=document.getElementById('notPanel');
  if(!panel) return;
  var mods=modulosDelRol();
  var todos=getNots().filter(function(n){return canVerModulo(n.modulo);});

  // Tabs
  var tabs='<div style="display:flex;gap:2px;background:#f0ebff;border-radius:8px;padding:3px;margin-bottom:12px;flex-wrap:wrap;">';
  tabs+='<div class="not-tab'+((_activeTab==='todos')?' not-tab-on':'')+'" onclick="notSetTab(\'todos\')">Todos <span style="font-size:10px;opacity:.7">('+todos.filter(function(n){return!n.ejecutado;}).length+')</span></div>';
  mods.forEach(function(m){
    var cfg=MOD_CONFIG[m]||MOD_CONFIG.sistema;
    var cnt=getPendientes(m).length;
    tabs+='<div class="not-tab'+((_activeTab===m)?' not-tab-on':'')+'" onclick="notSetTab(\''+m+'\')" style="'+((_activeTab===m)?'':'')+'">'+cfg.label+(cnt>0?' <span style="background:'+cfg.color+';color:#fff;border-radius:10px;padding:1px 6px;font-size:9px">'+cnt+'</span>':'')+'</div>';
  });
  tabs+='</div>';

  // Filtrar notificaciones del tab activo
  var filtered=todos.filter(function(n){
    if(_activeTab==='todos') return true;
    return n.modulo===_activeTab;
  });

  // Separar pendientes y ejecutadas
  var pendientes=filtered.filter(function(n){return!n.ejecutado;});
  var ejecutadas=filtered.filter(function(n){return n.ejecutado;}).slice(0,10);

  var html=tabs;

  // Acciones masivas
  if(pendientes.length>0){
    html+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">';
    html+='<div style="font-size:11px;font-weight:700;color:#5c4a5d;text-transform:uppercase;letter-spacing:.7px">'+pendientes.length+' pendiente'+(pendientes.length!==1?'s':'')+'</div>';
    html+='<button onclick="marcarTodasEjecutadas(\''+(_activeTab==='todos'?'':_activeTab)+'\')" style="background:none;border:1px solid #e8dde8;border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer;color:#5c4a5d">Marcar todas ejecutadas</button>';
    html+='</div>';
  }

  if(pendientes.length===0&&ejecutadas.length===0){
    html+='<div style="text-align:center;padding:32px 16px;color:#9a849b"><i class="ti ti-bell-off" style="font-size:32px;display:block;margin-bottom:8px"></i><div style="font-size:13px">Sin notificaciones</div></div>';
  }

  // Pendientes
  pendientes.forEach(function(n){
    var mCfg=MOD_CONFIG[n.modulo]||MOD_CONFIG.sistema;
    var tCfg=TIPO_CONFIG[n.tipo]||TIPO_CONFIG.info;
    html+='<div style="background:#fff;border:1px solid #e8dde8;border-radius:10px;padding:12px 14px;margin-bottom:8px;border-left:3px solid '+mCfg.color+'">';
    html+='<div style="display:flex;align-items:flex-start;gap:10px">';
    html+='<div style="width:32px;height:32px;border-radius:8px;background:'+mCfg.bg+';display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti '+mCfg.icon+'" style="font-size:15px;color:'+mCfg.color+'"></i></div>';
    html+='<div style="flex:1;min-width:0">';
    html+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">';
    html+='<span style="font-size:10px;font-weight:700;background:'+tCfg.bg+';color:'+tCfg.color+';border-radius:20px;padding:2px 8px">'+tCfg.label+'</span>';
    html+='<span style="font-size:10px;color:#9a849b">'+timeAgo(n.ts)+'</span>';
    if(n.clienteNombre) html+='<span style="font-size:10px;font-weight:600;color:#5c4a5d">'+hesc(n.clienteNombre)+'</span>';
    html+='</div>';
    html+='<div style="font-size:12.5px;color:#1a0a1b;line-height:1.5;margin-bottom:8px">'+hesc(n.mensaje)+'</div>';
    html+='<div style="display:flex;gap:6px;flex-wrap:wrap">';
    if(n.accion){
      html+='<button onclick="ejecutarNotificacion('+n.id+')" style="background:#904891;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer">✅ '+hesc(n.accionLabel)+'</button>';
    }
    if(n.accionUrl){
      html+='<a href="'+hesc(n.accionUrl)+'" style="background:transparent;color:#904891;border:1px solid #e8dde8;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;text-decoration:none">Ver →</a>';
    }
    html+='<button onclick="ejecutarNotificacion('+n.id+')" style="background:transparent;color:#9a849b;border:1px solid #e8dde8;border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer">Ignorar</button>';
    html+='</div></div>';
    html+='<button onclick="eliminarNotificacion('+n.id+')" style="background:none;border:none;color:#9a849b;cursor:pointer;font-size:14px;flex-shrink:0;padding:0">✕</button>';
    html+='</div></div>';
  });

  // Ejecutadas (historial)
  if(ejecutadas.length>0){
    html+='<div style="font-size:11px;font-weight:700;color:#9a849b;text-transform:uppercase;letter-spacing:.7px;margin:12px 0 8px">Historial reciente</div>';
    ejecutadas.forEach(function(n){
      var mCfg=MOD_CONFIG[n.modulo]||MOD_CONFIG.sistema;
      html+='<div style="padding:8px 12px;margin-bottom:6px;border-radius:8px;background:#faf7fa;border:1px solid #e8dde8;display:flex;align-items:center;gap:10px;opacity:.65">';
      html+='<i class="ti ti-check" style="font-size:14px;color:'+mCfg.color+';flex-shrink:0"></i>';
      html+='<div style="flex:1;min-width:0"><div style="font-size:11.5px;color:#5c4a5d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+hesc(n.mensaje)+'</div>';
      html+='<div style="font-size:10px;color:#9a849b">Ejecutado por '+hesc(n.ejecutadoPor||'')+'  · '+timeAgo(n.ejecutadoTs)+'</div></div>';
      html+='<button onclick="eliminarNotificacion('+n.id+')" style="background:none;border:none;color:#9a849b;cursor:pointer;font-size:13px;flex-shrink:0">✕</button>';
      html+='</div>';
    });
  }

  panel.innerHTML=html;
}

window.notSetTab=function(tab){
  _activeTab=tab;
  renderPanel();
};

// ── TOGGLE PANEL ─────────────────────────────────────────────
window.toggleNotPanel=function(e){
  if(e) e.stopPropagation();
  var panel=document.getElementById('notPanel');
  if(!panel) return;
  var isOn=panel.classList.contains('on');
  panel.classList.toggle('on',!isOn);
  if(!isOn) renderPanel();
};

// ── INYECTAR UI EN EL TOPBAR ─────────────────────────────────
function injectNotUI(){
  var topbar=document.querySelector('.topbar');
  if(!topbar||document.getElementById('notBtn')) return;

  // Botón campana
  var btn=document.createElement('div');
  btn.id='notBtn';
  btn.onclick=window.toggleNotPanel;
  btn.style.cssText='position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;background:rgba(255,255,255,.08);transition:.15s;flex-shrink:0;';
  btn.innerHTML='<i class="ti ti-bell" style="font-size:18px;color:rgba(255,255,255,.75)"></i>'
    +'<div id="notBadge" style="display:none;position:absolute;top:2px;right:2px;min-width:16px;height:16px;background:#C0392B;border-radius:20px;font-size:9px;font-weight:700;color:#fff;align-items:center;justify-content:center;padding:0 4px;border:1.5px solid #08040f;"></div>';

  // Panel
  var panel=document.createElement('div');
  panel.id='notPanel';
  panel.style.cssText='display:none;position:absolute;top:54px;right:12px;width:420px;max-height:80vh;overflow-y:auto;background:#fff;border:1px solid #e8dde8;border-radius:14px;padding:16px;z-index:200;box-shadow:0 8px 32px rgba(0,0,0,.15);';

  // Header del panel
  var panelHdr=document.createElement('div');
  panelHdr.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #e8dde8;';
  panelHdr.innerHTML='<div style="font-size:14px;font-weight:700;color:#1a0a1b"><i class="ti ti-bell" style="font-size:16px;vertical-align:-2px;margin-right:6px;color:#904891"></i>Notificaciones</div>'
    +'<button onclick="toggleNotPanel(event)" style="background:none;border:none;color:#9a849b;cursor:pointer;font-size:18px;line-height:1">✕</button>';
  panel.appendChild(panelHdr);

  // Contenido dinámico
  var panelBody=document.createElement('div');
  panelBody.id='notPanel';
  // Reusar el panel como contenedor
  panel.removeAttribute('id');
  panel.id='notPanelWrap';
  panelBody.id='notPanel';
  panelBody.style.cssText='';
  panel.appendChild(panelBody);

  // Estilos tabs
  var style=document.createElement('style');
  style.textContent='.not-tab{padding:5px 12px;border-radius:6px;font-size:11px;font-weight:500;cursor:pointer;color:#5c4a5d;white-space:nowrap;transition:.15s;}'
    +'.not-tab:hover{background:rgba(144,72,145,.1);}'
    +'.not-tab-on{background:#904891;color:#fff;font-weight:600;}'
    +'#notPanelWrap.on{display:block!important;}';
  document.head.appendChild(style);

  // Insertar antes del último elemento del topbar (o al final)
  var tbTitle=topbar.querySelector('.tb-title');
  if(tbTitle){topbar.insertBefore(btn,tbTitle.nextSibling);}
  else{topbar.appendChild(btn);}

  // Panel relativo al layout
  var layout=document.querySelector('.layout')||document.body;
  layout.style.position='relative';
  layout.appendChild(panel);
  panel.classList.remove('on');

  // Cerrar al hacer clic fuera
  document.addEventListener('click',function(e){
    var wrap=document.getElementById('notPanelWrap');
    var b=document.getElementById('notBtn');
    if(wrap&&b&&!wrap.contains(e.target)&&!b.contains(e.target)){
      wrap.classList.remove('on');
    }
  });

  renderBadge();
}

// ── INIT ─────────────────────────────────────────────────────
function init(){
  injectNotUI();
  // Polling cada 30 segundos para actualizar badge (útil cuando otro módulo crea notificaciones)
  setInterval(renderBadge,30000);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
}else{
  init();
}

})();
