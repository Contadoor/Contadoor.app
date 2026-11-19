// Pruebas de prospectos/comercial-guion.js · ejecutar: node --test prospectos/comercial-guion.test.js  (datos 100% sintéticos)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('./comercial-guion.js');

// Mismas reglas que la base (public.com_validar_campos / com_validar_notas / com_bitacoras_guion_version_check).
const CLAVE_PROHIBIDA = /(clave|password|passwd|contrasena|token|secret|previred|api_?key|credencial|certificado|pfx|passphrase|^pin$|^pin_|_pin$)/;

test('versión del guion c2 con el formato que acepta la base', () => {
  assert.match(G.GUION_VERSION, /^[a-z0-9._-]{1,30}$/);
  assert.match(G.GUION_VERSION, /^c2-/);
  assert.notEqual(G.GUION_VERSION, G.LEGADO.version);
});

test('las pantallas que abren bitácoras sin cargar el guion usan la misma versión por defecto', () => {
  for (const f of ['reuniones.js', 'simple.js']) {
    const src = fs.readFileSync(path.join(__dirname, f), 'utf8');
    const m = src.match(/ComGuionVersion\|\|'([^']+)'/);
    assert.ok(m, f);
    assert.equal(m[1], G.GUION_VERSION, f);
  }
});

test('guion compacto: 7 bloques por tiempos de la hoja aprobada', () => {
  assert.deepEqual(G.BLOQUES.map((b) => b.num + ' ' + b.n), ['1 Apertura', '2 Tu empresa', '2 Cómo está hoy', '2 Qué quiere lograr', '3 Nuestro Motor', '4 ¿Cuál es tu momento?', '5 Cierre y siguiente paso']);
  assert.deepEqual(G.FASE_MIN, [0, 3, 7, 11, 15, 22, 27]);
});

test('exactamente 15 preguntas, numeradas 1..15 y en orden', () => {
  const qs = G.campos().filter((c) => c.qt);
  assert.deepEqual(qs.map((c) => c.q), Array.from({ length: 15 }, (_, i) => i + 1));
  assert.equal(qs[0].qt, '¿A qué se dedica y desde cuándo?');
  assert.match(qs[3].qt, /boletas de honorarios/);
  assert.equal(qs[9].qt, '¿Qué es lo que más le molesta del servicio actual?');
  assert.equal(qs[14].qt, '¿Desde cuándo quiere partir?');
  const porBloque = (id) => qs.filter((c) => G.BLOQUES.find((b) => b.id === id).campos.includes(c)).map((c) => c.q);
  assert.deepEqual(porBloque('emp'), [1, 2, 3, 4, 5]);
  assert.deepEqual(porBloque('hoy'), [6, 7, 8, 9, 10]);
  assert.deepEqual(porBloque('log'), [11, 12, 13, 14, 15]);
});

test('respuestas rápidas: la mayoría son toques (op/chk); texto solo donde hace falta', () => {
  const cs = G.campos().filter((c) => !c.opc);
  const toques = cs.filter((c) => c.t === 'op' || c.t === 'chk').length;
  assert.ok(toques / cs.length >= 0.8, `toques ${toques}/${cs.length}`);
});

test('claves de campos únicas y válidas para la base (sin palabras de clave/contraseña ni "previred")', () => {
  const ks = G.campos().map((c) => c.k);
  assert.equal(new Set(ks).size, ks.length);
  for (const k of ks) {
    assert.match(k, /^[a-z0-9_]{1,40}$/);
    if (k !== 'sii_acceso') assert.doesNotMatch(k, CLAVE_PROHIBIDA, k);
  }
  assert.ok(ks.length <= 150);
  // Notas: bloques vigentes + general + notas de una bitácora c1 que se continúe → bajo el límite de 20 de la base.
  assert.ok(G.BLOQUES.length + 1 + Object.keys(G.LEGADO.notas).length <= 20);
  const ids = G.BLOQUES.map((b) => b.id);
  for (const id of Object.keys(G.LEGADO.notas)) assert.ok(!ids.includes(id), 'un bloque nuevo no reutiliza el id de uno antiguo: ' + id);
});

test('SII: solo ¿tiene acceso? con opciones si/no/contador, nunca un campo de texto', () => {
  const c = G.campo('sii_acceso');
  assert.equal(c.t, 'op');
  assert.deepEqual(c.o.map((o) => o[0]), ['si', 'no', 'contador']);
  assert.equal(c.onb, 1);
});

test('los 🧩 del onboarding de c1 siguen en el guion (con la misma clave), aunque algunos queden opcionales', () => {
  const onb = G.campos().filter((c) => c.onb).map((c) => c.k);
  for (const k of ['razon_social', 'rut_empresa', 'giro', 'inicio_act', 'tipo_soc', 'socios', 'cont_ant', 'traspaso', 'erp', 'sii_acceso', 'ntrab',
                   'regimen', 'iva', 'f29_dia', 'f29_atrasados', 'f22', 'urgencias', 'urg_det', 'plan', 'compromisos']) assert.ok(onb.includes(k), k);
  // razón social, RUT y giro dentro de la pregunta 1; tipo de sociedad en la 2; socios en la 5.
  assert.deepEqual(['razon_social', 'rut_empresa', 'giro'].map((k) => G.campo(k).q), [1, 1, 1]);
  assert.equal(G.campo('tipo_soc').q, 2);
  assert.equal(G.campo('socios').q, 5);
});

test('las claves reutilizadas de c1 conservan sus valores (las bitácoras antiguas se leen igual)', () => {
  const mismas = { ventas: ['hasta5', '5a20', '20a50', 'mas50'], ntrab: ['0', '1', '2', '3', '4', '5', '6+'], quien: ['externo', 'interno', 'propio', 'nadie'],
    plan: ['cumplimiento', 'pro', 'estrategico', 'aun_no'], traspaso: ['este_mes', 'prox_mes', 'por_definir'], reuniones: ['no', 'trimestral', 'mensual'],
    tipo_soc: ['spa', 'ltda', 'eirl', 'pn', 'otra'], regimen: ['propyme_t', 'propyme_g', 'semi', 'presunta', 'no_sabe'] };
  for (const [k, vs] of Object.entries(mismas)) assert.deepEqual(G.campo(k).o.map((o) => o[0]), vs, k);
  // Las opciones de c1 de dolores y urgencias siguen existiendo (se agregaron, no se quitaron).
  for (const v of ['iva_tarde', 'renta', 'como_va', 'no_responde', 'solo_cumplir', 'multas', 'decisiones', 'precio']) assert.ok(G.campo('dolores').o.some((o) => o[0] === v), v);
  for (const v of ['multas', 'fiscalizacion', 'cont_atrasada', 'plazo', 'ninguna']) assert.ok(G.campo('urgencias').o.some((o) => o[0] === v), v);
});

test('bitácora c1: lo que ya no se pregunta se muestra (solo lectura) con su etiqueta, también las notas por bloque', () => {
  const S = { ventas: '5a20', canal: ['local', 'online'], meta6: 'tener la caja ordenada', espera: 'siempre', ppm: 'si', campo_raro: 'x' };
  const N = { sit: 'decide con su socia', general: 'nota general', emp: 'nota nueva' };
  const x = G.extras(S, N);
  const mapa = Object.fromEntries(x.campos.map((c) => [c.k, c]));
  assert.equal(mapa.ventas, undefined, 'lo vigente no se duplica');
  assert.equal(mapa.canal.l, '¿Cómo vende?');
  assert.equal(mapa.canal.v, 'Local / tienda, En línea');
  assert.equal(mapa.meta6.v, 'tener la caja ordenada');
  assert.equal(mapa.espera.v, 'Disponible siempre / 24/7');
  assert.equal(mapa.campo_raro.l, 'campo_raro', 'una clave desconocida igual se muestra');
  assert.deepEqual(x.notas, [{ id: 'sit', n: 'Situación actual', v: 'decide con su socia' }]);
  assert.deepEqual(G.extras({}, {}), { campos: [], notas: [] });
});

test('precarga desde la agenda: rellena solo lo vacío, deja pistas y marca ✓', () => {
  const resp = { ventas: '5a20', trabajadores: '1a5', contabilidad: 'yo', sociedades: 'no', historicos: 'si', rubro: 'ferretería', dolor: 'me avisan tarde' };
  const r = G.precarga(resp, 'Empresa Demo SpA', { giro: 'ya anotado' });
  assert.equal(r.campos.ventas, '5a20');
  assert.equal(r.campos.quien, 'propio');
  assert.equal(r.campos.mas_sociedades, 'no');
  assert.equal(r.campos.atrasos, 'si');
  assert.equal(r.campos.frase, 'me avisan tarde');
  assert.equal(r.campos.razon_social, 'Empresa Demo SpA');
  assert.equal(r.campos.giro, undefined, 'no pisa lo ya anotado');
  assert.equal(r.campos.ntrab, undefined, 'un tramo 1 a 5 no es un número exacto');
  assert.match(r.pistas.ntrab, /1 a 5/);
  assert.equal(r.origen.ventas, true);
  assert.equal(G.precarga({ trabajadores: 'ninguno' }).campos.ntrab, '0');
  assert.equal(G.precarga({ trabajadores: '6a20' }).campos.ntrab, '6+');
  assert.equal(G.precarga({ historicos: 'nose' }).campos.atrasos, 'no_sabe');
  assert.equal(G.precarga({ historicos: 'no' }).campos.atrasos, 'no');
  assert.deepEqual(G.precarga(null).campos, {});
  // Cada campo precargado existe en el guion vigente y su valor es una opción válida.
  const todo = G.precarga({ ventas: 'mas80', trabajadores: 'mas20', contabilidad: 'nadie', sociedades: 'si', historicos: 'nose', rubro: 'r', dolor: 'd' }, 'E');
  for (const [k, v] of Object.entries(todo.campos)) {
    const c = G.campo(k);
    assert.ok(c, k);
    if (c.o) assert.ok(c.o.some((o) => o[0] === v), k + '=' + v);
  }
});

test('✓ de la agenda: coincide → marcado; si lo corrigieron → sin marca', () => {
  const resp = { ventas: '5a20', contabilidad: 'externo', sociedades: 'no' };
  const o = G.deLaAgenda({ ventas: '5a20', quien: 'interno', mas_sociedades: 'no' }, resp, null);
  assert.equal(o.ventas, true);
  assert.equal(o.mas_sociedades, true);
  assert.equal(o.quien, undefined, 'lo corrigió en la reunión');
  assert.deepEqual(G.deLaAgenda({}, null, null), {});
});

test('brújula: trabajadores → Gestión Laboral 0,39 UF por trabajador', () => {
  const a = G.brujula({ ntrab: '3' }, 0).alertas.map((x) => x[1]).join(' | ');
  assert.match(a, /Gestión Laboral/);
  assert.match(a, /0,39 UF por trabajador/);
  assert.match(a, /1,17 UF/);
});

test('brújula: F29 atrasados → N × $19.990 (hoja aprobada)', () => {
  assert.equal(G.PRECIOS.f29, 19990);
  const a = G.brujula({ f29_dia: 'no', f29_atrasados: '3' }, 0).alertas.map((x) => x[1]).join(' | ');
  assert.match(a, /3 × \$19\.990 = \$59\.970/);
  const sinN = G.brujula({ f29_dia: 'no' }, 0).alertas.map((x) => x[1]).join(' | ');
  assert.match(sinN, /pregunta cuántos/);
  assert.equal(G.brujula({ f29_dia: 'si', f29_atrasados: '3' }, 0).f29_clp, 0, 'si está al día no cuenta los atrasados');
});

test('brújula: atrasos / no sabe / boletas / cotizaciones', () => {
  const t = (S) => G.brujula(S, 0).alertas.map((x) => x[1]).join(' | ');
  assert.match(t({ atrasos: 'si' }), /Regularizar primero/);
  assert.match(t({ atrasos: 'no_sabe' }), /No sabe si está al día/);
  assert.match(t({ boletas_hon: 'si' }), /boletas de honorarios/);
  assert.match(t({ cotiz_dia: 'no' }), /Cotizaciones atrasadas/);
});

test('brújula: "solo quiero cumplir" sin trabajadores → Cumplir (el plan simple)', () => {
  const b = G.brujula({ dolores: ['solo_cumplir'], ntrab: '0', ventas: 'hasta5' }, 0);
  assert.equal(b.gana.k, 'cumplimiento');
  assert.ok(b.alertas.some((x) => /Calza Cumplir/.test(x[1])));
});

test('brújula: IVA tarde / no sé cómo va → Controlar (PRO); sociedades + decisiones + mensual → Decidir desde 7 UF', () => {
  assert.equal(G.brujula({ dolores: ['iva_tarde', 'como_va'], ventas: '5a20' }, 0).gana.k, 'pro');
  const d = G.brujula({ mas_sociedades: 'si', decision: ['invertir'], reuniones: 'mensual' }, 0);
  assert.equal(d.gana.k, 'estrategico');
  assert.equal(d.gana.precio, 'desde 7 UF/mes');
});

test('brújula: menor precio, sin acceso SII, renta pendiente y avisos de tiempo', () => {
  const a = G.brujula({ motivo_cambio: ['precio'], sii_acceso: 'no', f22: 'pendiente' }, 23).alertas.map((x) => x[1]).join(' | ');
  assert.match(a, /caro comparado con qué/);
  assert.match(a, /flujo seguro/);
  assert.match(a, /Operación Renta/);
  assert.match(a, /Van 23 min/);
  assert.match(G.brujula({}, 16).alertas.map((x) => x[1]).join(' | '), /Nuestro Motor/);
  // compat c1: expectativa 24/7 sigue alertando en bitácoras antiguas
  assert.match(G.brujula({ espera: 'siempre' }, 0).alertas.map((x) => x[1]).join(' | '), /ilimitada/);
});

test('brújula: "te falta preguntar" sigue la numeración y se vacía al completar', () => {
  const f = G.brujula({}, 0).falta.map((x) => x[1]);
  assert.match(f[0], /^🏢 2 ·/);
  assert.ok(f.some((x) => /15 · ¿Desde cuándo/.test(x)));
  const lleno = { tipo_soc: 'spa', regimen: 'propyme_t', ntrab: '1', boletas_hon: 'no', f29_dia: 'si', atrasos: 'no', motivo_cambio: ['avisa_tarde'],
    dolores: ['caja'], decision: ['crecer'], traspaso: 'prox_mes' };
  assert.equal(G.brujula(lleno, 0).falta.length, 0);
});

test('foto de la brújula para el cierre: chica y con la versión del guion', () => {
  const f = G.brujula({ ntrab: '2', f29_dia: 'no', f29_atrasados: '2' }, 12).foto;
  assert.equal(f.guion, G.GUION_VERSION);
  assert.equal(f.trabajadores, 2);
  assert.equal(f.f29, 2);
  assert.ok(JSON.stringify(f).length < 20000);
});

test('fases del reloj según el minuto (tiempos de la hoja)', () => {
  assert.equal(G.FASES[G.fase(0)], 'Apertura');
  assert.equal(G.FASES[G.fase(5)], 'Tu empresa');
  assert.equal(G.FASES[G.fase(16)], 'Nuestro Motor');
  assert.equal(G.FASES[G.fase(24)], 'Tu momento');
  assert.equal(G.FASES[G.fase(40)], 'Cierre');
});

test('avance por bloque: no cuenta los opcionales y respeta los campos dependientes', () => {
  const hoy = G.BLOQUES.find((b) => b.id === 'hoy');
  const t0 = G.avanceBloque({ f29_dia: 'si' }, hoy).t;
  assert.equal(G.avanceBloque({ f29_dia: 'no' }, hoy).t, t0 + 1, 'F29 atrasados aparece solo si no está al día');
  const emp = G.BLOQUES.find((b) => b.id === 'emp');
  assert.equal(G.avanceBloque({ razon_social: 'X' }, emp).n, 0, 'un opcional no suma al avance');
  assert.equal(G.onb({ razon_social: 'X', sii_acceso: 'si' }).n, 2, 'pero sí al conteo 🧩');
});

test('nunca se le dice "honorarios" a nuestros servicios: solo aparece en la pregunta de boletas que paga el cliente', () => {
  const textos = [];
  for (const b of G.BLOQUES) { textos.push(b.f, ...(b.guia || [])); for (const c of b.campos) textos.push(c.l, c.qt || '', c.qa || '', ...(c.o || []).map((o) => o[1])); }
  const con = textos.filter((t) => /honorario/i.test(t));
  assert.ok(con.length >= 1);
  for (const t of con) assert.match(t, /boletas de honorarios/i, t);
});

test('motivos de pérdida = catálogo de la base', () => {
  assert.deepEqual(G.MOTIVOS.map((m) => m[0]), ['precio', 'eligio_otro', 'no_responde', 'no_calza', 'lo_hara_solo', 'otro']);
});
