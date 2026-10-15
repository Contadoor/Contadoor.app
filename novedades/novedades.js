/* ============================================================
   novedades/novedades.js — Módulo Novedades · Gestoor
   Radar (hallazgos oficiales) → Parrilla (piezas de contenido) → Publicado.
   Fuente de datos: tablas novedades_hallazgos y novedades_piezas vía PostgREST (sbFetch, JWT de la sesión).
   La base re-verifica cada permiso (ver novedades.sql); aquí los botones solo se muestran u ocultan.
   Seguridad: todo texto se escapa con esc(); los enlaces solo se pintan si son https.
   ============================================================ */
(function(){
  'use strict';

  var DEMO=window.NOV_DEMO||null;                       // solo existe en localhost con ?demo=1 (ver demo.js)
  var TH='novedades_hallazgos',TP='novedades_piezas';

  var PRIO={P0:'Urgente',P1:'Accionable',P2:'Banco'};
  var AREA={tributario:'Tributario',laboral:'Laboral',previsional:'Previsional',emprendimiento:'Emprendimiento',municipal:'Municipal'};
  var TIPO={ley:'Ley vigente',reglamento:'Reglamento',resolucion:'Resolución',circular:'Circular',dictamen:'Dictamen',oficio:'Oficio',anuncio:'Anuncio',
    proyecto:'Proyecto de ley',convocatoria:'Convocatoria',calendario:'Plazo / calendario',no_confirmado:'No confirmado'};
  var EST_H={nuevo:'Nuevo',en_revision:'En revisión',a_parrilla:'En parrilla',banco:'Banco',descartado:'Descartado'};
  var EST_P=['idea','propuesta','aprobada','guion','grabada','editada','publicada','archivada'];
  var EST_P_L={idea:'Idea',propuesta:'Propuesta',aprobada:'Aprobada',guion:'Guion',grabada:'Grabada',editada:'Editada',publicada:'Publicada',archivada:'Archivada'};
  var FORMATO={reel:'Reel',historia:'Historias',carrusel:'Carrusel',recurso:'Recurso',newsletter:'Newsletter',whatsapp:'WhatsApp'};
  var DIAS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

  var S={hallazgos:[],piezas:[],tab:'radar',fPrio:'',fArea:'',fEst:'activos',q:'',lunes:lunesDe(new Date()),abierto:null,ocupado:false};

  // ── Utilidades ─────────────────────────────────────────────────────────────
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function $(id){return document.getElementById(id);}
  function enlace(u,txt){return /^https:\/\//.test(String(u||''))?'<a href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(txt||u)+'</a>':esc(u||'—');}
  function esMaster(){var s=window._contadoorSesion;return !!(s&&(s.esMaster===true||s.rol==='master'||s.rol==='admin'));}
  function puedeEditar(){var s=window._contadoorSesion;return esMaster()||!!(s&&s.rol==='comercial');}
  function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function lunesDe(d){var x=new Date(d.getFullYear(),d.getMonth(),d.getDate());var w=(x.getDay()+6)%7;x.setDate(x.getDate()-w);return x;}
  function masDias(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x;}
  function fCorta(s){if(!s)return '—';var p=String(s).slice(0,10).split('-');return p.length===3?p[2]+'-'+p[1]+'-'+p[0]:esc(s);}
  function aviso(t,err){var a=$('nv-aviso');a.textContent=t;a.className='nv-aviso on'+(err?' err':'');clearTimeout(aviso._t);aviso._t=setTimeout(function(){a.className='nv-aviso';},3500);}

  // ── Datos ──────────────────────────────────────────────────────────────────
  function leer(r){
    if(r.status===401||r.status===403)throw new Error('Sin permiso para esta acción.');
    if(!r.ok)return r.text().then(function(t){var m='';try{m=JSON.parse(t).message;}catch(e){}throw new Error(m||('Error '+r.status));});
    return r.status===204?null:r.json();
  }
  function listar(tabla){
    if(DEMO)return DEMO.listar(tabla);
    var orden=tabla===TH?'fecha_radar.desc,prioridad.asc':'fecha_propuesta.asc.nullslast';
    return sbFetch(tabla+'?select=*&order='+orden+'&limit=500').then(leer);
  }
  function crear(tabla,fila){
    if(DEMO)return DEMO.crear(tabla,fila);
    return sbFetch(tabla,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(fila)}).then(leer).then(function(a){return a[0];});
  }
  function editar(tabla,id,cambios){
    if(DEMO)return DEMO.editar(tabla,id,cambios);
    return sbFetch(tabla+'?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(cambios)})
      .then(leer).then(function(a){if(!a||!a.length)throw new Error('No se pudo guardar (sin permiso o ya no existe).');return a[0];});
  }
  function cargar(){
    return Promise.all([listar(TH),listar(TP)]).then(function(r){
      S.hallazgos=r[0]||[];S.piezas=r[1]||[];$('nv-err').textContent='';pintar();
    }).catch(function(e){
      $('nv-err').textContent=/relation|does not exist|404/i.test(e.message)?'El módulo aún no tiene sus tablas en la base (ver novedades.sql).':'No se pudieron cargar las novedades: '+e.message;
    });
  }
  function reemplazar(lista,fila){for(var i=0;i<lista.length;i++)if(lista[i].id===fila.id){lista[i]=fila;return;}lista.push(fila);}

  // ── KPIs ───────────────────────────────────────────────────────────────────
  function pintarKpis(){
    var hoyIso=iso(new Date()),lun=iso(S.lunes),dom=iso(masDias(S.lunes,6)),mes=hoyIso.slice(0,7);
    var abiertos=S.hallazgos.filter(function(h){return h.estado==='nuevo'||h.estado==='en_revision';});
    $('k-p0').textContent=abiertos.filter(function(h){return h.prioridad==='P0';}).length;
    $('k-nuevos').textContent=S.hallazgos.filter(function(h){return h.estado==='nuevo';}).length;
    $('k-semana').textContent=S.piezas.filter(function(p){return p.fecha_propuesta>=lun&&p.fecha_propuesta<=dom&&p.estado!=='archivada';}).length;
    $('k-aprobar').textContent=S.piezas.filter(function(p){return p.estado==='propuesta';}).length;
    $('k-pub').textContent=S.piezas.filter(function(p){return p.estado==='publicada'&&String(p.fecha_publicada||'').slice(0,7)===mes;}).length;
  }

  // ── Radar ──────────────────────────────────────────────────────────────────
  function chip(cls,t){return '<span class="nv-chip '+cls+'">'+esc(t)+'</span>';}
  function filtrados(){
    var q=S.q.toLowerCase();
    return S.hallazgos.filter(function(h){
      if(S.fPrio&&h.prioridad!==S.fPrio)return false;
      if(S.fArea&&h.area!==S.fArea)return false;
      if(S.fEst==='activos'&&!(h.estado==='nuevo'||h.estado==='en_revision'))return false;
      if(S.fEst&&S.fEst!=='activos'&&h.estado!==S.fEst)return false;
      if(q&&(h.titulo+' '+h.organismo+' '+(h.accion||'')).toLowerCase().indexOf(q)<0)return false;
      return true;
    }).sort(function(a,b){return a.prioridad<b.prioridad?-1:a.prioridad>b.prioridad?1:(b.fecha_radar||'').localeCompare(a.fecha_radar||'');});
  }
  function pintarRadar(){
    var l=filtrados(),ed=puedeEditar(),h='';
    if(!l.length)h='<div class="nv-vacio">No hay hallazgos con estos filtros.</div>';
    l.forEach(function(x){
      var ab=S.abierto===x.id;
      var noRige=x.tipo_norma==='proyecto'||x.tipo_norma==='anuncio'||x.tipo_norma==='no_confirmado';
      h+='<article class="nv-h p-'+esc(x.prioridad)+(ab?' abierto':'')+'" data-id="'+esc(x.id)+'">'
        +'<button type="button" class="nv-h-cab" data-acc="abrir">'
        +chip('pr-'+esc(x.prioridad),x.prioridad+' · '+(PRIO[x.prioridad]||''))+chip('ar',AREA[x.area]||x.area)
        +chip(noRige?'no-rige':'tipo',TIPO[x.tipo_norma]||x.tipo_norma)+chip('est e-'+esc(x.estado),EST_H[x.estado]||x.estado)
        +'<b>'+esc(x.titulo)+'</b><small>'+esc(x.organismo)+' · radar '+fCorta(x.fecha_radar)+' · confianza '+esc(x.confianza)+'</small></button>';
      if(ab){
        h+='<div class="nv-h-cuerpo"><dl>'
          +'<dt>Publicación</dt><dd>'+fCorta(x.fecha_publicacion)+'</dd>'
          +'<dt>Vigencia</dt><dd>'+esc(x.fecha_vigencia||'—')+(noRige?' <em class="nv-warn">No es obligación vigente</em>':'')+'</dd>'
          +'<dt>A quién afecta</dt><dd>'+esc(x.a_quien_afecta||'—')+'</dd>'
          +'<dt>Requisitos / excepciones</dt><dd>'+esc(x.requisitos||'—')+'</dd>'
          +'<dt>Plazos y montos</dt><dd>'+esc(x.plazos_montos||'—')+'</dd>'
          +'<dt>Qué debe hacer el empresario</dt><dd>'+esc(x.accion||'—')+'</dd>'
          +'<dt>Riesgo de no actuar</dt><dd>'+esc(x.riesgo||'—')+'</dd>'
          +'<dt>Fuente oficial</dt><dd>'+enlace(x.url_fuente)+'</dd>'
          +(x.notas?'<dt>Notas</dt><dd>'+esc(x.notas)+'</dd>':'')
          +'</dl>';
        var piezas=S.piezas.filter(function(p){return p.hallazgo_id===x.id;});
        if(piezas.length)h+='<p class="nv-nota">Piezas vinculadas: '+piezas.map(function(p){return esc(FORMATO[p.formato]+' «'+p.titulo+'» ('+EST_P_L[p.estado]+')');}).join(' · ')+'</p>';
        if(ed)h+='<div class="nv-acc">'
          +'<button class="g-btn pri" data-acc="parrilla">Proponer pieza</button>'
          +(x.estado!=='en_revision'?'<button class="g-btn" data-acc="est" data-v="en_revision">En revisión</button>':'')
          +(x.estado!=='banco'?'<button class="g-btn" data-acc="est" data-v="banco">Al banco</button>':'')
          +(x.estado!=='descartado'?'<button class="g-btn" data-acc="est" data-v="descartado">Descartar</button>':'')
          +'</div>';
        h+='</div>';
      }
      h+='</article>';
    });
    $('nv-radar-lista').innerHTML=h;
  }

  // ── Parrilla semanal ───────────────────────────────────────────────────────
  function tarjetaPieza(p){
    var hz=p.hallazgo_id?S.hallazgos.filter(function(h){return h.id===p.hallazgo_id;})[0]:null;
    return '<button type="button" class="nv-p e-'+esc(p.estado)+'" data-pid="'+esc(p.id)+'">'
      +'<span class="nv-p-f">'+esc(FORMATO[p.formato]||p.formato)+'</span>'
      +'<b>'+esc(p.titulo)+'</b>'
      +'<span class="nv-p-e">'+esc(EST_P_L[p.estado]||p.estado)+(hz?' · '+esc(hz.prioridad):'')+'</span></button>';
  }
  function pintarParrilla(){
    var h='',hoyIso=iso(new Date());
    $('nv-semana').textContent='Semana del '+fCorta(iso(S.lunes))+' al '+fCorta(iso(masDias(S.lunes,6)));
    for(var i=0;i<7;i++){
      var d=iso(masDias(S.lunes,i));
      var ps=S.piezas.filter(function(p){return p.fecha_propuesta===d&&p.estado!=='archivada';});
      h+='<div class="nv-dia'+(d===hoyIso?' hoy':'')+'"><div class="nv-dia-c">'+DIAS[i]+' <span>'+d.slice(8)+'</span></div>'
        +ps.map(tarjetaPieza).join('')
        +(puedeEditar()?'<button type="button" class="nv-mas" data-nueva="'+d+'">+ pieza</button>':'')+'</div>';
    }
    $('nv-grilla').innerHTML=h;
    var banco=S.piezas.filter(function(p){return !p.fecha_propuesta&&p.estado!=='archivada'&&p.estado!=='publicada';});
    $('nv-banco').innerHTML=banco.length?banco.map(tarjetaPieza).join(''):'<div class="nv-vacio">Sin piezas en el banco.</div>';
  }

  // ── Publicado (control de duplicación) ─────────────────────────────────────
  function pintarPublicado(){
    var q=S.q.toLowerCase();
    var l=S.piezas.filter(function(p){return p.estado==='publicada'&&(!q||p.titulo.toLowerCase().indexOf(q)>=0);})
      .sort(function(a,b){return String(b.fecha_publicada).localeCompare(String(a.fecha_publicada));});
    $('nv-pub-lista').innerHTML=l.length?'<table class="nv-tab"><thead><tr><th>Fecha</th><th>Formato</th><th>Pieza</th><th>Enlace</th></tr></thead><tbody>'
      +l.map(function(p){return '<tr data-pid="'+esc(p.id)+'"><td>'+fCorta(p.fecha_publicada)+'</td><td>'+esc(FORMATO[p.formato])+'</td><td>'+esc(p.titulo)+'</td><td>'+enlace(p.url_publicada,'ver')+'</td></tr>';}).join('')
      +'</tbody></table>':'<div class="nv-vacio">Todavía no hay piezas marcadas como publicadas.</div>';
  }

  function pintar(){
    pintarKpis();
    document.querySelectorAll('.nv-tabs button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-tab')===S.tab);});
    ['radar','parrilla','publicado'].forEach(function(t){$('nv-v-'+t).hidden=S.tab!==t;});
    $('nv-filtros-radar').hidden=S.tab!=='radar';
    if(S.tab==='radar')pintarRadar();else if(S.tab==='parrilla')pintarParrilla();else pintarPublicado();
  }

  // ── Diálogos ───────────────────────────────────────────────────────────────
  function opciones(obj,sel,soloMaster){
    return Object.keys(obj).map(function(k){
      var dis=soloMaster&&soloMaster.indexOf(k)>=0&&!esMaster()&&k!==sel;
      return '<option value="'+esc(k)+'"'+(k===sel?' selected':'')+(dis?' disabled':'')+'>'+esc(obj[k])+(dis?' (solo Master)':'')+'</option>';
    }).join('');
  }
  function campo(lbl,html){return '<label class="nv-campo"><span>'+esc(lbl)+'</span>'+html+'</label>';}
  function txt(n,v,ph,area){return area?'<textarea name="'+n+'" rows="2" placeholder="'+esc(ph||'')+'">'+esc(v||'')+'</textarea>':'<input name="'+n+'" value="'+esc(v||'')+'" placeholder="'+esc(ph||'')+'">';}

  function abrirPieza(p){
    var nueva=!p.id,ed=puedeEditar();
    var hz=S.hallazgos.filter(function(h){return h.prioridad!=='P2'||h.id===p.hallazgo_id;});
    var h='<form id="nv-form"><h2 id="nv-dlg-tit">'+(nueva?'Nueva pieza':'Pieza de la parrilla')+'</h2>'
      +'<div class="nv-grid2">'
      +campo('Fecha propuesta','<input type="date" name="fecha_propuesta" value="'+esc(p.fecha_propuesta||'')+'">')
      +campo('Formato','<select name="formato">'+opciones(FORMATO,p.formato||'reel')+'</select>')
      +'</div>'
      +campo('Título',txt('titulo',p.titulo,'Ej.: La factura no basta'))
      +campo('Hallazgo del radar','<select name="hallazgo_id"><option value="">— Evergreen (sin hallazgo) —</option>'
        +hz.map(function(x){return '<option value="'+esc(x.id)+'"'+(x.id===p.hallazgo_id?' selected':'')+'>'+esc(x.prioridad+' · '+x.titulo)+'</option>';}).join('')+'</select>')
      +campo('Gancho (0–5 s, conversacional)',txt('gancho',p.gancho,'Parte de una situación real del empresario',1))
      +campo('Ejemplo demostrable',txt('ejemplo',p.ejemplo,'Factura, liquidación, simulación, línea de tiempo…',1))
      +campo('Ángulo: qué debe entender el empresario',txt('angulo',p.angulo,'',1))
      +campo('CTA',txt('cta',p.cta,'Ej.: Guarda este video y revisa tus comprobantes'))
      +'<div class="nv-grid2">'
      +campo('Estado','<select name="estado">'+opciones(EST_P_L,p.estado||'propuesta',['aprobada','publicada'])+'</select>')
      +campo('Guion en Notion',txt('notion_url',p.notion_url,'https://…'))
      +'</div><div class="nv-grid2">'
      +campo('Fecha publicada','<input type="date" name="fecha_publicada" value="'+esc(p.fecha_publicada||'')+'">')
      +campo('Enlace publicado',txt('url_publicada',p.url_publicada,'https://instagram.com/…'))
      +'</div>'
      +campo('Notas',txt('notas',p.notas,'',1))
      +'<p class="nv-nota">Nada se publica desde Gestoor: aquí se registra el estado real. Aprobar y marcar como publicada es solo para Master.</p>'
      +'<div class="nv-acc"><button type="button" class="g-btn" data-cerrar>Cerrar</button>'
      +(ed?'<button type="submit" class="g-btn pri">Guardar</button>':'')+'</div></form>';
    $('nv-dlg').innerHTML=h;$('nv-velo').classList.add('on');
    var f=$('nv-form');
    if(!ed)f.querySelectorAll('input,select,textarea').forEach(function(el){el.disabled=true;});
    f.addEventListener('submit',function(ev){
      ev.preventDefault();if(S.ocupado)return;
      var d={};new FormData(f).forEach(function(v,k){v=String(v).trim();d[k]=v===''?null:v;});
      if(!d.titulo||d.titulo.length<3){aviso('Falta el título.',1);return;}
      if(d.estado==='publicada'&&!d.fecha_publicada){aviso('Para marcarla publicada indica la fecha de publicación.',1);return;}
      if((d.url_publicada&&!/^https:\/\//.test(d.url_publicada))||(d.notion_url&&!/^https:\/\//.test(d.notion_url))){aviso('Los enlaces deben empezar con https://',1);return;}
      S.ocupado=true;
      var pr=nueva?crear(TP,d):editar(TP,p.id,d);
      pr.then(function(fila){
        reemplazar(S.piezas,fila);
        if(fila.hallazgo_id){var x=S.hallazgos.filter(function(h){return h.id===fila.hallazgo_id;})[0];
          if(x&&(x.estado==='nuevo'||x.estado==='en_revision'))return editar(TH,x.id,{estado:'a_parrilla'}).then(function(y){reemplazar(S.hallazgos,y);});}
      }).then(function(){cerrar();pintar();aviso('Pieza guardada.');})
        .catch(function(e){aviso(e.message,1);}).then(function(){S.ocupado=false;});
    });
  }
  function cerrar(){$('nv-velo').classList.remove('on');$('nv-dlg').innerHTML='';}

  function abrirHallazgo(){
    var h='<form id="nv-form-h"><h2 id="nv-dlg-tit">Nuevo hallazgo del radar</h2>'
      +campo('Título',txt('titulo','','Título preciso'))
      +'<div class="nv-grid2">'+campo('Organismo',txt('organismo','','SII, DT, Previred…'))+campo('Enlace a la fuente oficial',txt('url_fuente','','https://…'))+'</div>'
      +'<div class="nv-grid2">'+campo('Tipo','<select name="tipo_norma">'+opciones(TIPO,'resolucion')+'</select>')+campo('Área','<select name="area">'+opciones(AREA,'tributario')+'</select>')+'</div>'
      +'<div class="nv-grid2">'+campo('Prioridad','<select name="prioridad">'+opciones({P0:'P0 · Urgente',P1:'P1 · Accionable',P2:'P2 · Banco'},'P1')+'</select>')
      +campo('Confianza','<select name="confianza">'+opciones({alta:'Alta (fuente oficial leída)',media:'Media',baja:'Baja (por verificar)'},'media')+'</select>')+'</div>'
      +'<div class="nv-grid2">'+campo('Fecha de publicación','<input type="date" name="fecha_publicacion">')+campo('Vigencia',txt('fecha_vigencia','','Desde…, o «No rige: proyecto»'))+'</div>'
      +campo('A quién afecta',txt('a_quien_afecta','','',1))+campo('Requisitos / excepciones',txt('requisitos','','',1))
      +campo('Plazos y montos (solo confirmados)',txt('plazos_montos','','',1))
      +campo('Qué debe hacer el empresario',txt('accion','','',1))+campo('Riesgo de no actuar',txt('riesgo','','',1))
      +'<div class="nv-acc"><button type="button" class="g-btn" data-cerrar>Cerrar</button><button type="submit" class="g-btn pri">Guardar</button></div></form>';
    $('nv-dlg').innerHTML=h;$('nv-velo').classList.add('on');
    var f=$('nv-form-h');
    f.addEventListener('submit',function(ev){
      ev.preventDefault();if(S.ocupado)return;
      var d={};new FormData(f).forEach(function(v,k){v=String(v).trim();d[k]=v===''?null:v;});
      if(!d.titulo||!d.organismo){aviso('Faltan título u organismo.',1);return;}
      if(!/^https:\/\//.test(d.url_fuente||'')){aviso('El enlace a la fuente oficial es obligatorio (https://).',1);return;}
      S.ocupado=true;
      crear(TH,d).then(function(fila){S.hallazgos.push(fila);cerrar();pintar();aviso('Hallazgo agregado.');})
        .catch(function(e){aviso(e.message,1);}).then(function(){S.ocupado=false;});
    });
  }

  // ── Eventos ────────────────────────────────────────────────────────────────
  function enlazar(){
    document.querySelector('.nv-tabs').addEventListener('click',function(e){var b=e.target.closest('button[data-tab]');if(b){S.tab=b.getAttribute('data-tab');pintar();}});
    $('nv-q').addEventListener('input',function(){S.q=this.value;pintar();});
    $('f-prio').addEventListener('change',function(){S.fPrio=this.value;pintar();});
    $('f-area').addEventListener('change',function(){S.fArea=this.value;pintar();});
    $('f-est').addEventListener('change',function(){S.fEst=this.value;pintar();});
    $('nv-prev').addEventListener('click',function(){S.lunes=masDias(S.lunes,-7);pintar();});
    $('nv-next').addEventListener('click',function(){S.lunes=masDias(S.lunes,7);pintar();});
    $('nv-hoy').addEventListener('click',function(){S.lunes=lunesDe(new Date());pintar();});
    $('nv-nuevo-h').addEventListener('click',abrirHallazgo);
    $('nv-nueva-p').addEventListener('click',function(){abrirPieza({estado:'idea'});});
    $('nv-radar-lista').addEventListener('click',function(e){
      var b=e.target.closest('[data-acc]');if(!b)return;
      var id=b.closest('.nv-h').getAttribute('data-id'),x=S.hallazgos.filter(function(h){return h.id===id;})[0];if(!x)return;
      var acc=b.getAttribute('data-acc');
      if(acc==='abrir'){S.abierto=S.abierto===id?null:id;pintarRadar();return;}
      if(acc==='parrilla'){abrirPieza({estado:'propuesta',hallazgo_id:id,titulo:x.titulo,formato:x.prioridad==='P0'?'historia':'reel'});return;}
      if(acc==='est'&&!S.ocupado){S.ocupado=true;
        editar(TH,id,{estado:b.getAttribute('data-v')}).then(function(f){reemplazar(S.hallazgos,f);pintar();aviso('Hallazgo actualizado.');})
          .catch(function(er){aviso(er.message,1);}).then(function(){S.ocupado=false;});}
    });
    document.addEventListener('click',function(e){
      var p=e.target.closest('[data-pid]');
      if(p&&!e.target.closest('a')){var x=S.piezas.filter(function(z){return z.id===p.getAttribute('data-pid');})[0];if(x)abrirPieza(x);return;}
      var n=e.target.closest('[data-nueva]');if(n){abrirPieza({estado:'propuesta',fecha_propuesta:n.getAttribute('data-nueva')});return;}
      if(e.target.closest('[data-cerrar]')||e.target===$('nv-velo'))cerrar();
    });
    document.addEventListener('keydown',function(e){if(e.key==='Escape')cerrar();});
  }

  function iniciar(){
    if(window.gIconos)gIconos();
    if(DEMO)$('nv-demo').classList.add('on');
    $('nv-nuevo-h').hidden=!puedeEditar();$('nv-nueva-p').hidden=!puedeEditar();
    enlazar();cargar();
  }
  if(window._contadoorSesion||DEMO)iniciar();
  else window.addEventListener('gestoor-auth-ready',function once(){window.removeEventListener('gestoor-auth-ready',once);iniciar();});
})();
