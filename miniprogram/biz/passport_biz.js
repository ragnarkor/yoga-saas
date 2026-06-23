/**
 * Notes: 注册登录模块业务逻辑
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux@qq.com
 * Date: 2020-11-14 07:48:00
 */

const BaseBiz = require("./base_biz.js");
const AdminBiz = require("./admin_biz.js");
const setting = require("../setting/setting.js");
const dataHelper = require("../helper/data_helper.js");
const cloudHelper = require("../helper/cloud_helper.js");
// [AI_START TIMESTAMP=2025-01-25 17:00:00]
const pageHelper = require("../helper/page_helper.js");
// [AI_END LINES=1 TIMESTAMP=2025-01-25 17:00:00]

class PassportBiz extends BaseBiz {
  /**
   * 页面初始化 分包下使用
   * @param {*} skin
   * @param {*} that
   * @param {*} isLoadSkin  是否skin加载为data
   * @param {*} tabIndex 	是否修改本页标题为设定值
   * @param {*} isModifyNavColor 	是否修改头部导航颜色
   */
  static async initPage({
    skin,
    that,
    isLoadSkin = false,
    tabIndex = -1,
    isModifyNavColor = true,
  }) {
    if (isModifyNavColor) {
      wx.setNavigationBarColor({
        //顶部
        backgroundColor: skin.NAV_BG,
        frontColor: skin.NAV_COLOR,
      });
    }

    if (tabIndex > -1) {
      wx.setNavigationBarTitle({
        title: skin.MENU_ITEM[tabIndex],
      });
    }

    skin.IS_SUB = setting.IS_SUB;
    if (isLoadSkin) {
      skin.newsCateArr = dataHelper.getSelectOptions(skin.NEWS_CATE);
      skin.meetTypeArr = dataHelper.getSelectOptions(skin.MEET_TYPE);
      that.setData({
        skin,
      });
    }
  }

  /**
   * @param {object} options
   * @param {'admin_home'|'coach'|'none'} options.redirect 登录成功后的跳转
   */
  static async adminLogin(phone, pwd, options = {}) {
    const redirect = options.redirect || "admin_home";

    if (phone.length < 5 || phone.length > 30) {
      wx.showToast({
        title: "手机号输入错误",
        icon: "none",
      });
      return null;
    }

    if (pwd.length < 5 || pwd.length > 30) {
      wx.showToast({
        title: "密码输入错误(5-30位)",
        icon: "none",
      });
      return null;
    }

    const params = { phone, pwd };
    const opt = { title: "登录中" };

    try {
      const res = await cloudHelper.callCloudSumbit("admin/login", params, opt);
      const data = res && res.data;
      if (!data || !data.name) return null;

      AdminBiz.adminLogin(data);
      if (data.type === "super") {
        pageHelper.clearPID();
      } else if (data.pid) {
        pageHelper.setPID(data.pid);
      }

      if (redirect === "admin_home") {
        wx.reLaunch({ url: "/pages/admin/index/home/admin_home" });
      } else if (redirect === "coach") {
        wx.reLaunch({ url: "/pages/coach/index/coach_index" });
      }

      return data;
    } catch (e) {
      console.log(e);
      return null;
    }
  }
}

module.exports = PassportBiz;
