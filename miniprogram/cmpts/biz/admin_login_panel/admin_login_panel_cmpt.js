const AdminBiz = require("../../../biz/admin_biz.js");
const PassportBiz = require("../../../biz/passport_biz.js");
const pageHelper = require("../../../helper/page_helper.js");
const cloudHelper = require("../../../helper/cloud_helper.js");

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    phone: "",
    pwd: "",
    tenantName: "",
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
      this.setData({ phone: "", pwd: "" });
      this._loadTenantInfo();
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
    _loadTenantInfo: async function () {
      const pid = pageHelper.getPID();
      if (!pid) {
        this.setData({ tenantName: pageHelper.getTenantName() || "" });
        return;
      }

      try {
        const res = await cloudHelper.callCloudData(
          "tenant/detail",
          { pid },
          { hint: false },
        );
        if (res?.tenant) {
          pageHelper.setTenant(res.tenant);
        }
      } catch (err) {
        console.log(err);
      }

      this.setData({
        tenantName: pageHelper.getTenantName() || "未知场馆",
      });
    },

    bindFormChange: function (e) {
      const field = e.currentTarget.dataset.field;
      this.setData({ [field]: e.detail });
    },

    bindCloseTap: function () {
      this.triggerEvent("close");
    },

    bindSwitchTenantTap: function () {
      this.triggerEvent("close");
      wx.navigateTo({
        url: "/pages/tenant/select/tenant_select?switch=1",
      });
    },

    bindLoginTap: async function () {
      const pid = pageHelper.getPID();
      if (!pid) {
        wx.showToast({
          title: "请先选择瑜伽馆",
          icon: "none",
        });
        return;
      }

      const pageCtx = {
        setData: () => {},
      };
      await PassportBiz.adminLogin(this.data.phone, this.data.pwd, pageCtx);
    },
  },
});
