const pageHelper = require("../helper/page_helper.js");

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
    iconPath: "/pages/default/skin/images/tabbar/home.png",
    selectedIconPath: "/pages/default/skin/images/tabbar/home_cur.png",
    routeMatchers: [
      "pages/default/index/default_index",
      "projects/A00/index/default_index",
    ],
  },
  {
    key: "calendar",
    text: "约课",
    iconPath: "/pages/default/skin/images/tabbar/day.png",
    selectedIconPath: "/pages/default/skin/images/tabbar/day_cur.png",
    routeMatchers: ["pages/default/calendar/index/calendar_index"],
  },
  {
    key: "cate1",
    text: "课程",
    iconPath: "/pages/default/skin/images/tabbar/cate1.png",
    selectedIconPath: "/pages/default/skin/images/tabbar/cate1_cur.png",
    routeMatchers: ["pages/default/news/cate1/news_cate1"],
  },
  {
    key: "my",
    text: "我的",
    iconPath: "/pages/default/skin/images/tabbar/my.png",
    selectedIconPath: "/pages/default/skin/images/tabbar/my_cur.png",
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

Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#5B8A72",
    list: [],
  },

  lifetimes: {
    attached() {
      this.refreshTabs();
    },
  },

  pageLifetimes: {
    show() {
      wx.nextTick(() => this.refreshTabs());
    },
  },

  methods: {
    refreshTabs() {
      const skin = pageHelper.getSkin();
      const pages = getCurrentPages();
      const route = pages.length ? pages[pages.length - 1].route : "";
      const selected = getSelectedIndex(route);
      const list = TAB_DEFS.map((item, index) => ({
        key: item.key,
        text: item.text,
        iconPath: item.iconPath,
        selectedIconPath: item.selectedIconPath,
        pagePath:
          index === 0
            ? pageHelper.fmtURLByPID("/pages/index/default_index")
            : TAB_SWITCH_URLS[index],
      }));
      const patch = {
        list,
        selectedColor: skin.NAV_BG || "#5B8A72",
      };
      if (selected >= 0) {
        patch.selected = selected;
      }
      this.setData(patch);
    },

    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      if (index === this.data.selected) return;

      this.setData({ selected: index });

      if (index === 0) {
        wx.reLaunch({
          url: pageHelper.fmtURLByPID("/pages/index/default_index"),
        });
        return;
      }

      const url = TAB_SWITCH_URLS[index];
      if (url) {
        wx.switchTab({ url });
      }
    },
  },
});
