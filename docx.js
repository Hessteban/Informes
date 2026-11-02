/* Generador de Word: parte de la plantilla original (INFORME_.docx) y solo
   reemplaza el contenido, de modo que portada, encabezados, estilos, índice,
   numeración y saltos de sección quedan idénticos al documento cargado. */
(function (global) {
  'use strict';

  var EMU_CM = 360000;
  // Área útil de la celda de imagen (celda 4995 twips, alto de fila 4290 twips)
  var MAX_W = Math.round(7.6 * EMU_CM);
  var MAX_H = Math.round(7.1 * EMU_CM);

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function fmtFecha(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || '');
  }

  function b64ToBytes(b64) {
    var bin = atob(b64), n = bin.length, out = new Uint8Array(n);
    for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function dataUrlToBytes(u) { return b64ToBytes(u.slice(u.indexOf(',') + 1)); }

  /* ---------- utilidades sobre el XML (por texto, para no alterar namespaces) ---------- */

  function findPara(xml, paraId) {
    var at = xml.indexOf('w14:paraId="' + paraId + '"');
    if (at < 0) throw new Error('Plantilla distinta a la esperada (párrafo ' + paraId + ')');
    var ps = xml.lastIndexOf('<w:p ', at);
    var pe = xml.indexOf('</w:p>', at) + 6;
    return { ps: ps, pe: pe, xml: xml.slice(ps, pe) };
  }

  // Reemplaza un párrafo de la plantilla por uno o más párrafos con el mismo formato.
  function setParaText(xml, paraId, text) {
    var p = findPara(xml, paraId);
    var pPr = (p.xml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
    var rPrM = p.xml.match(/<w:r[ >][\s\S]*?<w:rPr>([\s\S]*?)<\/w:rPr>/);
    var rPr = rPrM ? '<w:rPr>' + rPrM[1] + '</w:rPr>' : '';
    var lines = String(text || '').replace(/\r/g, '').split('\n');
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    var out = '';
    if (!lines.length) {
      out = '<w:p>' + pPr + '</w:p>';
    } else {
      out = lines.map(function (l) {
        return '<w:p>' + pPr + (l.trim() === '' ? '' :
          '<w:r>' + rPr + '<w:t xml:space="preserve">' + esc(l) + '</w:t></w:r>') + '</w:p>';
      }).join('');
    }
    return xml.slice(0, p.ps) + out + xml.slice(p.pe);
  }

  function removePara(xml, paraId) {
    var p = findPara(xml, paraId);
    return xml.slice(0, p.ps) + xml.slice(p.pe);
  }

  // Agrega el valor a la derecha de una etiqueta de portada (misma fuente, sin negrita).
  function addCoverValue(xml, label, value) {
    if (!value) return xml;
    var re = new RegExp('<w:t(?: xml:space="preserve")?>' + label + '</w:t></w:r>');
    var m = re.exec(xml);
    if (!m) throw new Error('Plantilla distinta a la esperada (' + label + ')');
    var runStart = xml.lastIndexOf('<w:r ', m.index);
    var run = xml.slice(runStart, m.index + m[0].length);
    var rPrM = run.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
    var rPr = rPrM ? rPrM[1].replace(/<w:b\/>|<w:bCs\/>/g, '') : '';
    var add = '<w:r><w:rPr>' + rPr + '</w:rPr><w:t xml:space="preserve">' +
      (/\s$/.test(label) ? '' : ' ') + esc(value) + '</w:t></w:r>';
    var end = m.index + m[0].length;
    return xml.slice(0, end) + add + xml.slice(end);
  }

  /* ---------- tabla del registro fotográfico ---------- */

  var CELL_RPR_FONTS = '<w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>';

  function pictureRun(rId, n, cx, cy) {
    return '<w:r><w:rPr>' + CELL_RPR_FONTS + '<w:noProof/></w:rPr><w:drawing>' +
      '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
      '<wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
      '<wp:docPr id="' + (1000 + n) + '" name="Foto ' + n + '"/>' +
      '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
      '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
      '<pic:nvPicPr><pic:cNvPr id="' + (1000 + n) + '" name="foto' + n + '.jpg"/><pic:cNvPicPr/></pic:nvPicPr>' +
      '<pic:blipFill><a:blip r:embed="' + rId + '"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
      '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
      '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
      '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
  }

  function photoRow(foto, n, rId) {
    var imgPPr = '<w:pPr><w:pStyle w:val="Textoindependiente"/><w:ind w:right="272"/><w:jc w:val="center"/>' +
      '<w:rPr>' + CELL_RPR_FONTS + '<w:b/></w:rPr></w:pPr>';
    var imgContent;
    if (foto.imagen && rId) {
      var w = foto.ancho || 4, h = foto.alto || 3;
      var k = Math.min(MAX_W / w, MAX_H / h);
      imgContent = pictureRun(rId, n, Math.round(w * k), Math.round(h * k));
    } else {
      imgContent = '<w:r><w:rPr>' + CELL_RPR_FONTS + '<w:b/><w:color w:val="BFBFBF" w:themeColor="background1" w:themeShade="BF"/></w:rPr>' +
        '<w:t>Insertar imagen</w:t></w:r>';
    }
    var descPPr = '<w:pPr><w:pStyle w:val="Textoindependiente"/><w:ind w:right="272"/>' +
      '<w:rPr>' + CELL_RPR_FONTS + '<w:bCs/></w:rPr></w:pPr>';
    var descRPr = '<w:rPr>' + CELL_RPR_FONTS + '<w:bCs/></w:rPr>';
    var desc = '<w:p>' + descPPr + '<w:r>' + descRPr + '<w:t>Descripción:</w:t></w:r></w:p>';
    var lines = String(foto.comentario || '').replace(/\r/g, '').split('\n');
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    lines.forEach(function (l) {
      desc += '<w:p>' + descPPr + (l.trim() === '' ? '' :
        '<w:r>' + descRPr + '<w:t xml:space="preserve">' + esc(l) + '</w:t></w:r>') + '</w:p>';
    });
    var keep = function (x) { return x.replace('<w:pStyle w:val="Textoindependiente"/>', '<w:pStyle w:val="Textoindependiente"/><w:keepNext/>'); };
    var row1 = '<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="4290"/></w:trPr>' +
      '<w:tc><w:tcPr><w:tcW w:w="4995" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p>' + keep(imgPPr) + imgContent + '</w:p></w:tc>' +
      '<w:tc><w:tcPr><w:tcW w:w="4995" w:type="dxa"/></w:tcPr>' + keep(desc) + '</w:tc></w:tr>';

    // Fila de condición (ancho completo): ☐ Crítica  ☐ Relevante  ☐ No crítica
    var SYM = '<w:rFonts w:ascii="MS Gothic" w:eastAsia="MS Gothic" w:hAnsi="MS Gothic" w:hint="eastAsia"/>';
    var cp = '<w:p>' + keep(descPPr) + '<w:r>' + descRPr + '<w:t xml:space="preserve">Condición encontrada:      </w:t></w:r>';
    [['critica', 'Crítica'], ['relevante', 'Relevante'], ['no_critica', 'No crítica']].forEach(function (c) {
      var on = foto.condicion === c[0];
      cp += '<w:r><w:rPr>' + SYM + '</w:rPr><w:t>' + (on ? '\u2612' : '\u2610') + '</w:t></w:r>' +
        '<w:r><w:rPr>' + CELL_RPR_FONTS + (on ? '<w:b/>' : '<w:bCs/>') + '</w:rPr><w:t xml:space="preserve"> ' + c[1] + '        </w:t></w:r>';
    });
    cp += '</w:p>';
    var row2 = '<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="500"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="9990" w:type="dxa"/><w:gridSpan w:val="2"/><w:vAlign w:val="center"/></w:tcPr>' + cp + '</w:tc></w:tr>';

    // Fila de recomendación (ancho completo)
    var rec = '<w:p>' + descPPr + '<w:r>' + descRPr + '<w:t>Recomendación:</w:t></w:r></w:p>';
    var rl = String(foto.recomendacion || '').replace(/\r/g, '').split('\n');
    while (rl.length && rl[rl.length - 1].trim() === '') rl.pop();
    rl.forEach(function (l) {
      rec += '<w:p>' + descPPr + (l.trim() === '' ? '' : '<w:r>' + descRPr + '<w:t xml:space="preserve">' + esc(l) + '</w:t></w:r>') + '</w:p>';
    });
    var row3 = '<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="1200"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="9990" w:type="dxa"/><w:gridSpan w:val="2"/></w:tcPr>' + rec + '</w:tc></w:tr>';
    return row1 + row2 + row3;
  }


  /* ---------- estimación de páginas (para que el índice salga bien aun sin actualizar campos) ---------- */
  var LAY = {
    cplBody: 92, lineBody: 440,        // texto de secciones 1-3 (12 pt, interlineado 1,5)
    cplTail: 92, lineTail: 300,        // texto de secciones 5-7 (12 pt, interlineado simple)
    pageH: 13350,                      // alto útil por página
    head: 700,                         // título de sección + espacios
    regHead: 1500,                     // título 4 + texto previo + espacios
    rowCond: 520, rowRecMin: 1200, rowImg: 4290, cellLine: 270, cplDesc: 45, cplRec: 95,
    tailGap: 1100                      // título + espacios de cada sección final
  };
  function nLines(text, cpl) {
    var ls = String(text || '').replace(/\r/g, '').split('\n'), n = 0;
    ls.forEach(function (l) { n += Math.max(1, Math.ceil(l.length / cpl)); });
    return n;
  }
  function estimarPaginas(rep) {
    var L = LAY, pg = [];
    // Sección 2 (desde la pág. 3): Objetivo y Alcance
    var lpp = Math.floor(L.pageH / L.lineBody);
    var usedObj = L.head + nLines(rep.objetivo, L.cplBody) * L.lineBody;
    pg[0] = 3;
    var totalAl = usedObj + L.head + nLines(rep.alcance, L.cplBody) * L.lineBody;
    pg[1] = 3 + Math.floor(usedObj / L.pageH);
    var pagesSec2 = Math.max(1, Math.ceil(totalAl / L.pageH));
    // Sección 3: Descripción (página nueva)
    pg[2] = 3 + pagesSec2;
    var descH = L.head + nLines(rep.descripcion, L.cplBody) * L.lineBody + 4 * 240;
    var pagesDesc = Math.max(1, Math.ceil(descH / L.pageH));
    // Sección 4: Registro fotográfico (página nueva)
    pg[3] = pg[2] + pagesDesc;
    var page = pg[3], y = L.regHead + (rep.fotosIntro ? nLines(rep.fotosIntro, L.cplTail) * L.lineTail : 0);
    var fotos = (rep.fotos || []).filter(function (f) { return f.imagen || (f.comentario && f.comentario.trim()) || f.condicion || (f.recomendacion && f.recomendacion.trim()); });
    if (!fotos.length) fotos = [{}];
    fotos.forEach(function (f) {
      var r1 = Math.max(L.rowImg, (1 + nLines(f.comentario, L.cplDesc)) * L.cellLine + 120);
      var r3 = Math.max(L.rowRecMin, (1 + nLines(f.recomendacion, L.cplRec)) * L.cellLine + 120);
      var hb = r1 + L.rowCond + r3;
      if (y + hb > L.pageH) { page++; y = 0; }
      y += hb;
    });
    y += 3 * 300; // párrafos vacíos tras la tabla
    function colocar(texto) {
      var h = L.tailGap + nLines(texto, L.cplTail) * L.lineTail;
      if (y + Math.min(h, L.tailGap + 2 * L.lineTail) > L.pageH) { page++; y = 0; }
      var at = page; y += h;
      while (y > L.pageH) { page++; y -= L.pageH; }
      return at;
    }
    pg[4] = colocar(rep.recomendaciones);
    pg[5] = colocar(rep.conclusion);
    pg[6] = colocar(rep.anexos);
    return pg;
  }

  /* ---------- principal ---------- */

  /**
   * @param {object} rep  informe (ver app.js)
   * @param {string} templateB64  plantilla .docx en base64
   * @param {object} opts { actualizarIndice: boolean }
   * @returns {Promise<Blob>}
   */
  async function buildDocx(rep, templateB64, opts) {
    opts = opts || {};
    var zip = await global.JSZip.loadAsync(b64ToBytes(templateB64));
    var xml = await zip.file('word/document.xml').async('string');
    var rels = await zip.file('word/_rels/document.xml.rels').async('string');
    var P = rep.portada || {};

    // Portada
    // Nueva línea "Cargo:" entre el especialista y la fecha (copia el formato de la línea del especialista)
    var esp = findPara(xml, '788BC89E');
    var cargoP = esp.xml.replace('w14:paraId="788BC89E"', 'w14:paraId="788BC89F"').replace('Especialista/Técnico responsable: ', 'Cargo: ');
    xml = xml.slice(0, esp.pe) + cargoP + xml.slice(esp.pe);
    xml = addCoverValue(xml, 'Fecha de emisión:', fmtFecha(P.fechaEmision));
    xml = addCoverValue(xml, 'Datos del Cliente: ', P.cliente);
    xml = addCoverValue(xml, 'Datos del Equipo/Componente: ', P.equipo);
    xml = addCoverValue(xml, 'Especialista/Técnico responsable: ', P.especialista);
    xml = addCoverValue(xml, 'Fecha:', fmtFecha(P.fecha));
    xml = addCoverValue(xml, 'Cargo: ', String(P.cargo || '').trim());


    // Servicio (portada y encabezados). Si no se cambia, los encabezados quedan intactos.
    var SERV0 = 'Ingeniería E Inspección para Habilitación Del Puente Apilador CV-013, BHP SPENCE';
    var PO0 = '4518931042';
    var serv = String(P.servicio == null ? SERV0 : P.servicio).replace(/\s*\n\s*/g, ' ').trim();
    var po = String(P.po == null ? PO0 : P.po).trim();
    xml = setParaText(xml, '37B6FA34', 'Servicio: ' + String(P.servicio == null ? SERV0 : P.servicio).replace(/\r/g, '').trim());

    // Secciones de texto (se identifican por el id del párrafo de ejemplo de la plantilla)
    xml = setParaText(xml, '2464F165', rep.objetivo);        // 1. Objetivo
    xml = setParaText(xml, '727D0BD1', rep.alcance);         // 2. Alcance
    xml = setParaText(xml, '33C9DCF2', '');                  //    (punto suelto de la plantilla)
    xml = setParaText(xml, '38D56485', rep.descripcion);     // 3. Descripción
    xml = setParaText(xml, '00FA8475', rep.fotosIntro);      // 4. Texto previo a las fotos
    xml = setParaText(xml, '1C662ACC', rep.recomendaciones); // 5. Recomendaciones
    xml = setParaText(xml, '6211AD54', rep.conclusion);      // 6. Conclusión
    xml = removePara(xml, '0E0C4D91');                       // 7. Anexos: "¿Qué debe incluir?"
    xml = setParaText(xml, '55557732', rep.anexos);          //    Anexos: texto

    // Registro fotográfico: solo filas con imagen o comentario
    var fotos = (rep.fotos || []).filter(function (f) { return f.imagen || (f.comentario && f.comentario.trim()) || f.condicion || (f.recomendacion && f.recomendacion.trim()); });
    var rows = '', relXml = '', n = 0;
    for (var i = 0; i < fotos.length; i++) {
      n++;
      var f = fotos[i], rId = null;
      if (f.imagen) {
        rId = 'rIdFoto' + n;
        zip.file('word/media/foto' + n + '.jpg', dataUrlToBytes(f.imagen));
        relXml += '<Relationship Id="' + rId + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/foto' + n + '.jpg"/>';
      }
      rows += photoRow(f, n, rId);
    }
    if (!rows) rows = photoRow({ imagen: null, comentario: '' }, 1, null);

    // Firma al pie de la última página, centrada, con el nombre del especialista
    var FR = '<w:framePr w:w="5200" w:hSpace="0" w:wrap="notBeside" w:vAnchor="page" w:hAnchor="page" w:xAlign="center" w:y="12500"/>';
    var SF = '<w:rFonts w:asciiTheme="minorHAnsi" w:hAnsiTheme="minorHAnsi" w:cstheme="minorHAnsi"/>';
    var nombre = String(P.especialista || '').trim();
    var cargoFirma = String(P.cargo || '').trim();
    var firma =
      '<w:p><w:pPr>' + FR + '<w:spacing w:before="0" w:after="0" w:line="1500" w:lineRule="exact"/><w:jc w:val="center"/></w:pPr></w:p>' +
      '<w:p><w:pPr>' + FR + '<w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr>' + SF + '<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>______________________________________</w:t></w:r></w:p>' +
      '<w:p><w:pPr>' + FR + '<w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>' +
      (nombre ? '<w:r><w:rPr>' + SF + '<w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">' + esc(nombre) + '</w:t></w:r>' : '') + '</w:p>' +
      (cargoFirma ? '<w:p><w:pPr>' + FR + '<w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr>' + SF + '<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">' + esc(cargoFirma) + '</w:t></w:r></w:p>' : '');
    var fin = xml.lastIndexOf('<w:sectPr');
    xml = xml.slice(0, fin) + firma + xml.slice(fin);

    var ts = xml.indexOf('<w:tbl>'), te = xml.indexOf('</w:tbl>') + 8;
    if (ts < 0) throw new Error('Plantilla distinta a la esperada (tabla)');
    var tbl = xml.slice(ts, te);
    var head = tbl.slice(0, tbl.indexOf('<w:tr '));
    xml = xml.slice(0, ts) + head + rows + '</w:tbl>' + xml.slice(te);

    // Numeración de páginas: el pie va en todas las páginas salvo la portada (que no tiene pie).
    // La plantilla reiniciaba la numeración en la sección de "Descripción"; se quita para que sea continua.
    xml = xml.replace(/(<w:sectPr w:rsidR="009B34FB"[\s\S]*?)<w:pgNumType w:start="2"\/>/, '$1');
    var ft = await zip.file('word/footer1.xml').async('string');
    var numP = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="right"/></w:pPr>' +
      '<w:r><w:rPr>' + CELL_RPR_FONTS + '<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:rPr>' + CELL_RPR_FONTS + '<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
      '<w:r><w:rPr>' + CELL_RPR_FONTS + '<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>' +
      '<w:r><w:rPr>' + CELL_RPR_FONTS + '<w:noProof/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>2</w:t></w:r>' +
      '<w:r><w:rPr>' + CELL_RPR_FONTS + '<w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p>';
    ft = ft.replace(/<w:p [\s\S]*<\/w:p>(?=<\/w:ftr>)/, numP);
    zip.file('word/footer1.xml', ft);

    rels = rels.replace('</Relationships>', relXml + '</Relationships>');
    zip.file('word/document.xml', xml);
    zip.file('word/_rels/document.xml.rels', rels);

    // Índice: números de página estimados (Word los recalcula con exactitud si se actualizan los campos)
    var pgs = estimarPaginas(rep);
    ['0038E233', '214A69D7', '3ECB1022', '0F36C4F7', '432EFEB0', '7CED804C', '3E5FE60F'].forEach(function (id, i) {
      var q = findPara(xml, id), idx = q.xml.lastIndexOf('<w:t>');
      var m = /<w:t>\d+<\/w:t>/g, last = null, mm;
      while ((mm = m.exec(q.xml))) last = mm;
      if (!last) return;
      var nuevo = q.xml.slice(0, last.index) + '<w:t>' + pgs[i] + '</w:t>' + q.xml.slice(last.index + last[0].length);
      xml = xml.slice(0, q.ps) + nuevo + xml.slice(q.pe);
    });
    zip.file('word/document.xml', xml);

    // Encabezados: solo si el usuario cambió el servicio o el N° de PO
    if (serv !== SERV0) {
      var h1 = await zip.file('word/header1.xml').async('string');
      h1 = h1.replace('Servicio: Ingeniería e Inspección para Habilitación del Puente Apilador CV-013', 'Servicio: ' + esc(serv));
      zip.file('word/header1.xml', h1);
    }
    if (serv !== SERV0 || po !== PO0) {
      var h2 = await zip.file('word/header2.xml').async('string');
      if (serv !== SERV0) {
        h2 = h2.replace('<w:t>Ingeniería e Inspección para Habilitación del Puent</w:t>', '<w:t xml:space="preserve">' + esc(serv) + '</w:t>')
               .replace('<w:t>e</w:t>', '<w:t></w:t>')
               .replace(' Apilador CV-013, BHP SPENCE', '');
      }
      if (po !== PO0) h2 = h2.replace('PO N°' + PO0, 'PO N°' + esc(po));
      zip.file('word/header2.xml', h2);
    }

    // El índice se actualiza al abrir (Word pregunta una vez)
    if (opts.actualizarIndice !== false) {
      var st = await zip.file('word/settings.xml').async('string');
      if (st.indexOf('w:updateFields') < 0) {
        st = st.replace('<w:hdrShapeDefaults>', '<w:updateFields w:val="true"/><w:hdrShapeDefaults>');
        zip.file('word/settings.xml', st);
      }
    }

    return zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  }

  global.buildDocx = buildDocx;
  global.estimarPaginas = estimarPaginas;
})(typeof window !== 'undefined' ? window : globalThis);
