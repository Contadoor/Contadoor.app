// ═══════════════════════════════════════════════════════════════════════
// correo-gestoor.js — Envío ÚNICO de correos a clientes (Edge gestoor-correo-enviar).
// Decisión 22-oct-2026: todo correo a un cliente sale desde Gestoor con "De: Contadoor <reportes@contadoor.cl>",
// "Responder a: el analista del cliente" y queda registrado. Reemplaza al proxy de Vercel (contafunnel-v2).
//
// Ronda 2 (decisión de Luciano 22-oct): el correo lo GENERA el servidor con la plantilla aprobada. El navegador manda tipo, cliente_id,
// periodo (AAAA-MM), una clave de intención y los DATOS (montos). Solo el Master puede mandar contenido editado (contenido_html).
// Destinatarios (ficha del cliente), asunto, remitente, responder-a y franja de empresa/RUT/período los decide el servidor.
// Requiere supabase.js antes (SB_URL, SB_KEY, _gestoorAccessToken). Sin sesión → error, nunca la clave anon como Bearer.
// ═══════════════════════════════════════════════════════════════════════
(function(){
  'use strict';
  var FN='/functions/v1/gestoor-correo-enviar';

  function nuevaClave(prefijo){
    var r=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+Math.random().toString(36).slice(2));
    return String(prefijo||'envio').replace(/[^A-Za-z0-9_-]/g,'').slice(0,40)+'-'+r.replace(/[^A-Za-z0-9-]/g,'');
  }

  function llamar(cuerpo){
    var tok=window._gestoorAccessToken||(typeof _gestoorAccessToken!=='undefined'?_gestoorAccessToken:null);
    if(!tok){
      window.dispatchEvent(new CustomEvent('gestoor-session-required',{detail:{path:FN,reason:'GESTOOR_NO_SESSION'}}));
      return Promise.resolve({ok:false,codigo:'SESION',mensaje:'Tu sesión expiró: vuelve a ingresar.'});
    }
    return fetch(SB_URL+FN,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+tok},
      body:JSON.stringify(cuerpo)
    }).then(function(r){
      return r.json().catch(function(){return {ok:false,codigo:'HTTP_'+r.status};}).then(function(d){d=d||{};d.http=r.status;return d;});
    },function(){return {ok:false,codigo:'RED',mensaje:'Sin conexión con Gestoor. Revisa internet y reintenta.'};});
  }

  // Mensaje claro para el analista según el resultado.
  function mensaje(d){
    if(d.ok&&d.estado==='ya_enviado')return 'Este correo ya se había enviado: no se duplicó.';
    // "enviado" = Microsoft aceptó el correo para envío (no es confirmación de lectura ni de entrega).
    if(d.ok)return d.modo==='PRUEBA'?'Microsoft aceptó el correo en modo PRUEBA (va solo a info@contadoor.cl).':'Microsoft aceptó el correo para envío.';
    var t={
      SESION:'Tu sesión expiró: vuelve a ingresar.',
      NO_ASIGNADO:'Solo el analista asignado a este cliente (o el Master) puede enviarle este correo.',
      CLIENTE_SIN_CORREO:'El cliente no tiene correo en su ficha. Agrégalo en Clientes.',
      ENVIO_PAUSADO:'El envío de correos está pausado por el Master.',
      DUPLICADO_RECIENTE:'Este mismo correo ya salió hace menos de 10 minutos.',
      EN_CURSO:'Este envío ya está en curso. Espera unos segundos.',
      LIMITE_USUARIO:'Llegaste al límite diario de correos. Avisa al Master.',
      LIMITE_CLIENTE:'Este cliente ya recibió varios correos hoy. Avisa al Master.',
      CONTENIDO_NO_PERMITIDO:'El contenido del correo no pasó la revisión de seguridad.',
      SOLO_MASTER_EDITA:'Solo el Master puede enviar un correo con texto o montos editados. Quita la edición o pídele al Master que lo envíe.',
      DATOS_INVALIDOS:'Hay montos inválidos en el correo. Revisa el reporte antes de enviar.',
      ENVIO_INCIERTO:'Microsoft no confirmó el envío. NO lo reenvíes: el Master lo revisa en Enviados de reportes@.',
      ENVIO_FALLIDO:'Microsoft rechazó el envío. Puedes reintentar.'
    };
    return (t[d.codigo]||'No se pudo enviar el correo')+(d.mensaje&&!t[d.codigo]?' ('+d.mensaje+')':'');
  }

  window.GestoorCorreo={
    nuevaClave:nuevaClave,
    mensaje:mensaje,
    // o = {tipo, cliente_id, periodo:'AAAA-MM', clave, datos, referencia?, reenvio?}  (contenido_html en vez de datos: solo Master)
    enviar:function(o){return llamar(Object.assign({accion:'enviar'},o));},
    vistaPrevia:function(o){return llamar(Object.assign({accion:'vista_previa'},o));}
  };
})();
