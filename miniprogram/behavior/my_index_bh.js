const cacheHelper = require("../helper/cache_helper.js");
const pageHelper = require("../helper/page_helper.js");
const PassportBiz = require("../biz/passport_biz.js");
const UserProfileBiz = require("../biz/user_profile_biz.js");
const AdminWxBiz = require("../biz/admin_wx_biz.js");
const AdminBiz = require("../biz/admin_biz.js");
const setting = require("../setting/setting.js");

module.exports = Behavior({
  data: {
    showAvatarImg: false,
    avatarSrc: "",
    userNameInput: "",
    adminLoginShow: false,
  },

  methods: {
    onLoad: async function (options) {
      if (setting.IS_SUB) wx.hideHomeButton();
    },

    onReady: function () {},

    onShow: function () {
      this._loadUser();
    },
    onUnload: function () {},

    _loadUser: async function () {
      try {
        const user = await UserProfileBiz.fetch();

        const admin = AdminBiz.getAdminToken();
        const fallbackName = admin && admin.name ? admin.name : "";

        // 与教练版同步：先解析头像 URL 再 setData，避免 cloud:// 原始链接无法渲染
        let avatarSrc = "";
        if (user && user.USER_PIC) {
          avatarSrc = await UserProfileBiz.resolveAvatarUrl(user.USER_PIC);
        }

        const cloudName = (user && user.USER_NAME) || "";
        const displayName = cloudName || fallbackName || "";

        this.setData({
          user,
          showAvatarImg: !!avatarSrc,
          avatarSrc,
          userNameInput: displayName,
        });
      } catch (err) {
        console.error("[_loadUser]", err);
      }
    },

    bindProfileTap: function () {
      wx.navigateTo({ url: '/pages/default/my/edit/my_edit' });
    },

    bindSwitchCoachTap: async function () {
      const ok = await AdminWxBiz.prepareCoachEntry();
      if (!ok) return;
      wx.navigateTo({
        url: "/pages/coach/index/coach_index",
      });
    },

    bindAnnounceEntryTap: function () {
      wx.navigateTo({
        url: "/pages/default/announcement/list/announcement_list",
      });
    },

    onPullDownRefresh: async function () {
      await this._loadUser();
      wx.stopPullDownRefresh();
    },

    onReachBottom: function () {},

    onShareAppMessage: function () {},

    bindSetTap: function (e) {
      this.setTap(e, this.data.skin);
    },

    bindContactAuthorTap: function () {
      wx.showModal({
        title: '联系作者',
        content: '如需了解更多定制开发详情，请通过官方渠道联系作者。',
        showCancel: false,
        confirmText: '知道了',
      });
    },

    bindAdminLoginCloseTap: function () {
      this.setData({ adminLoginShow: false });
    },

    setTap: function (e, skin) {
      let itemList = ["清除缓存", "后台管理"];
      wx.showActionSheet({
        itemList,
        success: async (res) => {
          let idx = res.tapIndex;
          if (idx == 0) {
            cacheHelper.clear();
            pageHelper.showNoneToast("清除缓存成功");
          }

          if (idx == 1) {
            pageHelper.setSkin(skin);
            if (setting.IS_SUB) {
              PassportBiz.adminLogin("admin", "123456", { redirect: "admin_home" });
            } else {
              this.setData({ adminLoginShow: true });
            }
          }
        },
        fail: function (res) {},
      });
    },
  },
});
