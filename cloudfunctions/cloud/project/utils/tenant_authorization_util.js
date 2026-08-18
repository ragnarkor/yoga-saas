/** 普通管理员只能在其所属租户内使用 token；超级管理员可跨租户。 */
function canAccessTenant(admin, pid, superRole = "super") {
  if (!admin) return false;
  const targetPid = String(pid || "").trim();
  if (!targetPid) return true;
  if (admin.ADMIN_TYPE === superRole) return true;
  return String(admin._pid || "") === targetPid;
}

module.exports = { canAccessTenant };
