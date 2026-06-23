function normalizeScope(scope) {
  if (!scope || typeof scope !== 'object') {
    return { mode: 'all', categoryIds: [] };
  }
  const mode = scope.mode === 'categories' ? 'categories' : 'all';
  const categoryIds = Array.isArray(scope.categoryIds)
    ? scope.categoryIds.map(String).filter(Boolean)
    : [];
  return { mode, categoryIds };
}

function buildScopeDesc(scope, categories) {
  const normalized = normalizeScope(scope);
  if (normalized.mode !== 'categories') return '全馆课程';
  if (!normalized.categoryIds.length) return '未指定分类';
  const nameMap = {};
  (categories || []).forEach((c) => {
    if (c && c.id) nameMap[String(c.id)] = c.name;
  });
  return normalized.categoryIds
    .map((id) => nameMap[id] || id)
    .join('、');
}

function isCategorySelected(scope, categoryId) {
  const normalized = normalizeScope(scope);
  return normalized.categoryIds.includes(String(categoryId));
}

module.exports = {
  normalizeScope,
  buildScopeDesc,
  isCategorySelected,
};
