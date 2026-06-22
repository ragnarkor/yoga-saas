const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const dataHelper = require('../../../helper/data_helper.js');
const schedulePoster = require('../../../helper/schedule_poster_helper.js');

const WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad2(n) {
  return n < 10 ? '0' + n : n;
}

function formatDayStr(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function getWeekRange(weekOffset) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() + weekOffset * 7);
  const dow = now.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const day = formatDayStr(d);
    weekDays.push({
      day,
      label: pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + WEEK_NAMES[d.getDay()],
      shortLabel: pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()),
    });
  }

  return {
    startDay: weekDays[0].day,
    endDay: weekDays[6].day,
    weekDays,
    weekLabel: weekDays[0].day + ' 至 ' + weekDays[6].day,
  };
}

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    weekOffset: 0,
    weekLabel: '',
    startDay: '',
    endDay: '',
    weekDays: [],
    tabs: [{ id: '0', name: '全部' }],
    activeTab: 0,
    activeTypeId: '0',
    gridRows: [],
    canvasHeight: 1200,
    previewShow: false,
    previewUrl: '',
    moreShow: false,
    moreActions: [
      { name: '保存课表图片' },
      { name: '刷新课表' },
    ],
  },

  onLoad() {
    this._initWeek(0);
  },

  onShow() {
    this._coachOnShow();
    this._loadPage();
  },

  onPullDownRefresh() {
    this._loadSchedule().finally(() => wx.stopPullDownRefresh());
  },

  _initWeek(offset) {
    const range = getWeekRange(offset);
    this.setData({
      weekOffset: offset,
      ...range,
    });
  },

  async _loadPage() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    await this._loadTabs();
    await this._loadSchedule();
  },

  async _loadTabs() {
    try {
      const res = await cloudHelper.callCloudData(
        'admin/tenant_store',
        {},
        { hint: false },
      );
      let tabs = [{ id: '0', name: '全部' }];
      const categories = (res && res.categories) || [];
      if (categories.length) {
        tabs = tabs.concat(categories);
      } else {
        const skin = pageHelper.getSkin();
        const opts = dataHelper.getSelectOptions(skin.MEET_TYPE || '');
        tabs = tabs.concat(
          opts.map((o) => ({ id: o.val, name: o.label })),
        );
      }
      this.setData({ tabs });
    } catch (e) {
      console.error(e);
    }
  },

  async _loadSchedule() {
    this.setData({ loading: true });
    try {
      const { startDay, endDay, activeTypeId } = this.data;
      const res = await cloudHelper.callCloudData(
        'admin/schedule_week',
        {
          startDay,
          endDay,
          typeId: activeTypeId === '0' ? '' : activeTypeId,
        },
        { hint: false, title: 'bar' },
      );

      const slots = (res && res.slots) || [];
      let timeRows = (res && res.timeRows) || [];
      const weekDays = this.data.weekDays;

      const slotMap = {};
      slots.forEach((s) => {
        slotMap[s.start + '|' + s.day] = this._fmtSlot(s);
      });

      if (!timeRows.length && slots.length) {
        timeRows = Array.from(new Set(slots.map((s) => s.start))).sort();
      }

      const gridRows = timeRows.map((time) => ({
        time,
        cells: weekDays.map((d) => slotMap[time + '|' + d.day] || null),
      }));

      this.setData({ loading: false, gridRows });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, gridRows: [] });
    }
  },

  _fmtSlot(s) {
    const diff = Number(s.difficulty) || 3;
    let starText = '';
    for (let i = 0; i < 5; i++) {
      starText += i < diff ? '★' : '☆';
    }
    return {
      ...s,
      starText,
      duration: s.duration || 60,
    };
  },

  bindTabChange(e) {
    const idx = e.detail.index;
    const tab = this.data.tabs[idx];
    if (!tab) return;
    this.setData(
      { activeTab: idx, activeTypeId: tab.id },
      () => this._loadSchedule(),
    );
  },

  bindPrevWeek() {
    this._initWeek(this.data.weekOffset - 1);
    this._loadSchedule();
  },

  bindNextWeek() {
    this._initWeek(this.data.weekOffset + 1);
    this._loadSchedule();
  },

  bindGoSchedule() {
    wx.navigateTo({ url: '/pages/coach/course/coach_course_list' });
  },

  bindCourseTap(e) {
    const id = e.currentTarget.dataset.meetId;
    if (!id) return;
    wx.navigateTo({ url: '/pages/coach/course/coach_course_edit?id=' + id });
  },

  bindMoreTap() {
    this.setData({ moreShow: true });
  },

  bindMoreClose() {
    this.setData({ moreShow: false });
  },

  bindMoreSelect(e) {
    this.setData({ moreShow: false });
    if (e.detail.name === '保存课表图片') {
      this.bindSaveImageTap();
    } else if (e.detail.name === '刷新课表') {
      this._loadSchedule();
    }
  },

  async bindSaveImageTap() {
    if (!this.data.gridRows.length) {
      wx.showToast({ title: '暂无课表可导出', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '生成图片...', mask: true });
    try {
      const posterRows = this.data.gridRows.map((row) => ({
        time: row.time,
        cells: row.cells,
      }));

      const canvasHeight = schedulePoster.calcPosterHeight(posterRows);
      this.setData({ canvasHeight }, async () => {
        try {
          const url = await schedulePoster.exportScheduleImage(this, {
            tenantName: pageHelper.getTenantName() || '瑜伽馆',
            weekLabel: this.data.weekLabel,
            weekDays: this.data.weekDays,
            gridRows: posterRows,
          });

          wx.hideLoading();
          this.setData({ previewShow: true, previewUrl: url });
        } catch (err) {
          wx.hideLoading();
          console.error(err);
          wx.showToast({ title: '生成失败', icon: 'none' });
        }
      });
    } catch (e) {
      wx.hideLoading();
      console.error(e);
      wx.showToast({ title: '生成失败', icon: 'none' });
    }
  },

  bindClosePreview() {
    this.setData({ previewShow: false, previewUrl: '' });
  },

  async bindConfirmSave() {
    const url = this.data.previewUrl;
    if (!url) return;
    wx.showLoading({ title: '保存中...', mask: true });
    try {
      await schedulePoster.saveToAlbum(url);
      wx.hideLoading();
      wx.showToast({ title: '已保存到相册', icon: 'success' });
      this.bindClosePreview();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },
});
