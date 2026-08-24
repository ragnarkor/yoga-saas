const cacheHelper = require("../helper/cache_helper.js");
const pageHelper = require("../helper/page_helper.js");
const cloudHelper = require("../helper/cloud_helper.js");
const timeHelper = require("../helper/time_helper.js");
const PassportBiz = require("../biz/passport_biz.js");
const UserProfileBiz = require("../biz/user_profile_biz.js");
const AdminWxBiz = require("../biz/admin_wx_biz.js");
const AdminBiz = require("../biz/admin_biz.js");
const setting = require("../setting/setting.js");

module.exports = Behavior({
  data: {
    myTodayList: [],
    myTodayLoading: false,
    showAvatarImg: false,
    avatarSrc: "",
    userNameInput: "",
    adminLoginShow: false,
    achievementSummary: "预约成功即计入成就",
  },

  methods: {
    onLoad: async function (options) {
      if (setting.IS_SUB) wx.hideHomeButton();
      this._loadTodayList();
    },

    _loadTodayList: async function () {
      // 首页 onLoad 后会紧接着触发 onShow，避免同一秒内重复请求今日约课。
      const now = Date.now();
      if (this._todayListPromise) return this._todayListPromise;
      if (this._todayListLoadedAt && now - this._todayListLoadedAt < 15000) return;
      this.setData({ myTodayLoading: true });
      this._todayListPromise = (async () => {
        try {
          const raw = await cloudHelper.callCloudData(
          "my/my_join_someday",
          { day: timeHelper.time("Y-M-D") },
          { hint: false },
          );
          const list = Array.isArray(raw) ? raw.slice() : [];
          list.sort((a, b) => String(a.JOIN_MEET_TIME_START || "").localeCompare(String(b.JOIN_MEET_TIME_START || "")));
          this._todayListLoadedAt = Date.now();
          this.setData({ myTodayList: list, myTodayLoading: false });
        } catch (err) {
          console.error(err);
          this.setData({ myTodayList: [], myTodayLoading: false });
        } finally {
          this._todayListPromise = null;
        }
      })();
      return this._todayListPromise;
    },

    onReady: function () {},

    onShow: function () {
      this._loadTodayList();
      this._loadUser();
      this._loadAchievementSummary();
    },

    onUnload: function () {},

    _loadAchievementSummary: async function () {
      try {
        const data = await cloudHelper.callCloudData(
          "my/achievement",
          {},
          { hint: false },
        );
        const total = (data && data.streak && data.streak.totalClasses) || 0;
        this.setData({
          achievementSummary: total ? `已上课 ${total} 次` : "预约成功即计入成就",
        });
      } catch (e) {
        console.warn("[achievement summary]", e);
      }
    },

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
      if (AdminWxBiz.isSuperSession()) {
        const ok = await AdminWxBiz.prepareCoachEntry();
        if (!ok) return;
        wx.navigateTo({ url: "/pages/coach/index/coach_index" });
        return;
      }
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
      await this._loadTodayList();
      await this._loadUser();
      wx.stopPullDownRefresh();
    },

    onReachBottom: function () {},

    onShareAppMessage: function () {},

    url: function (e) {
      pageHelper.url(e, this);
    },

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
