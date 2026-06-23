const AdminBiz = require('../../../../biz/admin_biz.js');

Page({
  behaviors: [require('../../../../behavior/meet_time_bh.js')],

  data: {
    isAdmin: false,
    themeCoach: false,
    calendarColor: '#4a7c8c',
  },

  onLoad() {
    if (!AdminBiz.isAdmin(this)) return;
    const parent = this._getMeetTimeParent();
    if (parent) this._initDaysFromParent(parent);
  },
});
