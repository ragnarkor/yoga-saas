const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const AdminBiz = require('../../../biz/admin_biz.js');
const dataHelper = require('../../../helper/data_helper.js');
const bookingWeekHelper = require('../../../helper/booking_week_helper.js');

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    loading: true,
    weekOffset: 0,
    weekLabel: '',
    startDay: '',
    endDay: '',
    weekDays: [],
    gridRows: [],
    hasCourses: false,
    statusLegend: bookingWeekHelper.getStatusLegend(),
    tabs: [],
    tabsReady: false,
    activeTab: 0,
    activeTypeId: '0',
    emptyText: '本周暂无课程',
  },

  onLoad() {
    this._initWeek(0);
  },

  onShow() {
    this._coachOnShow();
    this._loadPage().then(() => this._resizeTabs());
  },

  onPullDownRefresh() {
    this._loadWeek().finally(() => wx.stopPullDownRefresh());
  },

  _initWeek(offset) {
    const range = bookingWeekHelper.getWeekRange(offset);
    this.setData({
      weekOffset: offset,
      weekLabel: range.weekLabel,
      startDay: range.startDay,
      endDay: range.endDay,
      weekDays: range.weekDays,
    });
  },

  async _loadPage() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    await this._loadTabs();
    await this._loadWeek();
  },

  async _loadTabs() {
    let tabs = [{ id: '0', name: '全部' }];
    try {
      const res = await cloudHelper.callCloudData(
        'admin/tenant_store',
        {},
        { hint: false },
      );
      const categories = (res && res.categories) || [];
      if (categories.length) {
        tabs = tabs.concat(categories);
      } else {
        const opts = dataHelper.getSelectOptions(pageHelper.getMeetTypeStr());
        tabs = tabs.concat(
          opts.map((o) => ({ id: o.val, name: o.label })),
        );
      }
    } catch (e) {
      console.error(e);
    }
    this.setData(
      {
        tabs,
        tabsReady: true,
        activeTab: 0,
        activeTypeId: '0',
      },
      () => this._resizeTabs(),
    );
  },

  _resizeTabs() {
    wx.nextTick(() => {
      const tabs = this.selectComponent('#bookingTabs');
      if (tabs && typeof tabs.resize === 'function') {
        tabs.resize();
      }
    });
  },

  _applyGrid(slots) {
    const { gridRows, hasCourses } = bookingWeekHelper.buildBookingGrid(
      this.data.weekDays,
      slots,
      this.data.activeTypeId,
      { coachMode: true },
    );
    this.setData({ gridRows, hasCourses });
  },

  async _loadWeek() {
    this.setData({ loading: true });
    try {
      const { startDay, endDay, activeTypeId } = this.data;
      const admin = AdminBiz.getAdminToken();
      const onlyMine =
        admin && admin.type === 'teacher' && !AdminWxBiz.isSuperSession()
          ? 1
          : 0;
      const res = await cloudHelper.callCloudData(
        'admin/schedule_week',
        {
          startDay,
          endDay,
          typeId: activeTypeId === '0' ? '' : activeTypeId,
          includeInactive: 1,
          onlyMine,
        },
        { hint: false, title: 'bar' },
      );
      const slots = (res && res.slots) || [];
      this._applyGrid(slots);
      this.setData({ loading: false });
    } catch (e) {
      console.error(e);
      this._applyGrid([]);
      this.setData({ loading: false });
    }
  },

  bindTabChange(e) {
    const idx = e.detail.index;
    const tab = this.data.tabs[idx];
    if (!tab) return;
    this.setData(
      {
        activeTab: idx,
        activeTypeId: tab.id,
      },
      () => this._loadWeek(),
    );
  },

  bindPrevWeek() {
    this._initWeek(this.data.weekOffset - 1);
    this._loadWeek();
  },

  bindNextWeek() {
    this._initWeek(this.data.weekOffset + 1);
    this._loadWeek();
  },

  bindSlotTap(e) {
    const ds = e.currentTarget.dataset;
    const rowIdx = Number(ds.row);
    const colIdx = Number(ds.col);
    const row = this.data.gridRows[rowIdx];
    if (!row || !row.cells) return;
    const cell = row.cells[colIdx];
    const slot = bookingWeekHelper.getCellSlot(cell, ds.itemIdx);
    if (!slot || !slot.detailUrl) return;
    wx.navigateTo({ url: slot.detailUrl });
  },

  bindOverflowTap(e) {
    const ds = e.currentTarget.dataset;
    const rowIdx = Number(ds.row);
    const colIdx = Number(ds.col);
    const row = this.data.gridRows[rowIdx];
    if (!row || !row.cells) return;
    const cell = row.cells[colIdx];
    if (!cell || !cell.overflow) return;
    const hidden = (cell.allItems || []).slice(cell.items.length);
    const names = hidden.map((slot) => slot.title || '课程');
    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const slot = hidden[res.tapIndex];
        if (slot && slot.detailUrl) {
          wx.navigateTo({ url: slot.detailUrl });
        }
      },
    });
  },
});
