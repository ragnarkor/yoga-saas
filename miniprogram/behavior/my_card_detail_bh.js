const cloudHelper = require("../helper/cloud_helper.js");
const pageHelper = require("../helper/page_helper.js");

module.exports = Behavior({
  data: {
    id: "",
    loading: true,
    activeTab: 0,
    card: null,
    usageList: [],
    usageTotal: 0,
    tenantName: "",
  },

  methods: {
    onLoad(options) {
      if (!pageHelper.getOptions(this, options)) return;
      this.setData({
        tenantName: pageHelper.getTenantName() || "本馆",
      });
    },

    onShow() {
      this._loadDetail();
    },

    onPullDownRefresh() {
      this._loadDetail().finally(() => wx.stopPullDownRefresh());
    },

    async _loadDetail() {
      if (!this.data.id) return;
      this.setData({ loading: true });
      try {
        const res = await cloudHelper.callCloudData(
          "my/my_card_detail",
          { cardId: this.data.id },
          { title: "bar" },
        );
        if (!res || !res.card) {
          this.setData({ loading: false, card: null });
          return;
        }
        wx.setNavigationBarTitle({ title: res.card.name || "会员卡详情" });
        this.setData({
          loading: false,
          card: res.card,
          usageList: res.usageList || [],
          usageTotal: res.usageTotal || 0,
        });
      } catch (err) {
        console.error(err);
        this.setData({ loading: false, card: null });
      }
    },

    bindTabTap(e) {
      const tab = Number(pageHelper.dataset(e, "tab"));
      this.setData({ activeTab: tab });
    },

    bindCopyCardNo() {
      const no = this.data.card && this.data.card.cardNo;
      if (!no) return;
      wx.setClipboardData({
        data: String(no),
        success() {
          wx.showToast({ title: "卡号已复制", icon: "success" });
        },
      });
    },
  },
});
