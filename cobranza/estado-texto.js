/* ============================================================
   cobranza/estado-texto.js — Cobranza · «Copiar estado de cuenta» (y abrir WhatsApp con el mismo texto)
   Para cuando un cliente pregunta «¿cuánto te debo?»: arma un texto listo para pegar en un correo o WhatsApp.
   SIN backend: usa solo lo que la ficha ya cargó (resultado de cobranza_estado_cuenta). Cero llamadas nuevas, cero escrituras.
   No envía nada al cliente: copia al portapapeles o abre wa.me para que la persona lo envíe a mano.

   Datos para transferir (en este orden):
     1) Los que devuelve el servidor en estado.datos_transferencia (cobranza_parametros: banco, tipo_cuenta, numero_cuenta,
        titular, rut, correo), si tienen número de cuenta.
     2) Si no, DATOS_TRANSFERENCIA de abajo: los mismos que ya muestra el correo del reporte mensual (reporte-email.js,
        «Transfiere … a») y el WhatsApp del Panel de control. Son los datos de la empresa, no de un cliente.
     3) Si ambos estuvieran vacíos: «Datos para transferir: (se agregan cuando estén configurados)».
   Teléfono para WhatsApp: solo si la ficha trae uno (x.contacto.wa o x.contacto.tel). Hoy la ficha real NO lo carga, así que el
   botón WhatsApp no aparece en Gestoor real; en la demostración hay un número ficticio.
   Expone window.GC_ECTXT = { DATOS_TRANSFERENCIA, periodoPalabras, armarTexto, telefonoWa, linkWhatsApp, telefonoFicha, copiar }.
   ============================================================ */
(function(){
'use strict';

/* Misma información que reporte-email.js. Vaciar este objeto ({}) deja la línea «(se agregan cuando estén configurados)». */
var DATOS_TRANSFERENCIA={titular:'Asesorías Contadoor Ltda.',rut:'77.166.269-2',banco:'Banco Itaú',tipo_cuenta:'Cuenta corriente',numero_cuenta:'0220729517'};

var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function miles(n){return Math.round(Math.abs(Number(n)||0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
function pesos(n){n=Number(n)||0;return (n<0?'−':'')+'$'+miles(n);}
function fecha(iso){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso||''));return m?m[3]+'-'+m[2]+'-'+m[1]:'';}
/* «2026-10» o «2026-10-01» → «octubre 2026» */
function periodoPalabras(p){var m=/^(\d{4})-(\d{2})/.exec(String(p||''));if(!m||+m[2]<1||+m[2]>12)return String(p||'');return MESES[+m[2]-1]+' '+m[1];}
/* Nunca «honorarios» hacia el cliente: «servicios». */
function sinHonorarios(s){return String(s==null?'':s).replace(/honorarios/g,'servicios').replace(/Honorarios/g,'Servicios').replace(/HONORARIOS/g,'SERVICIOS').replace(/honorario/gi,'servicio');}

function lineaDoc(l){
  var partes=[];
  if(l.folio)partes.push('Folio '+l.folio);
  else if(l.cuota)partes.push('Cuota '+l.cuota);
  var c=sinHonorarios(l.concepto||'').trim();
  if(c)partes.push(c);
  if(l.periodo)partes.push('período '+periodoPalabras(l.periodo));
  if(l.vencimiento)partes.push('vence el '+fecha(l.vencimiento)+(l.vencido?' (vencida)':''));
  return '• '+(partes.length?partes.join(' · '):'Documento')+': '+pesos(l.monto);
}
function datosTransferencia(ec){
  var s=ec&&ec.datos_transferencia, d=(s&&s.numero_cuenta)?s:DATOS_TRANSFERENCIA;
  if(!d||!d.numero_cuenta)return ['Datos para transferir: (se agregan cuando estén configurados)'];
  var r=['Datos para transferir:'];
  if(d.titular||d.rut)r.push([d.titular,d.rut?'RUT '+d.rut:''].filter(Boolean).join(' · '));
  r.push([d.banco,[d.tipo_cuenta,d.numero_cuenta].filter(Boolean).join(' ')].filter(Boolean).join(' · '));
  if(d.correo)r.push('Comprobante a '+d.correo);
  return r;
}

/* ec = resultado de cobranza_estado_cuenta · o = {nombre (solo si es visible), hoy 'aaaa-mm-dd'} → texto plano */
function armarTexto(ec,o){
  ec=ec||{};o=o||{};
  var nombre=String(o.nombre||'').trim(), dia=fecha(ec.fecha||o.hoy);
  var lineas=[];(ec.grupos||[]).forEach(function(g){(g.lineas||[]).forEach(function(l){if(Number(l.monto)>0)lineas.push(l);});});
  lineas.sort(function(a,b){return String(a.vencimiento||'')<String(b.vencimiento||'')?-1:String(a.vencimiento||'')>String(b.vencimiento||'')?1:0;});
  var deuda=Number(ec.total_deuda)||lineas.reduce(function(s,l){return s+Number(l.monto);},0), abonos=Number(ec.total_abonos)||0;
  var total=ec.total!=null&&isFinite(Number(ec.total))?Number(ec.total):Math.max(deuda-abonos,0);
  var t=[];
  t.push('Hola'+(nombre?', '+nombre:'')+' 👋');
  t.push('');
  t.push('Te comparto el detalle de tu estado de cuenta con Contadoor al '+dia+'.');
  t.push('');
  if(!lineas.length||deuda<=0){
    t.push('¡Estás al día! No tienes documentos pendientes de pago.');
    if(abonos>0)t.push('Además, tienes un saldo a favor de '+pesos(abonos)+' que se aplicará a tus próximos documentos.');
  }else{
    t.push('Documentos pendientes:');
    lineas.forEach(function(l){t.push(lineaDoc(l));});
    t.push('');
    if(abonos>0){
      t.push('Total de documentos: '+pesos(deuda));
      t.push('Abonos a tu favor: −'+pesos(abonos).replace('−',''));
    }
    if(total>0){
      t.push('Total a pagar: '+pesos(total));
      if(ec.comentario_transferencia){t.push('');t.push('Comentario sugerido para la transferencia: «'+ec.comentario_transferencia+'»');}
      t.push('');
      datosTransferencia(ec).forEach(function(x){t.push(x);});
    }else{
      t.push('Total a pagar: $0 (tus abonos cubren el saldo pendiente).');
    }
  }
  t.push('');
  t.push('Cualquier duda, quedo atento.');
  t.push('Equipo Contadoor');
  return t.join('\n');
}

/* Teléfono chileno → solo dígitos con 56 para wa.me; si no es un celular reconocible → null (no se muestra el botón). */
function telefonoWa(v){
  var d=String(v==null?'':v).replace(/\D/g,'');
  if(/^9\d{8}$/.test(d))d='56'+d;
  if(/^569\d{8}$/.test(d))return d;
  return null;
}
function linkWhatsApp(tel,texto){var n=telefonoWa(tel);return n?'https://wa.me/'+n+'?text='+encodeURIComponent(texto):null;}
/* Solo si la ficha ya trae un teléfono (no se consulta nada nuevo). */
function telefonoFicha(x){var c=x&&x.contacto;if(!c)return null;return telefonoWa(c.wa)?c.wa:(telefonoWa(c.tel)?c.tel:null);}

/* Portapapeles con respaldo (navegadores sin navigator.clipboard o sin permiso). → Promise<boolean> */
function copiar(texto,doc){
  doc=doc||document;
  function respaldo(){
    try{
      var ta=doc.createElement('textarea');ta.value=texto;ta.setAttribute('readonly','');ta.style.position='fixed';ta.style.top='-1000px';ta.style.opacity='0';
      doc.body.appendChild(ta);ta.select();var ok=false;try{ok=doc.execCommand('copy');}catch(e){ok=false;}ta.remove();return ok;
    }catch(e){return false;}
  }
  var nav=doc.defaultView&&doc.defaultView.navigator;
  if(nav&&nav.clipboard&&typeof nav.clipboard.writeText==='function'){
    return nav.clipboard.writeText(texto).then(function(){return true;},function(){return respaldo();});
  }
  return Promise.resolve(respaldo());
}

window.GC_ECTXT={DATOS_TRANSFERENCIA:DATOS_TRANSFERENCIA,periodoPalabras:periodoPalabras,armarTexto:armarTexto,telefonoWa:telefonoWa,
  linkWhatsApp:linkWhatsApp,telefonoFicha:telefonoFicha,copiar:copiar};
})();
