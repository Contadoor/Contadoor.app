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

  // Grupos para la Edge: ≤ LOTE_FILAS filas y cuerpo JSON (con accion/reemplazar) ≤ LOTE_BYTES. Solo viajan las claves que cambian.
  N.armarLotes=function(plan,reemplazar){
    var filas=plan.filter(function(f){return !f.error&&f.cambia;}).map(function(f){
      var claves={};
      f.tipos.forEach(function(t){ if(t.accion==='carga'||t.accion==='reemplazo'){ claves[t.t]=t.usuario!=null?{usuario:t.usuario,clave:t.clave}:{clave:t.clave}; } });
      return {fila:f.fila, clienteId:f.clienteId, rut:f.rut, claves:claves};
    });
    // Tamaño exacto sin re-serializar todo: JSON de {accion, reemplazar, filas:[]} + cada fila + una coma entre filas.
    var base=N.bytes({accion:'cargar',reemplazar:!!reemplazar,filas:[]});
    var grupos=[], actual=[], tam=base;
    filas.forEach(function(fl){
      var b=N.bytes(fl);
      if(base+b>N.LIM.LOTE_BYTES) throw new Error('FILA_MUY_GRANDE');            // imposible con los máximos (7 × 1.000)
      var nuevo=tam+b+(actual.length?1:0);
      if(actual.length>=N.LIM.LOTE_FILAS||nuevo>N.LIM.LOTE_BYTES){ grupos.push(actual); actual=[fl]; tam=base+b; }
      else { actual.push(fl); tam=nuevo; }
    });
    if(actual.length) grupos.push(actual);
    return grupos;
  };

  if(typeof module!=='undefined'&&module.exports) module.exports=N; else raiz.CCLNucleo=N;
})(typeof window!=='undefined'?window:this);
