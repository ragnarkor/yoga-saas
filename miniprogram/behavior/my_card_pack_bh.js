const cloudHelper = require("../helper/cloud_helper.js");
const pageHelper = require("../helper/page_helper.js");
const cardFaceHelper = require("../helper/card_face_helper.js");

module.exports = Behavior({
  data: {
    loading: true,
    showInvalid: false,
    cardList: [],
  },

  methods: {
    onLoad() {},

    onShow() {
      this._loadCards();
    },

    onPullDownRefresh() {
      this._loadCards().finally(() => wx.stopPullDownRefresh());
    },

    async _loadCards() {
      this.setData({ loading: true });
      try {
        const res = await cloudHelper.callCloudData(
          "my/my_card_list",
          { activeOnly: !this.data.showInvalid },
          { hint: false },
        );
        this.setData({
          cardList: ((res && res.list) || []).map((item) =>
            cardFaceHelper.enrichCardVisual(item),
          ),
          loading: false,
        });
      } catch (err) {
        console.error(err);
        this.setData({ cardList: [], loading: false });
      }
    },

    bindSegTap(e) {
      const invalid = pageHelper.dataset(e, "invalid") === "true";
      if (invalid === this.data.showInvalid) return;
      this.setData({ showInvalid: invalid }, () => {
        this._loadCards();
      });
    },

    bindCopyCardNo(e) {
      const no = pageHelper.dataset(e, "no");
      if (!no) return;
      wx.setClipboardData({
        data: String(no),
        success() {
          wx.showToast({ title: "卡号已复制", icon: "success" });
        },
      });
    },

    bindCardTap(e) {
      const id = pageHelper.dataset(e, "id");
      if (!id) return;
      wx.navigateTo({
        url: `/pages/default/my/card_detail/my_card_detail?id=${id}`,
      });
    },
    bindCardShopTap() {
      wx.navigateTo({ url: "/pages/default/my/card_shop/card_shop" });
    },
  },
});
