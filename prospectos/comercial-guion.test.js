// Pruebas de prospectos/comercial-guion.js · ejecutar: node --test prospectos/comercial-guion.test.js  (datos 100% sintéticos)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./comercial-guion.js');

test('versión del guion con el formato que acepta la base', () => {
  assert.match(G.GUION_VERSION, /^[a-z0-9._-]{1,30}$/);
});

test('guion completo: 8 bloques en el orden del diseño', () => {
  assert.deepEqual(G.BLOQUES.map((b) => b.n), ['Situación actual', 'Contabilidad y contador', 'Trabajadores', 'Dolores', 'Metas', 'Tributario', 'Urgencias', 'Presupuesto y cierre']);
});

test('claves de campos únicas y válidas para la base (sin palabras de clave/contraseña)', () => {
  const ks = G.campos().map((c) => c.k);
  assert.equal(new Set(ks).size, ks.length);
  for (const k of ks) {
    assert.match(k, /^[a-z0-9_]{1,40}$/);
    if (k !== 'sii_acceso') assert.doesNotMatch(k, /(clave|password|passwd|contrasena|token|secret|^pin$|^pin_|_pin$)/);
  }
  assert.ok(G.BLOQUES.length + 1 <= 20, 'notas por bloque + general caben en el límite de 20');
});

test('SII: solo ¿tiene acceso? con opciones si/no/contador, nunca un campo de texto', () => {
  const c = G.campo('sii_acceso');
  assert.equal(c.t, 'op');
  assert.deepEqual(c.o.map((o) => o[0]), ['si', 'no', 'contador']);
  assert.equal(c.onb, 1);
});

test('los 🧩 del diseño §5.3 están marcados para el onboarding', () => {
  const onb = G.campos().filter((c) => c.onb).map((c) => c.k);
  for (const k of ['razon_social', 'rut_empresa', 'giro', 'inicio_act', 'tipo_soc', 'socios', 'cont_ant', 'traspaso', 'erp', 'sii_acceso', 'ntrab',
                   'regimen', 'iva', 'f29_dia', 'f29_atrasados', 'f22', 'urgencias', 'plan', 'compromisos']) assert.ok(onb.includes(k), k);
});

test('precarga desde la agenda: rellena solo lo vacío y deja pistas', () => {
  const r = G.precarga({ ventas: '5a20', trabajadores: '1a5', contabilidad: 'yo', sociedades: 'no', historicos: 'si', rubro: 'ferretería', dolor: 'me avisan tarde' }, 'Empresa Demo SpA', { giro: 'ya anotado' });
  assert.equal(r.campos.ventas, '5a20');
  assert.equal(r.campos.quien, 'propio');
  assert.equal(r.campos.mas_sociedades, 'no');
  assert.equal(r.campos.frase, 'me avisan tarde');
  assert.equal(r.campos.razon_social, 'Empresa Demo SpA');
  assert.equal(r.campos.giro, undefined, 'no pisa lo ya anotado');
  assert.equal(r.campos.ntrab, undefined, 'un tramo no es un número exacto');
  assert.match(r.pistas.ntrab, /1 a 5/);
  assert.match(r.pistas.urgencias, /atrasos/);
  assert.equal(G.precarga({ trabajadores: 'ninguno' }).campos.ntrab, '0');
  assert.deepEqual(G.precarga(null).campos, {});
});

test('brújula: trabajadores → alerta de remuneraciones con 0,39 UF por trabajador', () => {
  const b = G.brujula({ ntrab: '3' }, 0);
  const a = b.alertas.map((x) => x[1]).join(' | ');
  assert.match(a, /remuneraciones/);
  assert.match(a, /0,39 UF por trabajador/);
  assert.match(a, /1,17 UF/);
});

test('brújula: F29 atrasados → N × $18.990', () => {
  const a = G.brujula({ f29_dia: 'no', f29_atrasados: '3' }, 0).alertas.map((x) => x[1]).join(' | ');
  assert.match(a, /3 × \$18\.990 = \$56\.970/);
  const sinN = G.brujula({ f29_dia: 'no' }, 0).alertas.map((x) => x[1]).join(' | ');
  assert.match(sinN, /pregunta cuántos/);
  assert.equal(G.brujula({ f29_dia: 'si', f29_atrasados: '3' }, 0).f29_clp, 0, 'si está al día no cuenta los atrasados');
});

test('brújula: "solo quiero cumplir" sin trabajadores → calza Cumplimiento (el plan simple)', () => {
  const b = G.brujula({ dolores: ['solo_cumplir'], ntrab: '0', ventas: 'hasta5' }, 0);
  assert.equal(b.gana.k, 'cumplimiento');
  assert.ok(b.alertas.some((x) => /Calza Cumplimiento/.test(x[1])));
});

test('brújula: IVA tarde / no sé cómo va → PRO; más de una sociedad + decisiones → Estratégico', () => {
  assert.equal(G.brujula({ dolores: ['iva_tarde', 'como_va'], ventas: '5a20' }, 0).gana.k, 'pro');
  assert.equal(G.brujula({ mas_sociedades: 'si', dolores: ['decisiones'], reuniones: 'mensual' }, 0).gana.k, 'estrategico');
});

test('brújula: expectativa 24/7, menor precio, sin acceso SII, renta pendiente y minuto 20', () => {
  const a = G.brujula({ espera: 'siempre', dolores: ['precio'], sii_acceso: 'no', f22: 'pendiente' }, 21).alertas.map((x) => x[1]).join(' | ');
  assert.match(a, /ilimitada/);
  assert.match(a, /caro comparado con qué/);
  assert.match(a, /flujo seguro/);
  assert.match(a, /Operación Renta/);
  assert.match(a, /Van 21 min/);
});

test('brújula: "te falta preguntar" incluye la pregunta de los 6 meses y se vacía al completar', () => {
  assert.ok(G.brujula({}, 0).falta.some((x) => /6 meses/.test(x[1])));
  const lleno = { meta6: 'x', espera: 'normal', ntrab: '1', regimen: 'propyme_t', f29_dia: 'si', f22: 'presentado', rut_empresa: '1-9', sii_acceso: 'si', decide: 'el' };
  assert.equal(G.brujula(lleno, 0).falta.length, 0);
});

test('foto de la brújula para el cierre: chica y con la versión del guion', () => {
  const f = G.brujula({ ntrab: '2', f29_dia: 'no', f29_atrasados: '2' }, 12).foto;
  assert.equal(f.guion, G.GUION_VERSION);
  assert.equal(f.trabajadores, 2);
  assert.equal(f.f29, 2);
  assert.ok(JSON.stringify(f).length < 20000);
});

test('fases de la reunión según el minuto', () => {
  assert.equal(G.FASES[G.fase(0)], 'Apertura');
  assert.equal(G.FASES[G.fase(7)], 'Dolor');
  assert.equal(G.FASES[G.fase(21)], 'Prescripción');
  assert.equal(G.FASES[G.fase(40)], 'Próximo paso');
});

test('avance por bloque y conteo 🧩 respetan los campos dependientes', () => {
  const trib = G.BLOQUES.find((b) => b.id === 'trib');
  assert.equal(G.avanceBloque({ f29_dia: 'si' }, trib).t, 5, 'F29 atrasados oculto si está al día');
  assert.equal(G.avanceBloque({ f29_dia: 'no' }, trib).t, 6);
  const o = G.onb({ razon_social: 'X', sii_acceso: 'si' });
  assert.equal(o.n, 2);
});

test('motivos de pérdida = catálogo de la base', () => {
  assert.deepEqual(G.MOTIVOS.map((m) => m[0]), ['precio', 'eligio_otro', 'no_responde', 'no_calza', 'lo_hara_solo', 'otro']);
});
