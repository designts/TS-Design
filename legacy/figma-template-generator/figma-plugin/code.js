// TechStalwarts Case Study Generator — Figma plugin (main thread)
// -----------------------------------------------------------------------------
// Responsibilities
//   * SYNC: read the approved master templates, verify every mapped node still
//     exists, report structure + thumbnails back to the app. Read-only.
//   * GENERATE: duplicate the master frames onto the "Generated Case Studies"
//     page, populate the duplicate from the compiled operation list, export
//     PNG/PDF previews. Master templates are never modified: every operation is
//     resolved through a master→clone ID map and fails if the target is not part
//     of the clone.
// Network access lives in ui.html (the iframe); this file only talks to Figma.
// -----------------------------------------------------------------------------

var GENERATED_PAGE_NAME = 'Generated Case Studies';
var PLUGIN_DATA_FLAG = 'tsCaseStudyGenerated';

// ---------- engine (also exercised directly through figma-console during development) ----------
var Engine = (function () {
  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    return { r: parseInt(h.slice(0, 2), 16) / 255, g: parseInt(h.slice(2, 4), 16) / 255, b: parseInt(h.slice(4, 6), 16) / 255 };
  }

  async function loadFontsIn(node) {
    var texts = node.type === 'TEXT' ? [node] : ('findAll' in node ? node.findAll(function (n) { return n.type === 'TEXT'; }) : []);
    var seen = {};
    var jobs = [];
    texts.forEach(function (t) {
      if (t.characters.length === 0) { jobs.push(figma.loadFontAsync(t.fontName)); return; }
      t.getRangeAllFontNames(0, t.characters.length).forEach(function (f) {
        var k = f.family + '|' + f.style;
        if (!seen[k]) { seen[k] = 1; jobs.push(figma.loadFontAsync(f)); }
      });
    });
    await Promise.all(jobs);
  }

  // Replace all characters while keeping the style of the first character
  // (avoids inheriting e.g. a red trailing period).
  async function setText(node, value) {
    if (node.type !== 'TEXT') throw new Error('Layer "' + node.name + '" (' + node.id + ') is not a text layer');
    await loadFontsIn(node);
    var len = node.characters.length;
    if (len === 0) { node.characters = value; return; }
    if (value === '') { node.deleteCharacters(0, len); return; }
    node.insertCharacters(1, value, 'BEFORE');
    node.deleteCharacters(1 + value.length, len + value.length);
    node.deleteCharacters(0, 1);
  }

  // Replace a placeholder token inside mixed-style text, keeping the token's own style.
  async function replaceToken(node, token, value) {
    await loadFontsIn(node);
    var idx = node.characters.indexOf(token);
    if (idx < 0) return false;
    if (value === '') { node.deleteCharacters(idx, idx + token.length); return true; }
    node.insertCharacters(idx + 1, value, 'BEFORE');
    node.deleteCharacters(idx + 1 + value.length, idx + value.length + token.length);
    node.deleteCharacters(idx, idx + 1);
    return true;
  }

  // Parallel walk of master and clone → { masterId: cloneNode }
  function buildIdMap(master, clone, map) {
    map[master.id] = clone;
    if ('children' in master && 'children' in clone) {
      var n = Math.min(master.children.length, clone.children.length);
      for (var i = 0; i < n; i++) buildIdMap(master.children[i], clone.children[i], map);
    }
    return map;
  }

  function relPath(ancestor, desc) {
    var path = [];
    var cur = desc;
    while (cur && cur !== ancestor) {
      path.unshift(cur.parent.children.indexOf(cur));
      cur = cur.parent;
    }
    if (!cur) throw new Error('Node ' + desc.id + ' is not inside ' + ancestor.id);
    return path;
  }
  function atPath(root, path) {
    var cur = root;
    path.forEach(function (i) { cur = cur.children[i]; });
    return cur;
  }

  function collapseEmpty(node, stop) {
    var cur = node.parent;
    while (cur && cur !== stop && 'children' in cur) {
      if (cur.children.every(function (c) { return !c.visible; })) { cur.visible = false; cur = cur.parent; }
      else break;
    }
  }

  async function imageFrom(bytes) {
    if (!bytes) throw new Error('Image bytes missing');
    return figma.createImage(bytes);
  }

  async function applyImage(node, bytes, scaleMode) {
    var img = await imageFrom(bytes);
    var fills = (node.fills || []).slice();
    var replaced = false;
    fills = fills.map(function (f) {
      if (f.type !== 'IMAGE') return f;
      replaced = true;
      return { type: 'IMAGE', imageHash: img.hash, scaleMode: scaleMode, visible: true, opacity: f.opacity === undefined ? 1 : f.opacity };
    });
    if (!replaced) fills = [{ type: 'IMAGE', imageHash: img.hash, scaleMode: scaleMode }];
    node.fills = fills;
  }

  var handlers = {
    text: async function (op, R) { var n = R(op.node); n.visible = true; await setText(n, op.value); },
    hide: async function (op, R) { R(op.node).visible = false; },
    tokens: async function (op, R, ctx) {
      var n = R(op.node);
      for (var i = 0; i < op.replacements.length; i++) {
        var ok = await replaceToken(n, op.replacements[i][0], op.replacements[i][1]);
        if (!ok) ctx.warnings.push('Placeholder "' + op.replacements[i][0] + '" not found in "' + n.name + '" — template text may have changed');
      }
    },
    props: async function (op, R) { var n = R(op.node); await loadFontsIn(n); n.setProperties(op.props); },
    image: async function (op, R, ctx) { await applyImage(R(op.node), ctx.assets[op.asset], op.scaleMode); },
    fill: async function (op, R) {
      var n = R(op.node);
      var fills = n.fills.slice();
      var idx = fills.findIndex(function (f) { return f.type === 'SOLID'; });
      var solid = { type: 'SOLID', color: hexToRgb(op.color), opacity: 1 };
      if (idx >= 0) { solid.opacity = fills[idx].opacity === undefined ? 1 : fills[idx].opacity; fills[idx] = solid; } else fills.unshift(solid);
      n.fills = fills;
    },
    slots: async function (op, R) {
      var stop = op.collapseUpTo ? R(op.collapseUpTo) : null;
      // First reveal everything, then hide unused, then collapse empty parents.
      for (var i = 0; i < op.slots.length; i++) R(op.slots[i].hide).visible = true;
      for (i = 0; i < op.slots.length; i++) {
        var s = op.slots[i], v = op.values[i];
        if (v === null) R(s.hide).visible = false;
        else await setText(R(s.text), v);
      }
      if (stop) for (i = 0; i < op.slots.length; i++) if (op.values[i] === null) collapseEmpty(R(op.slots[i].hide), stop);
    },
    chips: async function (op, R) {
      var container = R(op.container);
      var nodes = op.slots.map(function (s) { return R(s.node); });
      var lastSlot = op.slots[op.slots.length - 1];
      var lastNode = nodes[nodes.length - 1];
      var textPath = lastSlot.text ? relPath(lastNode, R(lastSlot.text)) : null;
      for (var i = 0; i < op.values.length; i++) {
        var node, v = op.values[i];
        if (i < nodes.length) node = nodes[i];
        else {
          // More items than the template shows: duplicate the last chip (same style).
          node = lastNode.clone();
          container.insertChild(container.children.indexOf(lastNode) + (i - nodes.length) + 1, node);
        }
        node.visible = true;
        if (lastSlot.prop) {
          await loadFontsIn(node);
          var p = {}; p[lastSlot.prop] = v;
          node.setProperties(p);
          node.name = 'Tag / ' + v;
        } else {
          await setText(atPath(node, textPath), v);
        }
      }
      for (i = op.values.length; i < nodes.length; i++) nodes[i].visible = false;
    },
    cards: async function (op, R) {
      for (var i = 0; i < op.slots.length; i++) {
        var card = R(op.slots[i].node), item = op.items[i];
        if (!item) { card.visible = false; continue; }
        card.visible = true;
        await loadFontsIn(card);
        card.setProperties(item.props);
        if (op.slots[i].source) R(op.slots[i].source).visible = !item.hideSource;
      }
    },
    logos: async function (op, R, ctx) {
      var row = R(op.container);
      var styleNode = op.textStyleFrom ? R(op.textStyleFrom) : null;
      row.children.slice().forEach(function (c) { c.remove(); }); // previous client's logos (clone only)
      for (var i = 0; i < op.items.length; i++) {
        var it = op.items[i];
        if (it.asset) {
          var img = await imageFrom(ctx.assets[it.asset]);
          var size = await img.getSizeAsync();
          var h = op.height || 36;
          var w = Math.min(Math.max(h * size.width / size.height, 12), h * 4.5);
          var rect = figma.createRectangle();
          rect.name = it.name;
          rect.resize(w, h);
          rect.fills = [{ type: 'IMAGE', imageHash: img.hash, scaleMode: 'FIT' }];
          row.appendChild(rect);
        } else {
          var t = figma.createText();
          var font = styleNode ? styleNode.fontName : { family: 'Lato', style: 'Bold' };
          await figma.loadFontAsync(font);
          t.fontName = font;
          t.fontSize = styleNode ? Math.round(styleNode.fontSize * 0.68) : 18;
          if (styleNode) t.fills = styleNode.fills;
          t.characters = it.name;
          t.name = it.name;
          row.appendChild(t);
        }
      }
    },
    stackedBar: async function (op, R) {
      var bars = R(op.bars), proto = R(op.barPrototype);
      var original = bars.children.slice();
      var markerProtos = {};
      Object.keys(op.markerNodes).forEach(function (k) { markerProtos[k] = R(op.markerNodes[k]); });
      var protoW = proto.width;
      var avail = bars.width - bars.paddingLeft - bars.paddingRight;
      var n = op.months.length;
      var barW = n * protoW > avail ? Math.floor(avail / n) - 4 : protoW;

      for (var i = 0; i < n; i++) {
        var m = op.months[i];
        var b = proto.clone();
        bars.appendChild(b);
        b.name = 'Bar / ' + m.label;
        var total = b.findChild(function (c) { return c.name === 'Total'; });
        var month = b.findChild(function (c) { return c.name === 'Month'; });
        var stack = b.findChild(function (c) { return c.name === 'Stack'; });
        await setText(total, String(m.total));
        await setText(month, m.label);
        if (barW !== protoW) {
          b.resize(barW, b.height);
          var sw = Math.min(stack.width, barW - 16);
          stack.resize(sw, stack.height);
          stack.children.forEach(function (r) { r.resize(sw, r.height); });
        }
        for (var j = 0; j < stack.children.length && j < m.values.length; j++) {
          var r = stack.children[j], v = m.values[j];
          r.name = m.seriesNames[j] + ' · ' + v;
          if (v <= 0) { r.visible = false; continue; }
          r.visible = true;
          r.resize(r.width, Math.max(1, v * op.pxPerUnit));
        }
        if (m.total === 0) total.visible = false;
      }
      var newBars = bars.children.slice(original.length);
      for (i = 0; i < op.markers.length; i++) {
        var mk = op.markers[i];
        var mnode = markerProtos[mk.kind].clone();
        var txt = mnode.findOne(function (c) { return c.type === 'TEXT'; });
        await setText(txt, mk.text);
        newBars[mk.index].insertChild(0, mnode);
      }
      for (i = 0; i < op.yLabels.length; i++) await setText(R(op.yLabels[i]), op.yValues[i]);
      original.forEach(function (c) { c.remove(); });
    },
  };

  async function getGeneratedPage() {
    // The page list is always available; only load the one page we write to
    // (loadAllPagesAsync on a large file is slow enough to stall the plugin).
    var page = figma.root.children.find(function (p) { return p.name === GENERATED_PAGE_NAME; });
    if (!page) { page = figma.createPage(); page.name = GENERATED_PAGE_NAME; }
    await page.loadAsync();
    return page;
  }

  async function removePrevious(page, sectionId) {
    if (!sectionId) return false;
    var prev = await figma.getNodeByIdAsync(sectionId);
    // Safety: only delete our own generated sections on the generated page.
    if (prev && prev.type === 'SECTION' && prev.parent === page && prev.getPluginData(PLUGIN_DATA_FLAG) === '1') { prev.remove(); return true; }
    return false;
  }

  async function generate(job, assets) {
    var warnings = [];
    var tpl = job.template;
    if (figma.fileKey && tpl.figma.fileKey && figma.fileKey !== tpl.figma.fileKey) {
      throw new Error('This Figma file (' + figma.fileKey + ') is not the template file (' + tpl.figma.fileKey + '). Open "' + tpl.figma.fileName + '".');
    }
    var masters = [];
    for (var i = 0; i < tpl.figma.frames.length; i++) {
      var f = await figma.getNodeByIdAsync(tpl.figma.frames[i].id);
      if (!f) throw new Error('Master frame ' + tpl.figma.frames[i].id + ' ("' + tpl.figma.frames[i].name + '") not found. Re-sync the template.');
      masters.push(f);
    }

    var page = await getGeneratedPage();
    var removed = await removePrevious(page, job.previousSectionId);

    var section = figma.createSection();
    page.appendChild(section);
    section.name = job.sectionName;
    section.setPluginData(PLUGIN_DATA_FLAG, '1');
    section.setPluginData('caseStudyId', job.caseStudyId);
    section.setPluginData('version', String(job.version));
    var bottom = 0;
    page.children.forEach(function (c) { if (c !== section) bottom = Math.max(bottom, c.y + c.height); });
    section.x = 0; section.y = page.children.length > 1 ? bottom + 200 : 0;

    var pad = 120, gap = 120, x = pad, maxH = 0;
    var idMap = {};
    var clones = [];
    for (i = 0; i < masters.length; i++) {
      var clone = masters[i].clone();
      section.appendChild(clone);
      clone.x = x; clone.y = pad;
      clone.name = masters[i].name + ' — ' + job.title;
      x += clone.width + gap; maxH = Math.max(maxH, clone.height);
      buildIdMap(masters[i], clone, idMap);
      clones.push({ masterId: masters[i].id, node: clone });
    }
    section.resizeWithoutConstraints(x - gap + pad, maxH + pad * 2);

    // Load every font used by the copies in one parallel batch (first loads can be slow).
    await Promise.all(clones.map(function (c) { return loadFontsIn(c.node); }));

    function R(id) {
      var n = idMap[id];
      if (!n) throw new Error('Mapped layer ' + id + ' is not part of the template copy. The template structure has changed — re-sync and review mappings.');
      return n;
    }

    var ctx = { assets: assets || {}, warnings: warnings };
    for (i = 0; i < job.ops.length; i++) {
      var op = job.ops[i];
      try { await handlers[op.op](op, R, ctx); }
      catch (e) { throw new Error('Binding "' + (op.binding || op.op) + '": ' + (e && e.message ? e.message : e)); }
    }

    var exports = [];
    if (job.export !== false) {
      for (i = 0; i < clones.length; i++) {
        var node = clones[i].node;
        var scale = node.width <= 1400 ? 2 : 1;
        var png = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } });
        var pdf = await node.exportAsync({ format: 'PDF' });
        exports.push({ masterId: clones[i].masterId, nodeId: node.id, name: node.name, png: png, pdf: pdf });
      }
    }
    return {
      fileKey: figma.fileKey || tpl.figma.fileKey,
      pageId: page.id,
      sectionId: section.id,
      frames: clones.map(function (c) { return { masterId: c.masterId, nodeId: c.node.id, name: c.node.name }; }),
      removedPrevious: removed,
      warnings: warnings,
      exports: exports,
    };
  }

  async function sync(tpl) {
    var report = { templateId: tpl.id, fileKey: figma.fileKey || null, fileName: figma.root.name, checkedAt: new Date().toISOString(), frames: [], nodes: {}, thumbnails: [] };
    if (figma.fileKey && tpl.figma.fileKey && figma.fileKey !== tpl.figma.fileKey) report.fileMismatch = true;
    var section = await figma.getNodeByIdAsync(tpl.figma.sectionId);
    report.section = section ? { id: section.id, name: section.name, type: section.type, page: findPage(section) } : null;
    for (var i = 0; i < tpl.figma.frames.length; i++) {
      var fr = await figma.getNodeByIdAsync(tpl.figma.frames[i].id);
      report.frames.push(fr ? { id: fr.id, name: fr.name, exists: true, width: fr.width, height: fr.height, layerCount: fr.findAll(function () { return true; }).length } : { id: tpl.figma.frames[i].id, exists: false });
      if (fr) {
        var thumb = await fr.exportAsync({ format: 'PNG', constraint: { type: 'WIDTH', value: 640 } });
        report.thumbnails.push({ frameId: fr.id, png: thumb });
      }
    }
    for (i = 0; i < tpl.nodeIds.length; i++) {
      var id = tpl.nodeIds[i];
      var n = await figma.getNodeByIdAsync(id);
      var inside = id === tpl.figma.sectionId || tpl.figma.frames.some(function (f) { return isInside(n, f.id); });
      report.nodes[id] = n ? { exists: true, name: n.name, type: n.type, text: n.type === 'TEXT' ? n.characters.slice(0, 120) : undefined, insideTemplate: inside } : { exists: false };
    }
    return report;
  }

  function isInside(node, ancestorId) {
    var cur = node;
    while (cur) { if (cur.id === ancestorId) return true; cur = cur.parent; }
    return false;
  }
  function findPage(node) { var c = node; while (c && c.type !== 'PAGE') c = c.parent; return c ? c.name : null; }

  return { generate: generate, sync: sync, handlers: handlers, buildIdMap: buildIdMap };
})();

// ---------- plugin wiring (skipped when the engine is evaluated outside the plugin) ----------
if (typeof __html__ !== 'undefined') {
  figma.showUI(__html__, { width: 440, height: 620, themeColors: true });

  figma.ui.onmessage = async function (msg) {
    try {
      if (msg.type === 'load-settings') {
        var s = await figma.clientStorage.getAsync('settings');
        figma.ui.postMessage({ type: 'settings', settings: s || null, fileKey: figma.fileKey || null, fileName: figma.root.name });
      } else if (msg.type === 'save-settings') {
        await figma.clientStorage.setAsync('settings', msg.settings);
      } else if (msg.type === 'sync') {
        var report = await Engine.sync(msg.template);
        figma.ui.postMessage({ type: 'sync-result', requestId: msg.requestId, report: report });
      } else if (msg.type === 'generate') {
        var result = await Engine.generate(msg.job, msg.assets);
        figma.ui.postMessage({ type: 'generate-result', requestId: msg.requestId, result: result });
      } else if (msg.type === 'focus') {
        var node = await figma.getNodeByIdAsync(msg.nodeId);
        if (node) {
          var page = node; while (page && page.type !== 'PAGE') page = page.parent;
          if (page) await figma.setCurrentPageAsync(page);
          figma.viewport.scrollAndZoomIntoView([node]);
        }
      } else if (msg.type === 'notify') {
        figma.notify(msg.text, { error: !!msg.error });
      }
    } catch (e) {
      figma.ui.postMessage({ type: 'error', requestId: msg.requestId, message: e && e.message ? e.message : String(e) });
    }
  };
}
