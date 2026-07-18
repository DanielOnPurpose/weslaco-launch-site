#!/usr/bin/env node
// Zero-dependency verification (Content Convention v0.1). Exits 0 on pass, 1 on fail.
// Proves:
//   1. Every schema field has a value of the right type in its content file;
//      no orphan content keys (blocks, fields, or item fields).
//   2. `node build.js` output is byte-identical to the committed index.html.
//   3. Every client-editable scalar value appears in the built index.html.
'use strict';
const fs = require('fs');
const path = require('path');
const { build, esc } = require('./build.js');

const ROOT = __dirname;
const failures = [];
const JS_TYPE = {
  string: 'string', text: 'string', image: 'string', url: 'string',
  tel: 'string', email: 'string', select: 'string',
  boolean: 'boolean', number: 'number'
};

function checkFields(where, fieldDefs, values) {
  const known = new Set(fieldDefs.map((f) => f.key));
  for (const k of Object.keys(values)) {
    if (!known.has(k)) failures.push(`${where}: orphan content key "${k}"`);
  }
  for (const f of fieldDefs) {
    if (!(f.key in values)) { failures.push(`${where}: missing value for "${f.key}"`); continue; }
    const expected = JS_TYPE[f.type];
    if (!expected) { failures.push(`${where}.${f.key}: unknown schema type "${f.type}"`); continue; }
    if (typeof values[f.key] !== expected) {
      failures.push(`${where}.${f.key}: expected ${expected}, got ${typeof values[f.key]}`);
    }
  }
}

const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'schema.json'), 'utf8'));
const editableScalars = []; // [description, value]

for (const file of schema.files) {
  const content = JSON.parse(fs.readFileSync(path.join(ROOT, file.path), 'utf8'));
  const blockKeys = new Set(file.blocks.map((b) => b.key));
  for (const k of Object.keys(content)) {
    if (!blockKeys.has(k)) failures.push(`${file.path}: orphan content block "${k}"`);
  }
  for (const block of file.blocks) {
    const where = `${file.path}#${block.key}`;
    const c = content[block.key];
    if (c === undefined) { failures.push(`${where}: missing block content`); continue; }
    if (block.itemFields) {
      if (!Array.isArray(c.items)) { failures.push(`${where}: expected { "items": [...] }`); continue; }
      for (const k of Object.keys(c)) {
        if (k !== 'items') failures.push(`${where}: orphan content key "${k}"`);
      }
      c.items.forEach((item, i) => {
        checkFields(`${where}.items[${i}]`, block.itemFields, item);
        if (block.permission === 'client-editable') {
          for (const f of block.itemFields) {
            if (JS_TYPE[f.type] === 'string' && typeof item[f.key] === 'string') {
              editableScalars.push([`${where}.items[${i}].${f.key}`, item[f.key]]);
            }
          }
        }
      });
    } else {
      checkFields(where, block.fields, c);
      for (const f of block.fields) {
        if (f.permission === 'client-editable' && JS_TYPE[f.type] === 'string' && typeof c[f.key] === 'string') {
          editableScalars.push([`${where}.${f.key}`, c[f.key]]);
        }
      }
    }
  }
}

// 2. Deterministic round-trip: build output must match committed index.html byte-for-byte.
let built = '';
try {
  built = build();
  const committed = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  if (built !== committed) failures.push('build output is NOT byte-identical to committed index.html — run `node build.js` and commit');
} catch (e) {
  failures.push('build failed: ' + e.message);
}

// 3. Every client-editable scalar value must appear (escaped) in the built page.
if (built) {
  for (const [where, value] of editableScalars) {
    if (value === '') continue;
    if (!built.includes(esc(value))) failures.push(`client-editable value not found in built index.html: ${where}`);
  }
}

if (failures.length) {
  console.error('VERIFY FAILED:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`VERIFY OK: schema/content aligned, build deterministic, ${editableScalars.length} client-editable scalars present in output.`);
process.exit(0);
