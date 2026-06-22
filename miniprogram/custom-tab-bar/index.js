const pageHelper = require("../helper/page_helper.js");
const iconColors = require("../helper/icon_colors.js");

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
    routeMatchers: [
      "pages/default/index/default_index",
      "projects/A00/index/default_index",
    ],
  },
  {
    key: "calendar",
    text: "约课",
    icon: "calendar-o",
    routeMatchers: ["pages/default/calendar/index/calendar_index"],
  },
  {
    key: "cate1",
    text: "课程",
    icon: "notes-o",
    routeMatchers: ["pages/default/news/cate1/news_cate1"],
  },
  {
    key: "my",
    text: "我的",
    icon: "smile-o",
    routeMatchers: ["pages/default/my/index/my_index"],
  },
];

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
