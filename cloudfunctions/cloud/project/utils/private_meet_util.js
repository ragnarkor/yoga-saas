/**
 * 私教分类识别（仅显式 isPrivate / scheduleMode，不再按名称推断）
 */

function isPrivateCategory(cat) {
  if (!cat) return false;
  return cat.isPrivate === true;
}

function filterPrivateCategories(categories) {
  return (categories || []).filter(isPrivateCategory);
}

function getPrivateCategoryIds(categories) {
  return filterPrivateCategories(categories).map((c) => String(c.id));
}

function isPrivateMeet(meet, privateCategoryIds) {
  if (!meet) return false;
  const style = meet.MEET_STYLE_SET || {};
  if (style.scheduleMode === "private" || style.isPrivate === true) return true;
  const typeId = String(meet.MEET_TYPE_ID || "");
  if (privateCategoryIds && privateCategoryIds.length) {
    return privateCategoryIds.includes(typeId);
  }
  return false;
}

module.exports = {
  isPrivateCategory,
  filterPrivateCategories,
  getPrivateCategoryIds,
  isPrivateMeet,
};
