const pageHelper = require('../helper/page_helper.js');
const cloudHelper = require('../helper/cloud_helper.js');

module.exports = Behavior({

	/**
	 * 页面的初始数据
	 */
	data: {

	},

	methods: {
		/**
		 * 生命周期函数--监听页面加载
		 */
		onLoad: async function (options) {
			const timeMark =
				(options && options.scene) ||
				(options && options.timeMark) ||
				(options && options.mark) ||
				'';

			if (timeMark) {
				let params = {
					timeMark: decodeURIComponent(timeMark)
				};
				let opts = {
					title: 'bar'
				}
				try {
					await cloudHelper.callCloudSumbit('my/my_join_checkin', params, opts).then(res => {
						let cb = () => {
							wx.reLaunch({
								url: pageHelper.fmtURLByPID('/pages/my/index/my_index'),
							});
						}
						pageHelper.showModal(res.data.ret, '温馨提示', cb);
					});
				} catch (err) {
					console.error(err);
				}
			} else {
				pageHelper.showModal('签到码无效，请扫描场馆出示的签到码，或使用「我的」页扫码签到');
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

		},

		/**
		 * 生命周期函数--监听页面隐藏
		 */
		onHide: function () {

		},

		/**
		 * 生命周期函数--监听页面卸载
		 */
		onUnload: function () {

		},

		/**
		 * 页面相关事件处理函数--监听用户下拉动作
		 */
		onPullDownRefresh: function () {

		},

		/**
		 * 页面上拉触底事件的处理函数
		 */
		onReachBottom: function () {

		},

		/**
		 * 用户点击右上角分享
		 */
		onShareAppMessage: function () {

		}
	}
})