const pageHelper = require("../../../helper/page_helper.js");
const cloudHelper = require("../../../helper/cloud_helper.js");

Component({
  properties: {
    title: {
      type: String,
      value: "瑜伽馆预约",
    },
    navBg: {
      type: String,
      value: "#5b8a72",
    },
  },

  data: {
    tenantName: "",
    statusBar: 20,
    customBar: 64,
  },

  lifetimes: {
    attached() {
      const app = getApp();
      const globalData = app?.globalData || {};
      this.setData({
        statusBar: globalData.statusBar || 20,
        customBar: globalData.customBar || 64,
      });
      this.refreshTenant();
    },
  },

  pageLifetimes: {
    show() {
      this.refreshTenant();
    },
  },

  methods: {
    async refreshTenant() {
      const tenant = pageHelper.getTenantInfo();
      if (tenant?.TENANT_NAME) {
        this.setData({ tenantName: tenant.TENANT_NAME });
        return;
      }

      if (!pageHelper.getPID()) {
        this.setData({ tenantName: pageHelper.getTenantName() });
        return;
      }

      try {
        const res = await cloudHelper.callCloudData(
          "tenant/detail",
          { pid: pageHelper.getPID() },
          { hint: false, title: "bar" },
        );
        if (res?.tenant) {
          pageHelper.setTenant(res.tenant);
        }
      } catch (err) {
        console.error(err);
      }

      this.setData({
        tenantName: pageHelper.getTenantName(),
      });
    },

    bindSwitchTenantTap() {
      wx.navigateTo({
        url: "/pages/tenant/select/tenant_select?switch=1",
      });
    },
  },
});
