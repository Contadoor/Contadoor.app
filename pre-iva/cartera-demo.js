/* ============================================================
   pre-iva/cartera-demo.js — Datos 100 % FICTICIOS para revisar la Cartera de Pre-IVA en local.
   Candado 2: solo define PV_DEMO_API en localhost / 127.0.0.1 / [::1] y con ?demo=1. No se conecta a Supabase.
   Nombres, RUT ("DEMO-…"), responsables y montos son inventados: no corresponden a ningún cliente real.
   Opcional: ?rol=contable simula a un analista contable (la "RLS" de la demo le deja ver solo sus clientes).
   ============================================================ */
(function(){
  var h=location.hostname, local=(h==='localhost'||h==='127.0.0.1'||h==='[::1]');
  if(!local||!/(?:^|[?&])demo=1(?:&|$)/.test(location.search.slice(1)))return;
  var contable=/(?:^|[?&])rol=contable(?:&|$)/.test(location.search.slice(1));
  // ?futuro=1: vista previa de cómo se verá el Pre-IVA AUTOMÁTICO desde el SII (columnas que hoy NO existen en la base)
  var futuro=/(?:^|[?&])futuro=1(?:&|$)/.test(location.search.slice(1));

  var A={id:9101,n:'Analista Demo A'}, B={id:9102,n:'Analista Demo B'}, C={id:9103,n:'Analista Demo C'};
  // Filtro por responsable (assets/equipo.js): foto GENÉRICA para un analista ficticio; los demás muestran iniciales
  if(window.GEquipo)window.GEquipo.fotoDemo(A.n,'../assets/equipo/demo-generica.svg');
  // [id, razón social ficticia, plan, analista]
  var CLI=[
    [1,'Panadería Demo Los Aromos SpA','asesoria',A],[2,'Transportes Demo Cordillera Ltda.','estrategico',A],
    [3,'Ferretería Demo El Tornillo SpA','asesoria',B],[4,'Consultora Demo Horizonte SpA','asesoria',A],
    [5,'Distribuidora Demo Sur Limitada','estrategico',B],[6,'Café Demo La Esquina SpA','cumplimiento',C],
    [7,'Taller Demo Mecánico Norte SpA','asesoria',C],[8,'Importadora Demo Pacífico SpA','estrategico',A],
    [9,'Clínica Demo Dental Sonrisa SpA','asesoria',B],[10,'Almacén Demo Don Pepe EIRL','cumplimiento',A],
    [11,'Constructora Demo Andes SpA','asesoria',null],[12,'Agencia Demo Creativa Ñandú SpA','asesoria',C],
    [13,'Viña Demo Valle Central SpA','estrategico',B],[14,'Servicios Demo Integrales SpA',null,C]
  ];
  var PLANES=[{codigo:'cumplimiento',nombre:'Cumplimiento',incluye_preiva:false},{codigo:'asesoria',nombre:'Contadoor PRO',incluye_preiva:true},
    {codigo:'estrategico',nombre:'Contadoor Estratégico',incluye_preiva:true}];
  function z(n){return (n<10?'0':'')+n;}
  function rut(id){return 'DEMO-'+z(id);}
  var hoy=new Date(), perHoy=hoy.getFullYear()+'-'+z(hoy.getMonth()+1);
  // Generador determinístico (mismo resultado en cada recarga)
  function rnd(seed){var x=Math.sin(seed*9301+49297)*233280;return x-Math.floor(x);}
  function redondo(n){return Math.round(n/1000)*1000;}
  // Estado de cada cliente en el mes en curso (para mostrar todos los casos)
  var MES_EN_CURSO={1:'ENV',2:'ENV',3:'BOR',4:'PEN',5:'ENV',6:'PEN',7:'BOR',8:'ENV',9:'PEN',10:'BORF',11:'ENV',12:'SINLIB',13:'REM',14:'PEN'};
  function filaDe(c,per){
    var id=c[0], s=id*31+(+per.slice(0,4))*12+(+per.slice(5,7));
    var modo=per===perHoy?MES_EN_CURSO[id]:(c[2]==='cumplimiento'||c[2]==null?'PEN':(rnd(s)<0.85?'ENV':'BOR'));
    if(modo==='PEN')return null;
    var deb=redondo(1800000+rnd(s+1)*14000000), cred=redondo(deb*(0.35+rnd(s+2)*0.45)), rem=redondo(rnd(s+3)<0.5?0:rnd(s+4)*900000);
    if(modo==='REM'){cred=redondo(deb*1.18);}
    if(modo==='SINLIB'){deb=0;cred=0;}
    var tasa=modo==='SINLIB'?0:[0.25,1,1.5,0.7,2][id%5];
    var ppm=Math.round(deb/1.19*tasa/100);
    // F29 ficticio "proyectado al cierre" (cifra de muestra, no replica ninguna fórmula ni cliente)
    var ivaP=Math.max(redondo((deb-cred)*1.12-rem),0), f29=modo==='SINLIB'?0:ivaP+ppm;
    var env=(modo==='ENV'||modo==='REM');
    var d=new Date(+per.slice(0,4),+per.slice(5,7)-1,Math.min(28,8+id),9+(id%8),(id*7)%60);
    if(per===perHoy&&d>hoy)d=new Date(hoy.getTime()-id*3600000);
    var extra={};
    if(futuro&&per===perHoy&&(id===3||id===7||id===12||id===1)){
      var cal=new Date(hoy.getFullYear(),hoy.getMonth(),Math.min(hoy.getDate(),12),7,30);
      var venceR=new Date(hoy.getTime()+3*86400000);
      extra={fuente:'SII',calculado_at:cal.toISOString(),revisado_at:id===1?cal.toISOString():null,
        facturas_aceptadas:10+id*3,facturas_en_plazo:id===7?4:0,facturas_reclamadas:id===12?1:0,
        plazo_reclamo_vence:venceR.getFullYear()+'-'+z(venceR.getMonth()+1)+'-'+z(venceR.getDate())};
      if(id===12){deb=redondo(3200000);cred=redondo(1100000);tasa=1;ppm=Math.round(deb/1.19*tasa/100);f29=Math.max(redondo((deb-cred)*1.12-rem),0)+ppm;}
    }
    return Object.assign({cliente_rut:rut(id),periodo:per,debito_iva:deb,credito_iva:cred,remanente:rem,f29:f29,ppm:ppm,tasa_ppm:tasa,
      enviado_por:env?(c[3]?c[3].n:'Usuario Demo Master'):null,fecha_envio:env?d.toISOString():null},extra);
  }
  function visibles(){return CLI.filter(function(c){return !contable||(c[3]&&c[3].id===A.id);});}
  function pagina(lista,path){
    var lim=+(path.match(/[?&]limit=(\d+)/)||[0,1000])[1], off=+(path.match(/[?&]offset=(\d+)/)||[0,0])[1];
    return lista.slice(off,off+lim);
  }
  function json(x){return JSON.parse(JSON.stringify(x));}
  window.PV_DEMO_API={
    usuario:contable?{nombre:A.n,rol:'contable',esMaster:false}:{nombre:'Usuario Demo Master',rol:'master',esMaster:true},
    usId:contable?A.id:A.id,   // en la demo, el Master también tiene la cartera del Analista Demo A ("Mis clientes")
    get:function(path){
      return new Promise(function(res,rej){setTimeout(function(){
        try{
          if(/^clientes\?/.test(path))return res(pagina(visibles().map(function(c){return {id:c[0],rut:rut(c[0]),razon_social:c[1],plan:c[2],estado:'activo',
            analista_contable:c[3]?c[3].n:null,analista_contable_usuario_id:c[3]?c[3].id:null};}),path));
          if(/^planes\?/.test(path))return res(json(PLANES));
          if(/^periodos\?/.test(path)){var p=new Date(hoy.getFullYear(),hoy.getMonth()-3,1);return res([{periodo:p.getFullYear()+'-'+z(p.getMonth()+1),estado:'activo'}]);}
          if(/^rcv_consultas\?/.test(path)){
            if(!futuro)return res([]);
            var t=new Date(hoy.getFullYear(),hoy.getMonth(),Math.min(hoy.getDate(),12),7,30).toISOString();
            return res(pagina(visibles().filter(function(c){return [1,3,7,12].indexOf(c[0])>=0;}).map(function(c){return {cliente_id:c[0],tipo:'compras',estado:'completado',origen:'scheduler',finalizado_at:t};}),path));
          }
          if(/^preiva_historial\?/.test(path)){
            var per=decodeURIComponent((path.match(/periodo=eq\.([^&]+)/)||[0,''])[1]);
            if(/(?:^|[?&])fallo=historial(?:&|$)/.test(location.search.slice(1)))return rej(Object.assign(new Error('Demo: error simulado de lectura'),{status:500}));
            return res(pagina(visibles().map(function(c){return filaDe(c,per);}).filter(Boolean),path));
          }
          rej(new Error('Demo: ruta no simulada '+path));
        }catch(e){rej(e);}
      },250);});
    }
  };
})();
