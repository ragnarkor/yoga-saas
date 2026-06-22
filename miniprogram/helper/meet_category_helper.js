/**
 * 课程分类配置（独立模块，避免 page_helper 循环依赖导致方法未导出）
 */
const cacheHelper = require("./cache_helper.js");
const dataHelper = require("./data_helper.js");
const skinDefault = require("../pages/default/skin/skin.js");
const skinA00 = require("../projects/A00/skin/skin.js");

const CACHE_TENANT_INFO = "CACHE_TENANT_INFO";
const CACHE_TEMPLATE = "CACHE_TENANT_TEMPLATE";

const SKIN_MAP = {
  default: skinDefault,
  A00: skinA00,
};

function getTemplate() {
  return cacheHelper.get(CACHE_TEMPLATE) || "default";
}

function getTenantInfo() {
  return cacheHelper.get(CACHE_TENANT_INFO) || null;
}

function getMeetTypeStr() {
  const tenant = getTenantInfo();
  if (tenant?.TENANT_MEET_TYPE) return tenant.TENANT_MEET_TYPE;
  const skin = SKIN_MAP[getTemplate()] || skinDefault;
  return skin.MEET_TYPE || "";
}

function getMeetCategories(allLabel = "全部课程") {
  const opts = dataHelper.getSelectOptions(getMeetTypeStr());
  const tabs = [{ id: "0", name: allLabel }];
  for (const o of opts) {
    if (o && o.val != null && o.label) {
      tabs.push({ id: String(o.val), name: o.label });
    }
  }
  return tabs;
}

module.exports = {
  getMeetTypeStr,
  getMeetCategories,
};
