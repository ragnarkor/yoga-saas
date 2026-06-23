/**
 * 租户主题色工具：会员端与教练端共用
 */

const DEFAULT_THEME = "#6FAE96";

// [AI_START TIMESTAMP=2025-01-27 14:00:00]
const PRESET_THEME_COLORS = [
  { name: "鼠尾草", color: "#6FAE96" },
  { name: "薰衣草", color: "#A593D6" },
  { name: "静谧蓝", color: "#6FA8C8" },
  { name: "赤陶橙", color: "#DD9168" },
  { name: "暮云粉", color: "#DBA0A0" },
  { name: "暖沙金", color: "#D2AF73" },
];
// [AI_END LINES=8 TIMESTAMP=2025-01-27 14:00:00]

function normalizeHex(color) {
  if (!color || typeof color !== "string") return DEFAULT_THEME;
  let c = color.trim();
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c)) return DEFAULT_THEME;
  if (c.length === 4) {
    c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
  }
  return c.toUpperCase();
}

function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const v = Math.max(0, Math.min(255, Math.round(n)));
    return v.toString(16).padStart(2, "0");
  };
  return ("#" + toHex(r) + toHex(g) + toHex(b)).toUpperCase();
}

function mixColor(hex, targetHex, ratio) {
  const a = hexToRgb(hex);
  const b = hexToRgb(targetHex);
  const t = Math.max(0, Math.min(1, ratio));
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  );
}

function getThemeLight(color) {
  return mixColor(color, "#FFFFFF", 0.85);
}

function getThemeDark(color) {
  return mixColor(color, "#000000", 0.18);
}

/** 教练端顶栏 / 导航栏浅色背景 */
function getNavBarBg(color) {
  return mixColor(color, "#FFFFFF", 0.35);
}

function getCoachHeaderGradient(color) {
  const c = normalizeHex(color);
  const a = mixColor(c, "#FFFFFF", 0.35);
  const b = mixColor(c, "#FFFFFF", 0.55);
  const d = mixColor(c, "#FFFFFF", 0.72);
  return `linear-gradient(160deg, ${a} 0%, ${b} 40%, ${d} 100%)`;
}

function getCoachProfileGradient(color) {
  const c = normalizeHex(color);
  const a = mixColor(c, "#FFFFFF", 0.35);
  const b = mixColor(c, "#FFFFFF", 0.55);
  return `linear-gradient(160deg, ${a} 0%, ${b} 100%)`;
}

function getThemeCssVars(color) {
  const c = normalizeHex(color);
  return {
    "--projectColor": c,
    "--projectColorLight": getThemeLight(c),
    "--projectColorDark": getThemeDark(c),
    "--calendarMainColor": c,
    "--calendarLightColor": mixColor(c, "#FFFFFF", 0.45),
    "--themeColor": c,
    "--themeColorLight": getNavBarBg(c),
    "--themeColorDark": getThemeDark(c),
    "--themeTextMuted": mixColor(c, "#666666", 0.42),
    "--neutralBg": "#F5F6F8",
    "--neutralSurface": "#FFFFFF",
    "--neutralText": "#1F2329",
    "--neutralTextSecondary": "#646A73",
    "--neutralTextTertiary": "#8F959E",
    "--neutralBorder": "#E8E9EB",
    "--neutralIconBg": "#F2F3F5",
    "--neutralShadow": "rgba(31, 35, 41, 0.06)",
  };
}

/** 教练端顶栏：使用纯色主题，避免大面积浅色渐变 */
function getCoachNavBg(color) {
  return normalizeHex(color);
}

/** 供 style / page-meta 内联使用（不含含逗号的 gradient 值，避免解析失败白屏） */
function getInlineThemeVars(color, navHeight) {
  const vars = getThemeCssVars(color);
  if (navHeight) {
    vars["--navHeight"] = navHeight + "px";
  }
  return vars;
}

function cssVarsToStyle(vars) {
  return Object.keys(vars)
    .map((k) => k + ":" + vars[k])
    .join(";");
}

function getPageMetaStyle(color) {
  return cssVarsToStyle(getInlineThemeVars(color));
}

function getCoachPageStyle(color, navHeight) {
  return cssVarsToStyle(getInlineThemeVars(color, navHeight));
}

/** 会员端：刷新页面栈、Tab 栏主题色（setTenant / 保存主题色后调用） */
function applyMemberThemeGlobal() {
  const pageHelper = require("./page_helper.js");
  const color = pageHelper.getThemeColor();
  const skin = pageHelper.getSkin();
  const pageStyle = getPageMetaStyle(color);
  const patch = { themeColor: color, pageStyle, skin };

  try {
    const pages = getCurrentPages();
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page || !page.setData) continue;
      if (typeof page._applyCoachTheme === "function") {
        page._applyCoachTheme();
      } else if (typeof page._applyTheme === "function") {
        page._applyTheme();
      } else {
        page.setData(patch);
      }
    }
  } catch (e) {
    console.error("[applyMemberThemeGlobal]", e);
  }

  try {
    const pages = getCurrentPages();
    const page = pages.length ? pages[pages.length - 1] : null;
    const tabBar =
      page && typeof page.getTabBar === "function" ? page.getTabBar() : null;
    if (tabBar) {
      tabBar.setData({ hidden: false });
      if (tabBar.refreshTabs) {
        const cur = Number(tabBar.data?.selected);
        tabBar.refreshTabs(Number.isNaN(cur) ? undefined : cur);
      }
    }
  } catch (e) {
    /* 非 Tab 页无 custom-tab-bar */
  }
}

module.exports = {
  DEFAULT_THEME,
  PRESET_THEME_COLORS,
  normalizeHex,
  getThemeLight,
  getThemeDark,
  getNavBarBg,
  getCoachNavBg,
  getCoachHeaderGradient,
  getThemeCssVars,
  getPageMetaStyle,
  getCoachPageStyle,
  applyMemberThemeGlobal,
};
