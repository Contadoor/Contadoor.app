/* ============================================================
   admin/carga-claves-nucleo.js — Núcleo PURO de la carga masiva de claves (sin DOM, sin red).
   Lo usan la página (carga-claves.js) y las pruebas de Node (carga-claves.test.js).
   Reglas (ronda 2, ChatGPT 23-oct):
     · La CLAVE se toma EXACTA de la celda: sin trim ni ninguna normalización. Solo una celda totalmente vacía ('' o sin celda)
       significa "no tocar". Una celda de clave que no es texto (número, fecha, booleano) se rechaza: Excel ya la alteró
       (ceros a la izquierda, 1,2E+11…) y no hay forma segura de recuperar el valor.
     · El usuario / RUT de acceso NO es secreto: se le quitan espacios de los bordes y el RUT se normaliza.
     · Lotes por filas (≤ 50) Y por tamaño (JSON UTF-8 ≤ 200.000 bytes, margen bajo los 262.144 de la Edge).
   ============================================================ */
(function(raiz){
  'use strict';
  var N={};
  // Mismo catálogo que la Edge (slugs FIX2.2). 'extra' no entra: no tiene slug fijo.
  N.TIPOS=[
    {t:'sii',      n:'SII',              u:'rut',   uh:'RUT de acceso'},
    {t:'previred', n:'Previred',         u:'texto', uh:'usuario'},
    {t:'cu',       n:'Clave Única',      u:'rut',   uh:'RUT de acceso'},
    {t:'fact',     n:'Facturación',      u:'texto', uh:'usuario'},
    {t:'lic',      n:'Portal Licencias', u:'texto', uh:'usuario'},
    {t:'tgr',      n:'Tesorería (TGR)',  u:null},
    {t:'banco',    n:'Banco',            u:null}
  ];
  N.LIM={MAX_BYTES_ARCHIVO:2*1024*1024, MAX_FILAS:1000, LOTE_FILAS:50, LOTE_BYTES:200000, MAX_CLAVE:1000, MAX_USUARIO:200};
  N.HOJA='Claves';
  N.COL={id:'id', rut:'RUT', razon:'Razón social'};
  N.colTiene=function(x){return x.n+' · ¿ya tiene?';};
  N.colUsuario=function(x){return x.n+' · '+x.uh;};
  N.colClave=function(x){return x.n+' · clave';};

  N.normRut=function(r){var s=String(r==null?'':r).replace(/[^0-9kK]/g,'').toUpperCase();return s.length<2?s:s.slice(0,-1)+'-'+s.slice(-1);};
  N.rutOk=function(r){
    var x=N.normRut(r); if(!/^[0-9]{7,8}-[0-9K]$/.test(x)) return false;
    var num=x.split('-')[0], dv=x.split('-')[1], suma=0, mul=2;
    for(var i=num.length-1;i>=0;i--){suma+=parseInt(num[i],10)*mul;mul=mul===7?2:mul+1;}
    var res=11-(suma%11); return (res===11?'0':res===10?'K':String(res))===dv;
  };

  // Hoja de SheetJS → matriz de celdas crudas {t, v} (sin formatear). Así la clave llega tal cual está guardada en el archivo.
  N.hojaAMatriz=function(XLSX,ws){
    if(!ws||!ws['!ref']) return [];
    var rg=XLSX.utils.decode_range(ws['!ref']);
    if(rg.e.r-rg.s.r+1>N.LIM.MAX_FILAS+1) return null;                // demasiadas filas: no se recorre
    var out=[];
    for(var r=rg.s.r;r<=rg.e.r;r++){
      var fila=[];
      for(var c=rg.s.c;c<=rg.e.c;c++){
        var cel=ws[XLSX.utils.encode_cell({r:r,c:c})];
        fila.push(cel&&cel.t!=='z'?{t:cel.t,v:cel.v}:null);
      }
      out.push(fila);
    }
    return out;
  };

  // Texto NO secreto (encabezados, id, RUT, usuario).
  function texto(cel){ if(!cel||cel.v==null) return ''; return String(cel.v); }
  // Clave: exacta. {vacia:true} | {clave:'...'} | {error:'clave_no_texto'}
  function secreto(cel){
    if(!cel||cel.v==null) return {vacia:true};
    if(cel.t!=='s') return {error:'clave_no_texto'};
    var v=String(cel.v);
    if(v.length===0) return {vacia:true};
    return {clave:v};
  }

  // Valida la matriz completa contra la cartera activa (porId: id → {id, rut, razon_social, tipos}).
  // Devuelve {filas:[...]} o {error:'...'}. Las claves quedan SOLO en el resultado (memoria de la página).
  N.validar=function(m,porId){
    if(m===null) return {error:'El archivo tiene más de '+N.LIM.MAX_FILAS+' filas.'};
    if(!m||m.length<2) return {error:'El archivo no tiene filas de clientes.'};
    if(m.length-1>N.LIM.MAX_FILAS) return {error:'El archivo tiene más de '+N.LIM.MAX_FILAS+' filas.'};
    var cab=m[0].map(function(h){return texto(h).trim();});
    var idx=function(n){return cab.indexOf(n);};
    if(idx(N.COL.id)<0||idx(N.COL.rut)<0) return {error:'Faltan las columnas "id" y "RUT". Usa la plantilla del paso 1 sin cambiar los encabezados.'};
    var cols=N.TIPOS.map(function(x){return {x:x, u:x.u?idx(N.colUsuario(x)):-1, c:idx(N.colClave(x))};});
    var faltan=cols.filter(function(k){return k.c<0||(k.x.u&&k.u<0);}).map(function(k){return k.x.n;});
    if(faltan.length===cols.length) return {error:'No se encontraron columnas de claves. Usa la plantilla del paso 1.'};
    if(faltan.length) return {error:'Faltan columnas de: '+faltan.join(', ')+'. Usa la plantilla del paso 1 sin cambiar los encabezados.'};
    var filas=[], vistos={};
    for(var i=1;i<m.length;i++){
      var a=m[i]||[], numFila=i+1;
      var cel=function(j){return j<0?null:(a[j]||null);};
      var idTxt=texto(cel(idx(N.COL.id))).trim(), rutTxt=texto(cel(idx(N.COL.rut))).trim();
      var f={fila:numFila, clienteId:/^[0-9]+$/.test(idTxt)?Number(idTxt):null, rut:N.normRut(rutTxt), cli:null, error:null, tipos:[]};
      var hayDatos=false;
      cols.forEach(function(k){
        var u=k.u>=0?texto(cel(k.u)).trim():'';
        var s=secreto(cel(k.c));
        if(!u&&s.vacia) return;                                         // totalmente vacío = no tocar
        hayDatos=true;
        var t={t:k.x.t, n:k.x.n, accion:null, motivo:null, usuario:null, clave:null};
        if(s.error) t.motivo=s.error;
        else if(s.vacia) t.motivo='falta_clave';
        else if(s.clave.length>N.LIM.MAX_CLAVE) t.motivo='clave_muy_larga';
        else if(k.x.u&&!u) t.motivo='usuario_requerido';
        else if(k.x.u&&u.length>N.LIM.MAX_USUARIO) t.motivo='usuario_muy_largo';
        else if(k.x.u==='rut'&&!N.rutOk(u)) t.motivo='usuario_rut_invalido';
        else if(!k.x.u&&u) t.motivo='usuario_no_aplica';
        if(!t.motivo){ t.usuario=k.x.u?(k.x.u==='rut'?N.normRut(u):u):null; t.clave=s.clave; }
        f.tipos.push(t);
      });
      if(!hayDatos) continue;
      if(f.clienteId===null) f.error='cliente_id_invalido';
      else if(!N.rutOk(rutTxt)) f.error='rut_invalido';
      else if(!porId[f.clienteId]) f.error='cliente_no_activo';
      else if(N.normRut(porId[f.clienteId].rut)!==f.rut) f.error='rut_no_calza';
      else if(vistos[f.clienteId]) f.error='fila_duplicada';
      if(f.clienteId!==null){ if(vistos[f.clienteId]&&!vistos[f.clienteId].error) vistos[f.clienteId].error='fila_duplicada'; vistos[f.clienteId]=vistos[f.clienteId]||f; }
      f.cli=f.clienteId!==null?porId[f.clienteId]||null:null;
      filas.push(f);
    }
    if(!filas.length) return {error:'El archivo no trae ninguna clave para cargar (todas las celdas de claves están vacías).'};
    return {filas:filas};
  };

  // Acción por tipo según "Reemplazar existentes" (no toca las claves).
  N.decidir=function(plan,reemplazar){
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
  };

  N.bytes=function(obj){
    var s=JSON.stringify(obj);
    if(typeof TextEncoder!=='undefined') return new TextEncoder().encode(s).length;
    return unescape(encodeURIComponent(s)).length;
  };

  // ── Envío y recuperación (ronda 3) ──
  // Cada clave a enviar es un "ítem": {fila, clienteId, rut, tipo, accion:'carga'|'reemplazo', usuario, clave, estado, codigo, resultado}.
  N.itemsDePlan=function(plan){
    var out=[];
    plan.filter(function(f){return !f.error&&f.cambia;}).forEach(function(f){
      f.tipos.forEach(function(t){ if(t.accion==='carga'||t.accion==='reemplazo') out.push({fila:f.fila, clienteId:f.clienteId, rut:f.rut, tipo:t.t, accion:t.accion, usuario:t.usuario, clave:t.clave, estado:'pendiente', codigo:null, resultado:null}); });
    });
    return out;
  };

  // Lotes: ≤ LOTE_FILAS filas y cuerpo JSON (con accion/reemplazar) ≤ LOTE_BYTES. Devuelve [{filas:[payload], items:[ítems]}].
  N.lotesDeItems=function(items,reemplazar){
    var porFila={}, orden=[];
    items.forEach(function(it){
      if(!porFila[it.fila]){ porFila[it.fila]={payload:{fila:it.fila, clienteId:it.clienteId, rut:it.rut, claves:{}}, items:[]}; orden.push(it.fila); }
      porFila[it.fila].payload.claves[it.tipo]=it.usuario!=null?{usuario:it.usuario,clave:it.clave}:{clave:it.clave};
      porFila[it.fila].items.push(it);
    });
    // Tamaño exacto sin re-serializar todo: JSON de {accion, reemplazar, filas:[]} + cada fila + una coma entre filas.
    var base=N.bytes({accion:'cargar',reemplazar:!!reemplazar,filas:[]});
    var grupos=[], actual=null, tam=base;
    orden.forEach(function(fila){
      var x=porFila[fila], b=N.bytes(x.payload);
      if(base+b>N.LIM.LOTE_BYTES) throw new Error('FILA_MUY_GRANDE');            // imposible con los máximos (7 × 1.000)
      var nuevo=tam+b+(actual&&actual.filas.length?1:0);
      if(!actual||actual.filas.length>=N.LIM.LOTE_FILAS||nuevo>N.LIM.LOTE_BYTES){ actual={filas:[x.payload],items:x.items.slice()}; grupos.push(actual); tam=base+b; }
      else { actual.filas.push(x.payload); actual.items=actual.items.concat(x.items); tam=nuevo; }
    });
    return grupos;
  };
  // Compatibilidad: lotes desde el plan (solo los payloads).
  N.armarLotes=function(plan,reemplazar){ return N.lotesDeItems(N.itemsDePlan(plan),reemplazar).map(function(g){return g.filas;}); };

  // Asigna a cada ítem del lote lo que pasó, con la respuesta de la Edge ({status, json}) o un fallo de red (status 0/undefined).
  //   ok           → confirmado por la base (cargada / reemplazada / sin_cambio)
  //   no_guardada  → la base lo rechazó (rollback confirmado): no quedó
  //   incierta     → no se sabe (respuesta perdida, timeout, 5xx): pudo quedar guardada → verificar antes de reintentar
  //   error        → error de datos definitivo (rut, cliente inactivo, dos claves del tipo…)
  //   no_procesada → no se intentó (el lote se detuvo antes, o el servidor rechazó el lote antes de escribir: 400/401/403/405/413)
  N.evaluarLote=function(items,r){
    var ok=r&&r.status===200&&r.json&&r.json.ok===true;
    if(!ok){
      var antes=!!r&&[400,401,403,405,413].indexOf(r.status)>=0;
      items.forEach(function(it){ it.estado=antes?'no_procesada':'incierta'; it.codigo=antes?'http':'resultado_incierto'; it.status=r?r.status:0; });
      return {detenido:true};
    }
    var j=r.json, conf={}, err={}, errFila={};
    (j.confirmadas||[]).forEach(function(c){conf[c.fila+':'+c.tipo]=c.resultado;});
    (j.errores||[]).forEach(function(e){ if(e.tipo) err[e.fila+':'+e.tipo]=e.codigo; else errFila[e.fila]=e.codigo; });
    items.forEach(function(it){
      var k=it.fila+':'+it.tipo; it.status=null;
      if(conf[k]){ it.estado='ok'; it.resultado=conf[k]; it.codigo=null; }
      else if(err[k]==='guardar_fallo'){ it.estado='no_guardada'; it.codigo='guardar_fallo'; }
      else if(err[k]==='resultado_incierto'){ it.estado='incierta'; it.codigo='resultado_incierto'; }
      else if(err[k]){ it.estado='error'; it.codigo=err[k]; }
      else if(errFila[it.fila]){ it.estado='error'; it.codigo=errFila[it.fila]; }
      else { it.estado='no_procesada'; it.codigo='no_procesada'; }
    });
    return {detenido:!!j.abortado};
  };
  N.marcarNoProcesadas=function(items){ items.forEach(function(it){ if(it.estado==='pendiente'){ it.estado='no_procesada'; it.codigo='no_procesada'; } }); };

  // Pendientes, cada grupo con la opción CORRECTA de reintento:
  //   nuevas     → reintentar SIN "Reemplazar" (solo llena tipos vacíos)
  //   reemplazos → reintentar CON "Reemplazar" (sin él saldrían "sin cambio" y la clave nueva NO se aplicaría)
  //   inciertas  → primero VERIFICAR (acción 'estado'); no se puede reintentar todavía
  N.pendientes=function(items){
    var p={nuevas:[],reemplazos:[],inciertas:[]};
    items.forEach(function(it){
      if(it.estado==='incierta') p.inciertas.push(it);
      else if(it.estado==='no_guardada'||it.estado==='no_procesada'||it.estado==='reemplazo_no_confirmado'){
        (it.accion==='reemplazo'?p.reemplazos:p.nuevas).push(it);
      }
    });
    return p;
  };

  // Verificación con el estado fresco de la cartera (tipos con clave activa, sin valores):
  //   incierta + era carga     → si el tipo YA está activo: quedó guardada ('verificada'); si no: no se guardó → nueva pendiente
  //   incierta + era reemplazo → el tipo existe antes y después: no se puede saber si el valor nuevo quedó → 'reemplazo_no_confirmado'
  //                              (se ofrece reintentar CON Reemplazar, que reescribe el valor del archivo, con confirmación)
  N.reverificar=function(items,porId){
    items.forEach(function(it){
      if(it.estado!=='incierta') return;
      var c=porId[it.clienteId], tiene=!!c&&c.tipos.indexOf(it.tipo)>=0;
      if(it.accion==='carga'){ if(tiene){ it.estado='verificada'; it.codigo=null; } else { it.estado='no_guardada'; it.codigo='verificada_ausente'; } }
      else { it.estado='reemplazo_no_confirmado'; it.codigo='reemplazo_no_confirmado'; }
    });
    return N.pendientes(items);
  };

  // Suelta las claves de los ítems que ya no están pendientes (o de todos).
  N.soltarClaves=function(items,todos){
    items.forEach(function(it){
      var pend=it.estado==='incierta'||it.estado==='no_guardada'||it.estado==='no_procesada'||it.estado==='reemplazo_no_confirmado';
      if(todos||!pend){ it.clave=null; it.usuario=null; }
    });
  };

  if(typeof module!=='undefined'&&module.exports) module.exports=N; else raiz.CCLNucleo=N;
})(typeof window!=='undefined'?window:this);
