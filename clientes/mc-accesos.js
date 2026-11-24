/* ============================================================
   clientes/mc-accesos.js — Accesos MiContadoor en la ficha del cliente (Clientes → detalle) · hallazgo H-MONT-2
   El equipo crea y administra las cuentas del portal mi.contadoor.cl de cada cliente:
     · listar   → RPC public.mc_accesos_listar(p_cliente_id)
     · invitar  → Edge mc-invitar {accion:'invitar'} (crea la cuenta o vincula otra empresa a una cuenta que ya existe)
     · reenviar → Edge mc-invitar {accion:'reenviar'} (solo cuentas aún 'invitada')
     · revocar  → RPC public.mc_acceso_revocar(p_ref, p_motivo)
     · permisos → RPC public.mc_acceso_permisos(p_ref, p_ver_mi_cuenta, p_ver_facturas, p_motivo)
     · reactivar un acceso revocado = alta nueva con el mismo correo (Edge 'invitar'); el servidor decide si se puede.
       MC1D: si la cuenta quedó 'revocada' (era su única empresa) solo el Master la reabre con ese alta ('cuenta_reabierta').
     · cuenta   → RPC public.mc_cuenta_estado_por_ref(p_ref, 'suspender'|'reactivar'|'cerrar_sesiones', p_motivo) (MC1D):
       suspender / reactivar solo el Master; cerrar sesiones quien puede dar altas. El ref es opaco: nunca se ve el auth_user_id.
     · términos → muestra si la persona aceptó los términos vigentes (campos terminos_al_dia / terminos_version, si vienen).
   Quién la ve: lo decide el SERVIDOR con public.mc_yo() → puede_dar_alta (Master o quien tenga el permiso de alta que otorga
   el Master). Fail-closed: error, respuesta rara o MC_SIN_PERMISO → la sección no se muestra. La pantalla no decide permisos:
   cada RPC y la Edge lo revalidan con el JWT del usuario.
   Seguridad: todo texto de la base pasa por esc(); nunca se registran correos, nombres ni el JWT en la consola; JWT solo vía
   sbFetch / sbH de ../supabase.js (nunca la clave anon como Bearer).
   Los avisos de la campana los crea el servidor (mc.alta y mc.revocacion → Masters); aquí solo se recarga la campana.
   Pruebas: node --test pruebas/mc_accesos.test.mjs (dobles de las RPC y de la Edge; datos ficticios).
   ============================================================ */
(function (raiz, fabrica) {
  var M = fabrica();
  if (typeof module === 'object' && module && module.exports) module.exports = M;
  if (raiz && raiz.document) { raiz.MCAccesos = M.navegador(raiz); raiz.MCAccesos._lib = M; }   // _lib: funciones puras para mc-panel.js
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /* ── Reglas que repiten las del servidor (el servidor manda; esto solo evita viajes inútiles) ── */
  var CORREO_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;           // mismo patrón que mc-invitar y mc.cuentas
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var ROLES = { titular: 'Titular', consulta: 'Adicional (consulta)' };
  var EDGE = 'mc-invitar';

  var MENSAJES = {
    NO_SESSION: 'Tu sesión terminó. Vuelve a ingresar a Gestoor.',
    RED: 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.',
    MC_SIN_PERMISO: 'Tu usuario no tiene permiso para administrar accesos a MiContadoor (lo otorga el Master).',
    MC_DATOS: 'Revisa los datos: correo válido, rol y un motivo de 3 a 300 letras.',
    MC_LIMITE: 'Se alcanzó el límite de altas o reenvíos por hoy. Inténtalo mañana o avisa al Master.',
    MC_CORREO_NO_DISPONIBLE: 'Ese correo no se puede usar en MiContadoor (es del equipo de Contadoor o ya tiene otra cuenta). Usa otro correo.',
    MC_CUENTA_NO_VIGENTE: 'La cuenta de esa persona está suspendida o cerrada: no se le puede dar acceso desde aquí. Avisa al Master.',
    MC_YA_ACTIVA: 'La persona ya activó su cuenta: no hace falta reenviar la invitación (puede usar «¿Olvidaste tu contraseña?»).',
    MC_SIN_VINCULO_VIGENTE: 'Esa persona ya no tiene un acceso vigente a esta empresa.',
    MC_NADA_QUE_REENVIAR: 'No hay una invitación pendiente para ese correo.',
    MC_NO_ENCONTRADO: 'El acceso ya no está vigente (puede que otra persona lo haya cambiado). Se recargó la lista.',
    MC_SOLO_SUSPENDIDA: 'Solo se puede reactivar una cuenta suspendida. Una cuenta cerrada vuelve con «Reactivar acceso» (lo hace el Master).',
    MC_CORREO_NO_ENVIADO: 'No se pudo enviar el correo de MiContadoor. No se envió nada al cliente: inténtalo de nuevo en unos minutos o avisa al Master.',
    MC_ERROR: 'El servidor no pudo completar la acción. Inténtalo de nuevo; si se repite, avisa al Master.'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function normCorreo(s) { return typeof s === 'string' ? s.trim().toLowerCase() : ''; }
  function correoValido(s) { var c = normCorreo(s); return c.length > 0 && c.length <= 254 && CORREO_RE.test(c); }
  function motivoValido(m) { var t = typeof m === 'string' ? m.trim() : ''; return t.length >= 3 && t.length <= 300; }
  function clienteValido(id) { var n = Number(id); return Number.isSafeInteger(n) && n > 0; }
  function permisosPorDefecto(rol) { var t = rol === 'titular'; return { ver_mi_cuenta: t, ver_facturas: t }; }

  /* Fecha y hora de Chile (dd-mm-aaaa · hh:mm). Sin fecha → null. */
  function fFechaHora(iso) {
    if (!iso) return null;
    var d = new Date(iso); if (isNaN(d.getTime())) return null;
    try {
      var p = {}; new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
        .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return p.day + '-' + p.month + '-' + p.year + ' · ' + p.hour + ':' + p.minute;
    } catch (e) { return d.toISOString().slice(0, 16).replace('T', ' · '); }
  }

  /* Código de error del servidor: PostgREST {code, message:'MC_…'} o Edge {error:'MC_…'}. */
  function codigoDe(x) {
    var m = x && (x.codigo || x.error || x.message);
    var c = (String(m || '').match(/^([A-Z][A-Z0-9_]{2,40})\b/) || [])[1];
    return c || null;
  }
  function mensajeError(codigo) { return MENSAJES[codigo] || MENSAJES.MC_ERROR; }
  function error(codigo, status) { var e = new Error(codigo); e.codigo = codigo; e.status = status || 0; return e; }

  /* ── Estado visible de un acceso (fila de mc_accesos_listar) ── */
  function estadoVisible(a) {
    if (!a || typeof a !== 'object') return { clave: 'desconocido', texto: 'Estado desconocido' };
    if (a.estado_acceso === 'revocado') return { clave: 'revocado', texto: 'Revocado' };
    if (a.estado_acceso !== 'vigente') return { clave: 'desconocido', texto: 'Estado desconocido' };
    switch (a.estado_cuenta) {
      case 'invitada': return { clave: 'invitado', texto: 'Invitado' };
      case 'activa': return { clave: 'activo', texto: 'Activo' };
      case 'suspendida': return { clave: 'suspendido', texto: 'Cuenta suspendida' };
      case 'revocada': return { clave: 'revocado', texto: 'Revocado' };
      default: return { clave: 'desconocido', texto: 'Estado desconocido' };
    }
  }

  /* Acciones posibles para un acceso dentro de la lista completa (la regla final la aplica el servidor). */
  function accionesPara(a, lista, esMaster) {
    esMaster = esMaster === true;
    var r = { acciones: [], nota: null };
    if (!a || !UUID_RE.test(String(a.ref || ''))) { r.nota = 'Acceso sin identificador válido: no se puede modificar.'; return r; }
    var e = estadoVisible(a).clave;
    if (e === 'invitado') r.acciones = ['reenviar', 'permisos', 'cerrar_sesiones'].concat(esMaster ? ['suspender'] : [], ['revocar']);
    else if (e === 'activo') r.acciones = ['permisos', 'cerrar_sesiones'].concat(esMaster ? ['suspender'] : [], ['revocar']);
    else if (e === 'suspendido') {
      r.acciones = (esMaster ? ['reactivar_cuenta'] : []).concat(['permisos', 'revocar']);
      r.nota = esMaster ? 'Cuenta suspendida: no puede ingresar a MiContadoor (en ninguna de sus empresas) hasta que la reactives.'
        : 'El Master suspendió la cuenta completa: no puede ingresar hasta que la reactive.';
    }
    else if (e === 'revocado') {
      var correo = normCorreo(a.correo);
      var otraVigente = (lista || []).some(function (b) { return b !== a && b && b.estado_acceso === 'vigente' && normCorreo(b.correo) === correo; });
      if (otraVigente) r.nota = 'Esta persona ya tiene un acceso vigente (más arriba).';
      else if (a.estado_cuenta === 'invitada' || a.estado_cuenta === 'activa') r.acciones = ['reactivar'];
      else if (a.estado_cuenta === 'revocada') {
        if (esMaster) { r.acciones = ['reactivar']; r.nota = 'La cuenta quedó cerrada (era su única empresa). Como Master puedes reabrirla con «Reactivar».'; }
        else r.nota = 'La cuenta quedó cerrada (era su única empresa). Solo el Master puede reabrirla: avísale.';
      }
      else if (a.estado_cuenta === 'suspendida') r.nota = 'La cuenta está suspendida por el Master: no se puede reactivar este acceso.';
      else r.nota = 'Estado de la cuenta desconocido: no se puede reactivar.';
    } else r.nota = 'Estado desconocido: no se puede modificar.';
    return r;
  }

  /* Lista: solo objetos; primero los vigentes y luego los revocados (cada grupo, como viene del servidor: más reciente primero). */
  function ordenar(lista) {
    var filas = (Array.isArray(lista) ? lista : []).filter(function (x) { return x && typeof x === 'object'; });
    return filas.filter(function (x) { return x.estado_acceso === 'vigente'; }).concat(filas.filter(function (x) { return x.estado_acceso !== 'vigente'; }));
  }

  /* ── Validación del formulario de invitación ── */
  function validarInvitacion(d) {
    d = d || {};
    var errores = {};
    var correo = normCorreo(d.correo);
    var nombre = typeof d.nombre === 'string' ? d.nombre.trim() : '';
    var rol = d.rol;
    var motivo = typeof d.motivo === 'string' ? d.motivo.trim() : '';
    if (!correoValido(correo)) errores.correo = 'Escribe un correo válido (ejemplo: nombre@empresa.cl).';
    if (nombre.length > 120) errores.nombre = 'El nombre puede tener hasta 120 letras.';
    if (!ROLES[rol]) errores.rol = 'Elige Titular o Adicional (consulta).';
    if (!motivoValido(motivo)) errores.motivo = 'Explica el motivo (3 a 300 letras); queda en la auditoría.';
    var def = permisosPorDefecto(rol);
    var vmc = typeof d.ver_mi_cuenta === 'boolean' ? d.ver_mi_cuenta : def.ver_mi_cuenta;
    var vf = typeof d.ver_facturas === 'boolean' ? d.ver_facturas : def.ver_facturas;
    var ok = Object.keys(errores).length === 0;
    return { ok: ok, errores: errores, datos: ok ? { correo: correo, nombre: nombre || null, rol: rol, motivo: motivo, ver_mi_cuenta: vmc, ver_facturas: vf } : null };
  }

  /* ── Acceso real: RPC por sbFetch y Edge por sbH (ambos de ../supabase.js, con el JWT del usuario) ── */
  function crearApiReal(env) {
    function leer(r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
        return { status: r.status, ok: r.ok, cuerpo: j };
      });
    }
    return {
      rpc: function (fn, args) {
        if (!/^mc_[a-z_]+$/.test(fn)) return Promise.reject(error('MC_ERROR'));   // esta pantalla solo llama RPC public.mc_*
        var p;
        try {
          p = env.sbFetch('rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
        } catch (e) { return Promise.reject(error(e && e.message === 'GESTOOR_NO_SESSION' ? 'NO_SESSION' : 'MC_ERROR')); }
        return Promise.resolve(p).then(leer, function (e) {
          throw error(e && e.message === 'GESTOOR_NO_SESSION' ? 'NO_SESSION' : (e && e.codigo) || 'RED');
        }).then(function (x) {
          if (x.ok) return x.cuerpo;
          var c = codigoDe(x.cuerpo);
          if (!c && x.status === 401) c = 'NO_SESSION';
          if (!c && (x.status === 403 || (x.cuerpo && x.cuerpo.code === '42501'))) c = 'MC_SIN_PERMISO';
          throw error(c || 'MC_ERROR', x.status);
        });
      },
      edge: function (cuerpo) {
        var h;
        try { h = env.sbH({ 'Content-Type': 'application/json' }); }
        catch (e) {
          if (env.avisarSinSesion) env.avisarSinSesion('functions/v1/' + EDGE);
          return Promise.resolve({ status: 401, cuerpo: { error: 'NO_SESSION' } });
        }
        return Promise.resolve().then(function () {
          return env.fetch(env.SB_URL + '/functions/v1/' + EDGE, { method: 'POST', headers: h, body: JSON.stringify(cuerpo) });
        }).then(leer, function () { throw error('RED'); }).then(function (x) { return { status: x.status, cuerpo: x.cuerpo || {} }; });
      }
    };
  }

  /* ── Controlador: flujos sin DOM (probados con dobles) ──
     Cada acción devuelve {ok, tipo:'exito'|'aviso'|'error', mensaje, ocultar?, recargar?}. ocultar = el servidor negó el permiso. */
  function crearControlador(deps) {
    var api = deps.api;
    var ocupado = false;
    function campana() { try { if (deps.recargarCampana) deps.recargarCampana(); } catch (e) { /* la campana nunca rompe la acción */ } }
    function fallo(codigo) {
      return { ok: false, tipo: 'error', codigo: codigo, mensaje: mensajeError(codigo), ocultar: codigo === 'MC_SIN_PERMISO', recargar: codigo === 'MC_NO_ENCONTRADO' };
    }
    function exclusivo(fn) {
      return function () {
        if (ocupado) return Promise.resolve({ ok: false, tipo: 'aviso', codigo: 'OCUPADO', mensaje: 'Hay otra acción en curso. Espera a que termine.' });
        ocupado = true;
        var args = arguments;
        return Promise.resolve().then(function () { return fn.apply(null, args); })
          .catch(function (e) { return fallo((e && e.codigo) || 'MC_ERROR'); })
          .then(function (r) { ocupado = false; return r; });
      };
    }
    function edgeResultado(x) {
      var c = x && x.cuerpo;
      if (x && x.status === 200 && c && c.ok === true) return { ok: true, resultado: c.resultado, acceso_ref: c.acceso_ref || null };
      var cod = codigoDe(c);
      if (!cod) cod = x && x.status === 401 ? 'NO_SESSION' : x && x.status === 403 ? 'MC_SIN_PERMISO' : 'MC_ERROR';
      if (cod === 'METODO') cod = 'MC_ERROR';
      return { ok: false, codigo: cod };
    }

    function cargar(clienteId) {
      if (!clienteValido(clienteId)) return Promise.resolve({ visible: false });
      return api.rpc('mc_yo').then(function (yo) {
        if (!yo || yo.puede_dar_alta !== true) return { visible: false };
        return api.rpc('mc_accesos_listar', { p_cliente_id: Number(clienteId) }).then(function (lista) {
          if (!Array.isArray(lista)) return { visible: true, es_master: yo.es_master === true, error: mensajeError('MC_ERROR'), accesos: [] };
          return { visible: true, es_master: yo.es_master === true, accesos: ordenar(lista) };
        }, function (e) {
          var c = (e && e.codigo) || 'MC_ERROR';
          if (c === 'MC_SIN_PERMISO' || c === 'NO_SESSION') return { visible: false };
          return { visible: true, es_master: yo.es_master === true, error: mensajeError(c), accesos: [] };
        });
      }, function () { return { visible: false }; });   // fail-closed: cualquier error de mc_yo oculta la sección
    }

    function altaConPermisos(clienteId, d, textos) {
      return api.edge({ accion: 'invitar', cliente_id: Number(clienteId), correo: d.correo, nombre: d.nombre, rol: d.rol, motivo: d.motivo }).then(function (x) {
        var r = edgeResultado(x);
        if (!r.ok) return fallo(r.codigo);
        campana();
        if (r.resultado === 'ya_vinculado') return { ok: true, tipo: 'aviso', mensaje: 'Esa persona ya tenía un acceso vigente a esta empresa. No se cambió nada.', recargar: true };
        var base = r.resultado === 'cuenta_creada' ? textos.creada : r.resultado === 'empresa_vinculada' ? textos.vinculada
          : r.resultado === 'cuenta_reabierta' ? (textos.reabierta || textos.vinculada) : null;
        if (!base) return { ok: true, tipo: 'aviso', mensaje: 'El servidor respondió sin el resultado esperado. Revisa la lista.', recargar: true };
        var def = permisosPorDefecto(d.rol);
        if (d.ver_mi_cuenta === def.ver_mi_cuenta && d.ver_facturas === def.ver_facturas) return { ok: true, tipo: 'exito', mensaje: base, recargar: true };
        if (!UUID_RE.test(String(r.acceso_ref || ''))) return { ok: true, tipo: 'aviso', mensaje: base + ' Los permisos quedaron los del rol: ajústalos con «Permisos».', recargar: true };
        return api.rpc('mc_acceso_permisos', { p_ref: r.acceso_ref, p_ver_mi_cuenta: d.ver_mi_cuenta, p_ver_facturas: d.ver_facturas, p_motivo: d.motivo })
          .then(function () { return { ok: true, tipo: 'exito', mensaje: base + ' Permisos ajustados.', recargar: true }; },
            function () { return { ok: true, tipo: 'aviso', mensaje: base + ' Pero no se pudieron ajustar los permisos: revísalos con «Permisos».', recargar: true }; });
      });
    }

    var invitar = exclusivo(function (clienteId, datos) {
      if (!clienteValido(clienteId)) return fallo('MC_DATOS');
      var v = validarInvitacion(datos);
      if (!v.ok) return { ok: false, tipo: 'error', codigo: 'VALIDACION', errores: v.errores, mensaje: 'Revisa los campos marcados.' };
      return altaConPermisos(clienteId, v.datos, {
        creada: 'Cuenta creada. Le llegó un correo a la persona para activar MiContadoor (el enlace dura 24 h).',
        vinculada: 'La persona ya tenía cuenta en MiContadoor: se le sumó esta empresa (no se envió otro correo).'
      });
    });

    var reactivar = exclusivo(function (clienteId, a, motivo) {
      if (!clienteValido(clienteId) || !a || !correoValido(a.correo) || !ROLES[a.rol]) return fallo('MC_DATOS');
      if (!motivoValido(motivo)) return { ok: false, tipo: 'error', codigo: 'VALIDACION', errores: { motivo: 'Explica el motivo (3 a 300 letras).' }, mensaje: 'Revisa los campos marcados.' };
      var d = { correo: normCorreo(a.correo), nombre: typeof a.nombre === 'string' && a.nombre.trim() ? a.nombre.trim().slice(0, 120) : null, rol: a.rol, motivo: motivo.trim(),
        ver_mi_cuenta: a.ver_mi_cuenta === true, ver_facturas: a.ver_facturas === true };
      return altaConPermisos(clienteId, d, {
        creada: 'Acceso reactivado: se creó una cuenta nueva y le llegó un correo para activarla.',
        vinculada: 'Acceso reactivado: la persona vuelve a ver esta empresa en MiContadoor (no se envió correo).',
        reabierta: 'Acceso reactivado: el Master reabrió la cuenta. Sus sesiones anteriores no sirven; entra con su contraseña de siempre (o «¿Olvidaste tu contraseña?»).'
      });
    });

    var reenviar = exclusivo(function (clienteId, a, motivo) {
      if (!clienteValido(clienteId) || !a || !correoValido(a.correo) || !ROLES[a.rol]) return fallo('MC_DATOS');
      if (!motivoValido(motivo)) return { ok: false, tipo: 'error', codigo: 'VALIDACION', errores: { motivo: 'Explica el motivo (3 a 300 letras).' }, mensaje: 'Revisa los campos marcados.' };
      return api.edge({ accion: 'reenviar', cliente_id: Number(clienteId), correo: normCorreo(a.correo), rol: a.rol, motivo: motivo.trim() }).then(function (x) {
        var r = edgeResultado(x);
        if (!r.ok) return fallo(r.codigo);
        if (r.resultado === 'ya_reenviada') return { ok: true, tipo: 'aviso', mensaje: 'La invitación ya se reenvió hace menos de 2 minutos. Pídele a la persona que revise su correo (y la carpeta de no deseados).' };
        if (r.resultado === 'reenviada') return { ok: true, tipo: 'exito', mensaje: 'Invitación reenviada. El enlace anterior deja de servir; el nuevo dura 24 h.', recargar: true };
        return { ok: true, tipo: 'aviso', mensaje: 'El servidor respondió sin el resultado esperado. Revisa la lista.', recargar: true };
      });
    });

    var revocar = exclusivo(function (a, motivo) {
      if (!a || !UUID_RE.test(String(a.ref || ''))) return fallo('MC_DATOS');
      if (!motivoValido(motivo)) return { ok: false, tipo: 'error', codigo: 'VALIDACION', errores: { motivo: 'Explica el motivo (3 a 300 letras); queda en la auditoría.' }, mensaje: 'Revisa los campos marcados.' };
      return api.rpc('mc_acceso_revocar', { p_ref: a.ref, p_motivo: motivo.trim() }).then(function (r) {
        if (!r || r.ok !== true) return fallo('MC_ERROR');
        campana();
        return { ok: true, tipo: 'exito', recargar: true, mensaje: r.cuenta_revocada === true
          ? 'Acceso revocado. Era su única empresa: su cuenta de MiContadoor quedó cerrada y se cerraron sus sesiones.'
          : 'Acceso revocado. La persona deja de ver esta empresa de inmediato (conserva sus otras empresas).' };
      });
    });

    var permisos = exclusivo(function (a, verMiCuenta, verFacturas, motivo) {
      if (!a || !UUID_RE.test(String(a.ref || '')) || typeof verMiCuenta !== 'boolean' || typeof verFacturas !== 'boolean') return fallo('MC_DATOS');
      if (!motivoValido(motivo)) return { ok: false, tipo: 'error', codigo: 'VALIDACION', errores: { motivo: 'Explica el motivo (3 a 300 letras); queda en la auditoría.' }, mensaje: 'Revisa los campos marcados.' };
      return api.rpc('mc_acceso_permisos', { p_ref: a.ref, p_ver_mi_cuenta: verMiCuenta, p_ver_facturas: verFacturas, p_motivo: motivo.trim() }).then(function (r) {
        if (!r || r.ok !== true) return fallo('MC_ERROR');
        return { ok: true, tipo: 'exito', recargar: true, mensaje: 'Permisos guardados. Se aplican en la siguiente pantalla que abra la persona.' };
      });
    });

    var ACC_CUENTA = { suspender: 1, reactivar: 1, cerrar_sesiones: 1 };
    var cuentaEstado = exclusivo(function (a, accion, motivo) {
      if (!a || !UUID_RE.test(String(a.ref || '')) || !ACC_CUENTA[accion]) return fallo('MC_DATOS');
      if (!motivoValido(motivo)) return { ok: false, tipo: 'error', codigo: 'VALIDACION', errores: { motivo: 'Explica el motivo (3 a 300 letras); queda en la auditoría.' }, mensaje: 'Revisa los campos marcados.' };
      return api.rpc('mc_cuenta_estado_por_ref', { p_ref: a.ref, p_accion: accion, p_motivo: motivo.trim() }).then(function (r) {
        if (!r || r.ok !== true) return fallo('MC_ERROR');
        campana();
        return { ok: true, tipo: 'exito', recargar: true, mensaje: accion === 'suspender'
          ? 'Cuenta suspendida. La persona no puede entrar a MiContadoor (en ninguna empresa) y se cerraron sus sesiones.'
          : accion === 'reactivar' ? 'Cuenta reactivada. La persona puede volver a ingresar con su contraseña.'
            : 'Sesiones cerradas. La persona tendrá que volver a ingresar en todos sus aparatos.' };
      });
    });

    return { cargar: cargar, invitar: invitar, reenviar: reenviar, revocar: revocar, reactivar: reactivar, permisos: permisos, cuentaEstado: cuentaEstado };
  }

  /* ── Vista (HTML como texto; todo lo dinámico pasa por esc) ── */
  var PROPIOS = { plus: '<path d="M5 12h14"/><path d="M12 5v14"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>', pausa: '<circle cx="12" cy="12" r="10"/><path d="M10 15V9"/><path d="M14 15V9"/>' };   // íconos que gestoor-menu.js no trae
  function ic(nombre, clase, icono) { return '<i class="ic ' + (clase || '') + '">' + (icono ? icono(nombre) : '') + '</i>'; }
  var BOTONES = {
    reenviar: ['correo', 'ic-cel', 'Reenviar invitación', ''],
    permisos: ['lapiz', 'ic-ama', 'Permisos', ''],
    revocar: ['candado', 'ic-roj', 'Revocar', 'mca-peligro'],
    reactivar: ['repetir', 'ic-ver', 'Reactivar', ''],
    cerrar_sesiones: ['salir', 'ic-cel', 'Cerrar sesiones', ''],
    suspender: ['pausa', 'ic-amb', 'Suspender cuenta', ''],
    reactivar_cuenta: ['repetir', 'ic-ver', 'Reactivar cuenta', '']
  };
  /* Términos: solo si el servidor manda los campos (MICONTADOOR-APERTURA). */
  function terminosTexto(a) {
    if (!a || typeof a.terminos_al_dia !== 'boolean') return null;
    if (a.terminos_al_dia) return { clave: 'si', texto: 'Términos aceptados' + (a.terminos_version ? ' (versión ' + a.terminos_version + ')' : '') };
    return { clave: 'no', texto: a.terminos_version ? 'Debe aceptar los términos nuevos (aceptó la ' + a.terminos_version + ')' : 'Aún no acepta los términos' };
  }
  function renderFila(a, idx, lista, icono, esMaster) {
    var e = estadoVisible(a), acc = accionesPara(a, lista, esMaster);
    var nombre = a.nombre ? esc(a.nombre) : esc(a.correo || 'Sin correo');
    var h = '<article class="mca-fila mca-' + e.clave + '" data-mca-i="' + idx + '">';
    h += '<div class="mca-quien">' + ic('clientes', a.rol === 'titular' ? 'ic-mor' : 'ic-cel', icono) + '<div><b>' + nombre + '</b>'
      + (a.nombre ? '<span>' + esc(a.correo || '') + '</span>' : '') + '</div></div>';
    h += '<div class="mca-chips"><span class="mca-rol mca-rol-' + (a.rol === 'titular' ? 'titular' : 'consulta') + '">' + esc(ROLES[a.rol] || 'Rol desconocido') + '</span>'
      + '<span class="mca-est mca-est-' + e.clave + '">' + esc(e.texto) + '</span></div>';
    h += '<div class="mca-perm"><span class="' + (a.ver_mi_cuenta === true ? 'si' : 'no') + '">' + ic(a.ver_mi_cuenta === true ? 'check' : 'menos', a.ver_mi_cuenta === true ? 'ic-ver' : '', icono) + 'Mi cuenta (pagos)</span>'
      + '<span class="' + (a.ver_facturas === true ? 'si' : 'no') + '">' + ic(a.ver_facturas === true ? 'check' : 'menos', a.ver_facturas === true ? 'ic-ver' : '', icono) + 'Facturas</span></div>';
    var f = [];
    var otorgado = fFechaHora(a.otorgado_at), ultimo = fFechaHora(a.ultimo_ingreso_at), revocado = fFechaHora(a.revocado_at);
    if (otorgado) f.push((e.clave === 'invitado' ? 'Invitado el ' : 'Acceso desde el ') + esc(otorgado));
    if (e.clave !== 'revocado') f.push(ultimo ? 'Último ingreso: ' + esc(ultimo) : 'Aún no ingresa');
    if (revocado) f.push('Revocado el ' + esc(revocado));
    var tt = e.clave === 'revocado' ? null : terminosTexto(a);
    if (tt) h += '<div class="mca-term mca-term-' + tt.clave + '">' + ic(tt.clave === 'si' ? 'check' : 'alerta', tt.clave === 'si' ? 'ic-ver' : 'ic-amb', icono) + '<span>' + esc(tt.texto) + '</span></div>';
    if (f.length) h += '<div class="mca-fechas">' + ic('reloj', 'ic-amb', icono) + '<span>' + f.join(' · ') + '</span></div>';
    if (acc.nota) h += '<p class="mca-nota">' + ic('info', 'ic-cel', icono) + '<span>' + esc(acc.nota) + '</span></p>';
    if (acc.acciones.length) {
      h += '<div class="mca-acc">' + acc.acciones.map(function (k) {
        var b = BOTONES[k];
        return '<button type="button" class="mca-btn ' + b[3] + '" data-mca-accion="' + k + '" data-mca-i="' + idx + '">' + ic(b[0], b[1], icono) + esc(b[2]) + '</button>';
      }).join('') + '</div>';
    }
    return h + '</article>';
  }
  function renderSeccion(est, icono) {
    est = est || {};
    var accesos = Array.isArray(est.accesos) ? est.accesos : [];
    var vig = accesos.filter(function (x) { return x.estado_acceso === 'vigente'; }).length;
    var h = '<div class="mca-cab"><div class="mca-tit">' + ic('llave', 'ic-cel mca-placa', icono) + '<div><h3>MiContadoor</h3>'
      + '<p>Accesos del cliente al portal mi.contadoor.cl' + (est.cargando ? '' : ' · ' + vig + (vig === 1 ? ' vigente' : ' vigentes')) + '</p></div></div>'
      + '<button type="button" class="mca-btn mca-prim" data-mca-accion="invitar"' + (est.cargando || est.error ? ' disabled' : '') + '>' + ic('plus', '', icono) + 'Invitar persona</button></div>';
    if (est.banner) h += '<div class="mca-banner mca-banner-' + esc(est.banner.tipo) + '" role="status">' + ic(est.banner.tipo === 'error' ? 'alerta' : 'check', est.banner.tipo === 'error' ? 'ic-roj' : est.banner.tipo === 'aviso' ? 'ic-amb' : 'ic-ver', icono) + '<span>' + esc(est.banner.mensaje) + '</span></div>';
    if (est.cargando) return h + '<p class="mca-vacio">Cargando accesos…</p>';
    if (est.error) return h + '<p class="mca-vacio mca-err" role="alert">' + esc(est.error) + '</p>';
    if (!accesos.length) return h + '<p class="mca-vacio">Este cliente aún no tiene accesos a MiContadoor. Invita al titular con «Invitar persona».</p>';
    var hayRev = false;
    var filas = accesos.map(function (a, i) {
      var sep = '';
      if (a.estado_acceso !== 'vigente' && !hayRev) { hayRev = true; sep = '<h4 class="mca-sub">Revocados</h4>'; }
      return sep + renderFila(a, i, accesos, icono, est.es_master === true);
    }).join('');
    return h + '<div class="mca-lista">' + filas + '</div>';
  }

  /* ── Navegador: monta la sección dentro de la ficha y maneja los diálogos ── */
  function navegador(win) {
    var doc = win.document;
    var api = null, ctl = null;
    var vista = { el: null, cliente: null, est: null, turno: 0 };
    function icono(n) {
      if (PROPIOS[n]) return '<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + PROPIOS[n] + '</svg>';
      return typeof win.gIcon === 'function' ? win.gIcon(n) : '';
    }
    function ctrl() {
      if (ctl) return ctl;
      api = crearApiReal({
        sbFetch: function (p, o) { return win.sbFetch(p, o); },
        sbH: function (x) { return win.sbH(x); },
        fetch: function (u, o) { return win.fetch(u, o); },
        SB_URL: win.SB_URL,
        avisarSinSesion: function (path) { win.dispatchEvent(new win.CustomEvent('gestoor-session-required', { detail: { path: path, reason: 'GESTOOR_NO_SESSION' } })); }
      });
      ctl = crearControlador({ api: api, recargarCampana: function () { if (typeof win.gestoorCampanaRecargar === 'function') win.gestoorCampanaRecargar(); } });
      return ctl;
    }
    function pintar() {
      if (!vista.el) return;
      if (!vista.est || !vista.est.visible) { vista.el.hidden = true; vista.el.innerHTML = ''; return; }
      vista.el.hidden = false;
      vista.el.innerHTML = renderSeccion(vista.est, icono);
    }
    function recargar(banner) {
      var turno = ++vista.turno, cli = vista.cliente;
      return ctrl().cargar(cli.id).then(function (r) {
        if (turno !== vista.turno) return;          // se abrió otro cliente entretanto
        r.banner = banner || null; vista.est = r; pintar();
      });
    }
    function montar(contenedor, cliente) {
      cerrarDialogo();
      vista.turno++;
      var el = doc.createElement('section');
      el.className = 'mca'; el.id = 'mcAccesos'; el.hidden = true; el.setAttribute('aria-label', 'Accesos MiContadoor');
      contenedor.appendChild(el);
      vista.el = el; vista.cliente = { id: Number(cliente && cliente.id), razon: String((cliente && cliente.razon) || '') };
      vista.est = null;
      el.addEventListener('click', alClic);
      if (!clienteValido(vista.cliente.id)) return Promise.resolve();
      return recargar(null);
    }
    function resultado(r) {
      if (r.ocultar) { vista.est = { visible: false }; pintar(); cerrarDialogo(); if (typeof win.toast === 'function') win.toast(r.mensaje); return true; }
      if (!r.ok) return false;
      cerrarDialogo();
      if (r.recargar) recargar({ tipo: r.tipo, mensaje: r.mensaje });
      else { vista.est.banner = { tipo: r.tipo, mensaje: r.mensaje }; pintar(); }
      if (typeof win.toast === 'function' && r.tipo === 'exito') win.toast(r.mensaje.split('.')[0] + '.');
      return true;
    }
    function alClic(ev) {
      var b = ev.target.closest && ev.target.closest('[data-mca-accion]');
      if (!b || b.disabled || !vista.est || !vista.est.visible) return;
      var k = b.getAttribute('data-mca-accion');
      var a = b.hasAttribute('data-mca-i') ? vista.est.accesos[Number(b.getAttribute('data-mca-i'))] : null;
      if (k === 'invitar') return dlgInvitar();
      if (!a) return;
      if (k === 'reenviar') return dlgReenviar(a);
      if (k === 'revocar') return dlgRevocar(a);
      if (k === 'reactivar') return dlgReactivar(a);
      if (k === 'permisos') return dlgPermisos(a);
      if (k === 'cerrar_sesiones' || k === 'suspender' || k === 'reactivar_cuenta') return dlgCuenta(a, k === 'reactivar_cuenta' ? 'reactivar' : k);
    }

    /* Diálogo propio (encima de la ficha). pasos: función que devuelve {titulo, html, ok, okClase, alAceptar(m) → Promise|false} */
    var dlg = null;
    function cerrarDialogo() {
      if (!dlg) return; var d = dlg; dlg = null;
      doc.removeEventListener('keydown', d.tecla, true);
      d.velo.remove(); d.m.remove();
      try { if (d.foco && d.foco.focus) d.foco.focus(); } catch (e) { /* nada */ }
    }
    function dialogo(p) {
      cerrarDialogo();
      var velo = doc.createElement('div'); velo.className = 'mca-velo';
      var m = doc.createElement('div'); m.className = 'mca-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-labelledby', 'mcaDlgT');
      doc.body.appendChild(velo); doc.body.appendChild(m);
      dlg = { velo: velo, m: m, foco: doc.activeElement, tecla: function (e) { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); cerrarDialogo(); } } };
      doc.addEventListener('keydown', dlg.tecla, true);
      velo.addEventListener('click', cerrarDialogo);
      paso(p);
    }
    function paso(p) {
      var m = dlg.m;
      m.innerHTML = '<h3 id="mcaDlgT">' + ic(p.icono || 'llave', p.icClase || 'ic-cel', icono) + esc(p.titulo) + '</h3><div class="mca-mcuerpo">' + p.html + '</div>'
        + '<p class="mca-merr" role="alert"></p><div class="mca-macc"><button type="button" class="mca-btn" data-m="no">' + esc(p.cancelar || 'Cancelar') + '</button>'
        + '<button type="button" class="mca-btn ' + (p.okClase || 'mca-prim') + '" data-m="si">' + esc(p.ok || 'Confirmar') + '</button></div>';
      m.querySelector('[data-m="no"]').addEventListener('click', p.alCancelar || cerrarDialogo);
      var si = m.querySelector('[data-m="si"]'), err = m.querySelector('.mca-merr');
      si.addEventListener('click', function () {
        if (si.disabled) return;
        err.textContent = '';
        m.querySelectorAll('.mca-campo-err').forEach(function (x) { x.textContent = ''; });
        var r = p.alAceptar(m);
        if (!r || typeof r.then !== 'function') return;
        var txt = si.innerHTML; si.disabled = true; si.innerHTML = '<span class="mca-spin"></span>' + esc(p.trabajando || 'Enviando…');
        r.then(function (x) {
          if (!dlg || dlg.m !== m) return;
          si.disabled = false; si.innerHTML = txt;
          if (x && !resultado(x)) {
            err.textContent = x.mensaje || 'No se pudo completar.';
            if (x.errores) Object.keys(x.errores).forEach(function (k) { var c = m.querySelector('[data-err="' + k + '"]'); if (c) c.textContent = x.errores[k]; });
            if (x.recargar) recargar(null);
          }
        });
      });
      if (p.alAbrir) p.alAbrir(m);
      var f = m.querySelector('input:not([type=radio]):not([type=checkbox]),textarea,button[data-m="si"]'); if (f) setTimeout(function () { try { f.focus(); } catch (e) { /* nada */ } }, 30);
    }
    function campoMotivo(valor, ayuda) {
      return '<label class="mca-campo"><span>Motivo <small>(queda en la auditoría)</small></span><textarea id="mcaMotivo" rows="2" maxlength="300" placeholder="' + esc(ayuda || 'Ej.: lo pidió el cliente por correo') + '">' + esc(valor || '') + '</textarea><em class="mca-campo-err" data-err="motivo"></em></label>';
    }
    function val(m, id) { var e = m.querySelector('#' + id); return e ? e.value : ''; }
    function chk(m, id) { var e = m.querySelector('#' + id); return !!(e && e.checked); }
    function razon() { return '<b>' + esc(vista.cliente.razon || 'este cliente') + '</b>'; }

    function dlgInvitar(previo) {
      var d = previo || { correo: '', nombre: '', rol: 'titular', motivo: '', ver_mi_cuenta: true, ver_facturas: true, tocado: false };
      dialogo({ titulo: 'Invitar a MiContadoor', icono: 'correo', ok: 'Revisar y confirmar', html:
          '<p class="mca-intro">La persona recibirá un correo para crear su contraseña y ver ' + razon() + ' en mi.contadoor.cl.</p>'
        + '<label class="mca-campo"><span>Correo</span><input id="mcaCorreo" type="email" inputmode="email" autocomplete="off" maxlength="254" value="' + esc(d.correo) + '" placeholder="nombre@empresa.cl"><em class="mca-campo-err" data-err="correo"></em></label>'
        + '<label class="mca-campo"><span>Nombre <small>(opcional)</small></span><input id="mcaNombre" type="text" maxlength="120" autocomplete="off" value="' + esc(d.nombre) + '" placeholder="Nombre y apellido"><em class="mca-campo-err" data-err="nombre"></em></label>'
        + '<fieldset class="mca-campo mca-roles"><legend>Rol</legend>'
        + '<label class="mca-op"><input type="radio" name="mcaRol" value="titular"' + (d.rol === 'titular' ? ' checked' : '') + '><span><b>Titular</b><small>Dueño o representante. Por defecto ve todo.</small></span></label>'
        + '<label class="mca-op"><input type="radio" name="mcaRol" value="consulta"' + (d.rol === 'consulta' ? ' checked' : '') + '><span><b>Adicional (consulta)</b><small>Otra persona de la empresa. Por defecto sin pagos ni facturas.</small></span></label>'
        + '<em class="mca-campo-err" data-err="rol"></em></fieldset>'
        + '<fieldset class="mca-campo mca-permisos"><legend>Permisos en esta empresa</legend>'
        + '<label class="mca-op"><input type="checkbox" id="mcaVmc"' + (d.ver_mi_cuenta ? ' checked' : '') + '><span><b>Mi cuenta</b><small>Estado de pagos y datos de transferencia.</small></span></label>'
        + '<label class="mca-op"><input type="checkbox" id="mcaVf"' + (d.ver_facturas ? ' checked' : '') + '><span><b>Facturas</b><small>Facturas de nuestros servicios.</small></span></label></fieldset>'
        + campoMotivo(d.motivo, 'Ej.: onboarding del cliente, lo pidió el titular'),
        alAbrir: function (m) {
          m.querySelectorAll('input[name="mcaRol"]').forEach(function (r) {
            r.addEventListener('change', function () {
              if (d.tocado) return;                      // si ya marcó permisos a mano, no se pisan
              var def = permisosPorDefecto(r.value);
              m.querySelector('#mcaVmc').checked = def.ver_mi_cuenta; m.querySelector('#mcaVf').checked = def.ver_facturas;
            });
          });
          ['mcaVmc', 'mcaVf'].forEach(function (id) { m.querySelector('#' + id).addEventListener('change', function () { d.tocado = true; }); });
        },
        alAceptar: function (m) {
          var rolSel = m.querySelector('input[name="mcaRol"]:checked');
          var datos = { correo: val(m, 'mcaCorreo'), nombre: val(m, 'mcaNombre'), rol: rolSel ? rolSel.value : '', motivo: val(m, 'mcaMotivo'),
            ver_mi_cuenta: chk(m, 'mcaVmc'), ver_facturas: chk(m, 'mcaVf'), tocado: d.tocado };
          var v = validarInvitacion(datos);
          if (!v.ok) {
            m.querySelector('.mca-merr').textContent = 'Revisa los campos marcados.';
            Object.keys(v.errores).forEach(function (k) { var c = m.querySelector('[data-err="' + k + '"]'); if (c) c.textContent = v.errores[k]; });
            return false;
          }
          confirmarInvitacion(datos, v.datos);
          return false;
        } });
    }
    function confirmarInvitacion(borrador, d) {
      var si = function (b) { return b ? '<b class="t-si">Sí</b>' : '<b class="t-no">No</b>'; };
      paso({ titulo: '¿Confirmas la invitación?', icono: 'enviar', icClase: 'ic-amb', ok: 'Sí, invitar', cancelar: 'Volver', trabajando: 'Invitando…',
        alCancelar: function () { dlgInvitar(borrador); },
        html: '<p class="mca-intro">Vas a dar acceso a MiContadoor a:</p><dl class="mca-resumen">'
          + '<dt>Correo</dt><dd>' + esc(d.correo) + '</dd>' + (d.nombre ? '<dt>Nombre</dt><dd>' + esc(d.nombre) + '</dd>' : '')
          + '<dt>Empresa</dt><dd>' + esc(vista.cliente.razon || '—') + '</dd><dt>Rol</dt><dd>' + esc(ROLES[d.rol]) + '</dd>'
          + '<dt>Mi cuenta</dt><dd>' + si(d.ver_mi_cuenta) + '</dd><dt>Facturas</dt><dd>' + si(d.ver_facturas) + '</dd><dt>Motivo</dt><dd>' + esc(d.motivo) + '</dd></dl>'
          + '<p class="mca-aviso">' + ic('alerta', 'ic-amb', icono) + '<span>Si el correo no tiene cuenta, se le envía un correo para activarla. Si ya tiene cuenta de MiContadoor, solo se le suma esta empresa. Revisa que el correo sea el correcto: es la llave de entrada del cliente.</span></p>',
        alAceptar: function () { return ctrl().invitar(vista.cliente.id, d); } });
    }
    function quien(a) { return '<b>' + esc(a.nombre || a.correo) + '</b>' + (a.nombre ? ' (' + esc(a.correo) + ')' : ''); }
    function dlgReenviar(a) {
      dialogo({ titulo: 'Reenviar invitación', icono: 'correo', ok: 'Sí, reenviar', trabajando: 'Reenviando…',
        html: '<p class="mca-intro">Se enviará un correo nuevo a ' + quien(a) + ' para activar MiContadoor. El enlace anterior deja de servir.</p>' + campoMotivo('Reenvío de la invitación', ''),
        alAceptar: function (m) { return ctrl().reenviar(vista.cliente.id, a, val(m, 'mcaMotivo')); } });
    }
    function dlgRevocar(a) {
      dialogo({ titulo: 'Revocar acceso', icono: 'candado', icClase: 'ic-roj', ok: 'Sí, revocar acceso', okClase: 'mca-peligro-prim', trabajando: 'Revocando…',
        html: '<p class="mca-intro">' + quien(a) + ' dejará de ver ' + razon() + ' en MiContadoor <b>de inmediato</b>.</p>'
          + '<p class="mca-aviso">' + ic('alerta', 'ic-roj', icono) + '<span>Si es su única empresa, su cuenta se cierra y se cierran todas sus sesiones. Para volver a darle acceso habrá que pedirlo al Master.</span></p>'
          + campoMotivo('', 'Ej.: ya no trabaja en la empresa, término del servicio'),
        alAceptar: function (m) { return ctrl().revocar(a, val(m, 'mcaMotivo')); } });
    }
    function dlgReactivar(a) {
      dialogo({ titulo: 'Reactivar acceso', icono: 'repetir', icClase: 'ic-ver', ok: 'Sí, reactivar', trabajando: 'Reactivando…',
        html: '<p class="mca-intro">' + quien(a) + ' volverá a ver ' + razon() + ' como <b>' + esc(ROLES[a.rol] || '') + '</b>, con los mismos permisos que tenía.</p>' + campoMotivo('', 'Ej.: vuelve a trabajar con la empresa'),
        alAceptar: function (m) { return ctrl().reactivar(vista.cliente.id, a, val(m, 'mcaMotivo')); } });
    }
    function dlgPermisos(a) {
      dialogo({ titulo: 'Permisos en esta empresa', icono: 'lapiz', icClase: 'ic-ama', ok: 'Guardar permisos', trabajando: 'Guardando…',
        html: '<p class="mca-intro">Qué ve ' + quien(a) + ' de ' + razon() + ' en MiContadoor.</p><fieldset class="mca-campo mca-permisos"><legend>Permisos</legend>'
          + '<label class="mca-op"><input type="checkbox" id="mcaVmc"' + (a.ver_mi_cuenta === true ? ' checked' : '') + '><span><b>Mi cuenta</b><small>Estado de pagos y datos de transferencia.</small></span></label>'
          + '<label class="mca-op"><input type="checkbox" id="mcaVf"' + (a.ver_facturas === true ? ' checked' : '') + '><span><b>Facturas</b><small>Facturas de nuestros servicios.</small></span></label></fieldset>'
          + campoMotivo('', 'Ej.: el encargado pidió que vea los pagos'),
        alAceptar: function (m) { return ctrl().permisos(a, chk(m, 'mcaVmc'), chk(m, 'mcaVf'), val(m, 'mcaMotivo')); } });
    }

    var DLG_CUENTA = {
      cerrar_sesiones: { t: 'Cerrar sesiones', i: 'salir', c: 'ic-cel', ok: 'Sí, cerrar sesiones', okc: 'mca-prim', w: 'Cerrando…',
        txt: function (a) { return quien(a) + ' tendrá que volver a ingresar con su contraseña en todos sus aparatos. Su acceso sigue igual.'; }, ayuda: 'Ej.: perdió su celular, cambio de computador' },
      suspender: { t: 'Suspender cuenta', i: 'pausa', c: 'ic-amb', ok: 'Sí, suspender', okc: 'mca-peligro-prim', w: 'Suspendiendo…',
        txt: function (a) { return quien(a) + ' <b>no podrá entrar a MiContadoor en ninguna de sus empresas</b> hasta que la reactives. Sus accesos no se borran.'; }, ayuda: 'Ej.: sospecha de uso indebido, lo pidió el titular' },
      reactivar: { t: 'Reactivar cuenta', i: 'repetir', c: 'ic-ver', ok: 'Sí, reactivar', okc: 'mca-prim', w: 'Reactivando…',
        txt: function (a) { return quien(a) + ' podrá volver a ingresar a MiContadoor con su contraseña.'; }, ayuda: 'Ej.: se aclaró la situación' }
    };
    function dlgCuenta(a, accion) {
      var x = DLG_CUENTA[accion];
      dialogo({ titulo: x.t, icono: x.i, icClase: x.c, ok: x.ok, okClase: x.okc, trabajando: x.w,
        html: '<p class="mca-intro">' + x.txt(a) + '</p>' + campoMotivo('', x.ayuda),
        alAceptar: function (m) { return ctrl().cuentaEstado(a, accion, val(m, 'mcaMotivo')); } });
    }

    return { montar: montar, cerrarDialogo: cerrarDialogo };
  }

  return {
    CORREO_RE: CORREO_RE, MENSAJES: MENSAJES, ROLES: ROLES, esc: esc, normCorreo: normCorreo, correoValido: correoValido, motivoValido: motivoValido,
    permisosPorDefecto: permisosPorDefecto, fFechaHora: fFechaHora, codigoDe: codigoDe, mensajeError: mensajeError, estadoVisible: estadoVisible,
    accionesPara: accionesPara, ordenar: ordenar, terminosTexto: terminosTexto, validarInvitacion: validarInvitacion, crearApiReal: crearApiReal, crearControlador: crearControlador,
    renderSeccion: renderSeccion, navegador: navegador
  };
});
