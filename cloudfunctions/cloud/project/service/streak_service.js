/**
 * Notes: 会员打卡成就
 */

const BaseService = require("./base_service.js");
const StreakModel = require("../model/streak_model.js");
const JoinModel = require("../model/join_model.js");
const timeUtil = require("../../framework/utils/time_util.js");
const dbUtil = require("../../framework/database/db_util.js");
const streakDateUtil = require("../utils/streak_date_util.js");

const HEATMAP_DAYS = 84;
const MS_DAY = 86400000;
const NEW_BADGE_MS = 7 * MS_DAY;
const STREAK_SYNC_VERSION = 3;
const STREAK_COLLECTIONS = ["ax_checkin_streak"];

const BADGE_DEFS = [
  { id: "first_class", name: "初心者", desc: "完成第一次上课", emoji: "🌱", type: "classes", target: 1 },
  { id: "classes_10", name: "十步之遥", desc: "累计上课 10 次", emoji: "👣", type: "classes", target: 10 },
  { id: "classes_30", name: "月度常客", desc: "累计上课 30 次", emoji: "🌙", type: "classes", target: 30 },
  { id: "classes_50", name: "稳定修行", desc: "累计上课 50 次", emoji: "🪷", type: "classes", target: 50 },
  { id: "classes_100", name: "百课不倦", desc: "累计上课 100 次", emoji: "👑", type: "classes", target: 100 },
  { id: "classes_200", name: "瑜伽深耕", desc: "累计上课 200 次", emoji: "⛰️", type: "classes", target: 200 },
  { id: "streak_4", name: "月月不断", desc: "连续上课 4 周", emoji: "🔥", type: "streak", target: 4 },
  { id: "streak_8", name: "习惯养成", desc: "连续上课 8 周", emoji: "💪", type: "streak", target: 8 },
  { id: "streak_12", name: "季度达人", desc: "连续上课 12 周", emoji: "⭐", type: "streak", target: 12 },
  { id: "streak_24", name: "半年坚守", desc: "连续上课 24 周", emoji: "🏆", type: "streak", target: 24 },
  { id: "streak_max_12", name: "最长记录", desc: "历史最长连续 ≥ 12 周", emoji: "📈", type: "streak_max", target: 12 },
];

class StreakService extends BaseService {
  async _ensureStreakCollections() {
    for (let cl of STREAK_COLLECTIONS) {
      if (!(await dbUtil.isExistCollection(cl))) {
        await dbUtil.createCollection(cl);
      }
    }
  }

  _normDay(day) {
    day = String(day || "").trim();
    if (!day) day = timeUtil.time("Y-M-D");
    return day.slice(0, 10);
  }

  _parseDay(day) {
    return new Date(day.replace(/-/g, "/") + " 12:00:00");
  }

  _fmtDay(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }

  _addDays(day, offset) {
    const d = this._parseDay(day);
    d.setDate(d.getDate() + offset);
    return this._fmtDay(d);
  }

  /** ISO 周 key：yyyy-Www */
  _isoWeekKey(day) {
    return streakDateUtil.isoWeekKey(day);
  }

  _isoWeekMonday(key) {
    return streakDateUtil.isoWeekMonday(key);
  }

  _weekGap(lastWeek, thisWeek) {
    return streakDateUtil.weekGap(lastWeek, thisWeek);
  }

  _activeJoinWhere(extra = {}) {
    return Object.assign(
      {
        JOIN_STATUS: JoinModel.STATUS.SUCC,
      },
      extra,
    );
  }

  async _getHistoricalJoins(userId, fields, limit = 3000) {
    return await JoinModel.getAll(
      this._activeJoinWhere({ JOIN_USER_ID: userId }),
      fields,
      { JOIN_MEET_DAY: "asc", JOIN_ADD_TIME: "asc" },
      limit,
    );
  }

  /** 首次打开成就页：按时间顺序回放历史有效约课，补齐累计/连续数据 */
  async syncStreakFromHistory(userId) {
    userId = String(userId || "").trim();
    if (!userId) return null;

    await this._ensureStreakCollections();

    let row = await StreakModel.getOne({ STREAK_USER_ID: userId }, "*");
    console.log("[streak] row=", JSON.stringify(row));

    // 已同步且版本一致且有数据 → 直接返回
    if (
      row &&
      row.STREAK_HISTORY_SYNCED === 1 &&
      row.STREAK_SYNC_VERSION === STREAK_SYNC_VERSION &&
      row.STREAK_DIRTY !== 1 &&
      (row.STREAK_TOTAL_CLASSES || 0) > 0
    ) {
      console.log("[streak] skip resync, totalClasses=", row.STREAK_TOTAL_CLASSES);
      return row;
    }

    const joins = await this._getHistoricalJoins(
      userId,
      "JOIN_MEET_DAY,JOIN_ADD_TIME",
    );
    console.log("[streak] historical joins count=", joins.length, "userId=", userId);
    if (joins.length > 0) {
      console.log("[streak] first join=", JSON.stringify(joins[0]));
    }
    if (!joins.length) {
      if (row) {
        await StreakModel.edit(
          { STREAK_USER_ID: userId },
          {
            STREAK_HISTORY_SYNCED: 1,
            STREAK_SYNC_VERSION: STREAK_SYNC_VERSION,
            STREAK_DIRTY: 0,
            STREAK_EDIT_TIME: timeUtil.time(),
          },
        );
        return row;
      }
      const empty = {
        STREAK_USER_ID: userId,
        STREAK_CURRENT: 0,
        STREAK_MAX: 0,
        STREAK_TOTAL_CLASSES: 0,
        STREAK_TOTAL_DAYS: 0,
        STREAK_BADGES: [],
        STREAK_BADGE_AT: {},
        STREAK_HISTORY_SYNCED: 1,
        STREAK_SYNC_VERSION: STREAK_SYNC_VERSION,
        STREAK_DIRTY: 0,
      };
      await StreakModel.insert(
        Object.assign(empty, {
          STREAK_ADD_TIME: timeUtil.time(),
          STREAK_EDIT_TIME: timeUtil.time(),
        }),
      );
      return await StreakModel.getOne({ STREAK_USER_ID: userId }, "*");
    }

    if (row) {
      await StreakModel.del({ STREAK_USER_ID: userId });
    }
    for (const join of joins) {
      await this.updateStreak(userId, join.JOIN_MEET_DAY);
    }
    await StreakModel.edit(
      { STREAK_USER_ID: userId },
      {
        STREAK_HISTORY_SYNCED: 1,
        STREAK_SYNC_VERSION: STREAK_SYNC_VERSION,
        STREAK_DIRTY: 0,
        STREAK_EDIT_TIME: timeUtil.time(),
      },
    );
    return await StreakModel.getOne({ STREAK_USER_ID: userId }, "*");
  }

  /** 预约新增/取消后标记，下次打开成就页按 ax_join 重新计算。 */
  async markStreakDirty(userId) {
    userId = String(userId || "").trim();
    if (!userId) return;
    await StreakModel.edit(
      { STREAK_USER_ID: userId },
      { STREAK_DIRTY: 1, STREAK_EDIT_TIME: timeUtil.time() },
    );
  }

  _detectBadges(state) {
    const unlocked = new Set(state.STREAK_BADGES || []);
    const badgeAt = Object.assign({}, state.STREAK_BADGE_AT || {});
    const now = timeUtil.time();
    const add = (id) => {
      if (unlocked.has(id)) return;
      unlocked.add(id);
      badgeAt[id] = now;
    };

    const total = state.STREAK_TOTAL_CLASSES || 0;
    const current = state.STREAK_CURRENT || 0;
    const max = state.STREAK_MAX || 0;

    for (const def of BADGE_DEFS) {
      if (def.type === "classes" && total >= def.target) add(def.id);
      if (def.type === "streak" && current >= def.target) add(def.id);
      if (def.type === "streak_max" && max >= def.target) add(def.id);
    }

    return {
      STREAK_BADGES: Array.from(unlocked),
      STREAK_BADGE_AT: badgeAt,
    };
  }

  /** 有效约课后增量更新成就（JOIN_STATUS=预约成功） */
  async updateStreak(userId, classDay) {
    userId = String(userId || "").trim();
    if (!userId) return;

    await this._ensureStreakCollections();

    const day = this._normDay(classDay);
    const thisWeek = this._isoWeekKey(day);

    let row = await StreakModel.getOne({ STREAK_USER_ID: userId }, "*");
    if (!row) {
      const init = {
        STREAK_USER_ID: userId,
        STREAK_CURRENT: 1,
        STREAK_MAX: 1,
        STREAK_LAST_WEEK: thisWeek,
        STREAK_TOTAL_CLASSES: 1,
        STREAK_TOTAL_DAYS: 1,
        STREAK_BADGES: [],
        STREAK_BADGE_AT: {},
        STREAK_LAST_DAY: day,
      };
      const badges = this._detectBadges(init);
      await StreakModel.insert(
        Object.assign(init, badges, {
          STREAK_ADD_TIME: timeUtil.time(),
          STREAK_EDIT_TIME: timeUtil.time(),
        }),
      );
      return;
    }

    const lastWeek = row.STREAK_LAST_WEEK || "";
    const gap = this._weekGap(lastWeek, thisWeek);
    let current = row.STREAK_CURRENT || 0;
    let max = row.STREAK_MAX || 0;

    if (!lastWeek) {
      current = 1;
    } else if (gap === 0) {
      // 同一自然周重复签到
    } else if (gap === 1) {
      current += 1;
    } else {
      current = 1;
    }
    max = Math.max(max, current);

    let totalClasses = (row.STREAK_TOTAL_CLASSES || 0) + 1;
    let totalDays = row.STREAK_TOTAL_DAYS || 0;
    if (row.STREAK_LAST_DAY !== day) totalDays += 1;

    const next = {
      STREAK_BADGES: row.STREAK_BADGES || [],
      STREAK_BADGE_AT: row.STREAK_BADGE_AT || {},
      STREAK_CURRENT: current,
      STREAK_MAX: max,
      STREAK_TOTAL_CLASSES: totalClasses,
    };
    const badges = this._detectBadges(next);
    // 只写模型字段，勿把 getOne 带回的 _id/_openid 等塞进 edit（会触发「脏数据」）
    await StreakModel.edit(
      { STREAK_USER_ID: userId },
      Object.assign(
        {
          STREAK_CURRENT: current,
          STREAK_MAX: max,
          STREAK_LAST_WEEK: thisWeek,
          STREAK_TOTAL_CLASSES: totalClasses,
          STREAK_TOTAL_DAYS: totalDays,
          STREAK_LAST_DAY: day,
          STREAK_EDIT_TIME: timeUtil.time(),
        },
        badges,
      ),
    );
  }

  _alignToSunday(day) {
    const d = this._parseDay(day);
    d.setDate(d.getDate() - d.getDay()); // 退到当周周日
    return this._fmtDay(d);
  }

  async buildHeatmap(userId) {
    const today = this._normDay(timeUtil.time("Y-M-D"));
    // 从今天所在周的周日往前推 11 周，共 12 列
    const todaySunday = this._alignToSunday(today);
    const startDay = this._addDays(todaySunday, -77); // 11周前的周日

    const rows = await JoinModel.getAll(
      this._activeJoinWhere({
        JOIN_USER_ID: userId,
        JOIN_MEET_DAY: [">=", startDay],
      }),
      "JOIN_MEET_DAY",
      { JOIN_MEET_DAY: "asc" },
      500,
    );

    const heatmap = {};
    for (const item of rows || []) {
      const d = this._normDay(item.JOIN_MEET_DAY);
      if (d >= startDay && d <= today) heatmap[d] = 1;
    }

    return {
      heatmap,
      heatmapDays: HEATMAP_DAYS,
      heatmapStartDay: startDay,
      activeDayCount: Object.keys(heatmap).length,
    };
  }

  _buildBadgeViews(row, now) {
    const unlockedSet = new Set((row && row.STREAK_BADGES) || []);
    const badgeAt = (row && row.STREAK_BADGE_AT) || {};
    const total = (row && row.STREAK_TOTAL_CLASSES) || 0;
    const current = (row && row.STREAK_CURRENT) || 0;
    const max = (row && row.STREAK_MAX) || 0;

    return BADGE_DEFS.map((def) => {
      const unlocked = unlockedSet.has(def.id);
      const at = badgeAt[def.id] || 0;
      const base = {
        id: def.id,
        name: def.name,
        desc: def.desc,
        emoji: def.emoji,
        unlocked,
        isNew: unlocked && at && now - at <= NEW_BADGE_MS,
      };
      if (unlocked) {
        base.unlockedAt = at
          ? timeUtil.timestamp2Time(at, "Y-M-D")
          : "";
        return base;
      }
      if (def.type === "classes") {
        base.progress = total;
        base.target = def.target;
        base.progressHint = `还差 ${Math.max(0, def.target - total)} 次`;
      } else if (def.type === "streak") {
        base.progress = current;
        base.target = def.target;
        base.progressHint = `还差 ${Math.max(0, def.target - current)} 周`;
      } else if (def.type === "streak_max") {
        base.progress = max;
        base.target = def.target;
        base.progressHint =
          max >= def.target
            ? ""
            : `最长纪录还差 ${Math.max(0, def.target - max)} 周`;
      }
      return base;
    });
  }

  async getAchievement(userId) {
    userId = String(userId || "").trim();
    if (!userId) this.AppError("请先登录");

    const now = timeUtil.time();
    const row = await this.syncStreakFromHistory(userId);
    const heat = await this.buildHeatmap(userId);
    // 漏掉至少一个完整自然周后，当前连续周数应归零；历史最长不受影响。
    let displayRow = row;
    if (row && row.STREAK_LAST_WEEK) {
      const gap = this._weekGap(
        row.STREAK_LAST_WEEK,
        this._isoWeekKey(timeUtil.time("Y-M-D")),
      );
      if (gap !== null && gap >= 2) {
        displayRow = Object.assign({}, row, { STREAK_CURRENT: 0 });
      }
    }

    let heatmapHint = "";
    if (!heat.activeDayCount) {
      heatmapHint =
        "近 12 周暂无上课记录。成就会统计历史预约成功记录，首次打开将自动回填。";
    }

    return {
      streak: {
        current: (displayRow && displayRow.STREAK_CURRENT) || 0,
        max: (row && row.STREAK_MAX) || 0,
        totalClasses: (row && row.STREAK_TOTAL_CLASSES) || 0,
        totalDays: (row && row.STREAK_TOTAL_DAYS) || 0,
      },
      badges: this._buildBadgeViews(displayRow, now),
      heatmap: heat.heatmap,
      heatmapDays: heat.heatmapDays,
      heatmapStartDay: heat.heatmapStartDay,
      heatmapHint,
      historySynced: !!(row && row.STREAK_HISTORY_SYNCED),
    };
  }

  getBadgeDefs() {
    return BADGE_DEFS.slice();
  }
}

module.exports = StreakService;
