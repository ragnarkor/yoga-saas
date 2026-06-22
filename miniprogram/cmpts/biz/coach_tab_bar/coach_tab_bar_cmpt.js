Component({
  properties: {
    active: {
      type: Number,
      value: 0,
    },
    hidden: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    tabs: [
      { key: 'home', text: '首页', icon: 'home-o', path: '/pages/coach/index/coach_index' },
      { key: 'customer', text: '客户', icon: 'friends-o', path: '/pages/coach/customer/coach_customer' },
      { key: 'marketing', text: '营销', icon: 'gift-o', path: '/pages/coach/marketing/coach_marketing' },
      { key: 'my', text: '我的', icon: 'smile-o', path: '/pages/coach/my/coach_my' },
    ],
  },

  methods: {
    onTabTap(e) {
      const index = Number(e.currentTarget.dataset.index);
      const tab = this.data.tabs[index];
      if (!tab || index === this.data.active) return;
      wx.redirectTo({ url: tab.path });
    },
  },
});
