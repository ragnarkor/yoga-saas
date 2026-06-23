/**
 * 私教分类识别
 */

function isPrivateCategoryName(name) {
  return String(name || "").indexOf("私教") >= 0;
}

function isPrivateCategory(cat) {
  if (!cat) return false;
  if (cat.isPrivate === true) return true;
  return isPrivateCategoryName(cat.name || cat.label || "");
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
  return isPrivateCategoryName(meet.MEET_TYPE_NAME || "");
}

module.exports = {
  isPrivateCategoryName,
  isPrivateCategory,
  filterPrivateCategories,
  getPrivateCategoryIds,
  isPrivateMeet,
};
