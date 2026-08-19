/**
 * 会员卡适用课程范围
 * mode: all（全馆）| categories（按分类，categoryIds）| meets（按具体课程，meetIds）
 */

function normalizeScope(scope) {
  if (typeof scope === "string") {
    try {
      scope = JSON.parse(scope);
    } catch (e) {
      return { mode: "all", categoryIds: [], meetIds: [] };
    }
  }
  if (!scope || typeof scope !== "object") {
    return { mode: "all", categoryIds: [], meetIds: [] };
  }
  let mode = "all";
  if (scope.mode === "categories") mode = "categories";
  else if (scope.mode === "meets") mode = "meets";

  const categoryIds = Array.isArray(scope.categoryIds)
    ? scope.categoryIds.map(String).filter(Boolean)
    : [];
  const meetIds = Array.isArray(scope.meetIds)
    ? scope.meetIds.map(String).filter(Boolean)
    : [];
  return { mode, categoryIds, meetIds };
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
  return { mode: "all", categoryIds: [], meetIds: [] };
}

function cardMatchesMeet(scopeOrCard, meet, tpl) {
  const scope =
    scopeOrCard && scopeOrCard.mode
      ? normalizeScope(scopeOrCard)
      : getCardScope(scopeOrCard, tpl);

  if (scope.mode === "categories") {
    if (!scope.categoryIds.length) return false;
    const typeId = String((meet && meet.MEET_TYPE_ID) || "");
    return scope.categoryIds.includes(typeId);
  }

  if (scope.mode === "meets") {
    if (!scope.meetIds.length) return false;
    // 兼容 meet._id 与 MEET_ID 两种取值
    const meetId = String((meet && (meet._id || meet.MEET_ID)) || "");
    return scope.meetIds.includes(meetId);
  }

  // all
  return true;
}

/**
 * 生成适用范围文案
 * @param {*} scope
 * @param {*} nameMap    分类 ID → 分类名（mode=categories 用）
 * @param {*} meetNameMap 课程 ID → 课程名（mode=meets 用）
 */
function buildScopeDesc(scope, nameMap, meetNameMap) {
  const normalized = normalizeScope(scope);

  if (normalized.mode === "categories") {
    if (!normalized.categoryIds.length) return "未指定分类";
    const names = normalized.categoryIds.map(
      (id) => (nameMap && nameMap[id]) || id,
    );
    return names.join("、");
  }

  if (normalized.mode === "meets") {
    if (!normalized.meetIds.length) return "未指定课程";
    const names = normalized.meetIds.map(
      (id) => (meetNameMap && meetNameMap[id]) || "指定课程",
    );
    return names.join("、");
  }

  return "全馆课程";
}

module.exports = {
  normalizeScope,
  getCardScope,
  cardMatchesMeet,
  buildScopeDesc,
};
