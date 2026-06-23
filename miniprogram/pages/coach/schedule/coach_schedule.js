const pageHelper = require('../../../helper/page_helper.js');
const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const dataHelper = require('../../../helper/data_helper.js');
const schedulePoster = require('../../../helper/schedule_poster_helper.js');
const scheduleSlotHelper = require('../../../helper/schedule_slot_helper.js');

const WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
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
      weekday: WEEK_NAMES[d.getDay()],
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
    tabs: [],
    tabsReady: false,
    activeTab: 0,
    activeTypeId: '0',
    gridRows: [],
    canvasHeight: 1200,
    previewShow: false,
    previewUrl: '',
    slotActionShow: false,
    slotActions: [
      { name: '编辑排课' },
      { name: '删除排课', color: '#ee0a24' },
    ],
    activeSlot: null,
  },

  onLoad() {
    this._initWeek(0);
  },

  onShow() {
    this._coachOnShow();
    this._loadPage().then(() => this._resizeScheduleTabs());
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
      () => this._resizeScheduleTabs(),
    );
  },

  _resizeScheduleTabs() {
    wx.nextTick(() => {
      const tabs = this.selectComponent('#scheduleTabs');
      if (tabs && typeof tabs.resize === 'function') {
        tabs.resize();
      }
    });
  },

  async _loadSchedule() {
    this.setData({ loading: true });
    try {
      const { startDay, endDay, activeTypeId } = this.data;
      const [res, meetRes] = await Promise.all([
        cloudHelper.callCloudData(
          'admin/schedule_week',
          {
            startDay,
            endDay,
            typeId: activeTypeId === '0' ? '' : activeTypeId,
          },
          { hint: false, title: 'bar' },
        ),
        cloudHelper.callCloudData(
          'admin/meet_list',
          { page: 1, size: 200 },
          { hint: false },
        ),
      ]);

      const meetMetaMap = {};
      ((meetRes && meetRes.list) || []).forEach((m, idx) => {
        meetMetaMap[m._id] = {
          styleSet: m.MEET_STYLE_SET || {},
          typeId: m.MEET_TYPE_ID,
          index: idx,
        };
      });

      const slots = (res && res.slots) || [];
      let timeRows = (res && res.timeRows) || [];
      const weekDays = this.data.weekDays;

      if (!timeRows.length && slots.length) {
        timeRows = Array.from(new Set(slots.map((s) => s.start))).sort();
      }

      const gridRows = timeRows.map((time) => ({
        time,
        cells: weekDays.map((d) => {
          const hit = slots.find(
            (s) => s.start === time && s.day === d.day,
          );
          return hit
            ? scheduleSlotHelper.formatScheduleSlot(hit, meetMetaMap[hit.meetId])
            : null;
        }),
      }));

      this.setData({ loading: false, gridRows });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false, gridRows: [] });
    }
  },

  _openScheduleForm(params = {}) {
    const qs = Object.keys(params)
      .filter((k) => params[k] != null && params[k] !== '')
      .map((k) => `${k}=${encodeURIComponent(params[k])}`)
      .join('&');
    wx.navigateTo({
      url: '/pages/coach/schedule/coach_schedule_edit' + (qs ? '?' + qs : ''),
    });
  },

  bindGoSchedule() {
    this._openScheduleForm();
  },

  _cellFromEvent(e) {
    const ds = e.currentTarget.dataset;
    const rowIdx = Number(ds.row);
    const colIdx = Number(ds.col);
    const row = this.data.gridRows[rowIdx];
    if (!row || !row.cells) return null;
    return row.cells[colIdx] || null;
  },

  bindCellTap(e) {
    const ds = e.currentTarget.dataset;
    const cell = this._cellFromEvent(e);
    if (cell) {
      this._openScheduleForm({
        meetId: cell.meetId,
        day: cell.day,
        mark: cell.mark,
        start: cell.start,
        end: cell.end,
        teacherName: cell.teacherName || '',
      });
      return;
    }
    this._openScheduleForm({
      day: ds.day,
      time: ds.time,
    });
  },

  bindCellLongPress(e) {
    const cell = this._cellFromEvent(e);
    if (!cell || !cell.mark) return;
    wx.vibrateShort({ type: 'light' });
    this.setData({
      activeSlot: {
        meetId: cell.meetId,
        day: cell.day,
        mark: String(cell.mark),
        start: cell.start,
        end: cell.end,
        title: cell.title || '',
        teacherName: cell.teacherName || '',
      },
      slotActionShow: true,
    });
  },

  bindSlotActionClose() {
    this.setData({ slotActionShow: false, activeSlot: null });
  },

  bindSlotActionSelect(e) {
    const slot = this.data.activeSlot;
    this.setData({ slotActionShow: false });
    if (!slot) return;

    if (e.detail.name === '编辑排课') {
      this._openScheduleForm({
        meetId: slot.meetId,
        day: slot.day,
        mark: slot.mark,
        start: slot.start,
        end: slot.end,
        teacherName: slot.teacherName || '',
      });
      return;
    }

    if (e.detail.name === '删除排课') {
      wx.showModal({
        title: '删除排课',
        content: `确定删除「${slot.title || '课程'}」${slot.day} ${slot.start} 的排课吗？已有预约无法删除。`,
        confirmColor: '#ee0a24',
        success: (res) => {
          if (res.confirm) this._deleteSlot(slot);
        },
      });
    }
  },

  async _deleteSlot(slot) {
    if (!slot || !slot.meetId || !slot.mark || !slot.day) return;
    try {
      await cloudHelper.callCloudSumbit(
        'admin/schedule_slot_remove',
        {
          meetId: slot.meetId,
          day: slot.day,
          mark: String(slot.mark),
        },
        { title: '删除中' },
      );

      wx.showToast({ title: '已删除', icon: 'success' });
      this.setData({ activeSlot: null });
      await this._loadSchedule();
    } catch (err) {
      console.error(err);
    }
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
