const pageHelper = require("../../../helper/page_helper.js");
const cloudHelper = require("../../../helper/cloud_helper.js");
const AdminWxBiz = require("../../../biz/admin_wx_biz.js");

Page({
  behaviors: [require("../../../behavior/coach_page_bh.js")],

  data: {
    isLoad: false,
    qrUrl: "",
    mark: "",
    title: "",
    day: "",
    start: "",
    end: "",
    timeText: "",
  },

  onLoad(options) {
    this._applyCoachTheme();
    const mark = options && options.mark ? decodeURIComponent(options.mark) : "";
    const title =
      options && options.title ? decodeURIComponent(options.title) : "课程";
    const day = options && options.day ? decodeURIComponent(options.day) : "";
    const start =
      options && options.start ? decodeURIComponent(options.start) : "";
    const end = options && options.end ? decodeURIComponent(options.end) : "";
    const timeText = start && end ? `${day} ${start}–${end}` : day;

    if (!mark) {
      wx.showToast({ title: "参数错误", icon: "none" });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    this.setData({ mark, title, day, start, end, timeText });
  },

  onShow() {
    this._coachOnShow();
    this._loadQr();
  },

  onPullDownRefresh() {
    this._loadQr().finally(() => wx.stopPullDownRefresh());
  },

  async _loadQr() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) return;

    const timeMark = this.data.mark;
    const page = pageHelper.fmtURLByPID("/pages/meet/self/meet_self");
    const params = { timeMark, page };
    const opt = { title: "bar" };

    try {
      const res = await cloudHelper.callCloudSumbit(
        "admin/self_checkin_qr",
        params,
        opt,
      );
      this.setData({
        qrUrl: res.data,
        isLoad: true,
      });
    } catch (err) {
      console.error(err);
      this.setData({ isLoad: true });
    }
  },

  bindPreviewTap() {
    const url = this.data.qrUrl;
    if (!url) return;
    wx.previewImage({ urls: [url] });
  },
});
