const pageHelper = require('../../../helper/page_helper.js');
const themeHelper = require('../../../helper/theme_helper.js');

const TABS = [
  { key: 'home', text: '首页', inactiveSrc: '/images/tab/coach-home.svg', path: '/pages/coach/index/coach_index' },
  { key: 'customer', text: '会员', inactiveSrc: '/images/tab/coach-customer.svg', path: '/pages/coach/customer/coach_customer' },
  { key: 'marketing', text: '营销', inactiveSrc: '/images/tab/coach-marketing.svg', path: '/pages/coach/marketing/coach_marketing' },
  { key: 'my', text: '我的', inactiveSrc: '/images/tab/coach-profile.svg', path: '/pages/coach/my/coach_my' },
];

function svgDataUri(svg) {
  const bytes = new Uint8Array(svg.length);
  for (let i = 0; i < svg.length; i++) bytes[i] = svg.charCodeAt(i);
  return `data:image/svg+xml;base64,${wx.arrayBufferToBase64(bytes.buffer)}`;
}

function activeIcon(key, themeColor) {
  const color = themeHelper.normalizeHex(themeColor);
  const light = themeHelper.getThemeLight(color);
  const coral = '#EAA18C';
  const lavender = '#B297EC';
  const matBlue = '#6DAACB';
  const svg = {
    home: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><path d="m3.2 10.1 8.8-7 8.8 7"/><path d="M5.5 9.7v9.7h13V9.7" fill="${light}"/><path d="M10.2 19.4v-4.2h3.6v4.2"/><g stroke="${coral}" stroke-width="1.1"><path d="M12 8.6c-1.15-1.85-2.45-1.7-2.45-.55 0 .95.95 1.35 2.45 2.25 1.5-.9 2.45-1.3 2.45-2.25 0-1.15-1.3-1.3-2.45.55Z"/><path d="M12 8.6c-.45-2.05-1.85-2.25-2.35-1.25-.4.85.4 1.55 2.35 2.85 1.95-1.3 2.75-2 2.35-2.85-.5-1-1.9-.8-2.35 1.25Z"/></g></svg>`,
    customer: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><circle cx="9.4" cy="8.4" r="3.15" fill="${light}"/><path d="M3.8 19.7c.65-3.9 2.55-5.85 5.6-5.85 2.55 0 4.27 1.36 5.15 4.1" fill="${light}"/><circle cx="16.9" cy="9.5" r="2.35" fill="${lavender}" stroke="${lavender}"/><path d="M15.1 18.55c.45-2.75 1.72-4.13 3.8-4.13 1.12 0 2.02.42 2.7 1.25" stroke="${lavender}" stroke-width="1.3"/></svg>`,
    marketing: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><rect x="4.1" y="9" width="15.8" height="10.35" rx="1.65" fill="${light}"/><path d="M4.1 12.4h15.8M12 9v10.35"/><path d="M12 9c-2.65 0-4.3-.6-4.3-1.95 0-1.08.97-1.6 1.88-1.13C10.75 6.54 11.48 7.7 12 9Z" fill="${coral}" stroke="${coral}" stroke-width="1.05"/><path d="M12 9c2.65 0 4.3-.6 4.3-1.95 0-1.08-.97-1.6-1.88-1.13C13.25 6.54 12.52 7.7 12 9Z" fill="${lavender}" stroke="${lavender}" stroke-width="1.05"/></svg>`,
    my: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"><circle cx="11.4" cy="8" r="4.1" fill="${light}"/><path d="M3.8 20.7c.8-4.75 3.42-7.05 7.6-7.05s6.8 2.3 7.6 7.05" fill="${light}"/><path d="M14.85 4.75c.62.78.96 1.75.96 2.75 0 1.1-.4 2.1-1.08 2.9"/><g stroke="${matBlue}" stroke-width="1.2"><path d="M12.85 13.75h6.65c1.88 0 3 .98 3 2.36s-1.12 2.36-3 2.36h-6.65c-1.05 0-1.78-.72-1.78-1.62v-1.48c0-.9.73-1.62 1.78-1.62Z" fill="${matBlue}"/><circle cx="19.5" cy="16.11" r="2.03" fill="${matBlue}"/><path d="M20.23 15.45c-.93-.63-2.08.03-2.08 1.04 0 .81.91 1.15 1.54.74.46-.3.23-.98-.3-.98" fill="none" stroke="#FFFFFF" stroke-width=".94"/><path d="M13.35 15.12h3.62" fill="none" stroke="#FFFFFF" stroke-width=".94"/></g></svg>`,
  };
  return svgDataUri(svg[key] || svg.home);
}

Component({
  properties: {
    active: {
      type: Number,
      value: 0,
      observer() {
        this._syncTabs();
      },
    },
    hidden: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    tabs: [],
  },

  lifetimes: {
    attached() {
      this._syncTabs();
    },
  },

  methods: {
    _syncTabs() {
      const active = Number(this.data.active) || 0;
      const themeColor = pageHelper.getThemeColor();
      this.setData({
        tabs: TABS.map((tab, index) => ({
          ...tab,
          iconSrc: index === active ? activeIcon(tab.key, themeColor) : tab.inactiveSrc,
        })),
      });
    },

    onTabTap(e) {
      const index = Number(e.currentTarget.dataset.index);
      const tab = this.data.tabs[index];
      if (!tab || index === this.data.active) return;
      wx.redirectTo({ url: tab.path });
    },
  },
});
