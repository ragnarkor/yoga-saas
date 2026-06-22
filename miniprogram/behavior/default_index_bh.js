const pageHelper = require('../helper/page_helper.js');
const cloudHelper = require('../helper/cloud_helper.js');
const setting = require('../setting/setting.js');

function buildLinkUrl(linkType, linkId) {
  switch (linkType) {
    case 'about':
      return '/pages/default/about/index/about_index';
    case 'news':
      return linkId ? '/pages/default/news/detail/news_detail?id=' + linkId : '';
    case 'meet':
      return linkId ? '/pages/default/meet/detail/meet_detail?id=' + linkId : '';
    case 'announce':
      return linkId ? '/pages/default/announcement/detail/announcement_detail?id=' + linkId : '';
    default:
      return '';
  }
}

function mapBanner(item) {
  return {
    _id: item._id,
    type: item.type,
    title: item.title,
    pic: pageHelper.fmtImgUrl(item.pic),
    video: pageHelper.fmtImgUrl(item.video),
    linkType: item.linkType,
    linkId: item.linkId,
    linkUrl: buildLinkUrl(item.linkType, item.linkId),
  };
}

function mapTeacher(item) {
  let pics = (item.pics || []).map((p) => pageHelper.fmtImgUrl(p));
  let avatar = pageHelper.fmtImgUrl(item.avatar);
  return {
    _id: item._id,
    name: item.name,
    specialty: item.specialty,
    desc: item.desc,
    avatar,
    pics,
    cover: pageHelper.fmtImgUrl(item.cover) || pics[0] || avatar,
  };
}

function mapPhoto(item) {
  return {
    _id: item._id,
    title: item.title,
    desc: item.desc,
    pic: pageHelper.fmtImgUrl(item.pic),
    linkType: item.linkType,
    linkId: item.linkId,
    linkUrl: buildLinkUrl(item.linkType, item.linkId),
  };
}

module.exports = Behavior({
  data: {
    isLoad: false,
    phone: '',
    tenantName: '',
    tenantDesc: '',
    banners: [],
    announcements: [],
    teachers: [],
    photos: [],
  },

  methods: {
    _applyTenantInfo: function () {
      const tenant = pageHelper.getTenantInfo();
      this.setData({
        tenantName: tenant?.TENANT_NAME || pageHelper.getTenantName() || '瑜伽馆',
        tenantDesc: tenant?.TENANT_DESC || '',
      });
    },

    onLoad: async function () {
      if (setting.IS_SUB) wx.hideHomeButton();
      this._skipShowRefresh = true;
      this._applyTenantInfo();
      this.setData({ isLoad: true });
      await this._fetchHome();
    },

    _fetchHome: async function () {
      if (!setting.PID && !pageHelper.getPID()) {
        wx.reLaunch({ url: '/pages/tenant/select/tenant_select' });
        return;
      }

      try {
        let data = await cloudHelper.callCloudData(
          'home/index',
          {},
          { hint: false, title: 'bar' },
        );
        if (!data) return;

        this.setData({
          phone: data.phone || '',
          banners: (data.banners || []).map(mapBanner),
          announcements: data.announcements || [],
          teachers: (data.teachers || []).map(mapTeacher),
          photos: (data.photos || []).map(mapPhoto),
        });
      } catch (err) {
        console.error('[home/index]', err);
      }
    },

    onShow: async function () {
      if (this._skipShowRefresh) {
        this._skipShowRefresh = false;
        return;
      }
      this._applyTenantInfo();
      if (!this.data.isLoad) return;
      await this._fetchHome();
    },

    onPullDownRefresh: async function () {
      await this._fetchHome();
      wx.stopPullDownRefresh();
    },

    bindPhoneTap: function () {
      let phone = this.data.phone;
      if (!phone) {
        pageHelper.showNoneToast('暂未配置联系电话');
        return;
      }
      wx.makePhoneCall({ phoneNumber: phone });
    },

    bindSearchTap: function () {
      wx.navigateTo({
        url: '/pages/default/search/search?type=home',
      });
    },

    bindBannerTap: function (e) {
      let url = e.currentTarget.dataset.url;
      if (!url) return;
      wx.navigateTo({ url: pageHelper.fmtURLByPID(url) });
    },

    bindAnnounceTap: function (e) {
      let id = e.currentTarget.dataset.id;
      if (!id) return;
      wx.navigateTo({
        url: '/pages/default/announcement/detail/announcement_detail?id=' + id,
      });
    },

    bindTeacherTap: function (e) {
      let id = e.currentTarget.dataset.id;
      if (!id) return;
      wx.navigateTo({
        url: '/pages/default/teacher/detail/teacher_detail?id=' + id,
      });
    },

    bindPhotoTap: function (e) {
      let index = e.currentTarget.dataset.index;
      let item = this.data.photos[index];
      if (!item) return;
      if (item.linkUrl) {
        wx.navigateTo({ url: pageHelper.fmtURLByPID(item.linkUrl) });
        return;
      }
      let urls = this.data.photos.map((p) => p.pic).filter(Boolean);
      if (urls.length) {
        wx.previewImage({ current: item.pic, urls });
      }
    },

    url: async function (e) {
      pageHelper.url(e, this);
    },

    onShareAppMessage: function () {},
  },
});
