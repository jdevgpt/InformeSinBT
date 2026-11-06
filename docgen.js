/* Generación del informe Word a partir de plantilla.docx
   Marcadores de la plantilla: {{FECHA}} {{CODIGO}} {{DIRECCION}} {{MUNICIPIO}} {{TRATAMIENTO}} {{TECNICO}}
   La foto sustituye a la imagen "INSERTAR IMAGEN" (media/image1.png).
   La firma sustituye a la imagen vacía media/firma.png. */
(function (root) {
  // Marco de la foto en el modelo (EMU) y límites al respetar proporciones
  const BOX_W = 1606095;
  const BOX_H = 3571252;
  const MAX_W = 4800000;
  const MAX_H = 3571252;
  // Marco de la firma en el modelo (EMU)
  const FIRMA_W = 2019300;
  const FIRMA_H = 800000;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatFecha(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + ' / ' + m[2] + ' / ' + m[1] : '';
  }

  function nombreArchivo(nombre) {
    const limpio = String(nombre).replace(/[\\/:*?"<>|]/g, '-').trim();
    return 'INFORME INSTALACION SIN BT - ' + limpio + '.docx';
  }

  function ajustar(w, h) {
    const k = Math.min(MAX_W / w, MAX_H / h);
    return { cx: Math.round(w * k), cy: Math.round(h * k) };
  }

  function ajustarFirma(w, h) {
    const k = Math.min(FIRMA_W / w, FIRMA_H / h);
    return { cx: Math.round(w * k), cy: Math.round(h * k) };
  }

  function rellenar(texto, valores) {
    Object.keys(valores).forEach(function (k) {
      texto = texto.split('{{' + k + '}}').join(esc(String(valores[k]).trim()));
    });
    return texto;
  }

  // d: {nombre, fecha (yyyy-mm-dd), direccion, municipio}
  // foto: {bytes: Uint8Array (JPEG), w, h} o null
  // tecnico: {tratamiento, nombre, firma: {bytes: Uint8Array (PNG), w, h} | null}
  async function generar(plantilla, d, foto, tecnico) {
    tecnico = tecnico || {};
    const zip = await JSZip.loadAsync(plantilla);
    let xml = await zip.file('word/document.xml').async('string');

    xml = rellenar(xml, {
      FECHA: formatFecha(d.fecha),
      CODIGO: d.nombre,
      DIRECCION: d.direccion,
      MUNICIPIO: d.municipio,
      TRATAMIENTO: tecnico.tratamiento || 'D.',
      TECNICO: tecnico.nombre || ''
    });

    // Autor del documento = técnico
    const core = zip.file('docProps/core.xml');
    if (core) {
      zip.file('docProps/core.xml', rellenar(await core.async('string'), { TECNICO: tecnico.nombre || '' }));
    }

    if (foto) {
      const t = ajustar(foto.w, foto.h);
      xml = xml.split('cx="' + BOX_W + '" cy="' + BOX_H + '"')
               .join('cx="' + t.cx + '" cy="' + t.cy + '"');
      let rels = await zip.file('word/_rels/document.xml.rels').async('string');
      rels = rels.replace('Target="media/image1.png"', 'Target="media/foto.jpg"');
      zip.file('word/_rels/document.xml.rels', rels);
      zip.remove('word/media/image1.png');
      zip.file('word/media/foto.jpg', foto.bytes);
    }

    if (tecnico.firma) {
      const f = ajustarFirma(tecnico.firma.w, tecnico.firma.h);
      xml = xml.split('cx="' + FIRMA_W + '" cy="' + FIRMA_H + '"')
               .join('cx="' + f.cx + '" cy="' + f.cy + '"');
      zip.file('word/media/firma.png', tecnico.firma.bytes);
    }

    zip.file('word/document.xml', xml);
    return zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  }

  root.DocGen = { generar: generar, nombreArchivo: nombreArchivo, formatFecha: formatFecha, BOX_W: BOX_W, BOX_H: BOX_H, FIRMA_W: FIRMA_W, FIRMA_H: FIRMA_H };
})(typeof window !== 'undefined' ? window : globalThis);
