// BANDEJA-MEDIOS (25-11) · Nota de voz: Chrome graba audio/webm (Opus), que WhatsApp NO acepta; WhatsApp sí acepta audio/ogg (Opus).
// Aquí se REEMPAQUETA el mismo audio Opus de WebM a Ogg, sin volver a codificar (no hay pérdida ni librerías externas):
//   1) se leen del WebM (EBML) el OpusHead (CodecPrivate) y los paquetes Opus de cada SimpleBlock/Block;
//   2) se escriben páginas Ogg (RFC 3533) con OpusHead, OpusTags y los paquetes, con su granule (muestras a 48 kHz, RFC 7845).
// Si el WebM trae algo inesperado (otro códec, lacing, varias pistas de audio) se lanza un error: la pantalla avisa y no envía.
(function (raiz) {
  'use strict';
  var ID = { EBML: 0x1a45dfa3, SEGMENT: 0x18538067, CLUSTER: 0x1f43b675, TRACKS: 0x1654ae6b, TRACK: 0xae, AUDIO: 0xe1,
    BLOCKGROUP: 0xa0, BLOCK: 0xa1, SIMPLEBLOCK: 0xa3, CODECID: 0x86, CODECPRIVATE: 0x63a2, TRACKNUM: 0xd7, CHANNELS: 0x9f };
  // Elementos «contenedor»: se recorren por dentro (sirve también con tamaño desconocido, como graba Chrome).
  var CONTENEDOR = {}; [ID.SEGMENT, ID.CLUSTER, ID.TRACKS, ID.TRACK, ID.AUDIO, ID.BLOCKGROUP].forEach(function (x) { CONTENEDOR[x] = 1; });

  function vint(b, p, conMarca) {
    var x = b[p]; if (x === undefined) throw new Error('webm_truncado');
    var largo = 1, m = 0x80;
    while (largo <= 8 && !(x & m)) { largo++; m >>= 1; }
    if (largo > 8) throw new Error('webm_vint');
    var v = conMarca ? x : (x & (m - 1)), todosUnos = (x & (m - 1)) === m - 1;
    for (var i = 1; i < largo; i++) { if (b[p + i] === undefined) throw new Error('webm_truncado'); v = v * 256 + b[p + i]; if (b[p + i] !== 0xff) todosUnos = false; }
    return { v: v, largo: largo, desconocido: !conMarca && todosUnos };
  }
  function leerWebm(buf) {
    var b = new Uint8Array(buf), p = 0, pista = null, codec = null, priv = null, canales = 1, numPista = null, paquetes = [];
    while (p < b.length) {
      var id = vint(b, p, true); p += id.largo;
      var tam = vint(b, p, false); p += tam.largo;
      if (CONTENEDOR[id.v]) continue;                                       // entrar al contenedor
      if (tam.desconocido) throw new Error('webm_tamano_desconocido');
      var fin = p + tam.v; if (fin > b.length) { if (id.v === ID.SIMPLEBLOCK || id.v === ID.BLOCK) break; throw new Error('webm_truncado'); }
      if (id.v === ID.TRACKNUM) { numPista = 0; for (var i = p; i < fin; i++) numPista = numPista * 256 + b[i]; }
      else if (id.v === ID.CODECID) { codec = String.fromCharCode.apply(null, b.subarray(p, fin)); if (codec === 'A_OPUS') pista = numPista; }
      else if (id.v === ID.CODECPRIVATE) { if (codec === 'A_OPUS' || codec === null) priv = b.slice(p, fin); }
      else if (id.v === ID.CHANNELS) { canales = b[p] || 1; }
      else if (id.v === ID.SIMPLEBLOCK || id.v === ID.BLOCK) {
        var t = vint(b, p, false), flags = b[p + t.largo + 2];
        if (pista === null && codec === 'A_OPUS') pista = numPista;
        if (t.v === pista || pista === null) {
          if (flags & 0x06) throw new Error('webm_lacing');                // MediaRecorder no usa lacing
          paquetes.push(b.slice(p + t.largo + 3, fin));
        }
      }
      p = fin;
    }
    if (codec !== 'A_OPUS') throw new Error('webm_no_opus');
    if (!paquetes.length) throw new Error('webm_sin_audio');
    return { opusHead: priv && priv.length >= 19 && String.fromCharCode.apply(null, priv.subarray(0, 8)) === 'OpusHead' ? priv : opusHead(canales), paquetes: paquetes };
  }
  function opusHead(canales) {
    var h = new Uint8Array(19); h.set([79, 112, 117, 115, 72, 101, 97, 100]);          // "OpusHead"
    h[8] = 1; h[9] = canales; h[10] = 0x38; h[11] = 0x01;                                // versión 1 · pre-skip 312
    h[12] = 0x80; h[13] = 0xbb; h[14] = 0; h[15] = 0;                                    // 48000 Hz
    return h;                                                                            // ganancia 0 · mapping 0
  }
  // Muestras (48 kHz) de un paquete Opus según su TOC (RFC 6716 §3.1).
  function muestras(pk) {
    if (!pk.length) return 0;
    var toc = pk[0], cfg = toc >> 3, ms;
    if (cfg < 12) ms = [10, 20, 40, 60][cfg & 3];
    else if (cfg < 16) ms = [10, 20][cfg & 1];
    else ms = [2.5, 5, 10, 20][cfg & 3];
    var c = toc & 3, tramas = c === 0 ? 1 : c === 3 ? (pk[1] & 0x3f) : 2;
    return Math.round(ms * 48) * tramas;
  }
  var TABLA = (function () { var t = new Uint32Array(256); for (var i = 0; i < 256; i++) { var r = i << 24; for (var k = 0; k < 8; k++) r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1); t[i] = r >>> 0; } return t; })();
  function crc(b) { var c = 0; for (var i = 0; i < b.length; i++) c = ((c << 8) ^ TABLA[((c >>> 24) ^ b[i]) & 0xff]) >>> 0; return c; }
  function pagina(paquetes, granule, serie, sec, tipo) {
    var seg = [], cuerpo = 0;
    paquetes.forEach(function (pk) { var n = pk.length; while (n >= 255) { seg.push(255); n -= 255; } seg.push(n); cuerpo += pk.length; });
    var h = new Uint8Array(27 + seg.length + cuerpo), dv = new DataView(h.buffer);
    h.set([79, 103, 103, 83]); h[4] = 0; h[5] = tipo;                                    // "OggS" · versión 0 · tipo
    dv.setUint32(6, granule % 0x100000000, true); dv.setUint32(10, Math.floor(granule / 0x100000000), true);
    dv.setUint32(14, serie, true); dv.setUint32(18, sec, true); dv.setUint32(22, 0, true);
    h[26] = seg.length; h.set(seg, 27);
    var o = 27 + seg.length; paquetes.forEach(function (pk) { h.set(pk, o); o += pk.length; });
    dv.setUint32(22, crc(h), true);
    return h;
  }
  function escribirOgg(head, paquetes) {
    var serie = (Math.random() * 0xffffffff) >>> 0, sec = 0, pags = [];
    var vendor = [71, 101, 115, 116, 111, 111, 114];                                     // "Gestoor"
    var tags = new Uint8Array(8 + 4 + vendor.length + 4); tags.set([79, 112, 117, 115, 84, 97, 103, 115]);
    new DataView(tags.buffer).setUint32(8, vendor.length, true); tags.set(vendor, 12);
    pags.push(pagina([head], 0, serie, sec++, 0x02));                                    // BOS
    pags.push(pagina([tags], 0, serie, sec++, 0));
    var preskip = head[10] | (head[11] << 8), g = 0, grupo = [], nseg = 0;
    for (var i = 0; i < paquetes.length; i++) {
      var pk = paquetes[i], s = Math.floor(pk.length / 255) + 1;
      if (grupo.length && (nseg + s > 255 || grupo.length >= 50)) { pags.push(pagina(grupo, g, serie, sec++, 0)); grupo = []; nseg = 0; }
      grupo.push(pk); nseg += s; g += muestras(pk);
    }
    if (g < preskip) g = preskip;
    pags.push(pagina(grupo, g, serie, sec++, 0x04));                                     // EOS
    var total = pags.reduce(function (a, x) { return a + x.length; }, 0), out = new Uint8Array(total), o = 0;
    pags.forEach(function (x) { out.set(x, o); o += x.length; });
    return { bytes: out, muestras: g };
  }
  function webmAOgg(buf) { var w = leerWebm(buf); var r = escribirOgg(w.opusHead, w.paquetes); return { bytes: r.bytes, segundos: r.muestras / 48000, paquetes: w.paquetes.length }; }
  var api = { webmAOgg: webmAOgg, _muestras: muestras, _crc: crc };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.GestoorOpusOgg = api;
})(typeof window !== 'undefined' ? window : this);
