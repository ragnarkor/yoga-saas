const pageHelper = require("./page_helper.js");

const EXPIRED_MSG = "服务已到期";
const CHECK_COOLDOWN_MS = 8000;
let _redirecting = false;
let _checking = false;
let _lastOkPid = "";
let _lastOkAt = 0;

function isTenantExpiredMsg(msg) {
  return !!(msg && String(msg).includes(EXPIRED_MSG));
}

function _hintUrl(tenantName, role, themeColor) {
  const name = encodeURIComponent(tenantName || "");
  const color = encodeURIComponent(themeColor || "");
  const r = role === "coach" ? "coach" : "member";
  return `/pages/tenant/expired/tenant_expired_hint?name=${name}&role=${r}&color=${color}`;
}

function _selectUrl(role, themeColor) {
  const scope = role === "coach" ? "&scope=coach" : "";
  const color = themeColor
    ? `&color=${encodeURIComponent(themeColor)}`
    : "";
  return `/pages/tenant/select/tenant_select?switch=1&reason=expired${scope}${color}`;
}

function _currentRoute() {
  const pages = getCurrentPages();
  if (!pages.length) return "";
  return pages[pages.length - 1].route || "";
}

function _isGatePage(route) {
  return (
    route === "pages/tenant/select/tenant_select" ||
    route === "pages/tenant/expired/tenant_expired_hint"
  );
}

function _markAccessOk(pid) {
  _lastOkPid = pid;
  _lastOkAt = Date.now();
}

function _resetAccessCache() {
  _lastOkPid = "";
  _lastOkAt = 0;
}

function _cloud() {
  return require("./cloud_helper.js");
}

async function _loadAlternatives(role) {
  if (role === "coach") {
    const AdminWxBiz = require("../biz/admin_wx_biz.js");
    if (AdminWxBiz.isSuperSession()) {
      return { skip: true, list: [] };
    }
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) return { skip: false, list: [] };
    const list = await AdminWxBiz.fetchTenantList();
    return { skip: false, list: list || [] };
  }

  const res = await _cloud().callCloudData(
    "tenant/list",
    {},
    { hint: false, title: "bar" },
  );
  return { skip: false, list: (res && res.list) || [] };
}

async function _queryTenantAccess(pid) {
  const res = await _cloud().callCloudData(
    "tenant/check_access",
    { pid },
    { hint: false, title: "bar" },
  );
  if (!res) return null;
  if (res.active) return { active: true };
  return {
    active: false,
    reason: res.reason || "unknown",
    tenantName: res.tenantName || "",
  };
}

async function redirectOnTenantExpired(role) {
  if (_redirecting) return { redirected: true };
  const route = _currentRoute();
  if (_isGatePage(route)) return { redirected: false };

  _redirecting = true;
  const tenantName = pageHelper.getTenantName() || "";
  const themeColor = pageHelper.getThemeColor();
  pageHelper.clearPID();
  _resetAccessCache();

  try {
    const { skip, list } = await _loadAlternatives(role);
    if (skip) {
      _redirecting = false;
      return { redirected: false, skipSuper: true };
    }

    if ((list || []).length > 0) {
      wx.reLaunch({ url: _selectUrl(role, themeColor) });
      return { redirected: true, target: "select" };
    }

    wx.reLaunch({ url: _hintUrl(tenantName, role, themeColor) });
    return { redirected: true, target: "hint" };
  } catch (e) {
    console.error("[tenant_access_helper.redirect]", e);
    wx.reLaunch({ url: _hintUrl(tenantName, role, themeColor) });
    return { redirected: true, target: "hint" };
  } finally {
    setTimeout(() => {
      _redirecting = false;
    }, 800);
  }
}

async function ensureTenantAccess(role) {
  if (settingSinglePid()) return true;
  const pid = pageHelper.getPID();
  if (!pid) return true;

  if (role === "coach") {
    const AdminWxBiz = require("../biz/admin_wx_biz.js");
    if (AdminWxBiz.isSuperSession()) return true;
  }

  const route = _currentRoute();
  if (_isGatePage(route)) return true;

  const now = Date.now();
  if (pid === _lastOkPid && now - _lastOkAt < CHECK_COOLDOWN_MS) {
    return true;
  }

  if (_checking) return true;
  _checking = true;

  try {
    const access = await _queryTenantAccess(pid);
    if (access && access.active) {
      _markAccessOk(pid);
      return true;
    }

    if (access && (access.reason === "expired" || access.reason === "closed")) {
      await redirectOnTenantExpired(role);
      return false;
    }

    if (access && access.reason === "not_found") {
      await redirectOnTenantExpired(role);
      return false;
    }

    // 接口异常时不误判过期，避免全馆不可用
    if (!access) {
      console.warn("[tenant_access_helper.ensure] check_access empty, skip");
      return true;
    }

    await redirectOnTenantExpired(role);
    return false;
  } catch (e) {
    console.error("[tenant_access_helper.ensure]", e);
    return true;
  } finally {
    _checking = false;
  }
}

function settingSinglePid() {
  const setting = require("../setting/setting.js");
  return !!setting.PID;
}

function resolveCloudMode(route) {
  if (route && route.includes("admin/")) return "coach";
  return "member";
}

async function handleCloudTenantExpired(route) {
  const role = resolveCloudMode(route);
  if (role === "coach") {
    const AdminWxBiz = require("../biz/admin_wx_biz.js");
    if (AdminWxBiz.isSuperSession()) return false;
  }
  await redirectOnTenantExpired(role);
  return true;
}

module.exports = {
  isTenantExpiredMsg,
  ensureTenantAccess,
  redirectOnTenantExpired,
  handleCloudTenantExpired,
  resolveCloudMode,
};

