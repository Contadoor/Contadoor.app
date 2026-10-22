/* ============================================================
   pir/proyeccion.js — MiRenta · Proyección de la renta (E1-1, motor T1_RLI_14D3 e1-1@1.0.0)
   Pantalla real conectada SOLO a las RPC y tablas del motor (migración 202610201000_e1_1_motor_proyeccion + E0A-1):
     RPC  renta_yo · renta_e1_proyeccion_vigente · renta_e1_proyectar · renta_supuesto_forecast_crear ·
          renta_supuesto_forecast_activar · renta_e1_mes_declarar · renta_e1_mes_revocar · renta_e1_marcar
     Tablas (solo lectura, RLS por cartera) renta_casos · clientes · renta_motor_outputs (trace) · renta_f22_layout_items ·
          renta_e1_trazas_caja · renta_lineas_diario · renta_asientos · renta_meses_declarados · renta_e1_marcas · renta_supuestos_forecast
   El motor manda: cada RPC valida rol y cartera; la pantalla nunca calcula impuestos por su cuenta (solo presenta y resta
   para mostrar diferencias). "No disponible" nunca se muestra como $0.
   Modo demostración: ver proyeccion-demo.js (solo ?demo=1 en localhost).
   ============================================================ */
(function(){
'use strict';

var HOST=location.hostname, LOCAL=(HOST==='localhost'||HOST==='127.0.0.1'||HOST==='[::1]');
var DEMO=window.MR_DEMO===true&&LOCAL&&!!window.MR_DEMO_API;   // tercer control: además del HTML y del archivo demo

/* ── Íconos (trazo estilo Lucide). Los del menú común vienen de gIcon (gestoor-menu.js) ── */
var PX={
  'flecha-izq':'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  'flecha-der':'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  persona:'<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  codigo:'<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  lupa:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  imprimir:'<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  cerrar:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  ampliar:'<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
  escudo:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  hucha:'<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/>',
  capas:'<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  radar:'<path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><path d="M12 18h.01"/><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/>',
  moneda:'<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
  tendencia:'<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
};
function ic(n){
  if(PX[n])return '<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+PX[n]+'</svg>';
  return window.gIcon?window.gIcon(n):'';
}
function I(n,c){return '<i class="ic '+(c||'')+'">'+ic(n)+'</i>';}
function pintarIconos(root){(root||document).querySelectorAll('[data-ic]').forEach(function(el){el.innerHTML=ic(el.getAttribute('data-ic'));el.removeAttribute('data-ic');});}

/* ── Formato ── */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function miles(n){return Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
function clp(n){if(n==null||isNaN(n))return '<span class="nd">No disponible</span>';n=Number(n);return (n<0?'−':'')+'$'+miles(n);}
function clpT(n){if(n==null||isNaN(n))return 'No disponible';n=Number(n);return (n<0?'−':'')+'$'+miles(n);}
function mm(n){if(n==null)return '<span class="nd">No disponible</span>';var v=Math.abs(n)/1e6;return (n<0?'−':'')+'$'+v.toLocaleString('es-CL',{maximumFractionDigits:v>=100?1:2})+' MM';}
function pctTxt(x){return x==null||!isFinite(x)?'—':(x*100).toLocaleString('es-CL',{maximumFractionDigits:1})+' %';}
function fFecha(iso){if(!iso)return '—';var p=String(iso).slice(0,10).split('-');return p[2]+'-'+p[1]+'-'+p[0];}
function fHora(iso){if(!iso)return '';var d=new Date(iso);if(isNaN(d))return '';function z(n){return (n<10?'0':'')+n;}return z(d.getDate())+'-'+z(d.getMonth()+1)+'-'+d.getFullYear()+' · '+z(d.getHours())+':'+z(d.getMinutes());}
var MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
var MES3=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
function finDeMes(y,m){var d=new Date(Date.UTC(y,m,0));return y+'-'+('0'+m).slice(-2)+'-'+('0'+d.getUTCDate()).slice(-2);}
function $(id){return document.getElementById(id);}

/* ── Acceso a datos: real (supabase.js, JWT del usuario) o demostración local ── */
function errMotor(status,texto){
  var j=null;try{j=JSON.parse(texto);}catch(e){}
  var e=new Error((j&&j.message)||texto||('HTTP '+status));
  e.mr={code:j&&j.code,message:(j&&j.message)||texto||'',status:status};
  return e;
}
function leer(r){if(!r.ok)return r.text().then(function(t){throw errMotor(r.status,t);});return r.status===204?null:r.json();}
var API=DEMO?window.MR_DEMO_API:{
  // sbFetch (supabase.js) pone el JWT del usuario y falla cerrado sin sesión; nunca la clave anon como Bearer.
  // A diferencia de sbGet, un error de lectura se muestra (no se convierte en una lista vacía).
  get:function(path){return sbFetch(path).then(leer);},
  rpc:function(fn,args){return sbFetch('rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||{})}).then(leer);}
};

/* ── Errores del motor → mensajes claros ── */
var ERRORES={
  RENTA_SIN_PERMISO:'No tienes permiso para este caso. MiRenta lo ve el Master y el analista contable asignado al cliente.',
  'No autorizado':'No tienes permiso para operar este caso (Master o analista contable asignado, con el cliente operativo en MiRenta).',
  'No autorizado para operar este caso':'No tienes permiso para operar este caso (Master o analista contable asignado, con el cliente operativo en MiRenta).',
  CASO_INVALIDO:'El caso no admite una proyección con estos datos (régimen, estado del caso o fecha de corte).',
  CORTE_INVALIDO:'La fecha de corte no es válida: debe ser fin de mes y estar cubierta por el Balance cargado.',
  DIARIO_AUSENTE:'Falta el Libro Diario vigente del año comercial. Cárgalo en la apertura de MiRenta.',
  BALANCE_AUSENTE:'Falta el Balance vigente del año comercial. Cárgalo en la apertura de MiRenta.',
  DIARIO_BALANCE_NO_CUADRA:'El Libro Diario y el Balance no cuadran. Revisa la conciliación antes de proyectar.',
  SNAPSHOT_MAPEO_DESACTUALIZADO:'El mapeo de cuentas no está vigente para el Diario y el Balance actuales. Actualízalo antes de proyectar.',
  APERTURA_CONTABLE_INVALIDA:'La apertura contable no está aceptada (se requiere A2 o A3).',
  SUPUESTO_INVALIDO:'El supuesto de proyección no es el activo del caso.',
  SUPUESTO_NO_SOPORTADO:'El supuesto no es compatible con el motor e1-1 (método MANUAL con LINEAL_PROMEDIO_V1, hasta 5 retiros adicionales futuros).',
  LAYOUT_AUSENTE:'No hay formato F22 vigente para este régimen y año tributario. Lo carga el Master.',
  LAYOUT_INVALIDO:'El formato F22 vigente no pasó la validación. Avisa al Master.',
  MES_YA_DECLARADO:'Ese mes ya está declarado sin movimiento.',
  SIN_DECLARACION_VIGENTE:'La declaración ya no existe o ya fue revocada. Recarga la pantalla.',
  ASIENTO_INVALIDO:'El asiento no pertenece al Libro Diario vigente del caso (o es el de apertura).',
  CUENTA_INVALIDA:'La cuenta indicada no está en el asiento.',
  COMPONENTE_APERTURA:'El monto del componente de apertura no es válido.',
  DEMO_SOLO_SEPTIEMBRE:'En la demostración solo existe la contabilidad al 30-09-2026.'
};
function textoError(e){
  var m=(e&&e.mr&&e.mr.message)||(e&&e.message)||String(e||'');
  var code=e&&e.mr&&e.mr.code, st=e&&e.mr&&e.mr.status;
  if(m==='GESTOOR_NO_SESSION'||m==='GESTOOR_SDK_TIMEOUT')return 'Tu sesión no está activa. Vuelve a ingresar a Gestoor.';
  if(code==='PGRST202'||code==='42883'||code==='PGRST205'||code==='42P01'||(st===404&&/function|relation|Could not find/i.test(m)))return 'MOTOR_NO_INSTALADO';
  var k=m.split(':')[0].trim();
  if(ERRORES[k])return ERRORES[k]+(m.indexOf(':')>0?' ('+esc(m.slice(m.indexOf(':')+1).trim())+')':'');
  if(ERRORES[m])return ERRORES[m];
  return 'El motor respondió: '+esc(m);
}

/* ── Vocabulario del motor ── */
var RAZON={
  FUERA_DE_ALCANCE_V1:'Fuera del alcance de la versión 1 del motor',SIN_SUPUESTO_FORECAST:'No hay supuesto de proyección activo',
  MES_NO_ACREDITADO:'Hay meses sin movimientos ni declaración "sin movimiento"',PARAM_NO_ACTIVA:'Falta una regla tributaria activa',
  SIN_APERTURA_TRIBUTARIA:'No hay apertura tributaria (saldos del F22 del período anterior)',APERTURA_ITEM_PENDIENTE:'Saldo de apertura tributaria pendiente',
  UF_NO_DISPONIBLE:'No hay UF del año en Panel de Control',RETIROS_EXCEDEN_RAI:'Los retiros superan el RAI disponible',
  PERDIDA_FUERA_DE_ALCANCE_V1:'Pérdida tributaria: fuera del alcance v1',MES_RETIRO_NO_FUTURO:'El mes del retiro simulado no es futuro',
  REX_CON_MOVIMIENTO:'Hay ingresos exentos con movimiento (REX fuera del alcance v1)',ASIGNACION_AMBIGUA:'Un asiento reparte el pago entre varias partidas sin poder asignarlo',
  APERTURA_NO_DISTINGUIBLE:'No se distingue el saldo de apertura de lo del año',CXP_MULTIFAMILIA:'Una cuenta por pagar alimenta varias partidas',
  NETO_SIN_BASE:'No hay base para calcular el neto',PAGO_SIN_CAJA:'Hay pagos sin contrapartida de caja/banco',COBRO_SIN_CAJA:'Hay cobros sin contrapartida de caja/banco',
  NETO_POR_RAZON:'Neto estimado por la razón neto/bruto del año',SALDO_PENDIENTE_NO_SUMADO:'Saldo pendiente no sumado',BRUTO_PAGADO:'Bruto pagado',
  APERTURA_BRUTA:'Saldo bruto de apertura',RET_DEBITO_NO_EXPLICADO:'Movimiento de retenciones sin explicar',RET_SIN_CODIGO:'Retención sin partida del F22',
  F29_SIN_CALCE:'Pago de F29 sin centralización que calce',F29_CENTRALIZACION_NO_SIMPLE:'Centralización de F29 no simple',
  F29_DEBITO_NO_EXPLICADO:'Movimiento de impuestos por pagar sin explicar',APERTURA_SIN_COMPONENTES:'Saldo de apertura de impuestos sin componentes declarados',
  COMPONENTE_SIN_CODIGO:'Componente de apertura sin partida',IVA_A_COSTO_SIN_PRUEBA:'IVA pasado a costo sin prueba de pago',
  PORCION_APERTURA_INVALIDA:'Porción de apertura inválida',IVA_APERTURA_A_COSTO_SIN_RESOLVER:'IVA del período anterior pasado a costo sin resolver',
  MAPEO_UNKNOWN:'Cuentas sin clasificar en el mapeo',ASIENTO_CLASE_PRIOR_YEAR_ADJUSTMENT:'Asiento de ajuste de años anteriores',
  PAGO_MIXTO:'Pago mixto (no se puede asignar)',CAJA_AMBOS_LADOS:'Caja en ambos lados del asiento',INGRESO_SIN_COBRO_IDENTIFICABLE:'Ingreso sin cobro identificable',
  GASTO_SIN_PAGO_IDENTIFICABLE:'Gasto sin pago identificable',CATEGORIA_SIN_CODIGO:'Categoría con movimiento sin partida en el F22',
  LAYOUT_SIN_ITEM_APERTURA:'El formato F22 no tiene partida para saldos de apertura',NO_DETERMINADO:'No determinado',
  POR_PAGAR_AL_CORTE:'Por pagar al corte (va al año siguiente)',ASIENTO:'Asiento',APERTURA_IVA:'IVA de la apertura en la contrapartida',MARCA:'Marca del analista',
  SIN_MESES_RESTANTES:'No quedan meses en el año'
};
function razonTxt(r){var p=String(r).split(':'), k=p[0], resto=p.slice(1).join(':');if(k!=='ASIENTO'&&k!=='MARCA'&&/^-?\d+(\.\d+)?$/.test(resto))resto=clpT(+resto);return (RAZON[k]||k)+(p.length>1?' · '+esc(resto):'');}
var FUENTE={CAJA_DIRECTA:'Pagado o cobrado directo con caja/banco',CUENTA_SALDADA:'Cuenta saldada al corte: lo devengado quedó pagado/cobrado',
  PAGO_PARCIAL:'Pago parcial de la cuenta',DEVENGO:'Devengo del año',APERTURA:'Saldo de apertura pagado/cobrado en el año',
  RETENCION_PAGADA:'Retenciones y cotizaciones por lo pagado (M11/M12/M15)',APERTURA_DECLARADA:'Componente de la apertura pagado en el año (declarado)',
  F29_DIRECTO:'Gasto cargado directo en un F29 calzado',F29:'F29',IVA_A_COSTO:'IVA crédito pasado a costo (asiento de ajuste)',SIN_EVIDENCIA:'Sin evidencia de pago'};
var ESTADO={OK:['verde','OK'],REVIEW:['ambar','Preliminar'],PENDING:['rojo','No disponible'],PARAM_UNAVAILABLE:['rojo','Falta regla'],NOT_APPLICABLE:['gris','No aplica']};
var EVID={L1_DOCUMENTAL:'Documental',L2_RECONSTRUCTED:'Reconstruido del Diario',L3_ASSUMPTION:'Supuesto',FORECAST:'Proyección',NA:'—'};
var DIM={VERIFIED:'Verificada',VERIFIED_ZERO:'Verificada en cero',DECLARED_UNVERIFIED:'Declarada sin verificar',INFERIDA:'Inferida',SIN_EVIDENCIA:'Sin evidencia',
  NOT_APPLICABLE:'No aplica',ACTUAL:'Real',FORECAST:'Proyectada',SIM:'Simulación',CERTIFIED:'Certificada',RESEARCHED:'Investigada',DRAFT:'Borrador',
  DETERMINADO:'Determinado',ESTIMADO:'Estimado',NO_DETERMINADO:'No determinado',NO_APLICA:'No aplica'};
var ALERTA={
  PPM_COBERTURA_BAJA:['riesgo','Los PPM cubren menos de la mitad del impuesto','El saldo a pagar en abril será alto si no se ajusta. Evalúa PPM voluntario.'],
  RETIROS_EXCEDEN_RAI:['riesgo','Los retiros superan las utilidades tributables disponibles (RAI)','Revisa los retiros: el exceso no tiene crédito asignable en la v1.'],
  CREDITO_TOPE_SAC:['revisar','El crédito para los retiros llegó al tope del SAC','Parte de los retiros queda sin crédito por IDPC.'],
  ANORMAL_SUGERIDO:['revisar','Movimiento fuera del promedio sugerido como anormal','Hoy no entra al promedio de la proyección. El analista lo confirma o lo descarta en el Radar (modo técnico).'],
  ANORMAL:['info','Asiento marcado como anormal','Cuenta una vez en el real y no marca tendencia (M13).'],
  NO_RECURRENTE:['info','Asiento marcado como no recurrente','Cuenta una vez en el real y no entra al promedio (M13).'],
  MES_NO_ACREDITADO:['riesgo','Hay meses sin movimientos ni declaración','Sin todos los meses acreditados no hay proyección. Declara los meses sin movimiento.'],
  MES_DECLARADO_CON_MOVIMIENTO:['revisar','Un mes declarado "sin movimiento" tiene asientos','Revoca la declaración o revisa el Diario.'],
  APERTURA_TRIBUTARIA_AUSENTE:['riesgo','Falta la apertura tributaria','Sin los saldos del F22 del período anterior, los registros quedan no disponibles.'],
  APERTURA_TRIBUTARIA_NO_VERIFICADA:['revisar','La apertura tributaria está declarada, sin verificar','Los registros RAI/SAC/REX salen de saldos aún no verificados.'],
  LAYOUT_NO_CERTIFICADO:['revisar','Códigos del F22 provisionales','El formato F22 del AT aún no está certificado por el Master.'],
  REGLA_NO_ACTIVA:['riesgo','Falta una regla tributaria activa','Sin la regla, las cifras que dependen de ella quedan "falta regla".'],
  UF_CIERRE_ESTIMADA:['info','UF del 31-12 estimada','El tope del incentivo al ahorro se valoriza con la última UF disponible.'],
  BALANCE_HASTA_DERIVADO:['info','Cobertura del Balance derivada del Diario','El Balance no declara hasta qué fecha cubre.'],
  SIN_SUPUESTO_FORECAST:['riesgo','No hay supuesto de proyección activo','Sin supuesto solo se ve el real al corte. Créalo en Revisión técnica.'],
  MAPEO_INFERIDO:['revisar','Cuentas con clasificación inferida','Revisa el mapeo de esas cuentas.'],
  NETO_POR_RAZON:['revisar','Neto estimado por razón','Una cuenta con IVA se llevó a neto por la razón del año.'],
  M13_SIN_MATERIALIDAD:['info','Sin detección automática de anormales','Falta la regla de materialidad: solo cuentan las marcas del analista.'],
  M13_SIN_UF:['info','Sin detección automática de anormales','Falta la UF del período.'],
  RESULTADO_PRELIMINAR:['info','Resultado preliminar','El motor e1-1 nunca entrega un resultado final.'],
  MOTOR_LOGICA_NO_CERTIFICADA:['info','Reglas de cálculo por certificar','M1–M15 están diseñadas y revisadas, falta la certificación del Master.']
};
function alertaInfo(a){var d=ALERTA[a.codigo]||['info',a.codigo,''];return {nivel:d[0],titulo:d[1],texto:d[2],a:a};}
var CAMBIO={contrato:'contrato',caso:'datos del caso',corte:'corte',entrada_huella:'contrato de entrada',fuentes:'Diario o Balance',balance_hasta:'cobertura del Balance',
  snapshot:'mapeo de cuentas',movimientos:'movimientos del Diario',apertura_contable:'apertura contable',apertura_tributaria:'apertura tributaria',
  meses_declarados:'meses declarados',marcas:'marcas del analista',supuesto:'supuesto de proyección',layout:'formato F22',uf_cierre:'UF de cierre',uf_corte:'UF del corte',
  reglas:'reglas tributarias',precondiciones:'condiciones previas (revisa los datos)'};

/* ── Estado ── */
var URLP=new URLSearchParams(location.search);
var S={modo:URLP.get('modo')==='tecnico'?'ASESOR':'CLIENTE',sec:URLP.get('sec')||'resumen',casos:[],clientes:{},caso:null,yo:null,v:null,O:{},T:{},
  items:[],IT:{},reg:'RLI',esc:'base',verCod:false,cargando:true,error:null,meses:[],marcas:[],sups:[],asientos:{},filtroOut:'',detAncho:false,
  // Pantalla 1 (Cartera de Renta) es la vista por defecto; ?caso=ID abre directo la Pantalla 2 (proyección de un cliente)
  vista:URLP.get('caso')?'caso':'cartera',pend:null,
  cart:{filas:[],cargando:true,error:null,q:'',filtro:'todos',orden:'prioridad',mis:false,tok:0}};
var SECS=[['resumen','Resumen','¿Cuánto proyecto, cuánto tengo cubierto y cuánto falta?'],['proyeccion','Proyección','¿Cómo se proyecta el año desde lo real?'],
  ['escenarios','Escenarios','¿Qué pasa si tomo una decisión antes del 31-12?'],['registros','Determinación y registros','¿Cómo se determina la renta y qué saldos tributarios acumulo?'],
  ['radar','Radar','¿Qué debemos revisar?'],['f22','Formato F22','Mismos códigos e ítems del F22, para completar la declaración (solo asesor).',true],
  ['tecnica','Revisión técnica','Corrida, outputs, supuestos, meses y marcas del analista (solo asesor).',true]];
function tecnico(){return S.modo==='ASESOR';}
function puedeOperar(){return !!(S.yo&&(S.yo.es_master||S.yo.rol==='contable'));}
function o(k){return S.O[k]||null;}
function v(k){var x=S.O[k];return x&&x.estado_dato!=='PENDING'&&x.estado_dato!=='PARAM_UNAVAILABLE'?x.monto:null;}   // mismo criterio que la cartera: sin dato = No disponible
function nombreCaso(c){return (S.clientes[c.cliente_id]||'Cliente #'+c.cliente_id);}
function corte(){return S.v&&S.v.corrida?S.v.corrida.cutoff_date:null;}
function mesCorte(){var c=corte();return c?+c.slice(5,7):null;}
function layoutDraft(){var l=S.v&&S.v.corrida&&S.v.corrida.layout;return !l||l.estado!=='CERTIFIED';}

function chip(x,extra){
  if(!x)return '<span class="estado gris">Sin dato</span>';
  var e=ESTADO[x.estado_dato]||['gris',x.estado_dato];
  return '<span class="estado '+e[0]+'"'+(extra?' title="'+esc(extra)+'"':'')+'>'+e[1]+'</span>';
}
function monto(k){var x=o(k);return x?clp(x.monto):clp(null);}
function det(k,html,cls){return '<button type="button" class="mrp-num '+(cls||'')+'" data-det="'+esc(k)+'" title="Ver detalle para validar">'+html+'<span class="lupa">'+ic('lupa')+'</span></button>';}

/* ── Carga ── */
function toast(t){var el=$('mrToast');el.innerHTML=t;el.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(function(){el.classList.remove('on');},3800);}
function app(html){$('mrApp').innerHTML=html;pintarIconos($('mrApp'));}
function iniciar(){
  pintarIconos();
  if(DEMO){$('mrDemo').hidden=false;document.documentElement.classList.remove('auth-pending');}
  pintarModo();
  API.rpc('renta_yo',{}).then(function(r){
    S.yo=Array.isArray(r)?r[0]:r;
    if(!S.yo||!(S.yo.es_master||S.yo.rol==='contable')){app('<div class="aviso rojo fuerte">'+I('candado','ic-roj')+'MiRenta es solo para el Master y los analistas contables con cartera asignada.</div>');return;}
    if(S.vista==='cartera')return cargarCartera();
    return API.get('renta_casos?select=id,cliente_id,anio_comercial,anio_tributario,regimen,estado,version&regimen=eq.14D3&estado=neq.RECTIFIED&order=anio_comercial.desc,id.desc').then(function(cs){
      S.casos=cs||[];
      var ids=S.casos.map(function(c){return c.cliente_id;}).filter(function(x,i,a){return a.indexOf(x)===i;});
      return (ids.length?API.get('clientes?select=id,razon_social&id=in.('+ids.join(',')+')'):Promise.resolve([])).then(function(cl){
        (cl||[]).forEach(function(c){S.clientes[c.id]=c.razon_social;});
        if(!S.casos.length){S.cargando=false;app('<div class="aviso gris">'+I('info','ic-cel')+'No hay casos MiRenta en régimen 14 D N°3 en tu cartera. La proyección E1-1 es solo para Pro Pyme General (14 D N°3).</div>');return;}
        var pedido=+URLP.get('caso');S.caso=S.casos.filter(function(c){return c.id===pedido;})[0]||S.casos[0];
        return cargarCaso();
      });
    });
  }).catch(function(e){S.cargando=false;S.error=e;render();});
}
function cargarCaso(){
  S.cargando=true;S.error=null;S.v=null;S.O={};S.T={};render();
  var id=S.caso.id, tok=S.tokCaso=(S.tokCaso||0)+1, vivo=function(){return tok===S.tokCaso&&S.vista==='caso';};
  return API.rpc('renta_e1_proyeccion_vigente',{p_caso_id:id}).then(function(vg){
    if(!vivo()||!S.caso||S.caso.id!==id)throw {obsoleto:true};
    S.v=vg||{estado:'SIN_PROYECCION'};
    (S.v.outputs||[]).forEach(function(x){S.O[x.output_key]=x;});
    var cor=S.v.corrida, pr=[];
    if(cor){
      pr.push(API.get('renta_motor_outputs?select=output_key,trace&corrida_id=eq.'+cor.id).then(function(rows){if(!vivo())return;(rows||[]).forEach(function(r){S.T[r.output_key]=r.trace||{};});}));
      if(cor.layout&&cor.layout.id)pr.push(API.get('renta_f22_layout_items?select=codigo,glosa,recuadro,orden,signo,tipo,regla_calculo,rol_motor,formula&layout_id=eq.'+cor.layout.id+'&order=orden.asc')
        .then(function(it){if(!vivo())return;S.items=it||[];S.IT={};S.items.forEach(function(i){S.IT[i.codigo]=i;});}));
    }
    pr.push(API.get('renta_meses_declarados?select=id,mes,tipo,revoca_a,motivo,creado_at&caso_id=eq.'+id+'&order=id.asc').then(function(r){if(vivo())S.meses=r||[];}));
    pr.push(API.get('renta_e1_marcas?select=id,asiento_id,cuenta_codigo,tipo,accion,monto,componente,motivo,creado_at&caso_id=eq.'+id+'&order=id.asc').then(function(r){if(vivo())S.marcas=r||[];}));
    pr.push(API.get('renta_supuestos_forecast?select=id,version,forecast_method,parameters,motivo,estado,creado_at,activado_at&caso_id=eq.'+id+'&order=version.desc').then(function(r){if(vivo())S.sups=r||[];}));
    return Promise.all(pr).then(function(){
      if(!vivo())throw {obsoleto:true};
      var aids=[];
      ((cor&&cor.final_bloqueos)||[]).forEach(function(a){if(a.asiento_id)aids.push(a.asiento_id);});
      S.marcas.forEach(function(m){aids.push(m.asiento_id);});
      Object.keys(S.T).forEach(function(k){(S.T[k].excluidos||[]).forEach(function(x){aids.push(x);});});
      aids=aids.filter(function(x,i,a){return x&&a.indexOf(x)===i&&!S.asientos[x];});
      if(!aids.length)return;
      return API.get('renta_asientos?select=id,numero,glosa,fecha&id=in.('+aids.join(',')+')').then(function(r){(r||[]).forEach(function(a){S.asientos[a.id]=a;});});
    });
  }).then(function(){if(!vivo())return;S.cargando=false;animarBarras();render();trasCargarCaso();}).catch(function(e){if((e&&e.obsoleto)||!vivo())return;S.cargando=false;S.error=e;render();});
}
function urlEstado(){
  var p=new URLSearchParams(location.search);
  if(S.vista==='cartera'){p.delete('caso');p.delete('sec');p.delete('modo');}
  else{if(S.caso)p.set('caso',S.caso.id);p.set('sec',S.sec);if(tecnico())p.set('modo','tecnico');else p.delete('modo');}
  var qs=p.toString();
  try{history.replaceState(null,'',location.pathname+(qs?'?'+qs:''));}catch(e){}
}

/* ── Render general ── */
function pintarModo(){document.querySelectorAll('[data-modo]').forEach(function(b){var on=b.getAttribute('data-modo')===S.modo;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});
  document.body.classList.toggle('mrp-tecnico',tecnico());}
function render(){
  if(S.vista==='cartera'){renderCartera();return;}
  visTop();
  pintarModo();
  if(!tecnico()&&(S.sec==='f22'||S.sec==='tecnica'))S.sec='resumen';
  urlEstado();
  var h=cabecera();
  if(S.error){
    var t=textoError(S.error);
    h+=t==='MOTOR_NO_INSTALADO'?'<div class="card"><div class="h"><h2>Motor de proyección <span>no instalado</span></h2>'+'<span class="estado ambar">Pendiente de producción</span></div><p>El motor E1-1 ya está aprobado y fusionado en el backend, pero todavía no se instala en producción (requiere el GO de las etapas productivas). Cuando se instale, esta pantalla mostrará la proyección de cada caso sin más cambios.</p></div>'
      :'<div class="aviso rojo fuerte">'+I('alerta','ic-roj')+'<span>'+t+'</span> <button type="button" class="btn sec chico" data-act="recargar">Reintentar</button></div>';
    app(h);return;
  }
  if(S.cargando){app(h+'<div class="aviso lila"><span class="mrp-spin"></span>Cargando la proyección del motor…</div>');return;}
  if(!S.v||S.v.estado==='SIN_PROYECCION'){app(h+vacio());return;}
  h+=nav()+'<p class="mrp-preg">'+esc((SECS.filter(function(s){return s[0]===S.sec;})[0]||SECS[0])[2])+'</p>'+avisosEstado();
  var f={resumen:vResumen,proyeccion:vProyeccion,escenarios:vEscenarios,registros:vRegistros,radar:vRadar,f22:vF22,tecnica:vTecnica}[S.sec]||vResumen;
  app(h+'<div class="mrp-sec" data-sec-actual="'+S.sec+'">'+f()+'</div>');
}
function cabecera(){
  var opts=S.casos.map(function(c){return '<option value="'+c.id+'"'+(S.caso&&S.caso.id===c.id?' selected':'')+'>'+esc(nombreCaso(c)+' · AC '+c.anio_comercial+' · AT '+c.anio_tributario)+'</option>';}).join('');
  var h='<div class="mrp-cab"><button type="button" class="btn sec chico mrc-volver" data-act="volver-cartera">'+I('flecha-izq','ic-cel')+'Volver a la cartera</button><label class="mrp-sel"><span>Caso</span><select id="mrCaso" aria-label="Caso MiRenta">'+opts+'</select></label>';
  if(S.caso)h+='<span class="mrp-pill">'+I('capas','ic-mor')+'Pro Pyme General · 14 D N°3</span>';
  if(S.v&&S.v.corrida){
    var e={VIGENTE:['verde','Proyección vigente'],DESACTUALIZADA:['ambar','Proyección desactualizada'],CONGELADA:['gris','Proyección congelada']}[S.v.estado]||['gris',S.v.estado];
    h+='<span class="estado '+e[0]+'">● '+e[1]+'</span><span class="mrp-meta">datos al '+fFecha(corte())+' · calculada '+fHora(S.v.corrida.finalizado_at)+(S.v.corrida.resultado_estado==='MISSING_DATA'?' · <b class="t-ambar">faltan datos</b>':' · preliminar')+'</span>';
  }
  if(S.caso&&puedeOperar()&&S.v&&S.v.estado!=='CONGELADA'&&(S.caso.estado==='DRAFT'||S.caso.estado==='IN_PROGRESS')){
    h+='<span class="g-espacio"></span><button type="button" class="btn chico" data-act="proyectar">'+I('repetir')+(S.v&&S.v.corrida?'Recalcular':'Calcular')+' proyección</button>';
  }
  return h+'</div>';
}
function nav(){
  return '<nav class="mrp-nav" role="tablist">'+SECS.filter(function(s){return !s[3]||tecnico();}).map(function(s){
    return '<button type="button" role="tab" class="sn'+(S.sec===s[0]?' on':'')+(s[3]?' tec':'')+'" aria-selected="'+(S.sec===s[0])+'" data-sec="'+s[0]+'">'+esc(s[1])+'</button>';}).join('')+'</nav>';
}
function avisosEstado(){
  var h='';
  if(S.v.estado==='DESACTUALIZADA')h+='<div class="aviso ambar">'+I('alerta','ic-amb')+'<span><b>La proyección está desactualizada:</b> cambiaron '+((S.v.cambios||[]).map(function(c){return esc(CAMBIO[c]||c);}).join(', ')||'los datos')+' desde el último cálculo. Las cifras que ves son las de la corrida anterior.</span>'
    +(puedeOperar()?' <button type="button" class="btn chico" data-act="proyectar">Recalcular ahora</button>':'')+'</div>';
  if(S.v.estado==='CONGELADA')h+='<div class="aviso gris">'+I('candado','ic-cel')+'<span>'+esc(S.v.motivo||'El caso está en revisión o cerrado: la proyección queda congelada.')+'</span></div>';
  if(S.sec==='resumen'||S.sec==='f22')h+='<div class="aviso ambar"><b class="mrp-tag">PROYECCIÓN PRELIMINAR</b><span>El motor e1-1 nunca entrega un resultado final: las reglas de cálculo están revisadas pero falta su certificación'+(layoutDraft()?', y los códigos del F22 del AT '+(S.caso.anio_tributario)+' son provisionales':'')+'.</span><button type="button" class="link" data-sec="radar">Ver qué falta →</button></div>';
  return h;
}
function vacio(){
  return '<div class="card mrp-vacio"><div class="h"><h2>Sin <span>proyección</span> todavía</h2></div><p>Este caso aún no tiene una proyección calculada por el motor. Para calcularla se necesita: Libro Diario y Balance vigentes y conciliados, mapeo de cuentas vigente, apertura contable aceptada (A2/A3), formato F22 vigente y un supuesto de proyección activo.</p>'
    +(puedeOperar()?'<div class="mrp-acciones"><button type="button" class="btn" data-act="proyectar">'+I('repetir')+'Calcular proyección</button><button type="button" class="btn sec" data-act="nuevo-supuesto">Crear supuesto de proyección</button></div>':'<p class="t2">Pide al analista contable del cliente que calcule la proyección.</p>')+'</div>';
}

/* ── Vista: Resumen ── */
function vResumen(){
  var idF=v('forecast.idpc'), ppmF=v('forecast.ppm.imputable'), sal=v('forecast.saldo_abril'), base=v('forecast.f22.1440');
  var cob=(idF&&ppmF!=null)?ppmF/idF:null, m=mesCorte();
  var dev=sal!=null&&sal<0, niv=nivelCob(cob);
  var h='<div class="mrp-acc-ej"><button type="button" class="btn sec" data-act="ejecutivo">'+I('imprimir','ic-cel')+'Resumen ejecutivo para el cliente</button>'
    +'<button type="button" class="btn sec" data-act="pdf">'+I('descargar','ic-ver')+'Descargar PDF</button>'
    +'<button type="button" class="btn sec" data-act="enviar">'+I('enviar','ic-mor')+'Enviar al cliente</button><span class="t2">Solo si tú lo decides: nada se envía solo.</span></div>';
  h+='<h2 class="mrp-titulo">Tu posición <span>tributaria</span></h2><p class="mrp-lead">Con la contabilidad hasta '+esc(MESES[(m||1)-1])+', proyectamos un impuesto de primera categoría de <b>'+clpT(idF)+'</b> para el año. Los PPM del año cubrirían cerca de un <b>'+pctTxt(cob)+'</b>, por lo que en abril '+(dev?'habría una <b>devolución estimada</b> de cerca de <b>'+clpT(Math.abs(sal))+'</b>':'quedarían cerca de <b>'+clpT(sal)+'</b> por pagar')+' si la situación se mantiene.</p>';
  h+='<div class="mrp-kpis"><div class="kpi hero'+(dev?' dev':'')+'">'+'<small>'+(dev?'Devolución estimada en abril':'Saldo estimado a pagar en abril')+'</small>'+det('forecast.saldo_abril','<b>'+(dev?clp(Math.abs(sal)):clp(sal))+'</b>','grande')+'<p>Impuesto proyectado menos PPM del año (proyectados a diciembre).</p></div>'
    +'<div class="kpi acc-RLI"><small>Impuesto proyectado (IDPC)</small>'+det('forecast.idpc','<b>'+clp(idF)+'</b>')+'<p>'+tasaTxt()+'</p></div>'
    +'<div class="kpi acc-PPM"><small>PPM del año</small>'+det('forecast.ppm.imputable','<b>'+clp(ppmF)+'</b>')+'<p>Pagado al corte '+clpT(v('actual.ppm.imputable'))+'</p></div>'
    +'<div class="kpi acc-'+(niv==='rojo'?'PER':niv==='ambar'?'RAI':'REX')+'"><small>Cobertura</small><b class="t-'+(niv==='gris'?'gris':niv)+'">'+pctTxt(cob)+'</b><p>'+esc(SEMAFORO[prioCob(cob)==='gris'?'nd':prioCob(cob)][1])+' · del impuesto cubierto con PPM</p></div></div>';
  h+='<div class="mrp-g2"><div class="card"><div class="h"><h2>¿Cuánto de tu impuesto <span>está cubierto?</span></h2><span class="estado preliminar">Preliminar</span></div>'
    +'<div class="cl"><span>Impuesto proyectado</span><b>'+clp(idF)+'</b></div><div class="cl"><span>PPM del año</span><b>'+clp(ppmF)+'</b></div>'
    +barraCob(cob,sal,true)
    +'<p class="t2">'+(dev?'Los PPM superan el impuesto proyectado: el excedente se devolvería en abril.':sal!=null&&sal>0?'Faltaría cubrir cerca de <b>'+clpT(sal)+'</b>. '+(v('sim.ppm_voluntario.cuota_mensual')?'Con un PPM voluntario de <b>'+clpT(v('sim.ppm_voluntario.cuota_mensual'))+'</b> al mes hasta diciembre se llegaría a abril sin saldo.':''):'')+'</p></div>'
    +'<div class="card"><div class="h"><h2>Hoy vs <span>diciembre</span></h2><small class="t2">lo real al corte y hacia dónde vamos</small></div><div class="tabla-box"><table class="cmp"><thead><tr><th></th><th class="num">Hoy ('+esc(MES3[(m||1)-1])+')</th><th class="num">Diciembre (proyectado)</th></tr></thead><tbody>'
    +filaHD('Base imponible','actual.f22.1440','forecast.f22.1440')+filaHD('Impuesto (IDPC)','actual.idpc','forecast.idpc')+filaHD('PPM','actual.ppm.imputable','forecast.ppm.imputable')+filaHD('Saldo de abril','actual.saldo_abril','forecast.saldo_abril',true)
    +'</tbody></table></div></div></div>';
  var al=radarItems().filter(function(x){return x.nivel!=='info';}).slice(0,3);
  h+='<div class="card"><div class="h"><h2>Lo que necesita <span>tu atención</span></h2><button type="button" class="link" data-sec="radar">Ver Radar completo →</button></div>'
    +(al.length?'<div class="mrp-radar-g">'+al.map(radarCard).join('')+'</div>':'<p class="t2">No hay alertas de riesgo ni de revisión en esta corrida.</p>')+'</div>';
  h+=calidadCard();
  return h;
}
function tasaTxt(){var t=S.T['forecast.idpc'];return t&&t.tasa!=null?'Tasa '+String(t.tasa).replace('.',',')+' % según regla activa':'Tasa según regla activa';}
function clpSaldoT(n){return n!=null&&n<0?'Devolución '+clpT(-n):clpT(n);}
function mmSaldo(n){return n!=null&&n<0?'<span class="t-verde">Devolución '+mm(-n)+'</span>':mm(n);}   // un saldo negativo es devolución, nunca un pago negativo
function filaHD(t,a,f,fuerte){var fm=fuerte?mmSaldo:mm;return '<tr'+(fuerte?' class="tot"':'')+'><td>'+t+'</td><td class="num">'+det(a,fm(v(a)))+'</td><td class="num lila">'+det(f,fm(v(f)))+'</td></tr>';}
function calidadCard(){
  var c=S.v.corrida, b=c.final_bloqueos||[], tiene=function(k){return b.some(function(x){return x.codigo===k;});};
  var it=[['Contabilidad','Diario y Balance conciliados',true],['Apertura tributaria',tiene('APERTURA_TRIBUTARIA_AUSENTE')?'Falta':tiene('APERTURA_TRIBUTARIA_NO_VERIFICADA')?'Declarada, sin verificar':'Verificada',!tiene('APERTURA_TRIBUTARIA_AUSENTE')&&!tiene('APERTURA_TRIBUTARIA_NO_VERIFICADA')],
    ['Meses del año',tiene('MES_NO_ACREDITADO')?'Hay meses sin acreditar':'Todos acreditados',!tiene('MES_NO_ACREDITADO')],['Supuesto de proyección',tiene('SIN_SUPUESTO_FORECAST')?'Falta':'Activo',!tiene('SIN_SUPUESTO_FORECAST')],
    ['Reglas tributarias',tiene('REGLA_NO_ACTIVA')?'Faltan reglas activas':'Activas, por certificar',false],['Formato F22',layoutDraft()?'Códigos provisionales':'Certificado',!layoutDraft()]];
  var m=mesCorte()||0;
  return '<div class="card"><div class="h"><h2>¿Qué tan completa es <span>esta proyección?</span></h2></div><div class="mrp-cal">'+it.map(function(x){return '<div class="'+(x[2]?'ok':'warn')+'"><i>'+(x[2]?'✓':'!')+'</i><b>'+x[0]+'</b><span>'+esc(x[1])+'</span></div>';}).join('')+'</div>'
    +'<div class="mrp-linea"><span class="real" style="flex:'+m+'">'+esc(MES3[0].toUpperCase())+'–'+esc((MES3[m-1]||'').toUpperCase())+' real</span>'+(m<12?'<span class="proy" style="flex:'+(12-m)+'">'+esc((MES3[m]||'').toUpperCase())+'–DIC proyectado</span>':'')+'</div></div>';
}

/* ── Vista: Proyección ── */
function partidas(){return S.items.filter(function(i){return i.tipo==='PARTIDA';});}
function vProyeccion(){
  var m=mesCorte()||0, h='';
  var t1400=S.T['forecast.f22.1400']||{};
  h+='<div class="card"><div class="h"><h2>Cómo proyectamos <span>el año</span></h2><span class="estado lila">Lineal sobre meses normales</span></div>'
    +'<p>Proyectado a diciembre = <b>real de enero a '+esc(MESES[m-1]||'—')+'</b> + <b>'+(12-m)+' meses</b> × el promedio de los <b>meses normales</b> (sin asientos anormales ni no recurrentes, y sin lo que viene de la apertura: regla M1). Lo que se escapa del promedio cuenta una sola vez y no marca tendencia (M13).</p>'
    +'<div class="mrp-tri"><div><small>Meses reales</small><b>'+m+'</b></div><div><small>Meses proyectados</small><b>'+(12-m)+'</b></div><div><small>Método</small><b>'+esc(t1400.metodo||'LINEAL_PROMEDIO_V1')+'</b></div></div></div>';
  h+='<div class="card"><div class="h"><h2>Partida por partida, <span>real y proyectado</span></h2><small class="t2">clic en una cifra para ver el detalle</small></div><div class="tabla-box"><table class="cmp mrp-proy"><thead><tr><th>Partida</th>'+(tecnico()?'<th class="cod">Código</th>':'')+'<th class="num">Real al corte</th><th class="num">Promedio mensual normal</th><th class="num">Proyectado diciembre</th><th>Excluidos del promedio</th></tr></thead><tbody>';
  var grupo=null;
  S.items.filter(function(i){return i.tipo!=='REGISTRO';}).forEach(function(i){
    var g=grupoDe(i);if(g!==grupo){grupo=g;h+='<tr class="grupo"><td colspan="'+(tecnico()?6:5)+'">'+esc(g)+'</td></tr>';}
    var fa=o('actual.f22.'+i.codigo), ff=o('forecast.f22.'+i.codigo), t=S.T['forecast.f22.'+i.codigo]||{};
    if(fa&&fa.estado_dato==='NOT_APPLICABLE'&&!tecnico())return;
    var prom=(i.tipo==='PARTIDA'&&t.base_normal!=null&&t.meses_base)?t.base_normal/t.meses_base:null;
    var ex=(t.excluidos||[]).map(function(a){var s=S.asientos[a];return '<span class="mrp-asi" title="'+esc(s?s.glosa:'')+'">N° '+esc(s?s.numero:a)+'</span>';}).join(' ');
    h+='<tr class="'+(i.tipo!=='PARTIDA'?'tot':'')+'"><td>'+esc(i.glosa)+'</td>'+(tecnico()?'<td class="cod">'+esc(i.codigo)+'</td>':'')+'<td class="num">'+(fa&&fa.estado_dato==='NOT_APPLICABLE'?'<span class="nd">No aplica</span>':det('f22:'+i.codigo,clp(fa&&fa.monto)))+'</td><td class="num t2">'+(prom!=null?clp(prom):'—')+'</td><td class="num lila">'+(ff&&ff.estado_dato==='NOT_APPLICABLE'?'<span class="nd">No aplica</span>':det('f22:'+i.codigo,clp(ff&&ff.monto)))+'</td><td>'+(ex||'<span class="t3">—</span>')+'</td></tr>';
  });
  h+='</tbody></table></div><p class="nota">"No disponible" nunca se asume en cero. Las partidas "No aplica" están fuera del alcance de la versión 1 del motor.</p></div>';
  var ppmA=v('actual.ppm.imputable'), ppmF=v('forecast.ppm.imputable'), np=v('actual.ppm.declarado_no_pagado');
  h+='<div class="mrp-g2"><div class="card acc-PPM"><div class="h"><h2>PPM y <span>planificación de caja</span></h2></div>'
    +'<div class="cl"><span>PPM imputable al corte (por período tributario)</span><b>'+det('actual.ppm.imputable',clp(ppmA))+'</b></div>'
    +'<div class="cl"><span>De ellos, declarados y aún no pagados</span><b>'+det('actual.ppm.declarado_no_pagado',clp(np))+'</b></div>'
    +'<div class="cl"><span>PPM proyectado del año (× 12 / '+(m||'—')+')</span><b>'+det('forecast.ppm.imputable',clp(ppmF))+'</b></div>'
    +'<div class="cl fin"><span>Saldo de abril proyectado</span><b>'+det('forecast.saldo_abril',clpSaldoT(v('forecast.saldo_abril')))+'</b></div>'
    +'<p class="t2">Para llegar a abril sin saldo: PPM voluntario de <b>'+clpT(v('sim.ppm_voluntario.cuota_mensual'))+'</b> al mes durante los '+(12-m)+' meses que quedan.</p></div>'
    +'<div class="card acc-RAI"><div class="h"><h2>Retiros <span>del año</span></h2></div><div class="cl"><span>Retiros pagados al corte</span><b>'+det('actual.retiros',clp(v('actual.retiros')))+'</b></div>'
    +'<div class="cl"><span>Retiros del año (base, sin nuevos retiros)</span><b>'+det('forecast.retiros',clp(v('forecast.retiros')))+'</b></div>'
    +'<p class="t2">Los retiros adicionales antes del 31-12 se evalúan en Escenarios (no cambian la proyección base).</p></div></div>';
  return h;
}
function grupoDe(i){
  if(i.tipo==='REGISTRO')return 'Registros';
  var f=S.IT['1410']&&S.IT['1410'].formula||[], e=S.IT['1430']&&S.IT['1430'].formula||[];
  if(i.codigo==='1410'||f.some(function(x){return x.codigo===i.codigo;}))return 'Ingresos';
  if(i.codigo==='1430'||e.some(function(x){return x.codigo===i.codigo;}))return 'Egresos';
  if(i.tipo==='AJUSTE')return 'Agregados';
  if(i.rol_motor==='RLI')return 'Renta líquida imponible';
  return 'Rebajas y base imponible';
}

/* ── Vista: Escenarios ── */
function sims(){var n=[];Object.keys(S.O).forEach(function(k){var mt=k.match(/^sim\.retiro_adicional\.s(\d+)\.retiros$/);if(mt)n.push(+mt[1]);});return n.sort(function(a,b){return a-b;});}
function vEscenarios(){
  var salB=v('forecast.saldo_abril'), m=mesCorte()||0;
  var cards=[['base','Proyección vigente','Base','Proyección actual, sin decisiones nuevas.',salB,'candado'],
    ['e14','Simulación','Incentivo al ahorro · Art. 14 E','Dejar invertidas las utilidades del año (sin más retiros).',v('sim.e14.saldo_abril'),'hucha'],
    ['ppm','Simulación','PPM voluntario','Pagar '+clpT(v('sim.ppm_voluntario.cuota_mensual'))+' al mes hasta diciembre.',v('sim.ppm_voluntario.cuota_mensual')!=null?0:null,'moneda']];
  sims().forEach(function(n){var t=S.T['sim.retiro_adicional.s'+n+'.retiros']||{};
    cards.push(['s'+n,'Simulación','Retiro adicional '+n,'Retirar '+clpT(t.monto_adicional)+' en '+(MESES[(t.mes||1)-1]||'—')+'.',v('sim.retiro_adicional.s'+n+'.idpc_14e'),'tendencia',true]);});
  if(!cards.some(function(c){return c[0]===S.esc;}))S.esc='base';
  var h='<div class="mrp-esc-g">'+cards.map(function(c){
    return '<button type="button" class="esc-card'+(S.esc===c[0]?' on':'')+(c[0]==='base'?' base':'')+'" data-esc="'+c[0]+'"><small>'+I(c[5],c[0]==='base'?'ic-cel':'ic-mor')+esc(c[1])+(S.esc===c[0]&&c[0]!=='base'?' · comparando':'')+'</small><b>'+esc(c[2])+'</b><span>'+esc(c[3])+'</span><em><i>'+(c[6]?'IDPC con 14 E':'Saldo abril')+'</i>'+clp(c[4])+'</em></button>';}).join('')
    +(puedeOperar()?'<button type="button" class="esc-card nuevo" data-act="nuevo-supuesto"><small>'+I('plus','ic-ver')+'Nueva simulación</small><b>Retiro adicional</b><span>¿Qué pasa si los socios retiran más antes del 31-12? (hasta 5 retiros, crea un supuesto nuevo)</span></button>':'')+'</div>';
  h+='<div class="card"><div class="h"><h2>Comparación <span>de escenarios</span></h2><small class="t2">mismas cifras del motor; la Base no cambia</small></div><div class="tabla-box"><table class="cmp"><thead><tr><th>Escenario</th><th class="num">Impuesto (IDPC)</th><th class="num">PPM del año</th><th class="num">Saldo de abril</th><th class="num">Diferencia vs Base</th></tr></thead><tbody>'
    +filaEsc('Base','forecast.idpc','forecast.saldo_abril',salB)
    +filaEsc('Incentivo al ahorro (14 E)','sim.e14.idpc','sim.e14.saldo_abril',salB)
    +'<tr><td>PPM voluntario</td><td class="num">'+monto('forecast.idpc')+'</td><td class="num">'+(v('forecast.ppm.imputable')!=null&&v('sim.ppm_voluntario.cuota_mensual')!=null?clp(v('forecast.ppm.imputable')+v('sim.ppm_voluntario.cuota_mensual')*(12-m)):clp(null))+'</td><td class="num">'+(v('sim.ppm_voluntario.cuota_mensual')!=null?'$0':clp(null))+'</td><td class="num t2">anticipa '+clpT(salB)+'</td></tr>'
    +'</tbody></table></div><p class="nota">El PPM voluntario no baja el impuesto: lo anticipa. El incentivo al ahorro sí baja la base imponible, a cambio de no retirar.</p></div>';
  h+='<div class="card esc-det">'+({base:escBase,e14:escE14,ppm:escPpm}[S.esc]||escRetiro)()+'</div>';
  return h;
}
function filaEsc(t,ki,ks,salB){var s=v(ks);return '<tr><td>'+t+'</td><td class="num">'+det(ki,clp(v(ki)))+'</td><td class="num">'+monto('forecast.ppm.imputable')+'</td><td class="num">'+det(ks,s!=null&&s<0?'<span class="t-verde">'+clpSaldoT(s)+'</span>':clp(s))+'</td><td class="num '+(s!=null&&salB!=null&&s<salB?'t-verde':'t2')+'">'+(s!=null&&salB!=null?(s-salB===0?'—':clp(s-salB)):clp(null))+'</td></tr>';}
function escBase(){
  return '<div class="h"><h2>Base · <span>proyección vigente</span></h2><span class="estado gris">'+I('candado')+'No se modifica</span></div><p>Es la proyección del motor con los datos y el supuesto vigentes. Las simulaciones se comparan contra ella.</p>'
    +'<div class="mrp-tri"><div><small>Base imponible proyectada</small>'+det('forecast.f22.1440','<b>'+clp(v('forecast.f22.1440'))+'</b>')+'</div><div><small>IDPC proyectado</small>'+det('forecast.idpc','<b>'+clp(v('forecast.idpc'))+'</b>')+'</div><div><small>Saldo de abril</small>'+det('forecast.saldo_abril','<b>'+clp(v('forecast.saldo_abril'))+'</b>')+'</div></div>';
}
function escE14(){
  var td=S.T['sim.e14.deduccion']||{}, uf=td.uf||{}, tope=(td.tope_uf!=null&&uf.valor!=null)?td.tope_uf*uf.valor:null, ahorro=(v('forecast.idpc')!=null&&v('sim.e14.idpc')!=null)?v('forecast.idpc')-v('sim.e14.idpc'):null;
  return '<div class="h"><h2>Incentivo al ahorro · <span>Art. 14 letra E</span></h2><span class="estado lila">Simulación</span></div>'
    +'<p>Mantener las utilidades invertidas en la empresa permite deducir hasta un '+(td.porcentaje!=null?String(td.porcentaje).replace('.',','):'—')+' % de la renta que queda invertida, con tope de '+(td.tope_uf!=null?miles(td.tope_uf):'—')+' UF valorizadas a la UF del cierre'+(uf.exacta===false?' (estimada con la UF de '+esc(uf.periodo||'')+')':'')+'. Exige no retirar más de lo ya retirado en el año.</p>'
    +'<div class="tabla-box"><table class="cmp esc-t"><tbody>'
    +'<tr><td>Renta líquida imponible proyectada</td><td class="num">'+det('forecast.f22.1729',clp(v('forecast.f22.1729')))+'</td></tr>'
    +'<tr><td>− Gastos rechazados (1422)</td><td class="num">'+det('forecast.f22.1422',clp(v('forecast.f22.1422')))+'</td></tr>'
    +'<tr><td>− Retiros del año</td><td class="num">'+det('forecast.retiros',clp(v('forecast.retiros')))+'</td></tr>'
    +'<tr class="tot"><td>= Renta que queda invertida</td><td class="num">'+det('sim.e14.rli_invertida',clp(v('sim.e14.rli_invertida')))+'</td></tr>'
    +'<tr><td>Tope ('+(td.tope_uf!=null?miles(td.tope_uf):'—')+' UF × '+(uf.valor!=null?'$'+Number(uf.valor).toLocaleString('es-CL'):'—')+')</td><td class="num t2">'+clp(tope)+'</td></tr>'
    +'<tr class="tot"><td>Deducción 14 E (rebaja 1432)</td><td class="num lila">'+det('sim.e14.deduccion',clp(v('sim.e14.deduccion')))+'</td></tr>'
    +'<tr><td>Base imponible con incentivo</td><td class="num">'+clp(v('forecast.f22.1440')!=null&&v('sim.e14.deduccion')!=null?Math.max(v('forecast.f22.1440')-v('sim.e14.deduccion'),0):null)+'</td></tr>'
    +'<tr><td>IDPC con incentivo</td><td class="num">'+det('sim.e14.idpc',clp(v('sim.e14.idpc')))+'</td></tr>'
    +'<tr><td>− PPM del año</td><td class="num">'+det('forecast.ppm.imputable',clp(v('forecast.ppm.imputable')))+'</td></tr>'
    +'<tr class="tot"><td>Saldo de abril con incentivo</td><td class="num lila">'+det('sim.e14.saldo_abril',clp(v('sim.e14.saldo_abril')))+'</td></tr>'
    +'</tbody></table></div><div class="aviso verde">'+I('hucha','ic-ver')+'<span>Menor impuesto estimado frente a la Base: <b>'+clpT(ahorro)+'</b>. Requisitos y efectos en los socios por certificar.</span></div>';
}
function escPpm(){
  var m=mesCorte()||0, t=S.T['sim.ppm_voluntario.cuota_mensual']||{};
  return '<div class="h"><h2>PPM voluntario · <span>llegar a abril sin saldo</span></h2><span class="estado lila">Simulación</span></div><p>Repartir el saldo de abril proyectado en los meses que quedan del año. No cambia el impuesto: lo anticipa y ordena la caja.</p>'
    +'<div class="mrp-tri"><div><small>Saldo de abril proyectado</small>'+det('forecast.saldo_abril','<b>'+clp(t.saldo_abril!=null?t.saldo_abril:v('forecast.saldo_abril'))+'</b>')+'</div><div><small>Meses restantes</small><b>'+(t.meses_restantes!=null?t.meses_restantes:12-m)+'</b></div><div><small>PPM voluntario mensual</small>'+det('sim.ppm_voluntario.cuota_mensual','<b class="lila">'+clp(v('sim.ppm_voluntario.cuota_mensual'))+'</b>')+'</div></div>';
}
function escRetiro(){
  var n=S.esc.slice(1), p='sim.retiro_adicional.s'+n+'.', t=S.T[p+'retiros']||{};
  function fila(t1,kb,ks){return '<tr><td>'+t1+'</td><td class="num">'+(kb?det(kb,clp(v(kb))):'—')+'</td><td class="num lila">'+det(ks,clp(v(ks)))+'</td></tr>';}
  return '<div class="h"><h2>Retiro adicional '+esc(n)+' · <span>'+clpT(t.monto_adicional)+' en '+esc(MESES[(t.mes||1)-1]||'—')+'</span></h2><span class="estado lila">Simulación</span></div>'
    +'<p>Qué pasa con los registros y el incentivo al ahorro si los socios retiran más antes del 31-12. La proyección base no cambia.</p>'
    +'<div class="tabla-box"><table class="cmp"><thead><tr><th></th><th class="num">Base</th><th class="num">Con el retiro</th></tr></thead><tbody>'
    +fila('Retiros del año','forecast.retiros',p+'retiros')+fila('RAI final','forecast.registro.rai_final',p+'rai_final')
    +fila('Crédito por IDPC asignado a los retiros','forecast.registro.credito_asignado',p+'credito_asignado')+fila('SAC 1564 final','forecast.registro.sac_1564_final',p+'sac_1564_final')
    +fila('Deducción 14 E posible','sim.e14.deduccion',p+'deduccion_14e')+fila('IDPC si se usa el 14 E','sim.e14.idpc',p+'idpc_14e')
    +'</tbody></table></div><p class="nota">Global complementario de cada socio: etapa posterior (simulador de socios).</p>';
}

/* ── Vista: Determinación y registros ── */
var REGS=[['RLI','Renta líquida imponible','forecast.f22.1729'],['RAI','Rentas afectas a impuestos','forecast.registro.rai_final'],['SAC','Saldo acumulado de créditos','forecast.registro.sac_1564_final'],
  ['REX','Rentas exentas e ingresos no renta','forecast.registro.rex_final'],['CPTS','Capital propio tributario simplificado','forecast.registro.cpts_final']];
function vRegistros(){
  var h='<div class="regbar" role="tablist">'+REGS.map(function(r,i){return (i===1?'<span class="regbar-sep"></span>':'')+'<button type="button" class="rb acc-'+r[0]+(S.reg===r[0]?' on':'')+'" data-reg="'+r[0]+'"><b>'+r[0]+'</b><small>'+esc(r[1])+'</small><em>'+clp(v(r[2]))+'</em></button>';}).join('')+'</div>';
  h+='<div class="reg-zona acc-'+S.reg+'">'+({RLI:regRLI,RAI:regRAI,SAC:regSAC,REX:regREX,CPTS:regCPTS}[S.reg])()+'</div>';
  return h;
}
function regHead(sig,tit,sub){return '<div class="reg-head"><span class="reg-chip">'+sig+'</span><div class="reg-tit"><b>'+tit+'</b><small>'+sub+'</small></div><span class="estado ambar">Preliminar</span><button type="button" class="btn sec chico imprimir" data-act="imprimir-sec">'+I('imprimir')+'Imprimir</button></div>';}
function regRLI(){
  var cod=tecnico()||S.verCod, h=regHead('RLI','Determinación de la renta','Recuadro base imponible 14 D N°3 · AT '+S.caso.anio_tributario);
  h+='<div class="card mrp-imprimible"><div class="h"><h2>Determinación de la <span>base imponible</span></h2>'+(!tecnico()?'<button type="button" class="btn sec chico" data-act="ver-cod">'+(S.verCod?'Ocultar':'Mostrar')+' código F22</button>':'')+'</div>'
    +(layoutDraft()?'<span class="layout-tag">CÓDIGOS PROVISIONALES · formato F22 '+esc(S.caso.regimen)+' · AT '+S.caso.anio_tributario+' en borrador</span>':'')
    +'<div class="tabla-box"><table class="cmp rli"><thead><tr><th>Partida</th>'+(cod?'<th class="cod">Código F22</th>':'')+'<th class="num">Real al corte</th><th class="num">Proyectado</th><th>Estado</th></tr></thead><tbody>';
  var grupo=null;
  S.items.filter(function(i){return i.tipo!=='REGISTRO';}).forEach(function(i){
    var g=grupoDe(i);if(g!==grupo){grupo=g;h+='<tr class="grupo"><td colspan="'+(cod?5:4)+'">'+esc(g)+'</td></tr>';}
    var fa=o('actual.f22.'+i.codigo), ff=o('forecast.f22.'+i.codigo), na=ff&&ff.estado_dato==='NOT_APPLICABLE';
    if(na&&!cod)return;
    var signo=i.tipo==='PARTIDA'&&i.signo<0?'− ':'';
    h+='<tr tabindex="0" class="clic '+(i.tipo!=='PARTIDA'?'tot':'')+(i.rol_motor==='BASE_IMPONIBLE'?' total-rli':'')+'" data-det="f22:'+esc(i.codigo)+'"><td>'+signo+esc(i.glosa)+' <span class="lupa">'+ic('lupa')+'</span></td>'+(cod?'<td class="cod">'+esc(i.codigo)+'</td>':'')
      +'<td class="num">'+(na?'<span class="nd">No aplica</span>':clp(fa&&fa.monto))+'</td><td class="num lila">'+(na?'<span class="nd">No aplica</span>':clp(ff&&ff.monto))+'</td><td>'+chip(ff)+'</td></tr>';
  });
  return h+'</tbody></table></div><p class="nota">Clic en una fila para ver de dónde sale la cifra: cuentas del Diario, caja mes a mes, ajustes y proyección. "No disponible" no se asume en cero.</p></div>';
}
function regRAI(){
  var t=S.T['forecast.registro.rai_final']||{};
  return regHead('RAI','Rentas afectas a impuestos','Utilidades tributables acumuladas que pagarán impuesto al retirarse')
    +'<div class="card mrp-imprimible"><div class="h"><h2>Movimiento del <span>RAI</span></h2></div><div class="tabla-box"><table class="cmp esc-t"><tbody>'
    +'<tr><td>Saldo inicial (F22 del período anterior)</td><td class="num">'+det('actual.registro.rai_inicial',clp(v('actual.registro.rai_inicial')))+'</td></tr>'
    +'<tr><td>+ Base imponible proyectada</td><td class="num">'+det('forecast.f22.1440',clp(t.base!=null?t.base:v('forecast.f22.1440')))+'</td></tr>'
    +'<tr><td>− IDPC proyectado</td><td class="num">'+det('forecast.idpc',clp(t.idpc!=null?t.idpc:v('forecast.idpc')))+'</td></tr>'
    +'<tr><td>− Retiros imputados</td><td class="num">'+det('forecast.retiros',clp(t.retiros_imputados!=null?t.retiros_imputados:v('forecast.retiros')))+'</td></tr>'
    +'<tr class="tot"><td>= RAI final proyectado</td><td class="num lila">'+det('forecast.registro.rai_final',clp(v('forecast.registro.rai_final')))+'</td></tr>'
    +'</tbody></table></div><p class="nota">'+esc(t.simplificacion||'v1: retiros imputados solo al RAI.')+'</p></div>';
}
function regSAC(){
  var t=S.T['forecast.registro.credito_asignado']||{}, f=t.factor||{};
  var otros=[['sac_1563','No sujeto a restitución, sin derecho a devolución (1563)'],['sac_1565','Sujeto a restitución, sin derecho a devolución (1565)'],['sac_1566','Sujeto a restitución, con derecho a devolución (1566)'],['sac_1567','Crédito por IPE (1567)']];
  return regHead('SAC','Saldo acumulado de créditos','Crédito por IDPC que acompaña a los retiros de los socios')
    +'<div class="card mrp-imprimible"><div class="h"><h2>SAC no sujeto a restitución, <span>con derecho a devolución (1564)</span></h2></div><div class="tabla-box"><table class="cmp esc-t"><tbody>'
    +'<tr><td>Saldo inicial</td><td class="num">'+det('actual.registro.sac_1564_inicial',clp(v('actual.registro.sac_1564_inicial')))+'</td></tr>'
    +'<tr><td>+ Crédito generado por el IDPC proyectado</td><td class="num">'+det('forecast.idpc',clp(v('forecast.idpc')))+'</td></tr>'
    +'<tr><td>− Crédito asignado a los retiros (factor '+(f.numerador!=null?String(f.numerador).replace('.',',')+'/'+String(f.denominador).replace('.',','):'—')+')</td><td class="num">'+det('forecast.registro.credito_asignado',clp(v('forecast.registro.credito_asignado')))+'</td></tr>'
    +'<tr class="tot"><td>= SAC 1564 final proyectado</td><td class="num lila">'+det('forecast.registro.sac_1564_final',clp(v('forecast.registro.sac_1564_final')))+'</td></tr>'
    +'</tbody></table></div></div><div class="card"><div class="h"><h2>Otros <span>saldos SAC</span></h2></div><div class="tabla-box"><table class="cmp"><thead><tr><th>Saldo</th><th class="num">Inicial</th><th class="num">Final proyectado</th></tr></thead><tbody>'
    +otros.map(function(x){return '<tr><td>'+x[1]+'</td><td class="num">'+det('actual.registro.'+x[0]+'_inicial',clp(v('actual.registro.'+x[0]+'_inicial')))+'</td><td class="num">'+det('forecast.registro.'+x[0]+'_final',clp(v('forecast.registro.'+x[0]+'_final')))+'</td></tr>';}).join('')
    +'</tbody></table></div><p class="nota">v1: sin movimientos en estos saldos (igual al inicial).</p></div>';
}
function regREX(){
  return regHead('REX','Rentas exentas e ingresos no renta','Se retiran sin impuesto adicional')
    +'<div class="card mrp-imprimible"><div class="tabla-box"><table class="cmp esc-t"><tbody><tr><td>Saldo inicial</td><td class="num">'+det('actual.registro.rex_inicial',clp(v('actual.registro.rex_inicial')))+'</td></tr>'
    +'<tr class="tot"><td>Saldo final proyectado</td><td class="num lila">'+det('forecast.registro.rex_final',clp(v('forecast.registro.rex_final')))+'</td></tr></tbody></table></div><p class="nota">v1: si hay ingresos exentos con movimiento, el REX queda "No disponible" (fuera del alcance).</p></div>';
}
function regCPTS(){
  return regHead('CPTS','Capital propio tributario simplificado','Patrimonio tributario de la empresa')
    +'<div class="card mrp-imprimible"><div class="tabla-box"><table class="cmp esc-t"><tbody><tr><td>Saldo inicial</td><td class="num">'+det('actual.registro.cpts_inicial',clp(v('actual.registro.cpts_inicial')))+'</td></tr>'
    +'<tr class="tot"><td>Saldo final proyectado</td><td class="num">'+det('forecast.registro.cpts_final',clp(v('forecast.registro.cpts_final')))+'</td></tr></tbody></table></div><p class="nota">El CPTS final está fuera del alcance de la versión 1 del motor.</p></div>';
}

/* ── Vista: Radar ── */
function radarItems(){
  var b=(S.v&&S.v.corrida&&S.v.corrida.final_bloqueos)||[], orden={riesgo:0,revisar:1,info:2};
  return b.map(alertaInfo).sort(function(x,y){return orden[x.nivel]-orden[y.nivel];});
}
function radarCard(x,i){
  var a=x.a, extra=[];
  if(a.asiento_id){var s=S.asientos[a.asiento_id];extra.push('Asiento N° '+(s?s.numero+' · '+s.glosa:a.asiento_id));}
  if(a.detalle&&tecnico())extra.push(a.detalle);if(a.clave)extra.push('Regla '+a.clave);if(a.meses)extra.push('Meses '+[].concat(a.meses).join(', '));if(a.cuenta)extra.push('Cuenta '+a.cuenta);
  var et={riesgo:'Riesgo',revisar:'Revisar',info:'Informativo'}[x.nivel];
  return '<div class="rad '+x.nivel+'"><span class="n">'+(i+1)+'</span><small>'+et+'</small><b>'+esc(x.titulo)+'</b><p>'+esc(x.texto)+'</p>'+(extra.length?'<p class="t3">'+esc(extra.join(' · '))+'</p>':'')
    +(tecnico()&&a.codigo==='ANORMAL_SUGERIDO'&&puedeOperar()?'<div class="mrp-acciones"><button type="button" class="btn chico" data-act="marcar" data-asiento="'+a.asiento_id+'" data-accion="CONFIRMADA">Confirmar anormal</button><button type="button" class="btn sec chico" data-act="marcar" data-asiento="'+a.asiento_id+'" data-accion="REVERTIDA">No es anormal</button></div>':'')+'</div>';
}
function vRadar(){
  var it=radarItems(), pend=Object.keys(S.O).map(function(k){return S.O[k];}).filter(function(x){return x.estado_dato==='PENDING'||x.estado_dato==='PARAM_UNAVAILABLE';});
  var h='<div class="card"><div class="h"><h2>Radar · <span>alertas de la corrida</span></h2><small class="t2">'+it.length+' alertas</small></div><div class="mrp-radar-g">'+it.map(radarCard).join('')+'</div></div>';
  h+='<div class="card"><div class="h"><h2>Cifras <span>no disponibles</span></h2><small class="t2">nunca se asumen en cero</small></div>'
    +(pend.length?'<div class="tabla-box"><table class="cmp"><thead><tr><th>Cifra</th><th>Estado</th><th>Motivo</th></tr></thead><tbody>'+pend.map(function(x){return '<tr tabindex="0" class="clic" data-det="'+esc(x.output_key)+'"><td>'+esc(x.explicacion||x.output_key)+(tecnico()?' <span class="t3 mono">'+esc(x.output_key)+'</span>':'')+'</td><td>'+chip(x)+'</td><td>'+(x.unknown_reasons||[]).map(razonTxt).join('<br>')+'</td></tr>';}).join('')+'</tbody></table></div>'
      :'<p class="t2">Todas las cifras de la corrida tienen monto (o no aplican).</p>')+'</div>';
  return h;
}

/* ── Vista: Formato F22 (modo técnico) ── */
function vF22(){
  var c=S.v.corrida, h='<div class="card mrp-imprimible f22"><div class="h"><h2>Formato F22 · <span>'+esc(nombreCaso(S.caso))+'</span></h2><button type="button" class="btn sec chico imprimir" data-act="imprimir-sec">'+I('imprimir')+'Imprimir / guardar PDF</button></div>'
    +'<p class="t2">AC '+S.caso.anio_comercial+' · AT '+S.caso.anio_tributario+' · Pro Pyme General (Art. 14 D N°3) · contabilidad al '+fFecha(corte())+' · corrida #'+c.id+' ('+esc(c.engine_version)+'). '+(layoutDraft()?'<b class="t-ambar">Códigos provisionales:</b> el formato F22 del AT '+S.caso.anio_tributario+' está en borrador hasta su certificación.':'Formato F22 certificado.')+' Cálculo preliminar.</p>'
    +'<div class="tabla-box"><table class="cmp f22t"><thead><tr><th class="cod">Código</th><th>Partida</th><th class="num">Real al corte</th><th class="num">Año (proyectado)</th><th>Estado</th><th>Evidencia</th></tr></thead><tbody>';
  var rec=null;
  S.items.forEach(function(i){
    if(i.recuadro!==rec){rec=i.recuadro;h+='<tr class="grupo"><td colspan="6">'+esc(rec==='REGISTROS_EMPRESARIALES'?'Registros empresariales':'Recuadro base imponible 14 D N°3')+'</td></tr>';}
    var fa, ff, ka, kf;
    if(i.tipo==='REGISTRO'){var r=i.codigo.toLowerCase();ka='actual.registro.'+r+'_inicial';kf='forecast.registro.'+r+'_final';}else{ka='actual.f22.'+i.codigo;kf='forecast.f22.'+i.codigo;}
    fa=o(ka);ff=o(kf);
    h+='<tr tabindex="0" class="clic'+(i.tipo==='TOTAL'?' tot':'')+'" data-det="'+(i.tipo==='REGISTRO'?esc(kf):'f22:'+esc(i.codigo))+'"><td class="cod">'+esc(i.codigo)+'</td><td>'+esc(i.glosa)+(i.tipo==='REGISTRO'?' <span class="t3">(inicial → final)</span>':'')+' <span class="lupa">'+ic('lupa')+'</span></td><td class="num">'+(fa&&fa.estado_dato==='NOT_APPLICABLE'?'<span class="nd">No aplica</span>':clp(fa&&fa.monto))+'</td><td class="num">'+(ff&&ff.estado_dato==='NOT_APPLICABLE'?'<span class="nd">No aplica</span>':clp(ff&&ff.monto))+'</td><td>'+chip(ff)+'</td><td class="t2">'+esc(EVID[(fa||{}).evidence_level]||'—')+'</td></tr>';
  });
  h+='<tr class="grupo"><td colspan="6">Impuesto y pagos provisionales</td></tr>'
    +[['IDPC','Impuesto de primera categoría','actual.idpc','forecast.idpc'],['PPM','Pagos provisionales mensuales imputables','actual.ppm.imputable','forecast.ppm.imputable'],['SALDO','Saldo de abril (IDPC − PPM)','actual.saldo_abril','forecast.saldo_abril']]
      .map(function(x){return '<tr tabindex="0" class="clic" data-det="'+x[3]+'"><td class="cod">'+x[0]+'</td><td>'+x[1]+'</td><td class="num">'+monto(x[2])+'</td><td class="num">'+monto(x[3])+'</td><td>'+chip(o(x[3]))+'</td><td class="t2">'+esc(EVID[(o(x[2])||{}).evidence_level]||'—')+'</td></tr>';}).join('');
  return h+'</tbody></table></div><p class="nota">Mismos códigos e ítems del formulario, para usarlos al completar el F22. Los saldos de registros (RAI, SAC, REX, CPTS) se muestran inicial → final proyectado.</p></div>';
}

/* ── Vista: Revisión técnica ── */
function vTecnica(){
  var c=S.v.corrida, op=puedeOperar();
  var h='<div class="card"><div class="h"><h2>Corrida <span>#'+c.id+'</span></h2>'+chipEstadoVig()+'</div><div class="mrp-doc-g">'
    +[['Motor',c.motor+' · '+c.engine_version],['Corte',fFecha(c.cutoff_date)],['Resultado',c.resultado_estado],['Calculada',fHora(c.finalizado_at)],
      ['Formato F22','layout #'+(c.layout&&c.layout.id)+' · '+(c.layout&&c.layout.estado)],['Supuesto',c.supuesto_forecast_id?'#'+c.supuesto_forecast_id:'sin supuesto'],
      ['input_hash','<span class="mono">'+esc(c.input_hash)+'</span>'],['ruleset_hash','<span class="mono">'+esc(c.ruleset_hash)+'</span>']]
      .map(function(x){return '<div><span class="t3">'+x[0]+'</span>'+(x[1].indexOf('<span')===0?x[1]:esc(x[1]))+'</div>';}).join('')+'</div>'
    +((S.v.cambios||[]).length?'<p class="t-ambar">Cambió desde el cálculo: '+S.v.cambios.map(function(x){return esc(CAMBIO[x]||x);}).join(', ')+'.</p>':'')+'</div>';
  // Supuestos
  h+='<div class="card"><div class="h"><h2>Supuesto de <span>proyección</span></h2>'+(op?'<button type="button" class="btn chico" data-act="nuevo-supuesto">'+I('plus')+'Nuevo supuesto</button>':'')+'</div>'
    +(S.sups.length?'<div class="tabla-box"><table class="cmp"><thead><tr><th>Versión</th><th>Estado</th><th>Método</th><th>Parámetros</th><th>Motivo</th></tr></thead><tbody>'+S.sups.map(function(s){
      return '<tr><td>v'+s.version+'</td><td><span class="estado '+(s.estado==='ACTIVE'?'verde':s.estado==='DRAFT'?'ambar':'gris')+'">'+esc(s.estado)+'</span></td><td>'+esc(s.forecast_method)+'</td><td class="mono">'+esc(JSON.stringify(s.parameters))+'</td><td>'+esc(s.motivo)+'</td></tr>';}).join('')+'</tbody></table></div>'
      :'<p class="t2">Sin supuestos: el motor solo entrega el real al corte (sin proyección a diciembre).</p>')+'</div>';
  // Meses declarados
  var vig=S.meses.filter(function(d){return d.tipo==='SIN_MOVIMIENTO'&&!S.meses.some(function(r){return r.revoca_a===d.id;});});
  h+='<div class="card"><div class="h"><h2>Meses declarados <span>sin movimiento</span></h2>'+(op?'<button type="button" class="btn sec chico" data-act="declarar-mes">'+I('calendario')+'Declarar mes</button>':'')+'</div>'
    +'<p class="t2">Un mes sin asientos solo cuenta como acreditado si se declara "sin movimiento" (con motivo). Sin todos los meses acreditados no hay proyección.</p>'
    +(vig.length?'<div class="tabla-box"><table class="cmp"><thead><tr><th>Mes</th><th>Motivo</th><th>Declarado</th><th></th></tr></thead><tbody>'+vig.map(function(d){
      return '<tr><td>'+esc(MESES[+d.mes.slice(5,7)-1]+' '+d.mes.slice(0,4))+'</td><td>'+esc(d.motivo)+'</td><td>'+fHora(d.creado_at)+'</td><td>'+(op?'<button type="button" class="btn sec chico" data-act="revocar-mes" data-id="'+d.id+'">Revocar</button>':'')+'</td></tr>';}).join('')+'</tbody></table></div>':'<p class="t3">Ningún mes declarado.</p>')+'</div>';
  // Marcas
  var ult={};S.marcas.forEach(function(m){ult[m.asiento_id+'|'+(m.cuenta_codigo||'')+'|'+m.tipo+'|'+(m.componente||'')]=m;});
  var lista=Object.keys(ult).map(function(k){return ult[k];});
  h+='<div class="card"><div class="h"><h2>Marcas del <span>analista</span></h2></div><p class="t2">Anormal / no recurrente: el asiento cuenta una vez en el real y no entra al promedio (M13). Las sugerencias automáticas se resuelven en el Radar.</p>'
    +(lista.length?'<div class="tabla-box"><table class="cmp"><thead><tr><th>Asiento</th><th>Tipo</th><th>Acción vigente</th><th>Motivo</th><th></th></tr></thead><tbody>'+lista.map(function(m){var s=S.asientos[m.asiento_id];
      return '<tr><td>N° '+esc(s?s.numero:m.asiento_id)+(s?' · '+esc(s.glosa):'')+(m.cuenta_codigo?' · cta '+esc(m.cuenta_codigo):'')+'</td><td>'+esc(m.tipo)+(m.componente?' · '+esc(m.componente):'')+(m.monto!=null?' · '+clp(m.monto):'')+'</td><td><span class="estado '+(m.accion==='CONFIRMADA'?'verde':m.accion==='SUGERIDA'?'ambar':'gris')+'">'+esc(m.accion)+'</span></td><td>'+esc(m.motivo)+'</td><td>'
        +(op&&m.accion!=='REVERTIDA'&&(m.tipo==='ANORMAL'||m.tipo==='NO_RECURRENTE')?'<button type="button" class="btn sec chico" data-act="marcar" data-asiento="'+m.asiento_id+'" data-tipo="'+m.tipo+'" data-accion="REVERTIDA">Revertir</button>':'')+'</td></tr>';}).join('')+'</tbody></table></div>':'<p class="t3">Sin marcas.</p>')+'</div>';
  // Outputs
  var outs=Object.keys(S.O).map(function(k){return S.O[k];}), f=S.filtroOut.toLowerCase();
  if(f)outs=outs.filter(function(x){return (x.output_key+' '+(x.explicacion||'')).toLowerCase().indexOf(f)>=0;});
  h+='<div class="card"><div class="h"><h2>Outputs <span>de la corrida</span></h2><small class="t2">'+Object.keys(S.O).length+' outputs</small><input class="mrp-filtro" id="mrFiltro" type="search" placeholder="Filtrar por clave o texto" value="'+esc(S.filtroOut)+'" aria-label="Filtrar outputs"></div><div class="tabla-box"><table class="cmp mrp-outs"><thead><tr><th>output_key</th><th class="num">Monto</th><th>Estado</th><th>Evidencia</th><th>Dimensiones</th><th>Motivos</th></tr></thead><tbody>'
    +outs.map(function(x){var d=x.dim||{};return '<tr tabindex="0" class="clic" data-det="'+esc(x.output_key)+'"><td class="mono">'+esc(x.output_key)+'</td><td class="num">'+clp(x.monto)+'</td><td>'+chip(x)+'</td><td>'+esc(x.evidence_level)+'</td><td class="t2">'+esc([d.evidencia,d.naturaleza,d.certificacion,d.calculo].filter(Boolean).join(' · '))+'</td><td class="t2">'+(x.unknown_reasons||[]).map(razonTxt).join('<br>')+'</td></tr>';}).join('')
    +'</tbody></table></div></div>';
  return h;
}
function chipEstadoVig(){var e={VIGENTE:'verde',DESACTUALIZADA:'ambar',CONGELADA:'gris'}[S.v.estado]||'gris';return '<span class="estado '+e+'">'+esc(S.v.estado)+'</span>';}

/* ── Detalle (ventana lateral para validar datos) ── */
function abrirDet(k){
  var html=k.indexOf('f22:')===0?detPartida(k.slice(4)):detOutput(k);
  $('mrDetCuerpo').innerHTML=html;pintarIconos($('mrDetCuerpo'));
  $('mrDet').hidden=false;$('mrVelo').classList.add('on');requestAnimationFrame(function(){$('mrDet').classList.add('on');});
  $('mrDet').classList.toggle('ancho',S.detAncho);
  $('mrDetCerrar').focus();
  if(k.indexOf('f22:')===0){var it=S.IT[k.slice(4)];if(it&&it.tipo==='PARTIDA')cargarCaja(k.slice(4));}
}
function cerrarDet(){$('mrDet').classList.remove('on');$('mrVelo').classList.remove('on');setTimeout(function(){$('mrDet').hidden=true;},260);}
function dims(x){
  if(!x)return '';var d=x.dim||(S.T[x.output_key]||{}).dim||{};
  return '<div class="det-dims">'+chip(x)+[['Evidencia',d.evidencia],['Naturaleza',d.naturaleza],['Certificación',d.certificacion],['Cálculo',d.calculo]].map(function(z){return z[1]?'<span class="estado gris" title="'+z[0]+'">'+z[0]+': '+esc(DIM[z[1]]||z[1])+'</span>':'';}).join('')+'</div>';
}
function detPartida(c){
  var it=S.IT[c]||{codigo:c,glosa:c,tipo:'PARTIDA'}, fa=o('actual.f22.'+c), ff=o('forecast.f22.'+c), ta=S.T['actual.f22.'+c]||{}, tf=S.T['forecast.f22.'+c]||{};
  var h='<div class="det-cab"><small>Detalle de la partida · '+esc(c)+'</small><h3 id="mrDetTit">'+esc(it.glosa)+'</h3><div class="det-v">'+clp(ff&&ff.monto)+'</div><p class="t2">Proyectado a diciembre · real al corte '+clpT(fa&&fa.monto)+'</p>'+dims(ff)+'</div>';
  if(ff&&ff.estado_dato==='NOT_APPLICABLE')return h+'<section><h4>Por qué no aplica</h4><p>'+(ff.unknown_reasons||[]).map(razonTxt).join('<br>')+'</p></section>';
  if(it.tipo==='TOTAL'||it.tipo==='AJUSTE'){
    h+='<section><h4>Fórmula</h4><table class="cmp"><thead><tr><th>Partida</th><th class="num">Real</th><th class="num">Proyectado</th></tr></thead><tbody>'
      +(it.formula||tf.formula||[]).map(function(x){var g=S.IT[x.codigo]||{};return '<tr tabindex="0" class="clic" data-det="f22:'+esc(x.codigo)+'"><td>'+(x.signo<0?'− ':'+ ')+esc(x.codigo)+' · '+esc(g.glosa||'')+'</td><td class="num">'+monto('actual.f22.'+x.codigo)+'</td><td class="num">'+monto('forecast.f22.'+x.codigo)+'</td></tr>';}).join('')
      +'<tr class="tot"><td>= '+esc(c)+'</td><td class="num">'+clp(fa&&fa.monto)+'</td><td class="num">'+clp(ff&&ff.monto)+'</td></tr></tbody></table><p class="nota">Los totales se suman desde las partidas ya redondeadas: la suma impresa calza.</p></section>';
    return h+motivos(ff);
  }
  // Cálculo de la proyección
  var prom=(tf.base_normal!=null&&tf.meses_base)?tf.base_normal/tf.meses_base:null;
  h+='<section><h4>Cálculo</h4><table class="cmp"><tbody><tr><td>Real ene–'+esc(MES3[(tf.meses_base||1)-1]||'')+' (sin la apertura)</td><td class="num">'+clp(fa&&fa.monto)+'</td></tr>'
    +(ff&&ff.dim&&ff.dim.calculo!=='NO_DETERMINADO'&&prom!=null?'<tr><td>+ '+(tf.meses_restantes!=null?tf.meses_restantes:'—')+' meses × promedio de meses normales ('+clpT(prom)+' al mes)</td><td class="num">'+clp(ff.monto-(fa?fa.monto:0))+'</td></tr>':'')
    +'<tr class="tot"><td>= Proyectado a diciembre</td><td class="num">'+clp(ff&&ff.monto)+'</td></tr></tbody></table>'
    +(tf.base_normal!=null?'<p class="nota">Base de meses normales: '+clpT(tf.base_normal)+' en '+tf.meses_base+' meses · método '+esc(tf.metodo||'')+'.</p>':'')
    +((tf.excluidos||[]).length?'<p class="nota">Excluidos del promedio (cuentan una vez en el real): '+tf.excluidos.map(function(a){var s=S.asientos[a];return 'asiento N° '+esc(s?s.numero+' · '+s.glosa:a);}).join('; ')+'.</p>':'')+'</section>';
  var cm=ta.componentes||[];
  if(cm.length)h+='<section><h4>De dónde sale el real</h4><table class="cmp"><thead><tr><th>Origen</th><th>Cuenta</th><th class="num">Monto</th></tr></thead><tbody>'+cm.map(function(x){
      return '<tr><td>'+esc(FUENTE[x.fuente]||x.fuente)+(x.calculo&&x.calculo!=='DETERMINADO'?' <span class="estado ambar">'+esc(DIM[x.calculo]||x.calculo)+'</span>':'')+((x.notas||[]).length?'<br><small class="t3">'+x.notas.map(razonTxt).join(' · ')+'</small>':'')+((x.razones||[]).length?'<br><small class="t-ambar">'+x.razones.map(razonTxt).join(' · ')+'</small>':'')+'</td><td class="mono">'+esc(x.cuenta||'—')+'</td><td class="num">'+clp(x.monto)+'</td></tr>';}).join('')
    +'<tr class="tot"><td colspan="2">Real al corte</td><td class="num">'+clp(fa&&fa.monto)+'</td></tr></tbody></table><p class="nota">Regla de cálculo del código: '+esc(ta.regla_calculo||it.regla_calculo||'—')+'.</p></section>';
  else if(it.regla_calculo==='DEVENGADO_NEUTRO')h+='<section><h4>De dónde sale el real</h4><p>Gastos rechazados no afectos al art. 21 (impuesto a la renta, intereses y multas) según lo devengado en el Diario. No se rebajan: se agregan de vuelta en el código de agregados.</p></section>';
  h+='<section id="detCaja"><h4>Caja y banco que lo respaldan · mes a mes</h4><p class="t3"><span class="mrp-spin"></span> Buscando las trazas de caja de la corrida…</p></section>';
  return h+motivos(fa)+motivos(ff);
}
function motivos(x){if(!x||!(x.unknown_reasons||[]).length||x.estado_dato==='NOT_APPLICABLE')return '';return '<section><h4>Motivos</h4><ul class="det-mot">'+x.unknown_reasons.map(function(r){return '<li>'+razonTxt(r)+'</li>';}).join('')+'</ul></section>';}
function cargarCaja(cod){
  var cid=S.v.corrida.id;
  API.get('renta_e1_trazas_caja?select=lid,cuenta_caja,componente,rol,cuenta_contra,codigo_f22,monto,evidencia&corrida_id=eq.'+cid+'&codigo_f22=eq.'+encodeURIComponent(cod)+'&order=lid.asc').then(function(tr){
    tr=tr||[];if(!tr.length)return [tr,[]];
    var ids=tr.map(function(t){return t.lid;}).filter(function(x,i,a){return a.indexOf(x)===i;}), lotes=[];
    for(var i=0;i<ids.length;i+=150)lotes.push(API.get('renta_lineas_diario?select=id,fecha,cuenta_codigo,cuenta_nombre,asiento_id&id=in.('+ids.slice(i,i+150).join(',')+')'));
    return Promise.all(lotes).then(function(r){return [tr,[].concat.apply([],r)];});
  }).then(function(r){
    var box=$('detCaja');if(!box)return;
    var tr=r[0], li={};r[1].forEach(function(l){li[l.id]=l;});
    if(!tr.length){box.innerHTML='<h4>Caja y banco que lo respaldan · mes a mes</h4><p class="t2">No hay líneas de caja/banco asignadas a este código en la corrida (por ejemplo, partidas en cero o que vienen de devengos sin pago en el período).</p>';return;}
    var ctas=[], tab={}, tot=0, totC={};
    tr.forEach(function(t){var l=li[t.lid], mes=l?+l.fecha.slice(5,7):0, c=t.cuenta_contra||'—';if(ctas.indexOf(c)<0)ctas.push(c);tab[mes]=tab[mes]||{};tab[mes][c]=(tab[mes][c]||0)+Number(t.monto);totC[c]=(totC[c]||0)+Number(t.monto);tot+=Number(t.monto);});
    var meses=Object.keys(tab).map(Number).sort(function(a,b){return a-b;});
    var h='<h4>Caja y banco que lo respaldan · mes a mes</h4><div class="tabla-box"><table class="cmp det-mes"><thead><tr><th>Mes</th>'+ctas.map(function(c){return '<th class="num">Cta '+esc(c)+'</th>';}).join('')+'<th class="num">Total</th></tr></thead><tbody>'
      +meses.map(function(m){var s=0;return '<tr><td>'+esc(MES3[m-1]||'¿?')+'</td>'+ctas.map(function(c){var x=tab[m][c]||0;s+=x;return '<td class="num">'+(x?clp(x):'<span class="t3">—</span>')+'</td>';}).join('')+'<td class="num">'+clp(s)+'</td></tr>';}).join('')
      +'<tr class="tot"><td>Total</td>'+ctas.map(function(c){return '<td class="num">'+clp(totC[c])+'</td>';}).join('')+'<td class="num">'+clp(tot)+'</td></tr></tbody></table></div>'
      +'<p class="nota">Cada línea de caja/banco del período se asigna una sola vez y por su importe exacto (invariante A9, sin doble conteo). '+tr.length+' líneas; columnas = cuenta contrapartida. Los montos de caja pueden incluir IVA: al código va el neto.</p>';
    box.innerHTML=h;
  }).catch(function(e){var box=$('detCaja');if(box)box.innerHTML='<h4>Caja y banco que lo respaldan</h4><div class="aviso rojo">'+esc(textoError(e))+'</div>';});
}
var CLAVE={base:'Base imponible',tasa:'Tasa (%)',idpc:'IDPC',ppm:'PPM',actual:'Real al corte',meses_base:'Meses base',meses_restantes:'Meses restantes',rai_inicial:'RAI inicial',
  retiros_imputados:'Retiros imputados',retiros:'Retiros',sac_disponible:'SAC disponible',sac_inicial:'SAC inicial',credito_asignado:'Crédito asignado',rli:'RLI',
  gastos_rechazados:'Gastos rechazados',porcentaje:'Porcentaje (%)',tope_uf:'Tope (UF)',deduccion:'Deducción',saldo_abril:'Saldo de abril',pagado_por_calce_f29:'Pagado con F29 calzado',
  declarado_no_pagado:'Declarado y no pagado',monto_adicional:'Monto adicional',mes:'Mes',item:'Ítem de apertura',apertura_id:'Apertura tributaria',estado_item:'Estado del ítem',
  metodo:'Método',simplificacion:'Simplificación',movimientos_v1:'Movimientos (v1)',lineas:'Líneas de caja'};
function valTrace(k,x){
  if(x==null)return '<span class="nd">—</span>';
  if(typeof x==='number')return /tasa|porcentaje|meses|mes$|tope_uf|apertura_id/.test(k)?esc(String(x).replace('.',',')):clp(x);
  if(Array.isArray(x))return esc(x.length+' elementos');
  if(typeof x==='object'){if(x.numerador!=null)return esc(String(x.numerador).replace('.',',')+' / '+String(x.denominador).replace('.',','));if(x.valor!=null)return esc('UF '+x.periodo+' = $'+Number(x.valor).toLocaleString('es-CL')+(x.exacta===false?' (estimada)':''));return '<span class="mono">'+esc(JSON.stringify(x))+'</span>';}
  return esc(x);
}
function detOutput(k){
  var x=o(k), t=S.T[k]||{};
  var h='<div class="det-cab"><small>Detalle de la cifra'+(tecnico()?' · '+esc(k):'')+'</small><h3 id="mrDetTit">'+esc((x&&x.explicacion)||k)+'</h3><div class="det-v">'+clp(x&&x.monto)+'</div>'+dims(x)+'</div>';
  var ks=Object.keys(t).filter(function(z){return z!=='dim';});
  if(ks.length)h+='<section><h4>Cómo lo calcula el motor</h4><table class="cmp"><tbody>'+ks.map(function(z){return '<tr><td>'+esc(CLAVE[z]||z)+'</td><td class="num">'+valTrace(z,t[z])+'</td></tr>';}).join('')+'</tbody></table></section>';
  var rel={'forecast.saldo_abril':['forecast.idpc','forecast.ppm.imputable'],'actual.saldo_abril':['actual.idpc','actual.ppm.imputable'],'forecast.idpc':['f22:1440'],'actual.idpc':['f22:1440'],
    'sim.e14.idpc':['sim.e14.deduccion','f22:1440'],'sim.e14.deduccion':['sim.e14.rli_invertida'],'sim.e14.rli_invertida':['f22:1729','f22:1422','forecast.retiros'],
    'forecast.registro.rai_final':['actual.registro.rai_inicial','f22:1440','forecast.idpc','forecast.retiros'],'forecast.registro.sac_1564_final':['actual.registro.sac_1564_inicial','forecast.idpc','forecast.registro.credito_asignado']}[k];
  if(rel)h+='<section><h4>Cifras relacionadas</h4><div class="det-rel">'+rel.map(function(r){var kk=r.indexOf('f22:')===0?'forecast.f22.'+r.slice(4):r, oo=o(kk);
    return '<button type="button" class="btn sec chico" data-det="'+esc(r)+'">'+esc((oo&&oo.explicacion)||r)+' · '+clpT(oo&&oo.monto)+'</button>';}).join('')+'</div></section>';
  return h+motivos(x);
}

/* ── Resumen ejecutivo (hoja A4 clara, imprimible) ── */
var LOGO_CLARO='<svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true"><defs><linearGradient id="mrgE" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A4599C"/><stop offset="1" stop-color="#803889"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#mrgE)"/><circle cx="32" cy="32" r="18" fill="none" stroke="#fff" stroke-width="3.4" opacity=".35"/><path d="M32 14 A18 18 0 1 1 15.6 39.4" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M24 36 L30 30 L34 33 L41 25" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="41" cy="25" r="2.8" fill="#fff"/></svg>';
function hojaEjecutiva(){
  var idF=v('forecast.idpc'), ppmF=v('forecast.ppm.imputable'), sal=v('forecast.saldo_abril'), cob=(idF&&ppmF!=null)?ppmF/idF:null, m=mesCorte()||0;
  var s14=v('sim.e14.saldo_abril'), cuota=v('sim.ppm_voluntario.cuota_mensual'), ahorro=(idF!=null&&v('sim.e14.idpc')!=null)?idF-v('sim.e14.idpc'):null;
  var pasa=[];
  pasa.push('Con la contabilidad de enero a '+MESES[m-1]+', la empresa proyecta una renta líquida imponible de '+clpT(v('forecast.f22.1729'))+' para '+S.caso.anio_comercial+'.');
  pasa.push('El impuesto de primera categoría proyectado es '+clpT(idF)+'; los PPM del año cubrirían '+pctTxt(cob)+'.');
  if(v('forecast.retiros'))pasa.push('Los socios han retirado '+clpT(v('forecast.retiros'))+' en el año.');
  var rec=[];
  if(cob!=null&&cob<UMBRAL.COB_VERDE&&cuota)rec.push('Evaluar un PPM voluntario de '+clpT(cuota)+' al mes hasta diciembre para llegar a abril sin saldo.');
  if(ahorro&&ahorro>0)rec.push('Conversar el incentivo al ahorro (art. 14 E): bajaría el impuesto estimado en '+clpT(ahorro)+' si no se retiran más utilidades este año.');
  if(!rec.length)rec.push('Mantener la planificación actual y revisar la proyección con el cierre de cada mes.');
  var dev=sal!=null&&sal<0;
  return '<div class="ej-hoja"><div class="ej-cab"><div class="ej-logo">'+LOGO_CLARO+'<div><div class="ej-marca">Mi<span>Renta</span></div><div class="ej-sub">Resumen ejecutivo · proyección de la renta</div><span class="ej-prelim">PRELIMINAR</span></div></div>'
    +'<div class="ej-cli"><b>'+esc(nombreCaso(S.caso))+'</b><span>Año comercial '+S.caso.anio_comercial+' · Año tributario '+S.caso.anio_tributario+'</span><span>Contabilidad al '+fFecha(corte())+' · emitido '+fFecha(new Date().toISOString())+'</span></div></div>'
    +'<div class="ej-hero"><div><small>'+(dev?'Devolución estimada en abril ':'Saldo estimado a pagar en abril ')+S.caso.anio_tributario+'</small><b'+(dev?' class="ej-dev"':'')+'>'+clpT(dev?Math.abs(sal):sal)+'</b><p>Impuesto proyectado menos PPM del año, si la situación se mantiene.</p></div>'
    +'<div class="ej-kpis"><div><small>Impuesto proyectado</small><b>'+clpT(idF)+'</b></div><div><small>PPM del año</small><b>'+clpT(ppmF)+'</b></div><div><small>Cobertura con PPM</small><b class="'+(cob!=null&&cob<UMBRAL.COB_VERDE?'ej-ambar':'')+'">'+pctTxt(cob)+'</b></div><div><small>Renta líquida imponible</small><b>'+clpT(v('forecast.f22.1729'))+'</b></div></div></div>'
    +'<h2>¿Qué está pasando?</h2><ul class="ej-lista">'+pasa.map(function(p){return '<li>'+esc(p)+'</li>';}).join('')+'</ul>'
    +'<h2>Opciones para conversar</h2><table class="ej-tabla"><thead><tr><th>Opción</th><th>Impuesto</th><th>Saldo en abril</th></tr></thead><tbody>'
    +'<tr><td><b>Seguir igual</b><br><span>Proyección actual, sin decisiones nuevas.</span></td><td>'+clpT(idF)+'</td><td>'+clpSaldoT(sal)+'</td></tr>'
    +'<tr class="ej-dest"><td><b>Incentivo al ahorro (art. 14 E)</b><br><span>Dejar invertidas las utilidades; no retirar más este año.</span></td><td>'+clpT(v('sim.e14.idpc'))+'</td><td>'+clpSaldoT(s14)+'</td></tr>'
    +'<tr><td><b>PPM voluntario</b><br><span>'+clpT(cuota)+' al mes durante '+(12-m)+' meses (anticipa el pago, no lo reduce).</span></td><td>'+clpT(idF)+'</td><td>'+(cuota!=null?'$0':'No disponible')+'</td></tr></tbody></table>'
    +'<h2>Nuestra recomendación</h2><ol class="ej-lista ej-ol">'+rec.map(function(r){return '<li>'+esc(r)+'</li>';}).join('')+'</ol>'
    +'<h2>Saldos tributarios al cierre (proyectados)</h2><div class="ej-reg-g"><div class="r-rai"><small>RAI · utilidades tributables</small><b>'+clpT(v('forecast.registro.rai_final'))+'</b></div><div class="r-sac"><small>SAC · créditos acumulados</small><b>'+clpT(v('forecast.registro.sac_1564_final'))+'</b></div><div class="r-rex"><small>REX · exentas</small><b>'+clpT(v('forecast.registro.rex_final'))+'</b></div><div class="r-cap"><small>CPTS · capital propio</small><b>'+clpT(v('forecast.registro.cpts_final'))+'</b></div></div>'
    +'<div class="ej-pie"><p><b>Supuestos:</b> proyección lineal de los meses que faltan con el promedio de los meses normales; lo que viene del período anterior no se rebaja; retenciones y cotizaciones por lo pagado.</p>'
    +'<p><b>Cálculo preliminar</b>, sujeto a la certificación de reglas'+(layoutDraft()?' y a la publicación del formulario F22 del AT '+S.caso.anio_tributario:'')+'. No reemplaza la declaración de renta. Preparado por Contadoor con MiRenta.</p></div></div>';
}
/* Hoja opcional de detalle (determinación, registros y F22): solo presenta outputs del motor, sin cálculos nuevos */
function hojaDetalle(){
  var filas=S.items.filter(function(i){return i.tipo!=='REGISTRO';}).map(function(i){
    var fa=o('actual.f22.'+i.codigo), ff=o('forecast.f22.'+i.codigo);
    if(fa&&fa.estado_dato==='NOT_APPLICABLE'&&ff&&ff.estado_dato==='NOT_APPLICABLE')return '';
    var na=function(x){return x&&x.estado_dato==='NOT_APPLICABLE'?'No aplica':clpT(x&&x.monto);};
    return '<tr'+(i.tipo!=='PARTIDA'?' class="ej-tot"':'')+'><td>'+esc(i.codigo)+'</td><td>'+esc(i.glosa)+'</td><td>'+na(fa)+'</td><td>'+na(ff)+'</td></tr>';}).join('');
  var regs=[['RAI · rentas afectas','rai'],['SAC · créditos acumulados (1564)','sac_1564'],['REX · rentas exentas','rex'],['CPTS · capital propio tributario','cpts']].map(function(r){
    return '<tr><td>'+r[0]+'</td><td>'+clpT(v('actual.registro.'+r[1]+'_inicial'))+'</td><td>'+clpT(v('forecast.registro.'+r[1]+'_final'))+'</td></tr>';}).join('');
  return '<div class="ej-hoja ej-p2"><div class="ej-cab"><div class="ej-logo"><div><div class="ej-marca">Mi<span>Renta</span></div><div class="ej-sub">Detalle · determinación, registros y F22</div><span class="ej-prelim">PRELIMINAR</span></div></div>'
    +'<div class="ej-cli"><b>'+esc(nombreCaso(S.caso))+'</b><span>Contabilidad al '+fFecha(corte())+'</span></div></div>'
    +'<h2>Determinación de la base imponible (formato F22'+(layoutDraft()?', códigos provisionales':'')+')</h2>'
    +'<table class="ej-tabla ej-det ej-f22"><thead><tr><th>Código</th><th>Partida</th><th>Real al corte</th><th>Proyectado diciembre</th></tr></thead><tbody>'+(filas||'<tr><td colspan="4">No disponible</td></tr>')+'</tbody></table>'
    +'<h2>Registros empresariales</h2><table class="ej-tabla ej-det"><thead><tr><th>Registro</th><th>Saldo inicial</th><th>Saldo final proyectado</th></tr></thead><tbody>'+regs+'</tbody></table>'
    +'<div class="ej-pie"><p><b>PRELIMINAR.</b> "No disponible" significa que el motor no tiene el dato: nunca se asume en cero. No reemplaza la declaración de renta.</p></div></div>';
}
function abrirEjecutivo(){
  var conDet=$('mrDocDet')&&$('mrDocDet').checked;
  $('mrDocHoja').innerHTML=hojaEjecutiva()+(conDet?hojaDetalle():'');$('mrDoc').hidden=false;document.body.classList.add('mrp-doc-abierto');$('mrDocImp').focus();
}
function cerrarEjecutivo(){$('mrDoc').hidden=true;document.body.classList.remove('mrp-doc-abierto');}
var tituloPrevio=null;
function imprimir(que){document.body.setAttribute('data-print',que);window.print();}
window.addEventListener('afterprint',function(){document.body.removeAttribute('data-print');if(tituloPrevio!=null){document.title=tituloPrevio;tituloPrevio=null;}});
/* Nombre sugerido del PDF (el navegador usa el título del documento): razón social + fecha de corte + PRELIMINAR */
function nombreArchivo(){
  var rs=String(nombreCaso(S.caso)).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,60)||'cliente';
  return 'MiRenta_PRELIMINAR_'+rs+'_corte_'+(corte()||'sin-corte');
}
function descargarPdf(){
  if(!S.v||!S.v.corrida){toast(I('alerta','ic-amb')+' Este caso no tiene una proyección para descargar.');return;}
  if($('mrDoc').hidden)abrirEjecutivo();
  if(tituloPrevio==null)tituloPrevio=document.title;
  document.title=nombreArchivo();
  imprimir('ej');
}

/* ── Acciones con motivo (el motor valida permisos, cartera y estado del caso) ── */
function modal(cfg){
  modal.cfg=cfg;
  $('mrModalCuerpo').innerHTML='<h3 id="mrModalTit">'+cfg.t+'</h3>'+(cfg.b||'')+'<label class="mrp-campo"><span>Motivo (queda en la bitácora)</span><textarea id="mrMotivo" rows="2" placeholder="'+esc(cfg.ph||'Explica por qué')+'"></textarea></label>'
    +'<p class="mrp-merr" id="mrMerr" role="alert"></p><div class="mrp-acciones fin"><button type="button" class="btn sec" data-m="no">Cancelar</button><button type="button" class="btn" data-m="si">'+esc(cfg.ok||'Confirmar')+'</button></div>';
  pintarIconos($('mrModalCuerpo'));$('mrModal').hidden=false;$('mrMvelo').classList.add('on');setTimeout(function(){var f=$('mrModalCuerpo').querySelector('input,select,textarea');if(f)f.focus();},30);
}
function cerrarModal(){$('mrModal').hidden=true;$('mrMvelo').classList.remove('on');modal.cfg=null;}
function confirmarModal(){
  var cfg=modal.cfg;if(!cfg||modal.ocupado)return;
  var mot=($('mrMotivo').value||'').trim();
  if(mot.length<5){$('mrMerr').textContent='Escribe un motivo (mínimo 5 caracteres).';return;}
  var r=cfg.cb(mot);if(r===false)return;
  modal.ocupado=true;$('mrModalCuerpo').querySelector('[data-m="si"]').disabled=true;
  Promise.resolve(r).then(function(msg){modal.ocupado=false;cerrarModal();if(msg)toast(msg);return cargarCaso();})
    .catch(function(e){modal.ocupado=false;var b=$('mrModalCuerpo').querySelector('[data-m="si"]');if(b)b.disabled=false;var t=textoError(e);$('mrMerr').innerHTML=t==='MOTOR_NO_INSTALADO'?'El motor de proyección todavía no está instalado en producción.':t;});
}
function accProyectar(){
  var ac=S.caso.anio_comercial, hoy=new Date(), lim=(hoy.getFullYear()>ac)?12:Math.max(1,hoy.getMonth()), def=corte()||finDeMes(ac,lim), op='';
  for(var m=1;m<=lim;m++){var f=finDeMes(ac,m);op+='<option value="'+f+'"'+(f===def?' selected':'')+'>'+fFecha(f)+' ('+MESES[m-1]+')</option>';}
  modal({t:(S.v&&S.v.corrida?'Recalcular':'Calcular')+' la proyección',ok:'Calcular',ph:'Ej.: se cargó el Diario de septiembre',
    b:'<p>El motor vuelve a leer el Diario, el Balance, el mapeo, la apertura, los meses, las marcas y el supuesto activo. Si nada cambió, reutiliza la corrida vigente.</p><label class="mrp-campo"><span>Fecha de corte (fin de mes cubierto por el Balance)</span><select id="mrCorte">'+op+'</select></label>',
    cb:function(){var c=$('mrCorte').value;
      return API.rpc('renta_e1_proyectar',{p_caso_id:S.caso.id,p_corte:c,p_supuesto_id:null}).then(function(r){
        if(r&&r.estado==='FALLIDA'){var e=new Error(r.mensaje||r.codigo);e.mr={code:r.codigo,message:r.mensaje||'',status:200};throw e;}
        return r&&r.reutilizada?I('check','ic-ver')+' Sin cambios: la proyección vigente ya corresponde a estos datos.':I('check','ic-ver')+' Proyección calculada (corrida #'+(r&&r.corrida_id)+').';});}});
}
function accSupuesto(){
  var act=S.sups.filter(function(s){return s.estado==='ACTIVE';})[0], prev=(act&&act.parameters&&act.parameters.sim_retiros_adicionales)||[], ac=S.caso.anio_comercial, m=mesCorte()||0;
  var filas='';for(var i=0;i<5;i++){var p=prev[i]||{};var ops='<option value="">—</option>';for(var k=1;k<=12;k++)ops+='<option value="'+k+'"'+(p.mes===k?' selected':'')+(k<=m?' disabled':'')+'>'+MESES[k-1]+'</option>';
    filas+='<div class="mrp-fila-ret"><span>Retiro '+(i+1)+'</span><input type="number" min="1" step="1" inputmode="numeric" placeholder="Monto $" aria-label="Monto del retiro '+(i+1)+'" data-ret-monto="'+i+'" value="'+(p.monto||'')+'"><select aria-label="Mes del retiro '+(i+1)+'" data-ret-mes="'+i+'">'+ops+'</select></div>';}
  modal({t:'Nuevo supuesto de proyección',ok:'Crear y activar',ph:'Ej.: simular retiro de fin de año de los socios',
    b:'<p>Método <b>MANUAL · LINEAL_PROMEDIO_V1</b> (el único que acepta el motor e1-1). Opcional: hasta 5 <b>retiros adicionales</b> en meses futuros para simular (la Base no cambia). Se crea una versión nueva y reemplaza al supuesto activo'+(act?' (v'+act.version+')':'')+'.</p>'+filas+'<p class="t3">Después de activarlo, recalcula la proyección para ver las simulaciones.</p>',
    cb:function(mot){
      var sim=[];
      for(var i=0;i<5;i++){var mo=$('mrModalCuerpo').querySelector('[data-ret-monto="'+i+'"]').value, me=$('mrModalCuerpo').querySelector('[data-ret-mes="'+i+'"]').value;
        if(!mo&&!me)continue;
        if(!(+mo>0)||!me||Math.round(+mo)!==+mo){$('mrMerr').textContent='Retiro '+(i+1)+': indica un monto entero mayor a $0 y un mes.';return false;}
        sim.push({monto:+mo,mes:+me});}
      var par={metodo:'LINEAL_PROMEDIO_V1'};if(sim.length)par.sim_retiros_adicionales=sim;
      return API.rpc('renta_supuesto_forecast_crear',{p_caso_id:S.caso.id,p_metodo:'MANUAL',p_parametros:par,p_motivo:mot}).then(function(r){
        return API.rpc('renta_supuesto_forecast_activar',{p_supuesto_id:r.id,p_motivo:mot});}).then(function(){S.sec=S.sec==='escenarios'?'escenarios':S.sec;
        return I('check','ic-ver')+' Supuesto activado. Recalcula la proyección para ver el efecto.';});}});
}
function accDeclararMes(){
  var ac=S.caso.anio_comercial, m=mesCorte()||12, op='';for(var k=1;k<=12;k++)op+='<option value="'+ac+'-'+('0'+k).slice(-2)+'-01"'+(k===1?' selected':'')+'>'+MESES[k-1]+' '+ac+'</option>';
  modal({t:'Declarar mes sin movimiento',ok:'Declarar',ph:'Ej.: la empresa no operó en enero (vacaciones)',b:'<p>Úsalo solo si el mes realmente no tuvo operaciones. Si después aparecen asientos, el motor lo avisa.</p><label class="mrp-campo"><span>Mes</span><select id="mrMes">'+op+'</select></label>',
    cb:function(mot){return API.rpc('renta_e1_mes_declarar',{p_caso_id:S.caso.id,p_mes:$('mrMes').value,p_motivo:mot}).then(function(){return I('check','ic-ver')+' Mes declarado sin movimiento.';});}});
}
function accRevocarMes(id){
  modal({t:'Revocar declaración',ok:'Revocar',ph:'Ej.: aparecieron asientos del mes',b:'<p>El mes vuelve a requerir asientos para quedar acreditado.</p>',
    cb:function(mot){return API.rpc('renta_e1_mes_revocar',{p_declaracion_id:+id,p_motivo:mot}).then(function(){return I('check','ic-ver')+' Declaración revocada.';});}});
}
function accMarcar(asiento,accion,tipo){
  tipo=tipo||'ANORMAL';var s=S.asientos[asiento];
  var t=accion==='CONFIRMADA'?'Confirmar asiento anormal':(accion==='REVERTIDA'&&tipo==='ANORMAL'&&!S.marcas.some(function(x){return x.asiento_id===+asiento&&x.tipo==='ANORMAL';})?'Descartar sugerencia de anormal':'Revertir marca');
  modal({t:t,ok:'Guardar marca',ph:accion==='CONFIRMADA'?'Ej.: gasto puntual de implementación, no se repite':'Ej.: es un gasto habitual del giro',
    b:'<p>Asiento <b>N° '+esc(s?s.numero:asiento)+'</b>'+(s?' · '+esc(s.glosa)+' ('+fFecha(s.fecha)+')':'')+'. '+(accion==='CONFIRMADA'?'Cuenta una vez en el real y no entra al promedio de la proyección.':'Vuelve a entrar al promedio de la proyección (y deja de sugerirse automáticamente).')+'</p>',
    cb:function(mot){return API.rpc('renta_e1_marcar',{p_caso_id:S.caso.id,p_asiento_id:+asiento,p_tipo:tipo,p_accion:accion,p_motivo:mot}).then(function(){return I('check','ic-ver')+' Marca guardada. Recalcula la proyección para aplicarla.';});}});
}

/* ============================================================
   PANTALLA 1 · CARTERA DE RENTA
   Solo lecturas que el frontend ya puede hacer con el JWT del usuario (RLS por cartera de MiRenta):
     clientes · renta_casos · renta_motor_corridas (vigente) · renta_motor_outputs (solo CLAVES_CARTERA) ·
     renta_aperturas · renta_apertura_contable_aceptaciones · RPC renta_e1_proyeccion_vigente (vigencia, de a 3 en paralelo).
   No calcula impuestos: presenta outputs del motor; la cobertura es una división de dos outputs.
   ============================================================ */
/* Umbrales del semáforo (fáciles de cambiar). Cobertura = forecast.ppm.imputable ÷ forecast.idpc */
var UMBRAL={COB_ROJO:0.70,COB_VERDE:0.90,SALDO_ALTO:15000000};
var CLAVES_CARTERA=['forecast.idpc','forecast.ppm.imputable','forecast.saldo_abril','actual.ppm.imputable'];
var SEMAFORO={rojo:['rojo','Revisar',0],ambar:['ambar','Atención',1],nd:['gris','Datos incompletos',2],gris:['gris','Sin proyección',3],verde:['verde','Al día',4]};
var ORDENES=[['prioridad','Prioridad (rojos primero)'],['saldo','Mayor saldo a pagar'],['cobertura','Menor cobertura'],['apertura','Apertura pendiente primero'],['fecha','Proyección más antigua'],['nombre','Nombre (A–Z)']];
var FILTROS=[['todos','Todos'],['rojo','En rojo'],['cobbaja','Cobertura baja'],['apertura','Apertura pendiente'],['desact','Datos nuevos'],['sinproy','Sin proyección']];

function nivelCob(c){return c==null||!isFinite(c)?'gris':c<UMBRAL.COB_ROJO?'rojo':c<UMBRAL.COB_VERDE?'ambar':'verde';}
function prioCob(c){return nivelCob(c);}
function pctEntero(c){return Math.floor(c*100+1e-9).toLocaleString('es-CL')+' %';}   // trunca: 69,6 % se lee 69 % (coherente con el rojo)
/* Barra de cobertura del PPM: el % siempre también como texto (no solo color) */
function barraCob(cob,saldo,grande){
  if(cob==null||!isFinite(cob))return '<div class="mrc-cob gris'+(grande?' grande':'')+'"><div class="mrc-cob-barra" aria-hidden="true"><i style="width:0"></i></div><div class="mrc-cob-txt"><b class="nd">No disponible</b></div></div>';
  var exc=cob>1, w=Math.max(0,Math.min(100,cob*100)), niv=exc?'verde':nivelCob(cob), txt=pctEntero(cob)+' cubierto';
  var sub=exc?'excedente → devolución':(saldo!=null&&saldo>0?'faltan '+clpT(saldo):'');
  return '<div class="mrc-cob '+niv+(grande?' grande':'')+(exc?' exc':'')+'"><div class="mrc-cob-barra" role="progressbar" aria-label="Cobertura del PPM" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(w)+'" aria-valuetext="'+esc(txt+(sub?', '+sub:''))+'"><i style="width:'+w.toFixed(1)+'%"></i>'
    +'<span class="mrc-m70" style="left:'+UMBRAL.COB_ROJO*100+'%"></span><span class="mrc-m90" style="left:'+UMBRAL.COB_VERDE*100+'%"></span></div>'
    +'<div class="mrc-cob-txt"><b>'+txt+'</b>'+(sub?'<span>'+sub+'</span>':'')+'</div></div>';
}
/* Lectura completa con paginación (PostgREST corta en 1000 filas por defecto) */
function getTodo(path){
  var out=[], P=1000;
  function pag(off){return API.get(path+(path.indexOf('?')<0?'?':'&')+'limit='+P+'&offset='+off).then(function(r){r=r||[];out=out.concat(r);return r.length<P||off>50000?out:pag(off+P);});}
  return pag(0);
}
function montoOut(x){if(!x||x.monto==null||x.estado_dato==='PENDING'||x.estado_dato==='PARAM_UNAVAILABLE'||x.estado_dato==='NOT_APPLICABLE')return null;var n=Number(x.monto);return isFinite(n)?n:null;}

function cargarCartera(){
  var C=S.cart;C.cargando=true;C.error=null;C.tok++;var tok=C.tok;render();
  var yo=S.yo||{};
  return Promise.all([
    getTodo('clientes?select=id,razon_social,estado,tiene_contabilidad,analista_contable,analista_contable_usuario_id&order=razon_social.asc,id.asc'),
    getTodo('renta_casos?select=id,cliente_id,anio_comercial,anio_tributario,regimen,estado,version&estado=neq.RECTIFIED&order=anio_comercial.desc,version.desc,id.desc'),
    getTodo('renta_motor_corridas?select=id,caso_id,cliente_id,cutoff_date,finalizado_at,resultado_estado&vigente=is.true&motor=eq.T1_RLI_14D3&order=id.asc')
  ]).then(function(r){
    var cls=r[0]||[], casos=r[1]||[], cors=r[2]||[];
    // Misma regla que renta_clientes_visibles(): Master ve todos; contable, los que tiene asignados como analista contable
    if(!yo.es_master)cls=cls.filter(function(c){return c.analista_contable_usuario_id===yo.id;});
    // Caso del cliente = el del año comercial más reciente (si hay dos en el mismo año, el 14 D N°3)
    var casoDe={};casos.forEach(function(k){var a=casoDe[k.cliente_id];if(!a||(k.anio_comercial===a.anio_comercial&&k.regimen==='14D3'&&a.regimen!=='14D3'))casoDe[k.cliente_id]=k;});
    var corDe={};cors.forEach(function(c){corDe[c.caso_id]=c;});
    S.casos=casos.filter(function(k){return k.regimen==='14D3';});
    cls.forEach(function(c){S.clientes[c.id]=c.razon_social;});
    var filas=cls.filter(function(c){return (c.estado==='activo'&&c.tiene_contabilidad!==false)||casoDe[c.id];}).map(function(c){
      var k=casoDe[c.id]||null;
      return {cliente_id:c.id,nombre:c.razon_social||('Cliente #'+c.id),resp:c.analista_contable||'',resp_id:c.analista_contable_usuario_id,caso:k,corrida:k?(corDe[k.id]||null):null,O:{},vig:null};
    });
    var casoIds=filas.filter(function(f){return f.caso;}).map(function(f){return f.caso.id;}), corIds=filas.filter(function(f){return f.corrida;}).map(function(f){return f.corrida.id;});
    return Promise.all([
      casoIds.length?getTodo('renta_aperturas?select=id,caso_id,estado&estado=neq.SUPERSEDED&caso_id=in.('+casoIds.join(',')+')&order=id.asc'):[],
      casoIds.length?getTodo('renta_apertura_contable_aceptaciones?select=id,caso_id,accion&caso_id=in.('+casoIds.join(',')+')&order=id.asc'):[],
      corIds.length?getTodo('renta_motor_outputs?select=corrida_id,output_key,monto,estado_dato&corrida_id=in.('+corIds.join(',')+')&output_key=in.('+CLAVES_CARTERA.map(function(k){return '"'+k+'"';}).join(',')+')&order=id.asc'):[]
    ]).then(function(r2){
      if(tok!==C.tok)return;
      var trib={},cont={},outs={};
      (r2[0]||[]).forEach(function(a){var p=trib[a.caso_id];if(!p||a.estado==='OPENING_VERIFIED')trib[a.caso_id]=a.estado;});
      (r2[1]||[]).forEach(function(a){cont[a.caso_id]=a.accion;});   // ordenadas por id: queda la última acción
      (r2[2]||[]).forEach(function(x){(outs[x.corrida_id]=outs[x.corrida_id]||{})[x.output_key]=x;});
      filas.forEach(function(f){
        if(f.corrida)f.O=outs[f.corrida.id]||{};
        f.idpc=montoOut(f.O['forecast.idpc']);f.ppm=montoOut(f.O['forecast.ppm.imputable']);f.saldo=montoOut(f.O['forecast.saldo_abril']);
        f.cob=(f.idpc!=null&&f.idpc>0&&f.ppm!=null)?f.ppm/f.idpc:null;
        if(f.caso){
          f.contOk=cont[f.caso.id]==='ACEPTAR';
          f.trib=trib[f.caso.id]==='OPENING_VERIFIED'?'VERIFICADA':trib[f.caso.id]?'DECLARADA':'AUSENTE';
          f.falta=[];if(!f.contOk)f.falta.push('apertura contable sin aceptar');
          if(f.trib==='AUSENTE')f.falta.push('apertura tributaria sin declarar');else if(f.trib==='DECLARADA')f.falta.push('apertura tributaria declarada, falta verificarla');
          f.apertura=f.falta.length?'PENDIENTE':'LISTA';
        }else{f.apertura='SIN_CASO';f.falta=[];}
        calcPrio(f);
      });
      C.filas=filas;C.cargando=false;animarBarras();render();comprobarVigencias(tok);
    });
  }).catch(function(e){if(tok!==C.tok)return;C.cargando=false;C.error=e;render();});
}
/* Vigencia (VIGENTE / DESACTUALIZADA): solo la entrega la RPC del motor; se consulta de a 3 casos en paralelo */
function comprobarVigencias(tok){
  var cola=S.cart.filas.filter(function(f){return f.corrida&&!f.vig;}), i=0, act=0;
  function sig(){
    if(tok!==S.cart.tok)return;
    while(act<3&&i<cola.length)(function(f){act++;
      API.rpc('renta_e1_proyeccion_vigente',{p_caso_id:f.caso.id}).then(function(r){f.vig=(r&&r.estado)||'SIN_PROYECCION';},function(){f.vig='ERROR';})
        .then(function(){act--;calcPrio(f);repintarPronto();sig();});})(cola[i++]);
  }
  sig();
}
function repintarPronto(){clearTimeout(repintarPronto.t);repintarPronto.t=setTimeout(function(){if(S.vista==='cartera'&&!S.cart.cargando)renderCartera();},120);}
function calcPrio(f){
  var m=[];
  if(!f.corrida){f.prio='gris';}
  else{
    var p=f.saldo!=null&&f.saldo<=0&&f.cob==null?'verde':f.cob==null?'nd':nivelCob(f.cob);
    if(p==='nd')m.push('impuesto o PPM no disponible');
    if(f.cob!=null&&f.cob<UMBRAL.COB_ROJO)m.push('cobertura bajo '+Math.round(UMBRAL.COB_ROJO*100)+' %');
    if(f.saldo!=null&&f.saldo>=UMBRAL.SALDO_ALTO){p='rojo';m.push('saldo a pagar alto');}
    if(f.vig==='DESACTUALIZADA'){p='rojo';m.push('datos nuevos desde la última proyección');}
    f.prio=p;
  }
  f.motivos=m;
  // Sugerencia breve (solo orientación; no calcula impuestos)
  f.sug=!f.caso?'Sin caso de renta → crear el caso en la apertura de MiRenta':
    f.caso.regimen!=='14D3'?'Régimen '+f.caso.regimen+' → fuera del alcance de la proyección v1 (solo 14 D N°3)':
    f.apertura==='PENDIENTE'?'Apertura pendiente → completar apertura':
    f.vig==='DESACTUALIZADA'?'Datos nuevos → volver a proyectar':
    !f.corrida?'Sin proyección → calcular la proyección':
    (f.cob!=null&&f.cob<UMBRAL.COB_VERDE&&f.saldo!=null&&f.saldo>0)?'Cobertura baja → evaluar PPM voluntario':'';
}
function filasVisibles(){
  var C=S.cart, q=C.q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  var r=C.filas.filter(function(f){
    if(C.mis&&f.resp_id!==(S.yo&&S.yo.id))return false;
    if(q&&(f.nombre+' '+f.resp).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').indexOf(q)<0)return false;
    switch(C.filtro){
      case 'rojo':return f.prio==='rojo';
      case 'cobbaja':return f.cob!=null&&f.cob<UMBRAL.COB_ROJO;
      case 'apertura':return f.apertura==='PENDIENTE';
      case 'desact':return f.vig==='DESACTUALIZADA';
      case 'sinproy':return !f.corrida;
    }
    return true;
  });
  var nom=function(a,b){return a.nombre.localeCompare(b.nombre,'es');};
  var num=function(x,def){return x==null?def:x;};
  var cmp={
    prioridad:function(a,b){return SEMAFORO[a.prio][2]-SEMAFORO[b.prio][2]||num(b.saldo,-Infinity)-num(a.saldo,-Infinity)||nom(a,b);},
    saldo:function(a,b){return num(b.saldo,-Infinity)-num(a.saldo,-Infinity)||nom(a,b);},
    cobertura:function(a,b){return num(a.cob,Infinity)-num(b.cob,Infinity)||nom(a,b);},
    apertura:function(a,b){var o={PENDIENTE:0,SIN_CASO:1,LISTA:2};return o[a.apertura]-o[b.apertura]||nom(a,b);},
    fecha:function(a,b){var fa=a.corrida?a.corrida.finalizado_at:'9999', fb=b.corrida?b.corrida.finalizado_at:'9999';return fa<fb?-1:fa>fb?1:nom(a,b);},
    nombre:nom}[C.orden]||nom;
  return r.sort(cmp);
}
function totalesCartera(fs){
  var t={n:fs.length,proy:0,apPend:0,rojo:0,pagar:0,dev:0,sIdpc:0,sPpm:0,nCob:0,nSaldo:0,sinSaldo:0};
  fs.forEach(function(f){
    if(f.corrida)t.proy++;if(f.apertura==='PENDIENTE')t.apPend++;if(f.prio==='rojo')t.rojo++;
    if(f.saldo!=null){t.nSaldo++;if(f.saldo>0)t.pagar+=f.saldo;else if(f.saldo<0)t.dev+=-f.saldo;}else if(f.corrida)t.sinSaldo++;
    if(f.idpc!=null&&f.idpc>0&&f.ppm!=null){t.sIdpc+=f.idpc;t.sPpm+=f.ppm;t.nCob++;}
  });
  t.cob=t.sIdpc>0?t.sPpm/t.sIdpc:null;
  return t;
}
/* Llenado animado de las barras solo justo después de cargar (no en cada filtro o repintado) */
function animarBarras(){document.body.classList.add('mrc-animar');clearTimeout(animarBarras.t);animarBarras.t=setTimeout(function(){document.body.classList.remove('mrc-animar');},700);}
function visTop(){var m=document.querySelector('.mrp-modo');if(m)m.style.display=S.vista==='cartera'?'none':'';}
function renderCartera(){
  visTop();urlEstado();
  var C=S.cart, act=document.activeElement, enBusqueda=act&&act.id==='mrcBuscar', pos=enBusqueda?act.selectionStart:0;
  var h='<div class="mrc-cab"><div><h2 class="mrp-titulo">Cartera de <span>Renta</span></h2><p class="mrp-preg">Proyección de la renta de cada cliente: cuánto pagaría en abril, cuánto cubren sus PPM y qué falta.</p></div><span class="estado preliminar">Todo preliminar</span></div>';
  if(C.error){var t=textoError(C.error);
    app(h+(t==='MOTOR_NO_INSTALADO'?'<div class="aviso ambar">'+I('alerta','ic-amb')+'<span>El motor de proyección no está disponible en este ambiente. La cartera se mostrará cuando esté instalado.</span></div>'
      :'<div class="aviso rojo fuerte">'+I('alerta','ic-roj')+'<span>'+t+'</span> <button type="button" class="btn sec chico" data-act="recargar">Reintentar</button></div>'));return;}
  if(C.cargando){app(h+'<div class="aviso lila"><span class="mrp-spin"></span>Cargando la cartera de renta…</div>');return;}
  var fs=filasVisibles(), t=totalesCartera(fs), sinDato=t.sinSaldo?' · '+t.sinSaldo+' sin dato':'', pend=C.filas.some(function(f){return f.corrida&&!f.vig;});
  h+='<section class="mrc-tot" aria-label="Totales de la cartera">'
    +'<div class="mrc-k"><small>Clientes</small><b>'+t.n.toLocaleString('es-CL')+'</b><span>'+t.proy.toLocaleString('es-CL')+' con proyección</span></div>'
    +'<div class="mrc-k rojo"><small>En rojo</small><b>'+t.rojo.toLocaleString('es-CL')+'</b><span>para revisar primero</span></div>'
    +'<div class="mrc-k ambar"><small>Aperturas pendientes</small><b>'+t.apPend.toLocaleString('es-CL')+'</b><span>contable o tributaria</span></div>'
    +'<div class="mrc-k"><small>Impuesto total a pagar en abril</small><b>'+(t.nSaldo?clpT(t.pagar):'No disponible')+'</b><span>suma de saldos a pagar proyectados'+sinDato+'</span></div>'
    +'<div class="mrc-k verde"><small>Devolución total estimada</small><b>'+(t.nSaldo?clpT(t.dev):'No disponible')+'</b><span>clientes con PPM sobre el impuesto'+sinDato+'</span></div>'
    +'<div class="mrc-k ancho"><small>Cobertura ponderada de la cartera</small>'+barraCob(t.cob,t.pagar>0?t.pagar:null,false)+'<span>Σ PPM ÷ Σ impuesto proyectado de '+t.nCob.toLocaleString('es-CL')+' cliente'+(t.nCob===1?'':'s')+'</span></div>'
    +'</section>';
  h+='<div class="mrc-filtros"><label class="mrc-buscar"><span class="sr">Buscar cliente o responsable</span>'+I('lupa','ic-cel')+'<input type="search" id="mrcBuscar" placeholder="Buscar cliente o responsable…" value="'+esc(C.q)+'" autocomplete="off"></label>'
    +(S.yo&&S.yo.es_master?'<div class="g-seg mrc-seg" role="group" aria-label="Clientes"><button type="button" class="fb'+(C.mis?' on':'')+'" aria-pressed="'+C.mis+'" data-mis="1">Mis clientes</button><button type="button" class="fb'+(!C.mis?' on':'')+'" aria-pressed="'+!C.mis+'" data-mis="0">Todos</button></div>':'')
    +'<div class="g-seg mrc-seg" role="group" aria-label="Filtrar">'+FILTROS.map(function(x){var n=x[0]==='todos'?null:C.filas.filter(function(f){var g=C.filtro;C.filtro=x[0];var ok=filtroUno(f);C.filtro=g;return ok;}).length;
      return '<button type="button" class="fb'+(C.filtro===x[0]?' on':'')+'" aria-pressed="'+(C.filtro===x[0])+'" data-filtro="'+x[0]+'">'+esc(x[1])+(n!=null?' <b>'+n+'</b>':'')+'</button>';}).join('')+'</div>'
    +'<label class="mrc-orden"><span>Orden</span><select id="mrcOrden">'+ORDENES.map(function(x){return '<option value="'+x[0]+'"'+(C.orden===x[0]?' selected':'')+'>'+esc(x[1])+'</option>';}).join('')+'</select></label>'
    +'<button type="button" class="btn sec chico" data-act="cart-csv">'+I('descargar','ic-ver')+'Descargar cartera (Excel/CSV)</button></div>';
  if(pend)h+='<p class="mrc-nota"><span class="mrp-spin"></span>Comprobando si hay datos nuevos desde la última proyección…</p>';
  if(!fs.length)h+='<div class="aviso gris">'+I('info','ic-cel')+'<span>'+(C.filas.length?'Ningún cliente coincide con la búsqueda o el filtro.':'No hay clientes en tu cartera de MiRenta.')+'</span></div>';
  else h+='<div class="mrc-tabla-box"><table class="cmp mrc-tabla"><caption class="sr">Cartera de renta: una fila por cliente</caption><thead><tr><th scope="col">Cliente</th><th scope="col">Responsable</th><th scope="col">Última proyección</th><th scope="col" class="num">Saldo en abril</th><th scope="col">Cobertura del PPM</th><th scope="col">Apertura</th><th scope="col"><span class="sr">Acciones</span></th></tr></thead><tbody>'
    +fs.map(filaCartera).join('')+'</tbody></table></div>';
  h+='<p class="nota">Preliminar: cifras del motor e1-1 (proyección vigente de cada caso). Cobertura = PPM del año proyectado ÷ impuesto proyectado. Semáforo: rojo bajo '+Math.round(UMBRAL.COB_ROJO*100)+' %, saldo a pagar desde '+clpT(UMBRAL.SALDO_ALTO)+' o datos nuevos; ámbar entre '+Math.round(UMBRAL.COB_ROJO*100)+' y '+Math.round(UMBRAL.COB_VERDE*100)+' %; verde desde '+Math.round(UMBRAL.COB_VERDE*100)+' %. "No disponible" nunca se asume en $0.</p>';
  app(h);
  if(enBusqueda){var b=$('mrcBuscar');if(b){b.focus();try{b.setSelectionRange(pos,pos);}catch(e){}}}
}
function filtroUno(f){
  var C=S.cart;if(C.mis&&f.resp_id!==(S.yo&&S.yo.id))return false;
  switch(C.filtro){case 'rojo':return f.prio==='rojo';case 'cobbaja':return f.cob!=null&&f.cob<UMBRAL.COB_ROJO;case 'apertura':return f.apertura==='PENDIENTE';case 'desact':return f.vig==='DESACTUALIZADA';case 'sinproy':return !f.corrida;}
  return true;
}
function filaCartera(f){
  var sem=SEMAFORO[f.prio], id=f.cliente_id;
  var fecha=f.corrida?'<b>'+fFecha(f.corrida.finalizado_at)+'</b><small>datos al '+fFecha(f.corrida.cutoff_date)+'</small>':'<span class="nd">Sin proyección</span>';
  if(f.vig==='DESACTUALIZADA')fecha+='<span class="estado ambar mrc-chip">'+I('alerta','ic-amb')+'Datos nuevos desde la última proyección</span>';
  else if(f.vig==='ERROR')fecha+='<span class="estado gris mrc-chip">No se pudo comprobar si hay datos nuevos</span>';
  else if(f.vig==='CONGELADA')fecha+='<span class="estado gris mrc-chip">Congelada (caso en revisión o cerrado)</span>';
  var saldo=!f.corrida?'<span class="nd">—</span>':f.saldo==null?'<span class="nd">No disponible</span>':
    f.saldo<0?'<small class="t-verde">Devolución estimada</small><b class="t-verde">'+clpT(-f.saldo)+'</b>':
    '<small>'+(f.saldo>0?'A pagar':'Sin saldo')+'</small><b>'+clpT(f.saldo)+'</b>';
  var cob=!f.corrida?'<span class="nd">—</span>':'<div>'+barraCob(f.cob,f.saldo,false)+'<small class="mrc-ppm">PPM '+clpT(f.ppm)+' de '+clpT(f.idpc)+' de impuesto</small></div>';
  var ap=f.apertura==='LISTA'?'<span class="estado verde">'+I('check','ic-ver')+'Apertura lista</span>':f.apertura==='PENDIENTE'?'<span class="estado ambar">Apertura pendiente</span><small>'+esc(f.falta.join(' · '))+'</small>':'<span class="estado gris">Sin caso de renta</span>';
  var bot='<button type="button" class="btn chico'+(f.vig==='DESACTUALIZADA'?' mrc-destacar':'')+'" data-act="cart-proyectar" data-cli="'+id+'" aria-label="Proyectar '+esc(f.nombre)+'">'+I('flecha-der')+'Proyectar</button>';
  if(f.corrida)bot+='<span class="mrc-acc2"><button type="button" class="btn sec chico" data-act="cart-pdf" data-cli="'+id+'" aria-label="Descargar PDF de '+esc(f.nombre)+'" title="Descargar PDF (preliminar)">'+I('descargar','ic-ver')+'PDF</button>'
    +'<button type="button" class="btn sec chico" data-act="cart-enviar" data-cli="'+id+'" aria-label="Enviar al cliente '+esc(f.nombre)+'" title="Preparar envío al cliente (no envía nada solo)">'+I('enviar','ic-mor')+'Enviar</button></span>';
  return '<tr class="mrc-fila p-'+sem[0]+'">'
    +'<td data-l="Cliente"><div class="mrc-cli"><span class="mrc-sem '+sem[0]+'" title="'+esc(f.motivos.join(' · '))+'"><i aria-hidden="true"></i>'+sem[1]+'</span><b>'+esc(f.nombre)+'</b>'
      +(f.motivos.length?'<small class="mrc-mot">'+esc(f.motivos.join(' · '))+'</small>':'')+(f.sug?'<small class="mrc-sug">'+I('info','ic-cel')+esc(f.sug)+'</small>':'')+'<span class="estado preliminar mini">Preliminar</span></div></td>'
    +'<td data-l="Responsable">'+(f.resp?esc(f.resp):'<span class="nd">Sin asignar</span>')+'</td>'
    +'<td data-l="Última proyección"><div class="mrc-fecha">'+fecha+'</div></td>'
    +'<td data-l="Saldo en abril" class="num"><div class="mrc-saldo">'+saldo+'</div></td>'
    +'<td data-l="Cobertura del PPM">'+cob+'</td>'
    +'<td data-l="Apertura"><div class="mrc-ap">'+ap+'</div></td>'
    +'<td class="mrc-accs"><div class="mrc-accs-in">'+bot+'</div></td></tr>';
}
function filaPorCliente(id){return S.cart.filas.filter(function(f){return f.cliente_id===+id;})[0];}
/* Botón Proyectar: abre la Pantalla 2 o explica qué falta (nunca falla en silencio) */
function cartProyectar(id,pend){
  var f=filaPorCliente(id);if(!f)return;
  if(!f.caso)return modalInfo('Sin caso de renta · '+f.nombre,'<p>Este cliente todavía no tiene un caso de renta en MiRenta. Para proyectar se necesita crear el caso del año comercial y completar su apertura (contable y tributaria).</p>','<a class="btn" href="index.html">'+I('flecha-der')+'Ir a la apertura de MiRenta</a>');
  if(f.caso.regimen!=='14D3')return modalInfo('Régimen fuera del alcance · '+f.nombre,'<p>La proyección de esta versión (motor e1-1) es solo para Pro Pyme General (14 D N°3). Este caso está en régimen <b>'+esc(f.caso.regimen)+'</b>.</p>','');
  if(f.corrida||f.apertura==='LISTA')return abrirCaso(f.caso.id,pend);
  var puede=f.contOk;
  modalInfo('Falta completar la apertura · '+f.nombre,'<p>Antes de proyectar falta:</p><ul class="mrc-falta">'+f.falta.map(function(x){return '<li>'+esc(x)+'</li>';}).join('')+'</ul>'
    +(puede?'<p class="t2">El motor puede calcular igual con la apertura contable aceptada, pero los registros (RAI, SAC, REX) quedarán "No disponible" o sin verificar hasta completar la apertura tributaria.</p>':'<p class="t2">Sin la apertura contable aceptada el motor no puede proyectar.</p>'),
    '<a class="btn sec" href="index.html">Ir a la apertura</a>'+(puede?'<button type="button" class="btn" data-act="abrir-igual" data-caso="'+f.caso.id+'">Abrir la proyección igual</button>':''));
}
function abrirCaso(casoId,pend){
  var k=S.casos.filter(function(c){return c.id===+casoId;})[0];if(!k)return;
  cerrarModal();S.vista='caso';S.caso=k;S.sec='resumen';S.esc='base';S.pend=pend||null;
  try{history.pushState(null,'',location.pathname+'?'+(function(){var p=new URLSearchParams(location.search);p.set('caso',k.id);return p.toString();})());}catch(e){}
  window.scrollTo({top:0});cargarCaso();
}
function volverCartera(){S.vista='cartera';S.caso=null;S.v=null;S.pend=null;cerrarEjecutivo();window.scrollTo({top:0});cargarCartera();}
function trasCargarCaso(){
  var p=S.pend;S.pend=null;if(!p||!S.v||!S.v.corrida)return;
  if(p==='pdf'){abrirEjecutivo();toast(I('descargar','ic-ver')+' Revisa el resumen y pulsa <b>Descargar PDF</b>.');}
  else if(p==='enviar')accEnviar();
}
function modalInfo(titulo,cuerpo,botones){
  modal.cfg=null;
  $('mrModalCuerpo').innerHTML='<h3 id="mrModalTit">'+esc(titulo)+'</h3>'+cuerpo+'<div class="mrp-acciones fin"><button type="button" class="btn sec" data-m="no">Cerrar</button>'+(botones||'')+'</div>';
  pintarIconos($('mrModalCuerpo'));$('mrModal').hidden=false;$('mrMvelo').classList.add('on');
  setTimeout(function(){var f=$('mrModalCuerpo').querySelector('input,textarea,[data-m="no"]');if(f)f.focus();},30);
}
/* Descargar cartera: se arma en el navegador (CSV con ; y BOM para Excel en español). No se sube nada. */
function csvCelda(x){if(x==null)return '';if(typeof x==='number')return String(Math.round(x));var s=String(x);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[;"\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function descargarCartera(){
  var fs=filasVisibles(), hoy=new Date().toISOString().slice(0,10);
  var cab=['Prioridad','Motivo','Cliente','Responsable','Última proyección','Datos al','Vigencia','Impuesto proyectado (IDPC)','PPM del año','Cobertura PPM %','A pagar en abril','Devolución estimada','Apertura','Qué falta','Sugerencia','Estado'];
  var L=[cab.map(csvCelda).join(';')];
  fs.forEach(function(f){
    L.push([SEMAFORO[f.prio][1],f.motivos.join(' · '),f.nombre,f.resp||'Sin asignar',f.corrida?fFecha(f.corrida.finalizado_at):'Sin proyección',f.corrida?fFecha(f.corrida.cutoff_date):'',
      f.vig==='DESACTUALIZADA'?'Datos nuevos desde la última proyección':f.vig||'',
      f.corrida?(f.idpc==null?'No disponible':f.idpc):'',f.corrida?(f.ppm==null?'No disponible':f.ppm):'',
      f.cob==null?(f.corrida?'No disponible':''):(Math.round(f.cob*1000)/10).toString().replace('.',','),
      f.corrida?(f.saldo==null?'No disponible':(f.saldo>0?f.saldo:0)):'',f.saldo!=null&&f.saldo<0?-f.saldo:(f.corrida?(f.saldo!=null?0:'No disponible'):''),
      f.apertura==='LISTA'?'Apertura lista':f.apertura==='PENDIENTE'?'Apertura pendiente':'Sin caso de renta',f.falta.join(' · '),f.sug,'PRELIMINAR'].map(csvCelda).join(';'));
  });
  var blob=new Blob(['﻿'+L.join('\r\n')],{type:'text/csv;charset=utf-8'}), url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url;a.download='MiRenta_cartera_PRELIMINAR_'+hoy+'.csv';document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(url);a.remove();},500);
  toast(I('check','ic-ver')+' Cartera descargada ('+fs.length+' cliente'+(fs.length===1?'':'s')+', con los filtros actuales).');
}

/* ── Enviar al cliente (v1): SOLO prepara el envío. Descarga el PDF y abre un borrador (correo o WhatsApp) que el analista
   revisa, adjunta y envía a mano. Gestoor no envía nada por sí mismo. ── */
function textoEnvio(canal){
  var rs=nombreCaso(S.caso), c=fFecha(corte()), ac=S.caso.anio_comercial;
  if(canal==='wa')return 'Hola 👋 ¿cómo estás? Te compartimos la proyección preliminar de la renta de '+rs+' (año comercial '+ac+', contabilidad al '+c+'). Es una estimación para anticiparnos a abril; no es la declaración de renta y puede cambiar con los próximos cierres. Te adjuntamos el resumen en PDF. ¿Te parece si lo conversamos en una reunión breve? Como parte de nuestros servicios te ayudamos a revisar las opciones. Saludos, equipo Contadoor.';
  return 'Hola, ¿cómo estás?\n\nTe compartimos la proyección preliminar de la renta de '+rs+' para el año comercial '+ac+', con la contabilidad al '+c+'. Es una estimación para anticiparnos a abril y tomar decisiones a tiempo; no es la declaración de renta y puede cambiar con los próximos cierres.\n\nTe adjuntamos el resumen en PDF. Nos encantaría conversarlo contigo en una reunión breve: como parte de nuestros servicios te ayudamos a revisar las opciones antes del 31 de diciembre.\n\nQuedamos atentos.\nEquipo Contadoor';
}
function asuntoEnvio(){return 'Proyección preliminar de renta AT '+S.caso.anio_tributario+' · '+nombreCaso(S.caso);}
function accEnviar(){
  if(!S.v||!S.v.corrida){toast(I('alerta','ic-amb')+' Este caso no tiene una proyección para enviar.');return;}
  var cli=S.caso.cliente_id;
  // Contacto desde la ficha del cliente SOLO si la RLS deja verlo; si no, queda vacío para escribirlo
  API.get('clientes?select=email,wa&id=eq.'+cli).then(function(r){return (r&&r[0])||{};},function(){return {};}).then(function(c){
    var email=String(c.email||'').split(/[;,\s]+/)[0]||'', wa=String(c.wa||'');
    modalInfo('¿Enviar la proyección preliminar de '+nombreCaso(S.caso)+'?',
      '<p>Gestoor <b>no envía nada por sí mismo</b>. Primero guardas el PDF (marcado PRELIMINAR) y después se abre un borrador para que lo adjuntes y lo envíes tú.</p>'
      +'<div class="g-seg mrc-canal" role="radiogroup" aria-label="Canal"><label class="fb on"><input type="radio" name="mrcCanal" value="correo" checked>'+I('correo','ic-cel')+'Correo</label><label class="fb"><input type="radio" name="mrcCanal" value="wa">'+I('chat','ic-ver')+'WhatsApp</label></div>'
      +'<label class="mrp-campo" data-canal="correo"><span>Correo del cliente</span><input type="email" id="mrcEmail" value="'+esc(email)+'" placeholder="correo@cliente.cl" autocomplete="off"></label>'
      +'<label class="mrp-campo" data-canal="wa" hidden><span>WhatsApp del cliente</span><input type="tel" id="mrcWa" value="'+esc(wa)+'" placeholder="+56 9 …" autocomplete="off"></label>'
      +'<label class="mrp-campo"><span>Mensaje (puedes editarlo)</span><textarea id="mrcTexto" rows="7">'+esc(textoEnvio('correo'))+'</textarea></label>'
      +'<label class="mrc-check"><input type="checkbox" id="mrcConDet"> Incluir el detalle (determinación, registros y F22) en el PDF</label>'
      +'<p class="mrp-merr" id="mrMerr" role="alert"></p>',
      '<button type="button" class="btn" data-act="enviar-paso1">'+I('descargar')+'Sí, guardar PDF y preparar borrador</button>');
  });
}
function canalEnvio(){var r=document.querySelector('input[name="mrcCanal"]:checked');return r?r.value:'correo';}
function enviarPaso1(){
  var canal=canalEnvio(), texto=($('mrcTexto').value||'').trim(), email=($('mrcEmail').value||'').trim(), wa=($('mrcWa').value||'').replace(/[^\d]/g,'');
  if(canal==='correo'&&email&&!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)){$('mrMerr').textContent='Revisa el correo (o déjalo vacío para escribirlo en el borrador).';return;}
  if(canal==='wa'&&wa&&wa.length<8){$('mrMerr').textContent='Revisa el número de WhatsApp (o déjalo vacío para elegir el contacto).';return;}
  if(!texto){$('mrMerr').textContent='Escribe el mensaje.';return;}
  var href=canal==='correo'?'mailto:'+encodeURIComponent(email).replace(/%40/g,'@')+'?subject='+encodeURIComponent(asuntoEnvio())+'&body='+encodeURIComponent(texto)
    :'https://wa.me/'+wa+'?text='+encodeURIComponent(texto);
  var dDet=$('mrDocDet');if(dDet)dDet.checked=$('mrcConDet').checked;
  abrirEjecutivo();descargarPdf();
  modalInfo('Paso 2 · abre el borrador','<p>Si guardaste el PDF <b>'+esc(nombreArchivo())+'.pdf</b>, abre el borrador, adjunta el archivo y revisa el texto antes de enviarlo.</p><p class="t2">Nada se ha enviado. Si no guardaste el PDF, usa “Descargar PDF” de nuevo.</p>',
    '<button type="button" class="btn sec" data-act="pdf">'+I('descargar','ic-ver')+'Descargar PDF de nuevo</button><a class="btn" id="mrcBorrador" href="'+esc(href)+'"'+(canal==='wa'?' target="_blank" rel="noopener noreferrer"':'')+'>'+I(canal==='wa'?'chat':'correo')+'Abrir borrador de '+(canal==='wa'?'WhatsApp':'correo')+'</a>');
}

/* ── Eventos ── */
document.addEventListener('click',function(e){
  var m=e.target.closest('#mrModal [data-m]');if(m){if(m.getAttribute('data-m')==='si')confirmarModal();else cerrarModal();return;}
  var d=e.target.closest('[data-det]');if(d){e.preventDefault();abrirDet(d.getAttribute('data-det'));return;}
  var b=e.target.closest('[data-modo]');if(b){S.modo=b.getAttribute('data-modo');render();return;}
  var s=e.target.closest('[data-sec]');if(s){S.sec=s.getAttribute('data-sec');render();window.scrollTo({top:0});return;}
  var r=e.target.closest('[data-reg]');if(r){S.reg=r.getAttribute('data-reg');render();return;}
  var es=e.target.closest('[data-esc]');if(es){S.esc=es.getAttribute('data-esc');render();return;}
  var fl=e.target.closest('[data-filtro]');if(fl){S.cart.filtro=fl.getAttribute('data-filtro');renderCartera();return;}
  var mi=e.target.closest('[data-mis]');if(mi){S.cart.mis=mi.getAttribute('data-mis')==='1';renderCartera();return;}
  if(e.target.closest('#mrcBorrador')){setTimeout(cerrarModal,300);return;}
  var a=e.target.closest('[data-act]');if(!a||a.disabled)return;
  var act=a.getAttribute('data-act');
  if(act==='recargar'){S.error=null;if(S.vista==='cartera')cargarCartera();else if(S.caso)cargarCaso();else iniciar();}
  else if(act==='volver-cartera')volverCartera();
  else if(act==='cart-proyectar')cartProyectar(a.getAttribute('data-cli'));
  else if(act==='cart-pdf')cartProyectar(a.getAttribute('data-cli'),'pdf');
  else if(act==='cart-enviar')cartProyectar(a.getAttribute('data-cli'),'enviar');
  else if(act==='abrir-igual')abrirCaso(a.getAttribute('data-caso'));
  else if(act==='cart-csv')descargarCartera();
  else if(act==='pdf')descargarPdf();
  else if(act==='enviar')accEnviar();
  else if(act==='enviar-paso1')enviarPaso1();
  else if(act==='proyectar')accProyectar();
  else if(act==='nuevo-supuesto')accSupuesto();
  else if(act==='declarar-mes')accDeclararMes();
  else if(act==='revocar-mes')accRevocarMes(a.getAttribute('data-id'));
  else if(act==='marcar')accMarcar(a.getAttribute('data-asiento'),a.getAttribute('data-accion'),a.getAttribute('data-tipo'));
  else if(act==='ejecutivo')abrirEjecutivo();
  else if(act==='imprimir-sec')imprimir('sec');
  else if(act==='ver-cod'){S.verCod=!S.verCod;render();}
});
document.addEventListener('change',function(e){
  if(e.target.id==='mrCaso'){var id=+e.target.value;S.caso=S.casos.filter(function(c){return c.id===id;})[0];S.esc='base';cargarCaso();}
  else if(e.target.id==='mrcOrden'){S.cart.orden=e.target.value;renderCartera();}
  else if(e.target.id==='mrDocDet'&&!$('mrDoc').hidden)abrirEjecutivo();
  else if(e.target.name==='mrcCanal'){var c=canalEnvio();
    document.querySelectorAll('.mrc-canal .fb').forEach(function(l){l.classList.toggle('on',l.querySelector('input').checked);});
    document.querySelectorAll('#mrModal [data-canal]').forEach(function(x){x.hidden=x.getAttribute('data-canal')!==c;});
    $('mrcTexto').value=textoEnvio(c);}
});
window.addEventListener('popstate',function(){
  var id=+new URLSearchParams(location.search).get('caso');
  if(!id&&S.vista==='caso')volverCartera();
  else if(id&&S.vista==='cartera'&&S.casos.some(function(c){return c.id===id;})){S.vista='caso';S.caso=S.casos.filter(function(c){return c.id===id;})[0];cargarCaso();}
});
document.addEventListener('input',function(e){
  if(e.target.id==='mrcBuscar'){S.cart.q=e.target.value;renderCartera();return;}
  if(e.target.id==='mrFiltro'){S.filtroOut=e.target.value;var pos=e.target.selectionStart;render();var f=$('mrFiltro');if(f){f.focus();try{f.setSelectionRange(pos,pos);}catch(x){}}}
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){if(!$('mrModal').hidden)cerrarModal();else if(!$('mrDoc').hidden)cerrarEjecutivo();else if(!$('mrDet').hidden)cerrarDet();}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('tr[data-det]')){e.preventDefault();abrirDet(e.target.getAttribute('data-det'));}
});
document.addEventListener('DOMContentLoaded',function(){
  $('mrVelo').addEventListener('click',cerrarDet);$('mrDetCerrar').addEventListener('click',cerrarDet);
  $('mrDetAncho').addEventListener('click',function(){S.detAncho=!S.detAncho;$('mrDet').classList.toggle('ancho',S.detAncho);$('mrDetAncho').querySelector('span').textContent=S.detAncho?'Reducir':'Ampliar';});
  $('mrDetImp').addEventListener('click',function(){imprimir('det');});
  $('mrMvelo').addEventListener('click',cerrarModal);
  $('mrDocCerrar').addEventListener('click',cerrarEjecutivo);$('mrDocImp').addEventListener('click',descargarPdf);
  iniciar();
});
})();
