// auth.js — Gestoor v4 · Supabase Auth nativo · Guard global
// Cargar DESPUÉS de supabase.js en todos los módulos protegidos.
// El HTML debe tener <html class="auth-pending"> y el guard CSS en el <head>.
// Opcionalmente declarar: <script>window.GESTOOR_MODULO='pagos';</script>

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

  // ── Identificador de módulo ──────────────────────────────────────────────────
  // Prioridad: declaración explícita del HTML > detección por pathname
  function detectarModuloDesdePath(){
    if(path.includes('/clientes/'))          return 'clientes';
    if(path.includes('/pir/'))               return 'pir';
    if(path.includes('/pre-iva/'))           return 'pre-iva';
    if(path.includes('/reportes-rrhh/'))     return 'reportes-rrhh';
    if(path.includes('/reportes-contable/')) return 'reportes-contable';
    if(path.includes('/reportes-pagos/'))    return 'reportes-pagos';
    if(path.includes('/panel-de-control/'))  return 'panel-de-control';
    if(path.includes('/pagos/'))             return 'pagos';
    if(path.includes('/conciliacion/'))      return 'conciliacion';
    if(path.includes('/cobranza/'))          return 'cobranza';
    if(path.includes('/convenios/'))         return 'convenios';
    if(path.includes('/portal/'))            return 'portal';
    if(path.includes('/planes/'))            return 'planes';
    if(path.includes('/admin/'))             return 'admin';
    if(path.includes('/performance/'))       return 'performance';
    if(path.includes('/reportes/'))          return 'reportes';
    return 'dashboard';
  }
  var MODULO_ACTUAL=window.GESTOOR_MODULO||detectarModuloDesdePath();

  // ── Tabla de redirección por rol ─────────────────────────────────────────────
  var ROL_REDIRECT={
    rrhh:     'reportes-rrhh/index.html',
    contable: 'reportes-contable/index.html',
    pagos:    'reportes-pagos/index.html',
    cobranza: 'cobranza/index.html'
  };

  // ── Permisos por rol ─────────────────────────────────────────────────────────
  var MODULOS_POR_ROL={
    master:   ['*'],
    admin:    ['*'],
    rrhh:     ['dashboard','reportes-rrhh','panel-de-control','clientes','pre-iva'],
    contable: ['dashboard','reportes-contable','panel-de-control','clientes','pir','pre-iva','planes','reportes'],
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

  // ── NAV1-R3: Navegación lateral por permisos — visual ────────────────────────
  // Tres estados: AUTORIZADO (normal) | BLOQUEADO (tenue+🔒) | FUTURO (intacto)
  // Futura única de verdad: reutiliza puedeVerModulo() y MODULOS_POR_ROL.
  // Solo UX — protección real de URL permanece en puedeVerModulo(perfil,MODULO_ACTUAL).

  // ── CSS de sidebar — inyectado una sola vez en <head> ──────────────────────
  function inyectarEstilosSidebar(){
    if(document.getElementById('gestoor-nav-styles')) return;
    var st=document.createElement('style');
    st.id='gestoor-nav-styles';
    st.textContent=
      // Encabezados de sección reforzados (.sb-section clientes / .sb-sec resto)
      '.sb-section,.sb-sec{font-size:10px!important;font-weight:800!important;'+
      'letter-spacing:1.5px!important;color:#C77BC9!important;'+
      'text-transform:uppercase!important;padding:14px 8px 5px!important;'+
      'display:flex!important;align-items:center!important;gap:6px!important;}'+
      // Línea morada decorativa hacia la derecha
      '.sb-section::after,.sb-sec::after{content:"";flex:1;height:1px;'+
      'background:linear-gradient(to right,rgba(199,123,201,.4),transparent);margin-left:4px;}'+
      // Módulo bloqueado por permisos:
      //   58% opacidad → legible pero diferenciado de autorizado (100%) y futuro (40%)
      '.sb-item.nav-locked{opacity:.58!important;pointer-events:none!important;cursor:default!important;}'+
      // Candado al extremo derecho
      '.sb-item.nav-locked .nav-lock-icon{margin-left:auto;font-size:10px;opacity:.7;flex-shrink:0;}'+
      // NAV1-R4: Scroll global del sidebar — cubre ambas variantes del contenedor de nav:
      //   <nav> sin clase (clientes)
      //   <nav class="sb-nav"> (todos los demás módulos)
      // min-height:0 es imprescindible para que overflow-y:auto funcione en flex:
      //   sin él, min-height:auto permite que el nav crezca más allá del contenedor.
      // overflow-x:hidden previene scrollbar horizontal por el ::after de secciones.
      // flex:1 no se toca — ya está declarado en el CSS embebido de cada módulo
      //   y la cascade lo preserva correctamente.
      '.sidebar nav,.sidebar .sb-nav{'+
      'overflow-y:auto!important;'+
      'overflow-x:hidden!important;'+
      'min-height:0!important;}'+
      // Scrollbar discreto acorde a Gestoor.
      // width:3px permanentemente delgado en WebKit/Blink.
      // macOS overlay-scrollbar: thumb visible solo al desplazar.
      // Windows/Linux clásico: thumb visible cuando hay overflow.
      // Sin lógica :hover — comportamiento depende del SO/navegador.
      '.sidebar nav::-webkit-scrollbar,'+
      '.sidebar .sb-nav::-webkit-scrollbar{width:3px;}'+
      '.sidebar nav::-webkit-scrollbar-thumb,'+
      '.sidebar .sb-nav::-webkit-scrollbar-thumb{'+
      'background:rgba(199,123,201,.4);'+
      'border-radius:3px;}'+
      '.sidebar nav::-webkit-scrollbar-track,'+
      '.sidebar .sb-nav::-webkit-scrollbar-track{background:transparent;}';
    document.head.appendChild(st);
  }

  // ── Marcar link como BLOQUEADO por permisos ──────────────────────────────
  // Futuros (pointer-events:none inline) nunca llegan aquí — filtrados antes.
  // Idempotente: no duplica candado si ya fue marcado.
  function marcarModuloBloqueado(link){
    if(link.classList.contains('nav-locked')) return;  // ya marcado
    link.classList.add('nav-locked');
    link.setAttribute('aria-disabled','true');
    link.setAttribute('tabindex','-1');
    var lock=document.createElement('span');
    lock.className='nav-lock-icon';
    lock.textContent='\uD83D\uDD12';  // 🔒
    link.appendChild(lock);
  }

  // ── Restaurar link a AUTORIZADO ──────────────────────────────────────────
  // Limpia nav-locked, aria-disabled, tabindex y candado.
  // No toca links futuros (que tienen pointer-events:none inline — nunca tienen nav-locked).
  function marcarModuloPermitido(link){
    if(!link.classList.contains('nav-locked')) return;  // nada que limpiar
    link.classList.remove('nav-locked');
    link.removeAttribute('aria-disabled');
    link.removeAttribute('tabindex');
    var lock=link.querySelector('.nav-lock-icon');
    if(lock) link.removeChild(lock);
  }

  // ── Aplicar permisos de navegación ───────────────────────────────────────
  // Llamada por auth.js en whenReady(), antes de revelarContenido().
  function aplicarPermisosNavegacion(sesion){
    // Inyectar CSS de sidebar (idempotente — solo una vez por página)
    inyectarEstilosSidebar();

    // Master: limpiar cualquier nav-locked previo; todos los existentes clickeables
    if(!sesion||sesion.esMaster){
      document.querySelectorAll('.sidebar a.nav-locked').forEach(marcarModuloPermitido);
      return;
    }

    // Cobranza: sidebar con diseño diferente — no interferir
    if(typeof MODULO_ACTUAL!=='undefined'&&MODULO_ACTUAL==='cobranza') return;

    document.querySelectorAll('.sidebar a[href]').forEach(function(link){
      // FUTUROS: href="#" + pointer-events:none inline → conservar intactos, sin candado
      if(link.style.pointerEvents==='none') return;

      var href=link.getAttribute('href')||'';

      // Parser explícito — dos únicos patrones del sidebar
      var modId;
      if(href==='../index.html'){
        modId='dashboard';
      }else if(href.startsWith('../')&&href.endsWith('/index.html')){
        modId=href.slice(3,href.length-'/index.html'.length);
      }else{
        return;  // href='#' sin pointer-events (edge case) → no tocar
      }

      // Admin: solo rol admin explícito (master ya devolvió arriba)
      var autorizado;
      if(modId==='admin'){
        autorizado=(sesion.rol==='admin');
      }else{
        // puedeVerModulo: misma semántica que auth.js; sesion equivale a perfil
        autorizado=puedeVerModulo(sesion,modId);
      }

      if(autorizado){
        marcarModuloPermitido(link);   // limpiar si estaba bloqueado (cambio de permisos)
      }else{
        marcarModuloBloqueado(link);   // visible + 🔒 + no clickeable + aria-disabled
      }
    });
  }

  // ── Helper: ejecutar cuando el DOM esté listo ────────────────────────────────
  // Soluciona la race condition: cuando auth.js corre de forma asíncrona
  // (después de getUser + consulta BD), DOMContentLoaded ya disparó.
  function whenReady(fn){
    if(document.readyState==='loading'){
      document.addEventListener('DOMContentLoaded',fn);
    }else{
      fn(); // DOM ya está listo — ejecutar inmediatamente
    }
  }

  // ── Revelar contenido (quitar protección anti-flash) ─────────────────────────
  // Solo se llama cuando Auth confirma identidad + perfil activo + permiso.
  // NUNCA se llama por timeout. FAIL CLOSED.
  function revelarContenido(){
    document.documentElement.classList.remove('auth-pending');
  }

  // ── Redirección al login (fail-closed) ───────────────────────────────────────
  function redirigirLogin(){
    // replace() evita que el botón Atrás regrese a la página protegida
    window.location.replace(loginUrl);
  }

  // ── Acceso denegado ──────────────────────────────────────────────────────────
  function mostrarAccesoDenegado(){
    revelarContenido(); // revelar para que el mensaje sea visible
    whenReady(function(){
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
  function cerrarSesionGestoor(){
    var client=window._sbAuthClient;
    var doLogout=function(){
      window._contadoorSesion=null;
      sessionStorage.removeItem('usuario_activo');
      localStorage.removeItem('gestoor_sesion');
      localStorage.removeItem('usuario_sesion');
      // gestoor_email_guardado se conserva para pre-llenar correo en el próximo login
      window.location.replace(loginUrl);
    };
    if(client){
      client.auth.signOut().then(doLogout).catch(doLogout);
    }else{
      doLogout();
    }
  }

  // ── Inyectar topbar con identidad real ───────────────────────────────────────
  function inyectarTopbar(sesion){
    whenReady(function(){

      // ── MODO DASHBOARD: reutilizar #sessionBadge y #btnLogout nativos ────────
      var sbNativo=document.getElementById('sessionBadge');
      var btnNativo=document.getElementById('btnLogout');

      if(sbNativo){
        sbNativo.textContent=sesion.nombre+' \u00b7 '+(sesion.rolLabel||sesion.rol);
      }
      if(btnNativo){
        btnNativo.onclick=function(){
          if(confirm('\u00bfCerrar sesi\u00f3n?')) cerrarSesionGestoor();
        };
        btnNativo.style.display='block';
        btnNativo.removeAttribute('disabled');
      }

      // stat-usuario (dashboard)
      var statU=document.getElementById('stat-usuario');
      if(statU) statU.textContent=sesion.nombre.split(' ')[0];

      // Si había elementos nativos, el dashboard ya está completo
      if(sbNativo||btnNativo) return;

      // ── MODO MÓDULO: insertar badge en .topbar ───────────────────────────────
      var topbar=document.querySelector('.topbar');
      if(!topbar) return;

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

      var btnEnTopbar=Array.from(topbar.querySelectorAll('button')).find(function(b){
        return b.textContent.trim()==='Salir'||b.id==='btnLogout';
      });

      if(btnEnTopbar){
        btnEnTopbar.onclick=function(){
          if(confirm('\u00bfCerrar sesi\u00f3n?')) cerrarSesionGestoor();
        };
        if(btnEnTopbar.style.display==='none') btnEnTopbar.style.display='';
        topbar.insertBefore(badge,btnEnTopbar);
      }else{
        var btnNuevo=document.createElement('button');
        btnNuevo.textContent='Salir';
        btnNuevo.style.cssText='background:rgba(255,255,255,.08);color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;font-family:inherit;flex-shrink:0';
        btnNuevo.onclick=function(){
          if(confirm('\u00bfCerrar sesi\u00f3n?')) cerrarSesionGestoor();
        };
        var lastBtn=topbar.querySelector('button:last-child');
        if(lastBtn) topbar.insertBefore(badge,lastBtn);
        else topbar.appendChild(badge);
        topbar.appendChild(btnNuevo);
      }
    });
  }

  // ── Verificación principal ───────────────────────────────────────────────────
  function verificarSesionAuth(){
    var client=window._sbAuthClient;
    if(!client){
      // SDK no disponible → fail-closed: contenido permanece oculto y redirige
      console.warn('[auth.js] _sbAuthClient no disponible. Fail-closed → login.');
      redirigirLogin();
      return;
    }

    // getUser() verifica el JWT contra el servidor Supabase (no solo localStorage)
    client.auth.getUser().then(function(result){
      var user=result.data&&result.data.user;
      var authErr=result.error;

      // Sin usuario verificado → fail-closed
      if(authErr||!user){
        redirigirLogin();
        return;
      }

      // Cargar perfil desde public.usuarios
      client.from('usuarios')
        .select('id,nombre,iniciales,rol,rol_label,es_master,activo,modulos,wa,email')
        .eq('auth_user_id',user.id)
        .single()
        .then(function(profileResult){
          var perfil=profileResult.data;
          var err=profileResult.error;

          // Sin perfil → signOut + fail-closed
          if(err||!perfil){
            console.warn('[auth.js] Perfil no encontrado para UID:',user.id);
            sessionStorage.removeItem('usuario_activo');
            client.auth.signOut().then(redirigirLogin).catch(redirigirLogin);
            return;
          }
          // Perfil inactivo → signOut + fail-closed
          if(!perfil.activo){
            console.warn('[auth.js] Usuario inactivo:',perfil.email);
            sessionStorage.removeItem('usuario_activo');
            client.auth.signOut().then(redirigirLogin).catch(redirigirLogin);
            return;
          }

          // Identidad confirmada — construir cache visual (compatible con módulos)
          var sesion={
            id:perfil.id,
            nombre:perfil.nombre,
            iniciales:perfil.iniciales||(perfil.nombre.split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase()),
            rol:perfil.rol,
            rolLabel:perfil.rol_label||perfil.rol,
            email:perfil.email||user.email||'',
            wa:perfil.wa||'',
            esMaster:perfil.es_master===true,
            modulos:perfil.modulos||[],
            tsLogin:Date.now()
          };
          sessionStorage.setItem('usuario_activo',JSON.stringify(sesion));
          window._contadoorSesion=sesion;

          // ADMIN-USUARIOS-1: getter read-only de módulos base por rol.
          // Retorna copia del array (slice) — nunca la referencia interna.
          // admin/index.html lo consume para separar base de adicionales.
          // master/admin devuelven [] (acceso total, sin lista fija).
          window.gestoorGetModulosBaseRol=function(rol){
            var base=MODULOS_POR_ROL[rol];
            if(!base) return [];
            if(base[0]==='*') return [];
            return base.slice();
          };

          // Auto-redirect analistas desde dashboard
          if(MODULO_ACTUAL==='dashboard'&&!perfil.es_master){
            var redirect=ROL_REDIRECT[perfil.rol];
            if(redirect){ window.location.replace(redirect); return; }
          }

          // Control de acceso al módulo actual
          if(!puedeVerModulo(perfil,MODULO_ACTUAL)){
            mostrarAccesoDenegado(); // revelar + mensaje (no redirige al login)
            return;
          }

          // ── ACCESO CONCEDIDO ─────────────────────────────────────────────────
          // NAV1: orden estructuralmente garantizado dentro del mismo whenReady.
          // aplicarPermisosNavegacion completa ANTES de revelarContenido — sin flash.
          whenReady(function(){
            aplicarPermisosNavegacion(sesion);  // 1. ocultar links no autorizados
            revelarContenido();                  // 2. retirar auth-pending → contenido visible
            inyectarTopbar(sesion);             // 3. insertar badge de usuario
          });

        }).catch(function(e){
          console.error('[auth.js] Error cargando perfil:',e);
          redirigirLogin(); // fail-closed
        });

    }).catch(function(e){
      console.error('[auth.js] Error en getUser:',e);
      redirigirLogin(); // fail-closed
    });
  }

  // Esperar SDK
  if(window._sbAuthReady){
    verificarSesionAuth();
  }else{
    window.addEventListener('gestoor-auth-ready',verificarSesionAuth);
  }

  // ── Listener: sesión requerida desde sbFetch ──────────────────────────────
  // Se emite cuando sbFetch detecta _gestoorAccessToken === null tras SDK listo,
  // o cuando vence el timeout del CDN (reason: GESTOOR_SDK_TIMEOUT).
  // Delega en cerrarSesionGestoor() para limpieza completa:
  //   signOut() + sessionStorage + localStorage(gestoor_sesion, usuario_sesion)
  //   + location.replace(loginUrl).
  // _redirigiendo evita múltiples redirecciones simultáneas.
  // No aplica en login.html (ese archivo no carga auth.js).
  var _redirigiendo=false;
  window.addEventListener('gestoor-session-required',function(e){
    if(_redirigiendo) return;
    _redirigiendo=true;
    var pathInfo=(e&&e.detail&&e.detail.path)||'';
    var reason=(e&&e.detail&&e.detail.reason)||'GESTOOR_NO_SESSION';
    console.warn('[auth.js] gestoor-session-required — '+reason+(pathInfo?' Path: '+pathInfo:''));
    cerrarSesionGestoor();
  });

})();
