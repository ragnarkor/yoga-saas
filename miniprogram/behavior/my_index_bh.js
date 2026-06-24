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
    nicknameEditing: false,
    adminLoginShow: false,
  },

  methods: {
    onLoad: async function (options) {
      if (setting.IS_SUB) wx.hideHomeButton();
      this._loadTodayList();
    },

    _loadTodayList: async function () {
      this.setData({ myTodayLoading: true });
      try {
        const raw = await cloudHelper.callCloudData(
          "my/my_join_someday",
          { day: timeHelper.time("Y-M-D") },
          { hint: false },
        );
        const list = Array.isArray(raw) ? raw.slice() : [];
        list.sort((a, b) =>
          String(a.JOIN_MEET_TIME_START || "").localeCompare(
            String(b.JOIN_MEET_TIME_START || ""),
          ),
        );
        this.setData({
          myTodayList: list,
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

        const cloudName = (user && user.USER_NAME) || "";
        // 保留本地未同步完成的昵称（防止切页面回来时被空云端数据覆盖）
        const pending = (this._pendingNickname || "").trim();
        const displayName = cloudName || pending || fallbackName || "";

        const nextData = {
          user,
          localAvatar: "",
          showAvatarImg: !!avatarSrc,
          avatarSrc,
          userNameInput: displayName,
          nicknameEditing: false,
        };
        this.setData(nextData);
        this._pendingNickname = displayName;
        this._lastSyncedNickname = cloudName;
      } catch (err) {
        console.error("[_loadUser]", err);
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
      // 不要在输入时 setData userNameInput，否则 wx:if/wx:else 会中途切换 DOM，导致输入框消失
      if (this._nicknameTimer) clearTimeout(this._nicknameTimer);
      this._nicknameTimer = setTimeout(() => {
        this._syncNickname(this._pendingNickname);
      }, 1200);
    },

    bindNicknameEditTap: function () {
      this.setData({ nicknameEditing: true });
    },

    bindNicknameBlur: async function (e) {
      const val = (e.detail.value || this._pendingNickname || "").trim();
      // 编辑完成后立即更新视图显示
      this.setData({ nicknameEditing: false, userNameInput: val });
      this._pendingNickname = val;
      await this._syncNickname(val);
    },

    bindNicknameReview: async function (e) {
      const val = (e.detail.value || this._pendingNickname || "").trim();
      this.setData({ nicknameEditing: false, userNameInput: val });
      this._pendingNickname = val;
      await this._syncNickname(val);
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
        console.error("[syncNickname error]", err);
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
