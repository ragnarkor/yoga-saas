const pageHelper = require('../helper/page_helper.js');
const cloudHelper = require('../helper/cloud_helper.js');

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
        this.setData({
          detail: (res && res.data) ? res.data : null,
          isLoad: true,
        });
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
