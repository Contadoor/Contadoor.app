/* ============================================================
   facturacion/historial.js — "Historial por cliente" (F1d)
   Junta, para UN cliente, las facturas mensuales (F1a: public.facturacion) y las adicionales (F1c: public.facturas_adicionales),
   de la más reciente a la más antigua: fecha, folio, tipo, glosa, monto, estado, condición de pago, estado en Cobranza y PDF/XML.
   SOLO LECTURA con el JWT del usuario: RLS fact_puede_leer() (Master, pagos, cobranza, facturador). Cobranza se lee con su propia
   RLS; si el usuario no la ve, la columna muestra "—". Sin datos reales en este archivo.
   ============================================================ */
(function(){
'use strict';
var U=window.FX_UTIL, I=U.I, ic=U.ic, esc=U.esc, clp=U.clp;
var H={clientes:[],cli:null,filas:[],cargando:false,soloEmitidas:false,error:null};
function $(id){return document.getElementById(id);}
function fFecha(iso){if(!iso)return '—';var p=String(iso).slice(0,10).split('-');return p[2]+'-'+p[1]+'-'+p[0];}
var EST={EMITIDA:['Emitida','ver'],INCIERTO:['Incierta','ama'],ANULADA:['Anulada','gris'],ERROR:['Rechazada','roj'],EMITIENDO:['Emitiendo','cel'],
  APROBADA:['Aprobada · sin emitir','cel'],EN_REVISION:['En revisión','cel'],DEVUELTA:['Devuelta','amb'],LISTA:['Lista · sin emitir','gris'],BORRADOR:['Borrador','gris'],EXCLUIDA:['Excluida','gris']};
var COB={PENDIENTE:['Pendiente de pago','amb'],PAGADO:['Pagada','ver'],REPACTADO:['Repactada','cel'],CASTIGADO:['Castigada','roj'],ANULADO:['Anulada','gris']};
function chip(m,k){var x=m[k]||[k||'—','gris'];return '<span class="fx-est '+x[1]+'">'+esc(x[0])+'</span>';}
function cargarClientes(){
  if(H.clientes.length)return Promise.resolve();
  return sbGet('clientes?select=id,rut,razon_social,estado&order=razon_social.asc&limit=2000').then(function(r){H.clientes=r||[];});
}
function cargarCliente(id){
  H.cargando=true;H.error=null;render();
  var cid=encodeURIComponent(id);
  return Promise.all([
    sbGet('facturacion?select=id,periodo,tipo_lote,modo,estado,of_folio,fecha_emision,fecha_vencimiento,total_clp,total_dte,detalle,snapshot,doc_estado&cliente_id=eq.'+cid+'&estado=not.in.(BORRADOR,EXCLUIDA)&order=fecha_emision.desc&limit=500'),
    sbGet('facturas_adicionales?select=id,codigo,modo,estado,of_folio,fecha_emision,fecha_vencimiento,forma_pago,total,total_dte,lineas,doc_estado&cliente_id=eq.'+cid+'&estado=neq.BORRADOR&order=fecha_emision.desc&limit=500'),
    sbGet('cobranza_documentos?select=facturacion_id,ref_externa,estado,saldo&cliente_id=eq.'+cid+'&limit=1000')
  ]).then(function(r){
    var cob=r[2]||[], porF={}, porRef={};
    cob.forEach(function(d){if(d.facturacion_id)porF[d.facturacion_id]=d;if(d.ref_externa)porRef[d.ref_externa]=d;});
    var a=(r[0]||[]).map(function(x){var it=(x.detalle&&x.detalle.items)||[];var sn=x.snapshot||{};
      return {orden:x.fecha_emision||'',fecha:x.fecha_emision,folio:x.of_folio,tipo:'Mensual · grupo '+(x.tipo_lote||''),modo:x.modo,glosa:it.length?it[0].NmbItem+(it.length>1?' + '+(it.length-1)+' más':''):'Servicios del período '+(x.periodo||''),
        monto:+x.total_clp,dteDifiere:x.total_dte!=null&&+x.total_dte!==+x.total_clp,estado:x.estado,cond:sn.termino_pago||('Crédito · vence '+fFecha(x.fecha_vencimiento)),
        cob:porF[x.id]||null,docs:null};});
    var b=(r[1]||[]).map(function(x){var l=x.lineas||[];
      return {orden:x.fecha_emision||'',fecha:x.fecha_emision,folio:x.of_folio,tipo:'Adicional · '+x.codigo,modo:x.modo,glosa:l.length?l[0].glosa+(l.length>1?' + '+(l.length-1)+' más':''):'—',
        monto:+x.total,dteDifiere:x.total_dte!=null&&+x.total_dte!==+x.total,estado:x.estado,cond:x.forma_pago===1?'Contado':'Crédito · vence '+fFecha(x.fecha_vencimiento),
        cob:porRef[x.codigo]||null,docs:x.estado==='EMITIDA'&&x.doc_estado==='OBTENIDOS'?{id:x.id,folio:x.of_folio,codigo:x.codigo,modo:x.modo}:null};});
    H.filas=a.concat(b).sort(function(x,y){return x.orden<y.orden?1:(x.orden>y.orden?-1:0);});
    H.cargando=false;render();
  }).catch(function(e){H.cargando=false;H.error=String(e&&e.message||e);render();});
}
function descargar(d,tipo){
  sbGet('facturas_adicionales_documentos?select='+tipo+'_b64&factura_id=eq.'+d.id).then(function(r){
    var b=r&&r[0]&&r[0][tipo+'_b64'];if(!b)return;
    var bin=atob(b),u=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
    var url=URL.createObjectURL(new Blob([u],{type:tipo==='pdf'?'application/pdf':'application/xml'}));
    var a=document.createElement('a');a.href=url;a.download='Factura-34-'+(d.folio||d.codigo)+(d.modo==='PRUEBA'?'-PRUEBA':'')+'.'+tipo;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},4000);
  });
}
function render(){
  var v=$('vistaHist');if(!v)return;
  var opts=H.clientes.map(function(c){return '<option value="'+c.id+'"'+(String(H.cli)===String(c.id)?' selected':'')+'>'+esc(c.razon_social+' · '+c.rut)+(String(c.estado||'').toLowerCase()==='activo'?'':' (inactivo)')+'</option>';}).join('');
  var filas=H.soloEmitidas?H.filas.filter(function(f){return f.estado==='EMITIDA';}):H.filas;
  var total=filas.filter(function(f){return f.estado==='EMITIDA'&&f.modo==='PRODUCCION';}).reduce(function(a,f){return a+f.monto;},0);
  var cuerpo;
  if(!H.cli)cuerpo='<p class="ninguna">Elige un cliente para ver su historial de facturación.</p>';
  else if(H.cargando)cuerpo='<p class="ninguna">Cargando…</p>';
  else if(H.error)cuerpo='<p class="ninguna">No se pudo cargar el historial. Recarga la pantalla.</p>';
  else if(!filas.length)cuerpo='<p class="ninguna">Este cliente aún no tiene facturas en Gestoor.</p>';
  else cuerpo='<div class="tabla-box"><table><thead><tr><th>Fecha</th><th>Folio</th><th>Tipo</th><th>Glosa</th><th class="num">Monto</th><th>Estado</th><th>Condición de pago</th><th>Cobranza</th><th><span class="sr">Documentos</span>PDF / XML</th></tr></thead><tbody>'
   +filas.map(function(f,i){
     return '<tr><td>'+fFecha(f.fecha)+'</td><td class="cifra">'+(f.folio?'N° '+esc(f.folio):'—')+(f.modo==='PRUEBA'?' <span class="fx-est cel" title="Ambiente de pruebas, sin SII">PRUEBA</span>':'')+'</td>'
      +'<td>'+esc(f.tipo)+'</td><td>'+esc(f.glosa)+'</td><td class="num cifra">'+clp(f.monto)+(f.dteDifiere?' <span class="fx-est roj">DTE difiere</span>':'')+'</td>'
      +'<td>'+chip(EST,f.estado)+'</td><td>'+esc(f.cond)+'</td><td>'+(f.cob?chip(COB,f.cob.estado)+(+f.cob.saldo>0&&f.cob.estado==='PENDIENTE'?'<span class="sub">saldo '+clp(+f.cob.saldo)+'</span>':''):'—')+'</td>'
      +'<td>'+(f.docs?'<button type="button" class="g-btn sm" data-hist="pdf" data-i="'+i+'">'+I('bajar')+'PDF</button> <button type="button" class="g-btn sm" data-hist="xml" data-i="'+i+'">'+I('bajar')+'XML</button>':'—')+'</td></tr>';
   }).join('')+'</tbody></table></div>';
  v.innerHTML='<div class="g-sec-h"><i class="ic placa ic-cel" data-ic="reloj"></i><h2>Historial de <span>facturación</span></h2><small>Facturas mensuales y adicionales del cliente · de la más reciente a la más antigua</small></div>'
   +'<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:4px 0 14px">'
   +'<label class="sim"><span class="sim-tag">CLIENTE</span><select id="histCli" aria-label="Cliente"><option value="">Elige un cliente…</option>'+opts+'</select></label>'
   +'<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="histSolo"'+(H.soloEmitidas?' checked':'')+'> Solo emitidas</label>'
   +(H.cli&&!H.cargando?'<span style="margin-left:auto" class="sub">'+filas.length+' documentos · emitido real '+clp(total)+'</span>':'')+'</div>'+cuerpo;
  $('hero').innerHTML='<div class="hero-top"><div><small class="k">Por cliente</small><h2>Historial de <span>facturación</span></h2>'
   +'<div class="meta"><span class="it">'+I('factura','ic-mor')+'Mensuales (grupos) + adicionales</span><span class="it">'+I('candado','ic-cel')+'Solo lectura</span></div></div></div>';
}
document.addEventListener('change',function(e){
  if(e.target&&e.target.id==='histCli'){H.cli=e.target.value||null;if(H.cli)cargarCliente(H.cli);else{H.filas=[];render();}}
  if(e.target&&e.target.id==='histSolo'){H.soloEmitidas=e.target.checked;render();}
});
document.addEventListener('click',function(e){
  var b=e.target.closest('#vistaHist [data-hist]');if(!b)return;e.stopPropagation();
  var filas=H.soloEmitidas?H.filas.filter(function(f){return f.estado==='EMITIDA';}):H.filas;var f=filas[+b.getAttribute('data-i')];
  if(f&&f.docs)descargar(f.docs,b.getAttribute('data-hist'));
});
window.FX_HISTORIAL={render:function(ctx){
  if(ctx&&ctx.demo){$('vistaHist').innerHTML='<div class="g-sec-h"><i class="ic placa ic-cel" data-ic="reloj"></i><h2>Historial de <span>facturación</span></h2></div><p class="ninguna">El historial por cliente funciona solo con datos reales (no hay datos de demostración).</p>';return;}
  render();cargarClientes().then(render);
}};
})();
