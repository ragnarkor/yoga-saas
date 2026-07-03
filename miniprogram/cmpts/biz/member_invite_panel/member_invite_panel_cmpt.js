const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const themeHelper = require('../../../helper/theme_helper.js');
const invitePosterHelper = require('../../../helper/member_invite_poster_helper.js');

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    themeColor: {
      type: String,
      value: '',
    },
  },

  data: {
    loading: false,
    qrUrl: '',
    tenantName: '',
    sharePath: '',
    slogan: '',
    accentColor: pageHelper.getThemeColor(),
    accentLight: themeHelper.getThemeLight(pageHelper.getThemeColor()),
    accentDark: themeHelper.getThemeDark(pageHelper.getThemeColor()),
  },

  observers: {
    show(val) {
      if (!val) return;
      const accent = themeHelper.normalizeHex(
        this.properties.themeColor || pageHelper.getThemeColor(),
      );
      const skin = pageHelper.getSkin();
      const meetName = (skin && skin.MEET_NAME) || '约课';
      this.setData({
        accentColor: accent,
        accentLight: themeHelper.getThemeLight(accent),
        accentDark: themeHelper.getThemeDark(accent),
        slogan: `邀你加入 · 随时${meetName}`,
      });
      this._loadInvite();
    },
  },

  methods: {
    async _loadInvite() {
      this.setData({ loading: true, qrUrl: '', sharePath: '' });

      const ok = await AdminWxBiz.ensureSession();
      if (!ok) {
        wx.showToast({ title: '请先完成微信绑定', icon: 'none' });
        this.triggerEvent('close');
        return;
      }

      try {
        const res = await cloudHelper.callCloudSumbit(
          'admin/member_invite_qr',
          {},
          { title: '生成中' },
        );
        const data = (res && res.data) || {};
        const payload = {
          loading: false,
          qrUrl: data.qrUrl || '',
          tenantName: data.tenantName || pageHelper.getTenantName(),
          sharePath: data.sharePath || '',
        };
        this.setData(payload);
        this.triggerEvent('ready', payload);
      } catch (e) {
        console.error(e);
        this.setData({ loading: false });
      }
    },

    bindCloseTap() {
      this.triggerEvent('close');
    },

    async bindSaveTap() {
      const { qrUrl, tenantName, accentColor, slogan } = this.data;
      if (!qrUrl) return;

      wx.showLoading({ title: '保存中', mask: true });
      try {
        const filePath = await invitePosterHelper.exportInvitePoster(this, {
          qrUrl,
          tenantName,
          themeColor: accentColor,
          slogan,
        });
        await invitePosterHelper.saveToAlbum(filePath);
        wx.hideLoading();
        wx.showToast({ title: '已保存到相册', icon: 'success' });
      } catch (e) {
        console.error(e);
        wx.hideLoading();
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    },
  },
});
