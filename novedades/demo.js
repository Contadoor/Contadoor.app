/* ============================================================
   novedades/demo.js — MODO DEMO SOLO LOCAL del módulo Novedades
   Se activa ÚNICAMENTE si el host es localhost / 127.0.0.1 y la URL trae ?demo=1.
   En cualquier otro caso (gestoor.contadoor.cl incluido) este archivo no hace nada.
   - Sin red: simula las tablas novedades_hallazgos / novedades_piezas en memoria.
   - Va ANTES de supabase.js: marca el SDK como "listo" con un cliente de mentira
     para que auth.js muestre la página sin sesión real.
   ============================================================ */
(function(){
  var h=location.hostname;
  var esLocal=(h==='localhost'||h==='127.0.0.1');
  var pideDemo=/(?:^|[?&])demo=1(?:&|$)/.test(location.search.slice(1));
  if(!esLocal||!pideDemo) return;

  var perfilDemo={id:0,nombre:'Usuario Demo',iniciales:'UD',rol:'master',rol_label:'Master (demo)',es_master:true,activo:true,modulos:[],wa:'',email:'demo@ejemplo.invalid'};
  window._sbAuthReady=true;
  window._sbAuthClient={
    auth:{
      getUser:function(){return Promise.resolve({data:{user:{id:'demo',email:perfilDemo.email}},error:null});},
      getSession:function(){return Promise.resolve({data:{session:{user:{id:'demo'}}}});},
      onAuthStateChange:function(){},
      signOut:function(){return Promise.resolve();}
    },
    from:function(){var q={select:function(){return q;},eq:function(){return q;},single:function(){return Promise.resolve({data:perfilDemo,error:null});}};return q;}
  };
  window.addEventListener('gestoor-session-required',function(e){e.stopImmediatePropagation();},true);

  function hoy(d){var x=new Date();x.setDate(x.getDate()+(d||0));return x.toISOString().slice(0,10);}
  var seq=0;function id(){seq++;return '00000000-0000-4000-9000-'+String(seq).padStart(12,'0');}

  var H=[
    {titulo:'Cotizaciones de octubre: pago hasta el 10-nov (electrónico 13-nov)',organismo:'Previred / DT',url_fuente:'https://www.previred.com/',tipo_norma:'calendario',area:'previsional',prioridad:'P0',
     fecha_publicacion:hoy(-2),fecha_vigencia:'Remuneraciones de octubre',a_quien_afecta:'Todo empleador con trabajadores',plazos_montos:'Pago 10-nov; electrónico hasta 13-nov',
     accion:'Cerrar nómina con UTM de octubre y UF del 31-oct',riesgo:'Reajustes e intereses por pago fuera de plazo',confianza:'media',estado:'nuevo'},
    {titulo:'Cotización del empleador 3,5% (Ley 21.735) — revisar software de remuneraciones',organismo:'Superintendencia de Pensiones',url_fuente:'https://www.spensiones.cl/',tipo_norma:'ley',area:'previsional',prioridad:'P1',
     fecha_publicacion:'2026-08-01',fecha_vigencia:'Desde 01-ago-2026',a_quien_afecta:'Empleadores con trabajadores dependientes',accion:'Verificar que la liquidación aplique 3,5% con tope imponible',
     riesgo:'Cotizaciones mal declaradas',confianza:'media',estado:'en_revision'},
    {titulo:'Gobierno anuncia dos proyectos de ley ProPyme (ingreso a inicios de noviembre)',organismo:'Ministerio de Economía',url_fuente:'https://www.economia.gob.cl/',tipo_norma:'anuncio',area:'emprendimiento',prioridad:'P1',
     fecha_publicacion:hoy(-2),fecha_vigencia:'No rige: anuncio',a_quien_afecta:'Micro y pequeñas empresas',accion:'Ninguna aún; seguimiento',riesgo:'—',confianza:'media',estado:'nuevo'},
    {titulo:'Proyecto para suspender la Ley Karin por 5 años (Boletín 18.588-13)',organismo:'Cámara de Diputadas y Diputados',url_fuente:'https://www.camara.cl/',tipo_norma:'proyecto',area:'laboral',prioridad:'P2',
     fecha_publicacion:hoy(-3),fecha_vigencia:'No rige: proyecto',a_quien_afecta:'Todos los empleadores (si se aprueba)',accion:'Mantener protocolo Karin vigente',riesgo:'Fiscalización bajo ley vigente',confianza:'media',estado:'banco'}
  ].map(function(x){x.id=id();x.fecha_radar=hoy(0);x.alcance='nacional';x.creado_en=new Date().toISOString();return x;});

  var P=[
    {fecha_propuesta:hoy(0),formato:'reel',titulo:'Mi Fondo vs PREVIRED: declarada no es pagada',estado:'propuesta',gancho:'«Jefe, revisé mi cotización y aparece declarada pero no pagada»',hallazgo_id:null},
    {fecha_propuesta:hoy(1),formato:'carrusel',titulo:'Ampliación de giro, patente y permisos',estado:'propuesta',gancho:'Tu negocio creció. ¿Tus permisos siguen cubriendo lo que haces?',hallazgo_id:null},
    {fecha_propuesta:hoy(-3),formato:'reel',titulo:'La factura no basta',estado:'guion',hallazgo_id:null},
    {fecha_propuesta:hoy(-8),formato:'reel',titulo:'Radar SII DDJJ AT 2027',estado:'publicada',fecha_publicada:hoy(-8),hallazgo_id:null},
    {fecha_propuesta:null,formato:'reel',titulo:'PPM: anticipo, no ahorro definitivo',estado:'idea',hallazgo_id:null}
  ].map(function(x){x.id=id();x.canales=['instagram'];x.creado_en=new Date().toISOString();return x;});

  function copia(o){return JSON.parse(JSON.stringify(o));}
  window.NOV_DEMO={
    listar:function(tabla){return Promise.resolve(copia(tabla==='novedades_hallazgos'?H:P));},
    crear:function(tabla,fila){var t=tabla==='novedades_hallazgos'?H:P;fila=copia(fila);fila.id=id();fila.creado_en=new Date().toISOString();t.push(fila);return Promise.resolve(copia(fila));},
    editar:function(tabla,idFila,cambios){var t=tabla==='novedades_hallazgos'?H:P;var f=t.filter(function(x){return x.id===idFila;})[0];
      if(!f)return Promise.reject(new Error('No existe'));Object.assign(f,copia(cambios));return Promise.resolve(copia(f));}
  };
})();
