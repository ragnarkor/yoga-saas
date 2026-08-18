const cloudHelper = require('../../../helper/cloud_helper.js');
const pageHelper = require('../../../helper/page_helper.js');
const timeHelper = require('../../../helper/time_helper.js');
const fileHelper = require('../../../helper/file_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

const MAIN_TABS = [
  { key: 'stats', label: '数据统计' },
  { key: 'export', label: '导出' },
];

const RANGE_TABS = [
  { key: 'today', label: '今日' },
  { key: 'month', label: '本月' },
  { key: 'all', label: '累计' },
];

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    navTitle: '收入统计',
    pageTab: 'stats',
    mainTabs: MAIN_TABS,
    range: 'month',
    rangeTabs: RANGE_TABS,
    rangeLabel: '本月',
    loading: true,
    totalAmountText: '0',
    timesAmountText: '0',
    periodAmountText: '0',
    saleAmountText: '0',
    saleCardCount: 0,
    saleTimesAmountText: '0',
    salePeriodAmountText: '0',
    trend: [],
    trendUnit: 'day',
    showTrend: false,
    list: [],
    page: 1,
    hasMore: true,
    exportStartDay: timeHelper.time('Y-M') + '-01',
    exportEndDay: timeHelper.time('Y-M-D'),
    exportUrl: '',
    exportTime: '',
    exportLoading: false,
    endYear: new Date().getFullYear() + 1,
  },

  onLoad() {
    this._applyCoachTheme();
    this._loadStats(true);
  },

  onReady() {
    this._trendCanvasReady = true;
    this._drawTrend();
  },

  onPullDownRefresh() {
    const task =
      this.data.pageTab === 'export'
        ? this._loadExportStatus(1)
        : this._loadStats(true);
    task.finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (
      this.data.pageTab === 'stats' &&
      this.data.hasMore &&
      !this.data.loading
    ) {
      this._loadStats(false);
    }
  },

  async bindCoachTenantChange() {
    await this._coachOnShow();
    this._applyCoachTheme();
    if (this.data.pageTab === 'export') {
      this._syncExportDates();
      this._loadExportStatus(1);
    } else {
      this._loadStats(true);
    }
  },

  bindMainTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.pageTab) return;
    this.setData({ pageTab: tab });
    if (tab === 'export') {
      this._syncExportDates();
      this._loadExportStatus(1);
    } else if (!this.data.list.length && !this.data.loading) {
      this._loadStats(true);
    }
  },

  bindRangeTap(e) {
    const range = e.currentTarget.dataset.range;
    if (!range || range === this.data.range) return;
    const item = RANGE_TABS.find((tab) => tab.key === range);
    this.setData({
      range,
      rangeLabel: item ? item.label : '',
    });
    this._loadStats(true);
  },

  _syncExportDates() {
    const today = timeHelper.time('Y-M-D');
    const range = this.data.range;
    let exportStartDay = timeHelper.time('Y-M') + '-01';
    let exportEndDay = today;
    if (range === 'today') {
      exportStartDay = today;
      exportEndDay = today;
    } else if (range === 'all') {
      exportStartDay = '2021-01-01';
      exportEndDay = today;
    }
    this.setData({ exportStartDay, exportEndDay });
  },

  url(e) {
    pageHelper.url(e, this);
  },

  bindOpenExportTap() {
    fileHelper.openDoc('耗卡收入', this.data.exportUrl);
  },

  async _loadExportStatus(isDel) {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ exportLoading: false });
      return;
    }
    this.setData({ exportLoading: true });
    try {
      const data = await cloudHelper.callCloudData(
        'admin/income_data_get',
        { isDel },
        { hint: false, title: 'bar' },
      );
      this.setData({
        exportUrl: (data && data.url) || '',
        exportTime: (data && data.time) || '',
        exportLoading: false,
      });
    } catch (e) {
      console.error(e);
      this.setData({ exportLoading: false });
    }
  },

  async bindExportTap() {
    if (!this.data.exportStartDay || !this.data.exportEndDay) {
      pageHelper.showNoneToast('请选择导出日期');
      return;
    }
    if (this.data.exportStartDay > this.data.exportEndDay) {
      pageHelper.showNoneToast('起始日期不能晚于终止日期');
      return;
    }
    try {
      const res = await cloudHelper.callCloudData(
        'admin/income_data_export',
        {
          startDay: this.data.exportStartDay,
          endDay: this.data.exportEndDay,
        },
        { title: '数据生成中' },
      );
      await this._loadExportStatus(0);
      pageHelper.showModal(
        '数据文件生成成功(' +
          (res.total || 0) +
          '条记录)，请点击「直接打开」或复制链接下载',
      );
    } catch (err) {
      console.error(err);
      pageHelper.showNoneToast('导出失败，请重试');
    }
  },

  async bindDelExportTap() {
    try {
      await cloudHelper.callCloudData(
        'admin/income_data_del',
        {},
        { title: '数据删除中' },
      );
      this.setData({ exportUrl: '', exportTime: '' });
      pageHelper.showSuccToast('删除成功');
    } catch (err) {
      console.error(err);
      pageHelper.showNoneToast('删除失败，请重试');
    }
  },

  async _loadStats(refresh) {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    const page = refresh ? 1 : this.data.page + 1;
    this.setData({ loading: true, ...(refresh ? { list: [], hasMore: true } : {}) });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/stats_fund',
        { range: this.data.range, page, size: 20 },
        { hint: false, title: 'bar' },
      );
      const items = (res && res.list) || [];
      const trend = (res && res.trend) || [];
      this.setData({
        totalAmountText: (res && res.totalAmountText) || '0',
        timesAmountText: (res && res.timesAmountText) || '0',
        periodAmountText: (res && res.periodAmountText) || '0',
        saleAmountText: (res && res.saleAmountText) || '0',
        saleCardCount: (res && res.saleCardCount) || 0,
        saleTimesAmountText: (res && res.saleTimesAmountText) || '0',
        salePeriodAmountText: (res && res.salePeriodAmountText) || '0',
        trend,
        trendUnit: (res && res.trendUnit) || 'day',
        showTrend: this.data.range !== 'today' && trend.length > 0,
        list: refresh ? items : this.data.list.concat(items),
        page,
        hasMore: items.length >= 20,
        loading: false,
      }, () => this._drawTrend());
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },

  _drawTrend() {
    if (!this._trendCanvasReady || !this.data.showTrend || !this.data.trend.length) return;
    wx.createSelectorQuery().in(this).select('#incomeTrendCanvas')
      .fields({ node: true, size: true }).exec((res) => {
        const item = res && res[0];
        if (!item || !item.node) return;
        const canvas = item.node;
        const width = item.width || 320;
        const height = item.height || 180;
        const dpr = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);
        const values = this.data.trend.map((entry) => Number(entry.amount) || 0);
        const max = Math.max(...values, 1);
        const left = 12;
        const right = width - 12;
        const top = 14;
        const bottom = height - 18;
        const chartHeight = bottom - top;
        const step = values.length > 1 ? (right - left) / (values.length - 1) : 0;
        const color = this.data.themeColor || '#5B8A72';
        ctx.strokeStyle = '#edf1ef';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 3; i++) {
          const y = top + (chartHeight * i) / 3;
          ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
        }
        const points = values.map((value, index) => ({
          x: left + step * index,
          y: bottom - (value / max) * chartHeight,
        }));
        if (!points.length) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, bottom);
        points.forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.lineTo(points[points.length - 1].x, bottom);
        ctx.closePath();
        ctx.fillStyle = color + '22'; ctx.fill();
        ctx.beginPath();
        points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
        ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
        points.forEach((point) => {
          ctx.beginPath(); ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
        });
      });
  },
});
