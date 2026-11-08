/* P1-B · Puente 12-nov · PDF del reporte mensual (A-PAN-05).
   Antes: "Imprimir PDF" hacía window.print() de la página COMPLETA del Panel, con el reporte dentro de un iframe de 70vh → el PDF salía
   cortado (solo lo visible del iframe) y con el modal alrededor.
   Ahora: el HTML del reporte se imprime en un documento PROPIO (iframe oculto, sin el Panel), con @page A4 y reglas de salto de página
   para que ninguna tarjeta, fila ni bloque quede partido entre dos páginas. Colores de marca exactos (print-color-adjust).
   Uso: GestoorReportePDF.imprimir(htmlDelReporte, {empresa, periodo}) · GestoorReportePDF.documento(html, titulo) (para pruebas). */
(function () {
  var FUENTES = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Montserrat:wght@700;800;900&display=swap';
  var CSS_IMPRESION =
    '@page{size:A4 portrait;margin:9mm 7mm}' +
    'html,body{margin:0;padding:0;background:#0C070E;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}' +
    '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '@media print{' +
      'html,body{background:#0C070E}' +
      // Cada bloque del reporte (filas de la tabla principal, tarjetas, tablas internas, imágenes) no se parte entre páginas.
      // Si un bloque es más alto que una página, el navegador igual lo divide (no hay pérdida de contenido).
      '.rp-pdf table table table, .rp-pdf table table table tr, .rp-pdf img, .rp-pdf td > div, .rp-pdf p{break-inside:avoid;page-break-inside:avoid}' +
      '.rp-pdf > table > tbody > tr > td > table > tbody > tr{break-inside:avoid;page-break-inside:avoid}' +
      // overflow:hidden/clip del marco redondeado recorta contenido al paginar en Chrome: se libera solo al imprimir.
      '.rp-pdf table{overflow:visible!important}' +
      '.rp-pdf a{text-decoration:none}' +
    '}';

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Nombre del archivo que propone Chrome al "Guardar como PDF" (= <title>): Reporte_2026-10_Empresa.
  function nombreArchivo(o) {
    o = o || {};
    var limpio = function (t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60); };
    return ['Reporte', limpio(o.periodo) || 'periodo', limpio(o.empresa) || 'cliente'].join('_');
  }

  function documento(html, titulo) {
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>' + esc(titulo || 'Reporte') + '</title>' +
      '<link href="' + FUENTES + '" rel="stylesheet"><style>' + CSS_IMPRESION + '</style></head>' +
      '<body><div class="rp-pdf">' + html + '</div></body></html>';
  }

  // Imprime en un iframe oculto (no abre ventanas emergentes). Espera fuentes e imágenes antes de imprimir.
  function imprimir(html, o) {
    return new Promise(function (ok, no) {
      if (!html || typeof html !== 'string') return no(new Error('No hay reporte para imprimir: abre primero la vista previa.'));
      var previo = document.getElementById('rp-pdf-frame'); if (previo) previo.remove();
      var f = document.createElement('iframe');
      f.id = 'rp-pdf-frame'; f.title = 'Reporte para PDF'; f.setAttribute('aria-hidden', 'true');
      f.style.cssText = 'position:fixed;right:0;bottom:0;width:820px;height:1100px;border:0;opacity:0;pointer-events:none;z-index:-1';
      f.onload = function () {
        var w = f.contentWindow, d = f.contentDocument;
        var imgs = Array.prototype.slice.call(d.images || []);
        var esperaImg = Promise.all(imgs.map(function (im) { return im.complete ? 1 : new Promise(function (r) { im.onload = im.onerror = r; }); }));
        var esperaFuentes = (d.fonts && d.fonts.ready) ? d.fonts.ready : Promise.resolve();
        var tope = new Promise(function (r) { setTimeout(r, 4000); });
        Promise.race([Promise.all([esperaImg, esperaFuentes]), tope]).then(function () {
          try { w.focus(); w.print(); ok(true); } catch (e) { no(e); }
        });
      };
      f.srcdoc = documento(html, nombreArchivo(o));
      document.body.appendChild(f);
    });
  }

  window.GestoorReportePDF = { documento: documento, imprimir: imprimir, nombreArchivo: nombreArchivo, CSS_IMPRESION: CSS_IMPRESION };
})();
