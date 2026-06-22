const pageHelper = require('../../../helper/page_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

Page({
  behaviors: [
    require('../../../behavior/meet_time_bh.js'),
    require('../../../behavior/coach_page_bh.js'),
  ],

  data: {
    themeCoach: true,
    calendarColor: pageHelper.getThemeColor(),
    ready: false,
  },

  onLoad() {
    this._coachOnShow();
  },

  async onShow() {
    this.setData({ calendarColor: pageHelper.getThemeColor() });
    if (this.data.ready) return;
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) return;
    const parent = this._getMeetTimeParent();
    if (parent) this._initDaysFromParent(parent);
    this.setData({ ready: true });
  },
});
