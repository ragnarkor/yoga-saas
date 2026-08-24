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

const RANK_LIST_LIMIT = 30;

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
    truncated: false,
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
        { limit: RANK_LIST_LIMIT + 1 },
        { hint: false, title: 'bar' },
      );
      const rawList = (res && res.list) || [];
      const truncated = rawList.length > RANK_LIST_LIMIT;
      const list = truncated ? rawList.slice(0, RANK_LIST_LIMIT) : rawList;
      const { podium, restList } = splitRankList(list);
      const podiumWithAvatar = await enrichPodiumAvatars(podium);
      this.setData({
        list,
        podium: podiumWithAvatar,
        restList,
        truncated,
        loading: false,
      });
    } catch (e) {
      console.error(e);
      this.setData({ loading: false });
    }
  },
});
