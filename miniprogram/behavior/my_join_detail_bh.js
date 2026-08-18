const pageHelper = require('../helper/page_helper.js');
const cloudHelper = require('../helper/cloud_helper.js');
const timeHelper = require('../helper/time_helper.js');
const MeetBiz = require('../biz/meet_biz.js');
const checkinScanHelper = require('../helper/checkin_scan_helper.js');

module.exports = Behavior({

	/**
	 * 页面的初始数据
	 */
	data: {
		isLoad: false,
		checkinState: 'unavailable',
		checkinCountdownText: '',
	},

	methods: {
		/**
		 * 生命周期函数--监听页面加载
		 */
		onLoad: function (options) {
			if (!pageHelper.getOptions(this, options)) return;
			this._loadDetail();
		},

		_loadDetail: async function (e) {
			let id = this.data.id;
			if (!id) return;

			let params = {
				joinId: id
			}
			let opts = {
				title: 'bar'
			}
			try {
				let join = await cloudHelper.callCloudData('my/my_join_detail', params, opts);
				if (!join) {
					this.setData({
						isLoad: null
					})
					return;
				}

				this.setData({
					isLoad: true,
					join
				});
				this._startCheckinTimer();
			} catch (err) {
				console.error(err);
			}
		},

		/**
		 * 生命周期函数--监听页面初次渲染完成
		 */
		onReady: function () {

		},

		/**
		 * 生命周期函数--监听页面显示
		 */
		onShow: function () {
			if (this.data.join) this._startCheckinTimer();
		},

		/**
		 * 生命周期函数--监听页面隐藏
		 */
		onHide: function () {
		this._stopCheckinTimer();
		},

		/**
		 * 生命周期函数--监听页面卸载
		 */
		onUnload: function () {
		this._stopCheckinTimer();
		},

		_startCheckinTimer: function () {
			this._stopCheckinTimer();
			this._updateCheckinStatus();
			this._checkinTimer = setInterval(() => this._updateCheckinStatus(), 1000);
		},

		_stopCheckinTimer: function () {
			if (this._checkinTimer) {
				clearInterval(this._checkinTimer);
				this._checkinTimer = null;
			}
		},

		_updateCheckinStatus: function () {
			const join = this.data.join;
			if (!join || join.JOIN_STATUS !== 1) {
				this.setData({ checkinState: 'unavailable', checkinCountdownText: '' });
				return;
			}
			if (Number(join.JOIN_IS_CHECKIN) === 1) {
				this.setData({ checkinState: 'done', checkinCountdownText: '' });
				return;
			}
			const start = timeHelper.time2Timestamp(join.JOIN_MEET_DAY + ' ' + join.JOIN_MEET_TIME_START + ':00');
			const end = timeHelper.time2Timestamp(join.JOIN_MEET_DAY + ' ' + join.JOIN_MEET_TIME_END + ':00');
			const now = Date.now();
			const beforeMs = 30 * 60 * 1000;
			const afterMs = 30 * 60 * 1000;
			let state = 'ready';
			let text = '到店签到';
			if (now < start - beforeMs) {
				state = 'before';
				text = '距开课 ' + this._formatCountdown(start - now);
			} else if (now > end + afterMs) {
				state = 'ended';
				text = '签到已截止';
			} else if (now > end) {
				text = '课程已结束 · 可补签';
			}
			this.setData({ checkinState: state, checkinCountdownText: text });
		},

		_formatCountdown: function (ms) {
			const seconds = Math.max(0, Math.ceil(ms / 1000));
			const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
			const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
			const s = String(seconds % 60).padStart(2, '0');
			return h + ':' + m + ':' + s;
		},

		/**
		 * 页面相关事件处理函数--监听用户下拉动作
		 */
		onPullDownRefresh: async function () {
			await this._loadDetail();
			wx.stopPullDownRefresh();
		},

		/**
		 * 用户点击右上角分享
		 */
		onShareAppMessage: function () {

		},

		bindCancelTap: async function (e) {
			let callback = async () => {
				try {
					let params = {
						joinId: this.data.id
					}
					let opts = {
						title: '取消中'
					}

					await cloudHelper.callCloudSumbit('my/my_join_cancel', params, opts).then(res => {
						let join = this.data.join;
						join.JOIN_STATUS = 10;
						this.setData({
							join
						});
						pageHelper.showNoneToast('已取消');
					});
				} catch (err) {
					console.log(err);
				}
			}

			pageHelper.showConfirm('确认取消该预约?', callback);
		},

		url: function (e) {
			pageHelper.url(e, this);
		},

		bindLocationCheckinTap: function () {
			if (this.data.checkinState !== 'ready') {
				pageHelper.showNoneToast(this.data.checkinCountdownText || '当前不可签到');
				return;
			}
			checkinScanHelper.locationCheckin({
				timeMark: this.data.join.JOIN_MEET_TIME_MARK,
				onSuccess: (msg) => {
					pageHelper.showModal(msg, '签到结果', () => this._loadDetail());
				},
			});
		},

		bindNoticeTap: function (e) {
			let callback = () => {
				pageHelper.showSuccToast('开启成功');
			}
			MeetBiz.subscribeMessageMeet(callback);
		},

		bindCalendarTap: function (e) {
			let join = this.data.join;
			let title = join.JOIN_MEET_TITLE;

			let startTime = timeHelper.time2Timestamp(join.JOIN_MEET_DAY + ' ' + join.JOIN_MEET_TIME_START + ':00') / 1000;
			let endTime = timeHelper.time2Timestamp(join.JOIN_MEET_DAY + ' ' + join.JOIN_MEET_TIME_END + ':00') / 1000;

			MeetBiz.addMeetPhoneCalendar(title, startTime, endTime);
		}
	},

})
