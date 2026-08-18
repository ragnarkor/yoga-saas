function legacyToDelta(content) {
  const ops = [];
  (Array.isArray(content) ? content : []).forEach((item) => {
    if (!item) return;
    if (item.type === 'img' && item.val) ops.push({ insert: { image: item.val } });
    else if (item.type === 'text') ops.push({ insert: String(item.val || '') + '\n' });
  });
  if (!ops.length) ops.push({ insert: '\n' });
  return { ops };
}

function deltaToLegacy(delta) {
  const list = [];
  const ops = delta && Array.isArray(delta.ops) ? delta.ops : [];
  ops.forEach((op) => {
    if (typeof op.insert === 'string' && op.insert) list.push({ type: 'text', val: op.insert });
    else if (op.insert && op.insert.image) list.push({ type: 'img', val: op.insert.image });
  });
  return list.length ? list : [{ type: 'text', val: '' }];
}

function deltaToRichNodes(delta) {
  const nodes = [];
  const ops = delta && Array.isArray(delta.ops) ? delta.ops : [];
  ops.forEach((op) => {
    if (typeof op.insert === 'string') {
      const attrs = op.attributes || {};
      const style = [];
      if (attrs.bold) style.push('font-weight:bold');
      if (attrs.italic) style.push('font-style:italic');
      if (attrs.underline) style.push('text-decoration:underline');
      if (attrs.color) style.push('color:' + attrs.color);
      if (attrs.background) style.push('background-color:' + attrs.background);
      if (attrs.align) style.push('text-align:' + attrs.align);
      if (attrs.header) style.push('font-size:' + (attrs.header === 1 ? '22px' : '18px') + ';font-weight:bold');
      if (op.insert) nodes.push({ name: 'div', attrs: { style: style.join(';') }, children: [{ type: 'text', text: op.insert }] });
    } else if (op.insert && op.insert.image) {
      nodes.push({ name: 'img', attrs: { src: op.insert.image, style: 'width:100%;display:block;margin:12px 0' } });
    }
  });
  return nodes;
}

module.exports = { legacyToDelta, deltaToLegacy, deltaToRichNodes };
