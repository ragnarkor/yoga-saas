const pageHelper = require('../helper/page_helper.js');
const cloudHelper = require('../helper/cloud_helper.js');
const setting = require('../setting/setting.js');

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
			if (setting.IS_SUB) wx.hideHomeButton();
		},

		_loadList: async function () {
			let opts = {
				title: 'bar'
			}
			try {
				let res = await cloudHelper.callCloudSumbit('news/home_list', {}, opts);
				let list = (res && res.data) ? res.data : [];
				if (Array.isArray(list)) {
					list = list.map((item) => ({
						...item,
						pic: pageHelper.fmtImgUrl(item.pic),
					}));
				}
				this.setData({
					dataList: list
				});
			} catch (err) {
				console.error(err);
				this.setData({
					dataList: []
				});
			}
		},

		/**
		 * 生命周期函数--监听页面初次渲染完成
		 */
		onReady: function () {},

		/**
		 * 生命周期函数--监听页面显示
		 */
		onShow: async function () {
			this._loadList(); 
		},

		onPullDownRefresh: async function () {
			await this._loadList();
			wx.stopPullDownRefresh();
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

		url: async function (e) {
			pageHelper.url(e, this);
		},


		/**
		 * 用户点击右上角分享
		 */
		onShareAppMessage: function () {

		},
	}
})