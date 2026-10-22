/* ============================================================
   pre-iva/operativa-datos.js — Pre-IVA · Pantalla 2: LECTURA de datos para las piezas nuevas (SOLO LECTURA).
   No escribe nada en la base. Usa sbFetch (supabase.js: JWT del usuario + RLS); en la demo local, sbFetch es el de
   operativa-demo.js. Cada pieza falla por separado: un error en una no impide mostrar las demás.
     · clientes (iva_condicion, regimen)                         → empresa exenta de IVA / caso de renta
     · RPC sapi_frescura (gestoor-backend PR #57, aún NO instalado) → estado de sincronización con el SII
         404 / PGRST202 / 42883 = "Conexión con el SII pendiente de activación" (no es un error)
     · rcv_resumenes + rcv_documentos (snapshot más reciente por período y libro) → documentos y totales del SII
     · reportes_mensuales (F29 registrado por Contable; no existe un estado formal de "validado") y preiva_historial (enviados) → historial de 6 meses
     · renta_casos + RPC renta_e1_proyeccion_vigente (igual que pir/proyeccion.js) → proyección de renta de MiRenta
   ============================================================ */
(function(){
'use strict';
var COLS_DOC='snapshot_id,periodo,tipo,tipo_dte,tipo_dte_label,folio,rut_contraparte,razon_social_contraparte,fecha_emision,fecha_recepcion,acuse_recibo,fecha_acuse,fecha_reclamo,estado,monto_exento,monto_neto,monto_iva,monto_iva_recuperable,monto_total';
var COLS_RES='snapshot_id,periodo,tipo,tipo_dte,tipo_dte_label,total_documentos,monto_exento,monto_neto,iva_recuperable,iva_uso_comun,iva_no_recuperable,monto_total,creado_at';
var MESES_HIST=6, PAG=1000, MAX_PAG=20;

function leer(r){
  return r.text().then(function(t){
    var j=null;try{j=t?JSON.parse(t):null;}catch(e){}
    if(!r.ok){var e=new Error((j&&j.message)||('HTTP '+r.status));e.status=r.status;e.code=j&&j.code;throw e;}
    return j;
  });
}
function get(path){return sbFetch(path).then(leer);}
function rpc(fn,args){return sbFetch('rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args||{})}).then(leer);}
function z(n){return (n<10?'0':'')+n;}
// 'AAAAMM' o 'AAAA-MM' → 'AAAA-MM'; desplazamiento en meses
function perDb(p){p=String(p||'');return /^\d{6}$/.test(p)?p.slice(0,4)+'-'+p.slice(4,6):p;}
function mover(per,d){var y=+per.slice(0,4),m=+per.slice(5,7)-1+d;y+=Math.floor(m/12);m=((m%12)+12)%12;return y+'-'+z(m+1);}
function previos(per){var a=[];for(var i=MESES_HIST;i>=1;i--)a.push(mover(per,-i));return a;}
function num(v){if(v===null||v===undefined||v==='')return null;var x=Number(v);return isFinite(x)?x:null;}
function lista(arr){return '('+arr.map(function(x){return '"'+String(x).replace(/"/g,'')+'"';}).join(',')+')';}

/* ── Ficha del cliente: condición de IVA y régimen (si la columna no existe o viene vacía: flujo normal) ── */
function extra(cli){
  return get('clientes?id=eq.'+encodeURIComponent(cli.id)+'&select=id,regimen,iva_condicion').then(function(r){
    var x=(r&&r[0])||{};return {ivaCondicion:x.iva_condicion||null,regimen:x.regimen||null};
  },function(e){return {ivaCondicion:null,regimen:null,error:e.message};});
}

/* ── Frescura del SII (sapi_frescura). Peor estado entre compras y ventas. ── */
function noInstalada(e){return e&&(e.status===404||e.code==='PGRST202'||e.code==='42883');}
function frescura(cli,per){
  var ops=['rcv_compras','rcv_ventas'];
  return Promise.all(ops.map(function(op){
    return rpc('sapi_frescura',{p_cliente_id:Number(cli.id),p_operacion:op,p_periodo:per}).then(function(x){
      return x&&typeof x==='object'&&!Array.isArray(x)&&x.estado?x:{estado:'pendiente'};
    },function(e){return noInstalada(e)?{estado:'pendiente'}:{estado:'error',error:e.message};});
  })).then(function(r){
    var orden=['pendiente','error','sin_datos','desactualizado','al_dia'], peor=r[0];
    r.forEach(function(x){if(orden.indexOf(x.estado)<orden.indexOf(peor.estado))peor=x;});
    var ult=r.map(function(x){return x.ultimaConsulta;}).filter(Boolean).sort();
    return {estado:peor.estado,motivo:peor.motivo||null,aviso:peor.aviso||null,ultima:ult.length?(peor.estado==='al_dia'?ult[0]:(peor.ultimaConsulta||ult[0])):null,compras:r[0],ventas:r[1]};
  });
}

/* ── Documentos del SII: snapshot más reciente por período y libro ── */
function mapDoc(d){
  var compra=d.tipo==='compras';
  return {periodo:d.periodo,libro:d.tipo,tipo_dte:Number(d.tipo_dte),label:d.tipo_dte_label||('Tipo '+d.tipo_dte),folio:d.folio==null?'':String(d.folio),
    rut:d.rut_contraparte||'',razon:d.razon_social_contraparte||'',fecha:d.fecha_emision||null,fecha_recepcion:d.fecha_recepcion||null,
    fecha_acuse:d.fecha_acuse||null,fecha_reclamo:d.fecha_reclamo||null,acuse:d.acuse_recibo===true,estado:d.estado||'',
    neto:num(d.monto_neto)||0,exento:num(d.monto_exento)||0,iva:(compra&&num(d.monto_iva_recuperable)!=null?num(d.monto_iva_recuperable):num(d.monto_iva))||0,total:num(d.monto_total)||0};
}
function documentos(cli,per){
  var pers=previos(per).concat([per]);
  return get('rcv_resumenes?cliente_id=eq.'+encodeURIComponent(cli.id)+'&periodo=in.'+lista(pers)+'&select='+COLS_RES+'&order=snapshot_id.desc&limit=2000').then(function(res){
    res=res||[];
    var snap={};res.forEach(function(x){var k=x.periodo+'|'+x.tipo;if(snap[k]==null||x.snapshot_id>snap[k])snap[k]=x.snapshot_id;});
    var resumen={}, consulta=null;
    res.forEach(function(x){
      if(snap[x.periodo+'|'+x.tipo]!==x.snapshot_id)return;
      var p=resumen[x.periodo]=resumen[x.periodo]||{ventas:{},compras:{}}, l=p[x.tipo==='compras'?'compras':'ventas'];
      var iva=num(x.iva_recuperable);
      l[Number(x.tipo_dte)]={n:num(x.total_documentos)||0,neto:num(x.monto_neto),exento:num(x.monto_exento),iva:iva,total:num(x.monto_total)||0,label:x.tipo_dte_label||''};
      if(x.periodo===per&&x.creado_at&&(!consulta||x.creado_at>consulta))consulta=x.creado_at;
    });
    var ids=Object.keys(snap).map(function(k){return snap[k];}).filter(function(x){return x!=null;});
    var base={disponible:!!resumen[per],resumen:resumen,consultaAt:consulta,actual:{ventas:[],compras:[]},previos:{},meses:pers};
    // Solo cuenta como "mes con documentos" el que tiene snapshot: un mes sin snapshot NO es un mes sin compras ni ventas.
    previos(per).forEach(function(p){base.previos[p]={ventas:[],compras:[],conSnapshot:!!resumen[p]};});
    if(!ids.length)return base;
    var docs=[];
    function pagina(i){
      return get('rcv_documentos?snapshot_id=in.('+ids.join(',')+')&select='+COLS_DOC+'&order=snapshot_id.asc,posicion.asc&limit='+PAG+'&offset='+(i*PAG)).then(function(r){
        r=r||[];docs=docs.concat(r);
        if(r.length===PAG&&i+1<MAX_PAG)return pagina(i+1);
        base.truncado=r.length===PAG;base.incompleto=base.truncado;
      });
    }
    return pagina(0).then(function(){
      docs.forEach(function(d){
        var m=mapDoc(d), destino=d.periodo===per?base.actual:base.previos[d.periodo];
        if(destino)(m.libro==='compras'?destino.compras:destino.ventas).push(m);
      });
      return base;
    });
  }).catch(function(e){return {disponible:false,error:e.message||'error de lectura',actual:{ventas:[],compras:[]},previos:{},resumen:{}};});
}

/* ── Historial de 6 meses: reportes_mensuales (Contable) y, si falta, el Pre-IVA enviado. Sin dato = null (nunca 0). ── */
function historial(cli,per){
  var pers=previos(per);
  var rut=encodeURIComponent(cli.rut);
  return Promise.all([
    get('reportes_mensuales?cliente_rut=eq.'+rut+'&periodo=in.'+lista(pers)+'&select=periodo,debito_iva,credito_iva,remanente,f29,ppm,ppm_tasa,ppm_base,estado_contable,procesado_at,fecha_finalizado,fecha_aprobacion,updated_at').then(function(r){return r||[];},function(e){return {error:e.message};}),
    get('preiva_historial?cliente_rut=eq.'+rut+'&periodo=in.'+lista(pers)+'&select=periodo,debito_iva,credito_iva,remanente,f29,ppm,tasa_ppm,neto_ventas,neto_compras,fecha_envio').then(function(r){return r||[];},function(e){return {error:e.message};})
  ]).then(function(r){
    var rm={}, pv={};
    (Array.isArray(r[0])?r[0]:[]).forEach(function(x){if(x&&x.periodo)rm[x.periodo]=x;});
    (Array.isArray(r[1])?r[1]:[]).forEach(function(x){if(x&&x.periodo&&x.fecha_envio)pv[x.periodo]=x;});
    var F=window.PreIvaF29, E=window.PreIvaRecos, errRM=!!(r[0]&&r[0].error);
    var hoy=new Date(), mesHoy=hoy.getFullYear()+'-'+z(hoy.getMonth()+1);
    // Trazabilidad por mes: período, fuente, fecha de registro y qué indicadores sirven (o por qué se excluye)
    var filas=pers.map(function(p){
      var a=rm[p], b=pv[p];
      var ev=E?E.evaluarComparable(a,{periodoAbierto:per,mesHoy:mesHoy,errorLectura:errRM}):{comparable:{},motivo:'motor no disponible'};
      if(a&&(num(a.debito_iva)!=null||num(a.ppm)!=null)){
        var d=num(a.debito_iva),c=num(a.credito_iva),re=num(a.remanente);
        return {periodo:p,fuente:'Contable',comparable:ev.comparable,motivo:ev.motivo,evidencia:ev.evidencia,registradoAt:ev.registradoAt,
          iva:d!=null&&c!=null&&F?F.calcularF29Estimado({debito:d,credito:c,remanente:re||0,ppm:0}).ivaPagar:null,
          ppm:num(a.ppm),debito:d,credito:c,ventas:num(a.ppm_base),tasa:num(a.ppm_tasa)};
      }
      if(b){var f=num(b.f29),pp=num(b.ppm);
        return {periodo:p,fuente:'Pre-IVA enviado',comparable:{iva:false,debito:false,credito:false,ppm:false,ventas:false},motivo:'Pre-IVA enviado (estimación): no entra en promedios',
          registradoAt:b.fecha_envio,iva:f!=null?Math.max(f-(pp||0),0):null,ppm:pp,debito:null,credito:null,ventas:null,tasa:num(b.tasa_ppm)};}   // neto_ventas no es la misma base que ppm_base: no se mezcla
      return {periodo:p,fuente:null,comparable:{iva:false,debito:false,credito:false,ppm:false,ventas:false},motivo:errRM?'error de lectura de reportes_mensuales':'sin registro',iva:null,ppm:null,debito:null,credito:null,ventas:null,tasa:null};
    });
    return {filas:filas,error:r[0]&&r[0].error?r[0].error:null};
  });
}

/* ── MiRenta: caso 14 D N°3 del cliente + proyección vigente (solo outputs del motor) ── */
var OUT_KEYS=['forecast.idpc','forecast.ppm.imputable','forecast.saldo_abril','sim.ppm_voluntario.cuota_mensual','actual.ppm.imputable'];
function renta(cli,ex){
  var planIncluye=cli.plan==='asesoria'||cli.plan==='estrategico';
  // MiRenta solo la ven el Master y los analistas contables: para otros roles la RLS devuelve vacío y NO se puede
  // concluir "sin proyección" (se evita recomendar "actívala" por un problema de permisos).
  var u={};try{u=JSON.parse(sessionStorage.getItem('usuario_activo')||'{}');}catch(e){}
  if(!(u.esMaster||u.rol==='contable'||u.rol==='master'))return Promise.resolve({estado:'sin_permiso'});
  return get('renta_casos?cliente_id=eq.'+encodeURIComponent(cli.id)+'&regimen=eq.14D3&estado=neq.RECTIFIED&select=id,anio_comercial,anio_tributario,regimen,estado&order=anio_comercial.desc,id.desc&limit=1').then(function(cs){
    var caso=(cs||[])[0];
    if(!caso)return {estado:'sin_caso',regimen:ex.regimen,planIncluye:planIncluye};
    return rpc('renta_e1_proyeccion_vigente',{p_caso_id:caso.id}).then(function(vg){
      vg=vg||{};var o={};
      (vg.outputs||[]).forEach(function(x){if(OUT_KEYS.indexOf(x.output_key)>=0)o[x.output_key]=(x.estado_dato==='PENDING'||x.estado_dato==='PARAM_UNAVAILABLE')?null:num(x.monto);});
      return {estado:vg.estado||'SIN_PROYECCION',casoId:caso.id,anioTributario:caso.anio_tributario,anioComercial:caso.anio_comercial,outputs:o,
        finalizado:vg.corrida&&vg.corrida.finalizado_at||null,corte:vg.corrida&&vg.corrida.cutoff_date||null,regimen:ex.regimen,planIncluye:planIncluye};
    });
  }).catch(function(e){return {estado:'error',error:e.message};});   // sin permiso a MiRenta (no contable) o error: no se recomienda nada
}

function cargar(cli,periodo){
  var per=perDb(periodo);
  return extra(cli).then(function(ex){
    return Promise.all([frescura(cli,per),documentos(cli,per),historial(cli,per),renta(cli,ex)]).then(function(r){
      return {cliente:cli.id,periodo:per,extra:ex,sii:r[0],docs:r[1],hist:r[2],renta:r[3]};
    });
  });
}
// Botón "Actualizar desde el SII" (bolsa manual, tope 10 por cliente al mes). Solo se usa cuando sapi_frescura existe.
function actualizarSii(cli,periodo,tipo){
  var per=perDb(periodo);
  if(window.PIO_DEMO_API&&window.PIO_DEMO_API.actualizarSii)return window.PIO_DEMO_API.actualizarSii(cli,per,tipo);
  return fetch(SB_URL+'/functions/v1/simpleapi-conector',{method:'POST',headers:sbH(),body:JSON.stringify({accion:'consultar',clienteId:Number(cli.id),periodo:per,tipo:tipo})}).then(leer);
}
window.PioDatos={cargar:cargar,actualizarSii:actualizarSii,previos:previos,mover:mover,perDb:perDb};
})();
