const pageHelper = require("../../../helper/page_helper.js");
const cloudHelper = require("../../../helper/cloud_helper.js");

Page({
  data: {
    loading: true,
    success: false,
    errMsg: "",
    tenantName: "",
    isNew: false,
  },

  onLoad(options) {
    let code = this._parseCode(options);
    if (!code) {
      this.setData({
        loading: false,
        errMsg: "缺少邀请参数，请通过教练分享的二维码进入",
      });
      return;
    }
    this._doJoin(code);
  },

  _parseCode(options) {
    if (options?.code) return options.code.trim();
    if (options?.scene) {
      const scene = decodeURIComponent(options.scene);
      if (scene.startsWith("i") && scene.length > 1) {
        return scene.slice(1);
      }
      return scene;
    }
    return "";
  },

  async _doJoin(code) {
    try {
      const res = await cloudHelper.callCloudSumbit(
        "passport/join_tenant",
        { code },
        { title: "加入中" },
      );
      const data = (res && res.data) || {};
      if (data.tenant) {
        pageHelper.setTenant(data.tenant);
      }

      this.setData({
        loading: false,
        success: true,
        tenantName: data.tenant?.TENANT_NAME || pageHelper.getTenantName(),
        isNew: !!data.isNew,
      });
    } catch (e) {
      console.error(e);
      this.setData({
        loading: false,
        errMsg: (e && e.msg) || "加入失败，请确认邀请码是否有效",
      });
    }
  },

  bindGoHome() {
    const template = pageHelper.getTemplate();
    if (template === "default") {
      wx.switchTab({ url: "/pages/default/index/default_index" });
    } else {
      wx.reLaunch({
        url: pageHelper.fmtURLByPID("/pages/index/default_index"),
      });
    }
  },

  bindGoMy() {
    wx.switchTab({ url: "/pages/default/my/index/my_index" });
  },
});
