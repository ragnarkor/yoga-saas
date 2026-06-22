const cloudHelper = require('../../../helper/cloud_helper.js');
const AdminWxBiz = require('../../../biz/admin_wx_biz.js');
const UserProfileBiz = require('../../../biz/user_profile_biz.js');

function nameInitial(name) {
  const text = (name || '').trim();
  return text ? text.charAt(0) : '会';
}

async function enrichPodiumAvatars(podium) {
  const items = podium || [];
  return Promise.all(
    items.map(async (item) => {
      let avatarSrc = '';
      if (item.avatar) {
        avatarSrc = await UserProfileBiz.resolveAvatarUrl(item.avatar);
        if (!avatarSrc) {
          avatarSrc = UserProfileBiz.displayAvatar({ USER_PIC: item.avatar });
        }
      }
      return {
        ...item,
        avatarSrc,
        nameInitial: nameInitial(item.title),
      };
    }),
  );
}

function splitRankList(list) {
  const top3 = (list || []).filter((item) => item.rank <= 3);
  const restList = (list || []).filter((item) => item.rank > 3);
  const first = top3.find((item) => item.rank === 1);
  const second = top3.find((item) => item.rank === 2);
  const third = top3.find((item) => item.rank === 3);
  const podium = [second, first, third].filter(Boolean);
  return { podium, restList };
}

Page({
  behaviors: [require('../../../behavior/coach_page_bh.js')],

  data: {
    navTitle: '约课排名',
    loading: true,
    list: [],
    podium: [],
    restList: [],
  },

  onLoad() {
    this._applyCoachTheme();
    this._loadData();
  },

  onPullDownRefresh() {
    this._loadData().finally(() => wx.stopPullDownRefresh());
  },

  async bindCoachTenantChange() {
    await this._coachOnShow();
    this._applyCoachTheme();
    this._loadData();
  },

  async _loadData() {
    const ok = await AdminWxBiz.ensureSession();
    if (!ok) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true });
    try {
      const res = await cloudHelper.callCloudData(
        'admin/stats_rank',
        { limit: 30 },
        { hint: false, title: 'bar' },
      );
      const list = (res && res.list) || [];
      const { podium, restList } = splitRankList(list);
      const podiumWithAvatar = await enrichPodiumAvatars(podium);
      this.setData({
        list,
        podium: podiumWithAvatar,
        restList,
        loading: false,
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },
});
