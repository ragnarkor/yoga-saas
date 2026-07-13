const AdminBiz = require("../../../../biz/admin_biz.js");
const pageHelper = require("../../../../helper/page_helper.js");
const cloudHelper = require("../../../../helper/cloud_helper.js");

Page({
  data: {
    pid: "",
    tenantName: "",
    features: {},
    isLoad: false,
  },

  onLoad: async function (options) {
    if (!AdminBiz.isAdmin(this)) return;
    if (!AdminBiz.isSuperAdmin()) {
      wx.showModal({
        title: "提示",
        content: "仅超级管理员可管理功能开关",
        showCancel: false,
        success: () => {
          wx.navigateBack();
        },
      });
      return;
    }

    const pid = options.pid || "";
    const tenantName = options.name ? decodeURIComponent(options.name) : "";
    if (!pid) {
      wx.showModal({
        title: "提示",
        content: "请从平台管理进入指定瑜伽馆",
        showCancel: false,
        success: () => wx.navigateBack(),
      });
      return;
    }

    this.setData({ pid, tenantName });
    await this._loadDetail();
  },

  _loadDetail: async function () {
    try {
      let res = await cloudHelper.callCloudData("admin/setup_feature_get", {
        pid: this.data.pid,
      });
      if (res && res.features) {
        this.setData({
          features: res.features,
          isLoad: true,
        });
      } else {
        this.setData({
          features: {
            booking: true,
            payment: false,
            teacherManage: true,
            checkin: true,
            news: true,
            selfCheckin: true,
          },
          isLoad: true,
        });
      }
    } catch (err) {
      console.error(err);
      this.setData({ isLoad: true });
    }
  },

  onFeatureChange: function (e) {
    let key = e.currentTarget.dataset.key;
    let val = e.detail.value;
    let features = this.data.features;
    features[key] = val;
    this.setData({ features });
  },

  onSave: async function () {
    try {
      let opt = {
        title: "保存中",
      };
      await cloudHelper.callCloudSumbit(
        "admin/setup_feature",
        { pid: this.data.pid, features: this.data.features },
        opt,
      );
      pageHelper.showSuccToast("保存成功");
    } catch (err) {
      console.error(err);
    }
  },
});
