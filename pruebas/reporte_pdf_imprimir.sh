#!/bin/bash
# P1-B · imprime las páginas de prueba (datos ficticios) con Chrome headless → PDF. Uso: pruebas/reporte_pdf_imprimir.sh <carpeta_salida>
set -e; R="$(cd "$(dirname "$0")" && pwd)"; O="${1:-/tmp/reporte_pdf}"; mkdir -p "$O"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for p in asesoria cumplimiento; do
  "$CH" --headless=new --disable-gpu --no-pdf-header-footer --allow-file-access-from-files --virtual-time-budget=8000 \
    --print-to-pdf="$O/despues_$p.pdf" "file://$R/reporte_pdf_prueba.html?plan=$p" 2>/dev/null
done
"$CH" --headless=new --disable-gpu --no-pdf-header-footer --allow-file-access-from-files --virtual-time-budget=8000 \
  --print-to-pdf="$O/antes_asesoria.pdf" "file://$R/reporte_pdf_antes.html" 2>/dev/null
ls -la "$O"
