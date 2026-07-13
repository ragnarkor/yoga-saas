/**
 * Notes: 会员打卡成就聚合
 */

const BaseModel = require("./base_model.js");

class StreakModel extends BaseModel {}

StreakModel.CL = "ax_checkin_streak";

StreakModel.DB_STRUCTURE = {
  _pid: "string|true",
  STREAK_ID: "string|true",
  STREAK_USER_ID: "string|true|comment=会员openid",

  STREAK_CURRENT: "int|true|default=0|comment=当前连续上课周数",
  STREAK_MAX: "int|true|default=0|comment=历史最长连续周数",
  STREAK_LAST_WEEK: "string|false|comment=最后签到ISO周 yyyy-Www",

  STREAK_TOTAL_CLASSES: "int|true|default=0|comment=累计上课次数",
  STREAK_TOTAL_DAYS: "int|true|default=0|comment=累计上课天数",

  STREAK_BADGES: "array|true|default=[]|comment=已解锁徽章ID",
  STREAK_BADGE_AT: "object|false|default={}|comment=徽章解锁时间戳",
  STREAK_LAST_DAY: "string|false|comment=最后一次签到自然日",
  STREAK_HISTORY_SYNCED:
    "int|true|default=0|comment=是否已从历史约课回填",
  STREAK_SYNC_VERSION:
    "int|true|default=0|comment=历史回填口径版本，变更后触发重算",

  STREAK_ADD_TIME: "int|true",
  STREAK_EDIT_TIME: "int|true",
  STREAK_ADD_IP: "string|false",
  STREAK_EDIT_IP: "string|false",
};

StreakModel.FIELD_PREFIX = "STREAK_";

module.exports = StreakModel;
