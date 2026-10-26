/* ============================================================
   prospectos/comercial-guion.js — Guion de la reunión de diagnóstico + brújula por REGLAS (sin IA)
   Comercial C1. El guion vive en el código y se versiona con GUION_VERSION (queda guardado en cada bitácora).
   Si se cambia una pregunta, una opción o una regla: subir la versión.
   · 🧩 (onb:1) = el dato alimenta después el onboarding si el prospecto acepta.
   · La clave SII NUNCA se anota: solo "¿tiene acceso? sí / no / lo tiene el contador" (la base rechaza cualquier campo de clave).
   · Precios de referencia del catálogo de Gestoor (planes / servicios_adicionales) al 26-oct-2026; la brújula solo orienta.
   Sin dependencias: se usa en el navegador (window.ComGuion) y en las pruebas con Node (module.exports).
   ============================================================ */
(function(raiz){
'use strict';
var GUION_VERSION='c1-2026-10-26';
var SINO=[['si','Sí'],['no','No']];

var BLOQUES=[
 {id:'sit',n:'Situación actual',i:'🏢',c:'#5CC8FF',f:'“Antes de contarte cómo trabajamos, prefiero entender bien tu empresa y qué estás viviendo hoy.”',campos:[
   {k:'razon_social',l:'Razón social',t:'text',onb:1},
   {k:'rut_empresa',l:'RUT de la empresa',t:'text',onb:1,ph:'76.123.456-7'},
   {k:'giro',l:'Giro / rubro',t:'text',onb:1},
   {k:'inicio_act',l:'Inicio de actividades',t:'text',onb:1,ph:'mm-aaaa'},
   {k:'antiguedad',l:'Antigüedad',t:'op',o:[['menos1','Menos de 1 año'],['1a3','1 a 3 años'],['3a10','3 a 10 años'],['mas10','Más de 10']]},
   {k:'tipo_soc',l:'Tipo de sociedad',t:'op',onb:1,o:[['spa','SpA'],['ltda','Ltda.'],['eirl','EIRL'],['pn','Persona natural'],['otra','Otra']]},
   {k:'socios',l:'N.º de socios',t:'op',onb:1,o:[['1','1'],['2','2'],['3+','3 o más']]},
   {k:'mas_sociedades',l:'¿Más de una sociedad?',t:'op',o:SINO},
   {k:'ventas',l:'Ventas mensuales',t:'op',o:[['hasta5','Hasta $5M'],['5a20','$5M a $20M'],['20a50','$20M a $50M'],['mas50','Más de $50M']]},
   {k:'canal',l:'¿Cómo vende?',t:'chk',o:[['local','Local / tienda'],['online','En línea'],['b2b','A empresas'],['licitaciones','Licitaciones']]}]},
 {id:'cont',n:'Contabilidad y contador',i:'📚',c:'#E39BE5',f:'“¿Cómo llevan hoy la contabilidad y qué recibes de tu contador?”',campos:[
   {k:'quien',l:'¿Quién la lleva hoy?',t:'op',o:[['externo','Contador externo'],['interno','Contador interno'],['propio','Él/ella mismo/a'],['nadie','Nadie']]},
   {k:'cont_ant',l:'Contador anterior (nombre o empresa)',t:'text',onb:1},
   {k:'traspaso',l:'¿Desde cuándo con nosotros? (traspaso)',t:'op',onb:1,o:[['este_mes','Este mes'],['prox_mes','Próximo mes'],['por_definir','Por definir']]},
   {k:'motivo_cambio',l:'¿Por qué quiere cambiar?',t:'chk',o:[['no_responde','No responde'],['avisa_tarde','Avisa tarde'],['sin_reportes','No entrega reportes'],['errores','Errores / multas'],['precio','Precio']]},
   {k:'erp',l:'Sistema de facturación / ERP',t:'op',onb:1,o:[['sii','Facturador SII'],['defontana','Defontana'],['bsale','Bsale'],['nubox','Nubox'],['otro','Otro'],['no_sabe','No sabe']]},
   {k:'sii_acceso',l:'¿Tiene acceso a la clave SII? (NO anotar la clave)',t:'op',onb:1,o:[['si','Sí'],['no','No'],['contador','La tiene el contador']]},
   {k:'recibe_reportes',l:'¿Recibe reportes de su contador?',t:'op',o:SINO}]},
 {id:'trab',n:'Trabajadores',i:'👥',c:'#FFC85A',f:'“¿Cuántas personas trabajan contigo y quién hace hoy las liquidaciones?”',campos:[
   {k:'ntrab',l:'N.º de trabajadores con contrato',t:'op',onb:1,o:[['0','0'],['1','1'],['2','2'],['3','3'],['4','4'],['5','5'],['6+','6 o más']]},
   {k:'liquida',l:'¿Quién liquida hoy?',t:'op',o:[['contador','El contador'],['ellos','Ellos mismos'],['otra','Otra empresa'],['nadie','Nadie']]},
   {k:'contratos_dia',l:'¿Contratos al día?',t:'op',o:[['si','Sí'],['no','No'],['parcial','Algunos']]},
   {k:'lab_temas',l:'Temas laborales en curso',t:'chk',o:[['contratos','Contratos sin firmar'],['licencias','Licencias'],['finiquito','Finiquito pendiente'],['ninguno','Ninguno']]}]},
 {id:'dol',n:'Dolores',i:'💢',c:'#E07A6E',f:'“¿Qué es lo que más te complica hoy? ¿Qué pasa cuando eso ocurre?”',campos:[
   {k:'dolores',l:'Lo que le duele',t:'chk',o:[['iva_tarde','Me avisan tarde el IVA'],['renta','No sé cuánto pagaré en renta'],['como_va','No sé cómo va mi empresa'],['no_responde','Mi contador no responde'],
      ['solo_cumplir','Solo quiero cumplir'],['multas','Multas / desorden'],['decisiones','Necesito analizar decisiones'],['precio','Busco el menor precio']]},
   {k:'frase',l:'Frase literal del cliente',t:'area'},
   {k:'consecuencia',l:'¿Qué consecuencia le trae?',t:'area',ph:'Ej.: se queda sin caja para pagar proveedores'}]},
 {id:'met',n:'Metas',i:'🎯',c:'#5FCF9C',f:'“Si dentro de seis meses dijeras ‘valió la pena cambiarme a Contadoor’, ¿qué tendría que haber cambiado?”',campos:[
   {k:'meta6',l:'Respuesta a la pregunta de los 6 meses',t:'area'},
   {k:'espera',l:'“¿Qué esperas poder pedirle a tu contador en un mes normal?”',t:'op',o:[['normal','Lo normal (F29, dudas puntuales)'],['anticipacion','Reportes y anticipación'],['siempre','Disponible siempre / 24/7']]},
   {k:'decisiones_txt',l:'Decisiones que viene tomando',t:'area'},
   {k:'reuniones',l:'¿Quiere reuniones periódicas?',t:'op',o:[['no','No'],['trimestral','Trimestral'],['mensual','Mensual']]}]},
 {id:'trib',n:'Tributario',i:'🧾',c:'#7FA6FF',f:'“Revisemos rápido cómo estás con el SII: régimen, IVA y renta.”',campos:[
   {k:'regimen',l:'Régimen',t:'op',onb:1,o:[['propyme_t','Pro Pyme transparente'],['propyme_g','Pro Pyme general'],['semi','General semi integrado'],['presunta','Renta presunta'],['no_sabe','No sabe']]},
   {k:'iva',l:'IVA',t:'op',onb:1,o:[['afecto','Afecto'],['exento','Exento'],['mixto','Mixto']]},
   {k:'f29_dia',l:'¿F29 al día?',t:'op',onb:1,o:SINO},
   {k:'f29_atrasados',l:'¿Cuántos F29 atrasados?',t:'op',onb:1,o:[['1','1'],['2','2'],['3','3'],['4','4'],['5','5'],['6+','6 o más']],dep:['f29_dia','no']},
   {k:'f22',l:'Último F22 (renta)',t:'op',onb:1,o:[['presentado','Presentado'],['pendiente','Pendiente'],['observado','Observado'],['no_sabe','No sabe']]},
   {k:'ppm',l:'¿Paga PPM?',t:'op',o:[['si','Sí'],['no','No'],['no_sabe','No sabe']]}]},
 {id:'urg',n:'Urgencias',i:'🚨',c:'#FFD24D',f:'“¿Hay algo que venza pronto o alguna notificación del SII?”',campos:[
   {k:'urgencias',l:'Urgencias',t:'chk',onb:1,o:[['multas','Multas o giros'],['fiscalizacion','Notificación / fiscalización SII'],['cont_atrasada','Contabilidad atrasada'],['plazo','Plazo esta semana'],['ninguna','Ninguna']]},
   {k:'urg_det',l:'Detalle',t:'area',onb:1,ph:'Ej.: giro por el F29 de julio'}]},
 {id:'pres',n:'Presupuesto y cierre',i:'🤝',c:'#C77BC9',f:'“Por lo que me cuentas, donde veo mejor encaje es… ¿Te hace sentido?”',campos:[
   {k:'paga',l:'¿Cuánto paga hoy por el servicio?',t:'op',o:[['menos1','Menos de 1 UF'],['1a2','1 a 2 UF'],['2a4','2 a 4 UF'],['mas4','Más de 4 UF'],['no_dice','No dice']]},
   {k:'decide',l:'¿Quién decide?',t:'op',o:[['el','Él/ella'],['socio','Con socio/a'],['otra','Otra persona']]},
   {k:'plan',l:'Plan conversado',t:'op',onb:1,o:[['cumplimiento','Cumplimiento'],['pro','Contadoor PRO'],['estrategico','Contadoor Estratégico'],['aun_no','Aún no']]},
   {k:'compromisos',l:'Compromisos acordados',t:'area',onb:1,ph:'Ej.: envía acceso al ERP; nosotros regularizamos los F29 atrasados'}]}
];
var FASES=['Apertura','Contexto','Dolor','Consecuencia','Necesidad','Diagnóstico','Prescripción','Precio','Cierre','Próximo paso'];
var FASE_MIN=[0,2,6,10,13,16,20,23,26,28];
var MOTIVOS=[['precio','Precio'],['eligio_otro','Eligió otro'],['no_responde','No responde'],['no_calza','No calza (no fit)'],['lo_hara_solo','Lo hará solo'],['otro','Otro']];
var PRECIOS={cumplimiento:1,pro:3,laboral_trab:0.39,f29:18990};   // UF/mes · UF/trabajador · CLP por F29 (catálogo 26-oct)

// ── utilidades ──
function campos(){var r=[];BLOQUES.forEach(function(b){b.campos.forEach(function(c){r.push(c);});});return r;}
function campo(k){var x=null;BLOQUES.forEach(function(b){b.campos.forEach(function(c){if(c.k===k)x=c;});});return x;}
function etiqueta(k,v){var c=campo(k);if(!c||!c.o)return v;for(var i=0;i<c.o.length;i++)if(c.o[i][0]===v)return c.o[i][1];return v;}
function lleno(S,c){var v=S[c.k];return Array.isArray(v)?v.length>0:!!(v!=null&&String(v).trim());}
function visible(S,c){return !c.dep||S[c.dep[0]]===c.dep[1];}
function avanceBloque(S,b){var cs=b.campos.filter(function(c){return visible(S,c);});var n=cs.filter(function(c){return lleno(S,c);}).length;return {n:n,t:cs.length,ok:n>=Math.ceil(cs.length*0.6)};}
function onb(S){var cs=campos().filter(function(c){return c.onb&&visible(S,c);});return {n:cs.filter(function(c){return lleno(S,c);}).length,t:cs.length};}
function fase(minuto){var i=0;for(var j=0;j<FASE_MIN.length;j++)if(minuto>=FASE_MIN[j])i=j;return i;}
function hay(S,k,o){return Array.isArray(S[k])&&S[k].indexOf(o)>=0;}
function nTrab(S){var v=S.ntrab;if(v==='6+')return 6;return v?Number(v)||0:0;}
function nF29(S){if(S.f29_dia!=='no')return 0;var v=S.f29_atrasados;if(v==='6+')return 6;return v?Number(v)||0:0;}
function uf(x){return x.toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})+' UF';}
function clp(x){return '$'+Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');}

// ── Precarga desde el formulario de la agenda (leads.respuestas) ──
// Devuelve {campos, origen:{clave:true}, pistas:{clave:'texto'}}; solo rellena lo que está vacío (nunca pisa lo anotado).
function precarga(resp,empresa,actuales){
  resp=resp||{};actuales=actuales||{};var S={},O={},H={};
  function pon(k,v){if(v==null||v==='')return;if(actuales[k]!=null&&actuales[k]!==''&&!(Array.isArray(actuales[k])&&!actuales[k].length))return;S[k]=v;O[k]=true;}
  var V={hasta5:'hasta5','5a20':'5a20','20a50':'20a50',mas50:'mas50',mas80:'mas50'};
  if(V[resp.ventas])pon('ventas',V[resp.ventas]); else if(resp.ventas)H.ventas='Agenda: '+resp.ventas;
  if(resp.trabajadores==='ninguno')pon('ntrab','0');
  else if(resp.trabajadores)H.ntrab='Agenda: '+({'1a5':'1 a 5','6a20':'6 a 20',mas20:'más de 20'}[resp.trabajadores]||resp.trabajadores);
  var Q={yo:'propio',externo:'externo',interno:'interno',nadie:'nadie'};if(Q[resp.contabilidad])pon('quien',Q[resp.contabilidad]);
  if(resp.sociedades==='si'||resp.sociedades==='no')pon('mas_sociedades',resp.sociedades);
  if(resp.historicos==='si')H.urgencias='Agenda: dijo que tiene atrasos o temas históricos';
  if(resp.rubro)pon('giro',String(resp.rubro).slice(0,200));
  if(resp.dolor)pon('frase',String(resp.dolor).slice(0,2000));
  if(empresa)pon('razon_social',String(empresa).slice(0,200));
  return {campos:S,origen:O,pistas:H};
}

// ── Brújula (reglas fijas, explicables, sin conexión) ──
function brujula(S,minuto){
  S=S||{};minuto=minuto||0;
  var c=1,p=1,e=0,why={c:[],p:[],e:[]};
  if(S.ventas==='hasta5'){c+=2;why.c.push('ventas bajo $5M');}
  if(S.ventas==='5a20'||S.ventas==='20a50'){p+=2;why.p.push('ventas '+etiqueta('ventas',S.ventas));}
  if(S.ventas==='mas50'){e+=2;p+=1;why.e.push('ventas sobre $50M');}
  if(S.mas_sociedades==='si'){e+=3;why.e.push('más de una sociedad');}
  var nt=nTrab(S);if(S.ntrab==='0')c+=1;if(nt>0&&nt<6)p+=1;if(nt>=6){p+=1;e+=1;why.e.push('6 o más trabajadores');}
  if(hay(S,'dolores','iva_tarde')){p+=3;why.p.push('quiere el IVA anticipado (Pre-IVA)');}
  if(hay(S,'dolores','renta')){p+=3;why.p.push('quiere anticipar la renta (Pre-Renta)');}
  if(hay(S,'dolores','como_va')){p+=3;why.p.push('quiere reportes de su empresa');}
  if(hay(S,'dolores','no_responde'))p+=1;
  if(hay(S,'dolores','solo_cumplir')){c+=4;why.c.push('solo quiere cumplir');}
  if(hay(S,'dolores','decisiones')){e+=4;why.e.push('quiere analizar decisiones');}
  if(S.reuniones==='mensual'){e+=2;why.e.push('pide reunión mensual');}
  if(S.reuniones==='trimestral')p+=1;
  if(S.regimen==='propyme_g'||S.regimen==='semi'){p+=1;c-=1;why.p.push('su régimen exige contabilidad completa');}
  c=Math.max(0,c);var tot=c+p+e||1;
  var planes=[{k:'cumplimiento',l:'✅ Cumplimiento',s:c,why:why.c,precio:PRECIOS.cumplimiento+' UF/mes'},
              {k:'pro',l:'📊 Contadoor PRO',s:p,why:why.p,precio:PRECIOS.pro+' UF/mes'},
              {k:'estrategico',l:'🧭 Estratégico',s:e,why:why.e,precio:'por propuesta'}];
  planes.forEach(function(x){x.pct=Math.round(x.s/tot*100);});
  var gana=planes.slice().sort(function(a,b){return b.s-a.s;})[0];
  var basta=gana.k==='pro'&&c>=p-1;   // §13: si con cumplir le basta, se recomienda el plan simple

  // Te falta preguntar
  var f=[];
  if(!S.meta6)f.push(['#5FCF9C','🎯 Pregunta de los 6 meses: “¿qué tendría que haber cambiado?”']);
  if(!S.espera)f.push(['#5FCF9C','🎯 “¿Qué esperas pedirle a tu contador en un mes normal?”']);
  if(!S.ntrab)f.push(['#FFC85A','👥 N.º exacto de trabajadores']);
  if(!S.regimen)f.push(['#7FA6FF','🧾 Régimen tributario']);
  if(!S.f29_dia)f.push(['#7FA6FF','🧾 ¿F29 al día?']);
  if(!S.f22)f.push(['#7FA6FF','🧾 ¿Cómo quedó el último F22?']);
  if(!S.rut_empresa)f.push(['#5CC8FF','🏢 RUT de la empresa 🧩']);
  if(!S.sii_acceso)f.push(['#E39BE5','📚 ¿Tiene acceso a la clave SII? (solo sí/no) 🧩']);
  if(!S.decide)f.push(['#C77BC9','🤝 ¿Quién decide?']);

  // Alertas
  var a=[];
  if(nt>0)a.push(['#FFC85A','👥 Tiene trabajadores → pregunta por las remuneraciones (quién liquida, contratos, finiquitos). Gestión Laboral: '+String(PRECIOS.laboral_trab).replace('.',',')+' UF por trabajador al mes ('+uf(nt*PRECIOS.laboral_trab)+').']);
  var nf=nF29(S);
  if(nf>0)a.push(['#E07A6E','🚨 '+nf+(S.f29_atrasados==='6+'?' o más':'')+' F29 atrasado'+(nf>1?'s':'')+' → Regularización F29: '+nf+' × '+clp(PRECIOS.f29)+' = '+clp(nf*PRECIOS.f29)+'. Riesgo de multas e intereses.']);
  else if(S.f29_dia==='no')a.push(['#E07A6E','🚨 F29 atrasados → pregunta cuántos (Regularización F29: '+clp(PRECIOS.f29)+' c/u).']);
  if(hay(S,'urgencias','cont_atrasada'))a.push(['#FFD24D','🛠 Contabilidad atrasada → Regularización previa (se cotiza aparte, después del diagnóstico).']);
  if(hay(S,'urgencias','fiscalizacion'))a.push(['#E07A6E','📮 Notificación o fiscalización del SII → revisar el plazo hoy mismo.']);
  if(hay(S,'dolores','solo_cumplir')&&nt===0)a.push(['#5FCF9C','✅ Calza Cumplimiento: recomienda el plan simple si le basta.']);
  if(hay(S,'dolores','iva_tarde')||hay(S,'dolores','renta'))a.push(['#E39BE5','📊 PRO + Pre-IVA / Pre-Renta: anticipación del IVA y de la renta.']);
  if(hay(S,'dolores','como_va'))a.push(['#E39BE5','📊 PRO + reportes: “no sé cómo va mi empresa”.']);
  if(S.mas_sociedades==='si'||hay(S,'dolores','decisiones'))a.push(['#FFC85A','🧭 Evaluar Estratégico (por propuesta).']);
  if(S.espera==='siempre')a.push(['#E07A6E','⚠️ Espera atención ilimitada / 24/7 → aclara el alcance antes de proponer (cliente no ideal).']);
  if(hay(S,'dolores','precio')||S.paga==='menos1')a.push(['#FFC85A','💬 Si dice “está caro”: “¿caro comparado con qué?”. No usar descuento para tapar un mal diagnóstico.']);
  if(S.sii_acceso==='no'||S.sii_acceso==='contador')a.push(['#E39BE5','🧩 Onboarding: la clave SII se carga después por el flujo seguro. Nunca en la bitácora.']);
  if(S.f22==='pendiente'||S.f22==='observado')a.push(['#7FA6FF','📅 Renta '+etiqueta('f22',S.f22).toLowerCase()+' → ofrecer Operación Renta según el plan.']);
  if(minuto>=20&&!S.paga&&!S.plan)a.push(['#FFC85A','⏱ Van '+minuto+' min → pasa a prescripción y precio.']);

  return {planes:planes,gana:gana,basta:basta,laboral_uf:nt*PRECIOS.laboral_trab,f29_clp:nf*PRECIOS.f29,falta:f,alertas:a,
          foto:{guion:GUION_VERSION,minuto:minuto,plan:gana.k,puntajes:{cumplimiento:c,pro:p,estrategico:e},basta:basta,
                alertas:a.length,falta:f.length,f29:nf,trabajadores:nt}};
}

var API={GUION_VERSION:GUION_VERSION,BLOQUES:BLOQUES,FASES:FASES,FASE_MIN:FASE_MIN,MOTIVOS:MOTIVOS,PRECIOS:PRECIOS,
  campos:campos,campo:campo,etiqueta:etiqueta,lleno:lleno,visible:visible,avanceBloque:avanceBloque,onb:onb,fase:fase,precarga:precarga,brujula:brujula};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
raiz.ComGuion=API;
})(typeof window!=='undefined'?window:globalThis);
