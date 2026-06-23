/**
 * 会员卡适用课程范围
 */

function normalizeScope(scope) {
  if (!scope || typeof scope !== "object") {
    return { mode: "all", categoryIds: [] };
  }
  const mode = scope.mode === "categories" ? "categories" : "all";
  const categoryIds = Array.isArray(scope.categoryIds)
    ? scope.categoryIds.map(String).filter(Boolean)
    : [];
  return { mode, categoryIds };
}

function getCardScope(card, tpl) {
  if (card && card.USER_CARD_SCOPE) {
    return normalizeScope(card.USER_CARD_SCOPE);
  }
  if (tpl && tpl.CARD_TPL_SCOPE) {
    return normalizeScope(tpl.CARD_TPL_SCOPE);
  }
  if (card && card.CARD_TPL_SCOPE) {
    return normalizeScope(card.CARD_TPL_SCOPE);
  }
  return { mode: "all", categoryIds: [] };
}

function cardMatchesMeet(scopeOrCard, meet, tpl) {
  const scope =
    scopeOrCard && scopeOrCard.mode
      ? normalizeScope(scopeOrCard)
      : getCardScope(scopeOrCard, tpl);
  if (scope.mode !== "categories") return true;
  if (!scope.categoryIds.length) return false;
  const typeId = String((meet && meet.MEET_TYPE_ID) || "");
  return scope.categoryIds.includes(typeId);
}

function buildScopeDesc(scope, nameMap) {
  const normalized = normalizeScope(scope);
  if (normalized.mode !== "categories") return "全馆课程";
  if (!normalized.categoryIds.length) return "未指定分类";
  const names = normalized.categoryIds.map(
    (id) => (nameMap && nameMap[id]) || id,
  );
  return names.join("、");
}

module.exports = {
  normalizeScope,
  getCardScope,
  cardMatchesMeet,
  buildScopeDesc,
};
