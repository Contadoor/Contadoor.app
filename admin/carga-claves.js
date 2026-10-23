/* ============================================================
   admin/carga-claves.js — Carga masiva de claves (solo Master)
   · Plantilla: Excel generado en el navegador (SheetJS) con la cartera activa y columnas de claves VACÍAS.
     La columna "¿ya tiene?" dice solo sí/no (viene de la Edge, que nunca entrega valores).
   · Subida: el archivo se lee AQUÍ (FileReader + SheetJS). No se sube a ningún storage; solo viajan a la Edge
     carga-masiva-credenciales los lotes (≤ 50 clientes y ≤ 200.000 bytes) con las claves que se van a escribir.
   · La clave viaja EXACTA como está en la celda (sin trim). SheetJS 0.20.3 vendorizado (admin/vendor) con SRI.
   · Vista previa sin claves. "Reemplazar existentes" desmarcado por defecto.
   · Al terminar o cancelar se olvida todo (variables en null, input reseteado).
   · Este archivo NO usa console.* (ni siquiera para errores): nada de claves en consola.
   ============================================================ */
(function(){
  'use strict';

  // Catálogo, límites, validación y lotes viven en el núcleo puro (carga-claves-nucleo.js), probado en Node.
  var N=window.CCLNucleo;
  var TIPOS=N.TIPOS, COL=N.COL, HOJA=N.HOJA, colTiene=N.colTiene, colUsuario=N.colUsuario, colClave=N.colClave;
  var MAX_BYTES=N.LIM.MAX_BYTES_ARCHIVO;

  var MOTIVOS={
    rut_no_calza:'El RUT no calza con el id', rut_invalido:'RUT inválido',
    cliente_id_invalido:'id vacío o inválido', fila_duplicada:'Cliente repetido en el archivo', cliente_no_existe:'El cliente no existe',
    falta_clave:'Falta la clave', usuario_requerido:'Falta el usuario / RUT de acceso', usuario_rut_invalido:'RUT de acceso inválido',
    usuario_no_aplica:'Este tipo no lleva usuario', clave_muy_larga:'Clave demasiado larga', usuario_muy_largo:'Usuario demasiado largo',
    tipo_invalido:'Tipo de clave no válido', formato_invalido:'Formato no válido', sin_claves:'Fila sin claves',
    clave_no_texto:'La celda de la clave no está en formato texto (Excel pudo cambiarla): escríbela de nuevo en la plantilla',
    cliente_no_activo:'El cliente no está activo', slug_ocupado:'Hay otra clave con ese nombre interno: corrígelo a mano en su ficha',
    respuesta_desconocida:'Respuesta inesperada del servidor (se detuvo)',
    varias_claves_tipo:'El cliente tiene más de una clave de este tipo: corrígelo a mano en su ficha',
    guardar_fallo:'La base rechazó esta clave: no quedó (ni su registro ni el aviso SII)',
    resultado_incierto:'No se pudo confirmar el resultado de esta clave; la carga se detuvo. Verifica antes de reintentar',
    http:'El servidor rechazó el lote (se detuvo)'
  };

  var $=function(id){return document.getElementById(id);};
  var cartera=null;      // [{id, rut, razon_social, tipos:[...]}] — sin valores
  var porId=null;        // Map id → cliente
  var plan=null;         // filas validadas CON claves en memoria (se borra al terminar)
  var filtro='cambios';
  var enviando=false;

  // ── Utilidades ──
  function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
  function ico(nombre,color){
    var i=el('i','ic'+(color?' '+color:''));var s=el('span');s.setAttribute('data-g-ic',nombre);i.appendChild(s);
    if(window.gIconos) window.gIconos(i);
    return i;
  }
  function pintarIconos(root){ if(window.gIconos) window.gIconos(root||document); }
  function fmt(n){return Number(n||0).toLocaleString('es-CL');}
  var toastT=null;
  function toast(msg){var t=$('cclToast');t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('on');},3800);}
  function kpis(cont,items){
    cont.textContent='';
    items.forEach(function(k){
      var d=el('div','kpi '+(k.c||''));d.appendChild(ico(k.i,k.ic));
      var b=el('div');b.appendChild(el('b',null,fmt(k.v)));b.appendChild(el('span',null,k.l));d.appendChild(b);cont.appendChild(d);
    });
  }

  // ── Llamada a la Edge (JWT del usuario; nunca service_role ni anon como Bearer) ──
  function edge(body){
    if(window.CCL_DEMO) return window.CCL_DEMO_EDGE(body);
    var token=window._gestoorAccessToken;
    if(!token) return Promise.reject({status:401});
    return fetch(SB_URL+'/functions/v1/carga-masiva-credenciales',{
      method:'POST', cache:'no-store', credentials:'omit',
      headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+token},
      body:JSON.stringify(body)
    }).then(function(r){return r.json().catch(function(){return {};}).then(function(j){return {status:r.status,json:j};});});
  }

  // ── Inicio: solo Master ──
  function iniciar(){
    var ses=window._contadoorSesion||{};
    if(window.CCL_DEMO) $('cclDemo').hidden=false;
    if(ses.esMaster!==true){ $('cclCargando').hidden=true; $('cclNoMaster').hidden=false; return; }
    edge({accion:'estado'}).then(function(r){
      if(r.status===403){ $('cclCargando').hidden=true; $('cclNoMaster').hidden=false; return; }
      if(r.status!==200||!r.json||!Array.isArray(r.json.clientes)) throw {status:r.status};
      cartera=r.json.clientes; porId={};
      cartera.forEach(function(c){porId[c.id]=c;});
      $('cclCargando').hidden=true; $('cclMain').hidden=false;
      var conAlguna=cartera.filter(function(c){return c.tipos.length>0;}).length;
      var conSii=cartera.filter(function(c){return c.tipos.indexOf('sii')>=0;}).length;
      kpis($('cclKpiCartera'),[
        {i:'clientes',ic:'ic-mor',v:cartera.length,l:'clientes activos'},
        {i:'llave',ic:'ic-ver',v:conAlguna,l:'con alguna clave'},
        {i:'candado',ic:'ic-cel',v:conSii,l:'con clave SII'},
        {i:'alerta',ic:'ic-amb',v:cartera.length-conSii,l:'sin clave SII'}
      ]);
    }).catch(function(e){
      $('cclCargando').hidden=false;
      $('cclCargando').className='aviso rojo';
      $('cclCargando').textContent='No se pudo leer la cartera'+(e&&e.status?' (HTTP '+e.status+')':'')+'. Recarga la página; si sigue, avisa.';
    });
  }

  // ── Paso 1: plantilla ──
  function descargarPlantilla(){
    if(!cartera||!window.XLSX){toast('La plantilla aún no está lista. Recarga la página.');return;}
    var cab=[COL.id,COL.rut,COL.razon];
    TIPOS.forEach(function(x){cab.push(colTiene(x)); if(x.u) cab.push(colUsuario(x)); cab.push(colClave(x));});
    var filas=[cab];
    cartera.forEach(function(c){
      var f=[c.id,c.rut,c.razon_social];
      TIPOS.forEach(function(x){f.push(c.tipos.indexOf(x.t)>=0?'sí':'no'); if(x.u) f.push(''); f.push('');});
      filas.push(f);
    });
    var ws=XLSX.utils.aoa_to_sheet(filas);
    // Columnas de usuario/clave en formato TEXTO: así "0123" no pierde el cero ni un número largo se vuelve 1,2E+11.
    for(var r=1;r<filas.length;r++){
      for(var cIdx=3;cIdx<cab.length;cIdx++){
        if(/· ¿ya tiene\?$/.test(cab[cIdx])) continue;
        var ref=XLSX.utils.encode_cell({r:r,c:cIdx});
        ws[ref]={t:'s',v:'',z:'@'};
      }
    }
    ws['!cols']=cab.map(function(h,i){return {wch:i===0?6:i===1?13:i===2?34:/¿ya tiene/.test(h)?12:20};});
    ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:filas.length-1,c:cab.length-1}})};
    var ins=XLSX.utils.aoa_to_sheet([
      ['Carga masiva de claves · Gestoor'],[''],
      ['1. Llena solo las celdas de lo que quieras cargar. Celda vacía = no se toca.'],
      ['2. No cambies las columnas id, RUT ni Razón social (se usan para calzar cada cliente).'],
      ['3. SII y Clave Única: el usuario es un RUT (con o sin puntos).'],
      ['4. TGR y Banco solo llevan clave.'],
      ['   La clave se guarda EXACTAMENTE como la escribas (también espacios al inicio o al final). No cambies el formato Texto de las celdas.'],
      ['5. "¿ya tiene?" dice si HOY hay clave de ese tipo. Sin "Reemplazar existentes", esas no se tocan.'],
      ['6. Sube el archivo en Admin → Carga masiva de claves.'],
      ['7. Al terminar, BORRA este archivo de tu computador y vacía la papelera.']
    ]);
    ins['!cols']=[{wch:100}];
    var wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,HOJA);
    XLSX.utils.book_append_sheet(wb,ins,'Instrucciones');
    var hoy=new Date(); var d=hoy.getFullYear()+'-'+String(hoy.getMonth()+1).padStart(2,'0')+'-'+String(hoy.getDate()).padStart(2,'0');
    XLSX.writeFile(wb,'plantilla_claves_gestoor_'+d+'.xlsx',{compression:true});
    toast('Plantilla descargada: '+fmt(cartera.length)+' clientes, columnas de claves vacías.');
  }

  // ── Paso 2: leer el archivo en el navegador ──
  function errArchivo(msg){var e=$('cclErrArchivo');e.textContent=msg;e.hidden=!msg;}
  function leerArchivo(file){
    olvidar(false);
    errArchivo('');
    if(!file) return;
    if(!/\.xlsx$/i.test(file.name)){errArchivo('El archivo debe ser .xlsx (la plantilla del paso 1).');resetInput();return;}
    if(file.size>MAX_BYTES){errArchivo('El archivo pesa más de 2 MB. Usa la plantilla del paso 1.');resetInput();return;}
    var fr=new FileReader();
    fr.onerror=function(){errArchivo('No se pudo leer el archivo.');resetInput();};
    fr.onload=function(){
      var wb=null, aoa=null;
      try{
        wb=XLSX.read(new Uint8Array(fr.result),{type:'array',cellFormula:false,cellHTML:false,cellStyles:false,cellDates:false,cellText:false,bookVBA:false,WTF:false});
        var ws=wb.Sheets[HOJA]||wb.Sheets[wb.SheetNames[0]];
        if(!ws) throw new Error('hoja');
        aoa=N.hojaAMatriz(XLSX,ws);                                   // celdas crudas: la clave queda EXACTA (sin trim)
      }catch(e){ errArchivo('El archivo no se pudo abrir como Excel. Usa la plantilla del paso 1.'); resetInput(); return; }
      finally{ wb=null; fr=null; }
      var r=N.validar(aoa,porId); aoa=null;
      if(r.error){ errArchivo(r.error); resetInput(); return; }
      plan=r.filas;
      filtro='cambios';
      pintarPrevia();
    };
    fr.readAsArrayBuffer(file);
  }

  function decidir(){ return N.decidir(plan,$('cclReemplazar').checked); }

  var ETQ={carga:'se cargará',reemplazo:'se reemplazará',igual:'sin cambio',error:'error'};
  function pintarPrevia(){
    if(!plan) return;
    var tot=decidir();
    $('cclPaso3').hidden=false; $('cclResultado').hidden=true;
    kpis($('cclKpiPrevia'),[
      {i:'llave',ic:'ic-ver',v:tot.carga,l:'se cargarán',c:'verde'},
      {i:'repetir',ic:'ic-amb',v:tot.reemplazo,l:'se reemplazarán',c:'ambar'},
      {i:'check',ic:'ic-cel',v:tot.igual,l:'sin cambio'},
      {i:'alerta',ic:'ic-roj',v:tot.error,l:'con error',c:'rojo'}
    ]);
    document.querySelectorAll('#cclPaso3 .chip').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-f')===filtro);});
    var lista=$('cclLista'); lista.textContent='';
    var vis=plan.filter(function(f){
      if(filtro==='todos') return true;
      if(filtro==='errores') return !!f.error||f.tipos.some(function(t){return t.accion==='error';});
      return f.cambia||!!f.error||f.tipos.some(function(t){return t.accion==='error';});
    });
    if(!vis.length) lista.appendChild(el('div','aviso gris','Nada que mostrar con este filtro.'));
    vis.forEach(function(f){
      var card=el('div','fila'+((f.error||f.tipos.some(function(t){return t.accion==='error';}))?' mal':''));
      var cab=el('div','fila-cab');
      cab.appendChild(el('span','n t3','Fila '+f.fila));
      cab.appendChild(el('b','razon',f.cli?f.cli.razon_social:'Cliente '+(f.clienteId==null?'sin id':'#'+f.clienteId)));
      cab.appendChild(el('span','rut t3',f.cli?f.cli.rut:(f.rut||'')));
      card.appendChild(cab);
      if(f.error){ var m=el('div','motivo'); m.appendChild(ico('alerta','ic-roj')); m.appendChild(el('span',null,MOTIVOS[f.error]+' · la fila completa no se carga')); card.appendChild(m); }
      var chips=el('div','chips');
      f.tipos.forEach(function(t){
        var c=el('span','est '+(f.error?'gris':{carga:'verde',reemplazo:'ambar',igual:'gris',error:'rojo'}[t.accion]));
        c.appendChild(el('b',null,t.n+':'));
        c.appendChild(document.createTextNode(' '+(f.error?'no se carga':t.accion==='error'?MOTIVOS[t.motivo]:ETQ[t.accion])));
        chips.appendChild(c);
      });
      card.appendChild(chips);
      lista.appendChild(card);
    });
    var n=tot.carga+tot.reemplazo;
    $('cclTxtCargar').textContent=n?('Cargar '+fmt(n)+' clave'+(n===1?'':'s')+' de '+fmt(tot.clientes)+' cliente'+(tot.clientes===1?'':'s')):'Nada que cargar';
    $('cclBtnCargar').disabled=!n;
    pintarIconos($('cclPaso3'));
  }

  // ── Paso 3: envío en lotes (≤ 50 clientes y ≤ 200.000 bytes por lote) ──
  // ejec = la carga en curso o terminada: ítems (una clave cada uno), errores de validación previos y nombres por fila.
  // Mientras haya PENDIENTES se conservan SOLO sus claves (para reintentar lo pendiente); todo lo demás se suelta al terminar.
  var ejec=null;

  function cargar(){
    if(!plan||enviando) return;
    var tot=decidir(), n=tot.carga+tot.reemplazo;
    if(!n) return;
    var reemplazar=$('cclReemplazar').checked;
    var msg='Se guardarán '+n+' clave(s) de '+tot.clientes+' cliente(s)'+(tot.reemplazo?(', y se REEMPLAZARÁN '+tot.reemplazo+' que ya existían'):'')+'.\n\n¿Continuar?';
    if(!window.confirm(msg)) return;
    var items=N.itemsDePlan(plan), grupos;
    try{ grupos=N.lotesDeItems(items,reemplazar); }catch(e){ toast('Una fila es demasiado grande para enviarse. Revisa el archivo.'); return; }
    var previos={sinCambio:0, errores:[]}, nombres={};
    plan.forEach(function(f){
      nombres[f.fila]=f.cli?f.cli.razon_social:(f.clienteId!=null?'Cliente #'+f.clienteId:null);
      if(f.error) previos.errores.push({fila:f.fila,clienteId:f.clienteId,tipo:null,codigo:f.error});
      else f.tipos.forEach(function(t){ if(t.accion==='igual') previos.sinCambio++; if(t.accion==='error') previos.errores.push({fila:f.fila,clienteId:f.clienteId,tipo:t.t,codigo:t.motivo}); });
    });
    ejec={items:items, previos:previos, nombres:nombres};
    olvidar(true);                                  // el plan (y su copia de las claves) ya no hace falta: solo quedan los ítems
    $('cclBtnCargar').disabled=true; $('cclBtnCancelar').disabled=true; $('cclArchivo').disabled=true; $('cclReemplazar').disabled=true;
    $('cclPaso3').hidden=false;
    enviar(grupos,reemplazar,function(){ $('cclPaso3').hidden=true; pintarResultado(); });
  }

  // Envía los grupos en orden; se detiene al primer lote detenido. Nunca muestra ni registra valores.
  function enviar(grupos,reemplazar,listo){
    enviando=true;
    $('cclProgreso').hidden=false;
    var i=0;
    function sig(){
      $('cclBarra').style.width=Math.round(i/grupos.length*100)+'%';
      $('cclTxtProg').textContent='Lote '+Math.min(i+1,grupos.length)+' de '+grupos.length+'…';
      if(i>=grupos.length) return terminar();
      var g=grupos[i];
      edge({accion:'cargar',reemplazar:reemplazar,filas:g.filas}).then(function(r){
        var ev=N.evaluarLote(g.items,r); g.filas=null;
        if(ev.detenido) return terminar();
        i++; sig();
      },function(){ N.evaluarLote(g.items,{status:0}); terminar(); });   // red caída: resultado NO confirmado
    }
    function terminar(){
      grupos.forEach(function(g){ N.marcarNoProcesadas(g.items); g.filas=null; });
      N.soltarClaves(ejec.items,false);                                   // solo quedan en memoria las claves pendientes
      enviando=false;
      $('cclProgreso').hidden=true; $('cclBarra').style.width='0';
      listo();
    }
    sig();
  }

  var NOMBRE_TIPO={}; TIPOS.forEach(function(x){NOMBRE_TIPO[x.t]=x.n;});
  function filaItem(it,clase,texto){
    var d=el('div','fila '+(clase||''));
    var cab=el('div','fila-cab');
    cab.appendChild(el('span','n t3',it.fila?'Fila '+it.fila:'Lote'));
    cab.appendChild(el('b','razon',(it.fila&&ejec.nombres[it.fila])||(it.clienteId?'Cliente #'+it.clienteId:'Servidor')));
    if(it.tipo) cab.appendChild(el('span','est '+(clase==='mal'?'rojo':clase==='duda'?'ambar':'gris'),NOMBRE_TIPO[it.tipo]||it.tipo));
    d.appendChild(cab);
    if(texto) d.appendChild(el('div','motivo t2',texto));
    return d;
  }

  function pintarResultado(){
    var its=ejec.items, cnt={cargada:0,reemplazada:0,sin_cambio:0};
    its.forEach(function(it){ if(it.estado==='ok') cnt[it.resultado]++; });
    var verificadas=its.filter(function(it){return it.estado==='verificada';});
    var errores=ejec.previos.errores.concat(its.filter(function(it){return it.estado==='error';}).map(function(it){return {fila:it.fila,clienteId:it.clienteId,tipo:it.tipo,codigo:it.codigo};}));
    var p=N.pendientes(its), nPend=p.nuevas.length+p.reemplazos.length+p.inciertas.length;
    $('cclResultado').hidden=false;
    $('cclResumen').textContent=fmt(cnt.cargada+verificadas.length)+' cargadas, '+fmt(cnt.reemplazada)+' reemplazadas, '+fmt(errores.length)+' con error'
      +(nPend?(', '+fmt(nPend)+' pendientes. Cada clave se guarda completa (clave + registro + aviso SII) o no se guarda; revisa abajo qué hacer con las pendientes.'):'.');
    kpis($('cclKpiRes'),[
      {i:'llave',ic:'ic-ver',v:cnt.cargada+verificadas.length,l:'cargadas',c:'verde'},
      {i:'repetir',ic:'ic-amb',v:cnt.reemplazada,l:'reemplazadas',c:'ambar'},
      {i:'check',ic:'ic-cel',v:cnt.sin_cambio+ejec.previos.sinCambio,l:'sin cambio'},
      {i:'alerta',ic:'ic-roj',v:errores.length+nPend,l:'con error o pendientes',c:'rojo'}
    ]);
    // Pendientes, cada caso con su opción correcta.
    var pc=$('cclPend'); pc.textContent='';
    if(p.inciertas.length){
      var a=el('div','aviso ambar fuerte'); a.appendChild(ico('alerta','ic-amb'));
      a.appendChild(el('span',null,p.inciertas.length+' clave(s) con resultado NO confirmado: se perdió la respuesta del servidor y pudieron quedar guardadas (con su registro y aviso SII). Verifica antes de reintentar.'));
      pc.appendChild(a);
      p.inciertas.forEach(function(it){ pc.appendChild(filaItem(it,'duda','Resultado no confirmado · '+(it.accion==='reemplazo'?'era un reemplazo':'era una clave nueva'))); });
      pc.appendChild(boton('Verificar estado ahora','ver',verificar));
    } else {
      if(p.nuevas.length){
        var b=el('div','aviso lila'); b.appendChild(ico('llave','ic-mor'));
        b.appendChild(el('span',null,p.nuevas.length+' clave(s) NUEVA(S) no quedaron guardadas o no alcanzaron a procesarse. Se reintentan SIN "Reemplazar": solo llenan tipos que siguen vacíos.'));
        pc.appendChild(b);
        p.nuevas.forEach(function(it){ pc.appendChild(filaItem(it,'',it.codigo==='no_procesada'?'No alcanzó a procesarse':'No se guardó')); });
        pc.appendChild(boton('Reintentar '+p.nuevas.length+' clave(s) nueva(s) · sin Reemplazar','llave',function(){ reintentar(p.nuevas,false); }));
      }
      if(p.reemplazos.length){
        var c=el('div','aviso ambar'); c.appendChild(ico('repetir','ic-amb'));
        c.appendChild(el('span',null,p.reemplazos.length+' REEMPLAZO(S) no se aplicaron o no se pudo confirmar que se aplicaran: la clave anterior puede seguir vigente. Ojo: volver a subir el archivo SIN "Reemplazar" NO los aplica (saldrían "sin cambio"). Se reintentan CON "Reemplazar", solo estas filas.'));
        pc.appendChild(c);
        p.reemplazos.forEach(function(it){ pc.appendChild(filaItem(it,'duda',it.estado==='reemplazo_no_confirmado'?'Reemplazo no confirmado: reintentar vuelve a escribir el valor del archivo':it.codigo==='no_procesada'?'No alcanzó a procesarse':'No se aplicó (la anterior sigue vigente)')); });
        pc.appendChild(boton('Reintentar '+p.reemplazos.length+' reemplazo(s) · CON Reemplazar','repetir',function(){ reintentar(p.reemplazos,true); }));
      }
    }
    if(nPend) pc.appendChild(boton('Olvidar pendientes (no reintentar)','basura',function(){ N.soltarClaves(ejec.items,true); ejec.items.forEach(function(it){ if(['incierta','no_guardada','no_procesada','reemplazo_no_confirmado'].indexOf(it.estado)>=0){ it.estado='olvidada'; } }); pintarResultado(); toast('Gestoor olvidó las claves pendientes.'); },'sec'));
    // Errores definitivos (datos).
    var cont=$('cclErrRes'); cont.textContent='';
    errores.forEach(function(e){ cont.appendChild(filaItem(e,'mal',MOTIVOS[e.codigo]||e.codigo)); });
    its.filter(function(it){return it.estado==='olvidada';}).forEach(function(it){ cont.appendChild(filaItem(it,'mal','Pendiente olvidada: no se reintentó')); });
    if(!nPend){ N.soltarClaves(ejec.items,true); }
    $('cclMemoria').textContent=nPend?('Mientras haya pendientes, esta pantalla guarda en memoria SOLO esas '+nPend+' clave(s) para reintentarlas; al reintentar, olvidar o salir de la página se borran.'):'Gestoor ya olvidó el archivo en esta pantalla.';
    pintarIconos($('cclResultado'));
    $('cclResultado').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function boton(txt,icono,fn,clase){
    var w=el('div','acciones'); var b=el('button','btn'+(clase?' '+clase:'')); b.type='button';
    b.appendChild(ico(icono)); b.appendChild(el('span',null,txt)); b.addEventListener('click',function(){ if(!enviando) fn(); }); w.appendChild(b); return w;
  }

  // Refresca la cartera con 'estado' (tipos con clave activa, sin valores) y reclasifica los pendientes.
  function refrescar(){
    return edge({accion:'estado'}).then(function(r){
      if(r.status!==200||!r.json||!Array.isArray(r.json.clientes)) throw {status:r.status};
      cartera=r.json.clientes; porId={}; cartera.forEach(function(c){porId[c.id]=c;});
      return N.reverificar(ejec.items,porId);
    });
  }
  function verificar(){
    refrescar().then(function(){ pintarResultado(); toast('Estado verificado. Revisa qué quedó pendiente.'); },
      function(e){ toast('No se pudo verificar el estado'+(e&&e.status?' (HTTP '+e.status+')':'')+'. Intenta de nuevo.'); });
  }

  function reintentar(lista,reemplazar){
    if(!lista.length) return;
    var msg=reemplazar?('Se volverán a escribir '+lista.length+' clave(s) CON "Reemplazar" (sobrescriben la clave actual con la del archivo).\n\n¿Continuar?')
                      :('Se reintentarán '+lista.length+' clave(s) nueva(s) SIN "Reemplazar".\n\n¿Continuar?');
    if(!window.confirm(msg)) return;
    refrescar().then(function(p){
      if(p.inciertas.length){ pintarResultado(); return; }
      var hoy=(reemplazar?p.reemplazos:p.nuevas).filter(function(it){return lista.indexOf(it)>=0;});
      if(!hoy.length){ pintarResultado(); toast('Ya no queda nada pendiente de ese tipo.'); return; }
      hoy.forEach(function(it){ it.estado='pendiente'; it.codigo=null; it.accion=reemplazar?'reemplazo':'carga'; });
      var grupos; try{ grupos=N.lotesDeItems(hoy,reemplazar); }catch(e){ toast('Una fila es demasiado grande.'); return; }
      $('cclResultado').hidden=true; $('cclPaso3').hidden=false; $('cclLista').textContent='';
      enviar(grupos,reemplazar,function(){ $('cclPaso3').hidden=true; pintarResultado(); });
    },function(e){ toast('No se pudo verificar el estado antes de reintentar'+(e&&e.status?' (HTTP '+e.status+')':'')+'.'); });
  }

  // ── Limpieza: soltar las claves de la memoria y resetear el input ──
  function resetInput(){ var i=$('cclArchivo'); if(i){ i.value=''; i.disabled=false; } }
  function olvidar(final){
    if(plan){ plan.forEach(function(f){ f.tipos.forEach(function(t){ t.clave=null; t.usuario=null; }); f.tipos=null; }); }
    plan=null;
    resetInput();
    $('cclReemplazar').disabled=false;
    $('cclBtnCancelar').disabled=false;
    $('cclProgreso').hidden=true; $('cclBarra').style.width='0';
    $('cclLista').textContent='';
    if(!final){ $('cclPaso3').hidden=true; }
  }

  // ── Eventos ──
  document.addEventListener('DOMContentLoaded',function(){
    $('cclBtnPlantilla').addEventListener('click',descargarPlantilla);
    $('cclArchivo').addEventListener('change',function(e){ var f=e.target.files&&e.target.files[0]; leerArchivo(f); });
    var zona=$('cclZona');
    ['dragenter','dragover'].forEach(function(ev){zona.addEventListener(ev,function(e){e.preventDefault();zona.classList.add('sobre');});});
    ['dragleave','drop'].forEach(function(ev){zona.addEventListener(ev,function(e){e.preventDefault();zona.classList.remove('sobre');});});
    zona.addEventListener('drop',function(e){ if(enviando) return; var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0]; leerArchivo(f); });
    $('cclReemplazar').addEventListener('change',function(){ if(plan) pintarPrevia(); });
    $('cclBtnCargar').addEventListener('click',cargar);
    $('cclBtnCancelar').addEventListener('click',function(){ olvidar(false); errArchivo(''); toast('Listo: Gestoor olvidó el archivo. Bórralo también de tu computador.'); });
    $('cclBtnOtra').addEventListener('click',function(){ if(ejec){ N.soltarClaves(ejec.items,true); ejec=null; } $('cclResultado').hidden=true; $('cclZona').scrollIntoView({behavior:'smooth'}); });
    document.querySelectorAll('#cclPaso3 .chip').forEach(function(b){ b.addEventListener('click',function(){ filtro=b.getAttribute('data-f'); pintarPrevia(); }); });
    window.addEventListener('pagehide',function(){ olvidar(false); if(ejec) N.soltarClaves(ejec.items,true); });
    window.addEventListener('beforeunload',function(e){ if(enviando){ e.preventDefault(); e.returnValue=''; } });
    pintarIconos(document);
  });

  // Igual que Admin: arrancar cuando auth.js confirma la sesión (retira auth-pending).
  function cuandoSesion(fn){
    var hecho=false; function go(){ if(hecho) return; hecho=true; fn(); }
    if(!document.documentElement.classList.contains('auth-pending')) return go();
    var obs=new MutationObserver(function(){ if(!document.documentElement.classList.contains('auth-pending')){ obs.disconnect(); go(); } });
    obs.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ cuandoSesion(iniciar); });
  else cuandoSesion(iniciar);
})();
