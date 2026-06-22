/**

 * Notes: passport模块业务逻辑 

 * Date: 2020-10-14 07:48:00 

 */



const BaseService = require('./base_service.js');



const cloudBase = require('../../framework/cloud/cloud_base.js');

const UserModel = require('../model/user_model.js');

const config = require('../../config/config.js');



class PassportService extends BaseService {



	// 用户资料按 openid 全局存储，不按租户 _pid 隔离

	static MUST_PID = false;



	// 插入用户

	async insertUser(userId, mobile, name = '', joinCnt = 0) {

		let where = {

			USER_MINI_OPENID: userId

		}

		let cnt = await UserModel.count(where, PassportService.MUST_PID);

		if (cnt > 0) return;



		let data = {

			USER_MINI_OPENID: userId,

			USER_MOBILE: mobile,

			USER_NAME: name

		}

		await UserModel.insert(data, PassportService.MUST_PID);

	}



	/** 获取手机号码（支持新版 code 与旧版 cloudID） */

	async getPhone(cloudID, code) {

		let cloud = cloudBase.getCloud();



		if (code) {

			try {

				const res = await cloud.openapi.phonenumber.getPhoneNumber({ code });

				const info = res.phoneInfo || res.phone_info || {};

				return info.phoneNumber || info.purePhoneNumber || '';

			} catch (err) {

				console.error('[getPhone code]', err);

			}

		}



		if (cloudID) {

			try {

				let res = await cloud.getOpenData({

					list: [cloudID],

				});

				if (res && res.list && res.list[0] && res.list[0].data) {

					return res.list[0].data.phoneNumber || '';

				}

			} catch (err) {

				console.error('[getPhone cloudID]', err);

			}

		}



		if (config.TEST_MODE) {

			return '13800138000';

		}



		return '';

	}



	/** 取得我的用户信息（不存在则自动创建） */

	async getMyDetail(userId) {

		let where = {

			USER_MINI_OPENID: userId

		}

		let fields = 'USER_MOBILE,USER_NAME,USER_PIC,USER_CITY,USER_TRADE,USER_WORK'

		let user = await UserModel.getOne(where, fields, {}, PassportService.MUST_PID);

		if (!user) {

			await UserModel.insert({ USER_MINI_OPENID: userId }, PassportService.MUST_PID);

			user = await UserModel.getOne(where, fields, {}, PassportService.MUST_PID);

		}

		return user;

	}



	/** 同步微信昵称 / 头像 / 手机号 */

	async syncProfile(userId, { name, mobile, pic, cloudID, code }) {

		if (code || cloudID) {

			mobile = await this.getPhone(cloudID, code);

			if (!mobile) {

				this.AppError('手机号获取失败，请使用真机预览重新授权');

			}

		}



		let where = { USER_MINI_OPENID: userId };

		let data = {};

		if (name) data.USER_NAME = name;

		if (mobile) data.USER_MOBILE = mobile;

		if (pic) data.USER_PIC = pic;



		if (Object.keys(data).length === 0) return await this.getMyDetail(userId);



		let cnt = await UserModel.count(where, PassportService.MUST_PID);

		if (cnt == 0) {

			data.USER_MINI_OPENID = userId;

			await UserModel.insert(data, PassportService.MUST_PID);

		} else {

			await UserModel.edit(where, data, PassportService.MUST_PID);

		}



		return await this.getMyDetail(userId);

	}



	/** 修改用户资料 */

	async editBase(userId, {

		mobile,

		name,

		trade,

		work,

		city

	}) {

		let where = {

			USER_MINI_OPENID: userId

		};

		let cnt = await UserModel.count(where, PassportService.MUST_PID);

		if (cnt == 0) {

			await this.insertUser(userId, mobile, name, 0);

			return;

		}



		let data = {

			USER_MOBILE: mobile,

			USER_NAME: name,

			USER_CITY: city,

			USER_WORK: work,

			USER_TRADE: trade

		};



		await UserModel.edit(where, data, PassportService.MUST_PID);

	}

}



module.exports = PassportService;

