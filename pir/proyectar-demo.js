/* ============================================================
   pir/proyectar-demo.js — MODO DEMOSTRACIÓN LOCAL del asistente "Proyectar"
   Empresas y cifras 100 % FICTICIAS, con la MISMA FORMA que entregan las tablas, RPC y Edge reales.
   Solo lo carga proyectar.html con ?demo=1 Y en localhost / 127.0.0.1 / [::1]. Nunca llama a Supabase ni sube nada.
   ?escena=1…7 deja el cliente de ejemplo en cada paso (para revisar el diseño): 1 sin caso · 2 caso nuevo · 3 F22 leído ·
   4 Diario importado · 5 mapeo por confirmar · 6 listo para proyectar · 7 proyectado. Sin escena: se recorre el flujo a mano.
   ============================================================ */
(function(){
  'use strict';
  var h=location.hostname;
  if(!(h==='localhost'||h==='127.0.0.1'||h==='[::1]'))return;   // candado 2

  var AC=2026, seq=7000; function nid(){return ++seq;}
  function ahora(){return new Date().toISOString();}
  var YO={id:901,es_master:true,rol:'master'};
  function cli(id,rs,reg){return {id:id,razon_social:rs,estado:'activo',regimen:reg,tiene_contabilidad:true,analista_contable_usuario_id:901};}
  var CLIENTES=[cli(6001,'Comercial Demo Los Andes SpA','14D3'),cli(6002,'Servicios Demo Bahía Azul SpA','14D3'),cli(6003,'Taller Demo Cerro Alegre Ltda.',null),
    cli(6004,'Importadora Demo Valle Central SpA','14D3'),cli(6005,'Transportes Demo Ruta Sur SpA','presunta'),cli(6006,'Estudio Demo Las Palmas SpA','14D8')];
  var RC=[{cliente_id:6001,modalidad:'RECURRENTE',estado:'OPERATIONAL'},{cliente_id:6002,modalidad:'RECURRENTE',estado:'OPERATIONAL'},{cliente_id:6004,modalidad:'RECURRENTE',estado:'OPERATIONAL'},{cliente_id:6006,modalidad:'RECURRENTE',estado:'OPERATIONAL'}];
  var CASOS=[{id:91,cliente_id:6002,anio_comercial:AC,anio_tributario:AC+1,regimen:'14D3',estado:'IN_PROGRESS',version:1},{id:93,cliente_id:6006,anio_comercial:AC,anio_tributario:AC+1,regimen:'14D8',estado:'DRAFT',version:1}];
  var CAT=[['INGRESOS_OPERACIONALES','REVENUE','Ingresos del giro'],['COSTO_VENTAS','EXPENSE','Costo de ventas'],['GASTOS_ADMINISTRACION','EXPENSE','Gastos de administración'],
    ['REMUNERACIONES','EXPENSE','Remuneraciones'],['HONORARIOS_PAGADOS','EXPENSE','Servicios de terceros (boletas)'],['ARRIENDOS','EXPENSE','Arriendos'],['DEPRECIACION','EXPENSE','Depreciación'],
    ['GASTOS_RECHAZADOS','EXPENSE','Gastos rechazados (art. 21)'],['CAJA_BANCOS','ASSET','Caja y bancos'],['CLIENTES','ASSET','Clientes por cobrar'],['ACTIVO_FIJO','ASSET','Activo fijo'],
    ['PROVEEDORES','LIABILITY','Proveedores'],['IMPUESTOS_POR_PAGAR','LIABILITY','Impuestos por pagar'],['RETIROS_SOCIOS','EQUITY','Retiros de los socios'],['CAPITAL','EQUITY','Capital'],
    ['RESULTADOS_ACUMULADOS','EQUITY','Resultados acumulados'],['OTHER_REVENUE','REVENUE','Otros ingresos'],['OTHER_EXPENSE','EXPENSE','Otros gastos']]
    .map(function(c){return {categoria:c[0],clase:c[1],descripcion:c[2],requiere_confirmacion:/RECHAZ|RETIROS|OTHER/.test(c[0])};});
  // Cuentas ficticias del Diario de ejemplo
  var CUENTAS=[['110101','Caja','CAJA_BANCOS','RESOLVED',1820000],['110201','Banco Demo cuenta corriente','CAJA_BANCOS','RESOLVED',38450000],['110401','Clientes nacionales','CLIENTES','RESOLVED',21300000],
    ['120101','Equipos computacionales','ACTIVO_FIJO','RESOLVED',9600000],['210101','Proveedores nacionales','PROVEEDORES','RESOLVED',-14200000],['210501','IVA débito fiscal','IMPUESTOS_POR_PAGAR','RESOLVED',-3100000],
    ['310101','Capital pagado','CAPITAL','RESOLVED',-10000000],['310105','Utilidades acumuladas','RESULTADOS_ACUMULADOS','RESOLVED',-28700000],['410101','Ventas del giro','INGRESOS_OPERACIONALES','RESOLVED',-186400000],
    ['510101','Costo de mercaderías','COSTO_VENTAS','RESOLVED',98300000],['520101','Sueldos','REMUNERACIONES','RESOLVED',31200000],['520301','Arriendo oficina','ARRIENDOS','RESOLVED',8400000],
    ['520405','Asesorías externas','HONORARIOS_PAGADOS','INFERRED',4650000],['520410','Gastos de representación','GASTOS_RECHAZADOS','INFERRED',1280000],['330101','Retiros socio A','RETIROS_SOCIOS','INFERRED',12000000],
    ['520499','Gastos varios','OTHER_EXPENSE','INFERRED',940000],['520777','Diferencias de redondeo',null,'UNKNOWN',-1200],['110999','Cuenta puente cierre',null,'UNKNOWN',350000]];
  var LECTURA={document:{tipo:'F22',anio_tributario:AC},propuesta:[
    {item_key:'opening.rai',estado:'OK',monto:18450000,f22_codigo_ref:'1484',provenance:'DECLARED_F22'},
    {item_key:'opening.sac.no_sujeto_restitucion.sin_devolucion',estado:'OK',monto:2210000,f22_codigo_ref:'1563',provenance:'DECLARED_F22'},
    {item_key:'opening.sac.sujeto_restitucion.sin_devolucion',estado:'REVIEW',monto:480000,f22_codigo_ref:'1565',provenance:'DECLARED_F22'},
    {item_key:'opening.cpts',estado:'OK',monto:46900000,f22_codigo_ref:'1545',provenance:'DECLARED_F22'}]};

  var ST={};   // estado por caso
  function st(caso){return ST[caso]||(ST[caso]={fuentes:[],corridas:[],lecturas:[],apertura:null,cdb:false,cap:false,apc:'A3',snap:null,res:[],sup:null,motor:null});}
  function casoCli(c){return CASOS.filter(function(k){return k.cliente_id===c;})[0];}
  function fuente(caso,tipo,nombre,per){var f={id:nid(),caso_id:caso,tipo_fuente:tipo,origen:tipo==='F22_ANTERIOR'?'SII':'MASCONTABLE',nombre_original:nombre,estado:'REGISTRADA',metadatos:per?{periodo:String(per)}:{},sha256_estado:'VERIFICADO',cargado_at:ahora()};st(caso).fuentes.push(f);return f;}
  function corrida(caso,f){
    var per=f.metadatos.periodo?+f.metadatos.periodo:AC;
    var c={id:nid(),fuente_id:f.id,caso_id:caso,tipo_fuente:f.tipo_fuente,estado:'PROCESSED',anio_detectado:f.tipo_fuente==='PLAN_CUENTAS'?null:per,n_bloqueantes:0,n_revision:0,n_advertencias:1,finalizado_at:ahora()};
    if(f.tipo_fuente==='LIBRO_DIARIO'){c.n_asientos=412;c.n_lineas=1386;}
    else if(f.tipo_fuente==='BALANCE'){c.n_lineas=per===AC?87:79;c.resultado_tipo='UTILIDAD';c.resultado_monto=per===AC?38450000:28700000;}
    else c.n_lineas=214;
    st(caso).corridas.push(c);return c;
  }
  function vigente(caso,tipo,per){var s=st(caso);var f=s.fuentes.filter(function(x){return x.tipo_fuente===tipo&&x.estado==='REGISTRADA'&&(per==null||+(x.metadatos.periodo||AC)===per);}).pop();
    return f?s.corridas.filter(function(c){return c.fuente_id===f.id&&c.estado==='PROCESSED';}).pop()||null:null;}
  function calcularMapeo(caso){var s=st(caso), d=vigente(caso,'LIBRO_DIARIO'), b=vigente(caso,'BALANCE',AC);
    if(!s.res.length)s.res=CUENTAS.map(function(c){return {cuenta_codigo:c[0],cuenta_nombre:c[1],categoria:c[2],clase:null,estado:c[3],origen:c[3]==='RESOLVED'?'ERP':'CLIENT',saldo:c[4],n_lineas:20+(+c[0]%37)};});
    var unk=s.res.filter(function(r){return r.estado==='UNKNOWN';}).length, res=s.res.filter(function(r){return r.estado==='RESOLVED'||r.estado==='CONFIRMED';}).length;
    s.snap={id:nid(),catalogo_version:'1.0.0',corrida_diario:d&&d.id,corrida_balance:b&&b.id,cuentas_usadas:s.res.length,cuentas_mapeadas:s.res.length-unk,cuentas_resueltas:res,cuentas_unknown:unk,creado_at:ahora()};
    return {snapshot_id:s.snap.id,sin_cambios:false};}

  function escena(n){
    var k={id:92,cliente_id:6001,anio_comercial:AC,anio_tributario:AC+1,regimen:'14D3',estado:'IN_PROGRESS',version:1};
    if(n>=2)CASOS.push(k);
    if(n>=3){var f=fuente(92,'F22_ANTERIOR','F22_AT2026_compacto.pdf');st(92).lecturas.push({id:nid(),fuente_id:f.id,estado:'PROPUESTA',blocking_count:0,resultado:LECTURA,creado_at:ahora()});}
    if(n>=4){st(92).apertura={estado:'OPENING_DECLARED_NOT_FULLY_RECONSTRUCTED',working:{apertura_id:801,version:1},effective:null};corrida(92,fuente(92,'LIBRO_DIARIO','LibroDiario_2026_ene-sep.xls'));}
    if(n>=5){corrida(92,fuente(92,'BALANCE','Balance8Columnas_2026_sep.xls',AC));corrida(92,fuente(92,'BALANCE','Balance8Columnas_2025.xls',AC-1));st(92).cdb=true;st(92).cap=true;calcularMapeo(92);}
    if(n>=6){st(92).apc='A2';st(92).res.forEach(function(r){if(r.estado!=='RESOLVED'){r.estado='CONFIRMED';if(!r.categoria)r.categoria='OTHER_EXPENSE';}});calcularMapeo(92);}
    if(n>=7){st(92).sup={id:nid(),version:1,forecast_method:'MANUAL',parameters:{metodo:'LINEAL_PROMEDIO_V1'},estado:'ACTIVE'};proyectar(92,'2026-09-30');}
  }
  function entrada(caso){
    var s=st(caso), d=vigente(caso,'LIBRO_DIARIO'), b=vigente(caso,'BALANCE',AC), b1=vigente(caso,'BALANCE',AC-1), bl=[], av=[];
    if(!d)bl.push('SIN_DIARIO');if(!b)bl.push('SIN_BALANCE_AC');
    if(d&&b&&!s.cdb)bl.push('CONCILIACION_DIARIO_BALANCE_PENDIENTE');
    if(!s.snap||(d&&s.snap.corrida_diario!==d.id)||(b&&s.snap.corrida_balance!==(b&&b.id)))bl.push(s.snap?'SNAPSHOT_MAPEO_DESACTUALIZADO':'SIN_SNAPSHOT_MAPEO');
    else if(s.snap.cuentas_unknown)bl.push('MAPEO_CON_UNKNOWN');
    if(b1&&!s.cap)bl.push('CONCILIACION_AC1_PENDIENTE');
    if(!s.apertura)bl.push('APERTURA_TRIBUTARIA_AUSENTE');else bl.push('APERTURA_TRIBUTARIA_ITEM:opening.sac.sujeto_restitucion.sin_devolucion:REVIEW');
    bl.push('REGLA_NO_ACTIVA:art21.efectos_rli','REGLA_NO_ACTIVA:tcel.categoria_flujo');
    if(d&&s.apc==='A3')av.push('APERTURA_CONTABLE_NO_CONFIRMADA');
    return {contrato:'e1-entrada@1.1.0',efectivo:{diario:d?{corrida_id:d.id,anio:AC}:null,balance_ac:b?{corrida_id:b.id,periodo:AC}:null,balance_ac1:b1?{corrida_id:b1.id,periodo:AC-1}:null,
      conciliaciones:{diario_balance:d&&b&&s.cdb?{id:1,evaluacion:'CUADRA',cuentas:87,diferencias:0}:null,apertura:b1&&s.cap?{id:2,evaluacion:'TRASPASO_RESULTADO',cuentas:79,diferencias:0}:null},
      estado_balance_ac1:b1?(s.cap?'B4':'B1'):'B0',
      apertura_contable:d?{estado:s.apc,asiento_id:501,asiento_numero:1,clase_confirmada:s.apc==='A2'?'OPENING_BALANCE':null,huella_saldos:new Array(65).join('a')}:{estado:'A0'},
      mapeo_snapshot:s.snap?{id:s.snap.id,cuentas_unknown:s.snap.cuentas_unknown}:null},
      elegible_final:false,bloqueos_final:bl.sort(),avisos:av};
  }
  function proyectar(caso,corte){var s=st(caso), e=entrada(caso);
    s.motor={id:nid(),cutoff_date:corte,estado:'COMPLETED',resultado_estado:'PRELIMINARY',final_bloqueos:e.bloqueos_final,finalizado_at:ahora()};
    return {corrida_id:s.motor.id,estado:'OK',reutilizada:false,resultado:'PRELIMINARY',n_outputs:124};}

  var m=/(?:^|[?&])escena=(\d)/.exec(location.search);escena(m?+m[1]:1);

  function q(path){var i=path.indexOf('?'), t=i<0?path:path.slice(0,i), p=new URLSearchParams(i<0?'':path.slice(i+1)), f={};
    p.forEach(function(v,k){var x=/^eq\.(.*)$/.exec(v);if(x)f[k]=x[1];});return {t:t,f:f,off:+(p.get('offset')||0)};}
  function demora(x,ms){return new Promise(function(ok){setTimeout(function(){ok(JSON.parse(JSON.stringify(x)));},ms==null?120:ms);});}
  function falla(msg){return new Promise(function(_,no){setTimeout(function(){no(new Error(msg));},120);});}

  window.MR_PROY_DEMO_API={
    get:function(path){
      var r=q(path), c=+r.f.caso_id, out=[];
      if(r.off>0)return demora([]);
      switch(r.t){
        case 'clientes':out=CLIENTES;break;
        case 'renta_clientes':out=RC.filter(function(x){return !r.f.cliente_id||x.cliente_id===+r.f.cliente_id;});break;
        case 'renta_casos':out=CASOS.filter(function(x){return !r.f.cliente_id||x.cliente_id===+r.f.cliente_id;});break;
        case 'renta_fuentes':out=st(c).fuentes;break;
        case 'renta_corridas':out=r.f.fuente_id?Object.keys(ST).reduce(function(a,k){return a.concat(ST[k].corridas);},[]).filter(function(x){return x.fuente_id===+r.f.fuente_id;}):st(c).corridas;break;
        case 'renta_f22_lecturas':out=st(c).lecturas.slice().reverse();break;
        case 'renta_mapeo_snapshots':out=st(c).snap?[st(c).snap]:[];break;
        case 'renta_mapeo_resultados':out=Object.keys(ST).map(function(k){return ST[k];}).filter(function(s){return s.snap&&s.snap.id===+r.f.snapshot_id;}).map(function(s){return s.res;})[0]||[];break;
        case 'renta_semantica_catalogo':out=CAT;break;
        case 'renta_supuestos_forecast':out=st(c).sup?[st(c).sup]:[];break;
        case 'renta_motor_corridas':out=st(c).motor?[st(c).motor]:[];break;
        case 'renta_asientos':out=[{fecha:AC+'-09-30'}];break;
      }
      return demora(out);
    },
    rpc:function(fn,a){
      a=a||{};var s=a.p_caso_id?st(a.p_caso_id):null;
      switch(fn){
        case 'renta_yo':return demora([YO]);
        case 'renta_apertura_vigente':return demora(s.apertura||{estado:'OPENING_MISSING',working:null,effective:null});
        case 'renta_e1_entrada':return demora(entrada(a.p_caso_id));
        case 'renta_cliente_habilitar':RC.push({cliente_id:a.p_cliente_id,modalidad:a.p_modalidad,estado:'OPERATIONAL'});return demora({estado:'OPERATIONAL'},400);
        case 'renta_cliente_resolver':RC.forEach(function(x){if(x.cliente_id===a.p_cliente_id)x.estado='OPERATIONAL';});return demora({estado:'OPERATIONAL'});
        case 'renta_caso_crear':if(casoCli(a.p_cliente_id))return falla('Ya existe un caso vigente para ese cliente y Año Comercial');
          var k={id:nid(),cliente_id:a.p_cliente_id,anio_comercial:a.p_anio_comercial,anio_tributario:a.p_anio_comercial+1,regimen:a.p_regimen,estado:'DRAFT',version:1};CASOS.push(k);return demora(k,500);
        case 'renta_fuente_registrar':
          s.fuentes.forEach(function(f){if(f.id===a.p_reemplaza_a){f.estado='REEMPLAZADA';}});
          var f=fuente(a.p_caso_id,a.p_tipo_fuente,a.p_nombre_original,a.p_metadatos&&a.p_metadatos.periodo);return demora({id:f.id},300);
        case 'renta_conciliar_diario_balance':Object.keys(ST).forEach(function(id){if(ST[id].corridas.some(function(c){return c.id===a.p_corrida_diario;}))ST[id].cdb=true;});return demora({resultado:'CUADRA',cuentas:87,diferencias:0},500);
        case 'renta_conciliar_apertura':Object.keys(ST).forEach(function(id){if(ST[id].corridas.some(function(c){return c.id===a.p_corrida_diario;}))ST[id].cap=true;});return demora({resultado:'TRASPASO_RESULTADO'},400);
        case 'renta_mapeo_calcular':return demora(calcularMapeo(a.p_caso_id),700);
        case 'renta_mapeo_confirmar':s.res.forEach(function(r){if(r.cuenta_codigo===a.p_cuenta_codigo){r.estado='CONFIRMED';r.categoria=a.p_categoria;}});return demora(calcularMapeo(a.p_caso_id),200);
        case 'renta_asiento_confirmar_clase':return demora({clase_confirmada:'OPENING_BALANCE'});
        case 'renta_apertura_contable_aceptar':s.apc='A2';return demora({aceptacion_id:nid()});
        case 'renta_supuesto_forecast_crear':s.sup={id:nid(),version:1,forecast_method:'MANUAL',parameters:a.p_parametros,estado:'DRAFT'};return demora({id:s.sup.id});
        case 'renta_supuesto_forecast_activar':Object.keys(ST).forEach(function(id){if(ST[id].sup&&ST[id].sup.id===a.p_supuesto_id)ST[id].sup.estado='ACTIVE';});return demora({ok:true});
        case 'renta_e1_proyectar':return demora(proyectar(a.p_caso_id,a.p_corte),1400);
      }
      return falla('Función no disponible en la demostración: '+fn);
    },
    subir:function(){return demora(null,500);},
    invocar:function(fn,body){
      if(fn==='mirenta-f22-leer'){var s=st(body.caso_id);s.lecturas.push({id:nid(),fuente_id:body.fuente_id,estado:'PROPUESTA',blocking_count:0,resultado:LECTURA,creado_at:ahora()});return demora({ok:true,data:{estado:'PROPUESTA'}},1200);}
      if(fn==='mirenta-importar'){var id=Object.keys(ST).filter(function(k){return ST[k].fuentes.some(function(f){return f.id===body.fuente_id;});})[0], f=ST[id].fuentes.filter(function(x){return x.id===body.fuente_id;})[0];
        var c=corrida(+id,f);return demora({ok:true,data:{corrida_id:c.id,estado:'PROCESSED',lotes:3,incidencias:1}},1500);}
      return demora({ok:false,mensaje:'Edge no disponible en la demostración'});
    }
  };
})();
