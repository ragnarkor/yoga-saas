const UserProfileBiz = require("../../../biz/user_profile_biz.js");

Component({
  properties: {
    themeColor: {
      type: String,
      value: "#5b8a72",
    },
    autoCheck: {
      type: Boolean,
      value: true,
    },
  },

  data: {
    show: false,
    formName: "",
    avatarSrc: "",
    showAvatar: false,
    submitting: false,
    user: null,
  },

  lifetimes: {
    attached() {
      if (this.properties.autoCheck) {
        this.checkProfile();
      }
    },
  },

  pageLifetimes: {
    show() {
      if (this.properties.autoCheck && !this.data.show) {
        this.checkProfile();
      }
    },
  },

  methods: {
    _setTabBarHidden(hidden) {
      try {
        const pages = getCurrentPages();
        const page = pages[pages.length - 1];
        if (page?.getTabBar) {
          page.getTabBar().setData({ hidden });
        }
      } catch (err) {
        console.warn("[profile_guide]", err);
      }
    },

    _close() {
      this.setData({ show: false });
      this._setTabBarHidden(false);
    },

    async checkProfile() {
      if (this._checking) return;
      if (UserProfileBiz.isGuideSkipped()) return;

      this._checking = true;
      try {
        const user = await UserProfileBiz.fetch();
        if (!UserProfileBiz.needsGuide(user)) {
          this.setData({ user, show: false });
          return;
        }

        let avatarSrc = "";
        if (user && user.USER_PIC) {
          avatarSrc = await UserProfileBiz.resolveAvatarUrl(user.USER_PIC);
        }

        this.setData({
          user,
          show: true,
          formName: (user && user.USER_NAME) || "",
          avatarSrc,
          showAvatar: !!avatarSrc,
        });
        this._setTabBarHidden(true);
      } catch (err) {
        console.warn("[profile_guide check]", err);
      } finally {
        this._checking = false;
      }
    },

    bindChooseAvatar: async function (e) {
      const tempPath = e.detail && e.detail.avatarUrl;
      if (!tempPath) return;

      this.setData({
        avatarSrc: tempPath,
        showAvatar: true,
      });

      try {
        const user = await UserProfileBiz.syncAvatar(tempPath);
        if (user && user.USER_PIC) {
          const avatarSrc = await UserProfileBiz.resolveAvatarUrl(user.USER_PIC);
          this.setData({
            user,
            avatarSrc: avatarSrc || tempPath,
            showAvatar: true,
          });
        }
      } catch (err) {
        console.error(err);
        wx.showToast({ title: "头像保存失败", icon: "none" });
      }
    },

    bindNameInput(e) {
      this._pendingName = (e.detail && e.detail.value) || "";
    },

    bindNameBlur(e) {
      const val = ((e.detail && e.detail.value) || this._pendingName || "").trim();
      this._pendingName = val;
      this.setData({ formName: val });
    },

    bindNicknameReview(e) {
      const val = ((e.detail && e.detail.value) || this._pendingName || "").trim();
      this._pendingName = val;
      this.setData({ formName: val });
    },

    bindSkipTap() {
      UserProfileBiz.skipGuide();
      this._close();
      this.triggerEvent("skip");
    },

    bindSaveTap: async function () {
      if (this.data.submitting) return;

      const name = (this._pendingName || this.data.formName || "").trim();
      if (!name) {
        wx.showToast({ title: "请填写昵称", icon: "none" });
        return;
      }
      if (!UserProfileBiz.hasAvatar(this.data.user, this.data.avatarSrc)) {
        wx.showToast({ title: "请选择头像", icon: "none" });
        return;
      }

      this.setData({ submitting: true });
      try {
        let user = this.data.user;
        if (!user || user.USER_NAME !== name) {
          user = await UserProfileBiz.syncName(name);
        }
        if (!user || !user.USER_NAME || !user.USER_PIC) {
          wx.showToast({ title: "请完善昵称和头像", icon: "none" });
          return;
        }

        UserProfileBiz.clearGuideSkip();
        this._close();
        this.triggerEvent("complete", { user });
        wx.showToast({ title: "资料已保存", icon: "success" });
      } catch (err) {
        console.error(err);
        wx.showToast({ title: "保存失败，请重试", icon: "none" });
      } finally {
        this.setData({ submitting: false });
      }
    },
  },
});
