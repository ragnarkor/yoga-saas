const UserProfileBiz = require('../../../../biz/user_profile_biz.js');
const cloudHelper = require('../../../../helper/cloud_helper.js');
const pageHelper = require('../../../../helper/page_helper.js');
const setting = require('../../../../setting/setting.js');

Page({
  data: {
    isLoad: false,
    userId: '',
    formName: '',
    formAvatar: [],
    avatarSrc: '',
    showAvatar: false,
    phone: '',
    submitting: false,
    themeColor: '#5b8a72',
  },

  onLoad() {
    const themeColor = pageHelper.getThemeColor() || '#5b8a72';
    wx.setNavigationBarColor({
      backgroundColor: themeColor,
      frontColor: '#ffffff',
    });
    this.setData({ themeColor });
    this._loadDetail();
  },

  onShow() {
    if (this.data.isLoad) this._loadDetail();
  },

  async _loadDetail() {
    try {
      const user = await UserProfileBiz.fetch();
      if (!user) return;

      let avatarSrc = '';
      if (user.USER_PIC) {
        avatarSrc = await UserProfileBiz.resolveAvatarUrl(user.USER_PIC);
      }

      this.setData({
        isLoad: true,
        userId: user.USER_ID || '',
        formName: user.USER_NAME || '',
        formAvatar: user.USER_PIC ? [user.USER_PIC] : [],
        avatarSrc,
        showAvatar: !!avatarSrc,
        phone: user.USER_MOBILE || '',
      });
    } catch (e) {
      console.error(e);
    }
  },

  bindChooseAvatar(e) {
    const tempPath = e.detail && e.detail.avatarUrl;
    if (!tempPath) return;
    this.setData({
      avatarSrc: tempPath,
      showAvatar: true,
      formAvatar: [tempPath],
    });
  },

  bindNameInput(e) {
    this.setData({ formName: e.detail || '' });
  },

  bindGetPhone: async function (e) {
    const user = await UserProfileBiz.syncPhoneFromEvent(e);
    if (user) {
      this.setData({ phone: user.USER_MOBILE || '' });
    }
  },

  async bindSubmitTap() {
    const name = (this.data.formName || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写名字', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;

    this.setData({ submitting: true });
    try {
      let avatarList = this.data.formAvatar || [];
      if (avatarList.length && (avatarList[0].includes('wxfile') || avatarList[0].includes('tmp'))) {
        wx.showLoading({ title: '上传头像' });
        avatarList = await cloudHelper.transTempPics(
          avatarList,
          setting.USER_PIC_PATH || 'user/pic/',
          '',
        );
        await UserProfileBiz.syncAvatar(avatarList[0]);
      }

      await UserProfileBiz.syncName(name);
      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (e) {
      console.error(e);
    } finally {
      this.setData({ submitting: false });
    }
  },
});
