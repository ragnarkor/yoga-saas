/**
 * 云函数配置模板。
 *
 * 复制为 config.js 后，填入自己的云环境 ID 与超管账号。config.js 已被
 * .gitignore 忽略，禁止提交真实凭据。
 */
module.exports = {
  CLOUD_ID: "your-cloud-environment-id",

  ADMIN_NAME: "admin",
  ADMIN_PWD: "change-this-before-production",
  PERIOD_INCOME_MODE: "per_day",

  // 留空表示由客户端在每次请求中传入当前租户 ID。
  PID: "",
  IS_DEMO: false,

  NEWS_CATE: "1=本店动态,2=瑜伽常识",
  MEET_TYPE: "1=教练预约,2=课程预约",

  // 生产环境必须为 false。
  TEST_MODE: false,
  TEST_TOKEN_ID: "test_openid_001",
  CHECKIN_LOCATION_RADIUS_METERS: 150,
  CHECKIN_BEFORE_MINUTES: 30,
  CHECKIN_AFTER_MINUTES: 30,

  COLLECTION_NAME:
    "ax_admin|ax_cache|ax_day|ax_export|ax_join|ax_log|ax_meet|ax_news|ax_setup|ax_temp|ax_user|ax_tenant|ax_banner|ax_announcement|ax_teacher|ax_photo|ax_checkin_streak",

  DATA_EXPORT_PATH: "export/",
  SETUP_PATH: "setup/",
  MEMBER_INVITE_QR_PATH: "invite/member/",

  IS_CACHE: true,
  CACHE_CALENDAR_TIME: 60 * 30,
  CACHE_HOME_TIME: 60 * 10,

  CLIENT_CHECK_CONTENT: false,
  ADMIN_CHECK_CONTENT: false,
  MEET_LOG_LEVEL: "info",
  ADMIN_LOGIN_EXPIRE: 86400,
};
