const cloudHelper = require("../helper/cloud_helper.js");
const pageHelper = require("../helper/page_helper.js");
const cardFaceHelper = require("../helper/card_face_helper.js");

module.exports = Behavior({
  data: {
    loading: true,
    showInvalid: false,
    cardList: [],
    tenantName: "",
    listIntroTitle: "正在使用",
    listIntroSub: "",
  },

  methods: {
    onLoad() {
      this.setData({ tenantName: pageHelper.getTenantName() || "本馆" });
    },

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
        const list = ((res && res.list) || []).map((item) => {
          const visual = cardFaceHelper.enrichCardVisual(item);
          return {
            ...visual,
            shadeBg: cardFaceHelper.getCardShadeBg(visual.color, visual.coverUrl),
          };
        });
        this.setData({
          cardList: list,
          loading: false,
          listIntroTitle: this.data.showInvalid ? "已失效" : "正在使用",
          listIntroSub: this.data.showInvalid
            ? `共 ${list.length} 张 · 不可用于约课`
            : `共 ${list.length} 张会员卡`,
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
    bindOrderTap() {
      wx.navigateTo({ url: "/pages/default/my/card_order/card_order" });
    },
  },
});
