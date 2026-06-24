const cloudHelper = require("../../../helper/cloud_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
const AdminBiz = require("../../../biz/admin_biz.js");

const ACTION_TITLES = {
  add: "手动加次",
  deduct: "手动消次",
  stop: "停卡",
  resume: "恢复会员卡",
};

Page({
  behaviors: [require("../../../behavior/coach_page_bh.js")],

  data: {
    cardId: "",
    loading: true,
    card: null,
    usageList: [],
    adjustShow: false,
    adjustAction: "",
    adjustTitle: "",
    adjustTimes: "1",
    adjustMemo: "",
  },

  onLoad(options) {
    this._applyCoachTheme();
    this.setData({ cardId: options.cardId || "" });
    this._loadDetail();
  },

  onShow() {
    if (!this.data.loading && this.data.cardId) {
      this._loadDetail();
    }
  },

  async _loadDetail() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    if (!this.data.cardId) {
      this.setData({ loading: false });
      return;
    }

    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData(
        "admin/user_card_detail",
        { cardId: this.data.cardId },
        { hint: false, title: "bar" },
      );
      this.setData({
        loading: false,
        card: (res && res.card) || null,
        usageList: (res && res.usageList) || [],
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, card: null });
    }
  },

  bindAdjustTap(e) {
    const action = e.currentTarget.dataset.action;
    if (!action) return;
    this.setData({
      adjustShow: true,
      adjustAction: action,
      adjustTitle: ACTION_TITLES[action] || "操作",
      adjustTimes: "1",
      adjustMemo: "",
    });
  },

  bindCloseAdjust() {
    this.setData({ adjustShow: false });
  },

  // [AI_START TIMESTAMP=2025-01-25 17:00:00]
  bindAdjustTimesInput(e) {
    this.setData({ adjustTimes: e.detail.value });
  },

  bindAdjustMemoInput(e) {
    this.setData({ adjustMemo: e.detail.value });
  },
  // [AI_END LINES=8 TIMESTAMP=2025-01-25 17:00:00]

  async bindConfirmAdjust() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) return;

    const { cardId, adjustAction, adjustTimes, adjustMemo } = this.data;
    const memo = (adjustMemo || "").trim();
    if (
      (adjustAction === "add" || adjustAction === "deduct") &&
      !(Number(adjustTimes) > 0)
    ) {
      wx.showToast({ title: "请输入有效次数", icon: "none" });
      return;
    }
    if (adjustAction !== "stop" && adjustAction !== "resume" && !memo) {
      wx.showToast({ title: "请填写备注", icon: "none" });
      return;
    }

    const admin = AdminBiz.getAdminToken();
    const operatorName = (admin && admin.name) || "";

    if (adjustAction === "stop" || adjustAction === "resume") {
      const confirm = await new Promise((resolve) => {
        wx.showModal({
          title: adjustAction === "stop" ? "确认停卡？" : "确认恢复？",
          success: (res) => resolve(res.confirm),
        });
      });
      if (!confirm) return;
    }

    try {
      await cloudHelper.callCloudSumbit(
        "admin/user_card_adjust",
        {
          cardId,
          action: adjustAction,
          times: Number(adjustTimes) || 0,
          memo: memo || (adjustAction === "stop" ? "停卡" : "恢复"),
          operatorName,
        },
        { title: "处理中" },
      );
      wx.showToast({ title: "已更新", icon: "success" });
      this.setData({ adjustShow: false });
      this._loadDetail();
    } catch (e) {
      console.error(e);
    }
  },

  bindDeleteTap() {
    const { cardId, card } = this.data;
    if (!cardId || !card) return;
    wx.vibrateShort({ type: 'light' });
    wx.showModal({
      title: '删除会员卡？',
      content: `确定删除「${card.name || '该卡'}」？删除后不可恢复，变动记录仍保留。`,
      confirmColor: '#ee0a24',
      success: async (res) => {
        if (!res.confirm) return;
        const ok = await AdminWxBiz.ensureSession();
        if (!ok) return;
        try {
          await cloudHelper.callCloudSumbit(
            'admin/user_card_del',
            { cardId },
            { title: '删除中' },
          );
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 500);
        } catch (err) {
          console.error(err);
        }
      },
    });
  },
});
