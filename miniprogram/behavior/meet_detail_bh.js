const cloudHelper = require('../helper/cloud_helper.js');
const pageHelper = require('../helper/page_helper.js');
const MeetBiz = require('../biz/meet_biz.js');
const timeHelper = require('../helper/time_helper.js');
const dataHelper = require('../helper/data_helper.js');
const formSetHelper = require('../cmpts/public/form/form_set_helper.js');
const UserProfileBiz = require('../biz/user_profile_biz.js');
const setting = require('../setting/setting.js');
const defaultCoverHelper = require('../helper/default_cover_helper.js');

const BOOK_NOTES = [
	'请提前 10–15 分钟到场签到，迟到可能影响入场。',
	'开课前 2 小时可免费取消预约，逾期取消可能扣减课时。',
	'请穿着舒适运动服，自备水杯；孕期及特殊体质请提前告知老师。',
	'如遇人数不足，馆方有权调整或取消课程并另行通知。',
];

module.exports = Behavior({

	data: {
		isLoad: false,
		canNullTime: false,
		bookNotes: BOOK_NOTES,

		day: '',
		timeMark: '',
		selectedDayIdx: 0,
		selectedTimeIdx: 0,

		coverPic: '',
		shortDesc: '',
		level: 3,
		levelStars: [1, 1, 1, 0, 0],
		classTimeText: '',
		locationText: '',
		coachName: '',
		coachAvatar: '',
		joinRoster: [],
		joinRosterTotal: 0,
		seatText: '',
		seatPercent: 0,
		limitHint: '',
		introPics: [],
		introText: '',
		currentDayTimes: [],
		bookDisabled: true,
		bookBtnText: '立即预约',
		submitting: false,
		cardCanBook: true,
		cardHint: '',
		cardNeedTimes: 1,
		cardSheetShow: false,
		cardPickLoading: false,
		joinCardOptions: [],
		selectedCardId: '',
	},

	methods: {
		onLoad: function (options) {
			if (!pageHelper.getOptions(this, options)) return;

			this.setData({
				day: options.day || '',
				timeMark: options.timeMark || '',
				locationText: pageHelper.getTenantName() || '本馆',
			});

			this._loadDetail();
		},

		_loadDetail: async function () {
			let id = this.data.id;
			if (!id) return;

			let meet = await cloudHelper.callCloudData('meet/view', { id }, { title: 'bar' });
			if (!meet) {
				this.setData({ isLoad: null });
				return;
			}

			this._fmtMeetMedia(meet);

			if (meet.coachAvatar) {
				meet.coachAvatar =
					(await UserProfileBiz.resolveAvatarUrl(meet.coachAvatar)) ||
					pageHelper.fmtImgUrl(meet.coachAvatar) ||
					"";
			}

			wx.setNavigationBarTitle({ title: meet.MEET_TITLE || '课程详情' });

			this.setData({
				isLoad: true,
				meet,
				canNullTime: setting.MEET_CAN_NULL_TIME,
			}, () => {
				this._buildDisplay();
				this._loadCardSummary();
			});
		},

		_loadCardSummary: async function () {
			try {
				const summary = await cloudHelper.callCloudData(
					'my/my_card_summary',
					{},
					{ hint: false },
				);
				const canBook = !!(summary && summary.canBook);
				let cardHint = '';
				if (!canBook) {
					cardHint = '预约需可用会员卡次数，请联系馆方发卡';
				} else if (summary.hasPeriod) {
					cardHint = '当前期限内卡可畅练';
				} else if (summary.timesTotal > 0) {
					cardHint = `可用次数合计 ${summary.timesTotal} 次`;
				}
				this.setData({ cardCanBook: canBook, cardHint });
				this._applyCardBookState();
			} catch (e) {
				console.error(e);
			}
		},

		_applyCardBookState: function () {
			if (this.data.cardCanBook) return;
			if (this.data.bookDisabled && this.data.bookBtnText !== '立即预约') return;
			this.setData({
				bookDisabled: true,
				bookBtnText: '暂无可用会员卡',
			});
		},

		_fmtMeetMedia: function (meet) {
			if (meet.MEET_STYLE_SET && meet.MEET_STYLE_SET.pic) {
				meet.MEET_STYLE_SET.pic = pageHelper.fmtCoverUrl(meet.MEET_STYLE_SET.pic, meet._id);
			}

			if (meet.coachAvatar) {
				meet.coachAvatar = pageHelper.fmtImgUrl(meet.coachAvatar) || "";
			}

			if (meet.MEET_CONTENT && meet.MEET_CONTENT.length) {
				meet.MEET_CONTENT.forEach((node) => {
					if (node.type === 'img' && node.val) {
						node.val = pageHelper.fmtImgUrl(node.val);
					}
				});
			}
		},

		_loadJoinRoster: async function (meetId, timeMark) {
			if (!meetId || !timeMark) {
				this.setData({ joinRoster: [], joinRosterTotal: 0 });
				return;
			}
			try {
				const res = await cloudHelper.callCloudData(
					'meet/join_roster',
					{ meetId, timeMark },
					{ hint: false },
				);
				const rawList = (res && res.list) || [];
				const skin = pageHelper.getSkin();
				const defaultAvatar =
					skin.USER_DEFAULT_AVATAR ||
					defaultCoverHelper.pickDefaultCover(meetId);
				const joinRoster = await Promise.all(
					rawList.map(async (item) => {
						let avatarSrc = defaultAvatar;
						if (item.avatar) {
							avatarSrc =
								(await UserProfileBiz.resolveAvatarUrl(item.avatar)) ||
								pageHelper.fmtImgUrl(item.avatar) ||
								defaultAvatar;
						}
						return {
							...item,
							avatarSrc,
						};
					}),
				);
				this.setData({
					joinRoster,
					joinRosterTotal: (res && res.total) || joinRoster.length,
				});
			} catch (e) {
				console.error(e);
				this.setData({ joinRoster: [], joinRosterTotal: 0 });
			}
		},

		_buildDisplay: function () {
			const meet = this.data.meet;
			if (!meet || !meet.MEET_DAYS_SET) return;

			const daysSet = meet.MEET_DAYS_SET;
			let dayIdx = 0;
			let timeIdx = 0;

			if (this.data.day) {
				const foundDay = daysSet.findIndex((d) => d.day === this.data.day);
				if (foundDay >= 0) dayIdx = foundDay;
			}

			if (this.data.timeMark && daysSet[dayIdx]) {
				const foundTime = daysSet[dayIdx].times.findIndex((t) => t.mark === this.data.timeMark);
				if (foundTime >= 0) timeIdx = foundTime;
			}

			const styleSet = meet.MEET_STYLE_SET || {};
			const defaultCover = defaultCoverHelper.pickDefaultCover(meet._id);

			let introPics = [];
			if (styleSet.pic) introPics.push(styleSet.pic);
			let introText = styleSet.desc || '';
			if (meet.MEET_CONTENT && meet.MEET_CONTENT.length) {
				meet.MEET_CONTENT.forEach((node) => {
					if (node.type === 'img' && node.val) introPics.push(node.val);
					if (node.type === 'text' && node.val && !introText) introText = node.val;
				});
			}
			if (!introPics.length) introPics = [defaultCover];

			const level = Number(styleSet.level) || 3;
			const levelStars = [0, 0, 0, 0, 0].map((_, i) => (i < level ? 1 : 0));

			this.setData({
				selectedDayIdx: dayIdx,
				selectedTimeIdx: timeIdx,
				coverPic: pageHelper.fmtCoverUrl(styleSet.pic, meet._id) || defaultCover,
				shortDesc: styleSet.desc || meet.MEET_TYPE_NAME || '',
				level,
				levelStars,
				introPics,
				introText,
				coachAvatar: meet.coachAvatar || "",
				currentDayTimes: daysSet[dayIdx] ? daysSet[dayIdx].times : [],
			}, () => {
				this._updateSlotDisplay(dayIdx, timeIdx);
			});
		},

		_updateSlotDisplay: async function (dayIdx, timeIdx) {
			const meet = this.data.meet;
			const dayNode = meet.MEET_DAYS_SET[dayIdx];
			const timeNode = dayNode && dayNode.times[timeIdx];

			if (!timeNode) {
				this.setData({
					classTimeText: '',
					seatText: '',
					seatPercent: 0,
					limitHint: '',
					bookDisabled: true,
					bookBtnText: '暂无可预约时段',
					currentDayTimes: dayNode ? dayNode.times : [],
					joinRoster: [],
					joinRosterTotal: 0,
				});
				return;
			}

			const weekday = timeHelper.week(dayNode.day);
			const classTimeText = `${dayNode.day} (${weekday}) ${timeNode.start}-${timeNode.end}`;

			let seatText = '';
			let seatPercent = 0;
			let limitHint = '人数不限';

			if (timeNode.isLimit && timeNode.limit > 0) {
				const booked = (timeNode.stat && timeNode.stat.succCnt) || 0;
				const limit = timeNode.limit;
				seatText = `${booked}/${limit}席`;
				seatPercent = Math.min(100, Math.round((booked / limit) * 100));
				limitHint = `限${limit}人`;
			} else {
				seatText = '不限席位';
				seatPercent = 0;
				limitHint = '人数不限';
			}

			let bookDisabled = !!timeNode.error;
			let bookBtnText = '立即预约';
			if (timeNode.error) {
				if (timeNode.error.includes('满')) bookBtnText = '已满员';
				else if (timeNode.error.includes('结束')) bookBtnText = '预约已结束';
				else bookBtnText = timeNode.error;
			}

			const styleSet = meet.MEET_STYLE_SET || {};
			const needTimes = Number(styleSet.cardTimes) > 0 ? Number(styleSet.cardTimes) : 1;
			const coachName =
				timeNode.teacherName ||
				meet.coachName ||
				styleSet.teacherName ||
				'专业教练';

			this.setData({
				selectedDayIdx: dayIdx,
				selectedTimeIdx: timeIdx,
				timeMark: timeNode.mark,
				classTimeText,
				coachName,
				seatText,
				seatPercent,
				limitHint,
				bookDisabled,
				bookBtnText,
				currentDayTimes: dayNode.times,
				cardNeedTimes: needTimes,
			});

			this._applyCardBookState();

			await this._loadJoinRoster(this.data.id, timeNode.mark);
		},

		bindSelectTimeTap: function (e) {
			const timeIdx = pageHelper.dataset(e, 'timeidx');
			this._updateSlotDisplay(this.data.selectedDayIdx, timeIdx);
		},

		bindSelectDayTap: function (e) {
			const dayIdx = pageHelper.dataset(e, 'dayidx');
			const meet = this.data.meet;
			const dayNode = meet.MEET_DAYS_SET[dayIdx];
			if (!dayNode) return;
			this._updateSlotDisplay(dayIdx, 0);
		},

		bindBookTap: function () {
			if (this.data.submitting) return;
			if (!this.data.cardCanBook) {
				wx.showModal({
					title: '提示',
					content: `预约本课程需扣除 ${this.data.cardNeedTimes || 1} 次会员卡，您暂无可用会员卡，请联系馆方发卡。`,
					confirmText: '我的卡包',
					cancelText: '知道了',
					success(res) {
						if (res.confirm) {
							wx.navigateTo({ url: '/pages/default/my/card_pack/my_card_pack' });
						}
					},
				});
				return;
			}
			if (this.data.bookDisabled) {
				return pageHelper.showModal(this.data.bookBtnText + '，请更换时段后再试');
			}

			this._openCardSheet();
		},

		_openCardSheet: async function () {
			const meetId = this.data.id;
			if (!meetId) return;

			this.setData({
				cardSheetShow: true,
				cardPickLoading: true,
				joinCardOptions: [],
				selectedCardId: '',
			});

			try {
				const res = await cloudHelper.callCloudData(
					'meet/join_card_options',
					{ meetId },
					{ title: 'bar' },
				);
				const list = (res && res.list) || [];
				if (!list.length) {
					this.setData({ cardSheetShow: false, cardPickLoading: false });
					wx.showModal({
						title: '提示',
						content: '暂无可用会员卡，请联系馆方发卡。',
						confirmText: '我的卡包',
						success(r) {
							if (r.confirm) {
								wx.navigateTo({ url: '/pages/default/my/card_pack/my_card_pack' });
							}
						},
					});
					return;
				}

				this.setData({
					joinCardOptions: list,
					cardNeedTimes: (res && res.needTimes) || this.data.cardNeedTimes || 1,
					cardPickLoading: false,
					selectedCardId: list.length === 1 ? list[0].id : '',
				});
			} catch (e) {
				console.error(e);
				this.setData({ cardSheetShow: false, cardPickLoading: false });
			}
		},

		bindCloseCardSheet: function () {
			this.setData({ cardSheetShow: false, cardPickLoading: false, selectedCardId: '' });
		},

		bindCardPick: function (e) {
			const cardId = pageHelper.dataset(e, 'id');
			if (!cardId) return;
			this.setData({ selectedCardId: cardId });
		},

		bindConfirmCardJoin: function () {
			const cardId = this.data.selectedCardId;
			if (!cardId) {
				pageHelper.showNoneToast('请先选择会员卡');
				return;
			}
			this.setData({ cardSheetShow: false, selectedCardId: '' });
			this._confirmJoinWithCard(cardId);
		},

		_confirmJoinWithCard: function (cardId) {
			const callback = async () => {
				try {
					await this._submitJoin(cardId);
				} catch (ex) {
					console.log(ex);
				}
			};
			MeetBiz.subscribeMessageMeet(callback);
		},

		_buildJoinForms: function (fields, prevForms, user) {
			const forms = [];
			for (let k in fields) {
				const field = fields[k];
				const node = {
					mark: field.mark,
					title: field.title,
					type: field.type,
					val: this._fixFormVal(field.type, this._pickFormVal(field, prevForms, user)),
				};
				forms.push(node);
			}
			return forms;
		},

		_pickFormVal: function (field, prevForms, user) {
			for (let k in prevForms) {
				const prev = prevForms[k];
				if (prev.mark === field.mark || prev.title === field.title) {
					if (prev.val !== undefined && prev.val !== null && prev.val !== '') {
						return prev.val;
					}
				}
				if (field.type === 'mobile' && prev.type === 'mobile' && prev.val) {
					return prev.val;
				}
			}

			if (!user) return '';

			const title = field.title || '';
			if (title.includes('姓名') || title === '名字') {
				return user.USER_NAME || '';
			}
			if (field.type === 'mobile' || title.includes('手机')) {
				return user.USER_MOBILE || '';
			}
			if (title.includes('城市') || title.includes('地区')) {
				return user.USER_CITY || '';
			}

			return '';
		},

		_fixFormVal: function (type, val) {
			if (type !== 'switch' && type !== 'checkbox' && type !== 'area') {
				if (typeof val === 'object' && !Array.isArray(val)) val = '';
				else if (val !== undefined && val !== null) val = String(val).trim();
				else val = '';
			}
			if (type === 'switch' && typeof val !== 'boolean') return true;
			if (type === 'area' && (!Array.isArray(val) || val.length !== 3)) return '';
			return val;
		},

		_submitJoin: async function (cardId) {
			const meetId = this.data.id;
			const timeMark = this.data.timeMark;
			if (!meetId || !timeMark || !cardId) return;

			this.setData({ submitting: true, bookBtnText: '预约中...' });

			try {
				const opts = { title: '预约中' };
				const user = await UserProfileBiz.fetch();

				if (!UserProfileBiz.isReady(user)) {
					UserProfileBiz.promptGoMyTab('请先在「我的」页填写微信昵称');
					return;
				}

				const [joinDetail] = await Promise.all([
					cloudHelper.callCloudData('meet/detail_for_join', { meetId, timeMark }, opts),
				]);

				if (!joinDetail) {
					pageHelper.showModal('获取预约信息失败，请稍后重试');
					return;
				}

				const skin = pageHelper.getSkin();
				let fields = joinDetail.MEET_FORM_SET;
				if (!fields || !fields.length) {
					fields = dataHelper.deepClone(skin.DEFAULT_FORMS || []);
				} else {
					fields = dataHelper.deepClone(fields);
				}
				fields = UserProfileBiz.relaxPhoneRequired(fields);

				const forms = this._buildJoinForms(fields, joinDetail.myForms || [], user);
				if (formSetHelper.checkForm(fields, forms) !== true) {
					UserProfileBiz.promptGoMyTab('请先在「我的」页填写微信昵称');
					return;
				}

				await cloudHelper.callCloudSumbit('meet/before_join', { meetId, timeMark }, opts);
				const res = await cloudHelper.callCloudSumbit(
					'meet/join',
					{ meetId, timeMark, forms, cardId },
					opts,
				);
				const joinId = res.data.joinId;

				wx.showModal({
					title: '温馨提示',
					showCancel: false,
					content: '预约成功！',
					success() {
						wx.reLaunch({
							url: pageHelper.fmtURLByPID('/pages/my/join_detail/my_join_detail?flag=home&id=' + joinId),
						});
					},
				});
			} finally {
				this.setData({ submitting: false });
				this._updateSlotDisplay(this.data.selectedDayIdx, this.data.selectedTimeIdx);
			}
		},

		onPullDownRefresh: async function () {
			await this._loadDetail();
			wx.stopPullDownRefresh();
		},

		onShareAppMessage: function () {
			return {
				title: this.data.meet ? this.data.meet.MEET_TITLE : '课程详情',
			};
		},

		bindJoinTap: async function (e) {
			this.bindBookTap();
		},

		url: function (e) {
			pageHelper.url(e, this);
		},
	},
});
