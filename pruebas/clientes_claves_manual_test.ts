// 24-11 · Claves a mano en la ficha del cliente (solo Master). jsdom + edgeFetch simulado; datos ficticios.
// Uso: deno run --allow-read --allow-env --allow-sys --allow-net=registry.npmjs.org pruebas/clientes_claves_manual_test.ts
import { JSDOM } from 'npm:jsdom@24.1.0';
const html = Deno.readTextFileSync(new URL('../clientes/index.html', import.meta.url));
const script = html.slice(html.indexOf('<script>', html.indexOf('supabase.js')) + 8, html.indexOf('</script>', html.indexOf('<script>', html.indexOf('supabase.js'))));
const fn = (n: string) => { const i = script.indexOf('function ' + n + '('); if (i < 0) throw new Error(n); let d = 0, j = script.indexOf('{', i); for (; j < script.length; j++) { if (script[j] === '{') d++; else if (script[j] === '}' && --d === 0) break; } return script.slice(i, j + 1); };
const codigo = ['g', 'credUI', 'credPendientes', 'credGuardar'].map(fn).join('\n');
let total = 0, fallas = 0; const res = (n: string, ok: boolean, d = '') => { total++; console.log((ok ? 'OK   ' : 'MAL  ') + n + (ok ? '' : ' · ' + d)); if (!ok) fallas++; };
const espera = () => new Promise((r) => setTimeout(r, 40));
function montar(resp: (f: string, b: any) => [number, any]) {
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ''), { runScripts: 'outside-only', url: 'https://gestoor.contadoor.cl/clientes/' });
  const w: any = dom.window; const llamadas: any[] = [], avisos: string[] = [];
  w.edgeFetch = (f: string, b: any) => { llamadas.push({ f, b: JSON.parse(JSON.stringify(b)) }); const [st, j] = resp(f, b); return st < 0 ? Promise.reject(new Error('red')) : Promise.resolve({ ok: st === 200, status: st, json: () => Promise.resolve(j) }); };
  w.toast = (m: string) => avisos.push(m); w.alert = (m: string) => avisos.push('ALERT ' + m);
  w.eval('var _credSeq = 0;\n' + codigo);
  return { w, d: w.document, llamadas, avisos };
}
const inp = (d: any, slug: string) => d.querySelector(`.cred-clave[data-slug="${slug}"]`);
const LISTA = (f: string) => (f === 'listar-credenciales' ? [200, { ok: true, credenciales: [{ slug: 'sii_empresa' }] }] : [200, { ok: true }]) as [number, any];
{ const m = montar(LISTA); m.w.credUI(false, 7); await espera();
  res('no Master: campos de clave ocultos y sin llamar al servidor', inp(m.d, 'sii_empresa').style.display === 'none' && m.llamadas.length === 0 && m.d.querySelector('.cred-prot').style.display === ''); }
{ const m = montar(LISTA); m.w.credUI(true, null); await espera();
  res('Master, cliente nuevo: 5 campos visibles, sin consultar (no hay id)', m.d.querySelectorAll('.cred-clave').length === 5 && inp(m.d, 'facturacion').style.display === '' && m.llamadas.length === 0); }
{ const m = montar(LISTA); m.w.credUI(true, 7); await espera();
  res('Master, edición: indica cuál ya está registrada (sin mostrar la clave)', /registrada/.test(inp(m.d, 'sii_empresa').placeholder) && !/registrada/.test(inp(m.d, 'clave_unica').placeholder) && m.llamadas[0].f === 'listar-credenciales');
  res('los campos son de tipo contraseña y sin autocompletar', inp(m.d, 'sii_empresa').type === 'password' && inp(m.d, 'sii_empresa').getAttribute('autocomplete') === 'new-password'); }
{ const m = montar(LISTA); m.w.credUI(true, 7); await espera();
  m.d.getElementById('f-sii-u').value = ' 78539172-1 '; inp(m.d, 'sii_empresa').value = 'Clave Ficticia 1';
  inp(m.d, 'clave_unica').value = 'Otra Ficticia 2'; m.d.getElementById('f-cu-u').value = '';
  const p = m.w.credPendientes();
  res('pendientes: solo las filas escritas, con slug/tipo/label del catálogo y usuario de su fila', p.length === 2 && p[0].slug === 'sii_empresa' && p[0].tipo === 'sii' && p[0].usuario === '78539172-1' && p[1].slug === 'clave_unica' && p[1].usuario === null);
  m.llamadas.length = 0; await m.w.credGuardar(7, p);
  res('guardar: una llamada por clave a guardar-credencial con el id del cliente', m.llamadas.length === 2 && m.llamadas.every((x: any) => x.f === 'guardar-credencial' && x.b.clienteId === 7) && m.llamadas[0].b.clave === 'Clave Ficticia 1');
  res('después de guardar no queda ninguna clave escrita y avisa cuáles se guardaron', inp(m.d, 'sii_empresa').value === '' && inp(m.d, 'clave_unica').value === '' && /SII Empresa, Clave Única/.test(m.avisos.join(' '))); }
{ const m = montar((f) => (f === 'guardar-credencial' ? [403, { error: 'x' }] : [200, { credenciales: [] }])); m.w.credUI(true, 7); await espera();
  inp(m.d, 'facturacion').value = 'X'; await m.w.credGuardar(7, m.w.credPendientes());
  res('403: avisa «solo Master» y borra el campo igual', /Facturación \(solo Master\)/.test(m.avisos.join(' ')) && inp(m.d, 'facturacion').value === ''); }
{ const m = montar((f) => (f === 'guardar-credencial' ? [-1, null] : [200, { credenciales: [] }])); m.w.credUI(true, 7); await espera();
  inp(m.d, 'portal_licencias').value = 'X'; await m.w.credGuardar(7, m.w.credPendientes());
  res('sin respuesta: pide revisar en «Ver claves» antes de repetir', /Ver claves/.test(m.avisos.join(' ')) && inp(m.d, 'portal_licencias').value === ''); }
{ const m = montar(LISTA); m.w.credUI(true, 7); await espera(); inp(m.d, 'sii_empresa').value = 'X'; m.w.credUI(true, 8); await espera();
  res('al abrir otra ficha se limpian las claves escritas', inp(m.d, 'sii_empresa').value === ''); }
console.log(`${total - fallas}/${total} pruebas OK`); if (fallas) Deno.exit(1);
