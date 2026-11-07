/* ============================================================
   prospectos/telefono.js — "✏️ Corregir teléfono" del prospecto (ficha y bitácora)
   · Para los prospectos que dejan mal su teléfono en la agenda (8 dígitos, sin el 9, letras…).
   · Modal con: número nuevo, ORIGEN de la corrección (obligatorio) y motivo (obligatorio, 5 a 300 caracteres).
       "Origen declarado por quien corrige": el prospecto lo informó (WhatsApp / correo / llamada / reunión) o "corrección de formato"
       (el MISMO número mal escrito). Es una DECLARACIÓN de quien corrige: no es una verificación ni un consentimiento (R2 · TEL-01/TEL-03).
       Ninguna corrección crea ni cambia el consentimiento del prospecto. El dato queda en la base para que SEG-1 decida cómo tratarlo.
   · Validación local con la MISMA lógica de prospectos/whatsapp.js (ProsWA.normalizar) + exige celular (+56 9 XXXX XXXX):
     8 dígitos NO se adivinan. La base vuelve a validar todo (prospecto_corregir_telefono) y deja la auditoría.
   · Guarda SOLO con la RPC prospecto_corregir_telefono (JWT del usuario). Tras guardar, el botón de WhatsApp usa el número nuevo.
   · BANDERA: TEL_CORRECCION_CONECTADA = true (migración 202611071535 R2 INSTALADA el 07-11-2026, GO-MIG de ChatGPT).
     Volver a false = botón DESHABILITADO con el motivo (fail-closed) y sin llamadas a la base.
   ============================================================ */
(function(root){
'use strict';

var TEL_CORRECCION_CONECTADA=true;
var NO_CONECTADA='Disponible cuando se instale en la base (pendiente de aprobación)';

var ORIGENES=[
  ['prospecto_whatsapp','El prospecto me lo informó por WhatsApp'],
  ['prospecto_correo','El prospecto me lo informó por correo'],
  ['prospecto_llamada','El prospecto me lo informó por llamada'],
  ['prospecto_reunion','El prospecto me lo informó en la reunión'],
  ['correccion_formato','Corrección de formato (es el mismo número, mal escrito)']
];
var MSJ={
  TEL_VACIO:'Escribe el número nuevo.',
  TEL_AMBIGUO_8:'Tiene 8 dígitos: no se puede adivinar si falta el 9. Confírmalo con el prospecto y escríbelo completo (+56 9 XXXX XXXX).',
  TEL_INVALIDO:'El número no es válido. Debe ser un celular chileno: +56 9 XXXX XXXX.',
  TEL_NO_MOVIL:'Debe ser un celular (+56 9 XXXX XXXX), no un teléfono fijo.',
  ORIGEN_INVALIDO:'Elige el origen del número (lo declaras tú).',
  MOTIVO_OBLIGATORIO:'Escribe el motivo (mínimo 5 caracteres).',
  MOTIVO_MUY_LARGO:'El motivo supera los 300 caracteres.',
  MOTIVO_CREDENCIAL:'No escribas claves ni contraseñas en el motivo.',
  SIN_CAMBIO:'Es el mismo número que ya está registrado.',
  FORMATO_CAMBIA_NUMERO:'Eso no es solo formato: el número cambia. Elige por dónde te lo informó el prospecto.',
  TEL_ANTERIOR_EXCEDE:'El teléfono registrado es demasiado largo para auditarlo completo. Avísale al Master.',
  SIN_PERMISO:'Corregir el teléfono es para Master, Comercial y Pagos.',
  NO_SESSION:'Tu sesión expiró. Vuelve a ingresar.',
  NO_EXISTE:'No encontramos ese prospecto.'
};
function mensaje(e){
  var m=String(e&&e.message||e||'');
  for(var k in MSJ)if(m.indexOf(k)>=0)return MSJ[k];
  if(/Failed to fetch|NetworkError|load failed/i.test(m))return 'Sin conexión. No se guardó ningún cambio.';
  return 'No se pudo guardar. No se guardó ningún cambio; intenta de nuevo.';
}

// ── Validación (misma lógica que whatsapp.js + celular) ──
function normalizar(tel){
  var W=root.ProsWA;
  if(!W)return {ok:false,codigo:'TEL_INVALIDO'};
  var n=W.normalizar(tel);
  if(!n.ok)return {ok:false,codigo:n.motivo==='vacio'?'TEL_VACIO':n.motivo==='corto'?'TEL_AMBIGUO_8':'TEL_INVALIDO'};
  if(n.numero.slice(0,3)!=='569')return {ok:false,codigo:'TEL_NO_MOVIL'};
  return {ok:true,e164:'+'+n.numero};
}
// datos = {tel, origen, motivo, anterior} → {ok, e164} o {ok:false, codigo, campo}
function validar(datos){
  datos=datos||{};
  var n=normalizar(datos.tel);
  if(!n.ok)return {ok:false,codigo:n.codigo,campo:'tel'};
  if(!ORIGENES.some(function(o){return o[0]===datos.origen;}))return {ok:false,codigo:'ORIGEN_INVALIDO',campo:'origen'};
  var m=String(datos.motivo==null?'':datos.motivo).trim();
  if(m.length<5)return {ok:false,codigo:'MOTIVO_OBLIGATORIO',campo:'motivo'};
  if(m.length>300)return {ok:false,codigo:'MOTIVO_MUY_LARGO',campo:'motivo'};
  if(datos.anterior!=null&&String(datos.anterior)===n.e164)return {ok:false,codigo:'SIN_CAMBIO',campo:'tel'};
  if(datos.origen==='correccion_formato'){
    var a=normalizar(datos.anterior);
    if(!a.ok||a.e164!==n.e164)return {ok:false,codigo:'FORMATO_CAMBIA_NUMERO',campo:'origen'};
  }
  return {ok:true,e164:n.e164,motivo:m};
}

// ── Interfaz ──
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var CSS='.tel-btn{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:999px;border:1.5px solid #4A2B50;background:rgba(255,255,255,.04);'
  +'color:#E3CFE5;font:700 12.5px var(--g-texto,Inter,system-ui,sans-serif);cursor:pointer;white-space:nowrap}'
  +'.tel-btn:hover{border-color:#C77BC9;background:rgba(199,123,201,.12)}.tel-btn:focus-visible{outline:2px solid #E39BE5;outline-offset:2px}'
  +'.tel-btn:disabled{opacity:.5;cursor:not-allowed;background:rgba(255,255,255,.03);border-color:#4A2B50}'
  +'.tel-btn.mini{width:34px;padding:0;justify-content:center}.tel-btn.mini .tel-lbl{display:none}'
  +'.tel-velo{position:fixed;inset:0;z-index:92;background:rgba(5,2,8,.55)}'
  +'.tel-modal{box-sizing:border-box;position:fixed;z-index:93;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 24px);overflow-y:auto;'
  +'background:#1C0E21;border:1px solid #4A2B50;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.55);padding:18px;color:#F3E9F4;font:500 13px var(--g-texto,Inter,system-ui,sans-serif)}'
  +'.tel-modal h2{font:800 16px var(--g-titulo,Montserrat,system-ui,sans-serif);margin:0 0 4px}.tel-modal .tel-act{margin:0 0 14px;color:#C9A8CC;font-size:12.5px}'
  +'.tel-modal label{display:block;font:700 10px var(--g-texto,Inter,system-ui,sans-serif);letter-spacing:1px;text-transform:uppercase;color:#C9A8CC;margin:12px 0 4px}'
  +'.tel-modal input,.tel-modal textarea{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid #4A2B50;background:#12080f;color:#F3E9F4;font:500 14px var(--g-texto,Inter,system-ui,sans-serif)}'
  +'.tel-modal textarea{min-height:76px;resize:vertical}.tel-modal input:focus,.tel-modal textarea:focus{outline:none;border-color:#C77BC9;box-shadow:0 0 0 3px rgba(199,123,201,.2)}'
  +'.tel-ori{display:grid;gap:6px}.tel-ori label{display:flex;align-items:center;gap:8px;margin:0;padding:8px 10px;border:1px solid #4A2B50;border-radius:12px;text-transform:none;letter-spacing:0;font:600 13px var(--g-texto,Inter,system-ui,sans-serif);color:#E3CFE5;cursor:pointer}'
  +'.tel-ori input{width:auto;accent-color:#924893}.tel-ori label:has(input:checked){border-color:#C77BC9;background:rgba(146,72,147,.18)}'
  +'.tel-ayuda{display:block;color:#8F6F94;font-size:11.5px;margin-top:4px}.tel-err{color:#FF8A8A;font-size:12.5px;min-height:18px;margin-top:10px}'
  +'.tel-pie{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.tel-pie button{min-height:40px;padding:0 16px;border-radius:999px;font:700 13px var(--g-texto,Inter,system-ui,sans-serif);cursor:pointer}'
  +'.tel-pie .tel-can{border:1px solid #4A2B50;background:transparent;color:#C9A8CC}.tel-pie .tel-ok{border:0;background:linear-gradient(160deg,#A9579F,#924893);color:#fff}.tel-pie .tel-ok:disabled{opacity:.5;cursor:not-allowed}'
  +'@media(max-width:600px){.tel-modal{left:0;right:0;top:auto;bottom:0;transform:none;width:100%;border-radius:20px 20px 0 0;padding:18px 16px calc(16px + env(safe-area-inset-bottom))}'
  +'.tel-modal input,.tel-modal textarea{font-size:16px}.tel-pie button{flex:1;min-height:46px}}';
function asegurarCss(){
  if(typeof document==='undefined'||document.getElementById('tel-css'))return;
  var s=document.createElement('style');s.id='tel-css';s.textContent=CSS;document.head.appendChild(s);
}

// HTML del botón. lead = {id, nombre, tel}. opts.mini = solo ícono (barra de la bitácora).
function boton(lead,opts){
  opts=opts||{};lead=lead||{};
  var d=' data-tel-lead="'+esc(Number(lead.id)||'')+'" data-tel-actual="'+esc(lead.tel==null?'':lead.tel)+'" data-tel-nombre="'+esc(lead.nombre||'')+'"';
  var cls='tel-btn'+(opts.mini?' mini':'');
  if(!TEL_CORRECCION_CONECTADA)
    return '<button type="button" class="'+cls+'" disabled aria-disabled="true"'+d+' title="'+esc(NO_CONECTADA)+'" aria-label="Corregir teléfono: '+esc(NO_CONECTADA)+'">✏️<span class="tel-lbl"> Corregir teléfono</span></button>';
  return '<button type="button" class="'+cls+'"'+d+' title="Corregir teléfono" aria-label="Corregir teléfono" aria-haspopup="dialog">✏️<span class="tel-lbl"> Corregir teléfono</span></button>';
}

var CFG={rpc:null,alGuardar:null}, abierto=null;
// rpc(fn, args) → Promise; alGuardar({id, tel, anterior, origen, respuesta})
function configurar(c){CFG.rpc=c&&c.rpc||null;CFG.alGuardar=c&&c.alGuardar||null;}

function cerrar(){
  if(!abierto)return;
  var a=abierto;abierto=null;a.velo.remove();a.modal.remove();
  document.removeEventListener('keydown',a.tecla,true);
  try{a.origen.focus();}catch(e){}
}
function abrir(btn){
  if(!TEL_CORRECCION_CONECTADA||!CFG.rpc)return;
  asegurarCss();cerrar();
  var id=Number(btn.getAttribute('data-tel-lead')),anterior=btn.getAttribute('data-tel-actual')||'',nombre=btn.getAttribute('data-tel-nombre')||'';
  var velo=document.createElement('div');velo.className='tel-velo';
  var modal=document.createElement('div');modal.className='tel-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','tel-tit');
  modal.innerHTML='<h2 id="tel-tit">✏️ Corregir teléfono'+(nombre?' · '+esc(nombre):'')+'</h2>'
    +'<p class="tel-act">Registrado hoy: <b>'+esc(anterior||'sin teléfono')+'</b></p>'
    +'<label for="tel-num">Número nuevo</label><input id="tel-num" type="tel" inputmode="tel" autocomplete="off" maxlength="30" placeholder="+56 9 1234 5678">'
    +'<small class="tel-ayuda">Celular chileno. Si tiene 8 dígitos, confírmalo con el prospecto: no se adivina el 9.</small>'
    +'<label id="tel-ori-l">Origen declarado por quien corrige</label><div class="tel-ori" role="radiogroup" aria-labelledby="tel-ori-l">'
    +ORIGENES.map(function(o){return '<label><input type="radio" name="tel-ori" value="'+o[0]+'"> '+esc(o[1])+'</label>';}).join('')+'</div>'
    +'<small class="tel-ayuda" id="tel-ori-nota">Queda registrado como declaración tuya. No es una verificación ni reemplaza el consentimiento del prospecto.</small>'
    +'<label for="tel-mot">Motivo</label><textarea id="tel-mot" maxlength="300" placeholder="Ej.: le escribí por correo y me respondió con su celular correcto"></textarea>'
    +'<div class="tel-err" id="tel-err" role="alert"></div>'
    +'<div class="tel-pie"><button type="button" class="tel-can">Cancelar</button><button type="button" class="tel-ok">Guardar</button></div>';
  document.body.appendChild(velo);document.body.appendChild(modal);
  var num=modal.querySelector('#tel-num'),mot=modal.querySelector('#tel-mot'),err=modal.querySelector('#tel-err'),ok=modal.querySelector('.tel-ok');
  function origen(){var r=modal.querySelector('input[name="tel-ori"]:checked');return r?r.value:null;}
  modal.querySelector('.tel-can').onclick=cerrar;velo.onclick=cerrar;
  ok.onclick=function(){
    var v=validar({tel:num.value,origen:origen(),motivo:mot.value,anterior:anterior});
    if(!v.ok){err.textContent=MSJ[v.codigo]||'Revisa los datos.';(v.campo==='tel'?num:v.campo==='motivo'?mot:(modal.querySelector('input[name="tel-ori"]')||ok)).focus();return;}
    ok.disabled=true;err.textContent='';ok.textContent='Guardando…';
    var ori=origen();
    CFG.rpc('prospecto_corregir_telefono',{p_lead_id:id,p_tel:v.e164,p_motivo:v.motivo,p_origen:ori}).then(function(r){
      var nuevo=(r&&r.tel)||v.e164;
      cerrar();
      if(CFG.alGuardar)CFG.alGuardar({id:id,tel:nuevo,anterior:anterior,origen:ori,respuesta:r});
    }).catch(function(e){ok.disabled=false;ok.textContent='Guardar';err.textContent=mensaje(e);});
  };
  var tecla=function(e){
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cerrar();return;}
    if(e.key==='Tab'){var f=modal.querySelectorAll('input,textarea,button:not([disabled])'),a=f[0],z=f[f.length-1];
      if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus();}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus();}}
  };
  document.addEventListener('keydown',tecla,true);
  abierto={velo:velo,modal:modal,tecla:tecla,origen:btn};
  num.focus();
}

if(typeof document!=='undefined'){
  asegurarCss();
  document.addEventListener('click',function(e){
    var b=e.target&&e.target.closest?e.target.closest('button[data-tel-lead]'):null;
    if(!b||b.disabled)return;
    e.preventDefault();e.stopPropagation();
    abrir(b);
  },true);
}

root.ProsTel={CONECTADA:TEL_CORRECCION_CONECTADA,NO_CONECTADA:NO_CONECTADA,ORIGENES:ORIGENES,MSJ:MSJ,normalizar:normalizar,validar:validar,
  mensaje:mensaje,boton:boton,configurar:configurar,abrir:abrir,cerrar:cerrar,abierto:function(){return !!abierto;}};
})(typeof window!=='undefined'?window:globalThis);
