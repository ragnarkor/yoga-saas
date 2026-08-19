function normalizeScope(scope) {
  if (typeof scope === 'string') {
    try {
      scope = JSON.parse(scope);
    } catch (e) {
      return { mode: 'all', categoryIds: [], meetIds: [] };
    }
  }
  if (!scope || typeof scope !== 'object') {
    return { mode: 'all', categoryIds: [], meetIds: [] };
  }
  let mode = 'all';
  if (scope.mode === 'categories') mode = 'categories';
  else if (scope.mode === 'meets') mode = 'meets';

  const categoryIds = Array.isArray(scope.categoryIds)
    ? scope.categoryIds.map(String).filter(Boolean)
    : [];
  const meetIds = Array.isArray(scope.meetIds)
    ? scope.meetIds.map(String).filter(Boolean)
    : [];
  return { mode, categoryIds, meetIds };
}

function buildScopeDesc(scope, categories, meets) {
  const normalized = normalizeScope(scope);

  if (normalized.mode === 'categories') {
    if (!normalized.categoryIds.length) return '未指定分类';
    const nameMap = {};
    (categories || []).forEach((c) => {
      if (c && c.id) nameMap[String(c.id)] = c.name;
    });
    return normalized.categoryIds.map((id) => nameMap[id] || id).join('、');
  }

  if (normalized.mode === 'meets') {
    if (!normalized.meetIds.length) return '未指定课程';
    const nameMap = {};
    (meets || []).forEach((m) => {
      const id = m && (m._id || m.MEET_ID);
      if (id) nameMap[String(id)] = m.MEET_TITLE || m.title || '';
    });
    return normalized.meetIds.map((id) => nameMap[id] || '指定课程').join('、');
  }

  return '全馆课程';
}

function isCategorySelected(scope, categoryId) {
  const normalized = normalizeScope(scope);
  return normalized.categoryIds.includes(String(categoryId));
}

function isMeetSelected(scope, meetId) {
  const normalized = normalizeScope(scope);
  return normalized.meetIds.includes(String(meetId));
}

module.exports = {
  normalizeScope,
  buildScopeDesc,
  isCategorySelected,
  isMeetSelected,
};
