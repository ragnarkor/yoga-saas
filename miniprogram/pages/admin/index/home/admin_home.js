const AdminBiz = require("../../../../biz/admin_biz.js");
const pageHelper = require("../../../../helper/page_helper.js");
const cloudHelper = require("../../../../helper/cloud_helper.js");

Page({
  /**
   * 页面的初始数据
   */
  data: {},

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: async function (options) {
    if (!AdminBiz.isAdmin(this)) return;

    this._loadDetail();
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: async function () {
    await this._loadDetail();
    wx.stopPullDownRefresh();
  },

  _loadDetail: async function () {
    let admin = AdminBiz.getAdminToken();
    this.setData({
      isLoad: true,
      admin,
    });

    try {
      let opts = {
        title: "bar",
      };
      let res = await cloudHelper.callCloudData("admin/home", {}, opts);
      this.setData({
        data: res,
      });
    } catch (err) {
      console.log(err);
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {},

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {},

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {},

  url: function (e) {
    pageHelper.url(e, this);
  },

  // [AI_START TIMESTAMP=2025-01-25 18:30:00]
  /** 超级管理员：选择馆 */
  bindTenantTap: function (e) {
    let pid = e.currentTarget.dataset.pid;
    let name = e.currentTarget.dataset.name;
    if (!pid) return;

    pageHelper.setPID(pid);
    pageHelper.showSuccToast("已切换到「" + name + "」", 1500, () => {
      this._loadDetail();
    });
  },

  /** 超级管理员：切换回馆列表 */
  bindSwitchTenantTap: function (e) {
    pageHelper.clearPID();
    this._loadDetail();
  },
  // [AI_END LINES=15 TIMESTAMP=2025-01-25 18:30:00]

  bindExitTap: function (e) {
    let callback = function () {
      AdminBiz.clearAdminToken();
      wx.reLaunch({
        url: pageHelper.fmtURLByPID("/pages/my/index/my_index"),
      });
    };
    pageHelper.showConfirm("您确认退出?", callback);
  },

  bindSettingTap: function (e) {
    let itemList = ["清除数据缓存"];
    wx.showActionSheet({
      itemList,
      success: async (res) => {
        switch (res.tapIndex) {
          case 0: {
            //清除缓存
            await this._clearCache();
            break;
          }
        }
      },
      fail: function (res) {},
    });
  },

  _clearCache: async function () {
    try {
      let opts = {
        title: "数据缓存清除中",
      };
      await cloudHelper
        .callCloudSumbit("admin/clear_cache", {}, opts)
        .then((res) => {
          pageHelper.showSuccToast("清除成功");
        });
    } catch (err) {
      console.error(err);
    }
  },
});
