-- ============================================================
-- Carga inicial del módulo Novedades · Radar del 15-oct-2026
-- Aplicar DESPUÉS de novedades.sql. Idempotente (on conflict do nothing).
-- IMPORTANTE: este radar no pudo abrir los sitios oficiales (bloqueo de red del entorno);
-- todo viene de resultados indexados. Por eso la confianza máxima es "media" y cada
-- hallazgo debe confirmarse en la fuente antes de pasar a guion.
-- ============================================================
insert into public.novedades_hallazgos
  (fecha_radar,titulo,organismo,url_fuente,fecha_publicacion,fecha_vigencia,tipo_norma,area,prioridad,a_quien_afecta,requisitos,plazos_montos,accion,riesgo,confianza,estado,notas)
values
('2026-10-15','Guías de despacho: nuevas exigencias desde el 1-nov-2026 (Res. Ex. SII 154/2025, postergada por Res. 52/2026)','SII',
 'https://www.sii.cl/normativa_legislacion/resoluciones/2026/reso52.pdf','2026-04-22','Desde 01-11-2026','resolucion','tributario','P0',
 'Empresas que trasladan mercadería con guía de despacho o factura',null,'Rige 01-11-2026 (detalle de campos por confirmar en el PDF)',
 'Confirmar con el proveedor de facturación que el sistema emite guías con los nuevos datos antes del 1-nov','Guías rechazadas o mercadería en tránsito sin respaldo válido','media','nuevo',
 'No es nuevo, pero el plazo es inminente. Detalle de exigencias viene de terceros (Sovos): verificar en el PDF.'),
('2026-10-15','Ley de Reconstrucción Nacional promulgada (9-oct): PPM Pro Pyme 0,25% → 0,23% y otros cambios','Presidencia / Hacienda',
 'https://www.diariooficial.interior.gob.cl/','2026-10-09','Por confirmar: regla general día 1 del mes siguiente a su publicación en el D.O.','ley','tributario','P0',
 'Pymes 14 D N°3 (PPM), empleadores (crédito al empleo formal), compradores de vivienda nueva (IVA)',null,'Cifras según prensa; confirmar con texto publicado y número de ley',
 'No cambiar nada hasta ver la publicación en el D.O. y la circular del SII; preparar a clientes 14 D N°3','Pagar PPM de más o aplicar beneficios sin respaldo','media','nuevo',
 'Publicación en D.O. no confirmada al 15-oct. TC eliminó normas (Rol 17.917-26). Contradicción de prensa: anuncio ProPyme 12,5% vs convergencia 23%.'),
('2026-10-15','F29 período septiembre: facturadores electrónicos que declaran y pagan por internet vencen el martes 20-oct','SII',
 'https://www.sii.cl/','2026-10-15','Período septiembre 2026','calendario','tributario','P0',
 'Contribuyentes con facturación electrónica',null,'20-10-2026 (fecha de calendarios de terceros; confirmar en sii.cl)',
 'Declarar y pagar antes del 20-oct','Multas e intereses por declaración fuera de plazo','media','nuevo',null),
('2026-10-15','Cotizaciones de octubre: pago hasta el 10-nov (electrónico hasta el 13-nov)','Previred / DT',
 'https://www.previred.com/',null,'Remuneraciones de octubre 2026','calendario','previsional','P1',
 'Todo empleador con trabajadores',null,'10-11 y 13-11 según cronograma de terceros (Buk); UTM octubre $72.151 (fuente secundaria)',
 'Cerrar nómina de octubre con la UTM de octubre y la UF del 31-oct','Reajustes e intereses por pago fuera de plazo','media','nuevo',null),
('2026-10-15','Cotización del empleador 3,5% (Ley 21.735) vigente desde 01-ago-2026: revisar software de remuneraciones','Superintendencia de Pensiones',
 'https://www.chileatiende.gob.cl/fichas/130987-aportes-del-empleador-al-sistema-de-pensiones','2026-08-01','01-08-2026 a julio 2027','ley','previsional','P1',
 'Empleadores con trabajadores dependientes',null,'3,5% sobre renta imponible con tope 90 UF. Tasa SIS: conflicto 1,78% vs 2,00% sin resolver',
 'Verificar que la liquidación aplique 3,5% y la tasa SIS de Previred del período','Cotizaciones mal declaradas, con reajustes e intereses','media','nuevo','No es nuevo; útil para cierre de octubre.'),
('2026-10-15','Gobierno anuncia dos proyectos de ley ProPyme (ingreso al Congreso a inicios de noviembre)','Ministerio de Economía',
 'https://www.economia.gob.cl/','2026-10-13','No rige: anuncio','anuncio','emprendimiento','P1',
 'Micro y pequeñas empresas',null,'Tasa Pyme 12,5% consolidada (según anuncio); liquidez, pago a 30 días, patentes provisorias',
 'Ninguna todavía; seguimiento del ingreso al Congreso','—','media','nuevo','Contenido según prensa (Emol, La Tercera, Radio UChile).'),
('2026-10-15','Préstamo Solidario 2020/2021: regularizar declaraciones pendientes hasta el 30-nov-2026','SII',
 'https://www.sii.cl/noticias/2026/200826noti01smn.htm','2026-08-20','Hasta 30-11-2026','calendario','tributario','P1',
 'Quienes recibieron Préstamo Solidario y tienen declaraciones pendientes',null,'30-11-2026; convenio con TGR desde 22-09',
 'Presentar declaraciones pendientes o pedir convenio con TGR','Cobro y restricciones','media','nuevo','No es nuevo.'),
('2026-10-15','Prórroga sistema frontal: F29 y F50 sin multas ni intereses hasta el 30-oct (comunas afectadas)','SII',
 'https://www.sii.cl/noticias/2026/190726noti01pcr.htm','2026-07-19','Hasta 30-10-2026','resolucion','tributario','P2',
 'Contribuyentes de comunas afectadas que declaran por internet',null,'30-10-2026','Declarar antes del 30-oct si aplica','Multas e intereses','media','nuevo','No es nuevo; solo aplica a comunas afectadas.'),
('2026-10-15','Proyecto para suspender la Ley Karin por 5 años (Boletín 18.588-13)','Cámara de Diputadas y Diputados',
 'https://www.camara.cl/','2026-10-12','No rige: proyecto','proyecto','laboral','P2',
 'Todos los empleadores (solo si se aprueba)',null,null,'Mantener protocolo Karin y canal de denuncias vigentes','Fiscalización bajo la Ley 21.643 vigente','media','banco',
 'Ingreso en agosto; reseña del 12-oct. No confundir con obligación vigente.'),
('2026-10-15','SII: restricción de facturas a contribuyentes agresivos evitó $32 mil millones en créditos indebidos','SII',
 'https://www.sii.cl/noticias/2026/051026noti02pcr.htm','2026-10-05','Noticia institucional','anuncio','tributario','P2',
 'Pymes con proveedores nuevos',null,null,'Validar proveedores nuevos antes de usar crédito fiscal de IVA','Rechazo de crédito fiscal','media','banco','Buen insumo evergreen para "Factura y crédito fiscal IVA" (21-oct).')
on conflict (url_fuente, titulo) do nothing;

-- Parrilla vigente según Notion (CONSOLIDADO 12–18 OCT). Estados reales: propuestas, nada aprobado.
insert into public.novedades_piezas (fecha_propuesta,formato,titulo,gancho,estado,notion_url,notas) values
('2026-10-12','reel','La factura no basta','Que la factura esté a nombre de tu empresa no significa que puedas rebajar ese gasto','guion','https://app.notion.com/p/3f3d70a4835c81babbd0c88fc9ffbc08','Publicación no confirmada'),
('2026-10-13','historia','Franquicia tributaria SENCE (3 historias)',null,'propuesta','https://app.notion.com/p/3f3d70a4835c810e8ca6cd2e81dcd138','Verificar estado final de la franquicia tras la ley miscelánea'),
('2026-10-14','reel','¿Cuánto tiempo se pierde haciendo dos veces la misma pega?',null,'propuesta','https://app.notion.com/p/3f3d70a4835c81bfa3a0f282eaa84bd1',null),
('2026-10-15','reel','Mi Fondo vs PREVIRED: declarada no es pagada','Jefe, revisé mi cotización y aparece declarada pero no pagada','propuesta','https://app.notion.com/p/3f3d70a4835c81b78eccf1d51ff52e86',null),
('2026-10-16','carrusel','Tu negocio creció: ¿tus permisos siguen cubriendo lo que haces?',null,'propuesta','https://app.notion.com/p/3f3d70a4835c815ab12ccf324a79bcfa',null);
