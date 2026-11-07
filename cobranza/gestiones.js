/* ============================================================
   cobranza/gestiones.js — Cobranza · GESTIONES MANUALES y COMPROMISOS DE PAGO en la ficha del cliente
   Para que, mientras la cobranza sea manual (modo PRUEBA hasta el 31-12-2026), todo quede anotado.

   Backend (migración 202610201630_cobranza_c1, en producción; solo Cobranza —rol o módulo— o el Master: cob_actor_gestor):
     · cobranza_gestion_registrar(p_cliente_id bigint, p_tipo text, p_nota text)
         Tipos del servidor: LLAMADA · WHATSAPP_MANUAL · NOTA · YA_TRANSFERI. Nota obligatoria (≥ 5) en NOTA y WHATSAPP_MANUAL.
         Efectos: inserta en cobranza_gestiones (solo inserción, no se edita ni borra) + evento de auditoría.
           - WHATSAPP_MANUAL cuenta como gestión escrita de la Ley 21.320 (contador único cobranza_comunicaciones) y, si la semana
             legal está llena, cancela recordatorios automáticos pendientes de hoy/mañana (V, RS, M1) o rechaza con LEY_21320.
           - YA_TRANSFERI pausa todo y ENCOLA el aviso P2 al cliente → NO se ofrece en esta pantalla.
         No cambia el estado de cuenta (al día, mora, riesgo…) ni encola avisos al cliente en LLAMADA / NOTA / WHATSAPP_MANUAL.
         «Correo» y «Reunión» no existen como tipo en el servidor: se guardan como NOTA con el prefijo «Correo: » / «Reunión: »
         (no suman al contador de la Ley 21.320).
     · cobranza_compromiso_registrar(p_cliente_id bigint, p_fecha date, p_monto bigint, p_nota text)
         Fecha de hoy a 30 días · monto OBLIGATORIO (> 0) · nota obligatoria (≥ 5).
         Efectos: pausa de RECORDATORIOS hasta la fecha + gracia y ENCOLA el aviso P3 «Compromiso de pago registrado» AL CLIENTE
         (vence en 3 días; saldría si el Master habilita el envío en ese plazo). Por eso el botón queda DESHABILITADO en
         Gestoor real (COMPROMISO_CONECTADO = false) hasta ajustar el servidor. En demo se puede probar (sin red).
   Lectura (GRANT SELECT a authenticated + RLS cob_lectura): cobranza_gestiones y cobranza_pausas (origen COMPROMISO).
   Expone window.GC_GEST = { TIPOS, COMPROMISO_CONECTADO, MOTIVO_COMPROMISO, ERR, montoNum, validarGestion, validarCompromiso,
                             tipoDeGestion, lineaTiempoHtml, abrirGestion, abrirCompromiso }.
   ============================================================ */
(function(){
'use strict';
var G=window.GC;
if(!G)return;
var esc=G.esc, clpT=G.clpT, I=G.I;

/* Tipos que ve la persona → tipo del servidor. */
var TIPOS=[
  {k:'LLAMADA', t:'Llamado',  ic:'telefono', c:'ic-cel', rpc:'LLAMADA',        prefijo:'',          notaObl:false},
  {k:'CORREO',  t:'Correo',   ic:'correo',   c:'ic-mor', rpc:'NOTA',           prefijo:'Correo: ',  notaObl:true},
  {k:'WHATSAPP',t:'WhatsApp', ic:'chat',     c:'ic-ver', rpc:'WHATSAPP_MANUAL',prefijo:'',          notaObl:true, ley:true},
  {k:'REUNION', t:'Reunión',  ic:'calendario',c:'ic-amb',rpc:'NOTA',           prefijo:'Reunión: ', notaObl:true},
  {k:'NOTA',    t:'Nota',     ic:'lapiz',    c:'ic-ama', rpc:'NOTA',           prefijo:'',          notaObl:true}
];
function tipo(k){for(var i=0;i<TIPOS.length;i++)if(TIPOS[i].k===k)return TIPOS[i];return null;}
var NOTA_MAX=1000, NOTA_MIN=5;

/* Compromiso: hoy el servidor encola un aviso al cliente (P3). No se conecta en Gestoor real hasta ajustar el backend. */
var COMPROMISO_CONECTADO=false;
var MOTIVO_COMPROMISO='Por ahora no se puede registrar desde Gestoor: el servidor, al guardar un compromiso, deja en cola un aviso al cliente («Compromiso de pago registrado») que saldría si se habilita el envío en los 3 días siguientes. Queda deshabilitado hasta ajustar el servidor. Mientras tanto, anótalo con «Registrar gestión» (tipo Nota).';

/* Errores del servidor → mensajes amables (G.msgError agrega el código para soporte). */
var ERR={
  SIN_SESION:'No hay una sesión activa en Gestoor.',
  SOLO_COBRANZA:'Solo Cobranza (rol o módulo Cobranza) o el Master pueden registrar gestiones y compromisos.',
  CLIENTE_NO_EXISTE:'El cliente no existe.',
  TIPO_INVALIDO:'El tipo de gestión no es válido.',
  NOTA_OBLIGATORIA:'Escribe una nota de al menos 5 caracteres.',
  LEY_21320:'El cliente ya tiene 2 gestiones escritas esta semana o una hace menos de 2 días (Ley 21.320). El WhatsApp no se registró: anótalo como Nota.',
  FECHA_COMPROMISO_INVALIDA:'La fecha comprometida debe estar entre hoy y 30 días más.',
  MONTO_INVALIDO:'El monto comprometido debe ser mayor que $0.'
};

/* "120.000", "$120.000", "120000" → 120000 · vacío → null · inválido → NaN */
function montoNum(v){
  var s=String(v==null?'':v).replace(/[\s$]/g,'');
  if(!s)return null;
  if(!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(s))return NaN;
  return Number(s.replace(/\./g,''));
}
function sumarDias(iso,n){var d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}

/* Validación del formulario «Registrar gestión» → {error} | {args} (parámetros exactos de la RPC). */
function validarGestion(clienteId,f){
  var t=tipo(f&&f.tipo);
  if(!t)return {error:'Elige el tipo de gestión.'};
  var nota=String((f&&f.nota)||'').trim();
  if(t.notaObl&&nota.length<NOTA_MIN)return {error:'Escribe una nota de al menos '+NOTA_MIN+' caracteres (qué se conversó o se envió).'};
  if(!t.notaObl&&nota&&nota.length<NOTA_MIN)return {error:'La nota es opcional, pero si la escribes debe tener al menos '+NOTA_MIN+' caracteres.'};
  if((t.prefijo+nota).length>NOTA_MAX)return {error:'La nota es muy larga (máximo '+(NOTA_MAX-t.prefijo.length)+' caracteres).'};
  var id=Number(clienteId);
  if(!(id>0)||Math.floor(id)!==id)return {error:'Cliente no válido.'};
  return {args:{p_cliente_id:id,p_tipo:t.rpc,p_nota:nota?t.prefijo+nota:null},tipo:t};
}

/* Validación del formulario «Registrar compromiso de pago» (mismas reglas que el servidor). */
function validarCompromiso(clienteId,f,hoy){
  var fecha=String((f&&f.fecha)||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha))return {error:'Indica la fecha comprometida.'};
  if(fecha<hoy)return {error:'La fecha comprometida no puede ser anterior a hoy.'};
  if(fecha>sumarDias(hoy,30))return {error:'La fecha comprometida puede ser como máximo 30 días desde hoy ('+G.fFecha(sumarDias(hoy,30))+').'};
  var m=montoNum(f&&f.monto);
  if(m===null)return {error:'Indica el monto comprometido (el servidor lo exige).'};
  if(!(m>0)||Math.floor(m)!==m)return {error:'El monto debe ser un número entero mayor que $0 (por ejemplo 120.000).'};
  var nota=String((f&&f.nota)||'').trim();
  if(nota.length<NOTA_MIN)return {error:'Escribe una nota de al menos '+NOTA_MIN+' caracteres (cómo y con quién se acordó).'};
  if(nota.length>500)return {error:'La nota es muy larga (máximo 500 caracteres).'};
  var id=Number(clienteId);
  if(!(id>0)||Math.floor(id)!==id)return {error:'Cliente no válido.'};
  return {args:{p_cliente_id:id,p_fecha:fecha,p_monto:m,p_nota:nota}};
}

/* Gestión guardada → tipo que ve la persona (reconoce el prefijo de Correo y Reunión). */
function tipoDeGestion(g){
  var n=String(g&&g.nota||'');
  if(g.tipo==='LLAMADA')return {t:tipo('LLAMADA'),nota:n};
  if(g.tipo==='WHATSAPP_MANUAL')return {t:tipo('WHATSAPP'),nota:n};
  if(g.tipo==='YA_TRANSFERI')return {t:{k:'YA_TRANSFERI',t:'«Ya transferí»',ic:'banco',c:'ic-cel'},nota:n};
  if(n.indexOf('Correo: ')===0)return {t:tipo('CORREO'),nota:n.slice(8)};
  if(n.indexOf('Reunión: ')===0)return {t:tipo('REUNION'),nota:n.slice(9)};
  return {t:tipo('NOTA'),nota:n};
}

/* Línea de tiempo de gestiones y compromisos (más reciente primero). */
function lineaTiempoHtml(gestiones,compromisos,hoy){
  var it=[];
  (gestiones||[]).forEach(function(g){var x=tipoDeGestion(g);it.push({f:g.registrado_at||g.dia,dia:g.dia,ges:g,x:x});});
  (compromisos||[]).forEach(function(c){it.push({f:c.creada_at||c.desde,dia:c.desde,com:c});});
  if(!it.length)return '<p class="t3">Aún no hay gestiones ni compromisos anotados para este cliente.</p>';
  it.sort(function(a,b){return String(a.f)<String(b.f)?1:String(a.f)>String(b.f)?-1:0;});
  return '<ul class="gc-tl gc-gest-tl">'+it.map(function(e){
    if(e.ges){var t=e.x.t;
      return '<li style="--c:var(--lila)"><b>'+I(t.ic,t.c)+' '+esc(t.t)+'</b>'+(e.ges.tipo==='WHATSAPP_MANUAL'?' <span class="estado sin cel">Cuenta para la Ley 21.320</span>':'')
        +(e.x.nota?'<span class="gc-gest-nota">'+esc(e.x.nota)+'</span>':'')+'<small>'+G.fFecha(e.dia)+'</small></li>';}
    var c=e.com, terminado=!!c.terminada_at, cumplido=terminado?'Terminado':(c.hasta&&c.hasta<hoy?'Vencido':'Vigente'), cc=terminado?'gris':cumplido==='Vencido'?'ambar':'verde';
    return '<li style="--c:var(--cel)"><b>'+I('calendario','ic-cel')+' Compromiso de pago: '+esc(clpT(c.compromiso_monto))+' al '+G.fFecha(c.compromiso_fecha)+'</b> <span class="estado '+cc+'">'+cumplido+'</span>'
      +(c.motivo?'<span class="gc-gest-nota">'+esc(c.motivo)+'</span>':'')+'<small>Registrado el '+G.fFecha(c.desde)+' · recordatorios en pausa hasta el '+G.fFecha(c.hasta)+'</small></li>';
  }).join('')+'</ul>';
}

/* ── Modal «Registrar gestión» ── ctx: {id, nombre, registrar(args)→Promise, alGuardar(res, tipo), mErr(e), tipo?, nota?}
   tipo/nota opcionales: precargan el formulario (p. ej. tras «Copiar estado de cuenta»); la persona igual confirma. */
function abrirGestion(ctx){
  var sel=(ctx.tipo&&tipo(ctx.tipo))?ctx.tipo:'LLAMADA';
  var html='<p>Cliente: <b>'+esc(ctx.nombre)+'</b></p>'
    +'<p class="t2" style="font-size:12.5px">Anota lo que hiciste con este cliente. Queda en su historial de cobranza (no se puede editar ni borrar) y <b>no envía nada al cliente</b>.</p>'
    +'<div class="campo"><span>Tipo de gestión</span><div class="gc-seg gc-gest-tipos" role="radiogroup" aria-label="Tipo de gestión">'+TIPOS.map(function(t){
      var on=t.k===sel;return '<button type="button" class="fb'+(on?' on':'')+'" role="radio" aria-checked="'+on+'" data-gtipo="'+t.k+'">'+I(t.ic,on?'':t.c)+esc(t.t)+'</button>';}).join('')+'</div></div>'
    +'<label class="campo"><span id="gcGNotaTit">Nota (opcional)</span><textarea id="gcGNota" maxlength="'+(NOTA_MAX-9)+'" placeholder="Qué se conversó, con quién y qué quedó pendiente">'+esc(ctx.nota||'')+'</textarea></label>'
    +'<div id="gcGAyuda"></div>'
    +'<p class="nota">Fecha: hoy, '+G.fFecha(G.hoyCL())+'. El servidor registra quién la anotó.</p>';
  G.modal({titulo:'📝 Registrar gestión',html:html,ok:'Guardar gestión',
    alAbrir:function(m){
      function pint(){
        var t=tipo(sel);
        m.querySelector('#gcGNotaTit').textContent=t.notaObl?'Nota (obligatoria, mínimo 5 caracteres)':'Nota (opcional)';
        var a='';
        if(t.ley)a='<div class="aviso cel">'+I('info','ic-cel')+'<span>Un WhatsApp enviado a mano <b>cuenta como gestión escrita</b> para la Ley 21.320 (máximo 2 por semana y con 2 días entre una y otra). Regístralo solo si ya lo enviaste. Si el cliente tenía un recordatorio automático pendiente para hoy o mañana, el servidor lo reemplaza por este WhatsApp.</span></div>';
        else if(t.k==='CORREO')a='<div class="aviso gris">'+I('info')+'<span>El correo enviado a mano queda anotado como nota con el prefijo «Correo». El servidor aún no lo suma al contador de la Ley 21.320.</span></div>';
        m.querySelector('#gcGAyuda').innerHTML=a;
      }
      m.querySelectorAll('[data-gtipo]').forEach(function(b){b.addEventListener('click',function(){
        sel=b.getAttribute('data-gtipo');
        m.querySelectorAll('[data-gtipo]').forEach(function(x){var on=x===b,t=tipo(x.getAttribute('data-gtipo'));x.classList.toggle('on',on);x.setAttribute('aria-checked',on);x.innerHTML=I(t.ic,on?'':t.c)+esc(t.t);});
        pint();
      });});
      pint();
    },
    alAceptar:function(m){
      var v=validarGestion(ctx.id,{tipo:sel,nota:m.querySelector('#gcGNota').value});
      if(v.error)throw new Error(v.error);
      return ctx.registrar(v.args).then(function(res){ctx.alGuardar(res,v.tipo);return true;}).catch(function(e){throw new Error(ctx.mErr(e));});
    }});
}

/* ── Modal «Registrar compromiso de pago» ── ctx: {id, nombre, hoy, demo, registrar(args), alGuardar(res), mErr(e)} */
function abrirCompromiso(ctx){
  var hoy=ctx.hoy, max=sumarDias(hoy,30), paso=1;
  var html=(ctx.demo?'<div class="aviso ambar">'+I('alerta','ic-amb')+'<span><b>Vista previa (demo).</b> En Gestoor real este botón está deshabilitado: el servidor encola un aviso al cliente al registrar un compromiso.</span></div>':'')
    +'<p>Cliente: <b>'+esc(ctx.nombre)+'</b></p>'
    +'<div id="gcCP1"><div class="campos2"><label class="campo"><span>Fecha comprometida</span><input type="date" id="gcCFecha" min="'+esc(hoy)+'" max="'+esc(max)+'"></label>'
    +'<label class="campo"><span>Monto comprometido</span><input type="text" inputmode="numeric" id="gcCMonto" placeholder="$ 120.000" autocomplete="off"></label></div>'
    +'<label class="campo"><span>Nota (obligatoria)</span><textarea id="gcCNota" maxlength="500" placeholder="Cómo y con quién se acordó el pago"></textarea></label>'
    +'<p class="nota">La fecha puede ser desde hoy hasta el '+G.fFecha(max)+'. Mientras el compromiso esté vigente se pausan los recordatorios automáticos (no la suspensión).</p></div>'
    +'<div id="gcCP2" hidden></div>';
  G.modal({titulo:'📅 Registrar compromiso de pago',html:html,ok:'Revisar y confirmar',okClase:'verde',
    alAbrir:function(m){
      var inp=m.querySelector('#gcCMonto');
      inp.addEventListener('blur',function(){var n=montoNum(inp.value);if(n>0)inp.value='$'+G.miles(n);});
    },
    alAceptar:function(m){
      var v=validarCompromiso(ctx.id,{fecha:m.querySelector('#gcCFecha').value,monto:m.querySelector('#gcCMonto').value,nota:m.querySelector('#gcCNota').value},hoy);
      if(v.error)throw new Error(v.error);
      var si=m.querySelector('[data-m="si"]');
      if(paso===1){
        paso=2;m.querySelector('#gcCP1').hidden=true;var p2=m.querySelector('#gcCP2');p2.hidden=false;
        p2.innerHTML='<div class="gc-resumen"><div class="cl"><span>Cliente</span><b>'+esc(ctx.nombre)+'</b></div><div class="cl"><span>Pagará el</span><b>'+G.fFecha(v.args.p_fecha)+'</b></div>'
          +'<div class="cl"><span>Monto</span><b>'+esc(clpT(v.args.p_monto))+'</b></div><div class="cl"><span>Nota</span><span>'+esc(v.args.p_nota)+'</span></div></div>'
          +'<p class="nota">Al confirmar se pausan los recordatorios automáticos hasta la fecha comprometida más la gracia. Solo el Master puede terminar la pausa antes.</p>';
        si.textContent='Registrar compromiso';return false;
      }
      return ctx.registrar(v.args).then(function(res){ctx.alGuardar(res,v.args);return true;}).catch(function(e){throw new Error(ctx.mErr(e));});
    }});
}

window.GC_GEST={TIPOS:TIPOS,COMPROMISO_CONECTADO:COMPROMISO_CONECTADO,MOTIVO_COMPROMISO:MOTIVO_COMPROMISO,ERR:ERR,montoNum:montoNum,
  validarGestion:validarGestion,validarCompromiso:validarCompromiso,tipoDeGestion:tipoDeGestion,lineaTiempoHtml:lineaTiempoHtml,
  abrirGestion:abrirGestion,abrirCompromiso:abrirCompromiso};
})();
