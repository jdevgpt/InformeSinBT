"""Convierte el Excel de centros en datos/centros.json (número de centro -> dirección).

Uso (desde la carpeta del repositorio):
    python herramientas/convertir_centros.py "Dirección de centros.xlsx"

Necesita Python 3 y openpyxl (pip install openpyxl).
Busca en la primera hoja las columnas DENOM (número del centro) e INDIRIZZO (dirección).
Los centros sin dirección no se incluyen.
"""
import json
import os
import sys

import openpyxl


def main():
    if len(sys.argv) < 2:
        sys.exit('Indica el archivo Excel: python herramientas/convertir_centros.py "archivo.xlsx"')
    origen = sys.argv[1]
    destino = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'datos', 'centros.json')

    wb = openpyxl.load_workbook(origen, read_only=True, data_only=True)
    filas = wb.worksheets[0].iter_rows(values_only=True)
    cabecera = [str(c).strip().upper() if c is not None else '' for c in next(filas)]
    try:
        i_num = cabecera.index('DENOM')
        i_dir = cabecera.index('INDIRIZZO')
    except ValueError:
        sys.exit('No encuentro las columnas DENOM e INDIRIZZO en la primera fila de la primera hoja.')

    centros, sin_direccion, repetidos = {}, 0, 0
    for fila in filas:
        if len(fila) <= max(i_num, i_dir) or fila[i_num] in (None, ''):
            continue
        numero = ''.join(str(fila[i_num]).split()).upper()
        direccion = ' '.join(str(fila[i_dir]).split()) if fila[i_dir] is not None else ''
        if not direccion:
            sin_direccion += 1
            continue
        if numero in centros:
            repetidos += 1
        centros[numero] = direccion

    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, 'w', encoding='utf-8') as f:
        json.dump(centros, f, ensure_ascii=False, separators=(',', ':'))
    print('Centros con dirección:', len(centros))
    print('Sin dirección (omitidos):', sin_direccion)
    if repetidos:
        print('Números repetidos (se usa el último):', repetidos)
    print('Escrito en', os.path.normpath(destino))


if __name__ == '__main__':
    main()
