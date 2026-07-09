// auth.js — Contadoor.app
// Incluir en todos los módulos: <script src="../auth.js"></script>
// En el dashboard (raíz): <script src="auth.js"></script>

(function(){
  var LOGIN_PAGE = 'login.html';

  // Detectar profundidad de ruta
  var path = window.location.pathname;
  var esRaiz = (path.endsWith('/') || path.endsWith('index.html')) &&
               !path.includes('/clientes/') && !path.includes('/pir/') &&
               !path.includes('/reportes') && !path.includes('/pagos/') &&
               !path.includes('/admin/') && !path.includes('/conciliacion/') &&
               !path.includes('/cobranza/') && !path.includes('/convenios/') &&
               !path.includes('/portal/') && !path.includes('/performance/');
  var loginUrl = esRaiz ? LOGIN_PAGE : '../' + LOGIN_PAGE;

  // Módulo actual
  var MODULO_ACTUAL = (function(){
    if(path.includes('/clientes/'))         return 'clientes';
    if(path.includes('/pir/'))              return 'pir';
    if(path.includes('/reportes-rrhh/'))    return 'reportes-rrhh';
    if(path.includes('/reportes-contable/'))return 'reportes-contable';
    if(path.includes('/reportes-pagos/'))   return 'reportes-pagos';
    if(path.includes('/reportes/'))         return 'reportes';
    if(path.includes('/pagos/'))            return 'pagos';
    if(path.includes('/conciliacion/'))     return 'conciliacion';
    if(path.includes('/cobranza/'))         return 'cobranza';
    if(path.includes('/convenios/'))        return 'convenios';
    if(path.includes('/portal/'))           return 'portal';
    if(path.includes('/admin/'))            return 'admin';
    if(path.includes('/performance/'))      return 'performance';
    return 'dashboard';
  })();

  // Redirección por rol al entrar al dashboard
  var ROL_REDIRECT = {
    rrhh:     'reportes-rrhh/index.html',
    contable: 'reportes-contable/index.html',
    pagos:    'reportes-pagos/index.html',
    cobranza: 'cobranza/index.html',
    admin:    null  // queda en dashboard
  };

  function getSession(){
    try{ return JSON.parse(sessionStorage.getItem('usuario_activo')||'null'); }
    catch(e){ return null; }
  }

  function redirigirLogin(){
    window.location.href = loginUrl + '?redirect=' + encodeURIComponent(window.location.href);
  }

  var sesion = getSession();

  // Sin sesión → login
  if(!sesion){ redirigirLogin(); return; }

  // Sesión expirada (8 horas)
  if(Date.now() - sesion.tsLogin > 8 * 60 * 60 * 1000){
    sessionStorage.removeItem('usuario_activo');
    redirigirLogin();
    return;
  }

  // Auto-redirección por rol si entra al dashboard
  if(MODULO_ACTUAL === 'dashboard' && !sesion.esMaster){
    var redirect = ROL_REDIRECT[sesion.rol];
    if(redirect){
      window.location.href = redirect;
      return;
    }
  }

  // Módulos permitidos por rol
  var MODULOS_POR_ROL = {
    admin:    ['*'],  // todos
    rrhh:     ['reportes-rrhh'],
    contable: ['reportes-contable'],
    pagos:    ['reportes-pagos','pagos','conciliacion'],
    cobranza: ['cobranza']
  };

  function puedeVerModulo(modulo){
    if(sesion.esMaster) return true;
    var permisos = MODULOS_POR_ROL[sesion.rol] || [];
    if(permisos[0] === '*') return true;
    if(modulo === 'dashboard') return true; // todos ven el dashboard (aunque se redirigen)
    return permisos.includes(modulo) || (sesion.modulos||[]).includes(modulo);
  }

  // Verificar acceso al módulo actual
  if(!puedeVerModulo(MODULO_ACTUAL)){
    document.addEventListener('DOMContentLoaded', function(){
      document.body.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0ebff;font-family:sans-serif">'
        +'<div style="text-align:center;padding:40px">'
        +'<div style="font-size:48px;margin-bottom:16px">⛔</div>'
        +'<h2 style="color:#904891;font-size:20px;margin-bottom:8px">Acceso denegado</h2>'
        +'<p style="color:#5c4a5d;margin-bottom:20px">No tienes permiso para acceder a este módulo.</p>'
        +'<p style="color:#9a849b;font-size:13px;margin-bottom:20px">Contacta a Luciano para solicitar acceso.</p>'
        +'<a href="' + (esRaiz ? 'index.html' : '../index.html') + '" '
        +'style="background:#904891;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">← Volver</a>'
        +'</div></div>';
    });
    return;
  }

  // Sesión válida — exponer datos
  window._contadoorSesion = sesion;

  // Inyectar info usuario en topbar
  document.addEventListener('DOMContentLoaded', function(){
    var topbar = document.querySelector('.topbar');
    if(!topbar) return;

    // Badge usuario
    var badge = document.createElement('div');
    badge.style.cssText = 'display:flex;align-items:center;gap:8px;margin-right:8px;flex-shrink:0';
    badge.innerHTML =
      '<div style="width:28px;height:28px;border-radius:50%;background:rgba(144,72,145,.3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0">'
      + sesion.nombre.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase()
      +'</div>'
      +'<div style="text-align:right">'
      +'<div style="font-size:11px;font-weight:600;color:rgba(255,255,255,.8)">'+sesion.nombre+'</div>'
      +'<div style="font-size:9px;color:rgba(255,255,255,.3)">'+sesion.rol+'</div>'
      +'</div>';

    // Botón salir
    var btnLogout = document.createElement('button');
    btnLogout.textContent = 'Salir';
    btnLogout.style.cssText = 'background:rgba(255,255,255,.08);color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;font-family:inherit;flex-shrink:0';
    btnLogout.onclick = function(){
      if(confirm('¿Cerrar sesión?')){
        sessionStorage.removeItem('usuario_activo');
        window.location.href = loginUrl;
      }
    };

    var lastBtn = topbar.querySelector('button:last-child');
    if(lastBtn) topbar.insertBefore(badge, lastBtn);
    else topbar.appendChild(badge);
    topbar.appendChild(btnLogout);
  });

})();
