const cloudHelper = require("../../../helper/cloud_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");
const AdminBiz = require("../../../biz/admin_biz.js");
const timeHelper = require("../../../helper/time_helper.js");

Page({
  behaviors: [require("../../../behavior/coach_page_bh.js")],

  data: {
    loading: true,
    today: "",
    sessionList: [],
  },

  onLoad() {
    this._applyCoachTheme();
    this.setData({ today: timeHelper.time("Y-M-D") });
  },

  onShow() {
    this._coachOnShow();
    this._loadList();
  },

  onPullDownRefresh() {
    this._loadList().finally(() => wx.stopPullDownRefresh());
  },

  async bindCoachTenantChange() {
    await this._coachOnShow();
    this._applyCoachTheme();
    this._loadList();
  },

  async _loadList() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false, sessionList: [] });
      return;
    }

    this.setData({ loading: true });
    const today = this.data.today || timeHelper.time("Y-M-D");
    const admin = AdminBiz.getAdminToken();
    const onlyMine =
      admin && admin.type === "teacher" && !AdminWxBiz.isSuperSession() ? 1 : 0;

    try {
      const res = await cloudHelper.callCloudData(
        "admin/schedule_week",
        {
          startDay: today,
          endDay: today,
          includeInactive: 1,
          onlyMine,
        },
        { hint: false, title: "bar" },
      );
      const slots = (res && res.slots) || [];
      const sessionList = slots
        .filter((s) => s.day === today && Number(s.slotStatus) !== 0)
        .map((s) => {
          const stat = s.stat || {};
          const booked = Number(stat.succCnt) || 0;
          return {
            meetId: s.meetId,
            mark: s.mark,
            title: s.title || "课程",
            typeName: s.typeName || "",
            teacherName: s.teacherName || "",
            start: s.start,
            end: s.end,
            booked,
            timeText: `${s.start || ""}–${s.end || ""}`,
          };
        })
        .sort((a, b) =>
          String(a.start || "").localeCompare(String(b.start || "")),
        );

      this.setData({ sessionList, loading: false });
    } catch (e) {
      console.error(e);
      this.setData({ sessionList: [], loading: false });
    }
  },

  bindSessionTap(e) {
    const ds = e.currentTarget.dataset;
    const mark = ds.mark || "";
    if (!mark) return;
    const title = encodeURIComponent(ds.title || "课程");
    const day = encodeURIComponent(ds.day || this.data.today);
    const start = encodeURIComponent(ds.start || "");
    const end = encodeURIComponent(ds.end || "");
    wx.navigateTo({
      url:
        `/pages/coach/checkin/coach_checkin_qr?mark=${encodeURIComponent(mark)}` +
        `&title=${title}&day=${day}&start=${start}&end=${end}`,
    });
  },

  bindScanMemberTap() {
    wx.navigateTo({ url: "/pages/admin/meet/scan/admin_meet_scan" });
  },
});
