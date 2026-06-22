const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const picHelper = require('../../../helper/pic_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

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
    accentColor: pageHelper.getThemeColor(),
  },

  observers: {
    show(val) {
      if (!val) return;
      this.setData({ accentColor: this.properties.themeColor || pageHelper.getThemeColor() });
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

    bindSaveTap() {
      const url = this.data.qrUrl;
      if (!url) return;

      wx.showLoading({ title: '保存中', mask: true });
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode !== 200) {
            wx.hideLoading();
            wx.showToast({ title: '下载失败', icon: 'none' });
            return;
          }
          const callback = () => {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => {
                wx.hideLoading();
                wx.showToast({ title: '已保存到相册', icon: 'success' });
              },
              fail: () => {
                wx.hideLoading();
                wx.showToast({ title: '保存失败', icon: 'none' });
              },
            });
          };
          picHelper.getWritePhotosAlbum(callback);
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '下载失败', icon: 'none' });
        },
      });
    },
  },
});
