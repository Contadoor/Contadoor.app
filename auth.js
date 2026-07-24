// auth.js — Gestoor v3 · Supabase Auth nativo
// Incluir en todos los módulos DESPUÉS de supabase.js:
//   <script src="../supabase.js"></script>   ← inicializa _sbAuthClient
//   <script src="../auth.js"></script>        ← este archivo
// En dashboard (raíz): rutas relativas sin ../

(function(){
  var LOGIN_PAGE='login.html';

  // ── Ruta del login según profundidad ────────────────────────────────────────
  var path=window.location.pathname;
  var esRaiz=(path.endsWith('/')||path.endsWith('index.html'))&&
    !path.includes('/clientes/')&&!path.includes('/pir/')&&
    !path.includes('/reportes')&&!path.includes('/panel-de-control/')&&
    !path.includes('/pagos/')&&!path.includes('/admin/')&&
    !path.includes('/conciliacion/')&&!path.includes('/cobranza/')&&
    !path.includes('/convenios/')&&!path.includes('/portal/')&&
    !path.includes('/performance/')&&!path.includes('/planes/')&&
    !path.includes('/pre-iva/');
  var loginUrl=esRaiz?LOGIN_PAGE:'../'+LOGIN_PAGE;

  // ── Módulo actual ────────────────────────────────────────────────────────────
  var MODULO_ACTUAL=(function(){
    if(path.includes('/clientes/'))           return 'clientes';
    if(path.includes('/pir/'))                return 'pir';
    if(path.includes('/pre-iva/'))            return 'pre-iva';
    if(path.includes('/reportes-rrhh/'))      return 'reportes-rrhh';
    if(path.includes('/reportes-contable/'))  return 'reportes-contable';
    if(path.includes('/reportes-pagos/'))     return 'reportes-pagos';
    if(path.includes('/panel-de-control/'))   return 'panel-de-control';
    if(path.includes('/pagos/'))              return 'pagos';
    if(path.includes('/conciliacion/'))       return 'conciliacion';
    if(path.includes('/cobranza/'))           return 'cobranza';
    if(path.includes('/convenios/'))          return 'convenios';
    if(path.includes('/portal/'))             return 'portal';
    if(path.includes('/planes/'))             return 'planes';
    if(path.includes('/admin/'))              return 'admin';
    if(path.includes('/performance/'))        return 'performance';
    return 'dashboard';
  })();

  var ROL_REDIRECT={
    rrhh:     'reportes-rrhh/index.html',
    contable: 'reportes-contable/index.html',
    pagos:    'reportes-pagos/index.html',
    cobranza: 'cobranza/index.html'
  };

  var MODULOS_POR_ROL={
    master:   ['*'],
    admin:    ['*'],
    rrhh:     ['dashboard','reportes-rrhh','panel-de-control','clientes','pre-iva'],
    contable: ['dashboard','reportes-contable','panel-de-control','clientes','pir','pre-iva','planes'],
    pagos:    ['dashboard','reportes-pagos','pagos','conciliacion','panel-de-control','clientes'],
    cobranza: ['dashboard','cobranza','conciliacion','clientes']
  };

  function puedeVerModulo(perfil,modulo){
    if(perfil.es_master||perfil.esMaster) return true;
    var permisos=MODULOS_POR_ROL[perfil.rol]||perfil.modulos||[];
    if(permisos[0]==='*') return true;
    if(modulo==='dashboard') return true;
    return permisos.includes(modulo)||(perfil.modulos||[]).includes(modulo);
  }

  function redirigirLogin(){
    window.location.href=loginUrl;
  }

  function mostrarAccesoDenegado(){
    document.addEventListener('DOMContentLoaded',function(){
      document.body.innerHTML=
        '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0ebff;font-family:sans-serif">'
        +'<div style="text-align:center;padding:40px">'
        +'<div style="font-size:48px;margin-bottom:16px">\u26d4</div>'
        +'<h2 style="color:#904891;font-size:20px;margin-bottom:8px">Acceso denegado</h2>'
        +'<p style="color:#5c4a5d;margin-bottom:20px">No tienes permiso para acceder a este m\u00f3dulo.</p>'
        +'<a href="'+(esRaiz?'index.html':'../index.html')+'" '
        +'style="background:#904891;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">\u2190 Volver</a>'
        +'</div></div>';
    });
  }

  // ── Función central de logout ────────────────────────────────────────────────
  // Un único punto de salida para todos los botones/handlers de Gestoor.
  function cerrarSesionGestoor(){
    var client=window._sbAuthClient;
    var doLogout=function(){
      window._contadoorSesion=null;
      sessionStorage.removeItem('usuario_activo');
      localStorage.removeItem('gestoor_sesion');
      localStorage.removeItem('usuario_sesion');
      // gestoor_email_guardado se conserva para pre-llenar el correo en el próximo login
      window.location.replace(loginUrl); // replace evita volver con el botón Atrás
    };
    if(client){
      client.auth.signOut().then(doLogout).catch(doLogout);
    }else{
      doLogout();
    }
  }

  function inyectarTopbar(sesion){
    document.addEventListener('DOMContentLoaded',function(){
      var topbar=document.querySelector('.topbar');
      if(!topbar) return;

      // Badge de usuario (nombre + rol)
      var badge=document.createElement('div');
      badge.style.cssText='display:flex;align-items:center;gap:8px;margin-right:8px;flex-shrink:0';
      badge.innerHTML=
        '<div style="width:28px;height:28px;border-radius:50%;background:rgba(144,72,145,.3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0">'
        +(sesion.iniciales||sesion.nombre.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase())
        +'</div>'
        +'<div style="text-align:right">'
        +'<div style="font-size:11px;font-weight:600;color:rgba(255,255,255,.8)">'+sesion.nombre+'</div>'
        +'<div style="font-size:9px;color:rgba(255,255,255,.3)">'+(sesion.rolLabel||sesion.rol)+'</div>'
        +'</div>';

      // Detectar si ya existe un botón Salir en el HTML estático (#btnLogout o texto "Salir")
      var btnExistente=document.getElementById('btnLogout')
        ||Array.from(topbar.querySelectorAll('button')).find(function(b){
            return b.textContent.trim()==='Salir';
          });

      if(btnExistente){
        // REUTILIZAR el botón existente — sobrescribir su onclick legacy
        // para que ejecute el logout real de Supabase
        btnExistente.onclick=function(){
          if(confirm('\u00bfCerrar sesi\u00f3n?')) cerrarSesionGestoor();
        };
        // Asegurarse de que sea visible si el HTML lo ocultaba
        if(btnExistente.style.display==='none') btnExistente.style.display='';
        // Insertar badge antes del botón existente
        topbar.insertBefore(badge, btnExistente);
      }else{
        // No existe botón Salir — crear uno
        var btnLogout=document.createElement('button');
        btnLogout.textContent='Salir';
        btnLogout.style.cssText='background:rgba(255,255,255,.08);color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;font-family:inherit;flex-shrink:0';
        btnLogout.onclick=function(){
          if(confirm('\u00bfCerrar sesi\u00f3n?')) cerrarSesionGestoor();
        };
        var lastBtn=topbar.querySelector('button:last-child');
        if(lastBtn) topbar.insertBefore(badge,lastBtn);
        else topbar.appendChild(badge);
        topbar.appendChild(btnLogout);
      }
    });
  }

  // ── Lógica principal de verificación ────────────────────────────────────────
  function verificarSesionAuth(){
    var client=window._sbAuthClient;
    if(!client){
      console.warn('[auth.js] _sbAuthClient no disponible. Redirigiendo al login.');
      redirigirLogin();
      return;
    }

    // getUser() verifica el JWT contra el servidor Supabase — no solo localStorage.
    // Es la fuente de identidad autorizada. getSession() solo lee cache local.
    client.auth.getUser().then(function(result){
      var user=result.data&&result.data.user;
      var authErr=result.error;

      // Sin usuario verificado por el servidor → login
      if(authErr||!user){
        redirigirLogin();
        return;
      }

      // Cargar perfil desde public.usuarios usando el UID verificado
      client.from('usuarios')
        .select('id,nombre,iniciales,rol,rol_label,es_master,activo,modulos,wa,email')
        .eq('auth_user_id',user.id)
        .single()
        .then(function(profileResult){
          var perfil=profileResult.data;
          var err=profileResult.error;

          // Perfil no encontrado → signOut + login
          if(err||!perfil){
            console.warn('[auth.js] Perfil no encontrado en public.usuarios para UID:',user.id);
            sessionStorage.removeItem('usuario_activo');
            client.auth.signOut().then(redirigirLogin).catch(redirigirLogin);
            return;
          }
          // Perfil inactivo → signOut + login
          if(!perfil.activo){
            console.warn('[auth.js] Usuario inactivo:',perfil.email);
            sessionStorage.removeItem('usuario_activo');
            client.auth.signOut().then(redirigirLogin).catch(redirigirLogin);
            return;
          }

          // Cache visual — compatible con módulos existentes (mismo formato de siempre)
          // SOLO cache de interfaz. La fuente de autenticación es Supabase Auth + public.usuarios.
          var sesion={
            id:perfil.id,
            nombre:perfil.nombre,
            iniciales:perfil.iniciales||(perfil.nombre.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase()),
            rol:perfil.rol,
            rolLabel:perfil.rol_label||perfil.rol,
            email:perfil.email||user.email||'',
            wa:perfil.wa||'',
            esMaster:perfil.es_master===true,  // siempre desde perfil BD, nunca hardcodeado
            modulos:perfil.modulos||[],
            tsLogin:Date.now()
          };
          sessionStorage.setItem('usuario_activo',JSON.stringify(sesion));
          window._contadoorSesion=sesion;

          // Auto-redirect por rol si entra al dashboard
          if(MODULO_ACTUAL==='dashboard'&&!perfil.es_master){
            var redirect=ROL_REDIRECT[perfil.rol];
            if(redirect){ window.location.href=redirect; return; }
          }

          // Control de acceso al módulo actual
          if(!puedeVerModulo(perfil,MODULO_ACTUAL)){
            mostrarAccesoDenegado();
            return;
          }

          // Sesión válida — inyectar topbar
          inyectarTopbar(sesion);
        })
        .catch(function(e){
          console.error('[auth.js] Error cargando perfil:',e);
          redirigirLogin();
        });
    }).catch(function(e){
      console.error('[auth.js] Error en getUser:',e);
      redirigirLogin();
    });
  }

  // Esperar a que el SDK esté listo
  if(window._sbAuthReady){
    verificarSesionAuth();
  }else{
    window.addEventListener('gestoor-auth-ready',verificarSesionAuth);
  }

})();
