/* APR-1 · Comprobantes de pago (bucket PRIVADO "comprobantes-pago" en Supabase Storage).
   - Subir: solo el analista que creó la obligación (o el Master) y solo con la obligación en pago o rechazada;
     lo vuelve a validar la política del bucket y la RPC registrar_comprobante.
   - Ver: enlace firmado de 5 minutos; la política del bucket deja verlo solo a quien puede ver la obligación.
   Usa el JWT de la sesión (supabase.js). Sin sesión → error (fail-closed, nunca la clave anon como Bearer). */
(function () {
  var BUCKET = 'comprobantes-pago';
  var MAX = 10 * 1024 * 1024;
  var EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  function token() {
    if (typeof _gestoorAccessToken === 'undefined' || !_gestoorAccessToken) throw new Error('Tu sesión expiró. Vuelve a entrar a Gestoor.');
    return _gestoorAccessToken;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function rutaObj(path) { return path.split('/').map(encodeURIComponent).join('/'); }

  // Sube el archivo y lo registra en la obligación. Devuelve la ruta guardada.
  window.gComprobanteSubir = function (obligacionId, file) {
    return new Promise(function (ok, no) {
      if (!file) return no(new Error('Elige un archivo.'));
      var ext = EXT[file.type];
      if (!ext) return no(new Error('El comprobante debe ser PDF, JPG, PNG o WEBP.'));
      if (file.size > MAX) return no(new Error('El archivo pesa más de 10 MB.'));
      if (!/^[1-9][0-9]*$/.test(String(obligacionId))) return no(new Error('Obligación inválida.'));
      var path = String(obligacionId) + '/' + uuid().toLowerCase() + '.' + ext;
      var t; try { t = token(); } catch (e) { return no(e); }
      fetch(SB_URL + '/storage/v1/object/' + BUCKET + '/' + rutaObj(path), {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + t, 'apikey': SB_KEY, 'Content-Type': file.type, 'x-upsert': 'false' },
        body: file
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (tx) { throw new Error('No se pudo subir el archivo (' + r.status + '). ' + (r.status === 403 || r.status === 400 ? 'Revisa que la obligación esté en pago o rechazada y que seas quien la creó.' : '') + (tx && tx.length < 200 ? ' ' + tx : '')); });
        return sbFetch('rpc/registrar_comprobante', { method: 'POST', body: JSON.stringify({ p_obligacion_id: Number(obligacionId), p_path: path }) });
      }).then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.message || ('No se pudo registrar el comprobante (' + r.status + ').')); });
        ok(path);
      }).catch(no);
    });
  };

  // Abre el comprobante con un enlace firmado de 5 minutos.
  window.gComprobanteVer = function (path) {
    var ventana = window.open('', '_blank');   // se abre antes del fetch para que el navegador no la bloquee
    if (ventana) { try { ventana.opener = null; } catch (e) {} }
    var t; try { t = token(); } catch (e) { if (ventana) ventana.close(); alert(e.message); return; }
    fetch(SB_URL + '/storage/v1/object/sign/' + BUCKET + '/' + rutaObj(path), {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + t, 'apikey': SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 300 })
    }).then(function (r) { if (!r.ok) throw new Error('No tienes acceso a este comprobante o ya no existe (' + r.status + ').'); return r.json(); })
      .then(function (j) {
        var u = j.signedURL || j.signedUrl; if (!u) throw new Error('No se pudo abrir el comprobante.');
        var url = /^https?:/.test(u) ? u : SB_URL + '/storage/v1' + (u.charAt(0) === '/' ? '' : '/') + u;
        if (ventana) ventana.location = url; else window.location.href = url;
      })
      .catch(function (e) { if (ventana) ventana.close(); alert(e.message); });
  };
})();
