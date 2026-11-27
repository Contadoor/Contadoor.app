/* ============================================================
   pre-iva/operativa-demo.js — Datos 100 % FICTICIOS para revisar la Pantalla 2 del Pre-IVA en local.
   Candado 2: solo actúa en localhost / 127.0.0.1 / [::1] y con ?demo=1. No se conecta a Supabase, no guarda y no envía correos.
   Nombres, RUT y montos son inventados: no corresponden a ningún cliente real.
   Uso:  pre-iva/index.html?demo=1&cliente=1   (1 = afecta con todo · 2 = exenta de IVA · 3 = sin datos ni condición de IVA)
         &sii=al_dia | desactualizado | sin_datos   simula la conexión con el SII activa (por defecto: pendiente de activación)
         &cartapra=1   simula la RPC sii_preiva_periodo (SII-PREIVA-F2b) con compras y ventas del SII para el cliente 1
         &vivo=1   (27-11) simula la RPC preiva_historial_vivo (Pre-IVA vivo): 6 meses del SII para el cliente 1 (F29 declarados, uno estimado, uno sin dato)
         &cob=verde | amarillo | rojo | sin   (con &cartapra=1) simula F29 del año (sii_renta_resumen) y la proyección de renta para «Cobertura de la renta»
         &rem=sin   (19-11) el mes anterior NO está declarado en el SII ni hay remanente en Contable → Pre-IVA bloqueado (nunca $0);
                    «Ingresar remanente a mano» responde como la RPC registrar_remanente_anterior_manual (solo demo, no guarda nada real)
   ============================================================ */
(function(){
  var h=location.hostname, local=(h==='localhost'||h==='127.0.0.1'||h==='[::1]');
  var qs=new URLSearchParams(location.search);
  if(!local||qs.get('demo')!=='1')return;
  var SII=qs.get('sii'), REM_SIN=qs.get('rem')==='sin', REM_MAN=null;
  function z(n){return (n<10?'0':'')+n;}
  var hoy=new Date(), HOY=hoy.getFullYear()+'-'+z(hoy.getMonth()+1)+'-'+z(hoy.getDate());
  var PER=/^\d{4}-(0[1-9]|1[0-2])$/.test(qs.get('periodo')||'')?qs.get('periodo'):hoy.getFullYear()+'-'+z(hoy.getMonth()+1);
  function mover(per,d){var y=+per.slice(0,4),m=+per.slice(5,7)-1+d;y+=Math.floor(m/12);m=((m%12)+12)%12;return y+'-'+z(m+1);}
  var PERS=[];for(var i=6;i>=1;i--)PERS.push(mover(PER,-i));PERS.push(PER);   // 6 previos + el abierto
  function dia(per,d){var max=new Date(+per.slice(0,4),+per.slice(5,7),0).getDate();return per+'-'+z(Math.min(d,max));}
  function masDias(iso,d){var t=Date.UTC(+iso.slice(0,4),+iso.slice(5,7)-1,+iso.slice(8,10))+d*864e5;return new Date(t).toISOString().slice(0,10);}
  var hoyDia=PER===HOY.slice(0,7)?+HOY.slice(8,10):28;

  try{if(!sessionStorage.getItem('usuario_activo'))sessionStorage.setItem('usuario_activo',JSON.stringify({nombre:'Analista Demo A',email:'demo@example.invalid',esMaster:true,rol:'master',rolLabel:'Master (demo)'}));}catch(e){}
  if(window.GEquipo&&window.GEquipo.fotoDemo)window.GEquipo.fotoDemo('Analista Demo A','../assets/equipo/demo-generica.svg');

  var CLI=[
    {id:1,rut:'DEMO-01',razon_social:'Comercial Demo Los Aromos SpA',email:'demo1@example.invalid',plan:'asesoria',estado:'activo',analista_contable:'Analista Demo A',regimen:'14D3',iva_condicion:'afecto',ppm_tasa_default:1.5},
    {id:2,rut:'DEMO-02',razon_social:'Colegio Demo Las Araucarias SpA',email:'demo2@example.invalid',plan:'estrategico',estado:'activo',analista_contable:'Analista Demo B',regimen:'14D3',iva_condicion:'exento',ppm_tasa_default:1.2},
    {id:3,rut:'DEMO-03',razon_social:'Taller Demo Norte SpA',email:'demo3@example.invalid',plan:'asesoria',estado:'activo',analista_contable:'',regimen:'14D3',iva_condicion:null,ppm_tasa_default:null}
  ];
  function cli(f){return CLI.filter(f);}

  /* ── Documentos ficticios del RCV ── */
  function d(o){var neto=o.neto||0, ex=o.exento||0, iva=o.iva!=null?o.iva:Math.round(neto*0.19);return Object.assign({tipo_dte:33,tipo_dte_label:'FACTURA ELECTRÓNICA',monto_neto:neto,monto_exento:ex,monto_iva:iva,monto_iva_recuperable:o.tipo==='compras'?iva:null,monto_total:neto+ex+iva,acuse_recibo:false,estado:'Confirmada'},o);}
  var DOCS={}, RES={};
  function snap(c,k,lib){return 1000+c*100+k*2+(lib==='compras'?1:0);}
  function agregar(c,k,lib,o){var s=snap(c,k,lib);(DOCS[s]=DOCS[s]||[]).push(d(Object.assign({snapshot_id:s,cliente_id:c,periodo:PERS[k],tipo:lib,posicion:(DOCS[s]||[]).length+1},o)));}
  var LBL={33:'FACTURA ELECTRÓNICA',34:'FACTURA NO AFECTA O EXENTA ELECTRÓNICA',61:'NOTA DE CRÉDITO ELECTRÓNICA',39:'BOLETA ELECTRÓNICA',41:'BOLETA EXENTA ELECTRÓNICA',48:'COMPROBANTE DE PAGO ELECTRÓNICO'};
  PERS.forEach(function(p,k){
    var actual=k===6, f=1+((k*37)%9)/100;   // pequeña variación mensual determinística
    // Cliente 1 (afecto) · compras
    if(!actual)agregar(1,k,'compras',{folio:String(4100+k),rut_contraparte:'DEMO-P01',razon_social_contraparte:'Arriendos Demo Ltda.',fecha_emision:dia(p,5),fecha_recepcion:dia(p,5),fecha_acuse:dia(p,7),neto:2000000});
    agregar(1,k,'compras',actual?{folio:'9001',rut_contraparte:'DEMO-P02',razon_social_contraparte:'Insumos Demo SpA',fecha_emision:dia(p,Math.max(1,hoyDia-3)),fecha_recepcion:masDias(dia(p,hoyDia),-2),neto:2000000}
      :{folio:String(7700+k),rut_contraparte:'DEMO-P02',razon_social_contraparte:'Insumos Demo SpA',fecha_emision:dia(p,8),fecha_recepcion:dia(p,9),fecha_acuse:dia(p,10),neto:Math.round(500000*f)});
    agregar(1,k,'compras',{folio:String(300+k),rut_contraparte:'DEMO-P03',razon_social_contraparte:'Servicios Demo de Aseo SpA',fecha_emision:dia(p,15),fecha_recepcion:dia(p,15),fecha_acuse:dia(p,16),neto:400000});
    agregar(1,k,'compras',{folio:String(900+k),rut_contraparte:'DEMO-P05',razon_social_contraparte:'Combustibles Demo SpA',fecha_emision:dia(p,3),fecha_recepcion:dia(p,3),fecha_acuse:dia(p,4),neto:Math.round(3200000*f)});
    if(actual){
      agregar(1,k,'compras',{folio:'55',rut_contraparte:'DEMO-P04',razon_social_contraparte:'Equipos Demo Pacífico SpA',fecha_emision:masDias(dia(p,hoyDia),-1),fecha_recepcion:masDias(dia(p,hoyDia),-1),neto:5000000});
      agregar(1,k,'compras',{folio:'812',rut_contraparte:'DEMO-P06',razon_social_contraparte:'Transportes Demo Sur Ltda.',fecha_emision:dia(p,9),fecha_recepcion:dia(p,9),fecha_reclamo:dia(p,12),estado:'Reclamado',neto:300000});
    }
    // Cliente 1 · ventas
    agregar(1,k,'ventas',{folio:String(15000+k*10),rut_contraparte:'DEMO-C01',razon_social_contraparte:'Cliente Demo Grande SpA',fecha_emision:dia(p,10),neto:Math.round(7000000*f)});
    if(!actual)agregar(1,k,'ventas',{folio:String(15001+k*10),rut_contraparte:'DEMO-C02',razon_social_contraparte:'Cliente Demo Mensual Ltda.',fecha_emision:dia(p,12),neto:1000000});
    agregar(1,k,'ventas',{folio:String(15002+k*10),rut_contraparte:'DEMO-C03',razon_social_contraparte:'Cliente Demo Ocasional SpA',fecha_emision:dia(p,18),neto:Math.round(1500000*f)});
    agregar(1,k,'ventas',{folio:String(15003+k*10),rut_contraparte:'DEMO-C04',razon_social_contraparte:'Cliente Demo Pequeño EIRL',fecha_emision:dia(p,20),neto:Math.round(900000*f)});
    if(actual)agregar(1,k,'ventas',{folio:'320',tipo_dte:61,tipo_dte_label:LBL[61],rut_contraparte:'DEMO-C01',razon_social_contraparte:'Cliente Demo Grande SpA',fecha_emision:dia(p,14),neto:250000});
    // Cliente 2 (exento) · ventas exentas y compras
    agregar(2,k,'ventas',{folio:String(800+k),tipo_dte:34,tipo_dte_label:LBL[34],rut_contraparte:'DEMO-C21',razon_social_contraparte:'Municipalidad Demo',fecha_emision:dia(p,6),neto:0,exento:Math.round(6000000*f),iva:0});
    agregar(2,k,'compras',{folio:String(5100+k),rut_contraparte:'DEMO-P21',razon_social_contraparte:'Librería Demo Escolar SpA',fecha_emision:dia(p,4),fecha_recepcion:dia(p,4),fecha_acuse:dia(p,6),neto:Math.round(800000*f)});
  });
  // Resúmenes (totales por tipo de documento) desde los documentos + boletas y comprobantes de pago (solo totales del SII)
  Object.keys(DOCS).forEach(function(s){
    var r={};DOCS[s].forEach(function(x){var t=r[x.tipo_dte]=r[x.tipo_dte]||{snapshot_id:+s,cliente_id:x.cliente_id,periodo:x.periodo,tipo:x.tipo,tipo_dte:x.tipo_dte,tipo_dte_label:x.tipo_dte_label,total_documentos:0,monto_exento:0,monto_neto:0,iva_recuperable:0,monto_total:0,creado_at:x.periodo===PER?new Date(hoy.getTime()-3*3600e3).toISOString():x.periodo+'-28T12:00:00Z'};
      t.total_documentos++;t.monto_exento+=x.monto_exento;t.monto_neto+=x.monto_neto;t.iva_recuperable+=x.monto_iva;t.monto_total+=x.monto_total;});
    RES[s]=Object.keys(r).map(function(k){return r[k];});
  });
  PERS.forEach(function(p,k){
    var s=snap(1,k,'ventas'), b=Math.round(3500000*(1+k/40));
    RES[s].push({snapshot_id:s,cliente_id:1,periodo:p,tipo:'ventas',tipo_dte:39,tipo_dte_label:LBL[39],total_documentos:180+k*5,monto_exento:0,monto_neto:b,iva_recuperable:Math.round(b*0.19),monto_total:Math.round(b*1.19),creado_at:k===6?new Date(hoy.getTime()-3*3600e3).toISOString():p+'-28T12:00:00Z'});
    if(k===6)RES[s].push({snapshot_id:s,cliente_id:1,periodo:p,tipo:'ventas',tipo_dte:48,tipo_dte_label:LBL[48],total_documentos:95,monto_exento:null,monto_neto:null,iva_recuperable:null,monto_total:2975000,creado_at:new Date().toISOString()});
    var s2=snap(2,k,'ventas');RES[s2].push({snapshot_id:s2,cliente_id:2,periodo:p,tipo:'ventas',tipo_dte:41,tipo_dte_label:LBL[41],total_documentos:60,monto_exento:Math.round(4000000*(1+k/50)),monto_neto:0,iva_recuperable:0,monto_total:Math.round(4000000*(1+k/50)),creado_at:p+'-28T12:00:00Z'});
  });

  /* ── Historial (reportes_mensuales y Pre-IVA enviados) ── */
  var RM={1:{},2:{}}, PV={1:{},2:{},3:{}};
  PERS.slice(0,6).forEach(function(p,k){
    var f=1+((k*37)%9)/100;
    if(k===0)return;                                   // cliente 1: el mes más antiguo queda "Sin dato"
    if(k===2){PV[1][p]={cliente_rut:'DEMO-01',periodo:p,debito_iva:2400000,credito_iva:1600000,remanente:0,f29:1015000,ppm:195000,tasa_ppm:1.5,neto_ventas:13000000,neto_compras:8400000,fecha_envio:p+'-25T15:00:00Z',enviado_por:'Analista Demo A'};return;}   // solo Pre-IVA enviado
    var deb=Math.round(2450000*f), cred=Math.round(1630000*f);
    RM[1][p]={periodo:p,debito_iva:deb,credito_iva:cred,remanente:0,f29:deb-cred+Math.round(12900000*f*0.015),ppm:Math.round(12900000*f*0.015),ppm_tasa:1.5,ppm_base:Math.round(12900000*f),iva_remanente_sig:0,
      procesado_at:mover(p,1)+'-15T15:00:00Z',estado_contable:k===5?'pendiente':'completado',updated_at:mover(p,1)+'-15T15:00:00Z'};   // el último mes queda sin evidencia (se muestra excluido)
  });
  PERS.slice(0,6).forEach(function(p,k){RM[2][p]={periodo:p,debito_iva:0,credito_iva:0,remanente:0,f29:120000+k*1000,ppm:120000+k*1000,ppm_tasa:1.2,ppm_base:10000000+k*80000,iva_remanente_sig:0,estado_contable:'completado',updated_at:mover(p,1)+'-18T12:00:00Z'};});
  var PANT={   // Pre-IVA del mes abierto (borrador) que lee la pantalla
    1:{cliente_rut:'DEMO-01',periodo:PER,debito_iva:1100000,credito_iva:600000,remanente:120000,f29:0,ppm:0,tasa_ppm:1.5,neto_ventas:0,neto_compras:0,por_tipo_doc_ventas:{},por_tipo_doc_compras:{},enviado_por:null,fecha_envio:null},
    2:{cliente_rut:'DEMO-02',periodo:PER,debito_iva:0,credito_iva:0,remanente:0,f29:0,ppm:0,tasa_ppm:1.2,neto_ventas:0,neto_compras:0,por_tipo_doc_ventas:{},por_tipo_doc_compras:{},enviado_por:null,fecha_envio:null}
  };

  /* ── MiRenta (proyecciones ficticias) ── */
  var corte=mover(PER,-1)+'-'+z(new Date(+mover(PER,-1).slice(0,4),+mover(PER,-1).slice(5,7),0).getDate());
  var ayer=new Date(hoy.getTime()-864e5).toISOString();
  function out(k,m){return {output_key:k,monto:m,estado_dato:'OK'};}
  var COB_PAG=118750*(+PER.slice(5,7)-1);   // PPM pagados del año en la demo de «Cobertura de la renta»
  var RENTA={501:{estado:'VIGENTE',corrida:{id:9501,cutoff_date:corte,finalizado_at:ayer},outputs:[out('forecast.idpc',53400000),out('forecast.ppm.imputable',24565821),out('forecast.saldo_abril',28834179),out('sim.ppm_voluntario.cuota_mensual',9611393)]},
    502:{estado:'DESACTUALIZADA',corrida:{id:9502,cutoff_date:mover(PER,-3)+'-30',finalizado_at:mover(PER,-2)+'-05T12:00:00Z'},outputs:[out('forecast.idpc',12000000),out('forecast.ppm.imputable',5000000),out('forecast.saldo_abril',7000000)]}};

  /* ── sbFetch ficticio ── */
  function resp(status,body){return Promise.resolve(new Response(body==null?'':JSON.stringify(body),{status:status,headers:{'Content-Type':'application/json'}}));}
  function par(path,k){var m=new RegExp('[?&]'+k+'=([^&]*)').exec(path);return m?decodeURIComponent(m[1]):null;}
  function eq(path,k){var v=par(path,k);return v&&v.indexOf('eq.')===0?v.slice(3):null;}
  function inL(path,k){var v=par(path,k);if(!v||v.indexOf('in.(')!==0)return null;return v.slice(4,-1).split(',').map(function(x){return x.replace(/"/g,'');});}
  window.sbFetch=function(path,opts){
    opts=opts||{};var met=(opts.method||'GET').toUpperCase(), tabla=path.split('?')[0];
    if(tabla==='clientes'){var id=eq(path,'id');return resp(200,id?cli(function(c){return String(c.id)===id;}).map(function(c){return {id:c.id,regimen:c.regimen,iva_condicion:c.iva_condicion};}):CLI);}
    if(tabla==='periodos')return resp(200,[{uf:39700,utm:68000,periodo:PER}]);
    if(tabla==='rpc/remanente_anterior'){   // REM-ANT-2 (demo): remanente anterior desde la base, con UTM ficticia 1:1
      var bR={};try{bR=JSON.parse(opts.body||'{}');}catch(e){}
      var cR=cli(function(x){return x.rut===bR.p_cliente_rut;})[0], pa=mover(bR.p_periodo||PER,-1), fR=cR&&(RM[cR.id]||{})[pa];
      if(REM_SIN&&cR&&cR.id===1)return resp(200,REM_MAN||{estado:'SIN_DATO',motivo:'SIN_MES_ANTERIOR',periodo:bR.p_periodo,periodo_anterior:pa});
      if(!fR)return resp(200,{estado:'SIN_DATO',motivo:'SIN_MES_ANTERIOR',periodo:bR.p_periodo,periodo_anterior:pa});
      var v77=cR.id===1?120000:(fR.iva_remanente_sig||0);
      return resp(200,{estado:'CONOCIDO',fuente:'MES_ANTERIOR',cod77:v77,cod504:v77,utm_origen:68000,utm_destino:68000,mes_utm_origen:bR.p_periodo,mes_utm_destino:mover(bR.p_periodo,1),periodo:bR.p_periodo,periodo_anterior:pa,metodo:'ART27_UTM_V1'});
    }
    if(tabla==='reportes_mensuales'){
      var rut=eq(path,'cliente_rut'), c=cli(function(x){return x.rut===rut;})[0], ps=inL(path,'periodo');
      if(!c)return resp(200,[]);
      if(REM_SIN&&par(path,'select')==='id'&&eq(path,'periodo')===PER)return resp(200,[{id:9000+c.id}]);   // reporte del mes (para el remanente a mano)
      if(ps)return resp(200,ps.map(function(p){return (RM[c.id]||{})[p];}).filter(Boolean));
      var pe=eq(path,'periodo'), row=(RM[c.id]||{})[pe];
      if(c.id===1&&pe===mover(PER,-1))return resp(200,[{iva_remanente_sig:120000,remanente:120000}]);
      return resp(200,row?[row]:[]);
    }
    if(tabla==='preiva_historial'){
      if(met!=='GET'){var b={};try{b=JSON.parse(opts.body||'{}');}catch(e){}
        var rr=eq(path,'cliente_rut')||b.cliente_rut, cc=cli(function(x){return x.rut===rr;})[0];
        if(cc){PANT[cc.id]=Object.assign({},PANT[cc.id]||{cliente_rut:rr,periodo:PER},b);return resp(200,[PANT[cc.id]]);}
        return resp(200,[]);}
      var r2=eq(path,'cliente_rut'), c2=cli(function(x){return x.rut===r2;})[0], ps2=inL(path,'periodo');
      if(!r2){var ruts=inL(path,'cliente_rut')||[];return resp(200,ruts.map(function(r){var x=cli(function(y){return y.rut===r;})[0];return x&&PANT[x.id]?{cliente_rut:r,fecha_envio:PANT[x.id].fecha_envio}:null;}).filter(Boolean));}
      if(!c2)return resp(200,[]);
      if(ps2)return resp(200,ps2.map(function(p){return PV[c2.id][p];}).filter(Boolean));
      if(par(path,'order'))return resp(200,Object.keys(PV[c2.id]).map(function(p){return PV[c2.id][p];}).concat(PANT[c2.id]?[PANT[c2.id]]:[]));
      return resp(200,eq(path,'periodo')===PER&&PANT[c2.id]?[PANT[c2.id]]:[]);
    }
    if(tabla==='rcv_resumenes'){var ci=eq(path,'cliente_id'), out2=[];Object.keys(RES).forEach(function(s){RES[s].forEach(function(x){if(String(x.cliente_id)===ci)out2.push(x);});});return resp(200,out2);}
    if(tabla==='rcv_documentos'){var off=+(par(path,'offset')||0);if(off>0)return resp(200,[]);var ids=inL(path,'snapshot_id')||[],o3=[];ids.forEach(function(s){(DOCS[s]||[]).forEach(function(x){o3.push(x);});});return resp(200,o3);}
    if(tabla==='renta_casos'&&qs.get('cob')&&eq(path,'cliente_id')==='1')return resp(200,[{id:503,anio_comercial:+PER.slice(0,4),anio_tributario:+PER.slice(0,4)+1,regimen:'14D3',estado:'IN_PROGRESS'}]);
    if(tabla==='renta_casos'){var c4=eq(path,'cliente_id');return resp(200,c4==='1'?[{id:501,anio_comercial:2026,anio_tributario:2027,regimen:'14D3',estado:'OPEN'}]:c4==='2'?[{id:502,anio_comercial:2026,anio_tributario:2027,regimen:'14D3',estado:'OPEN'}]:[]);}
    if(tabla==='rpc/renta_e1_proyeccion_vigente'){var a={};try{a=JSON.parse(opts.body||'{}');}catch(e){}
      if(a.p_caso_id===503){var fr={verde:0.95,amarillo:0.75,rojo:0.4}[qs.get('cob')];if(!fr)return resp(200,{estado:'SIN_PROYECCION'});
        return resp(200,{estado:'VIGENTE',corrida:{id:9503,cutoff_date:corte,finalizado_at:ayer},outputs:[out('forecast.idpc',Math.round(COB_PAG/fr/1000)*1000)]});}return resp(200,RENTA[a.p_caso_id]||{estado:'SIN_PROYECCION'});}
    if(tabla==='rpc/sii_renta_resumen'){   // 19-11 (demo): F29 del año del cliente 1 (base $9.500.000 · tasa 1,25 %) para «Cobertura de la renta»
      if(qs.get('cartapra')!=='1')return resp(404,{code:'PGRST202',message:'Could not find the function public.sii_renta_resumen'});
      var bA={};try{bA=JSON.parse(opts.body||'{}');}catch(e){}
      if(bA.p_cliente_id!==1)return resp(200,{conexion:{estado:'sin_conexion'},meses:[]});
      var ac=bA.p_anio_tributario-1, ms=[];for(var g=1;g<=12;g++){var pp=ac+z(g), dec=pp<PER.replace('-','');ms.push({periodo:pp,f29:dec?{folio:9200000000+g,ppm:118750,base_ppm:9500000,tasa_ppm:1.25,montos:true}:null});}
      return resp(200,{conexion:{estado:'conectada'},anio_comercial:ac,meses:ms});
    }
    if(tabla==='rpc/sii_preiva_periodo'){   // SII-PREIVA-F2b (demo): solo con &cartapra=1; si no, como si la RPC no estuviera instalada
      if(qs.get('cartapra')!=='1')return resp(404,{code:'PGRST202',message:'Could not find the function public.sii_preiva_periodo'});
      var bS={};try{bS=JSON.parse(opts.body||'{}');}catch(e){}
      if(bS.p_cliente_id!==1)return resp(200,{conexion:{estado:'sin_conexion'},ventas:null,compras:null,avisos:['sin_conexion']});
      var pS=String(bS.p_periodo).replace('-',''), aS=mover(pS.slice(0,4)+'-'+pS.slice(4),-1).replace('-','');
      return resp(200,{cliente_id:1,periodo:pS,fuente:'cartapra',conexion:{estado:'conectada',carga_inicial_lista:true},datos_al:new Date(hoy.getTime()-3*36e5).toISOString(),
        cobertura:{rcv_ventas:'completa',rcv_compras:'completa',honorarios:'completa'},
        ventas:{documentos:18,neto:9200000,exento:350000,iva:1748000,total:11298000,por_tipo:{'33':{n:16},'61':{n:1},'34':{n:1}}},
        compras:{registro:{documentos:41,neto:5100000,exento:0,iva:969000,total:6069000},pendiente:{documentos:2,iva:85500,total:535500},reclamado:{documentos:0,iva:0,total:0},no_incluir:{documentos:0,iva:0,total:0},por_tipo:{'33':{n:39},'61':{n:2}}},
        honorarios:null,f29_periodo:null,remanente_anterior:REM_SIN?{periodo:aS,cod77:null,cod504:null,fuente:'sin_f29'}:{periodo:aS,folio:9100000001,cod77:118000,fuente:'sii_codigo_77',metodo:'ART27_UTM_V1',mes_utm_origen:pS.slice(0,4)+'-'+pS.slice(4),mes_utm_destino:mover(pS.slice(0,4)+'-'+pS.slice(4),1),utm_origen:68000,utm_destino:68500,cod504:Math.round(118000*68500/68000),falta_utm:[]},sincronizado_en:new Date(hoy.getTime()-2*36e5).toISOString(),avisos:['compras_pendientes']});
    }
    if(tabla==='rpc/preiva_historial_vivo'){   // 27-11 (demo): solo con &vivo=1; si no, como si la RPC no estuviera instalada
      if(qs.get('vivo')!=='1')return resp(404,{code:'PGRST202',message:'Could not find the function public.preiva_historial_vivo'});
      var bH={};try{bH=JSON.parse(opts.body||'{}');}catch(e){}
      var pH=String(bH.p_periodo), mesesH=[];
      for(var k=6;k>=0;k--){var pk=mover(pH.slice(0,4)+'-'+pH.slice(4),-k).replace('-',''), ven=7000000+k*450000, com=Math.round(ven*0.55), deb=Math.round(ven*0.19), cre=Math.round(com*0.19), iva=deb-cre, ppm=Math.round(ven*0.0125);
        var fu=bH.p_cliente_id!==1||k===6?null:k===0||k===1?'estimado':'f29_sii';
        mesesH.push({periodo:pk,en_curso:k===0,fuente:fu,real:fu==='f29_sii',iva_pagar:fu?iva:null,total:fu?iva+ppm:null,ventas_neto:fu?ven:null,ventas_exento:fu?0:null,compras_neto:fu?com:null,compras_exento:fu?0:null,
          debito:fu?deb:null,credito:fu?cre:null,estimado:fu==='estimado'?{iva_pagar:iva,ppm:ppm,ppm_tasa:1.25,total:iva+ppm}:null,cobertura_completa:fu?true:null,datos_al:fu?new Date(hoy.getTime()-3*36e5).toISOString():null,
          f29_declarado:fu==='f29_sii'?{folio:9300000000+k,montos:true,total:iva+ppm,iva_pagar:iva,ppm:ppm,tasa_ppm:1.25,debito:deb,credito:cre}:null,reporte:null});}
      return resp(200,{ok:true,cliente_id:bH.p_cliente_id,periodo:pH,conexion:bH.p_cliente_id===1?'conectada':'sin_conexion',generado_en:new Date().toISOString(),fuente:'cartapra',meses:mesesH});
    }
    if(tabla==='rpc/registrar_remanente_anterior_manual'&&REM_SIN){   // 19-11 (demo): misma respuesta que la RPC real (ok + info de remanente_anterior)
      var bM={};try{bM=JSON.parse(opts.body||'{}');}catch(e){}
      if(String(bM.p_motivo||'').trim().length<10)return resp(400,{code:'22023',message:'MOTIVO_OBLIGATORIO: indica de dónde sale el monto'});
      REM_MAN={estado:'CONOCIDO',fuente:'F29_MANUAL',cod77:bM.p_cod77,cod504:Math.round(bM.p_cod77*68500/68000),utm_origen:68000,utm_destino:68500,mes_utm_origen:PER,mes_utm_destino:mover(PER,1),periodo:PER,periodo_anterior:mover(PER,-1),
        manual:{usuario_nombre:'Analista Demo A',registrado_at:new Date().toISOString(),motivo:String(bM.p_motivo).trim()}};
      return resp(200,{ok:true,auditoria_id:1,manual_id:1,info:REM_MAN});
    }
    if(tabla==='rpc/sapi_frescura'){
      if(!SII)return resp(404,{code:'PGRST202',message:'Could not find the function public.sapi_frescura'});
      var ult=SII==='sin_datos'?null:new Date(hoy.getTime()-(SII==='desactualizado'?6:0.2)*864e5).toISOString();
      return resp(200,{estado:SII,ultimaConsulta:ult,motivo:SII==='desactualizado'?'Datos con más de 3 días':null});
    }
    return resp(200,[]);
  };
  // Correo: en la demo NO se envía nada (ni se llama al proxy)
  var fetchReal=window.fetch.bind(window);
  window.fetch=function(u,o){
    var url=String(u&&u.url||u);
    if(/^https?:\/\//.test(url)&&url.indexOf(location.origin)!==0)return resp(200,{ok:false,error:'Modo demo: no se envía ningún correo ni se llama a servicios externos.'});
    return fetchReal(u,o);
  };
  window.PIO_DEMO_API={actualizarSii:function(c,per,tipo){return Promise.resolve({ok:true,codigo:'DEMO_SIN_CONSULTA'});}};
  document.addEventListener('DOMContentLoaded',function(){document.documentElement.classList.remove('auth-pending');});
})();
