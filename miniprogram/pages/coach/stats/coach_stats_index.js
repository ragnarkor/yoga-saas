const AdminWxBiz = require('../../../biz/admin_wx_biz.js');

const MENUS = [
  { name: '上课统计', icon: 'notes-o', color: '#64b5f6', url: '/pages/coach/stats/coach_stats_class' },
  { name: '约课排名', icon: 'bar-chart-o', color: '#81c784', url: '/pages/coach/stats/coach_stats_rank' },
  { name: '资金明细', icon: 'gold-coin-o', color: '#ffb74d', url: '/pages/coach/stats/coach_stats_fund' },
  { name: '会员卡分析', icon: 'coupon-o', color: '#f48fb1', url: '/pages/coach/stats/coach_stats_card' },
  { name: '耗卡统计', icon: 'ascending', color: '#b39ddb', url: '/pages/coach/stats/coach_stats_consume' },
  { name: '名单导出', icon: 'down', color: '#90a4ae', url: '/pages/coach/stats/coach_stats_export' },
  { name: '预约查询', icon: 'search', color: '#4fc3f7', url: '/pages/coach/stats/coach_stats_join', legacy: true },
  { name: '排课查询', icon: 'description', color: '#ce93d8', url: '/pages/coach/stats/coach_stats_schedule', legacy: true },
];

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    menus: MENUS,
  },

  onLoad() {
    this._applyCoachTheme();
  },

  async onMenuTap(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.navigateTo({ url });
  },
});
