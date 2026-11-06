/* Informes instalación sin BT — Proyecto > Línea > CD/PT
   Los datos se guardan en el navegador (IndexedDB). Exportar copia para no perderlos. */
(function () {
  'use strict';

  // ---------- Estado y almacenamiento ----------
  let estado = { proyectos: [], ajuste: 'proporcion' };
  let nav = { vista: 'inicio', p: null, l: null, c: null };
  let plantillaBuf = null;
  // Datos del técnico: se guardan aparte de los proyectos para que sobrevivan entre trabajos.
  // firma: {data: PNG en base64 (data URL), w, h} o null
  let tecnico = { tratamiento: 'D.', nombre: '', firma: null };
  let prevNav = null;

  const DB_NOMBRE = 'informes-bt';
  function abrirDB() {
    return new Promise(function (ok, ko) {
      const r = indexedDB.open(DB_NOMBRE, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { ko(r.error); };
    });
  }
  function leerClave(db, clave) {
    return new Promise(function (ok, ko) {
      const q = db.transaction('kv').objectStore('kv').get(clave);
      q.onsuccess = function () { ok(q.result); };
      q.onerror = function () { ko(q.error); };
    });
  }
  async function cargar() {
    try {
      const db = await abrirDB();
      const v = await leerClave(db, 'estado');
      if (v && v.proyectos) estado = Object.assign(estado, v);
      const t = await leerClave(db, 'tecnico');
      if (t) tecnico = Object.assign(tecnico, t);
    } catch (e) { aviso('No se pudo leer el almacenamiento del navegador'); }
  }
  let t_guardar = null;
  function guardar() {
    clearTimeout(t_guardar);
    t_guardar = setTimeout(async function () {
      try {
        const db = await abrirDB();
        db.transaction('kv', 'readwrite').objectStore('kv').put(estado, 'estado');
      } catch (e) { aviso('No se pudo guardar en el navegador'); }
    }, 250);
  }
  let t_tecnico = null;
  function guardarTecnico() {
    clearTimeout(t_tecnico);
    t_tecnico = setTimeout(async function () {
      try {
        const db = await abrirDB();
        db.transaction('kv', 'readwrite').objectStore('kv').put(tecnico, 'tecnico');
      } catch (e) { aviso('No se pudieron guardar los datos del técnico'); }
    }, 250);
  }

  // ---------- Utilidades ----------
  const $app = document.getElementById('app');
  const uid = function () { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); };
  const esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  const hoy = function () {
    const d = new Date();
    const p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };
  let t_aviso = null;
  function aviso(txt) {
    const el = document.getElementById('aviso');
    el.textContent = txt; el.hidden = false;
    clearTimeout(t_aviso);
    t_aviso = setTimeout(function () { el.hidden = true; }, 3500);
  }
  function descargar(blob, nombre) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  const proyecto = function () { return estado.proyectos.find(function (p) { return p.id === nav.p; }); };
  const linea = function () { const p = proyecto(); return p && p.lineas.find(function (l) { return l.id === nav.l; }); };
  const cd = function () { const l = linea(); return l && l.cds.find(function (c) { return c.id === nav.c; }); };
  const norm = function (s) { return String(s).trim().toLowerCase(); };
  function nombreUsado(p, nombre, exceptoId) {
    return p.lineas.some(function (l) {
      return l.cds.some(function (c) { return c.id !== exceptoId && norm(c.nombre) === norm(nombre); });
    });
  }
  const completo = function (c) { return c.fecha && c.direccion.trim() && c.municipio.trim() && c.foto; };

  // ---------- Fotos ----------
  function cargarImagen(src) {
    return new Promise(function (ok, ko) {
      const im = new Image();
      im.onload = function () { ok(im); };
      im.onerror = ko;
      im.src = src;
    });
  }
  async function procesarFoto(file) {
    const url = URL.createObjectURL(file);
    try {
      const im = await cargarImagen(url);
      const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
      const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(im, 0, 0, w, h);
      return { data: cv.toDataURL('image/jpeg', 0.85), w: w, h: h };
    } finally { URL.revokeObjectURL(url); }
  }
  function dataUrlABytes(dataUrl) {
    const bin = atob(dataUrl.split(',')[1]);
    const b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  // Devuelve {bytes, w, h} según el ajuste elegido (proporción original o recorte al marco del modelo)
  async function fotoParaWord(foto) {
    if (estado.ajuste !== 'recortar') return { bytes: dataUrlABytes(foto.data), w: foto.w, h: foto.h };
    const im = await cargarImagen(foto.data);
    const ratio = DocGen.BOX_W / DocGen.BOX_H;
    let sw = im.naturalWidth, sh = im.naturalHeight;
    if (sw / sh > ratio) sw = Math.round(sh * ratio); else sh = Math.round(sw / ratio);
    const sx = Math.round((im.naturalWidth - sw) / 2), sy = Math.round((im.naturalHeight - sh) / 2);
    const cv = document.createElement('canvas');
    cv.width = sw; cv.height = sh;
    cv.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
    return { bytes: dataUrlABytes(cv.toDataURL('image/jpeg', 0.9)), w: sw, h: sh };
  }

  // ---------- Firma ----------
  const FIRMA_MAX = 900; // ancho máximo guardado, en píxeles

  // Recorta el lienzo al trazo (con un pequeño margen) y devuelve {data, w, h} en PNG transparente.
  function recortarFirma(cv) {
    const W = cv.width, H = cv.height;
    const px = cv.getContext('2d').getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (px[(y * W + x) * 4 + 3] > 40) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    const m = Math.round(Math.max(W, H) * 0.01) + 2;
    x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m);
    x1 = Math.min(W - 1, x1 + m); y1 = Math.min(H - 1, y1 + m);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const k = Math.min(1, FIRMA_MAX / w);
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(w * k));
    out.height = Math.max(1, Math.round(h * k));
    out.getContext('2d').drawImage(cv, x0, y0, w, h, 0, 0, out.width, out.height);
    return { data: out.toDataURL('image/png'), w: out.width, h: out.height };
  }

  // Imagen de firma subida: el fondo claro (papel) pasa a transparente y se recorta al trazo.
  async function firmaDeArchivo(file) {
    const url = URL.createObjectURL(file);
    try {
      const im = await cargarImagen(url);
      const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(im.naturalWidth * k));
      cv.height = Math.max(1, Math.round(im.naturalHeight * k));
      const ctx = cv.getContext('2d');
      ctx.drawImage(im, 0, 0, cv.width, cv.height);
      const id = ctx.getImageData(0, 0, cv.width, cv.height), p = id.data;
      for (let i = 0; i < p.length; i += 4) {
        const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
        const a = Math.max(0, Math.min(1, (200 - lum) / 70));
        p[i + 3] = Math.round(p[i + 3] * a);
      }
      ctx.putImageData(id, 0, 0);
      return recortarFirma(cv);
    } finally { URL.revokeObjectURL(url); }
  }

  // ---------- Generación de Word ----------
  async function obtenerPlantilla() {
    if (plantillaBuf) return plantillaBuf;
    try {
      const r = await fetch('plantilla.docx');
      if (!r.ok) throw new Error(r.status);
      plantillaBuf = await r.arrayBuffer();
      return plantillaBuf;
    } catch (e) {
      throw new Error('No se pudo cargar plantilla.docx. Abre la app desde su dirección de GitHub Pages, no desde el archivo.');
    }
  }
  function tecnicoParaWord() {
    return {
      tratamiento: tecnico.tratamiento,
      nombre: tecnico.nombre.trim(),
      firma: tecnico.firma ? { bytes: dataUrlABytes(tecnico.firma.data), w: tecnico.firma.w, h: tecnico.firma.h } : null
    };
  }
  // Antes de generar: hace falta el nombre del técnico; sin firma se avisa de que irá el espacio en blanco.
  function comprobarTecnico() {
    if (!tecnico.nombre.trim()) {
      aviso('Indica primero el nombre del técnico');
      prevNav = Object.assign({}, nav);
      ir('tecnico');
      return false;
    }
    if (!tecnico.firma && !confirm('No hay firma guardada: el Word saldrá con el espacio en blanco para firmar a mano. ¿Continuar?')) return false;
    return true;
  }
  async function docDe(c) {
    const f = c.foto ? await fotoParaWord(c.foto) : null;
    const bytes = await DocGen.generar(await obtenerPlantilla(), c, f, tecnicoParaWord());
    return { bytes: bytes, nombre: DocGen.nombreArchivo(c.nombre) };
  }
  function faltan(c) {
    const f = [];
    if (!c.fecha) f.push('fecha de revisión');
    if (!c.direccion.trim()) f.push('dirección');
    if (!c.municipio.trim()) f.push('término municipal');
    return f;
  }
  async function generarUno(c) {
    const f = faltan(c);
    if (f.length) return aviso('Falta: ' + f.join(', '));
    if (!comprobarTecnico()) return;
    if (!c.foto && !confirm('Este CD/PT no tiene foto. ¿Generar el Word con el marcador "INSERTAR IMAGEN"?')) return;
    try {
      const d = await docDe(c);
      descargar(new Blob([d.bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), d.nombre);
    } catch (e) { aviso(e.message); }
  }
  async function generarZip(lineas, nombreZip, conCarpetas) {
    if (!comprobarTecnico()) return;
    const zip = new JSZip();
    let n = 0, omitidos = 0;
    try {
      for (const l of lineas) {
        for (const c of l.cds) {
          if (!completo(c)) { omitidos++; continue; }
          const d = await docDe(c);
          zip.file((conCarpetas ? l.nombre.replace(/[\\/:*?"<>|]/g, '-') + '/' : '') + d.nombre, d.bytes);
          n++;
        }
      }
    } catch (e) { return aviso(e.message); }
    if (!n) return aviso('No hay CD/PT completos (con fecha, dirección, municipio y foto)');
    const limpio = nombreZip.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\\/:*?"<>|]/g, '-');
    descargar(await zip.generateAsync({ type: 'blob' }), limpio + '.zip');
    if (omitidos) aviso(n + ' informes generados. ' + omitidos + ' omitidos por estar incompletos');
  }

  // ---------- Copia de seguridad ----------
  function exportarCopia() {
    const blob = new Blob([JSON.stringify(estado)], { type: 'application/json' });
    descargar(blob, 'copia-informes-bt-' + hoy() + '.json');
  }
  function importarCopia(file) {
    const r = new FileReader();
    r.onload = function () {
      try {
        const v = JSON.parse(r.result);
        if (!v || !Array.isArray(v.proyectos)) throw new Error();
        if (!confirm('Esto reemplaza todo lo que hay ahora en la app. ¿Continuar?')) return;
        estado = Object.assign({ ajuste: 'proporcion' }, v);
        guardar(); nav = { vista: 'inicio' }; pintar();
        aviso('Copia importada');
      } catch (e) { aviso('El archivo no es una copia válida'); }
    };
    r.readAsText(file);
  }

  // ---------- Vistas ----------
  function cabecera(titulo, migas, atras) {
    document.getElementById('titulo').textContent = titulo;
    document.getElementById('migas').textContent = migas || '';
    document.getElementById('atras').hidden = !atras;
  }

  function vistaInicio() {
    cabecera('Informes instalación sin BT', '', false);
    const lista = estado.proyectos.map(function (p) {
      const n = p.lineas.reduce(function (a, l) { return a + l.cds.length; }, 0);
      return '<li class="item" data-act="abrir-proyecto" data-id="' + p.id + '"><div><div class="nombre">' + esc(p.nombre) +
        '</div><div class="detalle">' + p.lineas.length + ' líneas · ' + n + ' CD/PT</div></div><span>›</span></li>';
    }).join('');
    const tecCard = tecnico.nombre.trim()
      ? '<ul class="lista"><li class="item" data-act="abrir-tecnico"><div><div class="detalle">Técnico</div><div class="nombre">' +
        esc(tecnico.tratamiento + ' ' + tecnico.nombre) + '</div><div class="detalle">' +
        (tecnico.firma ? 'Firma guardada' : 'Sin firma') + '</div></div><span>›</span></li></ul>'
      : '<section class="tarjeta pendiente"><h2>Antes de empezar</h2>' +
        '<p class="nota">Indica el nombre del técnico y su firma. Se guardan en este navegador y se usan en todos los informes.</p>' +
        '<button class="ancho" data-act="abrir-tecnico">Configurar técnico</button></section>';
    $app.innerHTML = tecCard +
      '<section class="tarjeta"><h2>Nuevo proyecto</h2><div class="fila">' +
      '<input type="text" id="nuevo" placeholder="Nombre del proyecto" autocomplete="off">' +
      '<button data-act="crear-proyecto">Crear</button></div></section>' +
      (lista ? '<h2 style="font-size:1rem;margin:18px 0 8px">Mis proyectos</h2><ul class="lista">' + lista + '</ul>' : '') +
      '<section class="tarjeta"><h2>Ajustes</h2>' +
      '<label for="ajuste">Foto en el Word</label>' +
      '<select id="ajuste"><option value="proporcion"' + (estado.ajuste !== 'recortar' ? ' selected' : '') + '>Respetar proporciones (sin recortar)</option>' +
      '<option value="recortar"' + (estado.ajuste === 'recortar' ? ' selected' : '') + '>Recortar al marco vertical del modelo</option></select>' +
      '<div class="acciones"><button class="sec" data-act="exportar">Exportar copia</button>' +
      '<label class="boton sec" style="margin:0">Importar copia<input type="file" id="importar" accept=".json,application/json"></label></div></section>' +
      '<p class="pie">Los datos se guardan en este navegador. Exporta una copia de vez en cuando.</p>';
    if (!estado.proyectos.length) document.getElementById('nuevo').focus();
  }

  function vistaProyecto() {
    const p = proyecto();
    cabecera(p.nombre, 'Proyecto', true);
    const lista = p.lineas.map(function (l) {
      const ok = l.cds.filter(completo).length;
      return '<li class="item" data-act="abrir-linea" data-id="' + l.id + '"><div><div class="nombre">' + esc(l.nombre) +
        '</div><div class="detalle">' + l.cds.length + ' CD/PT · ' + ok + ' completos</div></div><span>›</span></li>';
    }).join('');
    $app.innerHTML =
      '<section class="tarjeta"><h2>Nueva línea</h2><div class="fila">' +
      '<input type="text" id="nuevo" placeholder="Nombre de la línea" autocomplete="off">' +
      '<button data-act="crear-linea">Añadir</button></div></section>' +
      (lista ? '<ul class="lista">' + lista + '</ul>' : '<p class="vacio">Aún no hay líneas.</p>') +
      '<div class="acciones"><button data-act="zip-proyecto">Descargar todo (ZIP)</button>' +
      '<button class="peligro" data-act="borrar-proyecto">Eliminar proyecto</button></div>';
    document.getElementById('nuevo').focus();
  }

  function vistaLinea() {
    const p = proyecto(), l = linea();
    cabecera(l.nombre, p.nombre + ' › Línea', true);
    const lista = l.cds.map(function (c) {
      return '<li class="item" data-act="abrir-cd" data-id="' + c.id + '"><div><div class="nombre">' + esc(c.nombre) +
        '</div><div class="detalle">' + esc(c.municipio || 'Sin municipio') + '</div></div>' +
        (completo(c) ? '<span class="etiqueta ok">Completo</span>' : '<span class="etiqueta falta">Incompleto</span>') + '</li>';
    }).join('');
    $app.innerHTML =
      '<section class="tarjeta"><h2>Nuevo CD / PT</h2><div class="fila">' +
      '<input type="text" id="nuevo" placeholder="Nombre (ej. 46301)" autocomplete="off">' +
      '<button data-act="crear-cd">Añadir</button></div><div id="err" class="error"></div></section>' +
      (lista ? '<ul class="lista">' + lista + '</ul>' : '<p class="vacio">Aún no hay CD/PT en esta línea.</p>') +
      '<div class="acciones"><button data-act="zip-linea">Descargar línea (ZIP)</button>' +
      '<button class="peligro" data-act="borrar-linea">Eliminar línea</button></div>';
    document.getElementById('nuevo').focus();
  }

  function vistaCD() {
    const p = proyecto(), l = linea(), c = cd();
    cabecera(c.nombre, p.nombre + ' › ' + l.nombre, true);
    $app.innerHTML =
      '<section class="tarjeta">' +
      '<label for="f-nombre">Nombre del CD / PT</label><input type="text" id="f-nombre" value="' + esc(c.nombre) + '">' +
      '<div id="err" class="error"></div>' +
      '<label for="f-fecha">Fecha de revisión</label><input type="date" id="f-fecha" value="' + esc(c.fecha) + '">' +
      '<label for="f-dir">Dirección del sitio</label><input type="text" id="f-dir" value="' + esc(c.direccion) + '" autocomplete="street-address">' +
      '<label for="f-mun">Término municipal</label><input type="text" id="f-mun" value="' + esc(c.municipio) + '">' +
      '<label>Foto</label>' +
      '<div class="acciones"><label class="boton sec" style="margin:0">Hacer foto<input type="file" id="f-cam" accept="image/*" capture="environment"></label>' +
      '<label class="boton sec" style="margin:0">Elegir de la galería<input type="file" id="f-gal" accept="image/*"></label></div>' +
      '<div id="prev"></div></section>' +
      '<button class="ancho" data-act="generar">Generar Word</button>' +
      '<div class="acciones"><button class="peligro" data-act="borrar-cd">Eliminar CD/PT</button></div>';
    pintarFoto();
  }
  function pintarFoto() {
    const c = cd(), el = document.getElementById('prev');
    el.innerHTML = c.foto
      ? '<img class="foto-prev" src="' + c.foto.data + '" alt="Foto del CD/PT"><button class="sec ancho" data-act="quitar-foto">Quitar foto</button>'
      : '<p class="vacio">Sin foto</p>';
  }

  function volverDeTecnico() {
    if (prevNav) { nav = prevNav; prevNav = null; pintar(); } else ir('inicio');
  }

  function vistaTecnico() {
    cabecera('Técnico', 'Nombre y firma', true);
    $app.innerHTML =
      '<section class="tarjeta"><h2>Datos del técnico</h2>' +
      '<label for="t-trat">Tratamiento</label>' +
      '<select id="t-trat"><option value="D."' + (tecnico.tratamiento !== 'Dña.' ? ' selected' : '') + '>D.</option>' +
      '<option value="Dña."' + (tecnico.tratamiento === 'Dña.' ? ' selected' : '') + '>Dña.</option></select>' +
      '<label for="t-nombre">Nombre y apellidos</label>' +
      '<input type="text" id="t-nombre" value="' + esc(tecnico.nombre) + '" placeholder="Nombre y apellidos" autocomplete="name">' +
      '<p class="nota">Aparece al principio del informe y junto a la firma.</p></section>' +
      '<section class="tarjeta"><h2>Firma</h2><div id="firma-act"></div>' +
      '<label>Dibújala con el dedo o el ratón</label>' +
      '<canvas id="pad" class="pad"></canvas>' +
      '<div class="acciones"><button class="sec" data-act="pad-borrar">Borrar</button>' +
      '<button data-act="pad-guardar">Guardar firma</button></div>' +
      '<label>O sube una imagen</label>' +
      '<div class="acciones"><label class="boton sec" style="margin:0">Elegir imagen de firma<input type="file" id="t-firma-img" accept="image/*"></label></div>' +
      '<p class="nota">Con una foto o un escaneo sobre papel blanco, el fondo se quita solo.</p></section>' +
      '<button class="ancho" data-act="tecnico-listo">Listo</button>';
    pintarFirmaActual();
    iniciarPad();
  }
  function pintarFirmaActual() {
    const el = document.getElementById('firma-act');
    if (!el) return;
    el.innerHTML = tecnico.firma
      ? '<div class="detalle">Firma guardada</div><img class="firma-prev" src="' + tecnico.firma.data + '" alt="Firma guardada">' +
        '<button class="peligro ancho" data-act="quitar-firma">Quitar firma</button>'
      : '<p class="nota">Aún no hay firma guardada. Sin firma, el Word sale con el espacio en blanco para firmar a mano.</p>';
  }
  function iniciarPad() {
    const cv = document.getElementById('pad');
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = cv.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = 3 * dpr; ctx.strokeStyle = '#111'; ctx.fillStyle = '#111';
    let dibujando = false, ult = null;
    const pos = function (e) {
      const b = cv.getBoundingClientRect();
      return { x: (e.clientX - b.left) * cv.width / b.width, y: (e.clientY - b.top) * cv.height / b.height };
    };
    cv.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* no pasa nada */ }
      dibujando = true; ult = pos(e);
      ctx.beginPath(); ctx.arc(ult.x, ult.y, ctx.lineWidth / 2, 0, 2 * Math.PI); ctx.fill();
    });
    cv.addEventListener('pointermove', function (e) {
      if (!dibujando) return;
      const p = pos(e);
      ctx.beginPath(); ctx.moveTo(ult.x, ult.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ult = p;
    });
    const fin = function () { dibujando = false; };
    cv.addEventListener('pointerup', fin);
    cv.addEventListener('pointercancel', fin);
  }

  function pintar() {
    ({ inicio: vistaInicio, proyecto: vistaProyecto, linea: vistaLinea, cd: vistaCD, tecnico: vistaTecnico })[nav.vista]();
    window.scrollTo(0, 0);
  }
  function ir(vista, extra) { nav = Object.assign({ vista: vista, p: nav.p, l: nav.l, c: nav.c }, extra || {}); pintar(); }

  // ---------- Eventos ----------
  const valorNuevo = function () { const e = document.getElementById('nuevo'); return e ? e.value.trim() : ''; };

  document.getElementById('atras').addEventListener('click', function () {
    if (nav.vista === 'tecnico') volverDeTecnico();
    else if (nav.vista === 'cd') ir('linea', { c: null });
    else if (nav.vista === 'linea') ir('proyecto', { l: null });
    else if (nav.vista === 'proyecto') ir('inicio', { p: null });
  });

  $app.addEventListener('click', async function (ev) {
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act, id = t.dataset.id;
    const p = proyecto(), l = linea(), c = cd();

    if (act === 'crear-proyecto') {
      const n = valorNuevo(); if (!n) return aviso('Escribe un nombre');
      const np = { id: uid(), nombre: n, lineas: [] };
      estado.proyectos.unshift(np); guardar(); ir('proyecto', { p: np.id });
    } else if (act === 'abrir-proyecto') ir('proyecto', { p: id });
    else if (act === 'crear-linea') {
      const n = valorNuevo(); if (!n) return aviso('Escribe un nombre');
      const nl = { id: uid(), nombre: n, cds: [] };
      p.lineas.push(nl); guardar(); ir('linea', { l: nl.id });
    } else if (act === 'abrir-linea') ir('linea', { l: id });
    else if (act === 'crear-cd') {
      const n = valorNuevo(), err = document.getElementById('err');
      if (!n) { err.textContent = 'Escribe un nombre'; return; }
      if (nombreUsado(p, n)) { err.textContent = 'Ya existe un CD/PT con ese nombre en este proyecto'; return; }
      const nc = { id: uid(), nombre: n, fecha: hoy(), direccion: '', municipio: '', foto: null };
      l.cds.push(nc); guardar(); ir('cd', { c: nc.id });
    } else if (act === 'abrir-cd') ir('cd', { c: id });
    else if (act === 'generar') generarUno(c);
    else if (act === 'quitar-foto') { c.foto = null; guardar(); pintarFoto(); }
    else if (act === 'zip-linea') generarZip([l], p.nombre + ' - ' + l.nombre, false);
    else if (act === 'zip-proyecto') generarZip(p.lineas, p.nombre, true);
    else if (act === 'exportar') exportarCopia();
    else if (act === 'abrir-tecnico') { prevNav = Object.assign({}, nav); ir('tecnico'); }
    else if (act === 'tecnico-listo') volverDeTecnico();
    else if (act === 'pad-borrar') {
      const cv = document.getElementById('pad');
      cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    } else if (act === 'pad-guardar') {
      const cv = document.getElementById('pad');
      const f = recortarFirma(cv);
      if (!f) return aviso('Dibuja primero la firma');
      tecnico.firma = f; guardarTecnico();
      cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
      pintarFirmaActual(); aviso('Firma guardada');
    } else if (act === 'quitar-firma') { tecnico.firma = null; guardarTecnico(); pintarFirmaActual(); }
    else if (act === 'borrar-cd') {
      if (!confirm('¿Eliminar el CD/PT ' + c.nombre + '?')) return;
      l.cds = l.cds.filter(function (x) { return x.id !== c.id; }); guardar(); ir('linea', { c: null });
    } else if (act === 'borrar-linea') {
      if (!confirm('¿Eliminar la línea ' + l.nombre + ' y todos sus CD/PT?')) return;
      p.lineas = p.lineas.filter(function (x) { return x.id !== l.id; }); guardar(); ir('proyecto', { l: null });
    } else if (act === 'borrar-proyecto') {
      if (!confirm('¿Eliminar el proyecto ' + p.nombre + ' y todo su contenido?')) return;
      estado.proyectos = estado.proyectos.filter(function (x) { return x.id !== p.id; }); guardar(); ir('inicio', { p: null, l: null });
    }
  });

  $app.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' || ev.target.id !== 'nuevo') return;
    const b = $app.querySelector('.fila button'); if (b) b.click();
  });

  $app.addEventListener('input', function (ev) {
    if (nav.vista === 'tecnico') {
      if (ev.target.id === 't-nombre') { tecnico.nombre = ev.target.value; guardarTecnico(); }
      return;
    }
    const c = nav.vista === 'cd' ? cd() : null; if (!c) return;
    const id = ev.target.id;
    if (id === 'f-fecha') c.fecha = ev.target.value;
    else if (id === 'f-dir') c.direccion = ev.target.value;
    else if (id === 'f-mun') c.municipio = ev.target.value;
    else if (id === 'f-nombre') {
      const n = ev.target.value.trim(), err = document.getElementById('err');
      if (!n) { err.textContent = 'El nombre no puede estar vacío'; return; }
      if (nombreUsado(proyecto(), n, c.id)) { err.textContent = 'Ya existe un CD/PT con ese nombre'; return; }
      err.textContent = ''; c.nombre = n; document.getElementById('titulo').textContent = n;
    } else return;
    guardar();
  });

  $app.addEventListener('change', async function (ev) {
    const id = ev.target.id;
    if (id === 't-trat') { tecnico.tratamiento = ev.target.value; guardarTecnico(); }
    else if (id === 't-firma-img' && ev.target.files[0]) {
      try {
        const f = await firmaDeArchivo(ev.target.files[0]);
        if (!f) aviso('No se ha encontrado ninguna firma en la imagen');
        else { tecnico.firma = f; guardarTecnico(); pintarFirmaActual(); aviso('Firma guardada'); }
      } catch (e) { aviso('No se pudo leer la imagen'); }
      ev.target.value = '';
    }
    else if (id === 'ajuste') { estado.ajuste = ev.target.value; guardar(); }
    else if (id === 'importar' && ev.target.files[0]) { importarCopia(ev.target.files[0]); ev.target.value = ''; }
    else if ((id === 'f-cam' || id === 'f-gal') && ev.target.files[0]) {
      try {
        const c = cd(); c.foto = await procesarFoto(ev.target.files[0]);
        guardar(); pintarFoto();
      } catch (e) { aviso('No se pudo leer la imagen'); }
      ev.target.value = '';
    }
  });

  // ---------- Inicio ----------
  (async function () {
    await cargar();
    pintar();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  })();
})();
