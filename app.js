(function () {
  'use strict';

  var FORMATO = 'informe-especialista';
  var VERSION = 1;
  var $ = function (s) { return document.querySelector(s); };

  /* ====================== utilidades ====================== */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function today() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function h(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40); }
  function stamp() { var d = new Date(); var p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); }
  function fmtFecha(ts) { try { return new Date(ts).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; } }
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  var ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
    json: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
    word: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>'
  };

  /* ====================== almacenamiento (IndexedDB) ====================== */
  var mem = { reports: {}, meta: {}, copias: {}, copiasMeta: {}, ajustes: {} };
  var db = null, dbOk = false;

  function openDB() {
    return new Promise(function (res0) {
      var done = false;
      var res = function (v) { if (!done) { done = true; res0(v); } };
      setTimeout(function () { res(null); }, 4000);   // si el navegador no responde, se sigue sin base de datos
      if (!window.indexedDB) return res(null);
      var rq;
      try { rq = indexedDB.open('informe-especialista', 2); } catch (e) { return res(null); }
      rq.onupgradeneeded = function () {
        var d = rq.result;
        if (!d.objectStoreNames.contains('reports')) d.createObjectStore('reports', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'id' });
        ['copias', 'copiasMeta', 'ajustes'].forEach(function (n) { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath: 'id' }); });
      };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { res(null); };
      rq.onblocked = function () { res(null); };
    });
  }
  function tx(store, mode, fn) {
    return new Promise(function (res, rej) {
      var t = db.transaction(store, mode), s = t.objectStore(store), out = fn(s);
      t.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); };
      t.onerror = t.onabort = function () { rej(t.error); };
    });
  }
  var store = {
    all: function (name) { return dbOk ? tx(name, 'readonly', function (s) { return s.getAll(); }) : Promise.resolve(Object.keys(mem[name]).map(function (k) { return mem[name][k]; })); },
    get: function (name, id) { return dbOk ? tx(name, 'readonly', function (s) { return s.get(id); }) : Promise.resolve(mem[name][id]); },
    put: function (name, obj) { if (!dbOk) { mem[name][obj.id] = obj; return Promise.resolve(); } return tx(name, 'readwrite', function (s) { return s.put(obj); }); },
    del: function (name, id) { if (!dbOk) { delete mem[name][id]; return Promise.resolve(); } return tx(name, 'readwrite', function (s) { return s.delete(id); }); }
  };

  /* ====================== modelo ====================== */
  var SERVICIO0 = 'Ingeniería E Inspección para Habilitación Del Puente Apilador CV-013, BHP SPENCE', PO0 = '4518931042';
  function blankFoto() { return { id: uid(), imagen: null, ancho: 0, alto: 0, comentario: '', condicion: '', recomendacion: '' }; }
  var CONDS = [['critica', 'Crítica'], ['relevante', 'Relevante'], ['no_critica', 'No crítica']];
  function usada(f) { return !!(f.imagen || (f.comentario && f.comentario.trim()) || f.condicion || (f.recomendacion && f.recomendacion.trim())); }
  function newReport() {
    var t = today();
    return {
      id: uid(), creado: Date.now(), actualizado: Date.now(),
      portada: { servicio: SERVICIO0, po: PO0, fechaEmision: t, cliente: '', equipo: '', especialista: '', cargo: '', fecha: t },
      objetivo: '', alcance: '', descripcion: '', fotosIntro: '',
      fotos: [blankFoto(), blankFoto(), blankFoto(), blankFoto(), blankFoto()],
      recomendaciones: '', conclusion: '', anexos: ''
    };
  }
  function normalize(r) {
    var b = newReport(), o = {};
    o.id = r.id || uid();
    o.creado = r.creado || Date.now();
    o.actualizado = r.actualizado || Date.now();
    o.portada = Object.assign({}, b.portada, r.portada || {});
    ['objetivo', 'alcance', 'descripcion', 'fotosIntro', 'recomendaciones', 'conclusion', 'anexos'].forEach(function (k) { o[k] = r[k] == null ? '' : String(r[k]); });
    o.fotos = (Array.isArray(r.fotos) ? r.fotos : []).map(function (f) {
      return { id: f.id || uid(), imagen: typeof f.imagen === 'string' && f.imagen.indexOf('data:image') === 0 ? f.imagen : null, ancho: +f.ancho || 0, alto: +f.alto || 0, comentario: f.comentario == null ? '' : String(f.comentario), condicion: ['critica', 'relevante', 'no_critica'].indexOf(f.condicion) >= 0 ? f.condicion : '', recomendacion: f.recomendacion == null ? '' : String(f.recomendacion) };
    });
    return o;
  }
  function titulo(r) { return r.portada.cliente || r.portada.equipo || 'Informe sin título'; }
  function nFotos(r) { return r.fotos.filter(function (f) { return f.imagen; }).length; }
  function metaOf(r) { return { id: r.id, titulo: titulo(r), subtitulo: r.portada.equipo && r.portada.cliente ? r.portada.equipo : '', actualizado: r.actualizado, creado: r.creado, fotos: nFotos(r) }; }

  /* ====================== guardado automático ====================== */
  var cur = null, saveTimer = null;
  function setStatus(txt, cls) { var c = $('#status'); if (c) { c.textContent = txt; c.className = 'chip ' + (cls || ''); } }
  function touch() {
    cur.actualizado = Date.now();
    setStatus('Guardando…', 'warn');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 450);
  }
  function save() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!cur) return Promise.resolve();
    var r = cur;
    return Promise.all([store.put('reports', r), store.put('meta', metaOf(r))]).then(function () {
      setStatus(dbOk ? 'Guardado' : 'Solo en memoria', dbOk ? 'ok' : 'warn');
      tomarCopia(r, false); programarArchivo(); programarAuto();
      var t = $('#titulo'); if (t) t.textContent = titulo(r);
    }).catch(function () { setStatus('Error al guardar', 'warn'); toast('No se pudo guardar. Haz un respaldo .json ahora.'); });
  }
  function flush() { if (saveTimer) save(); }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  /* ====================== modal / toast ====================== */
  var toastTimer;
  function toast(msg, ms) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3200);
  }
  function modal(title, bodyHTML, actions) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHTML || '';
    var box = $('#modalActions'); box.innerHTML = '';
    (actions || []).filter(Boolean).forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'btn ' + (a.cls || ''); b.innerHTML = a.label;
      b.addEventListener('click', function () { if (a.close !== false) closeModal(); if (a.fn) a.fn(); });
      box.appendChild(b);
    });
    $('#modal').hidden = false;
  }
  function closeModal() { $('#modal').hidden = true; }
  $('#modal').addEventListener('click', function (e) { if (e.target.id === 'modal') closeModal(); });

  /* ====================== entrega de archivos ====================== */
  function descargar(blob, nombre) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function entregar(blob, nombre, titulo, extraHTML, onDone) {
    var file = null, puede = false;
    try { file = new File([blob], nombre, { type: blob.type }); puede = !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) { }
    modal(titulo, '<p><strong>' + h(nombre) + '</strong><br>' + fmtSize(blob.size) + '</p>' + (extraHTML || ''), [
      puede && { label: ICON.json + 'Compartir / Guardar en…', cls: 'primary', close: false, fn: function () {
        navigator.share({ files: [file], title: nombre }).then(function () { closeModal(); if (onDone) onDone(); }).catch(function (e) { if (e && e.name !== 'AbortError') { descargar(blob, nombre); if (onDone) onDone(); } });
      } },
      { label: 'Descargar', cls: puede ? '' : 'primary', fn: function () { descargar(blob, nombre); if (onDone) onDone(); } },
      { label: 'Cerrar' }
    ]);
  }

  /* ====================== respaldo .json ====================== */
  function paquete(reps) { return { formato: FORMATO, version: VERSION, exportadoEn: new Date().toISOString(), informes: reps }; }
  function respaldar(reps, nombreBase) {
    var blob = new Blob([JSON.stringify(paquete(reps))], { type: 'application/json' });
    var nombre = 'respaldo_' + nombreBase + '_' + stamp() + '.json';
    entregar(blob, nombre, 'Respaldo listo', '<p>Guárdalo en un lugar seguro (Archivos, Drive, correo). Para restaurar usa «Importar respaldo».</p>', function () {
      ls('ultimoRespaldo', String(Date.now()));
    });
  }
  async function respaldarActual() { await save(); respaldar([cur], slug(titulo(cur)) || 'informe'); }
  async function respaldarTodo() { var all = await store.all('reports'); if (!all.length) return toast('No hay informes para respaldar'); respaldar(all, 'todos'); }

  async function importarArchivo(file) {
    var data;
    try { data = JSON.parse(await file.text()); } catch (e) { return modal('Archivo no válido', '<p>No se pudo leer el archivo como respaldo .json.</p>', [{ label: 'Cerrar' }]); }
    var lista = data && Array.isArray(data.informes) ? data.informes : (data && data.portada ? [data] : null);
    if (!lista || !lista.length) return modal('Archivo no válido', '<p>El archivo no corresponde a un respaldo de esta aplicación.</p>', [{ label: 'Cerrar' }]);
    lista = lista.map(normalize);
    var existentes = {}; (await store.all('meta')).forEach(function (m) { existentes[m.id] = 1; });
    var choques = lista.filter(function (r) { return existentes[r.id]; }).length;
    async function aplicar(reemplazar) {
      for (var i = 0; i < lista.length; i++) {
        var r = lista[i];
        if (existentes[r.id] && !reemplazar) { r.id = uid(); r.portada.cliente = r.portada.cliente ? r.portada.cliente + ' (importado)' : r.portada.cliente; }
        await store.put('reports', r); await store.put('meta', metaOf(r));
      }
      toast(lista.length + (lista.length === 1 ? ' informe importado' : ' informes importados'));
      renderHome();
    }
    if (choques) {
      modal('Importar respaldo', '<p>' + choques + (choques === 1 ? ' informe ya existe' : ' informes ya existen') + ' en este dispositivo. ¿Reemplazarlos por la versión del respaldo, o importarlos como copias?</p>', [
        { label: 'Reemplazar', cls: 'primary', fn: function () { aplicar(true); } },
        { label: 'Importar como copias', fn: function () { aplicar(false); } },
        { label: 'Cancelar' }
      ]);
    } else aplicar(true);
  }


  /* ====================== respaldos automáticos ====================== */
  var DIEZ_MIN = 10 * 60 * 1000, COPIAS_MAX = 5, ultimaCopia = {};

  // 1) Copias internas (instantáneas): al guardar, como máximo una cada 10 min por informe; forzadas cada 10 min y al salir.
  async function tomarCopia(r, forzar) {
    try {
      if (!r) return;
      var last = ultimaCopia[r.id] || 0;
      if (r.actualizado <= last) return;                 // nada nuevo desde la última copia
      if (!forzar && Date.now() - last < DIEZ_MIN) return;
      var ts = Date.now(); ultimaCopia[r.id] = ts;
      var c = { id: ts.toString(36) + Math.random().toString(36).slice(2, 5), informeId: r.id, ts: ts, informe: JSON.parse(JSON.stringify(r)) };
      var m = { id: c.id, informeId: r.id, ts: ts, titulo: titulo(r), fotos: nFotos(r) };
      await store.put('copias', c); await store.put('copiasMeta', m);
      var propias = (await store.all('copiasMeta')).filter(function (x) { return x.informeId === r.id; }).sort(function (x, y) { return y.ts - x.ts; });
      for (var i = COPIAS_MAX; i < propias.length; i++) { await store.del('copias', propias[i].id); await store.del('copiasMeta', propias[i].id); }
    } catch (e) { }
  }

  async function listaCopias() {
    var metas = (await store.all('copiasMeta')).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 40);
    modal('Copias automáticas', metas.length ? '<p>Se guardan sola mientras trabajas (cada 10 min o al salir). Toca una para restaurarla o descargarla.</p>' : '<p>Aún no hay copias automáticas.</p>', []);
    var box = $('#modalActions');
    metas.forEach(function (m) {
      var b = document.createElement('button'); b.className = 'btn';
      b.innerHTML = '<span style="text-align:left;flex:1;min-width:0"><strong>' + h(m.titulo) + '</strong><br><small>' + h(fmtFecha(m.ts)) + ' · ' + m.fotos + ' fotos</small></span>';
      b.addEventListener('click', function () { opcionesCopia(m); });
      box.appendChild(b);
    });
    var c = document.createElement('button'); c.className = 'btn'; c.textContent = 'Cerrar'; c.addEventListener('click', closeModal); box.appendChild(c);
  }
  function opcionesCopia(m) {
    modal('Copia del ' + fmtFecha(m.ts), '<p>' + h(m.titulo) + '</p>', [
      { label: 'Restaurar como informe nuevo', cls: 'primary', fn: async function () {
        var c = await store.get('copias', m.id); if (!c) return toast('La copia ya no existe');
        var r = normalize(c.informe); r.id = uid(); r.actualizado = Date.now(); r.fotos.forEach(function (f) { f.id = uid(); });
        r.portada.cliente = (r.portada.cliente || '') + ' (restaurado)';
        await store.put('reports', r); await store.put('meta', metaOf(r)); toast('Copia restaurada'); renderHome();
      } },
      { label: ICON.json + 'Descargar como .json', fn: async function () { var c = await store.get('copias', m.id); if (c) respaldar([normalize(c.informe)], slug(m.titulo) || 'copia'); } },
      { label: 'Volver', fn: listaCopias }
    ]);
  }

  // 2) Archivo .json que se reescribe solo (Chrome/Edge de escritorio, con selector de archivos)
  var fileHandle = null, archivoTimer = null, escribiendo = false;
  var soportaArchivo = typeof window.showSaveFilePicker === 'function';
  async function cargarHandle() { try { var o = await store.get('ajustes', 'archivo'); if (o && o.handle) fileHandle = o.handle; } catch (e) { } }
  async function permisoArchivo(pedir) {
    if (!fileHandle) return false;
    try {
      var o = { mode: 'readwrite' };
      if ((await fileHandle.queryPermission(o)) === 'granted') return true;
      if (pedir && (await fileHandle.requestPermission(o)) === 'granted') return true;
    } catch (e) { }
    return false;
  }
  async function escribirArchivo() {
    if (!fileHandle || escribiendo || !(await permisoArchivo(false))) return false;
    escribiendo = true;
    try {
      var all = await store.all('reports');
      var w = await fileHandle.createWritable();
      await w.write(JSON.stringify(paquete(all))); await w.close();
      ls('ultimoRespaldo', String(Date.now())); ls('ultimoArchivo', String(Date.now()));
      return true;
    } catch (e) { return false; } finally { escribiendo = false; }
  }
  function programarArchivo() { if (!fileHandle) return; clearTimeout(archivoTimer); archivoTimer = setTimeout(escribirArchivo, 4000); }
  async function elegirArchivo() {
    try {
      var hnd = await window.showSaveFilePicker({ suggestedName: 'respaldo_informes.json', types: [{ description: 'Respaldo JSON', accept: { 'application/json': ['.json'] } }] });
      fileHandle = hnd; await store.put('ajustes', { id: 'archivo', handle: hnd });
      var ok = await escribirArchivo(); toast(ok ? 'Respaldo automático activado' : 'No se pudo escribir el archivo'); renderHome();
    } catch (e) { if (e && e.name !== 'AbortError') toast('No se pudo activar el respaldo automático'); }
  }
  async function reactivarArchivo() { if (await permisoArchivo(true)) { await escribirArchivo(); toast('Respaldo automático reactivado'); renderHome(); } }
  async function detenerArchivo() { fileHandle = null; await store.del('ajustes', 'archivo'); toast('Respaldo automático desactivado'); renderHome(); }


  // 4) Descarga automática del .json (todos los informes): con cambios, como máximo 1 archivo cada 10 min, y al volver al inicio
  var ultimaAuto = +ls('ultimaAuto') || 0, autoTimer = null;
  function autoActiva() { var v = ls('autoDescarga'); return v === '1' || (v === null && !esIOS()); }  // en iOS el navegador bloquea descargas sin toque: por defecto apagada
  async function autoDescargar(forzar) {
    try {
      if (!autoActiva()) return false;
      if (!forzar && Date.now() - ultimaAuto < DIEZ_MIN) return false;
      var all = await store.all('reports'); if (!all.length) return false;
      var maxAct = Math.max.apply(null, all.map(function (r) { return r.actualizado || 0; }));
      if (maxAct <= (+ls('ultimaAutoDatos') || 0)) return false;           // sin cambios nuevos
      var blob = new Blob([JSON.stringify(paquete(all))], { type: 'application/json' });
      descargar(blob, 'respaldo_auto_' + stamp() + '.json');
      ultimaAuto = Date.now(); ls('ultimaAuto', String(ultimaAuto)); ls('ultimaAutoDatos', String(maxAct)); ls('ultimoRespaldo', String(ultimaAuto));
      toast('Respaldo .json descargado automáticamente');
      return true;
    } catch (e) { return false; }
  }
  function programarAuto() { if (!autoActiva()) return; clearTimeout(autoTimer); autoTimer = setTimeout(function () { autoDescargar(false); }, 5000); }

  // 3) Ciclo de 10 min + recordatorio de respaldo manual cuando no hay archivo automático
  var editorDesde = 0, snooze = 0;
  function recordatorio() {
    var el = document.getElementById('recordatorio');
    var ult = +ls('ultimoRespaldo') || 0;
    var debe = cur && cur.actualizado > ult && Date.now() > snooze && Date.now() - Math.max(ult, editorDesde) >= DIEZ_MIN;
    if (!debe) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement('div'); el.id = 'recordatorio'; el.className = 'banner warn remind';
    el.innerHTML = 'Hay cambios sin respaldar desde hace más de 10 min. <div class="row" style="margin-top:8px"><button class="btn sm primary" data-r="ya">Respaldar ahora</button><button class="btn sm" data-r="luego">Luego</button></div>';
    el.addEventListener('click', function (e) {
      var r = e.target.dataset.r; if (!r) return;
      if (r === 'luego') snooze = Date.now() + DIEZ_MIN; el.remove();
      if (r === 'ya') respaldarActual();
    });
    document.body.appendChild(el);
  }
  setInterval(function () {
    if (cur) tomarCopia(cur, true);
    escribirArchivo();
  }, DIEZ_MIN);
  setInterval(function () { autoDescargar(false); }, 60000);
  setInterval(recordatorio, 30000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { if (cur) tomarCopia(cur, true); escribirArchivo(); } });

  /* ====================== exportar a Word ====================== */
  function exportarWord() {
    flush();
    var llenas = cur.fotos.filter(usada).length;
    var vacias = cur.fotos.length - llenas;
    var upd = ls('actualizarIndice') !== '0';
    modal('Exportar a Word', '<p>Se generará el informe con el formato de la plantilla: ' + llenas + (llenas === 1 ? ' registro fotográfico' : ' registros fotográficos') + (vacias ? ' (' + vacias + ' recuadro' + (vacias === 1 ? '' : 's') + ' vacío' + (vacias === 1 ? '' : 's') + ' no se incluye' + (vacias === 1 ? '' : 'n') + ')' : '') + '.</p>' +
      '<label class="check"><input type="checkbox" id="optIdx"' + (upd ? ' checked' : '') + '><span>Pedir a Word que recalcule el índice al abrir (verifica los números de página; Word preguntará una vez). El índice ya viene con los números calculados.</span></label>', [
      { label: ICON.word + 'Generar documento', cls: 'primary', close: false, fn: function () {
        var o = $('#optIdx'); var actualizar = o ? o.checked : true; ls('actualizarIndice', actualizar ? '1' : '0');
        generarWord(actualizar);
      } },
      { label: 'Cancelar' }
    ]);
  }
  async function generarWord(actualizar) {
    $('#modalTitle').textContent = 'Generando…';
    $('#modalBody').innerHTML = '<p><span class="spin"></span>&nbsp; Armando el documento, un momento.</p>';
    $('#modalActions').innerHTML = '';
    try {
      var blob = await window.buildDocx(cur, window.__TEMPLATE_B64, { actualizarIndice: actualizar });
      var base = 'Informe_' + (slug(cur.portada.cliente || cur.portada.equipo) || 'Especialista') + '_' + (cur.portada.fecha || today());
      entregar(blob, base + '.docx', 'Documento listo', actualizar ? '<p>Al abrirlo en Word, acepta «Sí» para que verifique el índice.</p>' : '');
    } catch (e) {
      console.error(e);
      modal('No se pudo generar', '<p>' + h(e && e.message || e) + '</p>', [{ label: 'Cerrar' }]);
    }
  }

  /* ====================== imágenes ====================== */
  function loadImg(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), i = new Image();
      i.onload = function () { URL.revokeObjectURL(u); res(i); };
      i.onerror = function () { URL.revokeObjectURL(u); rej(new Error('No se pudo leer la imagen')); };
      i.src = u;
    });
  }
  async function procesarImagen(file) {
    var src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch (e) { src = await loadImg(file); }
    var w = src.width || src.naturalWidth, hh = src.height || src.naturalHeight, MAX = 1400;
    var k = Math.min(1, MAX / Math.max(w, hh)), cw = Math.round(w * k), ch = Math.round(hh * k);
    var c = document.createElement('canvas'); c.width = cw; c.height = ch;
    var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cw, ch); x.drawImage(src, 0, 0, cw, ch);
    if (src.close) src.close();
    return { imagen: c.toDataURL('image/jpeg', 0.82), ancho: cw, alto: ch };
  }

  var pickId = null;
  function fotoById(id) { return cur.fotos.find(function (f) { return f.id === id; }); }
  $('#filePick').addEventListener('change', async function (e) {
    var file = e.target.files[0]; e.target.value = '';
    if (!file || !pickId) return;
    var f = fotoById(pickId); if (!f) return;
    toast('Procesando imagen…', 8000);
    try { Object.assign(f, await procesarImagen(file)); touch(); renderFotos(); toast('Imagen insertada'); }
    catch (err) { toast('No se pudo cargar esa imagen'); }
  });
  $('#fileMulti').addEventListener('change', async function (e) {
    var files = Array.prototype.slice.call(e.target.files); e.target.value = '';
    for (var i = 0; i < files.length; i++) {
      toast('Procesando imagen ' + (i + 1) + ' de ' + files.length + '…', 20000);
      try {
        var r = await procesarImagen(files[i]);
        var slot = cur.fotos.find(function (f) { return !usada(f); });
        if (!slot) { slot = blankFoto(); cur.fotos.push(slot); }
        Object.assign(slot, r);
      } catch (err) { toast('Una imagen no se pudo cargar'); }
    }
    touch(); renderFotos(); if (files.length) toast(files.length + (files.length === 1 ? ' imagen insertada' : ' imágenes insertadas'));
  });
  $('#fileJson').addEventListener('change', function (e) { var f = e.target.files[0]; e.target.value = ''; if (f) importarArchivo(f); });

  /* ====================== vistas ====================== */
  var app = $('#app');
  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; if (!cur) renderHome(); });

  function esIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function instalada() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }

  async function renderHome() {
    cur = null; recordatorio();
    var metas = [];
    try { metas = (await store.all('meta')).sort(function (a, b) { return b.actualizado - a.actualizado; }); }
    catch (e) { dbOk = false; metas = []; }
    var ult = +ls('ultimoRespaldo') || 0;
    var sinRespaldo = metas.some(function (m) { return m.actualizado > ult; });
    var items = metas.map(function (m) {
      return '<li class="item"><button class="open" data-act="abrir" data-id="' + m.id + '"><span class="t">' + h(m.titulo) + '</span><span class="m">' +
        (m.subtitulo ? h(m.subtitulo) + ' · ' : '') + m.fotos + (m.fotos === 1 ? ' foto' : ' fotos') + ' · ' + h(fmtFecha(m.actualizado)) + '</span></button>' +
        '<button class="more" data-act="menu" data-id="' + m.id + '" aria-label="Más opciones">' + ICON.dots + '</button></li>';
    }).join('');
    var aviso = '';
    if (!dbOk) aviso += '<div class="banner warn">Este navegador no permite guardar datos locales (¿modo privado?). Lo que escribas se pierde al cerrar: haz un respaldo .json antes de salir.</div>';
    if (metas.length && sinRespaldo) aviso += '<div class="banner warn">' + (ult ? 'Hay cambios posteriores a tu último respaldo (' + h(fmtFecha(ult)) + ').' : 'Aún no has hecho un respaldo .json.') + ' Respalda con frecuencia: es tu copia de seguridad si se borran los datos del navegador.</div>';
    if (fileHandle && !(await permisoArchivo(false))) aviso += '<div class="banner warn">El respaldo automático a archivo está pausado. <button class="btn sm primary" data-act="reactivar-archivo" style="margin-left:8px">Reactivar</button></div>';
    if (!instalada()) {
      if (deferredInstall) aviso += '<div class="banner">Instala la app para usarla como aplicación y sin conexión. <button class="btn sm primary" data-act="instalar" style="margin-left:8px">Instalar</button></div>';
      else if (esIOS()) aviso += '<div class="banner">En iPhone/iPad: toca <strong>Compartir</strong> y luego <strong>«Agregar a pantalla de inicio»</strong>. Así funciona sin conexión y iOS no borra tus datos.</div>';
    }
    app.innerHTML =
      '<header class="top"><h1>Informe Especialista<span class="sub">Registro de intervenciones</span></h1></header>' +
      '<main class="wrap">' + aviso +
      '<div class="row" style="margin-bottom:16px"><button class="btn primary" data-act="nuevo" style="flex:1">' + ICON.plus + 'Nuevo informe</button>' +
      '<button class="btn" data-act="importar">Cargar archivo .json</button></div>' +
      (items ? '<ul class="list">' + items + '</ul>' : '<div class="empty"><p><strong>Aún no hay informes</strong></p><p>Crea uno nuevo o importa un respaldo .json.</p></div>') +
      (metas.length ? '<div class="row" style="margin-top:16px"><button class="btn" data-act="respaldar-todo" style="flex:1">' + ICON.json + 'Respaldar todo (.json)</button></div>' : '') +
      '<div class="row" style="margin-top:10px"><button class="btn" data-act="auto-toggle" style="flex:1">Descarga automática .json: ' + (autoActiva() ? 'Activada' : 'Desactivada') + '</button></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn" data-act="copias" style="flex:1">Copias automáticas</button>' +
      (soportaArchivo ? (fileHandle ? '<button class="btn" data-act="detener-archivo" style="flex:1">Desactivar respaldo en archivo</button>' : '<button class="btn" data-act="elegir-archivo" style="flex:1">Respaldo automático en archivo</button>') : '') + '</div>' +
      '<p class="hint" style="margin-top:12px">Todo se guarda en el dispositivo en cada cambio. Con la descarga automática activada se baja un archivo .json (todos los informes) tras un cambio y luego cada 10 min si hay cambios nuevos, y al volver al inicio. Si el navegador pregunta, permite las descargas múltiples. ' + (soportaArchivo ? 'El respaldo en archivo se reescribe solo tras cada cambio y cada 10 min.' : '') + '</p>' +
      '<p class="foot">' + (navigator.serviceWorker && navigator.serviceWorker.controller ? 'Funciona sin conexión · ' : '') + 'Los datos se guardan solo en este dispositivo.</p></main>';
  }

  function secText(n, title, key, hint) {
    return '<section class="card"><h2><span class="n">' + n + '.</span>' + title + '</h2><textarea data-k="' + key + '" placeholder="' + h(hint) + '" aria-label="' + title + '">' + h(cur[key]) + '</textarea></section>';
  }
  function fotoHTML(f, i, total) {
    return '<article class="foto" data-fid="' + f.id + '"><header><span>Foto ' + (i + 1) + '</span><span class="tools">' +
      '<button class="btn icon sm" data-act="foto-up" aria-label="Subir"' + (i === 0 ? ' disabled' : '') + '>' + ICON.up + '</button>' +
      '<button class="btn icon sm" data-act="foto-down" aria-label="Bajar"' + (i === total - 1 ? ' disabled' : '') + '>' + ICON.down + '</button>' +
      '<button class="btn icon sm danger" data-act="foto-del" aria-label="Eliminar recuadro">' + ICON.trash + '</button></span></header>' +
      '<button class="dropbox' + (f.imagen ? ' has' : '') + '" data-act="foto-pick" aria-label="' + (f.imagen ? 'Cambiar imagen' : 'Insertar imagen') + '">' +
      (f.imagen ? '<img alt="Foto ' + (i + 1) + '" src="' + f.imagen + '">' : ICON.cam + '<span>Insertar imagen</span>') + '</button>' +
      (f.imagen ? '<div class="row"><button class="btn sm" data-act="foto-pick">Cambiar imagen</button><button class="btn sm danger" data-act="foto-clear">Quitar imagen</button></div>' : '') +
      '<label class="f">Descripción:</label><textarea data-foto="comentario" placeholder="Comentario sobre la imagen…">' + h(f.comentario) + '</textarea>' +
      '<label class="f">Condición encontrada:</label><div class="seg" role="group" aria-label="Condición encontrada">' +
      CONDS.map(function (c) { return '<button type="button" class="' + c[0] + (f.condicion === c[0] ? ' on' : '') + '" data-act="cond" data-v="' + c[0] + '" aria-pressed="' + (f.condicion === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>' +
      '<label class="f">Recomendación:</label><textarea data-foto="recomendacion" placeholder="Recomendación para esta condición…">' + h(f.recomendacion) + '</textarea></article>';
  }
  function renderFotos() {
    var box = $('#fotos'); if (!box) return;
    box.innerHTML = cur.fotos.map(function (f, i) { return fotoHTML(f, i, cur.fotos.length); }).join('');
    autosizeAll();
  }

  function renderEditor() {
    var P = cur.portada;
    app.innerHTML =
      '<header class="top"><button class="back" data-act="home" aria-label="Volver al inicio">' + ICON.back + '<span>Inicio</span></button>' +
      '<h1><span id="titulo">' + h(titulo(cur)) + '</span><span class="sub">Informe Especialista</span></h1><span id="status" class="chip ok">Guardado</span></header>' +
      '<main class="wrap">' +
      '<section class="card"><h2>Portada</h2><p class="hint">Estos datos aparecen en la portada del documento.</p>' +
      '<label class="f" for="p0">Servicio (portada y encabezados)</label><textarea id="p0" data-k="portada.servicio" style="min-height:64px">' + h(P.servicio) + '</textarea>' +
      '<label class="f" for="p6">N° de PO (encabezados)</label><input id="p6" type="text" data-k="portada.po" value="' + h(P.po) + '" autocomplete="off">' +
      '<div class="grid2"><div><label class="f" for="p1">Fecha de emisión</label><input id="p1" type="date" data-k="portada.fechaEmision" value="' + h(P.fechaEmision) + '"></div>' +
      '<div><label class="f" for="p5">Fecha</label><input id="p5" type="date" data-k="portada.fecha" value="' + h(P.fecha) + '"></div></div>' +
      '<label class="f" for="p2">Datos del Cliente</label><input id="p2" type="text" data-k="portada.cliente" value="' + h(P.cliente) + '" autocomplete="off">' +
      '<label class="f" for="p3">Datos del Equipo/Componente</label><input id="p3" type="text" data-k="portada.equipo" value="' + h(P.equipo) + '" autocomplete="off">' +
      '<label class="f" for="p4">Especialista/Técnico responsable</label><input id="p4" type="text" data-k="portada.especialista" value="' + h(P.especialista) + '" autocomplete="name">' +
      '<label class="f" for="p7">Cargo</label><input id="p7" type="text" data-k="portada.cargo" value="' + h(P.cargo) + '" autocomplete="organization-title"></section>' +
      secText(1, 'Objetivo', 'objetivo', 'Indique qué actividad se realizó y cuál fue su propósito.') +
      secText(2, 'Alcance', 'alcance', 'Describa los equipos, sistemas o áreas consideradas en la intervención.') +
      secText(3, 'Descripción de actividades / detalle de la intervención', 'descripcion', 'Describa las actividades ejecutadas y los hallazgos observados.') +
      '<section class="card"><h2><span class="n">4.</span>Registro fotográfico</h2>' +
      '<p class="hint">Toca un recuadro para insertar la imagen y escribe su descripción. Los recuadros sin ningún dato no se exportan.</p>' +
      '<textarea data-k="fotosIntro" style="min-height:64px" placeholder="Texto introductorio (opcional)">' + h(cur.fotosIntro) + '</textarea>' +
      '<div id="fotos"></div>' +
      '<div class="row" style="margin-top:14px"><button class="btn" data-act="foto-add" style="flex:1">' + ICON.plus + 'Agregar recuadro</button>' +
      '<button class="btn" data-act="foto-multi" style="flex:1">' + ICON.cam + 'Agregar varias fotos</button></div></section>' +
      secText(5, 'Recomendaciones', 'recomendaciones', 'Indique las acciones sugeridas para corregir o prevenir desviaciones.') +
      secText(6, 'Conclusión', 'conclusion', 'Resuma el resultado general de la evaluación.') +
      secText(7, 'Anexos', 'anexos', 'Toda la evidencia que respalda la intervención realizada y los hallazgos informados.') +
      '<section class="card"><h2>Respaldos</h2><p class="hint">Carga un archivo .json para restaurar informes (se agregan a la lista de inicio).</p><div class="row"><button class="btn" data-act="importar" style="flex:1">Cargar archivo .json</button><button class="btn" data-act="home" style="flex:1">Volver al inicio</button></div></section>' +
      '</main>' +
      '<div class="bar"><div class="in"><button class="btn" data-act="respaldo">' + ICON.json + 'Respaldo .json</button>' +
      '<button class="btn primary" data-act="word">' + ICON.word + 'Exportar Word</button></div></div>';
    renderFotos(); autosizeAll();
    window.scrollTo(0, 0);
  }

  async function abrir(id) {
    var r = await store.get('reports', id);
    if (!r) return toast('No se encontró el informe');
    cur = normalize(r); editorDesde = Date.now(); renderEditor();
  }

  /* ====================== eventos ====================== */
  function autosize(t) { t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight + 2, 0) + 'px'; }
  function autosizeAll() { document.querySelectorAll('textarea').forEach(autosize); }

  function setPath(obj, path, val) {
    var p = path.split('.'), o = obj;
    for (var i = 0; i < p.length - 1; i++) o = o[p[i]];
    o[p[p.length - 1]] = val;
  }

  app.addEventListener('input', function (e) {
    var t = e.target;
    if (!cur) return;
    if (t.tagName === 'TEXTAREA') autosize(t);
    if (t.dataset.k) { setPath(cur, t.dataset.k, t.value); touch(); }
    else if (t.dataset.foto) {
      var fid = t.closest('.foto').dataset.fid, f = fotoById(fid);
      if (f) { f[t.dataset.foto] = t.value; touch(); }
    }
  });

  app.addEventListener('click', async function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.dataset.act;
    var card = el.closest('.foto'), fid = card && card.dataset.fid;

    if (act === 'nuevo') { cur = newReport(); editorDesde = Date.now(); await save(); renderEditor(); }
    else if (act === 'abrir') abrir(el.dataset.id);
    else if (act === 'home') { await save(); autoDescargar(true); renderHome(); }
    else if (act === 'importar') { if (cur) await save(); $('#fileJson').click(); }
    else if (act === 'respaldar-todo') respaldarTodo();
    else if (act === 'instalar') { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; renderHome(); } }
    else if (act === 'menu') menuInforme(el.dataset.id);
    else if (act === 'copias') listaCopias();
    else if (act === 'auto-toggle') { ls('autoDescarga', autoActiva() ? '0' : '1'); renderHome(); }
    else if (act === 'elegir-archivo') elegirArchivo();
    else if (act === 'reactivar-archivo') reactivarArchivo();
    else if (act === 'detener-archivo') detenerArchivo();
    else if (act === 'respaldo') respaldarActual();
    else if (act === 'word') exportarWord();
    else if (act === 'foto-pick') { pickId = fid; $('#filePick').click(); }
    else if (act === 'foto-multi') $('#fileMulti').click();
    else if (act === 'foto-add') { cur.fotos.push(blankFoto()); touch(); renderFotos(); var last = $('#fotos').lastElementChild; if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    else if (act === 'cond') {
      var fc = fotoById(fid), v = el.dataset.v; fc.condicion = fc.condicion === v ? '' : v; touch();
      card.querySelectorAll('.seg button').forEach(function (b) { var on = b.dataset.v === fc.condicion; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    }
    else if (act === 'foto-clear') { var f = fotoById(fid); f.imagen = null; f.ancho = f.alto = 0; touch(); renderFotos(); }
    else if (act === 'foto-up' || act === 'foto-down') {
      var i = cur.fotos.findIndex(function (x) { return x.id === fid; }), j = act === 'foto-up' ? i - 1 : i + 1;
      if (j >= 0 && j < cur.fotos.length) { var tmp = cur.fotos[i]; cur.fotos[i] = cur.fotos[j]; cur.fotos[j] = tmp; touch(); renderFotos(); var n = $('#fotos').children[j]; if (n) n.scrollIntoView({ block: 'center' }); }
    }
    else if (act === 'foto-del') {
      var ff = fotoById(fid), tiene = usada(ff);
      var borrar = function () { cur.fotos = cur.fotos.filter(function (x) { return x.id !== fid; }); touch(); renderFotos(); };
      if (tiene) modal('Eliminar recuadro', '<p>Se eliminarán la imagen y su descripción.</p>', [{ label: 'Eliminar', cls: 'danger', fn: borrar }, { label: 'Cancelar' }]);
      else borrar();
    }
  });

  function menuInforme(id) {
    modal('Informe', '', [
      { label: 'Duplicar', fn: async function () {
        var r = await store.get('reports', id); var c = normalize(r);
        c.id = uid(); c.creado = c.actualizado = Date.now(); c.fotos.forEach(function (f) { f.id = uid(); });
        c.portada.cliente = c.portada.cliente ? c.portada.cliente + ' (copia)' : c.portada.cliente;
        await store.put('reports', c); await store.put('meta', metaOf(c)); renderHome();
      } },
      { label: ICON.json + 'Respaldar este informe (.json)', fn: async function () { var r = await store.get('reports', id); respaldar([r], slug(titulo(normalize(r))) || 'informe'); } },
      { label: 'Eliminar…', cls: 'danger', fn: function () {
        modal('¿Eliminar informe?', '<p>Se borrará de este dispositivo. Si no tienes un respaldo .json, no se podrá recuperar.</p>', [
          { label: 'Eliminar definitivamente', cls: 'danger', fn: async function () { await store.del('reports', id); await store.del('meta', id); renderHome(); } },
          { label: 'Cancelar' }]);
      } },
      { label: 'Cerrar' }
    ]);
  }

  /* ====================== arranque ====================== */
  function mostrarError(e) {
    var msg = (e && (e.message || e.reason && e.reason.message)) || String(e);
    var d = document.getElementById('errorApp');
    if (!d) { d = document.createElement('div'); d.id = 'errorApp'; d.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:99;background:#fff3cd;color:#3b2f00;border:1px solid #e0b100;border-radius:10px;padding:10px 12px;font:13px/1.4 system-ui;'; document.body.appendChild(d); }
    d.textContent = 'Error: ' + msg;
  }
  window.addEventListener('error', function (e) { mostrarError(e.error || e.message); });
  window.addEventListener('unhandledrejection', function (e) { mostrarError(e.reason); });

  window.addEventListener('online', function () { toast('Conexión restablecida'); });
  window.addEventListener('offline', function () { toast('Sin conexión: la app sigue funcionando'); });

  (async function init() {
    try { db = await openDB(); } catch (e) { db = null; }
    dbOk = !!db;
    try { await cargarHandle(); } catch (e) { }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { }
    try { await renderHome(); } catch (e) { mostrarError(e); }
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').then(function () { if (!cur) setTimeout(function () { if (!cur) renderHome(); }, 1500); }).catch(function () { });
    }
  })();
})();
