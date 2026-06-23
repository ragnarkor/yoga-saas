const AdminBiz = require("../../../biz/admin_biz.js");
const PassportBiz = require("../../../biz/passport_biz.js");

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    /** platform=平台后台 coach=教练版超管登录 */
    mode: {
      type: String,
      value: "platform",
    },
    /** admin_home | coach | none */
    redirect: {
      type: String,
      value: "admin_home",
    },
  },

  data: {
    phone: "",
    pwd: "",
    panelTitle: "后台管理登录",
  },

  lifetimes: {
    detached() {
      this._setTabBarHidden(false);
    },
  },

  observers: {
    show(val) {
      this._setTabBarHidden(!!val);
      if (!val) return;
      AdminBiz.clearAdminToken();
      const panelTitle =
        this.properties.mode === "coach" ? "超管密码登录" : "后台管理登录";
      this.setData({ phone: "", pwd: "", panelTitle });
    },
    mode(val) {
      const panelTitle = val === "coach" ? "超管密码登录" : "后台管理登录";
      this.setData({ panelTitle });
    },
  },

  methods: {
    _setTabBarHidden: function (hidden) {
      try {
        const pages = getCurrentPages();
        const page = pages[pages.length - 1];
        if (page?.getTabBar) {
          page.getTabBar().setData({ hidden });
        }
      } catch (err) {
        console.log(err);
      }
    },

    bindFormChange: function (e) {
      const field = e.currentTarget.dataset.field;
      this.setData({ [field]: e.detail });
    },

    bindCloseTap: function () {
      this.triggerEvent("close");
    },

    bindLoginTap: async function () {
      const data = await PassportBiz.adminLogin(this.data.phone, this.data.pwd, {
        redirect: this.properties.redirect,
      });
      if (!data) return;

      if (this.properties.mode === "coach" && data.type !== "super") {
        wx.showToast({ title: "教练版请使用微信绑定登录", icon: "none" });
        AdminBiz.clearAdminToken();
        return;
      }

      if (this.properties.redirect === "none") {
        this.triggerEvent("success", data);
        this.triggerEvent("close");
      }
    },
  },
});
