/**
 * 租户主表 + 扩展配置表（ax_setup）字段合并
 * 主题色、课程分类以 setup 为准，tenant 字段作历史兼容回退
 */

const SetupModel = require("../model/setup_model.js");

const SETUP_STORE_FIELDS =
  "SETUP_ABOUT,SETUP_ABOUT_PIC,SETUP_THEME_COLOR,SETUP_MEET_TYPE,SETUP_PHONE,SETUP_ADDRESS,SETUP_LATITUDE,SETUP_LONGITUDE,SETUP_FEATURES";

function mergeTenantWithSetup(tenant, setup) {
  if (!tenant) return tenant;
  const merged = Object.assign({}, tenant);
  if (!setup) return merged;

  if (setup.SETUP_THEME_COLOR) {
    merged.TENANT_THEME_COLOR = setup.SETUP_THEME_COLOR;
  }
  if (setup.SETUP_MEET_TYPE) {
    merged.TENANT_MEET_TYPE = setup.SETUP_MEET_TYPE;
  }
  return merged;
}

async function getSetupForPid(pid, fields = SETUP_STORE_FIELDS) {
  if (!pid) return null;
  return await SetupModel.getOne({ _pid: pid }, fields, {}, false);
}

async function getMergedTenant(pid, tenant) {
  if (!tenant) return null;
  const setup = await getSetupForPid(pid);
  return mergeTenantWithSetup(tenant, setup);
}

module.exports = {
  SETUP_STORE_FIELDS,
  mergeTenantWithSetup,
  getSetupForPid,
  getMergedTenant,
};
