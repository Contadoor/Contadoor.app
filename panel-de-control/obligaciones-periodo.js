/* ============================================================
   panel-de-control/obligaciones-periodo.js — MARCHA-BLANCA (24-11-2026, MB-3)
   Botón SOLO Master en «Nómina del período»: «Preparar obligaciones». Llama a la RPC obligaciones_preparar_periodo:
     1) Simular (p_aplicar = false): qué obligaciones de cotizaciones se crearían y cómo va el F29 de cada reporte. No escribe.
     2) Aplicar (p_aplicar = true, con confirmación): la base crea las de cotizaciones que correspondan (monto, vencimiento y
        responsable los calcula el servidor; idempotente). El F29 sigue naciendo al «Cerrar reporte» en Contable.
   El navegador no calcula montos ni fechas. Sin la RPC instalada (404) se avisa y no pasa nada.
   ============================================================ */
(function(){
  'use strict';
  var NOM_COT={creada:'Creadas',actualizada:'Actualizadas',existente:'Ya existían',se_crearia:'Se crearían',difiere:'Monto distinto (se actualizaría)',
    bloqueada:'Bloqueadas (revisar en Pagos)',no_aplica:'No aplica (sin RR. HH. o paga el cliente)','pendiente:RRHH_NO_LISTO':'RR. HH. aún no lista',
    'pendiente:SIN_TOTAL_COTIZACIONES':'Sin total de cotizaciones','pendiente:MONTO_CON_DECIMALES':'Total con decimales'};
  var NOM_F29={existe:'Obligación registrada',nace_al_cerrar:'Nace al cerrar el reporte',cerrado_sin_obligacion:'Cerrado SIN obligación (revisar)',sin_monto:'Cerrado sin monto a pagar',no_aplica:'Sin contabilidad'};
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function fecha(d){return d?String(d).split('-').reverse().join('-'):'—';}
  function periodo(){var p=typeof getPeriodoActivo==='function'?getPeriodoActivo():null;return p&&p.periodo?String(p.periodo).slice(0,7):'';}
  function rpc(aplicar,per){
    return sbFetch('rpc/obligaciones_preparar_periodo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_periodo:per,p_aplicar:!!aplicar})})
      .then(function(r){
        if(r.status===404) throw new Error('La función del servidor aún no está instalada (paquete MARCHA-BLANCA MB-3).');
        return r.text().then(function(t){var j=null;try{j=JSON.parse(t);}catch(e){}
          if(!r.ok) throw new Error((j&&j.message)||('Error '+r.status));
          return j;});
      });
  }
  function tabla(titulo,cont,nom){
    var k=Object.keys(cont||{});if(!k.length)return '';
    return '<div class="card-hd">'+esc(titulo)+'</div><table style="width:100%;font-size:12px;margin-bottom:10px">'
      +k.map(function(x){return '<tr><td>'+esc(nom[x]||x)+'</td><td style="text-align:right;font-weight:700">'+esc(cont[x])+'</td></tr>';}).join('')+'</table>';
  }
  function pintar(res){
    var h='<div style="font-size:12px;margin-bottom:8px">Período <b>'+esc(res.periodo)+'</b> · vence F29 <b>'+fecha(res.vence_f29)+'</b> · cotizaciones (Previred) <b>'+fecha(res.vence_cotizaciones)+'</b>'
      +(res.aplicado?' · <b style="color:#28865B">aplicado</b>':' · <b>simulación (nada escrito)</b>')+'</div>';
    h+=tabla('👥 Cotizaciones',res.cotizaciones,NOM_COT)+tabla('🧾 F29',res.f29,NOM_F29);
    var d=res.detalle||[];
    if(d.length) h+='<div class="card-hd">Detalle ('+d.length+')</div><div style="max-height:220px;overflow:auto"><table style="width:100%;font-size:11.5px">'
      +'<tr><th style="text-align:left">Cliente</th><th>Cotizaciones</th><th>F29</th></tr>'
      +d.map(function(x){return '<tr><td>'+esc(x.cliente||x.cliente_rut)+'</td><td>'+esc(NOM_COT[x.cotizaciones]||x.cotizaciones)+(x.mensaje?'<div style="color:#D34433">'+esc(x.mensaje)+'</div>':'')+'</td><td>'+esc(NOM_F29[x.f29]||x.f29)+'</td></tr>';}).join('')
      +'</table></div>';
    document.getElementById('obp-res').innerHTML=h;
    var b=document.getElementById('obp-aplicar');
    var hay=res.cotizaciones&&(res.cotizaciones.se_crearia||res.cotizaciones.difiere);
    b.style.display=!res.aplicado&&hay?'':'none';
  }
  function correr(aplicar){
    var per=document.getElementById('obp-per').value;
    if(!/^\d{4}-\d{2}$/.test(per)){alert('Elige el período.');return;}
    if(aplicar&&!confirm('¿Crear las obligaciones de cotizaciones de '+per+'? Montos, vencimiento y responsable los calcula Gestoor; no se duplica nada.'))return;
    var res=document.getElementById('obp-res');res.innerHTML='<div style="padding:12px;color:var(--tm)">⏳ Consultando…</div>';
    rpc(aplicar,per).then(pintar).catch(function(e){res.innerHTML='<div style="padding:12px;color:#D34433">'+esc(e.message||e)+'</div>';});
  }
  function abrir(){
    var m=document.getElementById('modalObligPer');
    if(!m){
      m=document.createElement('div');m.className='modal-bg';m.id='modalObligPer';
      m.innerHTML='<div class="modal" style="max-width:640px"><div class="modal-header"><h2>💼 Preparar obligaciones del período</h2>'
        +'<p>F29 y cotizaciones (Previred) quedan en Pagos para que la Conciliación las calce. Primero se simula.</p></div><div class="modal-body">'
        +'<div class="fgroup" style="margin-bottom:10px"><label>Período</label><input type="month" id="obp-per"/></div>'
        +'<div id="obp-res"></div></div><div class="modal-footer" style="display:flex;gap:8px;justify-content:flex-end;padding-top:10px">'
        +'<button class="btn-s" id="obp-cerrar">Cerrar</button><button class="btn-s" id="obp-simular">🔍 Simular</button>'
        +'<button class="btn-p" id="obp-aplicar" style="display:none">✅ Crear obligaciones</button></div></div>';
      document.body.appendChild(m);
      document.getElementById('obp-cerrar').onclick=function(){m.classList.remove('on');};
      document.getElementById('obp-simular').onclick=function(){correr(false);};
      document.getElementById('obp-aplicar').onclick=function(){correr(true);};
    }
    document.getElementById('obp-per').value=periodo();
    document.getElementById('obp-res').innerHTML='';document.getElementById('obp-aplicar').style.display='none';
    m.classList.add('on');
  }
  function montar(){
    var u=typeof getUsuario==='function'?getUsuario():{};
    if(!u||u.esMaster!==true)return;
    var h=document.querySelector('.g-nomina .g-sec-h');
    if(!h||document.getElementById('btn-oblig-per'))return;
    var b=document.createElement('button');b.id='btn-oblig-per';b.className='g-btn sm';b.type='button';b.style.marginLeft='auto';
    b.textContent='💼 Preparar obligaciones';b.title='F29 y cotizaciones del período en Pagos (solo Master)';b.onclick=abrir;
    h.appendChild(b);
  }
  window.GestoorObligPeriodo={abrir:abrir,montar:montar,_pintar:pintar};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',montar);else montar();
  setTimeout(montar,1500);
})();
