const pageHelper = require('../helper/page_helper.js');
const themeHelper = require('../helper/theme_helper.js');

/** 会员端页面：同步租户主题色到 page-meta、顶栏与 skin */
module.exports = Behavior({
  pageLifetimes: {
    show() {
      this._applyTheme();
    },
  },

  methods: {
    _applyTheme() {
      const color = pageHelper.getThemeColor();
      const skin = pageHelper.getSkin();
      this.setData({
        themeColor: color,
        pageStyle: themeHelper.getPageMetaStyle(color),
        skin,
      });
    },
  },
});
