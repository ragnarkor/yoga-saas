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
    localAvatar: "",
    showAvatarImg: false,
    avatarSrc: "",
    userNameInput: "",
    avatarChoosing: false,
  },

  methods: {
    onLoad: async function (options) {
      if (setting.IS_SUB) wx.hideHomeButton();
      this._loadTodayList();
    },

    _loadTodayList: async function () {
      this.setData({ myTodayLoading: true });
      try {
        const list = await cloudHelper.callCloudData(
          "my/my_join_someday",
          { day: timeHelper.time("Y-M-D") },
          { hint: false },
        );
        this.setData({
          myTodayList: Array.isArray(list) ? list : [],
          myTodayLoading: false,
        });
      } catch (err) {
        console.error(err);
        this.setData({ myTodayList: [], myTodayLoading: false });
      }
    },

    onReady: function () {},

    onShow: function () {
      this._loadTodayList();
      this._loadUser();
    },

    onHide: async function () {
      const pending = (this._pendingNickname || "").trim();
      if (pending) await this._syncNickname(pending);
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

        const nextData = {
          user,
          localAvatar: "",
          showAvatarImg: !!avatarSrc,
          avatarSrc,
          userNameInput: (user && user.USER_NAME) || fallbackName || "",
        };
        this.setData(nextData);
        this._pendingNickname = this.data.userNameInput;
        this._lastSyncedNickname = (user && user.USER_NAME) || "";
      } catch (err) {
        console.error(err);
      }
    },

    bindAvatarTap: function () {
      if (this.data.avatarChoosing) return;
      this.setData({ avatarChoosing: true });
      if (this._avatarChooseTimer) clearTimeout(this._avatarChooseTimer);
      this._avatarChooseTimer = setTimeout(() => {
        this.setData({ avatarChoosing: false });
      }, 1500);
    },

    bindChooseAvatar: async function (e) {
      if (this._avatarSaving) return;
      const tempPath = e.detail && e.detail.avatarUrl;
      if (!tempPath) {
        this.setData({ avatarChoosing: false });
        return;
      }

      this._avatarSaving = true;
      if (this._avatarChooseTimer) clearTimeout(this._avatarChooseTimer);

      this.setData({
        localAvatar: tempPath,
        showAvatarImg: true,
        avatarSrc: tempPath,
        avatarChoosing: true,
      });

      try {
        const user = await UserProfileBiz.syncAvatar(tempPath);
        if (user && user.USER_PIC) {
          const avatarSrc = await UserProfileBiz.resolveAvatarUrl(
            user.USER_PIC,
          );
          this.setData({
            user,
            localAvatar: "",
            showAvatarImg: true,
            avatarSrc: avatarSrc || tempPath,
            avatarChoosing: false,
          });
          wx.showToast({ title: "头像已保存", icon: "success" });
        } else {
          this.setData({ avatarChoosing: false });
        }
      } catch (err) {
        console.error(err);
        wx.showToast({ title: "头像保存失败，请重试", icon: "none" });
        this.setData({ avatarChoosing: false });
      } finally {
        this._avatarSaving = false;
      }
    },

    bindNicknameInput: function (e) {
      const val = e.detail.value || "";
      this._pendingNickname = val;
      this.setData({ userNameInput: val });
      if (this._nicknameTimer) clearTimeout(this._nicknameTimer);
      this._nicknameTimer = setTimeout(() => {
        this._syncNickname(this._pendingNickname);
      }, 1200);
    },

    bindNicknameBlur: async function (e) {
      await this._syncNickname(e.detail.value || this._pendingNickname);
    },

    bindNicknameReview: async function (e) {
      await this._syncNickname(e.detail.value || this._pendingNickname);
    },

    _syncNickname: async function (name) {
      const val = (name || "").trim();
      if (!val) return;
      if (val === this._lastSyncedNickname) return;

      try {
        const user = await UserProfileBiz.syncName(val);
        if (user) {
          this.setData({
            user,
            userNameInput: user.USER_NAME || val,
          });
          this._pendingNickname = user.USER_NAME || val;
          this._lastSyncedNickname = user.USER_NAME || val;
        }
      } catch (err) {
        console.error(err);
      }
    },

    bindGetPhone: async function (e) {
      const user = await UserProfileBiz.syncPhoneFromEvent(e);
      if (user) {
        this.setData({ user });
      }
    },

    bindSwitchCoachTap: async function () {
      const ok = await AdminWxBiz.prepareCoachEntry();
      if (!ok) return;
      wx.navigateTo({
        url: "/pages/coach/index/coach_index",
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
              PassportBiz.adminLogin("admin", "123456", this);
            } else {
              wx.reLaunch({
                url: "/pages/admin/index/login/admin_login",
              });
            }
          }
        },
        fail: function (res) {},
      });
    },
  },
});
