/* ============================================================
   gestoor-menu.js — menú lateral común de Gestoor (rediseño 2026-09)
   Uso: <aside class="sidebar" data-gestoor-activo="panel-de-control"></aside>
        <script src="../assets/gestoor-menu.js"></script>   ← justo después
   Se dibuja al cargar (antes que auth.js), así auth.js aplica candados
   por rol sobre los mismos enlaces "../<modulo>/index.html" de siempre.
   Los módulos futuros llevan pointer-events:none en línea (auth.js los respeta).
   ============================================================ */
(function(){
  var P={
    inicio:'<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    clientes:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    planes:'<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    panel:'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    rrhh:'<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    contable:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    pagos:'<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    convenios:'<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
    pir:'<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8"/><path d="M16 14v4"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
    iva:'<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    aprobar:'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    banco:'<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M12 2 20 7H4z"/>',
    cobranza:'<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    factura:'<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    personal:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
    grafico:'<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
    edificio:'<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    telefono:'<path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/>',
    imagen:'<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    subir:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    repetir:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    candado:'<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    llave:'<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
    transferir:'<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
    mixto:'<path d="M18 8L22 12L18 16"/><path d="M2 12H22"/><path d="M6 8L2 12L6 16"/>',
    admin:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    menu:'<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    calendario:'<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    mas:'<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    enviar:'<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
    ver:'<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    correo:'<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    campana:'<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    chat:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    check:'<path d="M20 6 9 17l-5-5"/>',
    reloj:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    alerta:'<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    menos:'<path d="M5 12h14"/>',
    lapiz:'<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    descargar:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    basura:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    lista:'<path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="M18 9v6"/><path d="M21 12h-6"/>'
  };
  // Ícono de línea (estilo Lucide). Nombre desconocido → vacío (nunca rompe la página).
  window.gIcon=function(n){
    return P[n]?'<svg class="g-ic" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+P[n]+'</svg>':'';
  };

  // Menú único para todos los módulos. m = carpeta del módulo; sin m = futuro.
  // Estructura = menú único decidido por Luciano el 27-sep (PR #14): mismos nombres, orden y enlaces.
  var MENU=[
    ['Principal',[['inicio','Dashboard','']]],
    ['Operación mensual',[['clientes','Clientes','clientes'],['panel','Panel de Control','panel-de-control'],['rrhh','RRHH','reportes-rrhh'],
      ['personal','Gestión de Personal',null],['contable','Contable','reportes-contable'],['pagos','Pagos','reportes-pagos'],
      ['aprobar','Aprobaciones','pagos'],['convenios','Convenios','convenios'],['iva','Pre-IVA','pre-iva'],['pir','PIR','pir']]],
    ['Gestión interna',[['planes','Planes y Servicios','planes'],['banco','Conciliación','conciliacion'],['cobranza','CxC / Cobranza',null],
      ['factura','Facturación',null],['chat','CRM',null],['lista','Cotizaciones',null],['campana','Campañas',null],
      ['correo','Comunicaciones',null],['grafico','Performance',null]]],
    ['Configuración',[['admin','Admin','admin']]]
  ];

  function esc(s){return String(s||'').replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  function dibujar(aside){
    var activo=aside.getAttribute('data-gestoor-activo')||'';
    // Logo Gestoor (ícono A · Tablero, aprobado por Luciano 25-sep): aro blanco suave sobre el morado
    var logo='<svg class="g-logo" viewBox="0 0 196 46" role="img" aria-label="Gestoor"><circle cx="23" cy="23" r="23" fill="rgba(255,255,255,.22)"/>'
      +'<image href="../assets/gestoor-icono.svg" x="2" y="2" width="42" height="42"/>'
      +'<text x="56" y="31" font-family="Montserrat,system-ui,sans-serif" font-size="23" font-weight="900"><tspan fill="#fff">Gest</tspan><tspan fill="#F6D3F7">oor</tspan></text></svg>';
    var h='<div class="g-menu-logo"><div>'+logo+'<small>by Contadoor</small></div>'
      +'<button type="button" class="g-menu-btn" aria-label="Abrir menú" aria-expanded="false">'+gIcon('menu')+'</button></div><nav class="sb-nav">';
    MENU.forEach(function(sec){
      h+='<div class="sb-sec">'+esc(sec[0])+'</div>';
      sec[1].forEach(function(it){
        var ic='<span class="i">'+gIcon(it[0])+'</span>';
        if(it[2]===null){
          h+='<a class="sb-item futuro" href="#" style="pointer-events:none" aria-disabled="true">'+ic+esc(it[1])+'</a>';
          return;
        }
        var href=it[2]===''?'../index.html':'../'+it[2]+'/index.html';
        var on=it[2]===activo&&activo!=='';
        h+='<a class="sb-item'+(on?' on':'')+'" href="'+href+'"'+(on?' aria-current="page"':'')+'>'+ic+esc(it[1])+'</a>';
      });
    });
    h+='</nav><div class="sb-foot" id="sb-usuario">Gestoor · Contadoor</div>';
    aside.innerHTML=h;
    var btn=aside.querySelector('.g-menu-btn');
    btn.addEventListener('click',function(){
      var ab=aside.classList.toggle('abierto');
      btn.setAttribute('aria-expanded',ab?'true':'false');
    });
  }

  // Foto del integrante del equipo (assets/equipo/<nombre-apellido>.jpg); sin foto → iniciales.
  window.gAvatarEquipo=function(nombre,clase){
    var n=String(nombre||'').trim(); if(!n)return '';
    var slug=n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    var ini=n.split(/\s+/).map(function(p){return p.charAt(0);}).join('').slice(0,2).toUpperCase();
    return '<span class="g-av-s '+(clase||'')+'" data-ini="'+esc(ini)+'"><img src="../assets/equipo/'+slug+'.jpg" alt="'+esc(n)+'" loading="lazy" onerror="this.parentNode.textContent=this.parentNode.getAttribute(\'data-ini\')"></span>';
  };

  // Íconos estáticos del HTML: <span data-g-ic="nombre"></span>
  window.gIconos=function(root){
    (root||document).querySelectorAll('[data-g-ic]').forEach(function(el){
      el.outerHTML=gIcon(el.getAttribute('data-g-ic'));
    });
  };

  var a=document.querySelector('aside.sidebar[data-gestoor-activo]');
  if(a)dibujar(a);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){gIconos();});
  else gIconos();
})();
