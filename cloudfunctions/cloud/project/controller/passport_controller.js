/**
 * Notes: passport模块控制器
 * Date: 2021-03-15 19:20:00 
 */

const BaseController = require('./base_controller.js');
const PassportService = require('../service/passport_service.js');
const contentCheck = require('../../framework/validate/content_check.js');
const timeUtil = require('../../framework/utils/time_util.js');
const util = require('../../framework/utils/util.js');
const config = require('../../config/config.js');

class PassportController extends BaseController {

	/** 取得我的用户信息 */
	async getMyDetail() {
		let service = new PassportService();
		return await service.getMyDetail(this._userId);
	}

	/** 获取手机号码 */
	async getPhone() {

		// 数据校验
		let rules = {
			cloudID: 'string|max:200|name=cloudID',
			code: 'string|max:200|name=code',
		};

		// 取得数据
		let input = this.validateData(rules);

		if (!input.cloudID && !input.code) {
			this.AppError('缺少手机号授权凭证');
		}

		let service = new PassportService();
		return await service.getPhone(input.cloudID, input.code);
	}




	/** 同步微信资料（昵称 / 头像 / 手机号） */
	async syncProfile() {
		let rules = {
			name: 'string|max:30|name=昵称',
			mobile: 'string|max:20|name=手机',
			pic: 'string|max:5000|name=头像',
			cloudID: 'string|max:200|name=cloudID',
			code: 'string|max:200|name=code',
		};

		let input = this.validateData(rules);

		if (input.name) {
			await contentCheck.checkTextMultiClient({ name: input.name });
		}

		let service = new PassportService();
		return await service.syncProfile(this._userId, input);
	}

	/** 修改用户资料 */
	async editBase() {
		// 数据校验
		let rules = {
			name: 'must|string|min:1|max:20',
			mobile: 'must|mobile|name=手机',
			city: 'string|max:100|name=所在城市',
			work: 'string|max:100|name=所在单位',
			trade: 'string|max:100|name=行业领域',
		};

		// 取得数据
		let input = this.validateData(rules);

		// 内容审核
		await contentCheck.checkTextMultiClient(input);

		let service = new PassportService();
		return await service.editBase(this._userId, input);
	}

	/** 用户接受邀请，加入瑜伽馆 */
	async joinTenant() {
		let rules = {
			code: 'must|string|min:8|max:32|name=邀请码',
		};
		let input = this.validateData(rules);
		const MemberInviteService = require('../service/member_invite_service.js');
		let service = new MemberInviteService();
		return await service.joinTenant(this._userId, input.code);
	}

}

module.exports = PassportController;