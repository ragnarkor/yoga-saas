const AdminBiz = require("../../../../biz/admin_biz.js");
const pageHelper = require("../../../../helper/page_helper.js");
const cloudHelper = require("../../../../helper/cloud_helper.js");

Page({
  /**
   * 页面的初始数据
   */
  data: {
    features: {},
    isLoad: false,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: async function (options) {
    if (!AdminBiz.isAdmin(this)) return;
    if (!AdminBiz.isSuperAdmin()) {
      wx.showModal({
        title: "提示",
        content: "仅馆长可管理功能开关",
        showCancel: false,
        success: () => {
          wx.navigateBack();
        },
      });
      return;
    }
    await this._loadDetail();
  },

  /**
   * 加载功能开关配置
   */
  _loadDetail: async function () {
    try {
      let res = await cloudHelper.callCloudData("admin/setup_feature_get", {});
      if (res && res.features) {
        this.setData({
          features: res.features,
          isLoad: true,
        });
      } else {
        // 如果没有配置，使用默认值
        this.setData({
          features: {
            booking: true,
            payment: false,
            teacherManage: false,
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

  /**
   * 功能开关切换
   */
  onFeatureChange: function (e) {
    let key = e.currentTarget.dataset.key;
    let val = e.detail.value;
    let features = this.data.features;
    features[key] = val;
    this.setData({ features });
  },

  /**
   * 保存设置
   */
  onSave: async function () {
    try {
      let opt = {
        title: "保存中",
      };
      await cloudHelper.callCloudSumbit(
        "admin/setup_feature",
        { features: this.data.features },
        opt,
      );
      pageHelper.showSuccToast("保存成功");
    } catch (err) {
      console.error(err);
    }
  },
});
