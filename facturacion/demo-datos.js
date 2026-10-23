/* ============================================================
   facturacion/demo-datos.js — MODO DEMOSTRACIÓN LOCAL (F1b)
   Datos 100 % FICTICIOS con la misma forma que las tablas del motor F1a
   (facturacion_lotes, facturacion, facturacion_adicionales, facturacion_eventos,
   facturacion_historial, periodos) y un motor simulado en memoria.
   Solo lo carga facturacion/index.html cuando la URL trae ?demo=1 Y el host es
   localhost / 127.0.0.1 / [::1]. Nunca llama a Supabase: nada sale del navegador.
   ============================================================ */
(function(){
  'use strict';
  var h=location.hostname;
  if(!(h==='localhost'||h==='127.0.0.1'||h==='[::1]'))return;   // doble candado: fuera de localhost no existe

  var UF_OCT=41252.94, UF_SEP=41065.38;
  var seq=1000;
  function nid(){return ++seq;}
  function ahora(){return new Date().toISOString();}

  var periodos=[{periodo:'2026-10',uf:UF_OCT},{periodo:'2026-09',uf:UF_SEP},{periodo:'2026-08',uf:40958.12}];

  /* Fichas ficticias (solo lo que el motor usa para calcular) */
  var CLI={
    1:{rut:'76.512.334-1',razon_social:'Panadería Los Aromos SpA',plan:'esencial',moneda_plan:'UF',monto_base:1.5,valor_por_trab:0,trab_incluidos:0,completa:true},
    2:{rut:'77.210.845-6',razon_social:'Ferretería El Roble Ltda.',plan:'esencial',moneda_plan:'CLP',monto_base:45000,valor_por_trab:0,trab_incluidos:0,completa:true},
    3:{rut:'76.998.120-3',razon_social:'Taller Mecánico Ruta Sur SpA',plan:'avanzado',moneda_plan:'UF',monto_base:2,valor_por_trab:0,trab_incluidos:0,completa:true},
    4:{rut:'77.345.902-8',razon_social:'Estudio Creativo Nube Azul SpA',plan:'completo',moneda_plan:'UF',monto_base:3,valor_por_trab:0,trab_incluidos:0,completa:true},
    5:{rut:'76.420.118-K',razon_social:'Distribuidora Valle Verde Ltda.',plan:'avanzado',moneda_plan:'UF',monto_base:2.5,valor_por_trab:0,trab_incluidos:0,completa:true},
    6:{rut:'77.601.233-4',razon_social:'Cafetería Puerto Lindo SpA',plan:'esencial',moneda_plan:'UF',monto_base:1,valor_por_trab:0,trab_incluidos:0,completa:true},
    7:{rut:'77.488.019-5',razon_social:'Óptica Mirador EIRL',plan:'esencial',moneda_plan:'UF',monto_base:1.2,valor_por_trab:0,trab_incluidos:0,completa:false},
    11:{rut:'76.305.778-9',razon_social:'Transportes Cordillera SpA',plan:'avanzado',moneda_plan:'UF',monto_base:3,moneda_variable:'UF',valor_por_trab:0.25,trab_incluidos:5,reporte:9,completa:true},
    12:{rut:'77.152.640-3',razon_social:'Clínica Dental Sonrisa Clara SpA',plan:'completo',moneda_plan:'CLP',monto_base:120000,moneda_variable:'CLP',valor_por_trab:4990,trab_incluidos:10,completa:true},
    13:{rut:'76.640.902-1',razon_social:'Agrícola Santa Elvira Ltda.',plan:'avanzado',moneda_plan:'UF',monto_base:2,moneda_variable:'UF',valor_por_trab:0.25,trab_incluidos:3,reporte:4,completa:true},
    14:{rut:'77.019.356-7',razon_social:'Servicios Logísticos Bahía SpA',plan:'avanzado',moneda_plan:'CLP',monto_base:85000,moneda_variable:'CLP',valor_por_trab:6000,trab_incluidos:4,reporte:6,completa:true},
    15:{rut:'76.777.231-0',razon_social:'Imprenta Letra Viva SpA',plan:'esencial',moneda_plan:'CLP',monto_base:60000,moneda_variable:'CLP',valor_por_trab:5000,trab_incluidos:3,completa:true}
  };
  var NOMBRE_PLAN={esencial:'Esencial',avanzado:'Avanzado',completo:'Completo'};
  function sinPuntos(r){return String(r).replace(/\./g,'');}

  /* Historial del "Excel" de septiembre (ficticio) */
  var historial=[
    {periodo:'2026-09',cliente_rut:sinPuntos(CLI[1].rut),total:61598,n_trabajadores:null,estatus:'ACTIVO',estado_pago:'PENDIENTE'},
    {periodo:'2026-09',cliente_rut:sinPuntos(CLI[2].rut),total:45000,n_trabajadores:null,estatus:'ACTIVO',estado_pago:'PENDIENTE'},
    {periodo:'2026-09',cliente_rut:sinPuntos(CLI[3].rut),total:61598,n_trabajadores:null,estatus:'ACTIVO',estado_pago:'PENDIENTE'},
    {periodo:'2026-09',cliente_rut:sinPuntos(CLI[4].rut),total:141696,n_trabajadores:null,estatus:'ACTIVO',estado_pago:'PAGADA'},
    {periodo:'2026-09',cliente_rut:sinPuntos(CLI[5].rut),total:100000,n_trabajadores:null,estatus:'ACTIVO',estado_pago:'PENDIENTE'},
    {periodo:'2026-09',cliente_rut:sinPuntos(CLI[11].rut),total:153995,n_trabajadores:8,estatus:'ACTIVO',estado_pago:'PAGADA'},
    {periodo:'2026-09',cliente_rut:sinPuntos(CLI[12].rut),total:129980,n_trabajadores:12,estatus:'ACTIVO',estado_pago:'PAGADA'},
    {periodo:'2026-09',cliente_rut:sinPuntos(CLI[13].rut),total:123196,n_trabajadores:7,estatus:'ACTIVO',estado_pago:'PENDIENTE'},
    {periodo:'2026-09',cliente_rut:sinPuntos(CLI[14].rut),total:97000,n_trabajadores:6,estatus:'ACTIVO',estado_pago:'PAGADA'},
    {periodo:'2026-09',cliente_rut:sinPuntos(CLI[15].rut),total:60000,n_trabajadores:3,estatus:'ACTIVO',estado_pago:'PENDIENTE'},
    {periodo:'2026-09',cliente_rut:'76229674-3',total:41065,n_trabajadores:null,estatus:'ACTIVO',estado_pago:'PAGADA'},
    {periodo:'2026-08',cliente_rut:sinPuntos(CLI[1].rut),total:61437,n_trabajadores:null,estatus:'ACTIVO',estado_pago:'PAGADA'},
    {periodo:'2026-08',cliente_rut:sinPuntos(CLI[11].rut),total:153593,n_trabajadores:8,estatus:'ACTIVO',estado_pago:'PAGADA'}
  ];
  var BASE_SEP={1:[1.5,'UF'],2:[45000,'CLP'],3:[1.5,'UF'],4:[3,'UF'],5:[2.5,'UF'],11:[3,'UF'],12:[120000,'CLP'],13:[2,'UF'],14:[85000,'CLP'],15:[60000,'CLP']};

  var lotes=[], lineas=[], adicionales=[], eventos=[];
  var TRAT=[
    {cliente_id:21,rut:'76.111.402-6',razon_social:'Inmobiliaria Los Aromos SpA',tratamiento:'A_TRAVES',pagador_id:1,pagador_rut:CLI[1].rut,pagador:CLI[1].razon_social,justificacion:'Se factura a través del pagador'},
    {cliente_id:22,rut:'77.880.114-2',razon_social:'Transportes Cordillera Norte SpA',tratamiento:'A_TRAVES',pagador_id:11,pagador_rut:CLI[11].rut,pagador:CLI[11].razon_social,justificacion:'Se factura a través del pagador'},
    {cliente_id:23,rut:'65.204.887-1',razon_social:'Fundación Huellas del Sur',tratamiento:'CORTESIA',pagador_id:4,pagador_rut:CLI[4].rut,pagador:CLI[4].razon_social,justificacion:'Cortesía cubierta por el pagador'},
    {cliente_id:24,rut:'65.330.118-4',razon_social:'Junta de Vecinos Villa Esperanza',tratamiento:'CORTESIA',pagador_id:null,justificacion:'Cortesía directa de Contadoor'},
    {cliente_id:25,rut:'76.000.111-K',razon_social:'Inversiones Ejemplo Uno SpA',tratamiento:'PROPIA',pagador_id:null,justificacion:'Empresa propia'}
  ];
  var CUBRE={1:[TRAT[0]],11:[TRAT[1]],4:[TRAT[2]]};

  function fmtCant(n){return String(+(+n).toFixed(6)).replace('.',',');}
  function fmtP(n){return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
  function fmt2(n){var p=(+n).toFixed(2).split('.');return p[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+p[1];}

  /* Mismo cálculo que fact_linea_recalcular (simplificado: sin descuentos ni gate estricto) */
  function recalcular(f){
    var l=lote(f.lote_id), c=CLI[f.cliente_id], mot=[];
    if(!c.completa)mot.push('FICHA_INCOMPLETA:email');
    var baseClp=c.moneda_plan==='UF'?c.monto_base*l.uf_valor:c.monto_base, vt=c.valor_por_trab||0, vtClp=0, n=null, origen=null;
    if(f.tipo_lote==='VARIABLE'){
      vtClp=c.moneda_variable==='UF'?vt*l.uf_valor:vt;
      if(c.reporte!=null){n=c.reporte;origen='REPORTE_RRHH';}
      else if(f.trab_manual_n!=null){n=f.trab_manual_n;origen='MANUAL';}
      else mot.push('SIN_TRABAJADORES');
    }
    var extra=Math.max(0,(n||0)-(c.trab_incluidos||0)), l1=Math.round(baseClp), l12=Math.round(baseClp+extra*vtClp), l2=l12-l1;
    var ad=adicionales.filter(function(a){return a.linea_id===f.id;}), a=ad.reduce(function(s,x){return s+x.monto;},0), total=l12+a;
    var mes='octubre 2026', items=[];
    items.push({linea:'PLAN',NmbItem:'Servicio de asesoría contable y tributaria · Plan '+NOMBRE_PLAN[c.plan],
      DscItem:'Período contable: '+mes+'. '+(c.moneda_plan==='UF'?'Plan base '+fmtCant(c.monto_base)+' UF × UF $'+fmt2(l.uf_valor)+' (UF al 01-11-2026)':'Plan base mensual $'+fmtP(c.monto_base)),QtyItem:1,PrcItem:l1,MontoItem:l1});
    if(extra>0&&l2>0)items.push({linea:'TRABAJADORES',NmbItem:'Gestión de remuneraciones · trabajadores adicionales',
      DscItem:n+' trabajadores liquidados en octubre; '+c.trab_incluidos+' incluidos en el plan; '+extra+' adicionales × '+(c.moneda_variable==='UF'?fmtCant(vt)+' UF c/u (UF $'+fmt2(l.uf_valor)+')':'$'+fmtP(vt)+' c/u'),QtyItem:extra,PrcItem:+(l2/extra).toFixed(6),MontoItem:l2});
    ad.forEach(function(x){items.push({linea:'ADICIONAL',adicional_id:x.id,NmbItem:x.glosa,DscItem:x.detalle,QtyItem:1,PrcItem:x.monto,MontoItem:x.monto});});
    Object.assign(f,{cliente_rut:c.rut,razon_social:c.razon_social,plan:c.plan,moneda:c.moneda_plan,monto_base:c.monto_base,uf_valor:l.uf_valor,
      n_trabajadores:n,valor_por_trab:vt,moneda_variable:c.moneda_variable||null,trab_incluidos:c.trab_incluidos,origen_trabajadores:origen,
      descuento:0,adicionales_total:a,subtotal:l12+a,total_clp:total,motivos:mot,estado:mot.length?'BORRADOR':'LISTA',
      calculo:{uf:l.uf_valor,base_clp_exacto:baseClp,valor_trab_clp_exacto:vtClp,trabajadores:n,incluidos:c.trab_incluidos,adicionales_trab:extra,L1_plan:l1,L12_plan_mas_trab:l12,L2_trabajadores:l2,adicionales:a,descuento_vigente:false,descuento:0,total:total},
      detalle:{items:items,descuento_global:null,MntExe:total,MntTotal:total},snapshot:null,snapshot_hash:null});
  }
  /* Mismo análisis que fact_lote_analizar (alertas y explicación), simplificado */
  function analizar(l){
    var prev={}, s={uf:0,trabajadores:0,adicionales:0,descuentos:0,clientes_nuevos:0,clientes_que_salen:0,otras:0}, prevTot=0;
    historial.forEach(function(r){if(r.periodo==='2026-09')prev[r.cliente_rut]=r;});
    var ls=lineas.filter(function(x){return x.lote_id===l.id&&x.estado!=='EXCLUIDA'&&x.estado!=='ANULADA';});
    ls.forEach(function(f){
      var al=[], p=prev[sinPuntos(f.cliente_rut)];
      if(f.origen_trabajadores==='MANUAL')al.push({codigo:'DATO_MANUAL',n:f.n_trabajadores});
      if(f.adicionales_total>0)al.push({codigo:'ADICIONAL',monto:f.adicionales_total});
      if(!p){al.push({codigo:'CLIENTE_NUEVO'});if(f.estado==='LISTA')s.clientes_nuevos+=f.total_clp;}
      else{
        prevTot+=p.total;
        if(f.estado!=='LISTA'){al.push({codigo:'CLIENTE_FALTA',motivo:'NO_LISTA',motivos:f.motivos,total_anterior:p.total});s.clientes_que_salen-=p.total;}
        else{
          var bs=BASE_SEP[f.cliente_id], c=CLI[f.cliente_id];
          var fu=function(m,uf){return m==='UF'?uf:1;};
          var qp=f.tipo_lote==='FIJO'?0:(p.n_trabajadores||0), qc=f.n_trabajadores||0;
          var mpp=Math.round(f.monto_base*fu(f.moneda,UF_SEP)+Math.max(0,qp-f.trab_incluidos)*f.valor_por_trab*fu(f.moneda_variable,UF_SEP));
          var mcp=Math.round(f.monto_base*fu(f.moneda,f.uf_valor)+Math.max(0,qp-f.trab_incluidos)*f.valor_por_trab*fu(f.moneda_variable,f.uf_valor));
          var mcc=Math.round(f.monto_base*fu(f.moneda,f.uf_valor)+Math.max(0,qc-f.trab_incluidos)*f.valor_por_trab*fu(f.moneda_variable,f.uf_valor));
          s.uf+=mcp-mpp;s.trabajadores+=mcc-mcp;s.adicionales+=f.adicionales_total;s.otras+=mpp-p.total;
          if(bs&&(bs[0]!==c.monto_base||bs[1]!==c.moneda_plan))al.push({codigo:'CAMBIO_FICHA',antes:{moneda:bs[1],base:bs[0]},ahora:{moneda:c.moneda_plan,base:c.monto_base}});
          if(f.tipo_lote==='VARIABLE'&&f.n_trabajadores!=null&&p.n_trabajadores>0&&(p.n_trabajadores-f.n_trabajadores>=2||(p.n_trabajadores-f.n_trabajadores)>=.3*p.n_trabajadores))al.push({codigo:'TRABAJADORES_BAJAN',antes:p.n_trabajadores,ahora:f.n_trabajadores});
          var se=mpp-p.total+f.adicionales_total;
          if(Math.abs(se)>1000)al.push({codigo:'VARIACION_ALTA',sin_explicar:se,umbral:1000,anterior:p.total});
        }
      }
      (CUBRE[f.cliente_id]||[]).forEach(function(t){al.push({codigo:'CUBRE',cliente_id:t.cliente_id,rut:t.rut,razon_social:t.razon_social,tratamiento:t.tratamiento});});
      f.alertas=al;
    });
    var cmp=[];
    if(l.tipo==='FIJO'){cmp.push({codigo:'CLIENTE_FALTA',cliente_id:26,rut:'76.229.674-3',total_anterior:41065,motivo:'ESTADO_INACTIVO',razon_social:'Gimnasio Fuerza Norte SpA'});prevTot+=41065;s.clientes_que_salen-=41065;}
    var listas=ls.filter(function(x){return x.estado==='LISTA';}), tot=listas.reduce(function(a,x){return a+x.total_clp;},0);
    l.totales={n_lineas:ls.length,n_listas:listas.length,n_no_listas:ls.length-listas.length,monto_listas:tot,
      anterior:{periodo:'2026-09',fuente:'HISTORIAL',uf:UF_SEP,monto:prevTot},diferencia:tot-prevTot,
      diferencia_pct:prevTot?Math.round((tot-prevTot)*10000/prevTot)/100:null,explicacion:s};
    l.comparativo={universo_sin_linea:cmp,tratamientos:TRAT,duplicados_historial:[]};
    l.bloqueos=[];
  }
  function lote(id){return lotes.filter(function(x){return x.id===id;})[0];}
  function evento(lid,linea,tipo,actor,det){eventos.push({id:nid(),lote_id:lid,linea_id:linea,tipo:tipo,actor_usuario_id:actor==='servicio'?null:(actor==='master'?2:1),actor:actor==='servicio'?'servicio':'usuario',detalle:det||{},creado_at:ahora()});}
  function crearLote(tipo,estado){
    var l={id:nid(),periodo:'2026-10',tipo:tipo,modo:'PRUEBA',estado:'BORRADOR',fecha_emision:'2026-11-01',fecha_vencimiento:'2026-11-21',uf_fecha:'2026-11-01',uf_valor:UF_OCT,
      gate_estricto:false,version:1,huella_revision:null,huella:null,comentario_devolucion:null,motivo_anulacion:null,creado_at:ahora()};
    lotes.push(l);
    Object.keys(CLI).forEach(function(k){var c=CLI[k],id=+k;if((c.valor_por_trab>0?'VARIABLE':'FIJO')!==tipo)return;
      lineas.push({id:nid(),lote_id:l.id,cliente_id:id,periodo:'2026-10',modo:'PRUEBA',tipo_lote:tipo,estado:'BORRADOR',trab_manual_n:null,trab_manual_nota:null,doc_estado:'PENDIENTE',correo_estado:'PENDIENTE',of_folio:null});});
    evento(l.id,null,'LOTE_CREADO','facturador',{uf:UF_OCT,fecha_emision:'2026-11-01'});
    return l;
  }
  function recalcLote(l){lineas.filter(function(x){return x.lote_id===l.id;}).forEach(recalcular);analizar(l);}
  function huella(){var s='';for(var i=0;i<64;i++)s+='0123456789abcdef'[Math.floor(Math.random()*16)];return s;}

  /* Estado inicial: FIJO en revisión con un adicional; VARIABLE en borrador con un dato manual */
  var lf=crearLote('FIJO');
  lineas.filter(function(x){return x.lote_id===lf.id&&x.cliente_id===4;}).forEach(function(f){adicionales.push({id:nid(),linea_id:f.id,glosa:'Emisión de documentos',detalle:'Emisión de 50 documentos tributarios electrónicos en octubre',monto:25000,creado_por:1,creado_at:ahora()});});
  recalcLote(lf);
  evento(lf.id,null,'ADICIONAL_AGREGADO','facturador',{glosa:'Emisión de documentos',monto:25000});
  lineas.filter(function(x){return x.lote_id===lf.id&&x.estado==='LISTA';}).forEach(function(f){f.snapshot={v:1};f.snapshot_hash=huella();});
  lf.estado='EN_REVISION';lf.huella_revision=huella();
  evento(lf.id,null,'ENVIADO_REVISION','facturador',{n_listas:lf.totales.n_listas});
  var lv=crearLote('VARIABLE');
  lineas.filter(function(x){return x.lote_id===lv.id&&x.cliente_id===12;}).forEach(function(f){f.trab_manual_n=12;f.trab_manual_nota='Dato confirmado con el analista de RRHH (reporte aún no finalizado)';});
  recalcLote(lv);
  evento(lv.id,null,'TRABAJADORES_MANUAL','facturador',{ahora:12,nota:'Dato confirmado con el analista de RRHH'});

  /* ── Lectura: interpreta las mismas rutas PostgREST que usa facturacion.js ── */
  function q(path){
    var u=path.split('?'), tabla=u[0], p={};
    (u[1]||'').split('&').forEach(function(kv){var i=kv.indexOf('=');if(i>0)p[kv.slice(0,i)]=decodeURIComponent(kv.slice(i+1));});
    function eq(k){return p[k]&&p[k].indexOf('eq.')===0?p[k].slice(3):null;}
    function inn(k){return p[k]&&p[k].indexOf('in.(')===0?p[k].slice(4,-1).split(','):null;}
    var r;
    if(tabla==='periodos')r=periodos.slice();
    else if(tabla==='facturacion_lotes')r=lotes.filter(function(l){return (!eq('periodo')||l.periodo===eq('periodo'))&&(!eq('tipo')||l.tipo===eq('tipo'))&&(!eq('modo')||l.modo===eq('modo'))&&(!eq('id')||l.id===+eq('id'));}).sort(function(a,b){return b.id-a.id;});
    else if(tabla==='facturacion')r=lineas.filter(function(f){return (!eq('lote_id')||f.lote_id===+eq('lote_id'))&&(!eq('periodo')||f.periodo===eq('periodo'));});
    else if(tabla==='facturacion_adicionales'){var ids=inn('linea_id')||[];r=adicionales.filter(function(a){return ids.indexOf(String(a.linea_id))>=0;});}
    else if(tabla==='facturacion_eventos')r=eventos.filter(function(e){return e.lote_id===+eq('lote_id');}).sort(function(a,b){return b.id-a.id;});
    else if(tabla==='facturacion_historial')r=historial.filter(function(x){return (!eq('periodo')||x.periodo===eq('periodo'))&&(!eq('cliente_rut')||x.cliente_rut===eq('cliente_rut'));});
    else if(tabla==='clientes'){var c=CLI[+eq('id')];r=c?[{id:+eq('id'),rut:c.rut,razon_social:c.razon_social,giro:c.completa?'Actividad de ejemplo':'',direccion:'Dirección de ejemplo 123',comuna:'Maipú'}]:[];}
    else r=[];
    return JSON.parse(JSON.stringify(r));
  }
  function err(code,msg,sql){var e=new Error(code+': '+msg);e.fx={code:sql||'P0001',message:code+': '+msg};return e;}

  var API={
    rol:'facturador',
    get:function(path){return new Promise(function(res){setTimeout(function(){res(q(path));},120);});},
    rpc:function(fn,a){
      var self=this;
      return new Promise(function(res,rej){setTimeout(function(){
        try{res(self._rpc(fn,a||{}));}catch(e){rej(e);}
      },250);});
    },
    _rpc:function(fn,a){
      var fac=this.rol==='facturador', mas=this.rol==='master';
      function soloFact(){if(!fac)throw err('SOLO_FACTURADOR','solo el facturador (rol pagos o módulo Facturación habilitado en Administración) puede hacer esta acción','42501');}
      function soloMaster(){if(!mas)throw err('SOLO_MASTER','solo el Master puede hacer esta acción','42501');}
      function editable(l){if(!l)throw err('LOTE_NO_EXISTE','no existe','P0002');if(l.estado!=='BORRADOR'&&l.estado!=='DEVUELTO')throw err('LOTE_NO_EDITABLE','el lote está en '+l.estado,'55000');}
      function linea(id){var f=lineas.filter(function(x){return x.id===+id;})[0];if(!f)throw err('LINEA_NO_EXISTE',String(id),'P0002');editable(lote(f.lote_id));return f;}
      if(fn==='facturacion_yo')return {usuario_id:mas?2:1,nombre:mas?'Master (demo)':'Facturador (demo)',rol:mas?'admin':'pagos',es_master:mas,puede_preparar:fac,puede_emitir:fac,puede_aprobar:mas,puede_leer:true};
      if(fn==='facturacion_lote_preparar'){
        soloFact();
        if(a.p_periodo!=='2026-10')throw err('UF_NO_DISPONIBLE','el período contable '+a.p_periodo+' no está abierto en Panel de Control con la UF del día 1 del mes siguiente','55000');
        var l=lotes.filter(function(x){return x.periodo===a.p_periodo&&x.tipo===a.p_tipo&&x.modo===a.p_modo&&x.estado!=='ANULADO';})[0];
        if(!l)l=crearLote(a.p_tipo);else{editable(l);l.version++;l.estado='BORRADOR';l.huella_revision=null;evento(l.id,null,'LOTE_RECALCULADO','facturador',{version:l.version});}
        recalcLote(l);return {lote_id:l.id,estado:l.estado,version:l.version,totales:l.totales,bloqueos:[],omitidos:[]};
      }
      if(fn==='facturacion_adicional_agregar'){
        soloFact();var f=linea(a.p_linea);if(f.estado!=='BORRADOR'&&f.estado!=='LISTA')throw err('LINEA_NO_EDITABLE','la línea está en '+f.estado,'55000');
        var g=String(a.p_glosa||'').trim();if(g.length<3||g.length>80)throw err('GLOSA_INVALIDA','entre 3 y 80 caracteres','22023');
        if(!(a.p_monto>0)||a.p_monto!==Math.trunc(a.p_monto))throw err('MONTO_INVALIDO','pesos enteros mayores a 0','22023');
        var id=nid();adicionales.push({id:id,linea_id:f.id,glosa:g,detalle:a.p_detalle||null,monto:a.p_monto,creado_por:1,creado_at:ahora()});
        recalcular(f);analizar(lote(f.lote_id));evento(f.lote_id,f.id,'ADICIONAL_AGREGADO','facturador',{glosa:g,monto:a.p_monto});
        return {adicional_id:id,linea:{estado:f.estado,total:f.total_clp}};
      }
      if(fn==='facturacion_adicional_eliminar'){
        soloFact();var ad=adicionales.filter(function(x){return x.id===+a.p_adicional;})[0];if(!ad)throw err('ADICIONAL_NO_EXISTE',String(a.p_adicional),'P0002');
        var f2=linea(ad.linea_id);adicionales.splice(adicionales.indexOf(ad),1);recalcular(f2);analizar(lote(f2.lote_id));
        evento(f2.lote_id,f2.id,'ADICIONAL_ELIMINADO','facturador',{glosa:ad.glosa,monto:ad.monto});return {ok:true};
      }
      if(fn==='facturacion_trabajadores_registrar'){
        soloFact();var f3=linea(a.p_linea);
        if(f3.tipo_lote!=='VARIABLE')throw err('NO_APLICA','la línea es del lote FIJO','22023');
        if(!(a.p_n>=0)||a.p_n>100000)throw err('CANTIDAD_INVALIDA',String(a.p_n),'22023');
        if(!a.p_nota||String(a.p_nota).trim().length<5)throw err('NOTA_OBLIGATORIA','indica de dónde sale la cantidad (mínimo 5 caracteres)','22023');
        if(CLI[f3.cliente_id].reporte!=null)throw err('REPORTE_FINALIZADO_EXISTE','el reporte de remuneraciones de 2026-10 está finalizado; manda su cantidad','55000');
        f3.trab_manual_n=a.p_n;f3.trab_manual_nota=String(a.p_nota).trim();recalcular(f3);analizar(lote(f3.lote_id));
        evento(f3.lote_id,f3.id,'TRABAJADORES_MANUAL','facturador',{ahora:a.p_n,nota:f3.trab_manual_nota});
        return {estado:f3.estado,total:f3.total_clp,n_trabajadores:f3.n_trabajadores,origen:f3.origen_trabajadores};
      }
      if(fn==='facturacion_lote_enviar_revision'){
        soloFact();var l2=lote(+a.p_lote);editable(l2);recalcLote(l2);
        var n=lineas.filter(function(x){return x.lote_id===l2.id&&x.estado==='LISTA';});
        if(!n.length)throw err('SIN_LINEAS_LISTAS','no hay clientes listos para facturar','55000');
        n.forEach(function(f){f.snapshot={v:1};f.snapshot_hash=huella();});
        l2.estado='EN_REVISION';l2.huella_revision=huella();evento(l2.id,null,'ENVIADO_REVISION','facturador',{n_listas:n.length});
        return {lote_id:l2.id,estado:'EN_REVISION',huella_revision:l2.huella_revision,n_listas:n.length};
      }
      if(fn==='facturacion_lote_aprobar'){
        soloMaster();var l3=lote(+a.p_lote);if(!l3)throw err('LOTE_NO_EXISTE','','P0002');
        if(l3.estado!=='EN_REVISION')throw err('LOTE_NO_EN_REVISION','el lote está en '+l3.estado,'55000');
        if(a.p_huella!==l3.huella_revision)throw err('HUELLA_NO_COINCIDE','el contenido del lote no es el revisado; vuelve a cargarlo','55000');
        var ap=0,ex=0;lineas.filter(function(x){return x.lote_id===l3.id;}).forEach(function(f){if(f.estado==='LISTA')ap++;else{f.estado='EXCLUIDA';ex++;}});
        l3.estado='APROBADO';l3.huella=l3.huella_revision;evento(l3.id,null,'APROBADO','master',{lineas_aprobadas:ap,lineas_excluidas:ex});
        return {lote_id:l3.id,estado:'APROBADO',lineas_aprobadas:ap,lineas_excluidas:ex};
      }
      if(fn==='facturacion_lote_devolver'){
        soloMaster();if(!a.p_comentario||String(a.p_comentario).trim().length<5)throw err('COMENTARIO_OBLIGATORIO','explica qué corregir (mínimo 5 caracteres)','22023');
        var l4=lote(+a.p_lote);if(l4.estado!=='EN_REVISION')throw err('LOTE_NO_EN_REVISION','el lote está en '+l4.estado,'55000');
        lineas.filter(function(x){return x.lote_id===l4.id;}).forEach(function(f){f.snapshot=null;f.snapshot_hash=null;});
        l4.estado='DEVUELTO';l4.huella_revision=null;l4.comentario_devolucion=String(a.p_comentario).trim();evento(l4.id,null,'DEVUELTO','master',{comentario:l4.comentario_devolucion});
        return {lote_id:l4.id,estado:'DEVUELTO'};
      }
      if(fn==='facturacion_lote_anular'){
        soloMaster();if(!a.p_motivo||String(a.p_motivo).trim().length<10)throw err('MOTIVO_OBLIGATORIO','mínimo 10 caracteres','22023');
        var l5=lote(+a.p_lote);if(l5.estado==='ANULADO')throw err('LOTE_ANULADO','','55000');
        lineas.filter(function(x){return x.lote_id===l5.id;}).forEach(function(f){f.estado='ANULADA';});
        l5.estado='ANULADO';l5.motivo_anulacion=String(a.p_motivo).trim();evento(l5.id,null,'ANULADO','master',{motivo:l5.motivo_anulacion});
        return {lote_id:l5.id,estado:'ANULADO'};
      }
      throw err('RPC_NO_SIMULADA',fn,'42883');
    }
  };
  window.FX_DEMO_API=API;
})();

/* ── Facturación adicional (sin motor todavía): datos ficticios con la forma de
   public.servicios_adicionales (id, nombre, descripcion, categoria, moneda, precio, tipo, obs, activo)
   y de la ficha de Clientes. Solo para revisar el editor; nada se guarda. ── */
(function(){
  'use strict';
  var h=location.hostname;
  if(!(h==='localhost'||h==='127.0.0.1'||h==='[::1]'))return;
  var HOY='2026-10-20';
  var CLIENTES_AD=[
   {id:'c1',razon_social:'Mueblería Raíces del Sur SpA',rut:'77.912.448-1',giro:'Fabricación de muebles de madera',direccion:'Av. Los Carrera 1450',comuna:'Concepción',correo_facturacion:'facturas@raices.ejemplo.cl',dias_pago:20},
   {id:'c2',razon_social:'Consultora Brisa Marina SpA',rut:'76.584.210-7',giro:'Servicios de consultoría',direccion:'Calle Esmeralda 220, of. 31',comuna:'Valparaíso',correo_facturacion:'pagos@brisamarina.ejemplo.cl',dias_pago:30},
   {id:'c3',razon_social:'Viñedos Cerro Alto Ltda.',rut:'76.233.905-4',giro:'Cultivo de uva para vino',direccion:'Camino a Pirque km 8',comuna:'Pirque',correo_facturacion:'administracion@cerroalto.ejemplo.cl',dias_pago:20},
   {id:'c4',razon_social:'Florería Pétalo Fino EIRL',rut:'77.506.381-2',giro:'Venta al por menor de flores',direccion:'Pasaje Los Tilos 77',comuna:'Ñuñoa',correo_facturacion:'',dias_pago:20},
   {id:'c5',razon_social:'Panadería Los Aromos SpA',rut:'76.512.334-1',giro:'',direccion:'Av. Central 905',comuna:'Maipú',correo_facturacion:'aromos@ejemplo.cl',dias_pago:20},
   {id:'c6',razon_social:'Taller Mecánico Ruta Sur SpA',rut:'76.998.120-3',giro:'Reparación de vehículos',direccion:'Ruta 5 Sur km 22',comuna:'San Bernardo',correo_facturacion:'contacto@rutasur.ejemplo.cl',dias_pago:15}
  ];
  /* columnas reales: id, nombre, descripcion, categoria, moneda, precio, tipo, obs, activo */
  var SERVICIOS_AD=[
   {id:'svc-constitucion',nombre:'Constitución de sociedad',descripcion:'Escritura, inscripción y publicación en el Registro de Empresas',categoria:'societario',moneda:'CLP',precio:180000,tipo:'puntual',obs:'',activo:true},
   {id:'svc-modificacion',nombre:'Modificación de sociedad',descripcion:'Cambio de socios, capital, giro o administración',categoria:'societario',moneda:'UF',precio:3,tipo:'puntual',obs:'',activo:true},
   {id:'svc-renta',nombre:'Declaración de renta (F22)',descripcion:'Preparación y envío del Formulario 22',categoria:'tributario',moneda:'UF',precio:2.5,tipo:'puntual',obs:'Puede variar según complejidad',activo:true},
   {id:'svc-inicio',nombre:'Regularización de inicio de actividades',descripcion:'Trámite ante el SII y verificación de domicilio',categoria:'tributario',moneda:'CLP',precio:60000,tipo:'puntual',obs:'',activo:true},
   {id:'svc-asesoria-h',nombre:'Asesoría tributaria (por hora)',descripcion:'Reunión y análisis de un caso puntual',categoria:'tributario',moneda:'CLP',precio:50000,tipo:'puntual',obs:'',activo:true},
   {id:'svc-termino',nombre:'Término de giro',descripcion:'Balance de término y aviso al SII',categoria:'tributario',moneda:'UF',precio:4,tipo:'puntual',obs:'',activo:true},
   {id:'svc-finiquito',nombre:'Cálculo de finiquito',descripcion:'Cálculo, carta y documentos de término laboral',categoria:'laboral',moneda:'CLP',precio:35000,tipo:'puntual',obs:'',activo:true},
   {id:'svc-balance',nombre:'Balance extraordinario',descripcion:'Balance a una fecha distinta del cierre anual',categoria:'contable',moneda:'UF',precio:2,tipo:'puntual',obs:'',activo:true},
   {id:'svc-viejo',nombre:'Servicio antiguo (inactivo)',descripcion:'No debe aparecer',categoria:'otro',moneda:'CLP',precio:1,tipo:'puntual',obs:'',activo:false}
  ];
  function L(desc,det,cant,mon,precio,svc,descPct){return {svc:svc||null,desc:desc,det:det||'',cant:cant,mon:mon,precio:precio,descPct:descPct||0};}
  var IND=[
   {id:'i1',origen:'COT',cot:'COT-2026-0142',cliId:'c1',fEm:HOY,fVen:'2026-11-09',forma:'CREDITO',ref:'Cotización COT-2026-0142',cond:'50 % al aprobar · 50 % contra inscripción',lineas:[L('Constitución de sociedad','Escritura, inscripción y publicación en el Registro de Empresas',1,'CLP',180000,'svc-constitucion')],descG:{t:'%',v:0},obs:'',estado:'INSTRUCCION'},
   {id:'i2',origen:'COT',cot:'COT-2026-0138',cliId:'c2',fEm:HOY,fVen:'2026-11-19',forma:'CREDITO',ref:'Cotización COT-2026-0138',cond:'Pago a 30 días',lineas:[L('Declaración de renta (F22)','Año tributario 2027',1,'UF',2.5,'svc-renta'),L('Asesoría tributaria (por hora)','Revisión de retiros de socios',1,'CLP',50000,'svc-asesoria-h',10)],descG:{t:'%',v:0},obs:'',estado:'EN_REVISION'},
   {id:'i3',origen:'COT',cot:'COT-2026-0131',cliId:'c3',fEm:HOY,fVen:'2026-11-09',forma:'CONTADO',ref:'Cotización COT-2026-0131',cond:'Contado · paga hasta el día 21',lineas:[L('Asesoría tributaria (por hora)','Planificación de cierre 2026',3,'CLP',50000,'svc-asesoria-h')],descG:{t:'$',v:0},obs:'',estado:'APROBADA'},
   {id:'m1',origen:'MANUAL',cot:null,cliId:'c4',fEm:HOY,fVen:'2026-11-09',forma:'CREDITO',ref:'',cond:'Paga hasta el día 21',lineas:[L('Regularización de inicio de actividades','Trámite urgente',1,'CLP',60000,'svc-inicio')],descG:{t:'%',v:0},obs:'',estado:'EN_REVISION',motivo:'Trabajo urgente acordado por teléfono; no alcanzó a pasar por cotización.'}
  ];
  window.FX_DEMO_ADIC={HOY:HOY,CLIENTES:CLIENTES_AD,SERVICIOS:SERVICIOS_AD,FACTURAS:IND,L:L};
})();
