/* ============================================================
   prospectos/comercial-guion.js — Guion de la reunión de diagnóstico + brújula por REGLAS (sin IA)
   Comercial C2 (19-nov-2026): guion COMPACTO de 15 preguntas aprobado por Luciano (hoja "Guion · Reunión de diagnóstico (30 min)").
   El guion vive en el código y se versiona con GUION_VERSION (queda guardado en cada bitácora).
   Si se cambia una pregunta, una opción o una regla: subir la versión.
   · Estructura por tiempos: 1 Apertura (0–3) · 2 Preguntas clave (3–15: Tu empresa 1–5 · Cómo está hoy 6–10 · Qué quiere lograr 11–15)
     · 3 Nuestro Motor (15–22) · 4 ¿Cuál es tu momento? (22–27) · 5 Cierre (27–30).
   · 🧩 (onb:1) = el dato alimenta después el onboarding si el prospecto acepta. Los 🧩 que no son una de las 15 preguntas quedan
     como datos OPCIONALES (opc:1) plegados dentro de la pregunta que corresponde: no se pierden, pero no alargan la reunión.
   · La clave SII NUNCA se anota: solo "¿tiene acceso? sí / no / lo tiene el contador" (la base rechaza cualquier campo de clave).
     Ojo: la base también rechaza claves de campo que contengan "previred" → las cotizaciones se guardan como "cotiz_dia".
   · Las claves de campo de c1 se reutilizan donde significan lo mismo (ventas, ntrab, quien, plan, traspaso…). Las de c1 que ya no
     se preguntan se siguen mostrando (solo lectura) en las bitácoras antiguas gracias a LEGADO.
   · Precios de referencia del catálogo de Gestoor / hoja aprobada (19-nov-2026); la brújula solo orienta.
   Sin dependencias: se usa en el navegador (window.ComGuion) y en las pruebas con Node (module.exports).
   ============================================================ */
(function(raiz){
'use strict';
var GUION_VERSION='c2-2026-11-19';
var SINO=[['si','Sí'],['no','No']];
var SINONS=[['si','Sí'],['no','No'],['no_sabe','No sabe']];

// q = n.º de pregunta (1–15) · qt = la pregunta tal como se dice · qa = ayuda corta · opc = dato opcional (plegado, no cuenta en el avance)
var BLOQUES=[
 {id:'ape',num:'1',n:'Apertura',t:'0–3 min',i:'👋',c:'#5CC8FF',
  f:'“Primero te hago unas preguntas para entender tu empresa; después te muestro cómo trabajamos y te digo qué te recomiendo. ¿Te parece?”',
  guia:['Saludo y presentarnos (Luciano + Benedicta).','Escuchar más que hablar: diagnosticamos antes de recomendar.'],
  campos:[
   {k:'agenda_ok',l:'Agenda de la reunión',t:'op',o:[['si','✓ Acordada']]}]},
 {id:'emp',num:'2',n:'Tu empresa',t:'3–15 min · preguntas 1–5',i:'🏢',c:'#5CC8FF',grupo:'Preguntas clave',
  f:'“Antes de contarte cómo trabajamos, prefiero entender bien tu empresa.”',
  campos:[
   {k:'giro',l:'Giro / rubro',t:'text',onb:1,q:1,qt:'¿A qué se dedica y desde cuándo?',qa:'giro, años de actividad'},
   {k:'antiguedad',l:'Desde cuándo',t:'op',q:1,o:[['menos1','Menos de 1 año'],['1a3','1 a 3 años'],['3a10','3 a 10 años'],['mas10','Más de 10']]},
   {k:'razon_social',l:'Razón social',t:'text',onb:1,opc:1,q:1},
   {k:'rut_empresa',l:'RUT de la empresa',t:'text',onb:1,opc:1,q:1,ph:'76.123.456-7'},
   {k:'inicio_act',l:'Inicio de actividades',t:'text',onb:1,opc:1,q:1,ph:'mm-aaaa'},
   {k:'tipo_soc',l:'Tipo de sociedad',t:'op',onb:1,q:2,qt:'¿Qué tipo de sociedad y régimen tiene?',qa:'SpA, EIRL, Ltda. · Pro Pyme, transparente, general',
     o:[['spa','SpA'],['ltda','Ltda.'],['eirl','EIRL'],['pn','Persona natural'],['otra','Otra']]},
   {k:'regimen',l:'Régimen',t:'op',onb:1,q:2,o:[['propyme_t','Pro Pyme transparente'],['propyme_g','Pro Pyme general'],['semi','General semi integrado'],['presunta','Renta presunta'],['no_sabe','No sabe']]},
   {k:'iva',l:'IVA',t:'op',onb:1,opc:1,q:2,o:[['afecto','Afecto'],['exento','Exento'],['mixto','Mixto']]},
   {k:'ventas',l:'Ventas mensuales',t:'op',q:3,qt:'¿Cuánto vende al mes, aproximadamente?',o:[['hasta5','Hasta $5M'],['5a20','$5M a $20M'],['20a50','$20M a $50M'],['mas50','Más de $50M']]},
   {k:'ntrab',l:'Trabajadores con contrato',t:'op',onb:1,q:4,qt:'¿Trabajadores con contrato? ¿Paga boletas de honorarios?',
     o:[['0','0'],['1','1'],['2','2'],['3','3'],['4','4'],['5','5'],['6+','6 o más']]},
   {k:'boletas_hon',l:'¿Paga boletas de honorarios?',t:'op',q:4,o:SINO},
   {k:'socios',l:'N.º de socios',t:'op',onb:1,q:5,qt:'¿Tiene socios u otras sociedades?',o:[['1','1'],['2','2'],['3+','3 o más']]},
   {k:'mas_sociedades',l:'¿Más de una sociedad?',t:'op',q:5,o:SINO}]},
 {id:'hoy',num:'2',n:'Cómo está hoy',t:'3–15 min · preguntas 6–10',i:'📚',c:'#E39BE5',grupo:'Preguntas clave',
  f:'“¿Cómo están hoy la contabilidad y los impuestos?”',
  campos:[
   {k:'quien',l:'Quién la lleva',t:'op',q:6,qt:'¿Quién lleva hoy su contabilidad?',o:[['externo','Contador externo'],['interno','Contador interno'],['propio','Él/ella mismo/a'],['nadie','Nadie']]},
   {k:'cont_ant',l:'Contador anterior (nombre o empresa)',t:'text',onb:1,opc:1,q:6},
   {k:'erp',l:'Sistema de facturación / ERP',t:'op',onb:1,opc:1,q:6,o:[['sii','Facturador SII'],['defontana','Defontana'],['bsale','Bsale'],['nubox','Nubox'],['otro','Otro'],['no_sabe','No sabe']]},
   {k:'f29_dia',l:'F29 (IVA mensual) al día',t:'op',onb:1,q:7,qt:'¿Está al día con el SII y Previred?',qa:'F29, Renta, cotizaciones',o:SINONS},
   {k:'f22',l:'Último F22 (Renta)',t:'op',onb:1,q:7,o:[['presentado','Presentado'],['pendiente','Pendiente'],['observado','Observado'],['no_sabe','No sabe']]},
   {k:'cotiz_dia',l:'Cotizaciones (Previred) al día',t:'op',q:7,o:[['si','Sí'],['no','No'],['no_aplica','Sin trabajadores'],['no_sabe','No sabe']]},
   {k:'sii_acceso',l:'¿Tiene acceso a la clave SII? (NO anotar la clave)',t:'op',onb:1,opc:1,q:7,o:[['si','Sí'],['no','No'],['contador','La tiene el contador']]},
   {k:'atrasos',l:'Atrasos o deudas',t:'op',q:8,qt:'¿Tiene declaraciones atrasadas o deudas?',o:SINONS},
   {k:'f29_atrasados',l:'¿Cuántos F29 atrasados?',t:'op',onb:1,q:8,o:[['1','1'],['2','2'],['3','3'],['4','4'],['5','5'],['6+','6 o más']],dep:['f29_dia','no']},
   {k:'urgencias',l:'¿Qué hay pendiente?',t:'chk',onb:1,q:8,o:[['multas','Multas o giros'],['deuda_tgr','Deuda con Tesorería'],['fiscalizacion','Notificación / fiscalización SII'],['cont_atrasada','Contabilidad atrasada'],['plazo','Plazo esta semana'],['ninguna','Ninguna']]},
   {k:'urg_det',l:'Detalle',t:'area',onb:1,opc:1,q:8,ph:'Ej.: giro por el F29 de julio'},
   {k:'recibe_reportes',l:'Reportes',t:'op',q:9,qt:'¿Recibe reportes de cómo va su empresa?',o:SINO},
   {k:'motivo_cambio',l:'Lo que le molesta',t:'chk',q:10,qt:'¿Qué es lo que más le molesta del servicio actual?',qa:'por qué se cambia',
     o:[['no_responde','No responde'],['avisa_tarde','Avisa tarde'],['sin_reportes','No entrega reportes'],['errores','Errores / multas'],['precio','Precio']]},
   {k:'paga',l:'¿Cuánto paga hoy por el servicio?',t:'op',opc:1,q:10,o:[['menos1','Menos de 1 UF'],['1a2','1 a 2 UF'],['2a4','2 a 4 UF'],['mas4','Más de 4 UF'],['no_dice','No dice']]}]},
 {id:'log',num:'2',n:'Qué quiere lograr',t:'3–15 min · preguntas 11–15',i:'🎯',c:'#5FCF9C',grupo:'Preguntas clave',
  f:'“¿Qué te gustaría que cambiara?”',
  campos:[
   {k:'dolores',l:'Lo que le preocupa',t:'chk',q:11,qt:'¿Qué le preocupa hoy de su empresa?',qa:'caja, impuestos, multas, trabajadores…',
     o:[['caja','Caja'],['iva_tarde','Me avisan tarde el IVA'],['renta','No sé cuánto pagaré en renta'],['como_va','No sé cómo va mi empresa'],['multas','Multas / desorden'],
        ['trabajadores','Trabajadores'],['no_responde','Mi contador no responde'],['solo_cumplir','Solo quiero cumplir'],['decisiones','Necesito analizar decisiones'],['precio','Busco el menor precio']]},
   {k:'frase',l:'En sus palabras',t:'area',q:11,ph:'Frase literal del cliente'},
   {k:'decision',l:'Decisión del año',t:'chk',q:12,qt:'¿Qué decisión importante viene este año?',
     o:[['crecer','Crecer'],['invertir','Invertir'],['contratar','Contratar'],['retirar','Retirar utilidades'],['ninguna','Ninguna por ahora']]},
   {k:'decisiones_txt',l:'Detalle de la decisión',t:'area',opc:1,q:12},
   {k:'informar',l:'Cómo informarle',t:'chk',q:13,qt:'¿Cómo prefiere que le informemos?',o:[['correo','Correo'],['whatsapp','WhatsApp'],['reuniones','Reuniones']]},
   {k:'reuniones',l:'Cada cuánto revisar',t:'op',q:14,qt:'¿Cada cuánto le gustaría revisar su empresa con nosotros?',
     o:[['no','Solo cuando haga falta'],['trimestral','Cada 3 meses'],['mensual','Todos los meses']]},
   {k:'traspaso',l:'Desde cuándo',t:'op',onb:1,q:15,qt:'¿Desde cuándo quiere partir?',o:[['este_mes','Este mes'],['prox_mes','Próximo mes'],['por_definir','Por definir']]}]},
 {id:'mot',num:'3',n:'Nuestro Motor',t:'15–22 min',i:'⚙️',c:'#FFC85A',
  f:'“No somos un contador, somos un motor de 6 piezas.” (resumen, no leer todo)',
  guia:['Conecta cada pieza con lo que dijo.','Personas: equipo, no una persona · Tecnología: Gestoor + SII + MiContadoor · Control: F29 a tiempo y confirmado',
        'Información: reporte mensual en simple · Anticipación: Pre-IVA y Pre-Renta · Comunicación: correo, WhatsApp, reuniones'],
  campos:[
   {k:'piezas',l:'Piezas que conectaste con lo que dijo',t:'chk',o:[['personas','Personas'],['tecnologia','Tecnología'],['control','Control'],['informacion','Información'],['anticipacion','Anticipación'],['comunicacion','Comunicación']]}]},
 {id:'mom',num:'4',n:'¿Cuál es tu momento?',t:'22–27 min',i:'🧭',c:'#C77BC9',
  f:'“Por lo que me cuentas, tu momento es… ¿Te hace sentido?” · Recomendar lo correcto, no lo más caro.',
  guia:['Regularizar primero: si hay atrasos, ponerlo al día antes del plan (F29 a $19.990 c/u; Renta caso a caso).',
        'Cumplir · 1 UF: «Solo quiero declarar». F29 + aviso del impuesto, por correo.',
        'Controlar · PRO 3 UF: «Que se encarguen y saber cómo voy». Contabilidad, Pre-IVA, reporte, reunión c/3 meses.',
        'Decidir · desde 7 UF: «Que alguien piense conmigo». Responsable definido, reunión mensual.',
        '+ Gestión Laboral 0,39 UF por trabajador · Operación Renta en abril. Valores exentos de IVA.'],
  campos:[
   {k:'regularizar',l:'¿Regularizar primero?',t:'op',o:SINO},
   {k:'plan',l:'Momento recomendado',t:'op',onb:1,o:[['cumplimiento','Cumplir · 1 UF'],['pro','Controlar · PRO 3 UF'],['estrategico','Decidir · desde 7 UF'],['aun_no','Aún no']]},
   {k:'laboral',l:'+ Gestión Laboral',t:'op',o:SINO},
   {k:'decide',l:'¿Quién decide?',t:'op',opc:1,o:[['el','Él/ella'],['socio','Con socio/a'],['otra','Otra persona']]}]},
 {id:'cie',num:'5',n:'Cierre y siguiente paso',t:'27–30 min',i:'🤝',c:'#5FCF9C',
  f:'“Te mando hoy la propuesta por correo, en UF y sin letra chica. ¿Qué fecha te acomoda para tu respuesta?”',
  guia:['Al cliente decir «nuestros servicios».','Claves solo en la reunión, nunca por correo.','Después: anotar en Prospectos la próxima acción y la fecha (abajo, en «Cerrar reunión»).'],
  campos:[
   {k:'cierre_pasos',l:'Pasos del cierre',t:'chk',o:[['plan','1) Plan confirmado'],['propuesta','2) Propuesta por correo hoy'],['accesos','3) Accesos y conexión con el SII'],['fecha','Fecha concreta de respuesta']]},
   {k:'compromisos',l:'Compromisos acordados',t:'area',onb:1,ph:'Ej.: envía acceso al ERP; nosotros regularizamos los F29 atrasados'}]}
];
// Fases del reloj = los tiempos de la hoja aprobada.
var FASES=['Apertura','Tu empresa','Cómo está hoy','Qué quiere lograr','Nuestro Motor','Tu momento','Cierre'];
var FASE_MIN=[0,3,7,11,15,22,27];
var MOTIVOS=[['precio','Precio'],['eligio_otro','Eligió otro'],['no_responde','No responde'],['no_calza','No calza (no fit)'],['lo_hara_solo','Lo hará solo'],['otro','Otro']];
var PRECIOS={cumplimiento:1,pro:3,estrategico:7,laboral_trab:0.39,f29:19990};   // UF/mes · UF/mes · desde UF/mes · UF/trabajador · CLP por F29

// Guion anterior (c1-2026-10-26): campos y bloques que ya no se preguntan. Solo para MOSTRAR bitácoras antiguas (nunca se borran).
var LEGADO={version:'c1-2026-10-26',
 campos:{
  canal:['¿Cómo vende?',[['local','Local / tienda'],['online','En línea'],['b2b','A empresas'],['licitaciones','Licitaciones']]],
  liquida:['¿Quién liquida hoy?',[['contador','El contador'],['ellos','Ellos mismos'],['otra','Otra empresa'],['nadie','Nadie']]],
  contratos_dia:['¿Contratos al día?',[['si','Sí'],['no','No'],['parcial','Algunos']]],
  lab_temas:['Temas laborales en curso',[['contratos','Contratos sin firmar'],['licencias','Licencias'],['finiquito','Finiquito pendiente'],['ninguno','Ninguno']]],
  consecuencia:['¿Qué consecuencia le trae?',null],
  meta6:['Respuesta a la pregunta de los 6 meses',null],
  espera:['¿Qué espera pedirle a su contador en un mes normal?',[['normal','Lo normal (F29, dudas puntuales)'],['anticipacion','Reportes y anticipación'],['siempre','Disponible siempre / 24/7']]],
  ppm:['¿Paga PPM?',[['si','Sí'],['no','No'],['no_sabe','No sabe']]]},
 notas:{sit:'Situación actual',cont:'Contabilidad y contador',trab:'Trabajadores',dol:'Dolores',met:'Metas',trib:'Tributario',urg:'Urgencias',pres:'Presupuesto y cierre'}};

// ── utilidades ──
function campos(){var r=[];BLOQUES.forEach(function(b){b.campos.forEach(function(c){r.push(c);});});return r;}
function campo(k){var x=null;BLOQUES.forEach(function(b){b.campos.forEach(function(c){if(c.k===k)x=c;});});return x;}
function opcion(os,v){if(!os)return null;for(var i=0;i<os.length;i++)if(os[i][0]===v)return os[i][1];return null;}
function etiqueta(k,v){var c=campo(k),os=c?c.o:(LEGADO.campos[k]&&LEGADO.campos[k][1]);if(!os)return v;var e=opcion(os,v);return e==null?v:e;}
function lleno(S,c){var v=S[c.k];return Array.isArray(v)?v.length>0:!!(v!=null&&String(v).trim());}
function visible(S,c){return !c.dep||S[c.dep[0]]===c.dep[1];}
// Avance: cuenta solo lo que se pregunta (los datos opcionales 🧩 no alargan la barra).
function avanceBloque(S,b){var cs=b.campos.filter(function(c){return visible(S,c)&&!c.opc;});var n=cs.filter(function(c){return lleno(S,c);}).length;return {n:n,t:cs.length,ok:n>=Math.ceil(cs.length*0.6)};}
function onb(S){var cs=campos().filter(function(c){return c.onb&&visible(S,c);});return {n:cs.filter(function(c){return lleno(S,c);}).length,t:cs.length};}
function fase(minuto){var i=0;for(var j=0;j<FASE_MIN.length;j++)if(minuto>=FASE_MIN[j])i=j;return i;}
function hay(S,k,o){return Array.isArray(S[k])&&S[k].indexOf(o)>=0;}
function nTrab(S){var v=S.ntrab;if(v==='6+')return 6;return v?Number(v)||0:0;}
function nF29(S){if(S.f29_dia!=='no')return 0;var v=S.f29_atrasados;if(v==='6+')return 6;return v?Number(v)||0:0;}
function uf(x){return x.toLocaleString('es-CL',{minimumFractionDigits:2,maximumFractionDigits:2})+' UF';}
function clp(x){return '$'+Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
function txtValor(k,v){return Array.isArray(v)?v.map(function(x){return etiqueta(k,x);}).join(', '):etiqueta(k,v);}

// ── Lo anotado con un guion anterior que el guion vigente ya no pregunta (para mostrarlo, solo lectura) ──
function extras(S,N){
  S=S||{};N=N||{};var ids={general:1},r={campos:[],notas:[]};BLOQUES.forEach(function(b){ids[b.id]=1;});
  Object.keys(S).forEach(function(k){if(campo(k))return;var v=S[k];if(v==null||v===''||(Array.isArray(v)&&!v.length))return;
    r.campos.push({k:k,l:LEGADO.campos[k]?LEGADO.campos[k][0]:k,v:txtValor(k,v)});});
  Object.keys(N).forEach(function(id){if(ids[id]||N[id]==null||!String(N[id]).trim())return;r.notas.push({id:id,n:LEGADO.notas[id]||id,v:String(N[id])});});
  return r;
}

// ── Precarga desde el formulario de la agenda (leads.respuestas) ──
// Devuelve {campos, origen:{clave:true}, pistas:{clave:'texto'}}; solo rellena lo que está vacío (nunca pisa lo anotado).
// Valores de la agenda: ventas hasta5|5a20|20a50|mas50 · trabajadores ninguno|1a5|6a20|mas20 · contabilidad yo|externo|interno|nadie
//                       sociedades si|no · historicos si|no|nose · rubro · dolor (texto).
function precarga(resp,empresa,actuales){
  resp=resp||{};actuales=actuales||{};var S={},O={},H={};
  function pon(k,v){if(v==null||v==='')return;if(actuales[k]!=null&&actuales[k]!==''&&!(Array.isArray(actuales[k])&&!actuales[k].length))return;S[k]=v;O[k]=true;}
  var V={hasta5:'hasta5','5a20':'5a20','20a50':'20a50',mas50:'mas50',mas80:'mas50'};
  if(V[resp.ventas])pon('ventas',V[resp.ventas]); else if(resp.ventas)H.ventas='Agenda: '+resp.ventas;
  if(resp.trabajadores==='ninguno')pon('ntrab','0');
  else if(resp.trabajadores==='6a20'||resp.trabajadores==='mas20'){pon('ntrab','6+');H.ntrab='Agenda: '+(resp.trabajadores==='mas20'?'más de 20':'6 a 20');}
  else if(resp.trabajadores)H.ntrab='Agenda: '+({'1a5':'1 a 5'}[resp.trabajadores]||resp.trabajadores)+' · confirma el número';
  var Q={yo:'propio',externo:'externo',interno:'interno',nadie:'nadie'};if(Q[resp.contabilidad])pon('quien',Q[resp.contabilidad]);
  if(resp.sociedades==='si'||resp.sociedades==='no')pon('mas_sociedades',resp.sociedades);
  var A={si:'si',no:'no',nose:'no_sabe'};if(A[resp.historicos])pon('atrasos',A[resp.historicos]);
  if(resp.historicos==='nose')H.atrasos='Agenda: «no estoy seguro» · pregúntalo';
  if(resp.rubro)pon('giro',String(resp.rubro).slice(0,200));
  if(resp.dolor)pon('frase',String(resp.dolor).slice(0,2000));
  if(empresa)pon('razon_social',String(empresa).slice(0,200));
  return {campos:S,origen:O,pistas:H};
}
// ✓ "ya respondió en la agenda": el valor anotado coincide con lo que respondió (sirve también al recargar la bitácora).
function deLaAgenda(S,resp,empresa){
  var p=precarga(resp,empresa,{}),o={};S=S||{};
  Object.keys(p.campos).forEach(function(k){if(S[k]!=null&&JSON.stringify(S[k])===JSON.stringify(p.campos[k]))o[k]=true;});
  return o;
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
  if(hay(S,'dolores','caja')){p+=2;why.p.push('le preocupa la caja');}
  if(hay(S,'dolores','no_responde'))p+=1;
  if(S.recibe_reportes==='no'||hay(S,'motivo_cambio','sin_reportes')){p+=1;}
  if(hay(S,'dolores','solo_cumplir')){c+=4;why.c.push('solo quiere cumplir');}
  if(hay(S,'dolores','decisiones')){e+=4;why.e.push('quiere analizar decisiones');}
  if(hay(S,'decision','crecer')||hay(S,'decision','invertir')||hay(S,'decision','retirar')){e+=2;why.e.push('viene una decisión importante este año');}
  if(hay(S,'decision','contratar'))p+=1;
  if(S.reuniones==='mensual'){e+=2;why.e.push('quiere revisar todos los meses');}
  if(S.reuniones==='trimestral'){p+=1;why.p.push('revisar cada 3 meses');}
  if(S.regimen==='propyme_g'||S.regimen==='semi'){p+=1;c-=1;why.p.push('su régimen exige contabilidad completa');}
  c=Math.max(0,c);var tot=c+p+e||1;
  var planes=[{k:'cumplimiento',l:'✅ Cumplir',s:c,why:why.c,precio:PRECIOS.cumplimiento+' UF/mes'},
              {k:'pro',l:'📊 Controlar · PRO',s:p,why:why.p,precio:PRECIOS.pro+' UF/mes'},
              {k:'estrategico',l:'🧭 Decidir',s:e,why:why.e,precio:'desde '+PRECIOS.estrategico+' UF/mes'}];
  planes.forEach(function(x){x.pct=Math.round(x.s/tot*100);});
  var gana=planes.slice().sort(function(a,b){return b.s-a.s;})[0];
  var basta=gana.k==='pro'&&c>=p-1;   // §13: si con cumplir le basta, se recomienda el plan simple

  // Te falta preguntar (en el orden de la hoja)
  var f=[];
  if(!S.tipo_soc)f.push(['#5CC8FF','🏢 2 · Tipo de sociedad 🧩']);
  if(!S.regimen)f.push(['#5CC8FF','🏢 2 · Régimen tributario 🧩']);
  if(!S.ntrab)f.push(['#5CC8FF','🏢 4 · N.º exacto de trabajadores 🧩']);
  if(!S.boletas_hon)f.push(['#5CC8FF','🏢 4 · ¿Paga boletas de honorarios?']);
  if(!S.f29_dia)f.push(['#E39BE5','📚 7 · ¿F29 al día?']);
  if(!S.atrasos)f.push(['#E39BE5','📚 8 · ¿Declaraciones atrasadas o deudas?']);
  if(!(S.motivo_cambio&&S.motivo_cambio.length))f.push(['#E39BE5','📚 10 · ¿Qué le molesta del servicio actual?']);
  if(!(S.dolores&&S.dolores.length))f.push(['#5FCF9C','🎯 11 · ¿Qué le preocupa hoy?']);
  if(!(S.decision&&S.decision.length))f.push(['#5FCF9C','🎯 12 · ¿Qué decisión importante viene este año?']);
  if(!S.traspaso)f.push(['#5FCF9C','🎯 15 · ¿Desde cuándo quiere partir? 🧩']);

  // Alertas
  var a=[];
  if(nt>0)a.push(['#FFC85A','👥 Tiene trabajadores → Gestión Laboral: '+String(PRECIOS.laboral_trab).replace('.',',')+' UF por trabajador al mes ('+uf(nt*PRECIOS.laboral_trab)+'). Confirma cotizaciones (Previred) al día.']);
  if(S.boletas_hon==='si')a.push(['#FFC85A','🧾 Paga boletas de honorarios → considerar la retención en el F29 y la declaración jurada anual.']);
  if(S.cotiz_dia==='no')a.push(['#E07A6E','🚨 Cotizaciones atrasadas → riesgo de multas e intereses; va en «Regularizar primero».']);
  var nf=nF29(S);
  if(nf>0)a.push(['#E07A6E','🚨 '+nf+(S.f29_atrasados==='6+'?' o más':'')+' F29 atrasado'+(nf>1?'s':'')+' → Regularización F29: '+nf+' × '+clp(PRECIOS.f29)+' = '+clp(nf*PRECIOS.f29)+'. Riesgo de multas e intereses.']);
  else if(S.f29_dia==='no')a.push(['#E07A6E','🚨 F29 atrasados → pregunta cuántos (Regularización F29: '+clp(PRECIOS.f29)+' c/u).']);
  if(S.atrasos==='si'||hay(S,'urgencias','cont_atrasada')||hay(S,'urgencias','deuda_tgr'))a.push(['#FFD24D','🛠 Hay atrasos o deudas → «Regularizar primero»: ponerlo al día antes del plan (se cotiza aparte).']);
  else if(S.atrasos==='no_sabe'||S.f29_dia==='no_sabe')a.push(['#FFD24D','🔎 No sabe si está al día → ofrecer revisarlo con acceso al SII antes de cotizar.']);
  if(hay(S,'urgencias','fiscalizacion'))a.push(['#E07A6E','📮 Notificación o fiscalización del SII → revisar el plazo hoy mismo.']);
  if(hay(S,'dolores','solo_cumplir')&&nt===0)a.push(['#5FCF9C','✅ Calza Cumplir: recomienda el plan simple si le basta.']);
  if(hay(S,'dolores','iva_tarde')||hay(S,'dolores','renta'))a.push(['#E39BE5','📊 Controlar + Pre-IVA / Pre-Renta: anticipación del IVA y de la renta.']);
  if(hay(S,'dolores','como_va')||S.recibe_reportes==='no')a.push(['#E39BE5','📊 Controlar + reporte mensual: “no sé cómo va mi empresa”.']);
  if(S.mas_sociedades==='si'||hay(S,'dolores','decisiones'))a.push(['#FFC85A','🧭 Evaluar Decidir (desde '+PRECIOS.estrategico+' UF).']);
  if(S.espera==='siempre')a.push(['#E07A6E','⚠️ Espera atención ilimitada / 24/7 → aclara el alcance antes de proponer (cliente no ideal).']);
  if(hay(S,'dolores','precio')||hay(S,'motivo_cambio','precio')||S.paga==='menos1')a.push(['#FFC85A','💬 Si dice “está caro”: “¿caro comparado con qué?”. No usar descuento para tapar un mal diagnóstico.']);
  if(S.sii_acceso==='no'||S.sii_acceso==='contador')a.push(['#E39BE5','🧩 Onboarding: la clave SII se carga después por el flujo seguro. Nunca en la bitácora.']);
  if(S.f22==='pendiente'||S.f22==='observado')a.push(['#7FA6FF','📅 Renta '+etiqueta('f22',S.f22).toLowerCase()+' → ofrecer Operación Renta (abril) según el plan.']);
  if(minuto>=22&&!S.plan)a.push(['#FFC85A','⏱ Van '+minuto+' min → pasa a «¿Cuál es tu momento?» y la recomendación.']);
  else if(minuto>=15&&minuto<22&&!(S.piezas&&S.piezas.length))a.push(['#FFC85A','⏱ Van '+minuto+' min → cuenta «Nuestro Motor» (resumen).']);

  return {planes:planes,gana:gana,basta:basta,laboral_uf:nt*PRECIOS.laboral_trab,f29_clp:nf*PRECIOS.f29,falta:f,alertas:a,
          foto:{guion:GUION_VERSION,minuto:minuto,plan:gana.k,puntajes:{cumplimiento:c,pro:p,estrategico:e},basta:basta,
                alertas:a.length,falta:f.length,f29:nf,trabajadores:nt}};
}

var API={GUION_VERSION:GUION_VERSION,BLOQUES:BLOQUES,FASES:FASES,FASE_MIN:FASE_MIN,MOTIVOS:MOTIVOS,PRECIOS:PRECIOS,LEGADO:LEGADO,
  campos:campos,campo:campo,etiqueta:etiqueta,lleno:lleno,visible:visible,avanceBloque:avanceBloque,onb:onb,fase:fase,
  precarga:precarga,deLaAgenda:deLaAgenda,extras:extras,brujula:brujula};
if(typeof module!=='undefined'&&module.exports)module.exports=API;
raiz.ComGuion=API;
})(typeof window!=='undefined'?window:globalThis);
