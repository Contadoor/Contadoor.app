/* admin/avisos-equipo.js — AVISOS-CAMPANA (24-11): quién del equipo tiene avisos al celular activos. Solo Master.
   Fuente única: RPC push_estado_equipo() (el servidor exige Master avisable; cualquier otro → 42501). Solo lectura. */
(function(){
'use strict';
function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fecha(ts){if(!ts)return '—';var d=new Date(ts);if(isNaN(d))return '—';
  return d.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});}
function rpc(fn){
  if(window.AVE_DEMO) return window.AVE_DEMO_RPC(fn);
  if(typeof sbFetch!=='function') return Promise.reject(new Error('SIN_SUPABASE'));
  return sbFetch('rpc/'+fn,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(function(r){
    return r.json().catch(function(){return null;}).then(function(j){if(!r.ok){var e=new Error((j&&j.message)||('HTTP '+r.status));e.status=r.status;throw e;}return j;});});
}
function pintar(filas){
  var sin=filas.filter(function(f){return !(f.dispositivos>0);}), con=filas.length-sin.length;
  $('aveKpis').innerHTML=[['bien',con,'con avisos activos'],['mal',sin.length,'sin avisos al celular'],['',filas.length,'personas activas']]
    .map(function(k){return '<div class="ave-kpi '+k[0]+'"><b>'+k[1]+'</b><span>'+esc(k[2])+'</span></div>';}).join('');
  $('aveTabla').querySelector('tbody').innerHTML=filas.map(function(f){
    var celu=f.dispositivos>0?'<span class="ave-si">✅ Activo'+(f.dispositivos>1?' en '+f.dispositivos+' dispositivos':'')+'</span>'
      :(f.tiene_cuenta?'<span class="ave-no">⚠️ Sin activar</span>':'<span class="ave-sin">Sin cuenta de acceso</span>');
    return '<tr data-usuario="'+esc(f.usuario_id)+'"><td>'+esc(f.nombre)+(f.es_master?' 👑':'')+'</td><td>'+esc(f.rol||'')+'</td><td>'+celu+'</td>'
      +'<td>'+(f.dispositivos>0?esc(fecha(f.ultimo_ok_at)):'—')+'</td><td>'+esc(f.avisos_pendientes||0)+'</td></tr>';
  }).join('');
}
function cargar(){
  $('aveError').hidden=true;
  return rpc('push_estado_equipo').then(function(filas){
    $('aveCargando').hidden=true; $('aveMain').hidden=false; pintar(Array.isArray(filas)?filas:[]);
  }).catch(function(e){
    $('aveCargando').hidden=true;
    if(e&&(e.status===403||/SOLO_MASTER|42501/.test(e.message||''))){ $('aveMain').hidden=true; $('aveNoMaster').hidden=false; return; }
    $('aveError').hidden=false;
    $('aveError').textContent=/push_estado_equipo|PGRST202|Could not find/.test(e&&e.message||'')
      ?'Esta pantalla necesita la actualización del servidor AVISOS-CAMPANA (aún no instalada).'
      :'No se pudo leer el estado del equipo ('+(e&&e.message||e)+'). Recarga la página.';
  });
}
function iniciar(){
  if(window.AVE_DEMO){ $('aveDemo').hidden=false; document.documentElement.classList.remove('auth-pending'); }
  var ses=window._contadoorSesion||{};
  if(!window.AVE_DEMO&&ses.esMaster!==true){ $('aveCargando').hidden=true; $('aveNoMaster').hidden=false; return; }
  $('aveActualizar').addEventListener('click',function(){ cargar(); });
  cargar();
}
function cuandoSesion(fn){
  var hecho=false; function go(){ if(hecho) return; hecho=true; fn(); }
  if(window.AVE_DEMO||!document.documentElement.classList.contains('auth-pending')) return go();
  var obs=new MutationObserver(function(){ if(!document.documentElement.classList.contains('auth-pending')){ obs.disconnect(); go(); } });
  obs.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
}
if(window.AVE_DEMO) window.AVE_DEMO_RPC=function(){ return Promise.resolve([
  {usuario_id:2,nombre:'Persona Demo B',rol:'Contable',es_master:false,tiene_cuenta:true,dispositivos:0,ultimo_ok_at:null,avisos_pendientes:84},
  {usuario_id:3,nombre:'Persona Demo C',rol:'Pagos',es_master:false,tiene_cuenta:false,dispositivos:0,ultimo_ok_at:null,avisos_pendientes:3},
  {usuario_id:1,nombre:'Persona Demo A',rol:'Master',es_master:true,tiene_cuenta:true,dispositivos:2,ultimo_ok_at:new Date().toISOString(),avisos_pendientes:12}]); };
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){ cuandoSesion(iniciar); }); else cuandoSesion(iniciar);
})();
