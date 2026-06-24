const cloudHelper = require("../../../helper/cloud_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");

/**
 * 会员持卡选择器（教练代约 / 扣次用）
 * 与 card-tpl-picker 字段行一致；按 userId + 可选 meetId 拉取可用卡
 */
Component({
  options: {
    addGlobalClass: true,
    multipleSlots: false,
  },

  externalClasses: ["field-class"],

  properties: {
    userId: { type: String, value: "" },
    meetId: { type: String, value: "" },
    value: { type: String, value: "" },
    themeColor: { type: String, value: "#5B8A72" },
    label: { type: String, value: "会员卡" },
    required: { type: Boolean, value: false },
    placeholder: { type: String, value: "可选" },
  },

  data: {
    cardList: [],
    selectedCard: null,
    sheetShow: false,
    loading: false,
    displayText: "",
    emptyDesc: "暂无可用会员卡",
  },

  observers: {
    "userId, meetId"() {
      this._loadCards();
    },
    value(cardId) {
      this._syncSelected(cardId);
    },
  },

  lifetimes: {
    attached() {
      this.setData({ displayText: this.data.placeholder });
      this._loadCards();
    },
  },

  methods: {
    async _loadCards() {
      const userId = (this.data.userId || "").trim();
      const meetId = (this.data.meetId || "").trim();
      if (!userId) {
        this.setData({
          cardList: [],
          selectedCard: null,
          displayText: this.data.placeholder,
          emptyDesc: "请先选择会员",
        });
        return;
      }

      this.setData({ loading: true });
      try {
        const ok = await AdminWxBiz.ensureSession();
        if (!ok) {
          this.setData({ loading: false, cardList: [] });
          return;
        }

        let list = [];
        if (meetId) {
          const res = await cloudHelper.callCloudData(
            "admin/user_join_card_options",
            { userId, meetId },
            { hint: false },
          );
          list = (res && res.list) || [];
        } else {
          const res = await cloudHelper.callCloudData(
            "admin/user_card_list",
            { userId },
            { hint: false },
          );
          list = ((res && res.list) || []).filter(
            (c) => c.isActive || c.canBook,
          );
        }

        this.setData({ cardList: list, loading: false });
        this._syncSelected(this.data.value);
        if (list.length === 1 && !this.data.value) {
          const card = list[0];
          this._applyPick(card.id, card.name, card);
        }
      } catch (e) {
        console.error("user_card_picker load error:", e);
        this.setData({ cardList: [], loading: false });
      }
    },

    _syncSelected(cardId) {
      if (!cardId) {
        this.setData({
          selectedCard: null,
          displayText: this.data.placeholder,
        });
        return;
      }
      const selectedCard =
        this.data.cardList.find((item) => item.id === cardId) || null;
      this.setData({
        selectedCard,
        displayText: selectedCard
          ? selectedCard.name
          : this.data.placeholder,
      });
    },

    bindFieldTap() {
      if (!(this.data.userId || "").trim()) {
        wx.showToast({ title: "请先选择会员", icon: "none" });
        return;
      }
      if (this.data.loading) {
        wx.showToast({ title: "加载中，请稍候", icon: "none" });
        return;
      }
      if (!this.data.cardList.length) {
        wx.showToast({ title: this.data.emptyDesc, icon: "none" });
        return;
      }
      this.setData({ sheetShow: true });
    },

    bindCloseSheet() {
      this.setData({ sheetShow: false });
    },

    bindCardPick(e) {
      const id = e.currentTarget.dataset.id;
      const name = e.currentTarget.dataset.name || "";
      const card =
        this.data.cardList.find((item) => item.id === id) || null;
      this._applyPick(id, name, card);
      this.setData({ sheetShow: false });
    },

    _applyPick(cardId, cardName, card) {
      this.setData({
        selectedCard: card,
        displayText: cardName || this.data.placeholder,
      });
      this.triggerEvent("pick", {
        cardId,
        cardName,
        card,
      });
    },
  },
});
