const pageHelper = require("../helper/page_helper.js");
const iconColors = require("../helper/icon_colors.js");
const themeHelper = require("../helper/theme_helper.js");

/** 与 app.json tabBar.list 顺序一致，switchTab 必须用注册路径 */
const TAB_SWITCH_URLS = [
  "/pages/default/index/default_index",
  "/pages/default/calendar/index/calendar_index",
  "/pages/default/news/cate1/news_cate1",
  "/pages/default/my/index/my_index",
];

const TAB_DEFS = [
  {
    key: "home",
    text: "首页",
    icon: "home-o",
    iconInactiveSrc: "/images/tab/home.svg",
    routeMatchers: [
      "pages/default/index/default_index",
      "projects/A00/index/default_index",
    ],
  },
  {
    key: "calendar",
    text: "约课",
    icon: "calendar-o",
    iconInactiveSrc: "/images/tab/calendar.svg",
    routeMatchers: ["pages/default/calendar/index/calendar_index"],
  },
  {
    key: "cate1",
    text: "课程",
    icon: "todo-list-o",
    iconInactiveSrc: "/images/tab/course.svg",
    routeMatchers: ["pages/default/news/cate1/news_cate1"],
  },
  {
    key: "my",
    text: "我的",
    icon: "user-o",
    iconInactiveSrc: "/images/tab/profile.svg",
    routeMatchers: ["pages/default/my/index/my_index"],
  },
];

// 未选中图标使用本地的纯灰 SVG；选中图标在运行时以场馆主题色绘制，
// 这样切换场馆主题时不需要维护多套静态资源。
function svgDataUri(svg) {
  const bytes = new Uint8Array(svg.length);
  for (let i = 0; i < svg.length; i++) bytes[i] = svg.charCodeAt(i);
  return `data:image/svg+xml;base64,${wx.arrayBufferToBase64(bytes.buffer)}`;
}

function buildActiveIcon(key, themeColor) {
  const color = themeHelper.normalizeHex(themeColor);
  const light = themeHelper.getThemeLight(color);
  // 主题色负责“选中”，固定点缀色负责四个入口的识别感。
  // 这些色彩不会出现在未选中态。
  const coral = "#EAA18C";
  const lavender = "#B297EC";
  const sage = "#75AE8E";
  const matBlue = "#6DAACB";
  const svg = {
    home: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="m3.2 10.1 8.8-7 8.8 7"/><path d="M5.5 9.7v9.7h13V9.7" fill="${light}"/><path d="M10.2 19.4v-4.2h3.6v4.2"/><g stroke="${coral}" stroke-width="1.1"><path d="M12 8.6c-1.15-1.85-2.45-1.7-2.45-.55 0 .95.95 1.35 2.45 2.25 1.5-.9 2.45-1.3 2.45-2.25 0-1.15-1.3-1.3-2.45.55Z"/><path d="M12 8.6c-.45-2.05-1.85-2.25-2.35-1.25-.4.85.4 1.55 2.35 2.85 1.95-1.3 2.75-2 2.35-2.85-.5-1-1.9-.8-2.35 1.25Z"/></g></svg>`,
    calendar: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><rect x="3.4" y="5.2" width="14.6" height="14.4" rx="2.2" fill="${light}"/><path d="M7.2 3.2v4M14.2 3.2v4M3.4 9.8H18"/><path d="M7.2 13h.01M10.7 13h.01M7.2 16.2h.01" stroke-width="2.1"/><circle cx="18.3" cy="17.3" r="3" fill="${lavender}" stroke="${lavender}"/><path d="M18.3 15.8v1.65l1.15.6" stroke="#FFFFFF" stroke-width="1.15"/></svg>`,
    cate1: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><rect x="3.3" y="3.8" width="14.5" height="16.2" rx="2.4" fill="${light}"/><path d="M3.3 9.1h14.5"/><path d="M7.4 6.45h.01M10.1 6.45h.01" stroke-width="2.1"/><path d="M7.4 13h7.1M7.4 16.5h4.35"/><g fill="${sage}" stroke="${sage}" stroke-width=".9"><path d="M19.1 15.2c.25-2.4 1.85-3.5 3.35-3.3.12 1.82-1.18 3.18-3.35 3.3Z"/><path d="M18.9 15.65c-2.2-.62-3.22-2.2-2.8-3.62 1.78.12 3.02 1.62 2.8 3.62Z"/><path d="M19.2 15.75c1.95 1.05 2.25 2.72 1.42 3.82-1.65-.7-2.18-2.42-1.42-3.82Z"/></g></svg>`,
    my: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><circle cx="11.4" cy="8" r="4.1" fill="${light}"/><path d="M3.8 20.7c.8-4.75 3.42-7.05 7.6-7.05s6.8 2.3 7.6 7.05" fill="${light}"/><path d="M14.85 4.75c.62.78.96 1.75.96 2.75 0 1.1-.4 2.1-1.08 2.9"/><g stroke="${matBlue}" stroke-width="1.2"><path d="M12.85 13.75h6.65c1.88 0 3 .98 3 2.36s-1.12 2.36-3 2.36h-6.65c-1.05 0-1.78-.72-1.78-1.62v-1.48c0-.9.73-1.62 1.78-1.62Z" fill="${matBlue}"/><circle cx="19.5" cy="16.11" r="2.03" fill="${matBlue}"/><path d="M20.23 15.45c-.93-.63-2.08.03-2.08 1.04 0 .81.91 1.15 1.54.74.46-.3.23-.98-.3-.98" fill="none" stroke="#FFFFFF" stroke-width=".94"/><path d="M13.35 15.12h3.62" fill="none" stroke="#FFFFFF" stroke-width=".94"/></g></svg>`,
  };
  return svgDataUri(svg[key] || svg.home);
}

function getSelectedIndex(route) {
  if (!route) return -1;
  for (let i = 0; i < TAB_DEFS.length; i++) {
    const matchers = TAB_DEFS[i].routeMatchers || [];
    if (matchers.some((m) => route === m)) {
      return i;
    }
  }
  return -1;
}

function resolveSelected(forcedSelected, currentSelected, route) {
  if (typeof forcedSelected === "number" && forcedSelected >= 0) {
    return forcedSelected;
  }
  const routeIndex = getSelectedIndex(route);
  if (routeIndex >= 0) return routeIndex;
  return Number(currentSelected) || 0;
}

Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#5B8A72",
    list: [],
    hidden: false,
  },

  lifetimes: {
    attached() {
      const pages = getCurrentPages();
      const page = pages.length ? pages[pages.length - 1] : null;
      const route = page ? page.route : "";
      const routeIndex = getSelectedIndex(route);
      this.refreshTabs(routeIndex >= 0 ? routeIndex : undefined);
    },
  },

  methods: {
    refreshTabs(forcedSelected) {
      const themeColor = pageHelper.getThemeColor();
      const pages = getCurrentPages();
      const route = pages.length ? pages[pages.length - 1].route : "";
      const selected = resolveSelected(
        forcedSelected,
        this.data.selected,
        route,
      );

      const list = TAB_DEFS.map((item, index) => ({
        key: item.key,
        text: item.text,
        icon: item.icon,
        iconSrc:
          selected === index
            ? buildActiveIcon(item.key, themeColor)
            : item.iconInactiveSrc,
        pagePath: TAB_SWITCH_URLS[index],
      }));

      this.setData({
        list,
        hidden: false,
        color: iconColors.getInactiveTabColor(),
        selectedColor: iconColors.getActiveColor(themeColor),
        selected,
      });
    },

    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index);
      if (Number.isNaN(index)) return;
      if (index === Number(this.data.selected)) return;

      const url = TAB_SWITCH_URLS[index];
      if (!url) return;

      this.setData({ selected: index, hidden: false });
      wx.switchTab({ url });
    },
  },
});
