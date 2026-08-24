const cloudHelper = require("../helper/cloud_helper.js");
const pageHelper = require("../helper/page_helper.js");
const cardFaceHelper = require("../helper/card_face_helper.js");

module.exports = Behavior({
  data: {
    id: "",
    loading: true,
    activeTab: 0,
    showCardBack: false,
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
        const card = this._enrichCardDetail(
          cardFaceHelper.enrichCardVisual(res.card),
        );
        this.setData({
          loading: false,
          card,
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

    bindToggleCardFace() {
      this.setData({ showCardBack: !this.data.showCardBack });
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

    _enrichCardDetail(card) {
      if (!card) return card;
      const scope = card.scope || {};
      const scopeMode =
        scope.mode === "categories" && (scope.categoryIds || []).length
          ? "categories"
          : "all";
      let scopeCategoryNames = [];
      if (scopeMode === "categories" && card.scopeDesc) {
        scopeCategoryNames = String(card.scopeDesc)
          .split("、")
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const enriched = {
        ...card,
        scopeMode,
        scopeCategoryNames,
      };

      if (card.type === "period") {
        enriched.usageRuleText = "有效期内预约上课不扣次，可重复预约";
        enriched.validDaysText =
          card.validDays > 0 ? `${card.validDays}天` : "";
      } else {
        const init = Number(card.quotaInit) || 0;
        const left = Number(card.quota) || 0;
        enriched.usedTimes = Math.max(0, init - left);
        enriched.usageRuleText = "每次上课按课程设置扣减卡内次数";
      }

      enriched.shadeBg = cardFaceHelper.getCardShadeBg(
        enriched.color,
        enriched.coverUrl,
      );

      return enriched;
    },
  },
});
