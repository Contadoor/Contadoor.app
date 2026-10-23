/* ============================================================
   admin/carga-claves.js — Carga masiva de claves (solo Master)
   · Plantilla: Excel generado en el navegador (SheetJS) con la cartera activa y columnas de claves VACÍAS.
     La columna "¿ya tiene?" dice solo sí/no (viene de la Edge, que nunca entrega valores).
   · Subida: el archivo se lee AQUÍ (FileReader + SheetJS). No se sube a ningún storage; solo viajan a la Edge
     carga-masiva-credenciales los lotes (≤ 50 clientes) con las claves que se van a escribir.
   · Vista previa sin claves. "Reemplazar existentes" desmarcado por defecto.
   · Al terminar o cancelar se olvida todo (variables en null, input reseteado).
   · Este archivo NO usa console.* (ni siquiera para errores): nada de claves en consola.
   ============================================================ */
(function(){
  'use strict';

  // Mismo catálogo que la Edge (slugs FIX2.2). 'extra' no entra: no tiene slug fijo.
  var TIPOS=[
    {t:'sii',      n:'SII',              u:'rut',   uh:'RUT de acceso'},
    {t:'previred', n:'Previred',         u:'texto', uh:'usuario'},
    {t:'cu',       n:'Clave Única',      u:'rut',   uh:'RUT de acceso'},
    {t:'fact',     n:'Facturación',      u:'texto', uh:'usuario'},
    {t:'lic',      n:'Portal Licencias', u:'texto', uh:'usuario'},
    {t:'tgr',      n:'Tesorería (TGR)',  u:null},
    {t:'banco',    n:'Banco',            u:null}
  ];
  var MAX_BYTES=2*1024*1024, MAX_FILAS=1000, LOTE=50, MAX_CLAVE=1000, MAX_USUARIO=200;
  var HOJA='Claves';
  var COL={id:'id', rut:'RUT', razon:'Razón social'};
  function colTiene(x){return x.n+' · ¿ya tiene?';}
  function colUsuario(x){return x.n+' · '+x.uh;}
  function colClave(x){return x.n+' · clave';}

  var MOTIVOS={
    cliente_no_activo:'El id no está en la cartera activa', rut_no_calza:'El RUT no calza con el id', rut_invalido:'RUT inválido',
    cliente_id_invalido:'id vacío o inválido', fila_duplicada:'Cliente repetido en el archivo', cliente_no_existe:'El cliente no existe',
    falta_clave:'Falta la clave', usuario_requerido:'Falta el usuario / RUT de acceso', usuario_rut_invalido:'RUT de acceso inválido',
    usuario_no_aplica:'Este tipo no lleva usuario', clave_muy_larga:'Clave demasiado larga', usuario_muy_largo:'Usuario demasiado largo',
    tipo_invalido:'Tipo de clave no válido', formato_invalido:'Formato no válido', sin_claves:'Fila sin claves',
    varias_claves_tipo:'El cliente tiene más de una clave de este tipo: corrígelo a mano en su ficha',
    lectura_fallo:'No se pudo leer la bóveda (se detuvo)', guardar_fallo:'No se pudo guardar (se detuvo)',
    auditoria_fallo:'Guardada, pero el registro de accesos falló (se detuvo): avisar', conector_sii_fallo:'Guardada, pero el conector SII no se actualizó (se detuvo): avisar',
    http:'El servidor rechazó el lote (se detuvo)'
  };

  var $=function(id){return document.getElementById(id);};
  var cartera=null;      // [{id, rut, razon_social, tipos:[...]}] — sin valores
  var porId=null;        // Map id → cliente
  var plan=null;         // filas validadas CON claves en memoria (se borra al terminar)
  var filtro='cambios';
  var enviando=false;

  // ── Utilidades ──
  function normRut(r){var s=String(r==null?'':r).replace(/[^0-9kK]/g,'').toUpperCase();return s.length<2?s:s.slice(0,-1)+'-'+s.slice(-1);}
  function rutOk(r){
    var x=normRut(r); if(!/^[0-9]{7,8}-[0-9K]$/.test(x)) return false;
    var num=x.split('-')[0], dv=x.split('-')[1], suma=0, mul=2;
    for(var i=num.length-1;i>=0;i--){suma+=parseInt(num[i],10)*mul;mul=mul===7?2:mul+1;}
    var res=11-(suma%11); return (res===11?'0':res===10?'K':String(res))===dv;
  }
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
        wb=XLSX.read(new Uint8Array(fr.result),{type:'array',cellFormula:false,cellHTML:false,cellStyles:false,cellDates:false,bookVBA:false,WTF:false});
        var ws=wb.Sheets[HOJA]||wb.Sheets[wb.SheetNames[0]];
        if(!ws) throw new Error('hoja');
        aoa=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:'',blankrows:false});
      }catch(e){ errArchivo('El archivo no se pudo abrir como Excel. Usa la plantilla del paso 1.'); resetInput(); return; }
      finally{ wb=null; fr=null; }
      var r=validar(aoa); aoa=null;
      if(r.error){ errArchivo(r.error); resetInput(); return; }
      plan=r.filas;
      filtro='cambios';
      pintarPrevia();
    };
    fr.readAsArrayBuffer(file);
  }

  // Valida el archivo completo. Devuelve {filas:[...]} o {error:'...'}. Las claves quedan SOLO en plan (memoria).
  function validar(aoa){
    if(!aoa||aoa.length<2) return {error:'El archivo no tiene filas de clientes.'};
    if(aoa.length-1>MAX_FILAS) return {error:'El archivo tiene más de '+fmt(MAX_FILAS)+' filas.'};
    var cab=aoa[0].map(function(h){return String(h).trim();});
    var idx=function(n){return cab.indexOf(n);};
    if(idx(COL.id)<0||idx(COL.rut)<0) return {error:'Faltan las columnas "id" y "RUT". Usa la plantilla del paso 1 sin cambiar los encabezados.'};
    var cols=TIPOS.map(function(x){return {x:x, u:x.u?idx(colUsuario(x)):-1, c:idx(colClave(x))};});
    if(cols.every(function(k){return k.c<0;})) return {error:'No se encontraron columnas de claves. Usa la plantilla del paso 1.'};
    var faltan=cols.filter(function(k){return k.c<0||(k.x.u&&k.u<0);}).map(function(k){return k.x.n;});
    if(faltan.length) return {error:'Faltan columnas de: '+faltan.join(', ')+'. Usa la plantilla del paso 1 sin cambiar los encabezados.'};
    var filas=[], vistos={};
    for(var i=1;i<aoa.length;i++){
      var a=aoa[i], numFila=i+1;
      var celda=function(j){return j<0?'':String(a[j]==null?'':a[j]);};
      var idTxt=celda(idx(COL.id)).trim(), rutTxt=celda(idx(COL.rut)).trim();
      var f={fila:numFila, clienteId:/^[0-9]+$/.test(idTxt)?Number(idTxt):null, rut:normRut(rutTxt), cli:null, error:null, tipos:[]};
      var hayDatos=false;
      cols.forEach(function(k){
        var u=k.u>=0?celda(k.u).trim():'', c=celda(k.c).trim();
        if(!u&&!c) return;                                             // vacío = no tocar
        hayDatos=true;
        var t={t:k.x.t, n:k.x.n, accion:null, motivo:null, usuario:null, clave:null};
        if(!c) t.motivo='falta_clave';
        else if(c.length>MAX_CLAVE) t.motivo='clave_muy_larga';
        else if(k.x.u&&!u) t.motivo='usuario_requerido';
        else if(k.x.u&&u.length>MAX_USUARIO) t.motivo='usuario_muy_largo';
        else if(k.x.u==='rut'&&!rutOk(u)) t.motivo='usuario_rut_invalido';
        if(!t.motivo){ t.usuario=k.x.u?(k.x.u==='rut'?normRut(u):u):null; t.clave=c; }
        f.tipos.push(t);
      });
      if(!hayDatos) continue;                                          // fila sin claves: no se envía ni se muestra
      if(f.clienteId===null) f.error='cliente_id_invalido';
      else if(!rutOk(rutTxt)) f.error='rut_invalido';
      else if(!porId[f.clienteId]) f.error='cliente_no_activo';
      else if(normRut(porId[f.clienteId].rut)!==f.rut) f.error='rut_no_calza';
      else if(vistos[f.clienteId]) f.error='fila_duplicada';
      if(f.clienteId!==null){ if(vistos[f.clienteId]&&!vistos[f.clienteId].error) vistos[f.clienteId].error='fila_duplicada'; vistos[f.clienteId]=vistos[f.clienteId]||f; }
      f.cli=f.clienteId!==null?porId[f.clienteId]||null:null;
      filas.push(f);
    }
    if(!filas.length) return {error:'El archivo no trae ninguna clave para cargar (todas las celdas de claves están vacías).'};
    return {filas:filas};
  }

  // Decide la acción de cada tipo según "Reemplazar existentes" (sin tocar las claves).
  function decidir(){
    var reemplazar=$('cclReemplazar').checked;
    var tot={carga:0,reemplazo:0,igual:0,error:0,clientes:0};
    plan.forEach(function(f){
      var cambia=false;
      f.tipos.forEach(function(t){
        if(f.error){ t.accion='error'; return; }
        if(t.motivo){ t.accion='error'; tot.error++; return; }
        var tiene=f.cli&&f.cli.tipos.indexOf(t.t)>=0;
        t.accion=!tiene?'carga':(reemplazar?'reemplazo':'igual');
        tot[t.accion]++; if(t.accion!=='igual') cambia=true;
      });
      if(f.error) tot.error++;
      f.cambia=cambia; if(cambia) tot.clientes++;
    });
    return tot;
  }

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

  // ── Paso 3: envío en lotes ──
  function lotes(){
    var filas=plan.filter(function(f){return !f.error&&f.cambia;}).map(function(f){
      var claves={};
      f.tipos.forEach(function(t){ if(t.accion==='carga'||t.accion==='reemplazo'){ claves[t.t]=t.usuario!=null?{usuario:t.usuario,clave:t.clave}:{clave:t.clave}; } });
      return {fila:f.fila, clienteId:f.clienteId, rut:f.rut, claves:claves};
    });
    var out=[]; for(var i=0;i<filas.length;i+=LOTE) out.push(filas.slice(i,i+LOTE));
    return out;
  }

  function cargar(){
    if(!plan||enviando) return;
    var tot=decidir(), n=tot.carga+tot.reemplazo;
    if(!n) return;
    var reemplazar=$('cclReemplazar').checked;
    var msg='Se guardarán '+n+' clave(s) de '+tot.clientes+' cliente(s)'+(tot.reemplazo?(', y se REEMPLAZARÁN '+tot.reemplazo+' que ya existían'):'')+'.\n\n¿Continuar?';
    if(!window.confirm(msg)) return;
    var grupos=lotes();
    enviando=true;
    $('cclBtnCargar').disabled=true; $('cclBtnCancelar').disabled=true; $('cclArchivo').disabled=true; $('cclReemplazar').disabled=true;
    $('cclProgreso').hidden=false;
    var res={cargadas:0,reemplazadas:0,sin_cambio:0,errores:[],detenido:false};
    var i=0;
    function sig(){
      $('cclBarra').style.width=Math.round(i/grupos.length*100)+'%';
      $('cclTxtProg').textContent='Lote '+Math.min(i+1,grupos.length)+' de '+grupos.length+'…';
      if(i>=grupos.length) return fin(res);
      var g=grupos[i];
      edge({accion:'cargar',reemplazar:reemplazar,filas:g}).then(function(r){
        g=null; grupos[i]=null;                                         // el lote ya enviado se suelta de inmediato
        if(r.status!==200||!r.json||r.json.ok!==true){ res.errores.push({fila:null,clienteId:null,tipo:null,codigo:'http',status:r.status}); res.detenido=true; return fin(res); }
        var j=r.json;
        res.cargadas+=j.cargadas||0; res.reemplazadas+=j.reemplazadas||0; res.sin_cambio+=j.sin_cambio||0;
        (j.errores||[]).forEach(function(e){res.errores.push(e);});
        if(j.abortado){ res.detenido=true; return fin(res); }
        i++; sig();
      }).catch(function(e){ res.errores.push({fila:null,clienteId:null,tipo:null,codigo:'http',status:e&&e.status}); res.detenido=true; fin(res); });
    }
    sig();
  }

  function fin(res){
    var sinCambioPrevio=0;
    if(plan) plan.forEach(function(f){f.tipos.forEach(function(t){if(t.accion==='igual')sinCambioPrevio++;});});
    var erroresPrevios=[];
    if(plan) plan.forEach(function(f){
      if(f.error) erroresPrevios.push({fila:f.fila,clienteId:f.clienteId,tipo:null,codigo:f.error});
      else f.tipos.forEach(function(t){ if(t.accion==='error') erroresPrevios.push({fila:f.fila,clienteId:f.clienteId,tipo:t.t,codigo:t.motivo}); });
    });
    var nombres={}; if(plan) plan.forEach(function(f){ nombres[f.fila]=f.cli?f.cli.razon_social:null; });
    olvidar(true);                                                        // ← limpieza de la memoria del navegador
    enviando=false;
    var errores=erroresPrevios.concat(res.errores);
    var sinCambio=res.sin_cambio+sinCambioPrevio;
    $('cclPaso3').hidden=true; $('cclResultado').hidden=false;
    $('cclResumen').textContent=fmt(res.cargadas)+' cargadas, '+fmt(res.reemplazadas)+' reemplazadas, '+fmt(errores.length)+' con error'
      +(res.detenido?'. La carga se DETUVO por un problema del servidor: lo ya guardado quedó bien; puedes volver a subir el mismo archivo (lo cargado aparecerá como "sin cambio").':'.');
    kpis($('cclKpiRes'),[
      {i:'llave',ic:'ic-ver',v:res.cargadas,l:'cargadas',c:'verde'},
      {i:'repetir',ic:'ic-amb',v:res.reemplazadas,l:'reemplazadas',c:'ambar'},
      {i:'check',ic:'ic-cel',v:sinCambio,l:'sin cambio'},
      {i:'alerta',ic:'ic-roj',v:errores.length,l:'con error',c:'rojo'}
    ]);
    var cont=$('cclErrRes'); cont.textContent='';
    var nombreTipo={}; TIPOS.forEach(function(x){nombreTipo[x.t]=x.n;});
    errores.forEach(function(e){
      var d=el('div','fila mal');
      var cab=el('div','fila-cab');
      cab.appendChild(el('span','n t3',e.fila?'Fila '+e.fila:'Lote'));
      cab.appendChild(el('b','razon',(e.fila&&nombres[e.fila])||(e.clienteId?'Cliente #'+e.clienteId:'Servidor')));
      if(e.tipo) cab.appendChild(el('span','est rojo',nombreTipo[e.tipo]||e.tipo));
      d.appendChild(cab);
      d.appendChild(el('div','motivo t2',(MOTIVOS[e.codigo]||e.codigo)+(e.status?' (HTTP '+e.status+')':'')));
      cont.appendChild(d);
    });
    pintarIconos($('cclResultado'));
    $('cclResultado').scrollIntoView({behavior:'smooth',block:'start'});
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
    $('cclBtnOtra').addEventListener('click',function(){ $('cclResultado').hidden=true; $('cclZona').scrollIntoView({behavior:'smooth'}); });
    document.querySelectorAll('#cclPaso3 .chip').forEach(function(b){ b.addEventListener('click',function(){ filtro=b.getAttribute('data-f'); pintarPrevia(); }); });
    window.addEventListener('pagehide',function(){ olvidar(false); });
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
