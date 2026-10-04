/* ════════════════════════════════════════════════════════════════════════════
   Gestoor · Buscador de clientes (Luciano 4-oct: "siempre un buscador de clientes")
   Convierte cualquier <select data-buscador> en un campo donde se escribe parte del nombre o del RUT y se
   va filtrando. El <select> original se mantiene (oculto) como fuente de verdad: al elegir, se le asigna el valor
   y se dispara 'change', así el código existente (onchange, sv('id'), .value) sigue funcionando igual.
   Si el código vuelve a llenar las opciones del select, el buscador se actualiza solo (MutationObserver).
   Teclado: ↑ ↓ para moverse, Enter para elegir, Esc para cerrar. Sin dependencias.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  if (window.GestoorBuscador) return;
  var CSS = '.gb-wrap{position:relative;width:100%}'
    + '.gb-input{width:100%;box-sizing:border-box}'
    + '.gb-lista{position:absolute;left:0;right:0;top:100%;margin-top:4px;max-height:260px;overflow-y:auto;z-index:1000;'
    + 'background:var(--sur,#fff);border:1px solid var(--bdr,#e8dde8);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);display:none}'
    + '.gb-lista.on{display:block}'
    + '.gb-op{padding:8px 12px;font-size:13px;cursor:pointer;color:var(--t1,#1a0a1b);line-height:1.3}'
    + '.gb-op small{display:block;font-size:11px;color:var(--tm,#9a849b)}'
    + '.gb-op.sel,.gb-op:hover{background:rgba(146,72,147,.18)}'
    + '.gb-vacio{padding:10px 12px;font-size:12px;color:var(--tm,#9a849b)}'
    + '.gb-op mark{background:rgba(199,123,201,.35);color:inherit;border-radius:3px;padding:0 1px}';
  function estilos() { if (document.getElementById('gb-estilos')) return; var st = document.createElement('style'); st.id = 'gb-estilos'; st.textContent = CSS; document.head.appendChild(st); }
  // Normaliza para buscar: sin tildes, minúsculas, RUT sin puntos ni guion.
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.\-\s]/g, ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function mejorar(sel) {
    if (!sel || sel.dataset.gbListo) return;
    sel.dataset.gbListo = '1';
    estilos();
    var wrap = document.createElement('div'); wrap.className = 'gb-wrap';
    var inp = document.createElement('input'); inp.type = 'text'; inp.className = 'gb-input'; inp.autocomplete = 'off'; inp.spellcheck = false;
    inp.placeholder = sel.getAttribute('data-buscador-placeholder') || '🔍 Escribe el nombre o RUT del cliente…';
    inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-autocomplete', 'list'); inp.setAttribute('aria-expanded', 'false');
    if (sel.className) inp.className += ' ' + sel.className;
    var lista = document.createElement('div'); lista.className = 'gb-lista'; lista.setAttribute('role', 'listbox');
    sel.parentNode.insertBefore(wrap, sel); wrap.appendChild(inp); wrap.appendChild(lista); wrap.appendChild(sel);
    sel.style.display = 'none';
    var ops = [], vis = [], idx = -1;

    function leer() {
      ops = Array.prototype.filter.call(sel.options, function (o) { return o.value !== ''; }).map(function (o) {
        var t = o.textContent.trim(), m = t.match(/^(.*?)\s*·\s*([0-9.]{1,12}-[0-9kK])\s*$/);
        return { v: o.value, t: t, nombre: m ? m[1] : t, rut: m ? m[2] : o.value, k: norm(t + ' ' + o.value) };
      });
      var vacio = Array.prototype.find.call(sel.options, function (o) { return o.value === ''; });
      if (vacio && /no tienes|sin clientes/i.test(vacio.textContent) && !ops.length) inp.placeholder = vacio.textContent;
      mostrarSeleccion();
    }
    function mostrarSeleccion() {
      var o = ops.find(function (x) { return x.v === sel.value; });
      if (document.activeElement !== inp) inp.value = o ? o.nombre + (o.rut && o.rut !== o.nombre ? ' · ' + o.rut : '') : '';
    }
    function resaltar(t, q) {
      if (!q) return esc(t);
      var i = norm(t).indexOf(q); if (i < 0) return esc(t);
      // mapea posición normalizada a la original (aprox.: recorre caracteres contando los que no se eliminan)
      var a = -1, b = -1, n = 0;
      for (var j = 0; j < t.length; j++) { var c = norm(t[j]); if (!c) continue; if (n === i && a < 0) a = j; n += c.length; if (n >= i + q.length) { b = j + 1; break; } }
      return a < 0 || b < 0 ? esc(t) : esc(t.slice(0, a)) + '<mark>' + esc(t.slice(a, b)) + '</mark>' + esc(t.slice(b));
    }
    function pintar() {
      var q = norm(inp.value);
      vis = ops.filter(function (o) { return !q || o.k.indexOf(q) >= 0; }).slice(0, 80);
      idx = vis.length ? 0 : -1;
      lista.innerHTML = vis.length ? vis.map(function (o, i) {
        return '<div class="gb-op' + (i === idx ? ' sel' : '') + '" role="option" data-i="' + i + '">' + resaltar(o.nombre, q) + (o.rut && o.rut !== o.nombre ? '<small>' + resaltar(o.rut, q) + '</small>' : '') + '</div>';
      }).join('') : '<div class="gb-vacio">' + (ops.length ? 'Sin coincidencias' : 'No hay clientes disponibles') + '</div>';
      abrir();
    }
    function abrir() { lista.classList.add('on'); inp.setAttribute('aria-expanded', 'true'); }
    function cerrar() { lista.classList.remove('on'); inp.setAttribute('aria-expanded', 'false'); mostrarSeleccion(); }
    function elegir(i) {
      var o = vis[i]; if (!o) return;
      sel.value = o.v; sel.dispatchEvent(new Event('change', { bubbles: true }));
      inp.value = o.nombre + (o.rut && o.rut !== o.nombre ? ' · ' + o.rut : ''); lista.classList.remove('on'); inp.setAttribute('aria-expanded', 'false');
    }
    function mover(d) {
      if (!vis.length) return; idx = (idx + d + vis.length) % vis.length;
      Array.prototype.forEach.call(lista.children, function (el, i) { el.classList.toggle('sel', i === idx); if (i === idx) el.scrollIntoView({ block: 'nearest' }); });
    }
    inp.addEventListener('focus', function () { inp.select(); pintar(); });
    inp.addEventListener('input', function () { if (!inp.value) { sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })); } pintar(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); lista.classList.contains('on') ? mover(1) : pintar(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); mover(-1); }
      else if (e.key === 'Enter') { if (lista.classList.contains('on') && idx >= 0) { e.preventDefault(); elegir(idx); } }
      else if (e.key === 'Escape') { cerrar(); }
    });
    lista.addEventListener('mousedown', function (e) { var el = e.target.closest('.gb-op'); if (el) { e.preventDefault(); elegir(+el.getAttribute('data-i')); } });
    inp.addEventListener('blur', function () { setTimeout(cerrar, 120); });
    // El código existente vuelve a llenar las opciones o cambia el valor: el buscador se actualiza.
    new MutationObserver(leer).observe(sel, { childList: true, subtree: true, characterData: true });
    var desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    Object.defineProperty(sel, 'value', { configurable: true, get: function () { return desc.get.call(sel); }, set: function (v) { desc.set.call(sel, v); mostrarSeleccion(); } });
    leer();
  }
  function todos(raiz) { Array.prototype.forEach.call((raiz || document).querySelectorAll('select[data-buscador]'), mejorar); }
  window.GestoorBuscador = { mejorar: mejorar, todos: todos };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { todos(); }); else todos();
})();
