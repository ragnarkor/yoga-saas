const pageHelper = require('../helper/page_helper.js');
const cloudHelper = require('../helper/cloud_helper.js');
const newsContentHelper = require('../helper/news_content_helper.js');

module.exports = Behavior({
  data: {
    isLoad: false,
    detail: null,
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
        this.setData({ detail, contentNodes: newsContentHelper.deltaToRichNodes(detail && detail.contentDelta), isLoad: true });
      } catch (err) {
        console.error(err);
        this.setData({ detail: null, isLoad: true });
      }
    },

    url: async function (e) {
      pageHelper.url(e, this);
    },
  },
});
