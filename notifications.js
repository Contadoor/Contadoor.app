// ═══════════════════════════════════════════════════════════
// CONTADOOR — CENTRO DE NOTIFICACIONES
// notifications.js — cargar en todos los módulos
// ═══════════════════════════════════════════════════════════
// B13: Fuente principal migrada a public.alertas (Supabase).
//      localStorage se mantiene para alertas V1 legacy.
//      Sin INSERT directo — creación solo mediante RPC server-side.
// ═══════════════════════════════════════════════════════════

(function(){

// ── ESTADO V2 (Supabase) ────────────────────────────────────
var _v2Cache   = [];    // alertas V2 mapeadas desde public.alertas
var _v2Loading = false; // evitar fetchs concurrentes

// ── STORAGE V1 (legacy localStorage) ────────────────────────
function getNots(){
  try{return JSON.parse(localStorage.getItem('notificaciones_sistema')||'[]');}
  catch(e){return[];}
}
function setNots(arr){
  // Escribe solo alertas V1 en localStorage — V2 nunca se almacena aquí
  localStorage.setItem('notificaciones_sistema',JSON.stringify(arr));
  renderBadge();
  var wrap=document.getElementById('notPanelWrap');
  if(wrap&&wrap.classList.contains('on')) renderPanel();
}

// ── FUENTE UNIFICADA V2 + V1 ─────────────────────────────────
// V2 lidera (más reciente); V1 legacy al final.
// No hay riesgo de duplicados: fuentes de creación son distintas.
function getAllNots(){
  return _v2Cache.concat(getNots());
}

// ── MAPEO Supabase row → formato UI ──────────────────────────
function mapAlertaSupabase(row){
  return {
    id:           row.id,
    _src:         'v2',                          // marca de fuente V2
    modulo:       row.modulo       || 'sistema',
    tipo:         row.tipo         || 'info',
    prioridad:    row.prioridad    || 'media',
    clienteNombre:'',    // no disponible en alertas — no inventar
    clienteRut:   row.cliente_rut  || '',
    periodo:      row.periodo      || '',
    titulo:       row.titulo       || '',
    mensaje:      row.descripcion  || row.titulo || '',
    accion:       row.accion       || null,
    accionLabel:  'Marcar ejecutado',
    accionUrl:    row.accion_url   || null,
    ejecutado:    row.estado !== 'pendiente',
    ejecutadoPor: row.resuelta_por || null,
    ejecutadoTs:  row.resuelta_at
                    ? new Date(row.resuelta_at).getTime()
                    : null,
    ts:           row.created_at
                    ? new Date(row.created_at).getTime()
                    : Date.now(),
    creadaPor:    row.creada_por   || null,
    destinatarioNombre: row.asignado_a  || ''
  };
}

// ── CARGA DESDE Supabase (async) ─────────────────────────────
// RLS decide qué filas recibe el usuario — no hay filtro adicional aquí.
function cargarAlertas(){
  if(typeof sbGet!=='function') return; // supabase.js no cargado aún
  if(_v2Loading) return;
  _v2Loading=true;
  sbGet('alertas?select=*&order=created_at.desc&limit=200')
    .then(function(rows){
      _v2Loading=false;
      _v2Cache=(Array.isArray(rows)?rows:[])
        .filter(function(row){ return row.estado!=='ignorada'; })
        .map(mapAlertaSupabase);
      renderBadge();
      var wrap=document.getElementById('notPanelWrap');
      if(wrap&&wrap.classList.contains('on')) renderPanel();
    })
    .catch(function(e){
      _v2Loading=false;
      console.warn('[Notif] Error cargando alertas Supabase:',e);
    });
}

// ── CREAR NOTIFICACIÓN (función global — V1 localStorage) ────
// V2 se crea EXCLUSIVAMENTE mediante RPC crear_alerta_responsable_cliente.
// Esta función conserva compatibilidad con módulos existentes (V1).
// No escribe en Supabase. No duplica alertas V2.
window.crearNotificacion=function(opts){
  var arr=getNots(); // solo V1
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
  setNots(arr); // escribe solo V1 en localStorage
};

// ── ROL / IDENTIDAD ──────────────────────────────────────────
function getRol(){
  try{
    if(window._contadoorSesion&&window._contadoorSesion.rol)
      return window._contadoorSesion.rol;
    var ss=JSON.parse(sessionStorage.getItem('usuario_activo')||'null');
    if(ss&&ss.rol) return ss.rol;
    return '';
  }catch(e){return'';}
}
function getNombre(){
  try{
    if(window._contadoorSesion&&window._contadoorSesion.nombre)
      return window._contadoorSesion.nombre;
    var ss=JSON.parse(sessionStorage.getItem('usuario_activo')||'null');
    if(ss&&ss.nombre) return ss.nombre;
    return 'Usuario';
  }catch(e){return'Usuario';}
}

// Módulos visibles por rol
var ROL_MODULOS={
  master:   ['rrhh','impuestos','pagos','cobranza','sistema'],
  admin:    ['rrhh','impuestos','pagos','cobranza','sistema'],
  rrhh:     ['rrhh'],
  contable: ['impuestos'],
  pagos:    ['pagos','cobranza'],
  cobranza: ['cobranza']
};
// "impuestos" es el módulo Contable — no existe módulo "contable"

function modulosDelRol(){
  var rol=getRol();
  return ROL_MODULOS[rol]||['sistema'];
}
function canVerModulo(mod){
  return modulosDelRol().indexOf(mod)>=0;
}

// ── FILTRAR PENDIENTES (V2 + V1) ─────────────────────────────
function getPendientes(modulo){
  return getAllNots().filter(function(n){
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
  if(!ts) return '';
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
function hesc(s){
  if(!s) return '';
  return String(s).replace(/&/g,'\x26amp;').replace(/</g,'\x26lt;').replace(/>/g,'\x26gt;');
}

// ── EJECUTAR NOTIFICACIÓN ─────────────────────────────────────
window.ejecutarNotificacion=function(id){
  // ── V2: UPDATE en Supabase ──────────────────────────────
  var v2=_v2Cache.find(function(n){return n.id===id&&n._src==='v2';});
  if(v2){
    if(typeof sbFetch!=='function') return;
    // Identidad desde sesión activa, no desde parámetro de UI
    var resolvedBy=getNombre();
    var resolvedAt=new Date().toISOString();
    sbFetch('alertas?id=eq.'+id,{
      method:'PATCH',
      headers:{'Prefer':'return=representation'},
      body:JSON.stringify({
        estado:'resuelta',
        resuelta_por:resolvedBy,
        resuelta_at:resolvedAt
      })
    })
    .then(function(r){
      if(!r.ok){
        console.error('[Notif] PATCH ejecutar alerta id='+id+' → HTTP '+r.status);
        return null;
      }
      return r.json();
    })
    .then(function(rows){
      if(rows&&rows.length>0){
        // Supabase confirmó el UPDATE — marcar en caché y re-renderizar
        // El panel permanece abierto; la alerta pasa al historial
        var idx=_v2Cache.findIndex(function(n){return n.id===id;});
        if(idx>=0){
          _v2Cache[idx].ejecutado=true;
          _v2Cache[idx].ejecutadoPor=resolvedBy;
          _v2Cache[idx].ejecutadoTs=new Date(resolvedAt).getTime();
        }
        renderBadge();
        renderPanel();
      }else{
        // Sin confirmación — mantener pendiente y mostrar error
        console.warn('[Notif] PATCH ejecutar alerta id='+id+' → respuesta vacía o null');
        if(typeof toast==='function')
          toast('⚠️ No se pudo marcar la alerta. Verifica tu conexión e intenta nuevamente.');
      }
    })
    .catch(function(e){
      console.error('[Notif] Error al ejecutar alerta V2 id='+id+':',e);
      if(typeof toast==='function')
        toast('⚠️ Error al ejecutar la alerta. Intenta nuevamente.');
    });
    return;
  }
  // ── V1: localStorage ───────────────────────────────────
  var arr=getNots();
  var idx=arr.findIndex(function(n){return n.id===id;});
  if(idx<0) return;
  arr[idx].ejecutado=true;
  arr[idx].ejecutadoPor=getNombre();
  arr[idx].ejecutadoTs=Date.now();
  setNots(arr);
};

window.eliminarNotificacion=function(id){
  // ── V2: remoción local de caché (no persiste en Supabase) ──
  // Nota: reaparecerá en el próximo ciclo de polling a menos que esté resuelta.
  // Para eliminación persistente use ejecutarNotificacion() que marca 'resuelta'.
  var v2idx=_v2Cache.findIndex(function(n){return n.id===id&&n._src==='v2';});
  if(v2idx>=0){
    _v2Cache.splice(v2idx,1);
    renderBadge();
    renderPanel();
    return;
  }
  // ── V1: localStorage ───────────────────────────────────
  setNots(getNots().filter(function(n){return n.id!==id;}));
};

// ── IGNORAR NOTIFICACIÓN ──────────────────────────────────────
// V2: PATCH estado='ignorada' → persistente, no reaparece en polling.
// V1: eliminar permanentemente de localStorage.
window.ignorarNotificacion=function(id){
  // ── V2: PATCH persistente ───────────────────────────────
  var v2=_v2Cache.find(function(n){return n.id===id&&n._src==='v2';});
  if(v2){
    if(typeof sbFetch!=='function') return;
    var resolvedBy=getNombre();
    var resolvedAt=new Date().toISOString();
    sbFetch('alertas?id=eq.'+id,{
      method:'PATCH',
      headers:{'Prefer':'return=representation'},
      body:JSON.stringify({
        estado:'ignorada',
        resuelta_por:resolvedBy,
        resuelta_at:resolvedAt
      })
    })
    .then(function(r){
      if(!r.ok){
        console.error('[Notif] PATCH ignorar alerta id='+id+' → HTTP '+r.status);
        return null;
      }
      return r.json();
    })
    .then(function(rows){
      if(rows&&rows.length>0){
        // Confirmado: quitar del caché; badge y panel actualizan; panel sigue abierto
        var idx=_v2Cache.findIndex(function(n){return n.id===id;});
        if(idx>=0) _v2Cache.splice(idx,1);
        renderBadge();
        renderPanel();
      }else{
        console.warn('[Notif] PATCH ignorar alerta id='+id+' → respuesta vacía o null');
        if(typeof toast==='function')
          toast('⚠️ No se pudo ignorar la alerta. Verifica tu conexión e intenta nuevamente.');
      }
    })
    .catch(function(e){
      console.error('[Notif] Error al ignorar alerta V2 id='+id+':',e);
      if(typeof toast==='function')
        toast('⚠️ Error al ignorar la alerta. Intenta nuevamente.');
    });
    return;
  }
  // ── V1: eliminar permanentemente de localStorage ────────
  setNots(getNots().filter(function(n){return n.id!==id;}));
};

window.marcarTodasEjecutadas=function(modulo){
  // ── V2: batch PATCH en Supabase ───────────────────────
  var v2Pending=_v2Cache.filter(function(n){
    if(n.ejecutado) return false;
    if(modulo&&n.modulo!==modulo) return false;
    if(!canVerModulo(n.modulo)) return false;
    return true;
  });
  if(v2Pending.length>0&&typeof sbFetch==='function'){
    var ids=v2Pending.map(function(n){return n.id;}).join(',');
    var resolvedBy=getNombre();
    var resolvedAt=new Date().toISOString();
    sbFetch('alertas?id=in.('+ids+')',{
      method:'PATCH',
      headers:{'Prefer':'return=representation'},
      body:JSON.stringify({
        estado:'resuelta',
        resuelta_por:resolvedBy,
        resuelta_at:resolvedAt
      })
    })
    .then(function(r){return r.ok?r.json():null;})
    .then(function(rows){
      if(rows&&rows.length>0){
        rows.forEach(function(row){
          var idx=_v2Cache.findIndex(function(n){return n.id===row.id;});
          if(idx>=0){
            _v2Cache[idx].ejecutado=true;
            _v2Cache[idx].ejecutadoPor=resolvedBy;
            _v2Cache[idx].ejecutadoTs=new Date(resolvedAt).getTime();
          }
        });
        renderBadge(); renderPanel();
      }else{
        // Re-cargar desde Supabase para estado consistente
        cargarAlertas();
      }
    })
    .catch(function(e){
      console.error('[Notif] Error en marcarTodasEjecutadas V2:',e);
    });
  }
  // ── V1: localStorage ───────────────────────────────────
  var arr=getNots();
  var changed=false;
  arr.forEach(function(n){
    if(!n.ejecutado&&(!modulo||n.modulo===modulo)&&canVerModulo(n.modulo)){
      n.ejecutado=true; n.ejecutadoPor=getNombre(); n.ejecutadoTs=Date.now();
      changed=true;
    }
  });
  if(changed) setNots(arr);
};

// ── RENDER PANEL (V2 + V1) ────────────────────────────────────
var _activeTab='todos';

function renderPanel(){
  var panel=document.getElementById('notPanel');
  if(!panel) return;
  var mods=modulosDelRol();
  var todos=getAllNots().filter(function(n){return canVerModulo(n.modulo);});

  // Tabs
  var tabs='<div style="display:flex;gap:2px;background:#f0ebff;border-radius:8px;padding:3px;margin-bottom:12px;flex-wrap:wrap;">';
  tabs+='<div class="not-tab'+((_activeTab==='todos')?' not-tab-on':'')+'" onclick="notSetTab(\'todos\')">Todos <span style="font-size:10px;opacity:.7">('+todos.filter(function(n){return!n.ejecutado;}).length+')</span></div>';
  mods.forEach(function(m){
    var cfg=MOD_CONFIG[m]||MOD_CONFIG.sistema;
    var cnt=getPendientes(m).length;
    tabs+='<div class="not-tab'+((_activeTab===m)?' not-tab-on':'')+'" onclick="notSetTab(\''+m+'\')" style="">'+cfg.label+(cnt>0?' <span style="background:'+cfg.color+';color:#fff;border-radius:10px;padding:1px 6px;font-size:9px">'+cnt+'</span>':'')+'</div>';
  });
  tabs+='</div>';

  var filtered=todos.filter(function(n){
    if(_activeTab==='todos') return true;
    return n.modulo===_activeTab;
  });

  var pendientes=filtered.filter(function(n){return!n.ejecutado;});
  var ejecutadas=filtered.filter(function(n){return n.ejecutado;}).slice(0,10);

  var html=tabs;

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
    var nid=JSON.stringify(n.id); // seguro para V2 (int) y V1 (int grande)
    html+='<div style="background:#fff;border:1px solid #e8dde8;border-radius:10px;padding:12px 14px;margin-bottom:8px;border-left:3px solid '+mCfg.color+'">';
    html+='<div style="display:flex;align-items:flex-start;gap:10px">';
    html+='<div style="width:32px;height:32px;border-radius:8px;background:'+mCfg.bg+';display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="ti '+mCfg.icon+'" style="font-size:15px;color:'+mCfg.color+'"></i></div>';
    html+='<div style="flex:1;min-width:0">';
    html+='<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap">';
    html+='<span style="font-size:10px;font-weight:700;background:'+tCfg.bg+';color:'+tCfg.color+';border-radius:20px;padding:2px 8px">'+tCfg.label+'</span>';
    if(n.prioridad==='alta')  html+='<span style="font-size:9px;font-weight:700;background:#fee2e2;color:#C0392B;border-radius:20px;padding:1px 7px">● Alta</span>';
    if(n.prioridad==='media') html+='<span style="font-size:9px;color:#C07A1A;background:#fef3c7;border-radius:20px;padding:1px 7px">● Media</span>';
    html+='<span style="font-size:10px;color:#9a849b">'+timeAgo(n.ts)+'</span>';
    if(n.clienteNombre) html+='<span style="font-size:10px;font-weight:600;color:#5c4a5d">'+hesc(n.clienteNombre)+'</span>';
    if(n.clienteRut) html+='<span style="font-size:10px;color:#9a849b">'+hesc(n.clienteRut)+'</span>';
    if(n.periodo) html+='<span style="font-size:9px;background:#f0ebff;color:#5c4a5d;border-radius:20px;padding:1px 7px">'+hesc(n.periodo)+'</span>';
    html+='</div>';
    if(n.titulo&&n.titulo!==n.mensaje)
      html+='<div style="font-size:11px;font-weight:600;color:#5c4a5d;margin-bottom:2px">'+hesc(n.titulo)+'</div>';
    html+='<div style="font-size:12.5px;color:#1a0a1b;line-height:1.5;margin-bottom:6px">'+hesc(n.mensaje)+'</div>';
    if(n.creadaPor) html+='<div style="font-size:10px;color:#9a849b;margin-bottom:4px">Creado por '+hesc(n.creadaPor)+'</div>';
    if(n.destinatarioNombre) html+='<div style="font-size:10px;color:#9a849b;margin-bottom:6px">Asignado a: '+hesc(n.destinatarioNombre)+'</div>';
    html+='<div style="display:flex;gap:6px;flex-wrap:wrap">';
    html+='<button onclick="ejecutarNotificacion('+nid+')" style="background:#904891;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer">✅ '+hesc(n.accionLabel)+'</button>';
    if(n.accionUrl){
      // Botón "Ver" usa accion_url directamente (no modifica estado)
      html+='<a href="'+hesc(n.accionUrl)+'" style="background:transparent;color:#904891;border:1px solid #e8dde8;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;text-decoration:none">Ver →</a>';
    }
    html+='<button onclick="ignorarNotificacion('+nid+')" style="background:transparent;color:#9a849b;border:1px solid #e8dde8;border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer">Ignorar</button>';
    html+='</div></div>';
    html+='<button onclick="'+(n._src==='v2'?'ignorarNotificacion':'eliminarNotificacion')+'('+nid+')" style="background:none;border:none;color:#9a849b;cursor:pointer;font-size:14px;flex-shrink:0;padding:0">✕</button>';
    html+='</div></div>';
  });

  // Historial
  if(ejecutadas.length>0){
    html+='<div style="font-size:11px;font-weight:700;color:#9a849b;text-transform:uppercase;letter-spacing:.7px;margin:12px 0 8px">Historial reciente</div>';
    ejecutadas.forEach(function(n){
      var mCfg=MOD_CONFIG[n.modulo]||MOD_CONFIG.sistema;
      var nid=JSON.stringify(n.id);
      html+='<div style="padding:8px 12px;margin-bottom:6px;border-radius:8px;background:#faf7fa;border:1px solid #e8dde8;display:flex;align-items:center;gap:10px;opacity:.65">';
      html+='<i class="ti ti-check" style="font-size:14px;color:'+mCfg.color+';flex-shrink:0"></i>';
      html+='<div style="flex:1;min-width:0"><div style="font-size:11.5px;color:#5c4a5d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+hesc(n.mensaje)+'</div>';
      html+='<div style="font-size:10px;color:#9a849b">Ejecutado por '+hesc(n.ejecutadoPor||'')+'  · '+timeAgo(n.ejecutadoTs)+'</div></div>';
      html+='<button onclick="eliminarNotificacion('+nid+')" style="background:none;border:none;color:#9a849b;cursor:pointer;font-size:13px;flex-shrink:0">✕</button>';
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
// Corregido respecto al original: toggle aplica 'on' a notPanelWrap (wrapper
// visible por CSS) en lugar de notPanel (cuerpo interno, no controlado por CSS).
// Además dispara cargarAlertas() al abrir para datos frescos de Supabase.
window.toggleNotPanel=function(e){
  if(e) e.stopPropagation();
  var wrap=document.getElementById('notPanelWrap');
  if(!wrap) return;
  var isOn=wrap.classList.contains('on');
  wrap.classList.toggle('on',!isOn);
  if(!isOn){
    renderPanel();    // mostrar inmediatamente con caché actual
    cargarAlertas();  // luego refrescar desde Supabase → re-renderiza al completar
  }
};

// ── INYECTAR UI EN EL TOPBAR ─────────────────────────────────
function injectNotUI(){
  var topbar=document.querySelector('.topbar');
  if(!topbar) return;

  // ── Campana: reutilizar si ya existe, crear si no ─────────
  // Módulos como Contable ya tienen #notBtn propio — no crear una segunda campana.
  var btn=document.getElementById('notBtn');
  if(btn){
    // Reutilizar la campana existente: reasignar handler a la Central V2
    btn.onclick=window.toggleNotPanel;
  }else{
    btn=document.createElement('div');
    btn.id='notBtn';
    btn.onclick=window.toggleNotPanel;
    btn.style.cssText='position:relative;cursor:pointer;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;background:rgba(255,255,255,.08);transition:.15s;flex-shrink:0;';
    btn.innerHTML='<i class="ti ti-bell" style="font-size:18px;color:rgba(255,255,255,.75)"></i>'
      +'<div id="notBadge" style="display:none;position:absolute;top:2px;right:2px;min-width:16px;height:16px;background:#C0392B;border-radius:20px;font-size:9px;font-weight:700;color:#fff;align-items:center;justify-content:center;padding:0 4px;border:1.5px solid #08040f;"></div>';
    var tbTitle=topbar.querySelector('.tb-title');
    if(tbTitle){topbar.insertBefore(btn,tbTitle.nextSibling);}
    else{topbar.appendChild(btn);}
  }

  // ── Panel: crear solo si no existe ya ────────────────────
  if(!document.getElementById('notPanelWrap')){
    var panel=document.createElement('div');
    panel.style.cssText='display:none;position:absolute;top:54px;right:12px;width:420px;max-height:80vh;overflow-y:auto;background:#fff;border:1px solid #e8dde8;border-radius:14px;padding:16px;z-index:200;box-shadow:0 8px 32px rgba(0,0,0,.15);';

    var panelHdr=document.createElement('div');
    panelHdr.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #e8dde8;';
    panelHdr.innerHTML='<div style="font-size:14px;font-weight:700;color:#1a0a1b"><i class="ti ti-bell" style="font-size:16px;vertical-align:-2px;margin-right:6px;color:#904891"></i>Notificaciones</div>'
      +'<button onclick="toggleNotPanel(event)" style="background:none;border:none;color:#9a849b;cursor:pointer;font-size:18px;line-height:1">✕</button>';
    panel.appendChild(panelHdr);

    var panelBody=document.createElement('div');
    panelBody.id='notPanel';
    panelBody.style.cssText='';
    panel.id='notPanelWrap';
    panel.appendChild(panelBody);

    var style=document.createElement('style');
    style.textContent='.not-tab{padding:5px 12px;border-radius:6px;font-size:11px;font-weight:500;cursor:pointer;color:#5c4a5d;white-space:nowrap;transition:.15s;}'
      +'.not-tab:hover{background:rgba(144,72,145,.1);}'
      +'.not-tab-on{background:#904891;color:#fff;font-weight:600;}'
      +'#notPanelWrap.on{display:block!important;}';
    document.head.appendChild(style);

    var layout=document.querySelector('.layout')||document.body;
    layout.style.position='relative';
    layout.appendChild(panel);
    // Detener propagación de clics internos al documento para que el panel no se cierre
    // al usar tabs, botones o cualquier elemento dentro del panel.
    panel.onclick=function(e){ e.stopPropagation(); };

    document.addEventListener('click',function(e){
      var wrap=document.getElementById('notPanelWrap');
      var b=document.getElementById('notBtn');
      if(wrap&&b&&!wrap.contains(e.target)&&!b.contains(e.target)){
        wrap.classList.remove('on');
      }
    });
  }

  // stopPropagation idempotente: se aplica al wrap final (nuevo o preexistente)
  // Evita que clics internos cierren el panel sin duplicar addEventListener
  var wrapFinal=document.getElementById('notPanelWrap');
  if(wrapFinal){ wrapFinal.onclick=function(e){e.stopPropagation();}; }

  renderBadge();
}

// ── INIT ─────────────────────────────────────────────────────
function init(){
  injectNotUI();
  cargarAlertas();              // carga inicial V2 desde Supabase
  setInterval(cargarAlertas,30000); // polling V2 cada 30 s (reemplaza renderBadge poll)
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',init);
}else{
  init();
}

})();
