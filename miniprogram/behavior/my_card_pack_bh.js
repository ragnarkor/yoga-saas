const cloudHelper = require("../helper/cloud_helper.js");
const pageHelper = require("../helper/page_helper.js");
const cardFaceHelper = require("../helper/card_face_helper.js");

module.exports = Behavior({
  data: {
    loading: true,
    showInvalid: false,
    cardList: [],
    tenantName: "",
    // 「共 N 张」计数文案，随有效/失效视图切换
    listIntroSub: "",
    // 去约课反链：基于主卡适用范围生成的摘要区块
    goBooking: null,
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
          listIntroSub: this.data.showInvalid
            ? `共 ${list.length} 张 · 不可用于约课`
            : `共 ${list.length} 张会员卡`,
        });
        this._buildGoBooking(list);
      } catch (err) {
        console.error(err);
        this.setData({ cardList: [], loading: false, goBooking: null });
      }
    },

    // 与约课页头部玻璃条保持同一主卡规则：非待激活优先 → 次卡优先 → 到期近的优先
    _buildGoBooking(list) {
      if (this.data.showInvalid || !list || !list.length) {
        this.setData({ goBooking: null });
        return;
      }
      const usable = list.filter((c) => c && c.canBook);
      if (!usable.length) {
        this.setData({ goBooking: null });
        return;
      }
      const endRank = (c) => Number(c.endTime) || 9999999999999;
      usable.sort(
        (a, b) =>
          (a.isPending ? 1 : 0) - (b.isPending ? 1 : 0) ||
          (a.type === "times" ? 0 : 1) - (b.type === "times" ? 0 : 1) ||
          endRank(a) - endRank(b),
      );

      const main = usable[0];
      const scope = main.scope || { mode: "all" };
      let chips = [];
      if (
        scope.mode === "categories" &&
        Array.isArray(scope.categoryIds) &&
        scope.categoryIds.length
      ) {
        const names = String(main.scopeDesc || "")
          .split("、")
          .filter(Boolean);
        chips = names.slice(0, 4);
        if (names.length > 4) chips.push(`等 ${names.length} 类`);
      }

      // 适用范围只锁定一个分类时，跳回约课页自动预选该分类
      let pendingTypeId = "";
      if (
        scope.mode === "categories" &&
        scope.categoryIds &&
        scope.categoryIds.length === 1
      ) {
        pendingTypeId = String(scope.categoryIds[0]);
      }

      this.setData({
        goBooking: {
          name: main.name,
          // 反链条左侧直接展示主卡卡面（封面或品牌渐变），并叠加卡类型标签
          coverUrl: main.coverUrl || "",
          shadeBg: main.shadeBg || "",
          typeLabel: main.typeLabel || (main.type === "times" ? "次卡" : "期限卡"),
          scopeDesc: main.scopeDesc || "全馆课程",
          chips,
          pendingTypeId,
        },
      });
    },

    bindSegTap(e) {
      // wxml 绑定 data-invalid="{{!showInvalid}}" 传回的是布尔值，兼容历史字符串写法
      const raw = pageHelper.dataset(e, "invalid");
      const invalid = raw === true || raw === "true";
      if (invalid === this.data.showInvalid) return;
      this.setData({ showInvalid: invalid }, () => {
        this._loadCards();
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
    bindGoBookingTap() {
      const go = this.data.goBooking;
      if (go && go.pendingTypeId) {
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.pendingCalendarTypeId = go.pendingTypeId;
        }
      }
      wx.switchTab({ url: "/pages/default/calendar/index/calendar_index" });
    },
  },
});
