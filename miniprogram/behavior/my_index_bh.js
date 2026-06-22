const cacheHelper = require('../helper/cache_helper.js');
const pageHelper = require('../helper/page_helper.js');
const cloudHelper = require('../helper/cloud_helper.js');
const timeHelper = require('../helper/time_helper.js');
const PassportBiz = require('../biz/passport_biz.js');
const UserProfileBiz = require('../biz/user_profile_biz.js');
const setting = require('../setting/setting.js');

module.exports = Behavior({
	data: {
		myTodayList: null,
		localAvatar: '',
		showAvatarImg: false,
		avatarSrc: '',
		userNameInput: '',
	},

	methods: {
		onLoad: async function (options) {
			if (setting.IS_SUB) wx.hideHomeButton();
		},

		_loadTodayList: async function () {
			try {
				const params = {
					day: timeHelper.time('Y-M-D'),
				};
				const res = await cloudHelper.callCloudSumbit(
					'my/my_join_someday',
					params,
					{ title: 'bar' },
				);
				const list = res && Array.isArray(res.data) ? res.data : [];
				this.setData({ myTodayList: list });
			} catch (err) {
				console.error(err);
				this.setData({ myTodayList: [] });
			}
		},

		onReady: function () {},

		onShow: async function () {
			await Promise.all([this._loadTodayList(), this._loadUser()]);
		},

		onHide: async function () {
			const pending = (this._pendingNickname || '').trim();
			if (pending && pending !== (this.data.userNameInput || '').trim()) {
				await this._syncNickname(pending);
			}
		},

		onUnload: function () {},

		_loadUser: async function () {
			const user = await UserProfileBiz.fetch();
			let avatarSrc = '';
			let showAvatarImg = false;

			if (user && user.USER_PIC) {
				avatarSrc = await UserProfileBiz.resolveAvatarUrl(user.USER_PIC);
				showAvatarImg = !!avatarSrc;
			}

			this.setData({
				user,
				localAvatar: '',
				showAvatarImg,
				avatarSrc,
				userNameInput: (user && user.USER_NAME) || '',
			});
			this._pendingNickname = this.data.userNameInput;
		},

		bindChooseAvatar: async function (e) {
			const tempPath = e.detail && e.detail.avatarUrl;
			if (!tempPath) return;

			this.setData({
				localAvatar: tempPath,
				showAvatarImg: true,
				avatarSrc: tempPath,
			});

			try {
				const user = await UserProfileBiz.syncAvatar(tempPath);
				if (user && user.USER_PIC) {
					const avatarSrc = await UserProfileBiz.resolveAvatarUrl(user.USER_PIC);
					this.setData({
						user,
						localAvatar: '',
						showAvatarImg: true,
						avatarSrc: avatarSrc || tempPath,
					});
				}
			} catch (err) {
				console.error(err);
				wx.showToast({ title: '头像保存失败，请重试', icon: 'none' });
			}
		},

		bindNicknameInput: function (e) {
			this._pendingNickname = e.detail.value;
		},

		bindNicknameBlur: async function (e) {
			await this._syncNickname(e.detail.value || this._pendingNickname);
		},

		bindNicknameReview: async function (e) {
			await this._syncNickname(e.detail.value || this._pendingNickname);
		},

		_syncNickname: async function (name) {
			const val = (name || '').trim();
			if (!val) return;

			const user = await UserProfileBiz.syncName(val);
			if (user) {
				this.setData({
					user,
					userNameInput: user.USER_NAME || val,
				});
				this._pendingNickname = user.USER_NAME || val;
			}
		},

		bindGetPhone: async function (e) {
			const user = await UserProfileBiz.syncPhoneFromEvent(e);
			if (user) {
				this.setData({ user });
			}
		},

		onPullDownRefresh: async function () {
			await Promise.all([this._loadTodayList(), this._loadUser()]);
			wx.stopPullDownRefresh();
		},

		onReachBottom: function () {},

		onShareAppMessage: function () {},

		url: function (e) {
			pageHelper.url(e, this);
		},

		bindSetTap: function (e) {
			this.setTap(e, this.data.skin);
		},

		setTap: function (e, skin) {
			let itemList = ['清除缓存', '后台管理'];
			wx.showActionSheet({
				itemList,
				success: async res => {
					let idx = res.tapIndex;
					if (idx == 0) {
						cacheHelper.clear();
						pageHelper.showNoneToast('清除缓存成功');
					}

					if (idx == 1) {
						pageHelper.setSkin(skin);
						if (setting.IS_SUB) {
							PassportBiz.adminLogin('admin', '123456', this);
						} else {
							wx.reLaunch({
								url: '/pages/admin/index/login/admin_login',
							});
						}

					}

				},
				fail: function (res) {}
			})
		}
	}
})
