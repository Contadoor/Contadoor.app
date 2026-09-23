// ============================================================
// reporte-email.js — Reporte mensual al cliente (correo HTML)
// Diseño aprobado por Luciano (23-sep-2026): estilo de los reels de Contadoor.
// Fuente de la maqueta: gestoor-backend/docs/maquetas/maqueta-reporte-mensual-v3.html
// Uso: GestoorReporte.render(datos) → HTML del correo · GestoorReporte.persona(nombre)
// ============================================================
(function(){
// Imágenes del correo: URL pública de Gestoor. En desarrollo local se usan las del servidor local.
var BASE=(typeof location!=='undefined'&&/^(localhost|127\.0\.0\.1)$/.test(location.hostname))?location.origin+'/':'https://gestoor.contadoor.cl/';

// ════════════════════════════════════════════════════════════════════
// renderReporteEmail(d) → HTML de correo (tablas + estilos en línea).
// Este mismo generador se usará en el Panel para el envío real.
// ════════════════════════════════════════════════════════════════════
// Paleta de los reels (mi-video/src/brand/tokens.ts): fondo oscuro + degradado de marca.
var C={morado:'#924893',moradoOsc:'#803889',moradoClaro:'#A4599C',acento:'#C77BC9',cifra:'#E39BE5',
  fondo:'#17091A',carbon:'#0C070E',panel:'#221027',borde:'#4A2B50',
  suave:'rgba(146,72,147,.22)',crema:'rgba(255,255,255,.05)',
  tinta:'#F3E9F4',tinta2:'#C9A8CC',verde:'#5FCF9C',verdeSuave:'#12301F',
  rojo:'#E07A6E',rojoSuave:'rgba(224,122,110,.14)',ambar:'#E8B34B',ambarSuave:'rgba(232,179,75,.14)'};
// Colores de entidad: Previred siempre en amarillo, SII siempre en naranjo (pedido de Luciano).
C.previred='#FFD24D'; C.sii='#FF9F43';
function ent(t){
  return esc(t).replace(/\bPrevired\b/g,'<b style="color:'+C.previred+'">Previred</b>')
               .replace(/\b(sii\.cl|SII)\b/gi,function(m){return '<b style="color:'+C.sii+'">'+m+'</b>';});
}
var FONDO_REELS='radial-gradient(120% 70% at 24% 6%, #241030 0%, #17091A 55%, #0C070E 100%)';
// Barritas diagonales de los reels (DiagonalBars) escaladas a 600 px. Clientes que no soportan
// position/transform (Gmail, Outlook) las omiten y muestran el fondo oscuro de marca.
var GRADB='linear-gradient(160deg,#A4599C 0%,#803889 100%)';
function barritas(){
  function grupo(pos,alturas,ancho,gap,op){
    var b='<div style="position:absolute;'+pos+';transform:rotate(20deg);display:flex;gap:'+gap+'px;z-index:-1">';
    alturas.forEach(function(h){b+='<div style="width:'+ancho+'px;height:'+h+'px;border-radius:'+(ancho/2)+'px;background:'+GRADB+';opacity:'+op+'"></div>';});
    return b+'</div>';
  }
  return grupo('top:-66px;right:-38px',[132,198,258,176],22,12,0.18)
       + grupo('bottom:-94px;left:-60px',[110,182,143],19,11,0.13)
       + '<div style="position:absolute;right:-120px;bottom:-120px;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(146,72,147,.35),transparent 62%);z-index:-1"></div>';
}
var LOGO_BLANCO=BASE+'assets/logo-blanco.png';
function kw(t){return String(t).replace(/\*([^*]+)\*/g,'<span style="color:'+C.acento+'">$1</span>');}
var F_T="Montserrat,Arial,Helvetica,sans-serif", F_B="Inter,Arial,Helvetica,sans-serif";
var TIPOS={
  cot:{icono:'👥',color:'#FFD24D',nombre:'Cotizaciones'},
  imp:{icono:'🧾',color:'#FF9F43',nombre:'Impuestos'},
  conv:{icono:'🤝',color:C.verde,nombre:'Convenio'},
  serv:{icono:'💼',color:C.acento,nombre:'Nuestros servicios'}
};
function $(n){return '$'+Math.round(n).toLocaleString('es-CL');}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function pill(txt,fg,bg){return '<span style="display:inline-block;font:700 11px '+F_B+';color:'+fg+';background:'+bg+';border-radius:999px;padding:4px 10px;white-space:nowrap">'+txt+'</span>';}
function quienPagaPill(p){return p==='cliente'?pill('🏦 Pagas tú',C.verde,C.verdeSuave):pill('💳 Lo pagamos por ti',C.acento,C.suave);}
function delta(d){ if(d==null)return ''; var up=d>0; return '<span style="font:600 11px '+F_B+';color:'+(up?C.rojo:C.verde)+'">'+(up?'▲':'▼')+' '+Math.abs(Math.round(d*100))+'% vs mes anterior</span>'; }
function boton(txt,prim,href){return '<a href="'+(href||'#')+'" style="display:inline-block;min-height:44px;padding:0 22px;border-radius:999px;margin:4px;font:700 14px '+F_B+';line-height:44px;text-decoration:none;'+(prim?'background:'+C.morado+';background-image:linear-gradient(160deg,'+C.moradoClaro+','+C.moradoOsc+');color:#fff':'background:transparent;color:'+C.acento+';border:1px solid '+C.acento+';line-height:42px')+'">'+txt+'</a>';}

// Acciones del cliente → correo al analista asignado (sin WhatsApp).
function mailAnalista(d,asunto,cuerpo){
  return 'mailto:'+(d.analista.email||'')+'?subject='+encodeURIComponent(asunto+' · '+d.empresa+' · '+d.periodo)
    +'&body='+encodeURIComponent('Hola '+d.analista.nombre.split(' ')[0]+',\n\n'+cuerpo+'\n\n'+d.empresa);
}
function linkPostergar(d,que){return mailAnalista(d,'Solicitud de postergación','Quiero postergar '+que+' de '+d.periodo+'. ¿Me confirmas cómo seguimos?');}
function renderReporteEmail(d){
  var items=d.items.filter(function(i){return i.monto>0;});
  var total=items.reduce(function(s,i){return s+i.monto;},0);
  var aContadoor=items.filter(function(i){return i.paga==='contadoor';}).reduce(function(s,i){return s+i.monto;},0);
  var directo=total-aContadoor;
  var h='';
  h+='<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="'+C.carbon+'" style="background:'+C.carbon+'"><tr><td align="center" style="padding:8px 0 24px">';
  h+='<table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="'+C.fondo+'" style="width:100%;max-width:600px;background-color:'+C.fondo+';background-image:'+FONDO_REELS+';border-radius:18px;overflow:hidden;overflow:clip;border:1px solid '+C.borde+';color:'+C.tinta+';position:relative;z-index:0">';
  h+='<tr><td style="padding:0;height:0;line-height:0;font-size:0">'+barritas()+'</td></tr>';

  // ── HERO (bloque de énfasis con degradado de marca) ──
  h+='<tr><td style="padding:26px 28px 26px">';
  h+='<table role="presentation" width="100%"><tr><td><img src="'+LOGO_BLANCO+'" alt="Contadoor" height="28" style="height:28px;display:block"></td>';
  h+='<td align="right">'+pill('📅 '+esc(d.periodo),C.tinta,C.suave)+'</td></tr></table>';
  h+='<p style="margin:24px 0 4px;font:700 15px '+F_B+';color:'+C.tinta2+'">Hola, '+esc(d.contacto)+' 👋</p>';
  h+='<p style="margin:0 0 20px;font:900 26px/1.2 '+F_T+';color:#fff">'+kw('Tu *mes* en un vistazo 📊')+'<br><span style="font:700 14px '+F_B+';color:'+C.tinta2+'">'+esc(d.empresa)+'</span></p>';
  var etiqueta=d.modalidad==='contadoor'?'Total a transferir a Contadoor':'Total de tus obligaciones del mes';
  h+='<table role="presentation" width="100%" bgcolor="'+C.panel+'" style="background:'+C.panel+';border:1px solid '+C.borde+';border-radius:16px"><tr><td style="padding:18px 20px">';
  h+='<div style="font:700 11px '+F_B+';color:'+C.acento+';text-transform:uppercase;letter-spacing:1.4px">'+etiqueta+'</div>';
  h+='<div style="font:900 42px '+F_T+';color:'+C.cifra+';margin:2px 0 10px;font-variant-numeric:tabular-nums">'+$(total)+'</div>';
  h+=d.diasVence<0?pill('⚠️ Venció el '+esc(d.fechaVence),C.carbon,C.rojo)
     :pill('⏰ '+(d.diasVence===0?'Vence hoy':d.diasVence===1?'Vence mañana':'Vence en '+d.diasVence+' días')+' · '+esc(d.fechaVence),'#fff',C.morado);
  h+='</td></tr></table>';
  if(d.modalidad!=='contadoor'){
    h+='<table role="presentation" width="100%" style="margin-top:16px"><tr>';
    h+='<td width="50%" style="padding-right:6px"><div style="background:'+C.panel+';border:1px solid '+C.borde+';border-radius:12px;padding:12px 14px"><div style="font:600 11px '+F_B+';color:'+C.verde+'">🏦 PAGAS TÚ</div><div style="font:800 20px '+F_T+';color:#fff;font-variant-numeric:tabular-nums">'+$(directo)+'</div></div></td>';
    h+='<td width="50%" style="padding-left:6px"><div style="background:'+C.panel+';border:1px solid '+C.borde+';border-radius:12px;padding:12px 14px"><div style="font:600 11px '+F_B+';color:'+C.acento+'">💳 A CONTADOOR</div><div style="font:800 20px '+F_T+';color:#fff;font-variant-numeric:tabular-nums">'+$(aContadoor)+'</div></div></td>';
    h+='</tr></table>';
  }
  h+='</td></tr>';

  // ── TU MES EN UN VISTAZO: barra de composición ──
  h+='<tr><td style="padding:24px 28px 6px"><div style="font:900 18px/1.3 '+F_T+';color:#fff;margin-bottom:10px">'+kw('¿En qué se va tu *mes*? 💸')+'</div>';
  h+='<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:999px;overflow:hidden"><tr>';
  items.forEach(function(i){var pct=Math.max(3,Math.round(i.monto/total*100));h+='<td width="'+pct+'%" height="14" bgcolor="'+TIPOS[i.tipo].color+'" style="background:'+TIPOS[i.tipo].color+';height:14px;font-size:0;line-height:0">&nbsp;</td>';});
  h+='</tr></table><div style="margin-top:10px">';
  items.forEach(function(i){h+='<span style="display:inline-block;font:600 12px '+F_B+';color:'+C.tinta2+';padding:3px 12px 3px 0;white-space:nowrap"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:'+TIPOS[i.tipo].color+';margin-right:5px"></span>'+TIPOS[i.tipo].icono+' '+TIPOS[i.tipo].nombre+' <b style="color:'+C.tinta+'">'+Math.round(i.monto/total*100)+'%</b></span>';});
  h+='</div></td></tr>';

  // ── FECHAS CLAVE ──
  h+='<tr><td style="padding:18px 28px 4px"><div style="font:900 18px/1.3 '+F_T+';color:#fff;margin-bottom:10px">'+kw('Tus *fechas* clave 🗓️')+'</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>';
  d.fechas.forEach(function(f,k){
    h+='<td width="'+Math.floor(100/d.fechas.length)+'%" style="padding:0 '+(k<d.fechas.length-1?'6px':'0')+' 0 0;vertical-align:top"><div style="border:1px solid '+(k===0?C.acento:C.borde)+';border-radius:14px;padding:12px 10px;text-align:center;background:'+(k===0?C.suave:C.panel)+'">';
    h+='<div style="font:900 26px '+F_T+';color:'+(k===0?C.cifra:'#fff')+';line-height:1">'+f.dia+'</div><div style="font:700 11px '+F_B+';color:'+C.tinta2+';text-transform:uppercase;letter-spacing:1px">'+f.mes+'</div>';
    h+='<div style="font:600 12px/1.35 '+F_B+';color:'+C.tinta+';margin-top:6px">'+ent(f.que)+'</div></div></td>';
  });
  h+='</tr></table></td></tr>';

  // ── DETALLE: tarjetas ──
  h+='<tr><td style="padding:18px 28px 0"><div style="font:900 18px/1.3 '+F_T+';color:#fff;margin-bottom:4px">'+kw('El *detalle* 🔍')+'</div></td></tr>';
  items.forEach(function(i){
    var t=TIPOS[i.tipo];
    h+='<tr><td style="padding:8px 28px 0"><table role="presentation" width="100%" bgcolor="'+C.panel+'" style="background:'+C.panel+';border:1px solid '+C.borde+';border-radius:14px;border-left:4px solid '+t.color+'"><tr>';
    h+='<td width="44" style="padding:14px 0 14px 14px;vertical-align:top"><div style="width:40px;height:40px;border-radius:12px;background:'+C.crema+';text-align:center;font-size:20px;line-height:40px">'+t.icono+'</div></td>';
    h+='<td style="padding:14px 12px;vertical-align:top"><div style="font:700 14px '+F_B+';color:'+C.tinta+'">'+ent(i.titulo)+'</div>';
    h+='<div style="font:400 12px/1.5 '+F_B+';color:'+C.tinta2+';margin:2px 0 6px">'+ent(i.detalle)+'</div>';
    if(i.tipo!=='serv')h+=quienPagaPill(i.paga)+' ';
    if(i.vence)h+=pill('⏰ '+esc(i.vence),C.tinta2,C.crema);
    if(i.postergable)h+='<div style="margin-top:10px"><a href="'+linkPostergar(d,i.titulo)+'" style="display:inline-block;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid '+C.acento+';font:700 12px '+F_B+';line-height:42px;color:'+C.acento+';text-decoration:none;background:transparent">⏸ Quiero postergar</a></div>';
    if(i.progreso){var p=Math.round(i.progreso.pagadas/i.progreso.total*100);
      h+='<table role="presentation" width="100%" style="margin-top:10px"><tr><td style="background:'+C.fondo+';border-radius:999px;height:8px;font-size:0;line-height:0"><div style="width:'+p+'%;height:8px;background:'+C.verde+';border-radius:999px"></div></td></tr></table>';
      h+='<div style="font:600 11px '+F_B+';color:'+C.verde+';margin-top:4px">✅ '+i.progreso.pagadas+' de '+i.progreso.total+' cuotas pagadas · te quedan '+(i.progreso.total-i.progreso.pagadas)+'</div>';}
    h+='</td><td align="right" style="padding:14px 14px 14px 0;vertical-align:top;white-space:nowrap"><div style="font:800 16px '+F_T+';color:'+C.cifra+';font-variant-numeric:tabular-nums">'+$(i.monto)+'</div>'+(i.delta!=null?'<div style="margin-top:4px">'+delta(i.delta)+'</div>':'')+'</td>';
    h+='</tr></table></td></tr>';
  });

  // ── DEUDA PENDIENTE ──
  if(d.deuda){
    h+='<tr><td style="padding:12px 28px 0"><table role="presentation" width="100%" style="background:'+C.rojoSuave+';border-radius:14px"><tr><td style="padding:14px 16px;font:400 13px/1.5 '+F_B+';color:'+C.tinta+'">';
    h+=pill('⚠️ Deuda pendiente',C.carbon,C.rojo)+'<div style="margin-top:8px">'+ent(d.deuda.detalle)+' · <b style="font-variant-numeric:tabular-nums">'+$(d.deuda.monto)+'</b></div>';
    h+='<div style="color:'+C.tinta2+';font-size:12px;margin-top:2px">Te recomendamos regularizarla. Podemos gestionarte un convenio.</div></td></tr></table></td></tr>';
  }

  // ── CÓMO PAGAR ──
  h+='<tr><td style="padding:20px 28px 0"><div style="font:900 18px/1.3 '+F_T+';color:#fff;margin-bottom:8px">'+kw('Cómo *pagar* 💳')+'</div>';
  if(directo>0){
    h+='<table role="presentation" width="100%" bgcolor="'+C.panel+'" style="background:'+C.panel+';border:1px solid '+C.borde+';border-radius:14px;margin-bottom:8px"><tr><td style="padding:14px 16px;font:400 13px/1.7 '+F_B+';color:'+C.tinta+'"><b>🏦 Lo pagas tú directamente</b><br>';
    items.filter(function(i){return i.paga==='cliente';}).forEach(function(i){h+='• '+esc(i.titulo)+' en <b>'+esc(i.donde)+'</b> antes del '+esc(i.vence.replace('Vence ',''))+'<br>';});
    h+='<span style="color:'+C.tinta2+';font-size:12px">Envíanos los comprobantes con el botón de abajo o respondiendo este correo.</span></td></tr></table>';
  }
  if(aContadoor>0){
    h+='<table role="presentation" width="100%" style="background:'+C.suave+';border:1px solid '+C.acento+';border-radius:14px"><tr><td style="padding:14px 16px;font:400 13px/1.7 '+F_B+';color:'+C.tinta+'"><b>💳 Transfiere '+$(aContadoor)+' a</b><br>Asesorías Contadoor Ltda. · RUT 77.166.269-2<br>Banco Itaú · Cuenta corriente 0220729517';
    if(d.modalidad==='contadoor')h+='<br><span style="color:'+C.tinta2+';font-size:12px">Con eso pagamos por ti tus cotizaciones, impuestos y convenio. 🙌</span>';
    h+='</td></tr></table>';
  }
  h+='</td></tr>';

  // ── POSTERGAR ──
  if(items.some(function(i){return i.postergable;})){
    h+='<tr><td style="padding:16px 28px 0"><table role="presentation" width="100%" bgcolor="'+C.panel+'" style="background:'+C.panel+';border:1px solid '+C.borde+';border-radius:14px"><tr><td style="padding:14px 16px;font:400 13px/1.55 '+F_B+';color:'+C.tinta+'">';
    h+='<b>⏸ ¿Necesitas postergar algo?</b><br><span style="color:'+C.tinta2+'">Algunas obligaciones se pueden postergar. Cuéntanos cuál y revisamos contigo la mejor opción antes del vencimiento.</span>';
    h+='<div style="margin-top:10px"><a href="'+linkPostergar(d,'mis obligaciones')+'" style="display:inline-block;min-height:44px;padding:0 18px;border-radius:999px;border:1px solid '+C.acento+';font:700 13px '+F_B+';line-height:42px;color:'+C.acento+';text-decoration:none">Solicitar postergación</a></div>';
    h+='</td></tr></table></td></tr>';
  }

  // ── BOTONES ──
  h+='<tr><td align="center" style="padding:20px 28px 4px">'
    +(d.modalidad==='contadoor'?boton('✅ Ya transferí',true,mailAnalista(d,'Transferencia realizada','Ya transferí '+$(aContadoor)+' para las obligaciones de '+d.periodo+'. Adjunto el comprobante.'))
                               :boton('📎 Enviar comprobantes',true,mailAnalista(d,'Comprobantes de pago','Adjunto los comprobantes de pago de '+d.periodo+'.')))
    +boton('✉️ Escribir a mi asesor',false,mailAnalista(d,'Consulta','Tengo una consulta sobre mi reporte de '+d.periodo+':'))+'</td></tr>';

  // ── TIP DEL MES ──
  if(d.tip){
    h+='<tr><td style="padding:18px 28px 0"><table role="presentation" width="100%" style="background:'+C.crema+';border:1px dashed '+C.moradoClaro+';border-radius:14px"><tr><td style="padding:14px 16px;font:400 13px/1.55 '+F_B+';color:'+C.tinta+'"><b style="color:'+C.acento+'">💡 Tip del mes</b><br>'+esc(d.tip)+'</td></tr></table></td></tr>';
  }

  // ── PLAZOS Y RESPONSABILIDAD (texto definido por Luciano, 23-sep-2026) ──
  var av=d.aviso||{};
  h+='<tr><td style="padding:18px 28px 0"><table role="presentation" width="100%" style="border:1px solid '+C.rojo+';border-radius:14px;background:'+C.rojoSuave+'"><tr><td style="padding:14px 16px;font:400 12px/1.6 '+F_B+';color:'+C.tinta+'">';
  h+='<b style="font-size:13px;color:#fff">📌 Importante: plazos y responsabilidad</b><br>';
  h+='Este reporte es nuestro <b>canal formal de entrega de información</b>. Para evitar multas, reajustes e intereses, realiza tus pagos —o tus transferencias a Contadoor— <b>en horario hábil y al menos un día hábil antes de cada vencimiento</b>:<br>';
  h+='• '+ent('Cotizaciones (Previred)')+': puedes postergarlas hasta el <b>día '+(av.diaPostergar||10)+'</b>; el vencimiento real es el <b>día '+(av.diaCot||13)+' a las '+(av.horaCot||'13:40')+' h</b>.<br>';
  h+='• '+ent('IVA (F29 del SII)')+': vence el <b>día '+(av.diaIva||20)+'</b>; si cae en fin de semana o festivo, pasa al día hábil siguiente.<br>';
  h+='<span style="color:'+C.tinta2+'">Contadoor no se hace responsable de multas, reajustes o intereses por pagos o transferencias realizados fuera de estos plazos.</span>';
  h+='</td></tr></table></td></tr>';

  // ── SEGUNDA PARTE: detalle del mes (tablas compactas) ──
  if((d.anexo&&d.anexo.length)||(d.historial&&d.historial.length)){
    h+='<tr><td style="padding:26px 28px 0"><div style="border-top:1px solid '+C.borde+';padding-top:20px;font:900 18px/1.3 '+F_T+';color:#fff">'+kw('Segunda parte: el *detalle* del mes 📑')+'</div>';
    h+='<div style="font:400 12px '+F_B+';color:'+C.tinta2+';margin-top:4px">Para quien quiera revisar cada cifra.</div></td></tr>';
    // Historial: últimos meses (el actual destacado)
    if(d.historial&&d.historial.length){
      var maxH=Math.max.apply(null,d.historial.map(function(m){return m.total||0;}).concat([1]));
      h+='<tr><td style="padding:12px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="'+C.panel+'" style="background:'+C.panel+';border:1px solid '+C.borde+';border-radius:14px">';
      h+='<tr><td colspan="3" style="padding:12px 16px 8px;font:700 13px '+F_B+';color:'+C.acento+'">📈 Tus últimos meses</td></tr>';
      d.historial.forEach(function(m){
        var ancho=Math.max(4,Math.round((m.total||0)/maxH*100));
        h+='<tr><td width="70" style="padding:6px 0 6px 16px;font:'+(m.actual?'700':'600')+' 12px '+F_B+';color:'+(m.actual?'#fff':C.tinta2)+';white-space:nowrap">'+esc(m.mes)+'</td><td style="padding:6px 10px">';
        if(m.total>0){
          h+='<table role="presentation" width="'+ancho+'%" cellpadding="0" cellspacing="0" style="border-radius:999px;overflow:hidden"><tr>';
          [['cot',m.cot],['imp',m.imp],['serv',m.serv],['deuda',m.otros]].forEach(function(x){ if(x[1]>0){h+='<td width="'+Math.max(2,Math.round(x[1]/m.total*100))+'%" height="10" bgcolor="'+TIPOS[x[0]].color+'" style="background:'+TIPOS[x[0]].color+';height:10px;font-size:0;line-height:0'+(m.actual?'':';opacity:.7')+'">&nbsp;</td>';} });
          h+='</tr></table>';
        } else h+='<span style="font:400 11px '+F_B+';color:'+C.tinta2+'">Sin datos</span>';
        h+='</td><td align="right" style="padding:6px 16px 6px 0;font:'+(m.actual?'800':'600')+' 12px '+F_B+';color:'+(m.actual?C.cifra:C.tinta)+';white-space:nowrap;font-variant-numeric:tabular-nums">'+(m.total>0?$(m.total):'—')+'</td></tr>';
      });
      h+='<tr><td colspan="3" style="height:8px;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>';
    }
    (d.anexo||[]).forEach(function(sec){
      h+='<tr><td style="padding:12px 28px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="'+C.panel+'" style="background:'+C.panel+';border:1px solid '+C.borde+';border-radius:14px">';
      h+='<tr><td colspan="2" style="padding:12px 16px 6px;font:700 13px '+F_B+';color:'+(sec.color||C.acento)+'">'+(sec.icono||'')+' '+ent(sec.titulo)+'</td></tr>';
      sec.filas.forEach(function(f){
        var fuerte=f.total;
        h+='<tr><td style="padding:6px 16px;font:'+(fuerte?'700':'400')+' 12px '+F_B+';color:'+(fuerte?'#fff':C.tinta2)+';border-top:1px solid '+(fuerte?C.borde:'transparent')+'">'+ent(f.c)+'</td>';
        h+='<td align="right" style="padding:6px 16px;font:'+(fuerte?'800':'600')+' 12px '+F_B+';color:'+(fuerte?C.cifra:C.tinta)+';white-space:nowrap;font-variant-numeric:tabular-nums;border-top:1px solid '+(fuerte?C.borde:'transparent')+'">'+(typeof f.v==='number'?$(f.v):esc(f.v))+'</td></tr>';
      });
      h+='<tr><td colspan="2" style="height:8px;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>';
    });
  }

  // ── FIRMA: analista a cargo + respaldo del CEO/contador ──
  function avatar(p,tam,borde){
    return p.foto
      ? '<img src="'+p.foto+'" width="'+tam+'" height="'+tam+'" alt="'+esc(p.nombre)+'" style="display:block;width:'+tam+'px;height:'+tam+'px;border-radius:50%;border:2px solid '+borde+';object-fit:cover">'
      : '<div style="width:'+tam+'px;height:'+tam+'px;border-radius:50%;background:'+C.morado+';background-image:linear-gradient(160deg,'+C.moradoClaro+','+C.moradoOsc+');color:#fff;text-align:center;font:800 '+Math.round(tam*0.3)+'px '+F_T+';line-height:'+tam+'px">'+esc(p.iniciales)+'</div>';
  }
  // Equipo a cargo: 1 o 2 asesores (contable / remuneraciones) en una fila compacta
  var eq=d.asesores||[d.analista];
  h+='<tr><td style="padding:22px 28px 24px"><div style="border-top:1px solid '+C.borde+';padding-top:16px;font:700 11px '+F_B+';color:'+C.acento+';text-transform:uppercase;letter-spacing:1.2px">'+(eq.length>1?'Tu equipo a cargo':(/^Asesora/.test(eq[0].cargo)?'Tu asesora a cargo':'Tu asesor a cargo'))+'</div>';
  h+='<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px"><tr>';
  eq.forEach(function(p,k){
    h+='<td width="'+Math.floor(100/eq.length)+'%" style="vertical-align:top;padding-right:'+(k<eq.length-1?'8px':'0')+'"><table role="presentation" width="100%"><tr>';
    h+='<td width="52" style="vertical-align:middle">'+avatar(p,44,C.acento)+'</td>';
    h+='<td style="vertical-align:middle;font:400 12px/1.4 '+F_B+';color:'+C.tinta2+'"><b style="color:#fff;font-size:13px">'+esc(p.nombre)+'</b><br>'+esc(p.cargo)+'</td></tr></table></td>';
  });
  h+='</tr></table>';
  h+='<div style="margin-top:10px;font:400 12px '+F_B+';color:'+C.tinta2+'">¿Dudas? Responde este correo y te contestamos directamente.</div>';
  if(d.revisor){
    h+='<table role="presentation" width="100%" bgcolor="'+C.panel+'" style="margin-top:14px;background:'+C.panel+';border:1px solid '+C.borde+';border-radius:14px"><tr>';
    h+='<td width="48" style="padding:8px 0 8px 12px;vertical-align:middle">'+avatar(d.revisor,36,C.verde)+'</td>';
    h+='<td style="padding:8px 12px;vertical-align:middle;font:400 12px/1.6 '+F_B+';color:'+C.tinta2+'">'+pill('✔ Revisado y respaldado',C.carbon,C.verde)+' <b style="color:#fff;font-size:13px">'+esc(d.revisor.nombre)+'</b> · '+esc(d.revisor.cargo)+'</td>';
    h+='</tr></table>';
  }
  h+='<p style="margin:14px 0 0;font:400 11px/1.5 '+F_B+';color:'+C.tinta2+';opacity:.75">Montos calculados con la información disponible al cierre del período contable. <span style="color:'+C.verde+'">● Al día</span> · @contadoor.cl</p></td></tr>';

  h+='</table></td></tr></table>';
  return h;
}

// ── Equipo: retratos publicados en assets/equipo/ y cargo visible ──
var EQUIPO={
  'luciano duarte':   {slug:'luciano-duarte',   cargo:'Contador · CEO de Contadoor'},
  'catalina armingol':{slug:'catalina-armingol',cargo:'Asesora Contable'},
  'mauro pizarro':    {slug:'mauro-pizarro',    cargo:'Asesor Contable'},
  'leticia romero':   {slug:'leticia-romero',   cargo:'Asesora Contable'},
  'leandro sanchez':  {slug:'leandro-sanchez',  cargo:'Asesor Contable'},
  'gabriela moreno':  {slug:'gabriela-moreno',  cargo:'Asesora de Remuneraciones'},
  'daniela caceres':  {slug:'daniela-caceres',  cargo:'Asesora de Remuneraciones'},
  'viviana garcia':   {slug:'viviana-garcia',   cargo:'Asesora de Remuneraciones'},
  'fernanda montero': {slug:'fernanda-montero', cargo:'Asesora Comercial y de Pagos'}
};
function normNombre(n){return String(n||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();}
function persona(nombre,cargoRespaldo,email){
  if(!nombre)return null;
  var e=EQUIPO[normNombre(nombre)]||{};
  var ini=String(nombre).trim().split(/\s+/).map(function(p){return p.charAt(0);}).join('').slice(0,2).toUpperCase();
  return {nombre:nombre,cargo:e.cargo||cargoRespaldo||'Asesor(a) Contadoor',iniciales:ini,email:email||'',foto:e.slug?BASE+'assets/equipo/'+e.slug+'.jpg':''};
}

window.GestoorReporte={render:renderReporteEmail,persona:persona};
})();
