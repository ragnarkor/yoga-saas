// [AI_START TIMESTAMP=2025-01-27 10:20:00]
const cloudHelper = require("../../../helper/cloud_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");

/**
 * 卡片分组：图标颜色统一使用 themeColor（页面主题色），不再五颜六色。
 * 分两组：概况 + 需关注，让教练一眼定位要跟进的会员。
 */
const SECTIONS = [
  {
    title: "会员概况",
    desc: "掌握整体会员动态",
    cards: [
      { label: "全部会员卡", key: "totalCards", icon: "friends-o" },
      { label: "本月新增会员", key: "monthNew", icon: "add-o" },
      { label: "本月新增会员卡", key: "newCard", icon: "coupon-o" },
      { label: "本月生日", key: "monthBirthday", icon: "gift-o" },
    ],
  },
  {
    title: "需关注会员",
    desc: "及时跟进，减少流失",
    alert: true,
    cards: [
      { label: "30天未上课", key: "inactive30", icon: "warning-o" },
      { label: "流失会员", key: "churn", icon: "close" },
      { label: "即将到期", key: "expiringSoon", icon: "clock-o" },
      { label: "次数不足", key: "lowTimes", icon: "info-o" },
      { label: "储蓄不足", key: "lowBalance", icon: "gold-coin-o" },
    ],
  },
];

Page({
  behaviors: [require("../../../behavior/coach_page_bh.js")],

  data: {
    sections: SECTIONS.map((s) => ({
      ...s,
      cards: s.cards.map((c) => ({ ...c, num: 0 })),
    })),
    totalMembers: 0,
    loading: false,
  },

  onShow() {
    this._coachOnShow();
    this._loadStats();
  },

  async bindCoachTenantChange() {
    await this._coachOnShow();
    this._loadStats();
  },

  async _loadStats() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) return;

    this.setData({ loading: true });
    try {
      const stats = await cloudHelper.callCloudData(
        "admin/member_stats",
        {},
        { hint: false, title: "bar" },
      );
      const sections = SECTIONS.map((s) => ({
        ...s,
        cards: s.cards.map((c) => ({
          ...c,
          num: stats && stats[c.key] != null ? stats[c.key] : 0,
        })),
      }));
      const totalMembers =
        stats && stats.totalMembers != null ? stats.totalMembers : 0;
      this.setData({ sections, totalMembers, loading: false });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  async onCardTap(e) {
    const key = e.currentTarget.dataset.key;
    if (key === "totalCards") {
      if (
        !(await this._coachBeforeAdmin("/pages/coach/card/coach_card_list"))
      )
        return;
      wx.navigateTo({ url: "/pages/coach/card/coach_card_list" });
      return;
    }
    if (key === "newCard") {
      if (
        !(await this._coachBeforeAdmin(
          "/pages/coach/member/coach_month_new_card",
        ))
      )
        return;
      wx.navigateTo({ url: "/pages/coach/member/coach_month_new_card" });
      return;
    }
    if (
      !(await this._coachBeforeAdmin("/pages/coach/member/coach_member_list"))
    )
      return;
    wx.navigateTo({ url: "/pages/coach/member/coach_member_list" });
  },
});
// [AI_END LINES=76 TIMESTAMP=2025-01-27 10:20:00]
