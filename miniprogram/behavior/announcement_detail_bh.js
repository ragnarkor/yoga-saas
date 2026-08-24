const pageHelper = require('../helper/page_helper.js');
const cloudHelper = require('../helper/cloud_helper.js');
const newsContentHelper = require('../helper/news_content_helper.js');

module.exports = Behavior({
  data: {
    isLoad: false,
    detail: null,
    loadError: false,
  },

  methods: {
    onLoad: async function (options) {
      if (!options.id) return;
      this._announceId = options.id;
    },

    onShow: async function () {
      if (!this._announceId) return;
      try {
        let res = await cloudHelper.callCloudSumbit(
          'home/announce_detail',
          { id: this._announceId },
          { title: 'bar' },
        );
        const detail = (res && res.data) ? res.data : null;
        this.setData({
          detail,
          contentNodes: newsContentHelper.deltaToRichNodes(detail && detail.contentDelta),
          isLoad: true,
          loadError: false,
        });
      } catch (err) {
        console.error(err);
        // 请求本身失败（网络/云函数异常），与“云函数成功但无数据”的
        // 真实不存在场景区分开，避免把加载失败误判为公告不存在。
        this.setData({ detail: null, isLoad: true, loadError: true });
        wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      }
    },

    url: async function (e) {
      pageHelper.url(e, this);
    },
  },
});
