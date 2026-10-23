/* admin/carga-claves-demo.js — SOLO para probar en local (candado 2 de 3): datos FICTICIOS, sin Supabase, nada se guarda.
   Fuera de localhost / 127.0.0.1 / [::1] no define nada (la página exige sesión de Master con auth.js). */
(function(){
  var h=location.hostname;
  if(!(h==='localhost'||h==='127.0.0.1'||h==='[::1]')||!window.CCL_DEMO) return;
  window._contadoorSesion={nombre:'Master (demo)',rol:'master',esMaster:true,modulos:[]};
  setTimeout(function(){document.documentElement.classList.remove('auth-pending');},50);

  // Cartera ficticia (RUT con dígito verificador válido, empresas inventadas).
  var CLIENTES=[
    {id:101,rut:'76086428-5',razon_social:'Panadería Los Aromos SpA',tipos:['sii']},
    {id:102,rut:'77166269-2',razon_social:'Transportes Cordillera Ltda.',tipos:[]},
    {id:103,rut:'96790240-3',razon_social:'Ferretería El Clavo SA',tipos:['sii','previred']},
    {id:104,rut:'11111111-1',razon_social:'Consultora Andes EIRL',tipos:[]},
    {id:105,rut:'22222222-2',razon_social:'Óptica Visión Clara SpA',tipos:[]},
    {id:106,rut:'33333333-3',razon_social:'Jardín Infantil Pequeños Pasos Ltda.',tipos:['tgr']},
    {id:107,rut:'44444444-4',razon_social:'Constructora Piedra Azul SpA',tipos:[]},
    {id:108,rut:'55555555-5',razon_social:'Minimarket Don Lucho',tipos:[]}
  ];
  var vault={}; CLIENTES.forEach(function(c){vault[c.id]=c.tipos.slice();});
  // El cliente 103 simula dos claves SII activas (la Edge responde varias_claves_tipo).
  window.CCL_DEMO_EDGE=function(body){
    return new Promise(function(ok){ setTimeout(function(){
      if(body.accion==='estado') return ok({status:200,json:{ok:true,clientes:CLIENTES.map(function(c){return {id:c.id,rut:c.rut,razon_social:c.razon_social,tipos:vault[c.id].slice()};})}});
      if(body.accion!=='cargar') return ok({status:400,json:{ok:false,error:'accion inválida'}});
      var r={ok:true,cargadas:0,reemplazadas:0,sin_cambio:0,errores:[],abortado:false,confirmadas:[]};
      // ?falla=reemplazo → el reemplazo de SII de 101 lo rechaza la base (rollback) y el lote se detiene.
      // ?falla=incierto  → la SII de 102 se GUARDA pero la respuesta "se pierde" (resultado_incierto) y el lote se detiene.
      var falla=(location.search.match(/[?&]falla=([a-z]+)/)||[])[1]||'';
      for(var i=0;i<body.filas.length&&!r.abortado;i++){
        var f=body.filas[i], tipos=Object.keys(f.claves);
        for(var k=0;k<tipos.length;k++){
          var t=tipos[k];
          if(f.clienteId===103&&t==='sii'){ r.errores.push({fila:f.fila,clienteId:f.clienteId,tipo:t,codigo:'varias_claves_tipo'}); continue; }
          var tiene=vault[f.clienteId].indexOf(t)>=0;
          if(tiene&&!body.reemplazar){ r.sin_cambio++; r.confirmadas.push({fila:f.fila,tipo:t,resultado:'sin_cambio'}); continue; }
          if(falla==='reemplazo'&&tiene&&f.clienteId===101&&t==='sii'&&!window.CCL_DEMO_FALLO_USADO){ window.CCL_DEMO_FALLO_USADO=1; r.errores.push({fila:f.fila,clienteId:f.clienteId,tipo:t,codigo:'guardar_fallo'}); r.abortado=true; break; }
          if(tiene){ r.reemplazadas++; r.confirmadas.push({fila:f.fila,tipo:t,resultado:'reemplazada'}); }
          else { vault[f.clienteId].push(t); r.cargadas++; r.confirmadas.push({fila:f.fila,tipo:t,resultado:'cargada'}); }
          if(falla==='incierto'&&f.clienteId===102&&t==='sii'&&!window.CCL_DEMO_FALLO_USADO){ window.CCL_DEMO_FALLO_USADO=1; r.cargadas--; r.confirmadas.pop(); r.errores.push({fila:f.fila,clienteId:f.clienteId,tipo:t,codigo:'resultado_incierto'}); r.abortado=true; break; }
        }
      }
      // La demo deja ver en la página de prueba QUÉ llegó a la "Edge" (sin valores), para comprobar que no viaja el archivo completo.
      window.CCL_DEMO_RECIBIDO=(window.CCL_DEMO_RECIBIDO||[]).concat([{filas:body.filas.length,reemplazar:body.reemplazar,campos:Object.keys(body).sort().join(','),bytes:JSON.stringify(body).length}]);
      ok({status:200,json:r});
    },350); });
  };
})();
