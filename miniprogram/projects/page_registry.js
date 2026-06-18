/**
 * 租户模板定制页面注册表
 * key = TENANT_TEMPLATE（如 A00），value = 相对页面路径数组
 * 仅在此注册的页面走 projects/{template}/，其余走 pages/default/
 */
module.exports = {
  A00: ["index/default_index"],
};
