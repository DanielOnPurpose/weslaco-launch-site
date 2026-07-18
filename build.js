#!/usr/bin/env node
// Zero-dependency build: content/*.json + templates/index.template.html -> index.html
// Template constructs (Content Convention v0.1):
//   {{path}}          scalar, HTML-escaped ({{home.hero.headline}} = file basename dot path)
//   {{{path}}}        scalar, raw (trusted HTML — use sparingly)
//   {{#each path}}    repeat body for each item in the array at path
//   {{#if path}}      render body only when value at path is truthy
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

function loadContent() {
  const data = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'content'))) {
    if (!f.endsWith('.json') || f === 'schema.json') continue;
    data[path.basename(f, '.json')] = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8'));
  }
  return data;
}

function esc(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Resolve a dot path against scopes (innermost {{#each}} item first, then root).
function lookup(pathStr, scopes) {
  for (const scope of scopes) {
    let cur = scope, ok = true;
    for (const part of pathStr.split('.')) {
      if (cur !== null && typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, part)) cur = cur[part];
      else { ok = false; break; }
    }
    if (ok) return cur;
  }
  return undefined;
}

// Find the matching {{/kind}} for a block opened just before `from`.
function findClose(s, from, kind) {
  const openTok = '{{#' + kind, closeTok = '{{/' + kind + '}}';
  let depth = 1, i = from;
  while (i < s.length) {
    const o = s.indexOf(openTok, i), c = s.indexOf(closeTok, i);
    if (c === -1) throw new Error('Unclosed {{#' + kind + '}}');
    if (o !== -1 && o < c) { depth++; i = o + openTok.length; }
    else { depth--; if (depth === 0) return c; i = c + closeTok.length; }
  }
  throw new Error('Unclosed {{#' + kind + '}}');
}

function scalars(s, scopes) {
  s = s.replace(/\{\{\{([^{}]+)\}\}\}/g, (_, p) => {
    const v = lookup(p.trim(), scopes);
    if (v === undefined) throw new Error('Missing value for {{{' + p.trim() + '}}}');
    return String(v);
  });
  return s.replace(/\{\{([^{}#/][^{}]*)\}\}/g, (_, p) => {
    const v = lookup(p.trim(), scopes);
    if (v === undefined) throw new Error('Missing value for {{' + p.trim() + '}}');
    return esc(v);
  });
}

function render(tpl, scopes) {
  let out = '', i = 0;
  const re = /\{\{#(each|if) ([^}]+)\}\}/g;
  let m;
  while ((m = re.exec(tpl))) {
    out += scalars(tpl.slice(i, m.index), scopes);
    const kind = m[1], p = m[2].trim();
    const bodyStart = m.index + m[0].length;
    const closeAt = findClose(tpl, bodyStart, kind);
    const body = tpl.slice(bodyStart, closeAt);
    const val = lookup(p, scopes);
    if (kind === 'each') {
      if (!Array.isArray(val)) throw new Error('{{#each ' + p + '}}: value is not an array');
      for (const item of val) out += render(body, [item, ...scopes]);
    } else if (val) {
      out += render(body, scopes);
    }
    i = closeAt + ('{{/' + kind + '}}').length;
    re.lastIndex = i;
  }
  return out + scalars(tpl.slice(i), scopes);
}

function build() {
  const tpl = fs.readFileSync(path.join(ROOT, 'templates', 'index.template.html'), 'utf8');
  return render(tpl, [loadContent()]);
}

if (require.main === module) {
  fs.writeFileSync(path.join(ROOT, 'index.html'), build());
  console.log('Built index.html');
}

module.exports = { build, esc };
