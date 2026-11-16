/* pruebas/cartapra-sii-fixture.js — Respuesta de la Edge `cartapra` (accion "resumen", R2) con la FORMA REAL.
   FICTICIA / ANONIMIZADA: RUT 76000000-0, nombres, folios e ids inventados. La generó la lógica del backend
   (logica.ts) a partir del fixture anonimizado del backend, con hoy = 16-11-2026. Solo para la demo y las pruebas. */
window.CARTAPRA_FIXTURE_RESUMEN = {
 "ok": true,
 "conexion": {
  "estado": "conectada",
  "ultimaActualizacion": "2026-11-16T15:11:42.275Z",
  "actualizando": false,
  "cargaInicialLista": true,
  "ultimoError": null,
  "conectadaEn": "2026-11-16T15:10:08.000Z"
 },
 "puede_conectar": true,
 "ficha": {
  "regimen": "REGIMEN PRO PYME GENERAL (14D)",
  "contabilidad": "SIMPLIFICADA",
  "segmento": "Pequena Empresa",
  "glosaActividad": "SERVICIOS DE PRUEBA",
  "afecta_iva": false,
  "socios": [
   {
    "nombre": "Socia Ficticia Uno",
    "rut": "11111111-1",
    "participacionCapital": 100,
    "participacionUtilidades": 100
   }
  ],
  "representantes": [
   {
    "nombre": "Socia Ficticia Uno",
    "rut": "11111111-1"
   }
  ]
 },
 "f29": {
  "anio": 2026,
  "hoy": "2026-11-16",
  "vence_dia": 20,
  "periodos": [
   {
    "periodo": "202601",
    "estado": "declarado",
    "vence": "2026-02-20",
    "folio": "1000000005",
    "rectificado": false
   },
   {
    "periodo": "202602",
    "estado": "declarado",
    "vence": "2026-03-20",
    "folio": "1000000004",
    "rectificado": false
   },
   {
    "periodo": "202603",
    "estado": "no_declarado",
    "vence": "2026-04-20"
   },
   {
    "periodo": "202604",
    "estado": "no_declarado",
    "vence": "2026-05-20"
   },
   {
    "periodo": "202605",
    "estado": "declarado",
    "vence": "2026-06-22",
    "folio": "1000000003",
    "rectificado": false
   },
   {
    "periodo": "202606",
    "estado": "declarado",
    "vence": "2026-07-20",
    "folio": "1000000002",
    "rectificado": false
   },
   {
    "periodo": "202607",
    "estado": "declarado",
    "vence": "2026-08-20",
    "folio": "1000000001",
    "rectificado": false
   },
   {
    "periodo": "202608",
    "estado": "declarado",
    "vence": "2026-09-21",
    "folio": "1000000000",
    "rectificado": false
   },
   {
    "periodo": "202609",
    "estado": "no_declarado",
    "vence": "2026-10-20"
   },
   {
    "periodo": "202610",
    "estado": "en_plazo",
    "vence": "2026-11-20"
   }
  ],
  "no_declarados": [
   "202603",
   "202604",
   "202609"
  ],
  "en_plazo": [
   "202610"
  ]
 },
 "monitor": {
  "semaforo": {
   "tono": "aviso",
   "puntos": [
    {
     "clave": "compras_pendientes",
     "tono": "aviso",
     "texto": "3 factura(s) de compra pendientes de aceptar o reclamar."
    }
   ]
  },
  "anual": [
   {
    "anio": 2026,
    "totales": {
     "ventasNeto": 74938600,
     "ventasTotal": 74938600,
     "comprasNeto": 35887802,
     "comprasTotal": 37060259,
     "ivaRcv": -1146630,
     "honorariosBruto": 6343189,
     "retencion": 967336,
     "meses": 11
    }
   },
   {
    "anio": 2025,
    "totales": {
     "ventasNeto": 101133000,
     "ventasTotal": 101133000,
     "comprasNeto": 57878328,
     "comprasTotal": 59518299,
     "ivaRcv": -1639971,
     "honorariosBruto": 13052097,
     "retencion": 1892558,
     "meses": 12
    }
   }
  ],
  "ivaProyectado": {
   "periodo": "202611",
   "debito": 0,
   "credito": 40968,
   "remanente": 0,
   "ppm": 4740,
   "retencion": 180046,
   "totalEstimado": 184786,
   "remanenteQueda": 40968,
   "provisorio": true
  },
  "mesesFaltantes": [],
  "cuadraturaF29": [
   {
    "periodo": "202610",
    "estado": "sin_f29",
    "folio": null,
    "lineas": []
   },
   {
    "periodo": "202609",
    "estado": "sin_f29",
    "folio": null,
    "lineas": []
   },
   {
    "periodo": "202608",
    "estado": "difiere",
    "folio": "1000000000",
    "lineas": [
     {
      "concepto": "debito",
      "etiqueta": "IVA débito (ventas)",
      "rcv": 0,
      "f29": 0,
      "diferencia": 0,
      "coincide": true
     },
     {
      "concepto": "credito",
      "etiqueta": "IVA crédito del mes (compras)",
      "rcv": 128958,
      "f29": 0,
      "diferencia": 128958,
      "coincide": false
     },
     {
      "concepto": "retencion",
      "etiqueta": "Retención de honorarios",
      "rcv": 143095,
      "f29": 143095,
      "diferencia": 0,
      "coincide": true
     }
    ]
   },
   {
    "periodo": "202607",
    "estado": "difiere",
    "folio": "1000000001",
    "lineas": [
     {
      "concepto": "debito",
      "etiqueta": "IVA débito (ventas)",
      "rcv": 0,
      "f29": 0,
      "diferencia": 0,
      "coincide": true
     },
     {
      "concepto": "credito",
      "etiqueta": "IVA crédito del mes (compras)",
      "rcv": 123026,
      "f29": 0,
      "diferencia": 123026,
      "coincide": false
     },
     {
      "concepto": "retencion",
      "etiqueta": "Retención de honorarios",
      "rcv": 113291,
      "f29": 113291,
      "diferencia": 0,
      "coincide": true
     }
    ]
   },
   {
    "periodo": "202606",
    "estado": "difiere",
    "folio": "1000000002",
    "lineas": [
     {
      "concepto": "debito",
      "etiqueta": "IVA débito (ventas)",
      "rcv": 0,
      "f29": 0,
      "diferencia": 0,
      "coincide": true
     },
     {
      "concepto": "credito",
      "etiqueta": "IVA crédito del mes (compras)",
      "rcv": 127395,
      "f29": 0,
      "diferencia": 127395,
      "coincide": false
     },
     {
      "concepto": "retencion",
      "etiqueta": "Retención de honorarios",
      "rcv": 123306,
      "f29": 123306,
      "diferencia": 0,
      "coincide": true
     }
    ]
   },
   {
    "periodo": "202605",
    "estado": "difiere",
    "folio": "1000000003",
    "lineas": [
     {
      "concepto": "debito",
      "etiqueta": "IVA débito (ventas)",
      "rcv": 0,
      "f29": 0,
      "diferencia": 0,
      "coincide": true
     },
     {
      "concepto": "credito",
      "etiqueta": "IVA crédito del mes (compras)",
      "rcv": 101754,
      "f29": 0,
      "diferencia": 101754,
      "coincide": false
     },
     {
      "concepto": "retencion",
      "etiqueta": "Retención de honorarios",
      "rcv": 76058,
      "f29": 76058,
      "diferencia": 0,
      "coincide": true
     }
    ]
   }
  ],
  "exenta": true
 },
 "sii": {
  "sii_cumplimiento": {
   "estado": "Cumple sus obligaciones tributarias",
   "cumple": true,
   "condiciones": [
    {
     "titulo": "No tener atrasos en declaración de IVA y/o Renta",
     "cumple": true
    },
    {
     "titulo": "No tener denuncias o querellas por delito",
     "cumple": true
    },
    {
     "titulo": "No tener antecedentes y/o documentos tributarios por justificar",
     "cumple": true
    }
   ]
  },
  "sii_cartas": {
   "total": 7,
   "cartas": [
    {
     "id": "90000000",
     "categoria": "carta",
     "titulo": "Modificación del registro de contribuyentes",
     "fecha": "2026-02-18",
     "periodo": null
    },
    {
     "id": "90000006",
     "categoria": "notificacion",
     "titulo": "Notificación de Giro por Pago Diferido Impuesto a la Renta AT2026",
     "fecha": null,
     "periodo": "2026",
     "plazos": [
      "Dentro de los 5 días hábiles"
     ]
    },
    {
     "id": "90000001",
     "categoria": "carta",
     "titulo": "Modificación del registro de contribuyentes",
     "fecha": "2024-05-27",
     "periodo": null
    },
    {
     "id": "90000002",
     "categoria": "carta",
     "titulo": "Modificación del registro de contribuyentes",
     "fecha": "2023-10-17",
     "periodo": null
    },
    {
     "id": "90000003",
     "categoria": "carta",
     "titulo": "SOLICITUD DE CORRECCIÓN O NUEVO REQUERIMIENTO PARA RESOLVER EL TRÁMITE",
     "fecha": "2023-09-05",
     "periodo": null
    }
   ]
  },
  "sii_alertas": {
   "total": 0,
   "alertas": []
  }
 }
};
