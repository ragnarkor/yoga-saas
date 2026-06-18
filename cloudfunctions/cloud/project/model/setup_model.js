/**
 * Notes: 系统设置实体
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux@qq.com
 * Date: 2020-11-05 19:20:00
 * Version : CCMiniCloud Framework Ver 2.0.1 ALL RIGHTS RESERVED BY 明章科技
 */

const BaseAlumniModel = require("./base_model.js");

class SetupModel extends BaseAlumniModel {}

// 集合名
SetupModel.CL = "ax_setup";

SetupModel.DB_STRUCTURE = {
  _pid: "string|true",
  SETUP_ID: "string|true",

  SETUP_NAME: "string|false",

  SETUP_ABOUT: "string|false|comment=关于我们",
  SETUP_ABOUT_PIC: "array|false|default=[]|comment=关于我们的图片cloudId",

  SETUP_SERVICE_PIC: "array|false|default=[]|comment=客服图片cloudId",
  SETUP_OFFICE_PIC: "array|false|default=[]|comment=官微图片cloudId",

  SETUP_ADDRESS: "string|false|comment=地址",
  SETUP_PHONE: "string|false|comment=电话",

  // [AI_START TIMESTAMP=2025-01-25 10:00:00]
  SETUP_FEATURES: "object|true|default={} |comment=功能开关配置",
  /*
	{
		booking: true,         // 预约功能
		payment: false,        // 支付功能
		teacherManage: true,   // 教师管理
		checkin: true,         // 签到核销
		news: true,            // 动态资讯
		selfCheckin: false     // 用户自助签到
	}
	*/
  // [AI_END LINES=11 TIMESTAMP=2025-01-25 10:00:00]

  SETUP_ADD_TIME: "int|true",
  SETUP_EDIT_TIME: "int|true",
  SETUP_ADD_IP: "string|false",
  SETUP_EDIT_IP: "string|false",
};

// 字段前缀
SetupModel.FIELD_PREFIX = "SETUP_";

module.exports = SetupModel;
