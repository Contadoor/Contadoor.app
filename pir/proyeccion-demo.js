/* ============================================================
   pir/proyeccion-demo.js — MODO DEMOSTRACIÓN LOCAL de la proyección MiRenta (E1-1)
   Empresas y cifras 100 % FICTICIAS, con la MISMA FORMA que entregan las RPC y tablas reales del motor
   (renta_e1_proyeccion_vigente, renta_motor_outputs, renta_e1_trazas_caja, renta_f22_layout_items, …).
   Montos ficticios: siguen las mismas fórmulas del motor, pero no corresponden a ningún cliente real.
   Solo lo carga proyeccion.html cuando la URL trae ?demo=1 Y el host es localhost / 127.0.0.1 / [::1].
   Nunca llama a Supabase: nada sale del navegador y nada se guarda.
   ============================================================ */
(function(){
  'use strict';
  var h=location.hostname;
  if(!(h==='localhost'||h==='127.0.0.1'||h==='[::1]'))return;   // candado 2: fuera de localhost no existe

  /* ── Parámetros (en producción salen SOLO de reglas ACTIVE; aquí ficticios para la demostración) ── */
  var TASA=12.5, F_NUM=12.5, F_DEN=87.5, E14_PCT=50, E14_TOPE_UF=5000;
  var UF_CIERRE={periodo:'2026-09',valor:41065.38,exacta:false};   // sin UF de diciembre aún → ESTIMADA
  var AC=2026, M=9, CORTE='2026-09-30';
  var seq=9000; function nid(){return ++seq;}
  function ahora(){return new Date().toISOString();}
  function hex(n){var s='';for(var i=0;i<64;i++)s+='0123456789abcdef'.charAt((n*7+i*13+((n*i)%11))%16);return s;}

  // Por defecto la demo entra como Master (ve toda la cartera y el filtro "Mis clientes / Todos"); ?rol=contable muestra la vista del analista.
  var YO=/(?:^|[?&])rol=contable(?:&|$)/.test(location.search.slice(1))?{id:901,es_master:false,rol:'contable'}:{id:901,es_master:true,rol:'master'};
  var CASOS=[
    {id:71,cliente_id:5001,anio_comercial:2026,anio_tributario:2027,regimen:'14D3',estado:'IN_PROGRESS',version:1},
    {id:72,cliente_id:5002,anio_comercial:2026,anio_tributario:2027,regimen:'14D3',estado:'DRAFT',version:1},
    {id:73,cliente_id:5003,anio_comercial:2026,anio_tributario:2027,regimen:'14D3',estado:'IN_PROGRESS',version:1},
    {id:74,cliente_id:5004,anio_comercial:2026,anio_tributario:2027,regimen:'14D3',estado:'IN_PROGRESS',version:1},
    {id:75,cliente_id:5005,anio_comercial:2026,anio_tributario:2027,regimen:'14D3',estado:'IN_PROGRESS',version:1},
    {id:76,cliente_id:5007,anio_comercial:2026,anio_tributario:2027,regimen:'14D3',estado:'IN_PROGRESS',version:1},
    {id:77,cliente_id:5008,anio_comercial:2026,anio_tributario:2027,regimen:'14A',estado:'DRAFT',version:1},
    {id:78,cliente_id:5006,anio_comercial:2026,anio_tributario:2027,regimen:'14D8',estado:'DRAFT',version:1}   // transparente: la liquidación muestra el aviso de la siguiente etapa
  ];
  // Cartera 100 % ficticia: nombres inventados, analistas genéricos y contactos en el dominio reservado .example
  function cli(id,rs,an,anId,email,wa){return {id:id,razon_social:rs,estado:'activo',tiene_contabilidad:true,analista_contable:an,analista_contable_usuario_id:anId,email:email,wa:wa};}
  var CLIENTES=[
    cli(5001,'Servicios Digitales Cordillera SpA','Analista Demo Uno',901,'contacto@cordillera.example','+56 9 0000 0001'),
    cli(5002,'Taller Creativo Pehuén SpA','Analista Demo Uno',901,'',''),
    cli(5003,'Ferretería Los Aromos Ltda.','Analista Demo Uno',901,'finanzas@losaromos.example',''),
    cli(5004,'Panadería Volcán Osorno SpA','Analista Demo Dos',902,'hola@volcanosorno.example','+56 9 0000 0004'),
    cli(5005,'Consultora Austral Norte SpA','Analista Demo Uno',901,'gerencia@australnorte.example',''),
    cli(5006,'Transportes Quebrada Verde SpA','Analista Demo Dos',902,'',''),
    cli(5007,'Estudio Arquitectura Mirador SpA','Analista Demo Dos',902,'estudio@mirador.example',''),
    cli(5008,'Viñedos Llanura Alta SpA','Analista Demo Uno',901,'',''),
    cli(5009,'Librería Demo Puerto Claro SpA','Analista Demo Tres',903,'',''),   // responsable ficticio sin foto → iniciales
    cli(5010,'Almacén Demo Río Seco EIRL',null,null,'','')                     // sin responsable asignado → "Sin asignar"
  ];
  // Filtro por responsable (assets/equipo.js): foto GENÉRICA para un analista ficticio; los demás muestran iniciales
  if(window.GEquipo)window.GEquipo.fotoDemo('Analista Demo Uno','../assets/equipo/demo-generica.svg');
  // Aperturas ficticias: tributaria (renta_aperturas) y aceptaciones de la apertura contable
  var APERTURAS=[{id:801,caso_id:71,estado:'OPENING_DECLARED_NOT_FULLY_RECONSTRUCTED'},{id:803,caso_id:73,estado:'OPENING_VERIFIED'},{id:804,caso_id:74,estado:'OPENING_VERIFIED'},
    {id:805,caso_id:75,estado:'OPENING_VERIFIED'},{id:806,caso_id:76,estado:'OPENING_VERIFIED'}];
  var ACEPTACIONES=[{id:811,caso_id:71,accion:'ACEPTAR'},{id:813,caso_id:73,accion:'ACEPTAR'},{id:814,caso_id:74,accion:'ACEPTAR'},{id:815,caso_id:75,accion:'ACEPTAR'},
    {id:816,caso_id:76,accion:'ACEPTAR'},{id:817,caso_id:72,accion:'ACEPTAR'},{id:818,caso_id:72,accion:'REVOCAR'}];

  /* ── Layout F22 14D3 · AT 2027 · v1 DRAFT (provisional), igual al script de consola del backend ── */
  var LAYOUT_ID=12;
  function P(c,g,o,s,r,rol){return {layout_id:LAYOUT_ID,codigo:c,glosa:g,recuadro:'BASE_IMPONIBLE_14D3',orden:o,signo:s,tipo:'PARTIDA',regla_calculo:r,rol_motor:rol||null,formula:null};}
  function T(c,g,o,t,f,rol){return {layout_id:LAYOUT_ID,codigo:c,glosa:g,recuadro:'BASE_IMPONIBLE_14D3',orden:o,signo:1,tipo:t,regla_calculo:'FORMULA',rol_motor:rol||null,formula:f.map(function(x){return {codigo:x[0],signo:x[1]};})};}
  function R(c,g,o){return {layout_id:LAYOUT_ID,codigo:c,glosa:g,recuadro:'REGISTROS_EMPRESARIALES',orden:o,signo:1,tipo:'REGISTRO',regla_calculo:'REGISTRO',rol_motor:null,formula:null};}
  var ITEMS=[
    P('1400','Ingresos del giro percibidos',10,1,'PERCIBIDO'),
    P('1817','Ingresos devengados en el ejercicio anterior y percibidos en el ejercicio',20,1,'PERCIBIDO_APERTURA'),
    P('1402','Otros ingresos percibidos',30,1,'PERCIBIDO'),
    P('1588','Ingresos exentos o no renta (fuera del alcance v1)',40,1,'NO_APLICA_V1'),
    T('1410','Total de ingresos',50,'TOTAL',[['1400',1],['1817',1],['1402',1],['1588',1]],'TOTAL_INGRESOS'),
    P('1409','Costo directo y gastos del giro pagados',60,-1,'PAGADO'),
    P('1818','Gastos devengados en el ejercicio anterior y pagados en el ejercicio',70,-1,'PAGADO_APERTURA'),
    P('1411','Remuneraciones pagadas',80,-1,'PAGADO'),
    P('1412','Honorarios pagados',90,-1,'PAGADO'),
    P('1413','Adquisición de bienes del activo inmovilizado pagados',100,-1,'ACTIVO_FIJO_PAGADO'),
    P('1415','Intereses pagados',110,-1,'PAGADO'),
    P('1419','Pérdidas del ejercicio (fuera del alcance v1)',120,-1,'NO_APLICA_V1'),
    P('1421','Gastos afectos al art. 21 (fuera del alcance v1: art21.efectos_rli sin certificar)',130,-1,'NO_APLICA_V1'),
    P('1422','Gastos rechazados no afectos al art. 21 (IDPC, intereses y multas)',140,-1,'DEVENGADO_NEUTRO','GASTOS_RECHAZADOS'),
    P('1424','Otros gastos pagados (gastos bancarios)',150,-1,'PAGADO'),
    P('1426','Pérdida tributaria de ejercicios anteriores',160,-1,'PERDIDA_ANTERIOR'),
    T('1430','Total de egresos',170,'TOTAL',[['1409',1],['1818',1],['1411',1],['1412',1],['1413',1],['1415',1],['1419',1],['1421',1],['1422',1],['1424',1],['1426',1]],'TOTAL_EGRESOS'),
    T('1431','Agregados: gastos rechazados no afectos al art. 21 (reverso del 1422)',180,'AJUSTE',[['1422',1]]),
    T('1729','Renta líquida imponible',190,'TOTAL',[['1410',1],['1430',-1],['1431',1]],'RLI'),
    P('1432','Rebaja por reinversión art. 14 E (solo simulación)',200,-1,'SIM_14E','REBAJA_14E'),
    P('1433','Otras rebajas (fuera del alcance v1)',210,-1,'NO_APLICA_V1'),
    T('1440','Base imponible',220,'TOTAL',[['1729',1],['1432',-1],['1433',-1]],'BASE_IMPONIBLE'),
    R('RAI','Registro RAI',300),R('SAC_1563','SAC no sujeto a restitución sin derecho a devolución (1563)',310),
    R('SAC_1564','SAC no sujeto a restitución con derecho a devolución (1564)',320),R('SAC_1565','SAC sujeto a restitución sin derecho a devolución (1565)',330),
    R('SAC_1566','SAC sujeto a restitución con derecho a devolución (1566)',340),R('SAC_1567','Crédito por IPE (1567)',350),
    R('REX','Registro REX',360),R('CPTS','Capital propio tributario simplificado',370)
  ];
  var ITEM={};ITEMS.forEach(function(i){ITEM[i.codigo]=i;});

  /* ── Datos de la empresa ficticia (ene–sep 2026): montos inventados, calculados con las mismas fórmulas del motor ── */
  var CTA={'110101':'Caja','110201':'Banco cuenta corriente','110401':'Clientes nacionales','210101':'Proveedores','210301':'Remuneraciones por pagar',
    '210116':'Leyes sociales por pagar','210117':'Impuesto único por pagar','210118':'Retención de honorarios por pagar','210121':'Impuestos por pagar (apertura)',
    '210401':'Honorarios por pagar','510190':'Gastos generales (IVA no recuperable)','510601':'Gastos bancarios','410101':'Ventas y servicios'};
  // Componentes del ACTUAL por código (trace.componentes, como los arma el motor)
  var COMP={
    '1400':[{fuente:'CUENTA_SALDADA',cuenta:'110401',monto:497692385,evidencia:'DECLARED_UNVERIFIED',calculo:'DETERMINADO'}],
    '1409':[{fuente:'CUENTA_SALDADA',cuenta:'210101',monto:51488770,evidencia:'DECLARED_UNVERIFIED',calculo:'DETERMINADO'},
            {fuente:'IVA_A_COSTO',cuenta:'510190',monto:1583349,evidencia:'DECLARED_UNVERIFIED',calculo:'DETERMINADO',notas:['ASIENTO:7728','APERTURA_IVA:1301491']}],
    '1411':[{fuente:'APERTURA_DECLARADA',cuenta:'210121',monto:109465,evidencia:'DECLARED_UNVERIFIED',calculo:'DETERMINADO',notas:['MARCA:311:IMPUESTO_UNICO']},
            {fuente:'CUENTA_SALDADA',cuenta:'210301',monto:164199987,evidencia:'DECLARED_UNVERIFIED',calculo:'DETERMINADO'},
            {fuente:'RETENCION_PAGADA',cuenta:'210116',monto:8592110,evidencia:'DECLARED_UNVERIFIED',calculo:'DETERMINADO',notas:['POR_PAGAR_AL_CORTE:4231920']},
            {fuente:'RETENCION_PAGADA',cuenta:'210117',monto:2054797,evidencia:'DECLARED_UNVERIFIED',calculo:'DETERMINADO',notas:['POR_PAGAR_AL_CORTE:411986']}],
    '1412':[{fuente:'CUENTA_SALDADA',cuenta:'210401',monto:34025967,evidencia:'DECLARED_UNVERIFIED',calculo:'DETERMINADO'},
            {fuente:'RETENCION_PAGADA',cuenta:'210118',monto:4586554,evidencia:'DECLARED_UNVERIFIED',calculo:'DETERMINADO',notas:['POR_PAGAR_AL_CORTE:788143']}],
    '1424':[{fuente:'CAJA_DIRECTA',cuenta:'510601',monto:439658,evidencia:'DECLARED_UNVERIFIED',calculo:'DETERMINADO'}]
  };
  var NEU_1422=26388329;              // IDPC pagado + intereses y multas (devengado neutro)
  // Base de meses normales (ACTUAL devengado sin anormales ni no recurrentes) y asientos excluidos del promedio
  var BASE={'1400':497692385,'1409':23730987,'1411':177581215,'1412':38754137,'1424':439658,'1422':0,'1402':0,'1413':0,'1415':0};
  var EXCL={'1409':[7712,7728]};
  var PPM_ACTUAL=13870211, PPM_NO_PAGADO=1863494, RETIROS=128918000;
  var APERTURA_TRIB={id:55,estado:'OPENING_DECLARED'};
  var REG_INI={rai:10949617,sac_1563:0,sac_1564:209054,sac_1565:0,sac_1566:0,sac_1567:0,rex:0,cpts:38186621};
  var AJUSTE_DIC={'1411':4643907,'1412':788143};

  /* ── renta_e1_output (misma lógica que la función SQL) ── */
  function rnd(n){return n==null?null:Math.round(n);}
  function out(key,nat,monto,evid,cert,calc,raz,trace,expl){
    raz=raz||[];
    var na=evid==='NOT_APPLICABLE', nd=calc==='NO_DETERMINADO'||monto==null;
    var estado=na?'NOT_APPLICABLE':nd?(raz.some(function(r){return r.indexOf('PARAM_NO_ACTIVA:')===0;})?'PARAM_UNAVAILABLE':'PENDING')
      :(calc==='DETERMINADO'&&(evid==='VERIFIED'||evid==='VERIFIED_ZERO')&&cert==='CERTIFIED')?'OK':'REVIEW';
    var ev=(na||nd)?'NA':nat!=='ACTUAL'?'FORECAST':((evid==='VERIFIED'||evid==='VERIFIED_ZERO')&&calc==='DETERMINADO')?'L1_DOCUMENTAL'
      :(evid==='DECLARED_UNVERIFIED'&&calc==='DETERMINADO')?'L2_RECONSTRUCTED':'L3_ASSUMPTION';
    var t=JSON.parse(JSON.stringify(trace||{}));
    t.dim={evidencia:(!na&&nd)?'SIN_EVIDENCIA':evid,naturaleza:nat,certificacion:cert,calculo:na?'NO_APLICA':monto==null?'NO_DETERMINADO':calc};
    return {output_key:key,periodo:null,origen:nat==='ACTUAL'?'ACTUAL':'FORECAST',monto:(na||nd)?null:rnd(monto),estado_dato:estado,evidence_level:ev,
      final_elegible:false,unknown_reasons:(!na&&nd&&!raz.length)?['NO_DETERMINADO']:raz,trace:t,explicacion:expl};
  }

  /* ── Motor simulado: arma TODOS los outputs de una corrida con las fórmulas de renta_e1_calcular_interno ── */
  function calcular(simRetiros){
    var CERT='DRAFT', O={}, lista=[];
    function pone(o){O[o.output_key]=o;}
    var act={}, fc={};
    ITEMS.forEach(function(i){
      if(i.tipo!=='PARTIDA')return;
      var c=i.codigo, r=i.regla_calculo, tr={regla_calculo:r,componentes:COMP[c]||[]}, monto, evid='DECLARED_UNVERIFIED', calc='DETERMINADO', raz=[];
      if(r==='SIM_14E'||r==='NO_APLICA_V1'){monto=null;evid='NOT_APPLICABLE';calc='NO_APLICA';raz=['FUERA_DE_ALCANCE_V1'];}
      else if(r==='DEVENGADO_NEUTRO'){monto=NEU_1422;tr.componentes=[];}
      else if(r==='PERDIDA_ANTERIOR'){monto=0;}
      else if(r==='PERCIBIDO_APERTURA'||r==='PAGADO_APERTURA'){monto=0;evid='VERIFIED_ZERO';}
      else monto=(COMP[c]||[]).reduce(function(s,x){return s+x.monto;},0);
      act[c]={monto:monto,evid:evid,calc:calc,raz:raz};
      tr.codigo=c;tr.tipo=i.tipo;tr.orden=i.orden;
      pone(out('actual.f22.'+c,'ACTUAL',monto,evid,CERT,calc,raz,tr,i.glosa));
      var fm, fe=evid, fcal='ESTIMADO', b=BASE[c]||0;
      if(evid==='NOT_APPLICABLE'){fm=null;fcal='NO_APLICA';}
      else if(['PERCIBIDO','PAGADO','ACTIVO_FIJO_PAGADO','DEVENGADO_NEUTRO'].indexOf(r)>=0)fm=monto+(12-M)*b/M;
      else fm=monto;
      fc[c]={monto:fm==null?null:Math.round(fm),evid:fe,calc:fcal,raz:raz};
      pone(out('forecast.f22.'+c,'FORECAST',fm,fe,CERT,fcal,raz,{actual:monto,base_normal:b,meses_base:M,meses_restantes:12-M,excluidos:EXCL[c]||[],metodo:'LINEAL_PROMEDIO_V1',codigo:c,tipo:i.tipo,orden:i.orden},i.glosa));
    });
    // Totales por fórmula, desde las partidas redondeadas
    [['ACTUAL',act,'actual'],['FORECAST',fc,'forecast']].forEach(function(z){
      var tab=z[1];
      ITEMS.filter(function(i){return i.tipo==='TOTAL'||i.tipo==='AJUSTE';}).sort(function(a,b){return a.orden-b.orden;}).forEach(function(i){
        var s=0;i.formula.forEach(function(f){var p=tab[f.codigo];if(p&&p.evid!=='NOT_APPLICABLE')s+=f.signo*Math.round(p.monto);});
        tab[i.codigo]={monto:s,evid:'DECLARED_UNVERIFIED',calc:z[0]==='ACTUAL'?'DETERMINADO':'ESTIMADO',raz:[]};
        pone(out(z[2]+'.f22.'+i.codigo,z[0],s,'DECLARED_UNVERIFIED',CERT,tab[i.codigo].calc,[],{formula:i.formula,codigo:i.codigo,tipo:i.tipo,orden:i.orden},i.glosa));
      });
    });
    var d=[];
    function D(k,nat,m,evid,calc,raz,tr,ex){d.push(out(k,nat,m,evid,CERT,calc,raz||[],tr||{},ex));}
    var aBase=act['1440'].monto, fBase=fc['1440'].monto, fRli=fc['1729'].monto, fRech=fc['1422'].monto;
    D('actual.retiros','ACTUAL',RETIROS,'DECLARED_UNVERIFIED','DETERMINADO',[],{lineas:[8801,8802,8803]},'Retiros pagados con caja/banco (E2)');
    D('forecast.retiros','FORECAST',RETIROS,'DECLARED_UNVERIFIED','ESTIMADO',[],{metodo:'FORECAST = ACTUAL; retiros adicionales solo por SIM'},'Retiros del año (base)');
    var ppmF=Math.round(PPM_ACTUAL*12/M);
    D('actual.ppm.imputable','ACTUAL',PPM_ACTUAL,'DECLARED_UNVERIFIED','DETERMINADO',[],{pagado_por_calce_f29:PPM_ACTUAL-PPM_NO_PAGADO,declarado_no_pagado:PPM_NO_PAGADO},'PPM imputable del año (por período tributario)');
    D('actual.ppm.declarado_no_pagado','ACTUAL',PPM_NO_PAGADO,'DECLARED_UNVERIFIED','DETERMINADO',[],{},'PPM declarado y no pagado al corte (informativo)');
    D('forecast.ppm.imputable','FORECAST',ppmF,'DECLARED_UNVERIFIED','ESTIMADO',[],{actual:PPM_ACTUAL,meses_base:M},'PPM imputable proyectado × 12 / meses base');
    var idA=Math.round(Math.max(aBase,0)*TASA/100), idF=Math.round(Math.max(fBase,0)*TASA/100);
    D('actual.idpc','ACTUAL',idA,'DECLARED_UNVERIFIED','DETERMINADO',[],{base:aBase,tasa:TASA},'IDPC = base imponible × tasa (regla idpc.tasa)');
    D('forecast.idpc','FORECAST',idF,'DECLARED_UNVERIFIED','ESTIMADO',[],{base:fBase,tasa:TASA},'IDPC proyectado');
    D('actual.saldo_abril','ACTUAL',idA-PPM_ACTUAL,'DECLARED_UNVERIFIED','DETERMINADO',[],{idpc:idA,ppm:PPM_ACTUAL},'Saldo de abril = IDPC − PPM');
    var salF=idF-ppmF;
    D('forecast.saldo_abril','FORECAST',salF,'DECLARED_UNVERIFIED','ESTIMADO',[],{idpc:idF,ppm:ppmF},'Saldo de abril proyectado');
    Object.keys(AJUSTE_DIC).forEach(function(k){D('forecast.ajuste_pagado_dic.'+k,'FORECAST',AJUSTE_DIC[k],'DECLARED_UNVERIFIED','ESTIMADO',[],
      {metodo:'por pagar al corte (último mes cerrado) como estimación de lo de diciembre, que no se paga en el año'},'Retenciones y cotizaciones de diciembre estimadas (ya incluidas en el forecast del código)');});
    var items={rai:'opening.rai',sac_1563:'opening.sac.no_sujeto_restitucion.sin_devolucion',sac_1564:'opening.sac.no_sujeto_restitucion.con_devolucion',
      sac_1565:'opening.sac.sujeto_restitucion.sin_devolucion',sac_1566:'opening.sac.sujeto_restitucion.con_devolucion',sac_1567:'opening.sac.ipe',rex:'opening.rex',cpts:'opening.cpts'};
    Object.keys(items).forEach(function(k){
      var na=['sac_1563','sac_1565','sac_1566','sac_1567'].indexOf(k)>=0;
      D('actual.registro.'+k+'_inicial','ACTUAL',na?0:REG_INI[k],'DECLARED_UNVERIFIED','DETERMINADO',[],{item:items[k],apertura_id:APERTURA_TRIB.id,estado_item:na?'NOT_APPLICABLE':'OK'},'Saldo inicial desde la apertura tributaria');
    });
    var rai=REG_INI.rai, sac=REG_INI.sac_1564;
    D('forecast.registro.rai_final','FORECAST',rai+fBase-idF-RETIROS,'DECLARED_UNVERIFIED','ESTIMADO',[],
      {rai_inicial:rai,base:fBase,idpc:idF,retiros_imputados:RETIROS,simplificacion:'v1: retiros imputados solo al RAI; sin exceso; sin 14 A ni créditos con restitución'},'RAI final proyectado');
    var cred=Math.min(Math.round(RETIROS*F_NUM/F_DEN),sac+idF);
    D('forecast.registro.credito_asignado','FORECAST',cred,'DECLARED_UNVERIFIED','ESTIMADO',[],
      {retiros:RETIROS,factor:{numerador:F_NUM,denominador:F_DEN},sac_disponible:sac+idF},'Crédito asignado a los retiros (tope SAC 1564)');
    D('forecast.registro.sac_1564_final','FORECAST',sac+idF-cred,'DECLARED_UNVERIFIED','ESTIMADO',[],{sac_inicial:sac,idpc:idF,credito_asignado:cred},'SAC 1564 final proyectado');
    ['sac_1563','sac_1565','sac_1566','sac_1567','rex'].forEach(function(k){
      D('forecast.registro.'+k+'_final','FORECAST',k==='rex'?REG_INI.rex:0,'DECLARED_UNVERIFIED','ESTIMADO',[],{movimientos_v1:'sin movimientos'},'Saldo final (v1: igual al inicial)');});
    D('forecast.registro.cpts_final','FORECAST',null,'SIN_EVIDENCIA','NO_DETERMINADO',['FUERA_DE_ALCANCE_V1'],{},'CPTS final: fuera del alcance v1');
    var rinv=fRli-fRech-RETIROS;
    D('sim.e14.rli_invertida','SIM',rinv,'DECLARED_UNVERIFIED','ESTIMADO',[],{rli:fRli,gastos_rechazados:fRech,retiros:RETIROS},'SIM 14 E · RLI invertida');
    var ded=Math.round(Math.max(0,Math.min(rinv*E14_PCT/100,E14_TOPE_UF*UF_CIERRE.valor)));
    D('sim.e14.deduccion','SIM',ded,'DECLARED_UNVERIFIED','ESTIMADO',[],{porcentaje:E14_PCT,tope_uf:E14_TOPE_UF,uf:UF_CIERRE},'SIM 14 E · deducción');
    var i14=Math.round(Math.max(fBase-ded,0)*TASA/100);
    D('sim.e14.idpc','SIM',i14,'DECLARED_UNVERIFIED','ESTIMADO',[],{base:fBase,deduccion:ded},'SIM 14 E · IDPC');
    D('sim.e14.saldo_abril','SIM',i14-ppmF,'DECLARED_UNVERIFIED','ESTIMADO',[],{},'SIM 14 E · saldo de abril');
    D('sim.ppm_voluntario.cuota_mensual','SIM',salF<=0?0:Math.round(salF/(12-M)),'DECLARED_UNVERIFIED','ESTIMADO',[],{saldo_abril:salF,meses_restantes:12-M},'SIM PPM voluntario · cuota mensual');
    (simRetiros||[]).forEach(function(s,ix){
      var p='sim.retiro_adicional.s'+(ix+1)+'.', y=RETIROS+s.monto, noFut=s.mes<=M, rz=noFut?['MES_RETIRO_NO_FUTURO']:[];
      var ok=!noFut&&!(fBase<0||y>rai+fBase-idF);
      D(p+'retiros','SIM',noFut?null:y,'DECLARED_UNVERIFIED',noFut?'NO_DETERMINADO':'ESTIMADO',rz,{monto_adicional:s.monto,mes:s.mes},'SIM retiro adicional · retiros del año');
      var rz2=noFut?rz:(ok?[]:['RETIROS_EXCEDEN_RAI']);
      D(p+'rai_final','SIM',ok?rai+fBase-idF-y:null,'DECLARED_UNVERIFIED',ok?'ESTIMADO':'NO_DETERMINADO',rz2,{},'SIM retiro adicional · RAI final');
      var cr=ok?Math.min(Math.round(y*F_NUM/F_DEN),sac+idF):null;
      D(p+'credito_asignado','SIM',cr,'DECLARED_UNVERIFIED',ok?'ESTIMADO':'NO_DETERMINADO',rz2,{},'SIM retiro adicional · crédito asignado');
      D(p+'sac_1564_final','SIM',ok?sac+idF-cr:null,'DECLARED_UNVERIFIED',ok?'ESTIMADO':'NO_DETERMINADO',rz2,{},'SIM retiro adicional · SAC 1564 final');
      var dd=noFut?null:Math.round(Math.max(0,Math.min((fRli-fRech-y)*E14_PCT/100,E14_TOPE_UF*UF_CIERRE.valor)));
      D(p+'deduccion_14e','SIM',dd,'DECLARED_UNVERIFIED',noFut?'NO_DETERMINADO':'ESTIMADO',rz,{},'SIM retiro adicional · deducción 14 E');
      D(p+'idpc_14e','SIM',noFut?null:Math.round(Math.max(fBase-dd,0)*TASA/100),'DECLARED_UNVERIFIED',noFut?'NO_DETERMINADO':'ESTIMADO',rz,{},'SIM retiro adicional · IDPC con 14 E');
    });
    // Orden de inserción del motor: partidas y totales (nat, orden) y luego los derivados por clave
    var f22=Object.keys(O).map(function(k){return O[k];}).sort(function(a,b){
      if(a.origen!==b.origen)return a.origen<b.origen?-1:1;return a.trace.orden-b.trace.orden;});
    d.sort(function(a,b){return a.output_key<b.output_key?-1:1;});
    lista=f22.concat(d);
    lista.forEach(function(o,ix){o.id=ix+1;});
    return lista;
  }

  /* ── Trazas de caja (A9) y líneas del Diario de caja/banco: mes a mes por código ── */
  var PESOS={'1400':[0.6,1.3,1.0,0.98,1.05,1.02,1.1,1.36,1.3],'1409':[0.7,0.8,0.9,0.85,0.95,0.9,4.6,1.0,0.95],'1411':[0.9,0.95,1.0,1.0,1.05,1.0,1.4,1.0,1.35],
    '1412':[0.8,1.0,1.0,1.1,1.0,1.05,1.0,1.05,1.0],'1424':[1,1,1,1.1,1,1,1.05,1,1.1]};
  var ROL={'1400':'COBRO:CXC','1409':'PAGO:CXP','1411':'PAGO:CXP','1412':'PAGO:CXP','1424':'PAGO:GASTO'};
  var TRAZAS=[], LINEAS=[], lid=50000;
  Object.keys(COMP).forEach(function(cod){
    COMP[cod].forEach(function(cm){
      var w=PESOS[cod], sw=w.reduce(function(a,b){return a+b;},0), acum=0;
      var esRet=cm.fuente==='RETENCION_PAGADA'||cm.fuente==='APERTURA_DECLARADA';
      w.forEach(function(x,i){
        if(cm.fuente==='APERTURA_DECLARADA'&&i>0)return;
        var m=cm.fuente==='APERTURA_DECLARADA'?cm.monto:(i===8?cm.monto-acum:Math.round(cm.monto*x/sw));acum+=m;
        if(m<=0)return;
        lid++;var caja=(i%3===0)?'110101':'110201', mes=('0'+(i+1)).slice(-2);
        LINEAS.push({id:lid,asiento_id:7000+lid%500,fecha:AC+'-'+mes+'-'+(esRet?'12':'25'),cuenta_codigo:caja,cuenta_nombre:CTA[caja]});
        TRAZAS.push({corrida_id:null,lid:lid,cuenta_caja:caja,componente:(esRet?'F29:L':'L')+lid,rol:esRet?'PAGO:F29_'+(cm.cuenta==='210116'?'SOCIAL_SECURITY_PAYABLE':'WITHHOLDING_PAYABLE'):ROL[cod],
          cuenta_contra:cm.cuenta,codigo_f22:cod,monto:m,evidencia:'DECLARED_UNVERIFIED'});
      });
    });
  });
  var ASIENTOS=[{id:7712,numero:212,glosa:'Servicios de terceros · implementación de proyecto (julio)',fecha:'2026-07-31'},
    {id:7728,numero:228,glosa:'Ajuste de créditos IVA a costo',fecha:'2026-07-31'},{id:7741,numero:241,glosa:'Compra de licencias anuales',fecha:'2026-08-29'}];

  /* ── Estado de la demostración ── */
  var SUP=[{id:41,caso_id:71,cliente_id:5001,version:1,naturaleza:'ASSUMPTION',forecast_method:'MANUAL',parameters:{metodo:'LINEAL_PROMEDIO_V1'},
    parameters_hash:hex(41),motivo:'Proyección lineal sobre el promedio de meses normales',estado:'ACTIVE',creado_at:'2026-10-19T12:10:00Z',activado_at:'2026-10-19T12:11:00Z'}];
  var MESES=[], MARCAS=[{id:301,caso_id:71,cliente_id:5001,asiento_id:7712,cuenta_codigo:null,tipo:'ANORMAL',accion:'CONFIRMADA',monto:null,componente:null,
      motivo:'Gasto puntual de julio: no marca tendencia',creado_at:'2026-10-19T12:00:00Z'},
    {id:302,caso_id:71,cliente_id:5001,asiento_id:7728,cuenta_codigo:null,tipo:'NO_RECURRENTE',accion:'CONFIRMADA',monto:null,componente:null,motivo:'Ajuste de créditos: no recurrente',creado_at:'2026-10-19T12:01:00Z'}];
  var ST={71:{corrida:3101,outputs:null,estado:'VIGENTE',cambios:[],sugerido:true},72:{corrida:null},
    // Demás clientes de la cartera: la misma corrida ficticia escalada (factor) y con otra cobertura del PPM (cob)
    73:{corrida:3103,estado:'VIGENTE',cambios:[],factor:0.42,cob:0.82,fin:'2026-10-18T15:40:00Z'},
    74:{corrida:3104,estado:'VIGENTE',cambios:[],factor:0.18,cob:1.12,fin:'2026-10-17T11:05:00Z'},
    75:{corrida:3105,estado:'DESACTUALIZADA',cambios:['movimientos'],factor:0.30,cob:0.93,fin:'2026-10-02T09:30:00Z'},
    76:{corrida:3106,estado:'VIGENTE',cambios:[],factor:0.25,cob:0.96,fin:'2026-10-20T17:20:00Z'},
    77:{corrida:null},78:{corrida:null}};
  function simsActivas(caso){var s=SUP.filter(function(x){return x.caso_id===caso&&x.estado==='ACTIVE';})[0];return s&&s.parameters.sim_retiros_adicionales||[];}
  // Escala montos y fija la cobertura del PPM pedida, manteniendo saldo = IDPC − PPM y la cuota de PPM voluntario = saldo / meses restantes
  function escalar(base,f,cob){
    var O=JSON.parse(JSON.stringify(base)), by={};
    O.forEach(function(o){by[o.output_key]=o;if(o.monto!=null&&!/ppm|saldo_abril/.test(o.output_key))o.monto=Math.round(o.monto*f);});
    function set(k,v){if(by[k]&&v!=null)by[k].monto=Math.round(v);}
    // IDPC = round(máx(base escalada, 0) × tasa / 100), como el motor; trace con la base y la tasa usadas
    var fB=by['forecast.f22.1440'].monto, aB=by['actual.f22.1440'].monto;
    set('forecast.idpc',Math.max(fB,0)*TASA/100);set('actual.idpc',Math.max(aB,0)*TASA/100);
    by['forecast.idpc'].trace.base=fB;by['actual.idpc'].trace.base=aB;
    var idF=by['forecast.idpc'].monto, idA=by['actual.idpc'].monto, ppmF=Math.round(idF*cob), ppmA=Math.round(ppmF*M/12);
    set('forecast.ppm.imputable',ppmF);set('actual.ppm.imputable',ppmA);
    if(by['actual.ppm.declarado_no_pagado'])set('actual.ppm.declarado_no_pagado',by['actual.ppm.declarado_no_pagado'].monto*f);
    set('forecast.saldo_abril',idF-ppmF);set('actual.saldo_abril',idA-ppmA);   // saldo = IDPC − PPM exacto (montos ya redondeados)
    by['forecast.saldo_abril'].trace.idpc=idF;by['forecast.saldo_abril'].trace.ppm=ppmF;
    set('sim.ppm_voluntario.cuota_mensual',Math.max(0,idF-ppmF)/(12-M));
    if(by['sim.e14.idpc']&&by['sim.e14.deduccion']&&by['sim.e14.deduccion'].monto!=null){
      set('sim.e14.idpc',Math.max(fB-by['sim.e14.deduccion'].monto,0)*TASA/100);by['sim.e14.idpc'].trace.base=fB;by['sim.e14.idpc'].trace.deduccion=by['sim.e14.deduccion'].monto;
      set('sim.e14.saldo_abril',by['sim.e14.idpc'].monto-ppmF);
    }
    return O;
  }
  function recalcular(caso){var st=ST[caso];var b=calcular(simsActivas(caso));return st.factor?escalar(b,st.factor,st.cob):b;}
  ST[71].outputs=calcular(simsActivas(71));
  [73,74,75,76].forEach(function(k){ST[k].outputs=recalcular(k);});
  function alertas(caso){
    var a=[{codigo:'RESULTADO_PRELIMINAR',detalle:'e1-1 nunca entrega FINAL'},{codigo:'MOTOR_LOGICA_NO_CERTIFICADA',detalle:'reglas de cálculo M1–M15 sin certificación del Master'},
      {codigo:'LAYOUT_NO_CERTIFICADO',detalle:'códigos provisionales'},
      {codigo:'UF_CIERRE_ESTIMADA',periodo:'2026-09'}];
    var st=ST[caso];if(!st.factor||st.cob<0.5)a.push({codigo:'PPM_COBERTURA_BAJA',detalle:'cobertura bajo 50 % del IDPC proyectado'});
    if(!APERTURAS.some(function(x){return x.caso_id===caso&&x.estado==='OPENING_VERIFIED';}))a.push({codigo:'APERTURA_TRIBUTARIA_NO_VERIFICADA'});
    MARCAS.forEach(function(m){if(m.caso_id!==caso)return;if(m.tipo==='ANORMAL'||m.tipo==='NO_RECURRENTE'){var ult=MARCAS.filter(function(x){return x.asiento_id===m.asiento_id&&x.tipo===m.tipo;}).pop();
      if(ult===m&&m.accion!=='REVERTIDA')a.push({codigo:m.tipo,asiento_id:m.asiento_id,accion:m.accion});}});
    if(ST[caso].sugerido)a.push({codigo:'ANORMAL_SUGERIDO',asiento_id:7741,categoria:'SOFTWARE_EXPENSE',detalle:'AUTO:7190500>3x905200'});
    return a.sort(function(x,y){return JSON.stringify(x)<JSON.stringify(y)?-1:1;});
  }
  function corridaDe(caso){
    var st=ST[caso];
    return {id:st.corrida,motor:'T1_RLI_14D3',engine_version:'e1-1@1.0.0',cutoff_date:CORTE,resultado_estado:'PRELIMINARY',final_bloqueos:alertas(caso),
      input_hash:hex(st.corrida),ruleset_hash:hex(st.corrida+1),layout:{id:LAYOUT_ID,hash:hex(LAYOUT_ID),estado:'DRAFT'},
      supuesto_forecast_id:(SUP.filter(function(x){return x.caso_id===caso&&x.estado==='ACTIVE';})[0]||{}).id||null,finalizado_at:st.fin||'2026-10-19T12:15:08Z'};
  }
  function desactualizar(caso,motivo){var st=ST[caso];if(!st||!st.corrida)return;st.estado='DESACTUALIZADA';if(st.cambios.indexOf(motivo)<0)st.cambios.push(motivo);}

  /* ── Errores con la forma de PostgREST ── */
  function err(code,msg,status){var e=new Error(msg);e.mr={code:code,message:msg,status:status||400};return e;}
  function ok(v){return new Promise(function(res){setTimeout(function(){res(JSON.parse(JSON.stringify(v)));},90);});}
  function falla(e){return new Promise(function(res,rej){setTimeout(function(){rej(e);},90);});}
  function motivoOk(m){return m&&String(m).trim().length>0;}
  function casoDe(id){return CASOS.filter(function(c){return c.id===+id;})[0];}

  /* ── Lectura de tablas (subconjunto de la sintaxis PostgREST que usa la pantalla) ── */
  function q(path){
    var i=path.indexOf('?'), tabla=i<0?path:path.slice(0,i), qs=i<0?'':path.slice(i+1), f={};
    qs.split('&').forEach(function(p){var k=p.split('=')[0], v=decodeURIComponent(p.slice(k.length+1));if(k)f[k]=v;});
    return {tabla:tabla,f:f};
  }
  function eq(f,k){return f[k]&&f[k].indexOf('eq.')===0?f[k].slice(3):null;}
  function inn(f,k){return f[k]&&f[k].indexOf('in.(')===0?f[k].slice(4,-1).split(',').map(Number):null;}
  function get(path){
    var r=q(path), f=r.f, t=r.tabla;
    if(t==='renta_casos')return ok(CASOS.filter(function(c){return c.estado!=='RECTIFIED'&&(!eq(f,'regimen')||c.regimen===eq(f,'regimen'));}));
    if(t==='clientes'){
      var ids=inn(f,'id'), uno=eq(f,'id'), cols=(f.select||'id,razon_social').split(',');
      var lista=CLIENTES.filter(function(c){return uno?c.id===+uno:ids?ids.indexOf(c.id)>=0:true;});
      return ok(lista.map(function(c){var r={};cols.forEach(function(k){r[k]=c[k];});return r;}));}
    if(t==='renta_motor_corridas'){
      return ok(CASOS.filter(function(c){return ST[c.id]&&ST[c.id].corrida;}).map(function(c){var st=ST[c.id];
        return {id:st.corrida,caso_id:c.id,cliente_id:c.cliente_id,cutoff_date:CORTE,finalizado_at:st.fin||'2026-10-19T12:15:08Z',resultado_estado:'PRELIMINARY'};}));}
    if(t==='renta_aperturas'){var ca=inn(f,'caso_id')||[];return ok(APERTURAS.filter(function(x){return ca.indexOf(x.caso_id)>=0&&x.estado!=='SUPERSEDED';}));}
    if(t==='renta_apertura_contable_aceptaciones'){var cc=inn(f,'caso_id')||[];return ok(ACEPTACIONES.filter(function(x){return cc.indexOf(x.caso_id)>=0;}).sort(function(a,b){return a.id-b.id;}));}
    if(t==='renta_motor_outputs'&&inn(f,'corrida_id')){
      var cids=inn(f,'corrida_id'), keys=f.output_key&&f.output_key.indexOf('in.(')===0?f.output_key.slice(4,-1).split(',').map(function(k){return k.replace(/^"|"$/g,'');}):null, res=[];
      Object.keys(ST).forEach(function(k){var st=ST[k];if(st.corrida&&cids.indexOf(st.corrida)>=0)st.outputs.forEach(function(o){
        if(!keys||keys.indexOf(o.output_key)>=0)res.push({corrida_id:st.corrida,output_key:o.output_key,monto:o.monto,estado_dato:o.estado_dato});});});
      return ok(res);}
    if(t==='renta_motor_outputs'){var cid=+eq(f,'corrida_id');var c=Object.keys(ST).map(function(k){return ST[k];}).filter(function(s){return s.corrida===cid;})[0];
      return ok(c?c.outputs.map(function(o){return {output_key:o.output_key,trace:o.trace,unknown_reasons:o.unknown_reasons,explicacion:o.explicacion};}):[]);}
    if(t==='renta_f22_layout_items')return ok(+eq(f,'layout_id')===LAYOUT_ID?ITEMS:[]);
    if(t==='renta_e1_trazas_caja'){var cod=eq(f,'codigo_f22');return ok(TRAZAS.filter(function(x){return !cod||x.codigo_f22===cod;}).map(function(x){var y=JSON.parse(JSON.stringify(x));y.corrida_id=+eq(f,'corrida_id');return y;}));}
    if(t==='renta_lineas_diario'){var l=inn(f,'id')||[];return ok(LINEAS.filter(function(x){return l.indexOf(x.id)>=0;}));}
    if(t==='renta_asientos'){var a=inn(f,'id')||[];return ok(ASIENTOS.filter(function(x){return a.indexOf(x.id)>=0;}));}
    if(t==='renta_meses_declarados')return ok(MESES.filter(function(x){return x.caso_id===+eq(f,'caso_id');}));
    if(t==='renta_e1_marcas')return ok(MARCAS.filter(function(x){return x.caso_id===+eq(f,'caso_id');}));
    if(t==='renta_supuestos_forecast')return ok(SUP.filter(function(x){return x.caso_id===+eq(f,'caso_id');}).sort(function(a,b){return b.version-a.version;}));
    return falla(err('PGRST205','DEMO: tabla no simulada '+t,404));
  }

  /* ── RPC del motor (mismas firmas que las reales) ── */
  function rpc(fn,a){
    a=a||{};
    if(fn==='renta_yo')return ok([YO]);
    if(fn==='renta_e1_proyeccion_vigente'){
      var c=casoDe(a.p_caso_id);if(!c)return falla(err('42501','RENTA_SIN_PERMISO: no autorizado',403));
      var st=ST[c.id];if(!st.corrida)return ok({estado:'SIN_PROYECCION'});
      return ok({estado:st.estado,motivo:null,cambios:st.cambios,corrida:corridaDe(c.id),
        outputs:st.outputs.map(function(o){return {output_key:o.output_key,origen:o.origen,monto:o.monto,estado_dato:o.estado_dato,evidence_level:o.evidence_level,
          unknown_reasons:o.unknown_reasons,dim:o.trace.dim,explicacion:o.explicacion};})});
    }
    if(fn==='renta_e1_proyectar'){
      var k=casoDe(a.p_caso_id);if(!k)return falla(err('42501','RENTA_SIN_PERMISO: no autorizado para proyectar este caso',403));
      if(!/^\d{4}-\d{2}-\d{2}$/.test(a.p_corte||''))return falla(err('22023','CASO_INVALIDO: el corte debe pertenecer al AC 2026'));
      if(k.id===72)return falla(err('22023','APERTURA_CONTABLE_INVALIDA: la apertura contable fue revocada'));
      if(!ST[k.id])return falla(err('22023','CASO_INVALIDO: régimen fuera del alcance de e1-1'));
      if(a.p_corte>CORTE)return falla(err('22023','CORTE_INVALIDO: el Balance AC no cubre hasta el corte (cubre hasta '+CORTE+')'));
      if(a.p_corte!==CORTE)return falla(err('22023','DEMO_SOLO_SEPTIEMBRE: en la demostración solo existe la contabilidad al 30-09-2026'));
      var s=ST[k.id];
      if(s.estado==='VIGENTE')return ok({corrida_id:s.corrida,estado:'OK',reutilizada:true,input_hash:hex(s.corrida)});
      var prev=s.corrida;s.corrida=nid();s.outputs=recalcular(k.id);s.estado='VIGENTE';s.cambios=[];s.fin=ahora();
      return ok({corrida_id:s.corrida,estado:'OK',reutilizada:false,resultado:'PRELIMINARY',n_outputs:s.outputs.length,supersede_a:prev,input_hash:hex(s.corrida)});
    }
    if(fn==='renta_supuesto_forecast_crear'){
      if(!casoDe(a.p_caso_id))return falla(err('42501','No autorizado para operar este caso',403));
      if(['RUN_RATE_3M','PRIOR_YEAR_SEASONAL','MANUAL','NONE'].indexOf(a.p_metodo)<0)return falla(err('22023','Método de forecast inválido'));
      if(!a.p_parametros||typeof a.p_parametros!=='object')return falla(err('22023','Los parámetros del supuesto deben ser un objeto JSON'));
      if(!motivoOk(a.p_motivo))return falla(err('22023','El supuesto exige un motivo'));
      var v=SUP.filter(function(x){return x.caso_id===+a.p_caso_id;}).reduce(function(m,x){return Math.max(m,x.version);},0)+1;
      var n={id:nid(),caso_id:+a.p_caso_id,cliente_id:casoDe(a.p_caso_id).cliente_id,version:v,naturaleza:'ASSUMPTION',forecast_method:a.p_metodo,parameters:a.p_parametros,
        parameters_hash:hex(v+77),motivo:String(a.p_motivo).trim(),estado:'DRAFT',creado_at:ahora()};
      SUP.push(n);return ok({id:n.id,version:n.version,estado:n.estado,parameters_hash:n.parameters_hash});
    }
    if(fn==='renta_supuesto_forecast_activar'){
      var sp=SUP.filter(function(x){return x.id===+a.p_supuesto_id;})[0];
      if(!sp)return falla(err('42501','No autorizado para operar este caso',403));
      if(!motivoOk(a.p_motivo))return falla(err('22023','Activar un supuesto exige un motivo'));
      if(sp.estado!=='DRAFT')return falla(err('22023','Solo se activa un supuesto DRAFT (está '+sp.estado+')'));
      var pv=SUP.filter(function(x){return x.caso_id===sp.caso_id&&x.estado==='ACTIVE';})[0];
      var simr=sp.parameters.sim_retiros_adicionales;
      if(sp.forecast_method!=='MANUAL'||sp.parameters.metodo!=='LINEAL_PROMEDIO_V1'){/* el motor lo rechazará al proyectar (SUPUESTO_NO_SOPORTADO) */}
      if(pv){pv.estado='SUPERSEDED';pv.supersedido_at=ahora();}
      sp.estado='ACTIVE';sp.activado_at=ahora();desactualizar(sp.caso_id,'supuesto');
      if(simr&&(!Array.isArray(simr)||simr.length>5))desactualizar(sp.caso_id,'precondiciones');
      return ok({id:sp.id,estado:'ACTIVE',supersede_a:pv?pv.id:null});
    }
    if(fn==='renta_e1_mes_declarar'){
      if(!casoDe(a.p_caso_id))return falla(err('42501','RENTA_SIN_PERMISO: no autorizado para este caso',403));
      if(!motivoOk(a.p_motivo))return falla(err('22023','Declarar un mes exige un motivo'));
      var mes=String(a.p_mes||'').slice(0,7)+'-01';
      if(mes.slice(0,4)!==String(AC))return falla(err('22023','El mes debe pertenecer al AC '+AC));
      if(MESES.some(function(x){return x.caso_id===+a.p_caso_id&&x.mes===mes&&x.tipo==='SIN_MOVIMIENTO'&&!MESES.some(function(r){return r.revoca_a===x.id;});}))
        return falla(err('22023','MES_YA_DECLARADO: el mes ya tiene una declaración vigente'));
      var md={id:nid(),caso_id:+a.p_caso_id,cliente_id:casoDe(a.p_caso_id).cliente_id,mes:mes,tipo:'SIN_MOVIMIENTO',revoca_a:null,motivo:String(a.p_motivo).trim(),autor:YO.id,creado_at:ahora()};
      MESES.push(md);desactualizar(+a.p_caso_id,'meses_declarados');return ok({declaracion_id:md.id,mes:md.mes});
    }
    if(fn==='renta_e1_mes_revocar'){
      var dd=MESES.filter(function(x){return x.id===+a.p_declaracion_id;})[0];
      if(!dd)return falla(err('42501','RENTA_SIN_PERMISO: no autorizado',403));
      if(!motivoOk(a.p_motivo))return falla(err('22023','Revocar exige un motivo'));
      if(dd.tipo!=='SIN_MOVIMIENTO'||MESES.some(function(r){return r.revoca_a===dd.id;}))return falla(err('22023','SIN_DECLARACION_VIGENTE: la declaración no existe o ya fue revocada'));
      var rv={id:nid(),caso_id:dd.caso_id,cliente_id:dd.cliente_id,mes:dd.mes,tipo:'REVOCA',revoca_a:dd.id,motivo:String(a.p_motivo).trim(),autor:YO.id,creado_at:ahora()};
      MESES.push(rv);desactualizar(dd.caso_id,'meses_declarados');return ok({revocacion_id:rv.id,revoca_a:dd.id});
    }
    if(fn==='renta_e1_marcar'){
      if(!casoDe(a.p_caso_id))return falla(err('42501','RENTA_SIN_PERMISO: no autorizado para este caso',403));
      if(!motivoOk(a.p_motivo))return falla(err('22023','Una marca exige un motivo'));
      if(['ANORMAL','NO_RECURRENTE','PORCION_APERTURA','COMPONENTE_APERTURA'].indexOf(a.p_tipo)<0||['SUGERIDA','CONFIRMADA','REVERTIDA'].indexOf(a.p_accion)<0)
        return falla(err('22023','Tipo o acción de marca inválidos'));
      if(!ASIENTOS.some(function(x){return x.id===+a.p_asiento_id;}))return falla(err('22023','ASIENTO_INVALIDO: el asiento no pertenece al Libro Diario vigente del caso'));
      var mk={id:nid(),caso_id:+a.p_caso_id,cliente_id:5001,asiento_id:+a.p_asiento_id,cuenta_codigo:a.p_cuenta||null,tipo:a.p_tipo,accion:a.p_accion,
        monto:a.p_accion==='REVERTIDA'?null:(a.p_monto==null?null:a.p_monto),componente:a.p_componente||null,motivo:String(a.p_motivo).trim(),creado_at:ahora()};
      MARCAS.push(mk);if(+a.p_asiento_id===7741&&a.p_tipo==='ANORMAL')ST[+a.p_caso_id].sugerido=false;desactualizar(+a.p_caso_id,'marcas');
      return ok({marca_id:mk.id,tipo:mk.tipo,accion:mk.accion});
    }
    return falla(err('PGRST202','DEMO: RPC no simulada '+fn,404));
  }

  window.MR_DEMO_API={get:get,rpc:rpc};
})();
