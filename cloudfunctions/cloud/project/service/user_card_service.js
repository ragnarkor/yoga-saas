/**
    let list = [];
    console.log(
      '[user_card_service] _listUsableCards fetched',
      (cards && cards.length) || 0,
      'cards, tplIds',
      tplIds.length,
    );
    for (let k in cards || []) {
      let card = cards[k];
      console.log('[user_card_service] checking card', card._id || card.USER_CARD_ID, card.USER_CARD_NAME);
      await this._selfHealCardEndTime(card, daysMap);
      await this._selfHealPeriodCardRecord(card, typeMap);
      if (card.USER_CARD_STATUS !== UserCardModel.STATUS.NORMAL) {
        console.log('[user_card_service] skip card not normal', card._id, 'status', card.USER_CARD_STATUS);
        continue;
      }
      const pending = this._isPendingActivation(card);
      if (!pending && this._isExpired(card, now)) {
        console.log('[user_card_service] skip card expired', card._id);
        continue;
      }
      if (!this._cardValidForMeetDay(card, meetDay, now, daysMap)) {
        console.log('[user_card_service] skip card not valid for meet day', card._id, 'meetDay', meetDay);
        continue;
      }

      const type = this._resolveCardType(card, typeMap);
      const quota = Number(card.USER_CARD_QUOTA) || 0;
      if (type === CardTplModel.TYPE.TIMES && quota < needTimes) {
        console.log('[user_card_service] skip card insufficient quota', card._id, 'quota', quota, 'need', needTimes);
        continue;
      }
      if (pending && !this._canUsePendingForJoin(card)) {
        console.log('[user_card_service] skip card pending not allowed', card._id);
        continue;
      }
      const scope = this._resolveCardScopeSync(card, scopeMap);
      if (meet && !this._cardMatchesMeetScope(scope, meet)) {
        console.log('[user_card_service] skip card scope mismatch', card._id, 'scope', scope);
        continue;
      }

      const afterQuota =
        type === CardTplModel.TYPE.PERIOD ? quota : Math.max(0, quota - needTimes);
      console.log('[user_card_service] include card', card._id, 'type', type, 'quota', quota, 'afterQuota', afterQuota);
      list.push({
        id: card._id,
        name: card.USER_CARD_NAME || "会员卡",
        type,
        typeLabel: CardTplModel.TYPE_DESC[type] || "次数卡",
        quota,
        needTimes: type === CardTplModel.TYPE.PERIOD ? 0 : needTimes,
        afterQuota,
        balanceText:
          type === CardTplModel.TYPE.PERIOD
            ? "期限内畅练"
            : `剩余 ${quota} 次`,
        deductHint:
          type === CardTplModel.TYPE.PERIOD
            ? "本课不扣次"
            : `本次扣 ${needTimes} 次，剩余 ${afterQuota} 次`,
        color: colorMap[card.USER_CARD_TPL_ID] || "#F5A623",
        coverId: coverMap[card.USER_CARD_TPL_ID] || "",
      });
    }
  _canUsePendingForJoin(card) {
    if (!this._isPendingActivation(card)) return false;
    const activate = card.USER_CARD_ACTIVATE || UserCardModel.ACTIVATE.IMMEDIATE;
    return [
      UserCardModel.ACTIVATE.FIRST_BOOK,
      UserCardModel.ACTIVATE.FIRST_CLASS,
      UserCardModel.ACTIVATE.FIRST_USE_LIMIT,
    ].includes(activate);
  }

  _resolveCardType(card, tplTypeMap = {}) {
    const tplId = card.USER_CARD_TPL_ID;
    const tplType = tplId && tplTypeMap[tplId];
    const raw = String(card.USER_CARD_TYPE || "")
      .trim()
      .toLowerCase();

    if (raw === CardTplModel.TYPE.PERIOD) return CardTplModel.TYPE.PERIOD;
    if (tplType === CardTplModel.TYPE.PERIOD) return CardTplModel.TYPE.PERIOD;

    if (raw === CardTplModel.TYPE.TIMES) return CardTplModel.TYPE.TIMES;
    if (tplType === CardTplModel.TYPE.TIMES) return CardTplModel.TYPE.TIMES;

    return CardTplModel.TYPE.TIMES;
  }

  _cardDayFromTs(ts) {
    const n = Number(ts) || 0;
    if (n <= 0) return "";
    return timeUtil.timestamp2Time(n, "Y-M-D");
  }

  _resolveCardDays(card, tplDaysMap = {}) {
    const cardDays = Number(card.USER_CARD_DAYS) || 0;
    if (cardDays > 0) return cardDays;
    const tplId = card.USER_CARD_TPL_ID;
    const tplDays = tplId ? Number(tplDaysMap[tplId]) || 0 : 0;
    return tplDays > 0 ? tplDays : 0;
  }

  _addCardDaysMs(nowMs, days) {
    return nowMs + (Number(days) || 0) * MS_PER_DAY;
  }

  _needsCardEndHeal(card, days) {
    const start = Number(card.USER_CARD_START_TIME) || 0;
    const end = Number(card.USER_CARD_END_TIME) || 0;
    const validDays = Number(days) || 0;
    if (start <= 0 || end <= 0 || validDays <= 0) return false;
    const duration = end - start;
    const expected = validDays * MS_PER_DAY;
    return duration > 0 && duration < expected * 0.5;
  }

  async _selfHealCardEndTime(card, tplDaysMap = {}) {
    if (!card) return;
    let days = this._resolveCardDays(card, tplDaysMap);
    if (days <= 0 && card.USER_CARD_TPL_ID) {
      const tpl = await CardTplModel.getOne(
        { CARD_TPL_ID: card.USER_CARD_TPL_ID },
        "CARD_TPL_DAYS",
      );
      days = Number(tpl && tpl.CARD_TPL_DAYS) || 0;
    }
    if (days <= 0) return;

    const patch = {};
    if ((Number(card.USER_CARD_DAYS) || 0) <= 0) {
      patch.USER_CARD_DAYS = days;
      card.USER_CARD_DAYS = days;
    }

    if (!this._needsCardEndHeal(card, days)) {
      if (Object.keys(patch).length) {
        patch.USER_CARD_EDIT_TIME = timeUtil.time();
        await UserCardModel.edit({ _id: card._id }, patch);
      }
      return;
    }

    const start = Number(card.USER_CARD_START_TIME) || 0;
    const fixedEnd = this._addCardDaysMs(start, days);
    patch.USER_CARD_END_TIME = fixedEnd;
    patch.USER_CARD_EDIT_TIME = timeUtil.time();
    await UserCardModel.edit({ _id: card._id }, patch);
    card.USER_CARD_END_TIME = fixedEnd;
  }

  _meetDayFromTimeMark(timeMark) {
    if (!timeMark || timeMark.length < 11) return "";
    return (
      timeMark.substr(1, 4) +
      "-" +
      timeMark.substr(5, 2) +
      "-" +
      timeMark.substr(7, 2)
    );
  }

  /** 会员卡是否覆盖指定上课日（已激活卡不可预约有效期外的课程） */
  _cardValidForMeetDay(card, meetDay, now, tplDaysMap = {}) {
    const pending = this._isPendingActivation(card);
    if (pending) {
      if (!this._canUsePendingForJoin(card)) return false;
      if (!meetDay) return true;

      const activate = card.USER_CARD_ACTIVATE || UserCardModel.ACTIVATE.IMMEDIATE;
      if (
        activate === UserCardModel.ACTIVATE.FIRST_BOOK ||
        activate === UserCardModel.ACTIVATE.FIRST_USE_LIMIT
      ) {
        const days = this._resolveCardDays(card, tplDaysMap);
        if (days <= 0) return true;
        const endDay = this._cardDayFromTs(this._addCardDaysMs(now, days));
        return !endDay || meetDay <= endDay;
      }
      return true;
    }

    if (this._isExpired(card, now)) return false;
    if (!meetDay) return true;

    const endDay = this._cardDayFromTs(card.USER_CARD_END_TIME);
    const startDay = this._cardDayFromTs(card.USER_CARD_START_TIME);
    if (endDay && meetDay > endDay) return false;
    if (startDay && meetDay < startDay) return false;
    return true;
  }

  async _selfHealPeriodCardRecord(card, tplTypeMap = {}) {
    const type = this._resolveCardType(card, tplTypeMap);
    if (type !== CardTplModel.TYPE.PERIOD) return;

    const patch = {};
    if (card.USER_CARD_TYPE !== CardTplModel.TYPE.PERIOD) {
      patch.USER_CARD_TYPE = CardTplModel.TYPE.PERIOD;
    }
    if (
      card.USER_CARD_STATUS === UserCardModel.STATUS.USED &&
      !this._isPendingActivation(card) &&
      !this._isExpired(card, timeUtil.time())
    ) {
      patch.USER_CARD_STATUS = UserCardModel.STATUS.NORMAL;
    }
    if (!Object.keys(patch).length) return;

    patch.USER_CARD_EDIT_TIME = timeUtil.time();
    await UserCardModel.edit({ _id: card._id }, patch);
    Object.assign(card, patch);
  }

  _buildActivatePatch(card, now, tplDaysMap = {}) {
    const days = this._resolveCardDays(card, tplDaysMap);
    if (days <= 0) {
      return {
        USER_CARD_START_TIME: now,
        USER_CARD_EDIT_TIME: now,
      };
    }
    return {
      USER_CARD_START_TIME: now,
      USER_CARD_END_TIME: this._addCardDaysMs(now, days),
      USER_CARD_DAYS: days,
      USER_CARD_EDIT_TIME: now,
    };
  }

  async _tryActivateCard(card, trigger, tplDaysMap = {}) {
    if (!card || !this._isPendingActivation(card)) return false;
    const activate = card.USER_CARD_ACTIVATE || UserCardModel.ACTIVATE.IMMEDIATE;
    let shouldActivate = false;
    if (trigger === "book") {
      shouldActivate =
        activate === UserCardModel.ACTIVATE.FIRST_BOOK ||
        activate === UserCardModel.ACTIVATE.FIRST_USE_LIMIT;
    } else if (trigger === "checkin") {
      shouldActivate =
        activate === UserCardModel.ACTIVATE.FIRST_CLASS ||
        activate === UserCardModel.ACTIVATE.FIRST_USE_LIMIT;
    }
    if (!shouldActivate) return false;
    await UserCardModel.edit(
      { _id: card._id },
      this._buildActivatePatch(card, timeUtil.time(), tplDaysMap),
    );
    return true;
  }

  async _loadCardTplDaysMap(tplId) {
    if (!tplId) return {};
    const tpl = await CardTplModel.getOne(
      { CARD_TPL_ID: tplId },
      "CARD_TPL_DAYS",
    );
    const days = Number(tpl && tpl.CARD_TPL_DAYS) || 0;
    return days > 0 ? { [tplId]: days } : {};
  }

  async tryActivateForJoinBook(cardId) {
    if (!cardId) return;
    await this._ensureCardCollections();
    let card = await UserCardModel.getOne({ _id: cardId });
    const tplDaysMap = card
      ? await this._loadCardTplDaysMap(card.USER_CARD_TPL_ID)
      : {};
    await this._tryActivateCard(card, "book", tplDaysMap);
  }

  async tryActivateForJoinCheckin(joinId, userId) {
    if (!joinId || !userId) return;
    await this._ensureCardCollections();
    let log = await UserCardLogModel.getOne({
      CARD_LOG_JOIN_ID: joinId,
      CARD_LOG_USER_ID: userId,
      CARD_LOG_ACTION: UserCardLogModel.ACTION.DEDUCT,
    });
    if (!log || !log.CARD_LOG_USER_CARD_ID) return;
    let card = await UserCardModel.getOne({
      _id: log.CARD_LOG_USER_CARD_ID,
      USER_CARD_USER_ID: userId,
    });
    await this._tryActivateCard(card, "checkin", await this._loadCardTplDaysMap(card.USER_CARD_TPL_ID));
  }

  async _getCategoryNameMap() {
    try {
      const AdminTenantService = require("./admin/admin_tenant_service.js");
      const store = await new AdminTenantService().getStore(this.getProjectId());
      const map = {};
      for (const c of (store && store.categories) || []) {
        if (c && c.id != null) map[String(c.id)] = c.name || String(c.id);
      }
      return map;
    } catch (err) {
      console.error("[UserCardService] category map:", err.message);
      return {};
    }
  }

  _mapCardItem(
    card,
    now,
    tplColor,
    nameMap = {},
    tplCoverId = "",
    tplTypeMap = {},
    tplDaysMap = {},
  ) {
    const type = this._resolveCardType(card, tplTypeMap);
    const expired = this._isExpired(card, now);
    const pending = this._isPendingActivation(card);
    let status = card.USER_CARD_STATUS;
    if (status === UserCardModel.STATUS.NORMAL && expired) {
      status = UserCardModel.STATUS.USED;
    }
    if (
      type === CardTplModel.TYPE.TIMES &&
      status === UserCardModel.STATUS.NORMAL &&
      Number(card.USER_CARD_QUOTA) <= 0
    ) {
      status = UserCardModel.STATUS.USED;
    }
    if (
      type === CardTplModel.TYPE.PERIOD &&
      status === UserCardModel.STATUS.USED &&
      !expired &&
      !pending
    ) {
      status = UserCardModel.STATUS.NORMAL;
    }

    let statusLabel = "正常";
    if (pending) statusLabel = "待激活";
    else if (status === UserCardModel.STATUS.STOP) statusLabel = "停卡";
    else if (status === UserCardModel.STATUS.USED || expired)
      statusLabel = "失效";
    else if (type === CardTplModel.TYPE.TIMES) statusLabel = "正常";

    const endTs = Number(card.USER_CARD_END_TIME) || 0;
    const startTs = Number(card.USER_CARD_START_TIME) || 0;
    const validDays = this._resolveCardDays(card, tplDaysMap);
    let endTimeDesc = pending
      ? `${UserCardModel.ACTIVATE_DESC[card.USER_CARD_ACTIVATE] || "待激活"}${
          validDays > 0 ? ` · ${validDays}天` : ""
        }`
      : "长期有效";
    if (!pending && endTs > 0) {
      endTimeDesc =
        validDays > 0
          ? `${timeUtil.timestamp2Time(endTs, "Y-M-D")}（${validDays}天）`
          : timeUtil.timestamp2Time(endTs, "Y-M-D");
    }
    let startTimeDesc = "";
    if (startTs > 0) {
      startTimeDesc = timeUtil.timestamp2Time(startTs, "Y-M-D");
    }

    const activate = card.USER_CARD_ACTIVATE || UserCardModel.ACTIVATE.IMMEDIATE;
    const quota = Number(card.USER_CARD_QUOTA) || 0;
    const scope = cardScopeUtil.getCardScope(card);
    const scopeDesc = cardScopeUtil.buildScopeDesc(scope, nameMap);

    return {
      id: card._id,
      cardNo: card.USER_CARD_ID || card._id,
      name: card.USER_CARD_NAME || "会员卡",
      type,
      typeLabel: CardTplModel.TYPE_DESC[type] || "次数卡",
      quota,
      quotaInit: Number(card.USER_CARD_QUOTA_INIT) || 0,
      balanceText:
        type === CardTplModel.TYPE.PERIOD
          ? validDays > 0
            ? `期限内畅练 · ${validDays}天`
            : "期限内畅练"
          : `${quota}次`,
      validDays,
      endTime: endTs,
      endTimeDesc,
      startTime: startTs,
      startTimeDesc,
      coachName: card.USER_CARD_COACH_NAME || "",
      memo: card.USER_CARD_MEMO || "",
      price: Number(card.USER_CARD_PRICE) || 0,
      activate,
      activateLabel: UserCardModel.ACTIVATE_DESC[activate] || "立即激活",
      scope,
      scopeDesc,
      status,
      statusLabel,
      isActive:
        status === UserCardModel.STATUS.NORMAL &&
        !expired &&
        !pending &&
        (type === CardTplModel.TYPE.PERIOD || quota > 0),
      canBook:
        status === UserCardModel.STATUS.NORMAL &&
        !expired &&
        (pending ? this._canUsePendingForJoin(card) : true) &&
        (type === CardTplModel.TYPE.PERIOD || quota > 0),
      isPending: pending,
      color: tplColor || "#F5A623",
      coverId: cardCoverUtil.normalizeCover(tplCoverId),
    };
  }

  _mapUsageLog(log) {
    const day = log.CARD_LOG_MEET_DAY || "";
    const weekDesc = day ? timeUtil.week(day) : "";
    const dayDesc = day ? `${day} (${weekDesc})` : "";
    const start = log.CARD_LOG_TIME_START || "";
    const end = log.CARD_LOG_TIME_END || "";
    const times = Number(log.CARD_LOG_TIMES) || 0;
    const action = log.CARD_LOG_ACTION || UserCardLogModel.ACTION.DEDUCT;
    const isRefund = log.CARD_LOG_STATUS === UserCardLogModel.STATUS.REFUNDED;
    const coachName = log.CARD_LOG_COACH_NAME || log.CARD_LOG_OPERATOR_NAME || "教练";
    const memo = (log.CARD_LOG_MEMO || "").trim();

    if (action === UserCardLogModel.ACTION.MANUAL_ADD) {
      return {
        id: log._id,
        meetTitle: log.CARD_LOG_MEET_TITLE || "手动加次",
        meetTypeName: memo || "手动调整",
        coachName,
        deductText: `+${times}次`,
        dayDesc,
        timeRange: "",
        scheduleText: dayDesc,
        times,
        statusLabel: "加次",
        isRefund: false,
        isManual: true,
        addTime: log.CARD_LOG_ADD_TIME || 0,
      };
    }
    if (action === UserCardLogModel.ACTION.MANUAL_DEDUCT) {
      return {
        id: log._id,
        meetTitle: log.CARD_LOG_MEET_TITLE || "手动消次",
        meetTypeName: memo || "手动调整",
        coachName,
        deductText: `-${times}次`,
        dayDesc,
        timeRange: "",
        scheduleText: dayDesc,
        times,
        statusLabel: "消次",
        isRefund: false,
        isManual: true,
        addTime: log.CARD_LOG_ADD_TIME || 0,
      };
    }

    let deductText = times > 0 ? `消卡${times}次` : "期限内";
    return {
      id: log._id,
      meetTitle: log.CARD_LOG_MEET_TITLE || "课程",
      meetTypeName: log.CARD_LOG_MEET_TYPE_NAME || "精品课",
      coachName,
      deductText: `${coachName}/${deductText}`,
      dayDesc,
      timeRange: start && end ? `${start}-${end}` : "",
      scheduleText:
        dayDesc && start && end ? `${dayDesc} ${start}-${end}` : dayDesc,
      times,
      statusLabel: isRefund ? "已退还" : "扣卡成功",
      isRefund,
      addTime: log.CARD_LOG_ADD_TIME || 0,
    };
  }

  async _getCardTplVisual(tplId) {
    if (!tplId) return { color: "#F5A623", coverId: "" };
    let tpl = await CardTplModel.getOne(
      { CARD_TPL_ID: tplId },
      "CARD_TPL_COLOR,CARD_TPL_COVER",
    );
    return {
      color: (tpl && tpl.CARD_TPL_COLOR) || "#F5A623",
      coverId: cardCoverUtil.normalizeCover(tpl && tpl.CARD_TPL_COVER),
    };
  }

  async _loadTplVisualMaps(tplIds) {
    const colorMap = {};
    const coverMap = {};
    const typeMap = {};
    const daysMap = {};
    if (!tplIds.length) return { colorMap, coverMap, typeMap, daysMap };
    let tpls = await CardTplModel.getAll(
      { CARD_TPL_ID: ["in", tplIds] },
      "CARD_TPL_ID,CARD_TPL_TYPE,CARD_TPL_DAYS,CARD_TPL_COLOR,CARD_TPL_COVER",
      {},
      100,
    );
    for (let t of tpls || []) {
      colorMap[t.CARD_TPL_ID] = t.CARD_TPL_COLOR || "#F5A623";
      coverMap[t.CARD_TPL_ID] = cardCoverUtil.normalizeCover(t.CARD_TPL_COVER);
      typeMap[t.CARD_TPL_ID] = t.CARD_TPL_TYPE || CardTplModel.TYPE.TIMES;
      daysMap[t.CARD_TPL_ID] = Number(t.CARD_TPL_DAYS) || 0;
    }
    return { colorMap, coverMap, typeMap, daysMap };
  }

  /** 我的会员卡列表 */
  async getMyCardList(userId, { activeOnly = true } = {}) {
    if (!userId) this.AppError("请先登录");
    await this._ensureCardCollections();

    let list = await UserCardModel.getAll(
      { USER_CARD_USER_ID: userId },
      "*",
      { USER_CARD_ADD_TIME: "desc" },
      100,
    );

    const tplIds = [
      ...new Set((list || []).map((c) => c.USER_CARD_TPL_ID).filter(Boolean)),
    ];
    let colorMap = {};
    let coverMap = {};
    let typeMap = {};
    let daysMap = {};
    if (tplIds.length) {
      const maps = await this._loadTplVisualMaps(tplIds);
      colorMap = maps.colorMap;
      coverMap = maps.coverMap;
      typeMap = maps.typeMap;
      daysMap = maps.daysMap;
    }

    const now = timeUtil.time();
    const nameMap = await this._getCategoryNameMap();
    for (let c of list || []) {
      await this._selfHealCardEndTime(c, daysMap);
      await this._selfHealPeriodCardRecord(c, typeMap);
    }
    let mapped = (list || []).map((c) =>
      this._mapCardItem(
        c,
        now,
        colorMap[c.USER_CARD_TPL_ID],
        nameMap,
        coverMap[c.USER_CARD_TPL_ID],
        typeMap,
        daysMap,
      ),
    );
    if (activeOnly) {
      mapped = mapped.filter((c) => {
        if (c.status !== UserCardModel.STATUS.NORMAL) return false;
        if (c.isPending) return true;
        return c.isActive;
      });
    }
    return { list: mapped, total: mapped.length };
  }

  /** 会员卡详情 + 上课记录 */
  async getMyCardDetail(userId, cardId) {
    if (!userId) this.AppError("请先登录");
    if (!cardId) this.AppError("参数错误");
    await this._ensureCardCollections();

    let card = await UserCardModel.getOne({
      _id: cardId,
      USER_CARD_USER_ID: userId,
    });
    if (!card) this.AppError("会员卡不存在");

    const visual = await this._getCardTplVisual(card.USER_CARD_TPL_ID);
    let typeMap = {};
    let daysMap = {};
    if (card.USER_CARD_TPL_ID) {
      const tpl = await CardTplModel.getOne(
        { CARD_TPL_ID: card.USER_CARD_TPL_ID },
        "CARD_TPL_TYPE,CARD_TPL_DAYS",
      );
      typeMap[card.USER_CARD_TPL_ID] =
        (tpl && tpl.CARD_TPL_TYPE) || CardTplModel.TYPE.TIMES;
      daysMap[card.USER_CARD_TPL_ID] = Number(tpl && tpl.CARD_TPL_DAYS) || 0;
    }
    await this._selfHealCardEndTime(card, daysMap);
    await this._selfHealPeriodCardRecord(card, typeMap);
    card = await UserCardModel.getOne({ _id: cardId });
    const now = timeUtil.time();
    const nameMap = await this._getCategoryNameMap();
    const detail = this._mapCardItem(
      card,
      now,
      visual.color,
      nameMap,
      visual.coverId,
      typeMap,
      daysMap,
    );

    let logs = await UserCardLogModel.getAll(
      {
        CARD_LOG_USER_ID: userId,
        CARD_LOG_USER_CARD_ID: cardId,
        CARD_LOG_ACTION: [
          "in",
          [
            UserCardLogModel.ACTION.DEDUCT,
            UserCardLogModel.ACTION.MANUAL_ADD,
            UserCardLogModel.ACTION.MANUAL_DEDUCT,
          ],
        ],
      },
      "*",
      { CARD_LOG_ADD_TIME: "desc" },
      100,
    );

    const usageList = (logs || []).map((log) => this._mapUsageLog(log));
    return {
      card: detail,
      usageList,
      usageTotal: usageList.length,
    };
  }

  /** 是否有可用次数/期限卡 */
  async getMyCardSummary(userId) {
    const { list } = await this.getMyCardList(userId, { activeOnly: true });
    let timesTotal = 0;
    let hasPeriod = false;
    for (let c of list) {
      if (c.type === CardTplModel.TYPE.PERIOD) hasPeriod = true;
      else timesTotal += c.quota;
    }
    return {
      hasCard: list.length > 0,
      canBook: hasPeriod || timesTotal > 0,
      timesTotal,
      hasPeriod,
      count: list.length,
    };
  }

  _getMeetCardTimes(meet) {
    const style = (meet && meet.MEET_STYLE_SET) || {};
    const times = Number(style.cardTimes);
    return times > 0 ? times : 1;
  }

  _resolveCardScopeSync(card, tplScopeMap) {
    if (card && card.USER_CARD_SCOPE) {
      return cardScopeUtil.normalizeScope(card.USER_CARD_SCOPE);
    }
    const tplId = card && card.USER_CARD_TPL_ID;
    if (tplId && tplScopeMap && tplScopeMap[tplId]) {
      return tplScopeMap[tplId];
    }
    return { mode: "all", categoryIds: [] };
  }

  async _loadTplScopeMap(tplIds) {
    if (!tplIds || !tplIds.length) return {};
    let tpls = await CardTplModel.getAll(
      { CARD_TPL_ID: ["in", tplIds] },
      "CARD_TPL_ID,CARD_TPL_SCOPE",
      {},
      tplIds.length,
    );
    const map = {};
    for (let t of tpls || []) {
      map[t.CARD_TPL_ID] = cardScopeUtil.normalizeScope(t.CARD_TPL_SCOPE);
    }
    return map;
  }

  _cardMatchesMeetScope(scope, meet) {
    return cardScopeUtil.cardMatchesMeet(scope, meet);
  }

  async _resolveCoachName(meet, timeMark) {
    if (!meet || !timeMark) return "";
    const style = meet.MEET_STYLE_SET || {};
    let day =
      timeMark.substr(1, 4) +
      "-" +
      timeMark.substr(5, 2) +
      "-" +
      timeMark.substr(7, 2);
    let timeNode = null;
    for (let k in meet.MEET_DAYS_SET || []) {
      let daySet = meet.MEET_DAYS_SET[k];
      if (daySet.day !== day) continue;
      for (let j in daySet.times || []) {
        if (daySet.times[j].mark === timeMark) {
          timeNode = daySet.times[j];
          break;
        }
      }
    }
    if (timeNode && timeNode.teacherName) return timeNode.teacherName;
    if (style.teacherName) return style.teacherName;
    if (meet.MEET_ADMIN_ID) {
      let admin = await AdminModel.getOne({ _id: meet.MEET_ADMIN_ID }, "ADMIN_NAME");
      if (admin && admin.ADMIN_NAME) return admin.ADMIN_NAME;
    }
    let teacherId = (timeNode && timeNode.teacherId) || style.teacherId || "";
    if (teacherId) {
      let teacher = await TeacherModel.getOne({ _id: teacherId }, "TEACHER_NAME");
      if (teacher && teacher.TEACHER_NAME) return teacher.TEACHER_NAME;
    }
    return "";
  }

  /** 预约可选会员卡列表 */
  async getJoinCardOptions(userId, meetId, timeMark = "", meetDay = "") {
    if (!userId) this.AppError("请先登录");

    let meet = await MeetModel.getOne(
      { _id: meetId },
      "MEET_STYLE_SET,MEET_TYPE_ID,MEET_TYPE_NAME",
    );
    if (!meet) this.AppError("课程不存在");

    const needTimes = this._getMeetCardTimes(meet);
    const resolvedMeetDay =
      this._meetDayFromTimeMark(timeMark) || (meetDay || "").trim();
    const list = await this._listUsableCards(
      userId,
      needTimes,
      meet,
      resolvedMeetDay,
    );
    if (!list.length) {
      this.AppError(
        resolvedMeetDay
          ? "暂无覆盖该上课日的会员卡，请换时段或联系馆方"
          : "暂无可用会员卡，请联系馆方发卡后再预约",
      );
    }
    return { needTimes, list, meetDay: resolvedMeetDay };
  }

  async _listUsableCards(userId, needTimes, meet, meetDay = "") {
    await this._ensureCardCollections();
    const now = timeUtil.time();
    let cards = await UserCardModel.getAll(
      {
        USER_CARD_USER_ID: userId,
        USER_CARD_STATUS: [
          "in",
          [UserCardModel.STATUS.NORMAL, UserCardModel.STATUS.USED],
        ],
      },
      "*",
      { USER_CARD_END_TIME: "desc", USER_CARD_ADD_TIME: "desc" },
      50,
    );

    const tplIds = [
      ...new Set((cards || []).map((c) => c.USER_CARD_TPL_ID).filter(Boolean)),
    ];
    let colorMap = {};
    let coverMap = {};
    let scopeMap = {};
    let typeMap = {};
    let daysMap = {};
    if (tplIds.length) {
      const maps = await this._loadTplVisualMaps(tplIds);
      colorMap = maps.colorMap;
      coverMap = maps.coverMap;
      typeMap = maps.typeMap;
      daysMap = maps.daysMap;
      let tpls = await CardTplModel.getAll(
        { CARD_TPL_ID: ["in", tplIds] },
        "CARD_TPL_ID,CARD_TPL_SCOPE",
        {},
        100,
      );
      for (let t of tpls || []) {
        scopeMap[t.CARD_TPL_ID] = cardScopeUtil.normalizeScope(t.CARD_TPL_SCOPE);
      }
    }

    let list = [];
    for (let k in cards || []) {
      let card = cards[k];
      await this._selfHealCardEndTime(card, daysMap);
      await this._selfHealPeriodCardRecord(card, typeMap);
      if (card.USER_CARD_STATUS !== UserCardModel.STATUS.NORMAL) continue;
      const pending = this._isPendingActivation(card);
      if (!pending && this._isExpired(card, now)) continue;
      if (!this._cardValidForMeetDay(card, meetDay, now, daysMap)) continue;

      const type = this._resolveCardType(card, typeMap);
      const quota = Number(card.USER_CARD_QUOTA) || 0;
      if (type === CardTplModel.TYPE.TIMES && quota < needTimes) continue;
      if (pending && !this._canUsePendingForJoin(card)) continue;
      const scope = this._resolveCardScopeSync(card, scopeMap);
      if (meet && !this._cardMatchesMeetScope(scope, meet)) continue;

      // debug: log included card types
      try {
        if (type === CardTplModel.TYPE.PERIOD) {
          console.log('[user_card_service] include PERIOD card', card._id, card.USER_CARD_NAME);
        } else {
          console.log('[user_card_service] include TIMES card', card._id, card.USER_CARD_NAME, 'quota', quota);
        }
      } catch (e) {
        // ignore logging errors
      }

      const afterQuota =
        type === CardTplModel.TYPE.PERIOD ? quota : Math.max(0, quota - needTimes);
      list.push({
        id: card._id,
        name: card.USER_CARD_NAME || "会员卡",
        type,
        typeLabel: CardTplModel.TYPE_DESC[type] || "次数卡",
        quota,
        needTimes: type === CardTplModel.TYPE.PERIOD ? 0 : needTimes,
        afterQuota,
        balanceText:
          type === CardTplModel.TYPE.PERIOD
            ? "期限内畅练"
            : `剩余 ${quota} 次`,
        deductHint:
          type === CardTplModel.TYPE.PERIOD
            ? "本课不扣次"
            : `本次扣 ${needTimes} 次，剩余 ${afterQuota} 次`,
        color: colorMap[card.USER_CARD_TPL_ID] || "#F5A623",
        coverId: coverMap[card.USER_CARD_TPL_ID] || "",
      });
    }
    return list;
  }

  async _resolveCardForJoin(userId, needTimes, cardId, meet, meetDay = "") {
    if (cardId) {
      return await this._getCardIfUsable(userId, cardId, needTimes, meet, meetDay);
    }
    return await this._pickCardForJoin(userId, needTimes, meet, meetDay);
  }

  async _getCardIfUsable(userId, cardId, needTimes, meet, meetDay = "") {
    await this._ensureCardCollections();
    let card = await UserCardModel.getOne({
      _id: cardId,
      USER_CARD_USER_ID: userId,
      USER_CARD_STATUS: UserCardModel.STATUS.NORMAL,
    });
    if (!card) this.AppError("会员卡不可用");

    const now = timeUtil.time();
    if (!this._isPendingActivation(card) && this._isExpired(card, now)) {
      this.AppError("会员卡已过期");
    }

    let scopeMap = {};
    let typeMap = {};
    let daysMap = {};
    if (card.USER_CARD_TPL_ID) {
      const maps = await this._loadTplVisualMaps([card.USER_CARD_TPL_ID]);
      typeMap = maps.typeMap;
      daysMap = maps.daysMap;
      if (!card.USER_CARD_SCOPE) {
        scopeMap = await this._loadTplScopeMap([card.USER_CARD_TPL_ID]);
      }
    }

    // Ensure end time and period status are healed for single-card checks
    await this._selfHealCardEndTime(card, daysMap);
    await this._selfHealPeriodCardRecord(card, typeMap);

    if (!this._cardValidForMeetDay(card, meetDay, now, daysMap)) {
      this.AppError("该会员卡有效期不覆盖所选上课日");
    }
    const scope = this._resolveCardScopeSync(card, scopeMap);
    if (meet && !this._cardMatchesMeetScope(scope, meet)) {
      this.AppError("该会员卡不适用于本课程分类");
    }

    const type = this._resolveCardType(card, typeMap);
    if (type === CardTplModel.TYPE.PERIOD) return card;

    if (Number(card.USER_CARD_QUOTA) >= needTimes) return card;

    this.AppError("该会员卡剩余次数不足");
  }

  /** 预约前校验会员卡 */
  async checkCardForJoin(userId, meetId, cardId, timeMark = "") {
    if (!userId) this.AppError("请先登录");

    let meet = await MeetModel.getOne(
      { _id: meetId },
      "MEET_STYLE_SET,MEET_TYPE_ID,MEET_TYPE_NAME",
    );
    if (!meet) this.AppError("课程不存在");

    const needTimes = this._getMeetCardTimes(meet);
    const meetDay = this._meetDayFromTimeMark(timeMark);
    const card = await this._resolveCardForJoin(
      userId,
      needTimes,
      cardId,
      meet,
      meetDay,
    );
    if (!card) {
      this.AppError("暂无可用会员卡，请联系馆方发卡后再预约");
    }
    return { cardId: card._id, needTimes, cardName: card.USER_CARD_NAME };
  }

  async _pickCardForJoin(userId, needTimes, meet, meetDay = "") {
    const now = timeUtil.time();
    let list = await UserCardModel.getAll(
      {
        USER_CARD_USER_ID: userId,
        USER_CARD_STATUS: [
          "in",
          [UserCardModel.STATUS.NORMAL, UserCardModel.STATUS.USED],
        ],
      },
      "*",
      { USER_CARD_END_TIME: "desc", USER_CARD_ADD_TIME: "desc" },
      50,
    );

    const tplIds = [
      ...new Set((list || []).map((c) => c.USER_CARD_TPL_ID).filter(Boolean)),
    ];
    const scopeMap = tplIds.length ? await this._loadTplScopeMap(tplIds) : {};
    const tplMaps = tplIds.length ? await this._loadTplVisualMaps(tplIds) : {};
    const typeMap = tplMaps.typeMap || {};
    const daysMap = tplMaps.daysMap || {};

    for (let k in list) {
      let card = list[k];
      await this._selfHealCardEndTime(card, daysMap);
      await this._selfHealPeriodCardRecord(card, typeMap);
      if (card.USER_CARD_STATUS !== UserCardModel.STATUS.NORMAL) continue;
      const pending = this._isPendingActivation(card);
      if (!pending && this._isExpired(card, now)) continue;
      if (!this._cardValidForMeetDay(card, meetDay, now, daysMap)) continue;
      if (pending && !this._canUsePendingForJoin(card)) continue;
      const scope = this._resolveCardScopeSync(card, scopeMap);
      if (meet && !this._cardMatchesMeetScope(scope, meet)) continue;

      const type = this._resolveCardType(card, typeMap);
      if (type === CardTplModel.TYPE.PERIOD) {
        return card;
      }
      if (
        type === CardTplModel.TYPE.TIMES &&
        Number(card.USER_CARD_QUOTA) >= needTimes
      ) {
        return card;
      }
    }
    return null;
  }

  async _insertDeductLog({
    userId,
    cardId,
    joinId,
    meet,
    join,
    needTimes,
    coachName,
  }) {
    await this._ensureCardCollections();
    const now = timeUtil.time();
    await UserCardLogModel.insert({
      CARD_LOG_USER_ID: userId,
      CARD_LOG_USER_CARD_ID: cardId,
      CARD_LOG_JOIN_ID: joinId,
      CARD_LOG_MEET_ID: meet._id || join.JOIN_MEET_ID,
      CARD_LOG_MEET_TITLE: join.JOIN_MEET_TITLE || meet.MEET_TITLE || "",
      CARD_LOG_MEET_TYPE_NAME: meet.MEET_TYPE_NAME || "",
      CARD_LOG_MEET_DAY: join.JOIN_MEET_DAY || "",
      CARD_LOG_TIME_START: join.JOIN_MEET_TIME_START || "",
      CARD_LOG_TIME_END: join.JOIN_MEET_TIME_END || "",
      CARD_LOG_COACH_NAME: coachName || "",
      CARD_LOG_TIMES: needTimes,
      CARD_LOG_ACTION: UserCardLogModel.ACTION.DEDUCT,
      CARD_LOG_STATUS: UserCardLogModel.STATUS.VALID,
      CARD_LOG_ADD_TIME: now,
      CARD_LOG_EDIT_TIME: now,
    });
  }

  /** 预约成功后扣次 */
  async consumeForJoin(userId, meetId, joinId, cardId) {
    await this._ensureCardCollections();
    let meet = await MeetModel.getOne(
      { _id: meetId },
      "MEET_TITLE,MEET_TYPE_NAME,MEET_TYPE_ID,MEET_STYLE_SET,MEET_DAYS_SET,MEET_ADMIN_ID",
    );
    if (!meet) return;

    let join = await JoinModel.getOne({ _id: joinId });
    if (!join) return;

    const needTimes = this._getMeetCardTimes(meet);
    const meetDay = join.JOIN_MEET_DAY || "";
    let card = await this._resolveCardForJoin(
      userId,
      needTimes,
      cardId,
      meet,
      meetDay,
    );
    if (!card) {
      if (cardId) this.AppError("会员卡划扣失败，请联系馆方");
      return;
    }

    const tplDaysMap = card.USER_CARD_TPL_ID
      ? (await this._loadTplVisualMaps([card.USER_CARD_TPL_ID])).daysMap
      : {};
    await this._tryActivateCard(card, "book", tplDaysMap);
    card = await UserCardModel.getOne({ _id: card._id });
    if (!card) return;

    const coachName = await this._resolveCoachName(meet, join.JOIN_MEET_TIME_MARK);
    let typeMap = {};
    if (card.USER_CARD_TPL_ID) {
      typeMap = (await this._loadTplVisualMaps([card.USER_CARD_TPL_ID])).typeMap;
    }
    const type = this._resolveCardType(card, typeMap);

    if (type === CardTplModel.TYPE.PERIOD) {
      await this._insertDeductLog({
        userId,
        cardId: card._id,
        joinId,
        meet,
        join,
        needTimes: 0,
        coachName,
      });
      return { cardId: card._id, deducted: 0 };
    }

    const left = Number(card.USER_CARD_QUOTA) || 0;
    const next = Math.max(0, left - needTimes);
    const patch = {
      USER_CARD_QUOTA: next,
      USER_CARD_EDIT_TIME: timeUtil.time(),
    };
    if (next <= 0) {
      patch.USER_CARD_STATUS = UserCardModel.STATUS.USED;
    }
    await UserCardModel.edit({ _id: card._id }, patch);

    await this._insertDeductLog({
      userId,
      cardId: card._id,
      joinId,
      meet,
      join,
      needTimes,
      coachName,
    });

    return { cardId: card._id, deducted: needTimes, joinId };
  }

  /** 取消预约退还次数 */
  async refundForJoinCancel(joinId) {
    if (!joinId) return { refunded: 0 };
    await this._ensureCardCollections();

    let log = await UserCardLogModel.getOne({
      CARD_LOG_JOIN_ID: joinId,
      CARD_LOG_ACTION: UserCardLogModel.ACTION.DEDUCT,
      CARD_LOG_STATUS: UserCardLogModel.STATUS.VALID,
    });
    if (!log) return { refunded: 0 };

    const times = Number(log.CARD_LOG_TIMES) || 0;
    const cardId = log.CARD_LOG_USER_CARD_ID;
    const now = timeUtil.time();

    if (times > 0 && cardId) {
      let card = await UserCardModel.getOne({ _id: cardId });
      if (card) {
        const next = (Number(card.USER_CARD_QUOTA) || 0) + times;
        const patch = {
          USER_CARD_QUOTA: next,
          USER_CARD_EDIT_TIME: now,
        };
        if (card.USER_CARD_STATUS === UserCardModel.STATUS.USED && next > 0) {
          patch.USER_CARD_STATUS = UserCardModel.STATUS.NORMAL;
        }
        await UserCardModel.edit({ _id: cardId }, patch);
      }
    }

    await UserCardLogModel.edit(
      { _id: log._id },
      {
        CARD_LOG_STATUS: UserCardLogModel.STATUS.REFUNDED,
        CARD_LOG_EDIT_TIME: now,
      },
    );

    return { refunded: times, cardId };
  }

  /** 教练端：会员持卡详情（含流水） */
  async getCoachUserCardDetail(cardId) {
    if (!cardId) this.AppError("参数错误");
    await this._ensureCardCollections();

    let card = await UserCardModel.getOne({ _id: cardId });
    if (!card) this.AppError("会员卡不存在");

    const visual = await this._getCardTplVisual(card.USER_CARD_TPL_ID);
    let typeMap = {};
    let daysMap = {};
    if (card.USER_CARD_TPL_ID) {
      const tpl = await CardTplModel.getOne(
        { CARD_TPL_ID: card.USER_CARD_TPL_ID },
        "CARD_TPL_TYPE,CARD_TPL_DAYS",
      );
      typeMap[card.USER_CARD_TPL_ID] =
        (tpl && tpl.CARD_TPL_TYPE) || CardTplModel.TYPE.TIMES;
      daysMap[card.USER_CARD_TPL_ID] = Number(tpl && tpl.CARD_TPL_DAYS) || 0;
    }
    const type = this._resolveCardType(card, typeMap);
    await this._selfHealCardEndTime(card, daysMap);
    await this._selfHealPeriodCardRecord(card, typeMap);
    card = await UserCardModel.getOne({ _id: cardId });
    const now = timeUtil.time();
    const nameMap = await this._getCategoryNameMap();
    const detail = this._mapCardItem(
      card,
      now,
      visual.color,
      nameMap,
      visual.coverId,
      typeMap,
      daysMap,
    );

    let logs = await UserCardLogModel.getAll(
      {
        CARD_LOG_USER_CARD_ID: cardId,
        CARD_LOG_ACTION: [
          "in",
          [
            UserCardLogModel.ACTION.DEDUCT,
            UserCardLogModel.ACTION.MANUAL_ADD,
            UserCardLogModel.ACTION.MANUAL_DEDUCT,
          ],
        ],
      },
      "*",
      { CARD_LOG_ADD_TIME: "desc" },
      100,
    );

    return {
      card: detail,
      usageList: (logs || []).map((log) => this._mapUsageLog(log)),
      usageTotal: (logs || []).length,
    };
  }

  /** 教练端：手动加次/消次/停卡/恢复 */
  async adjustCardManual(input) {
    await this._ensureCardCollections();
    const cardId = (input.cardId || "").trim();
    const action = (input.action || "").trim();
    const memo = (input.memo || "").trim();
    const operatorName = (input.operatorName || "").trim();

    if (!cardId) this.AppError("请选择会员卡");
    if (!memo) this.AppError("请填写备注");

    let card = await UserCardModel.getOne({ _id: cardId });
    if (!card) this.AppError("会员卡不存在");

    const now = timeUtil.time();
    const day = timeUtil.time("Y-M-D");

    if (action === "stop") {
      await UserCardModel.edit(
        { _id: cardId },
        { USER_CARD_STATUS: UserCardModel.STATUS.STOP, USER_CARD_EDIT_TIME: now },
      );
      return { cardId, action: "stop" };
    }

    if (action === "resume") {
      const quota = Number(card.USER_CARD_QUOTA) || 0;
      let status = UserCardModel.STATUS.NORMAL;
      if (
        card.USER_CARD_TYPE === CardTplModel.TYPE.TIMES &&
        quota <= 0 &&
        !this._isPendingActivation(card)
      ) {
        status = UserCardModel.STATUS.USED;
      }
      await UserCardModel.edit(
        { _id: cardId },
        { USER_CARD_STATUS: status, USER_CARD_EDIT_TIME: now },
      );
      return { cardId, action: "resume" };
    }

    if (card.USER_CARD_TYPE === CardTplModel.TYPE.PERIOD) {
      this.AppError("期限卡请使用停卡/恢复操作");
    }

    const times = Number(input.times) || 0;
    if (times <= 0) this.AppError("请输入有效次数");

    if (action === "add") {
      const next = (Number(card.USER_CARD_QUOTA) || 0) + times;
      const patch = {
        USER_CARD_QUOTA: next,
        USER_CARD_EDIT_TIME: now,
      };
      if (card.USER_CARD_STATUS === UserCardModel.STATUS.USED && next > 0) {
        patch.USER_CARD_STATUS = UserCardModel.STATUS.NORMAL;
      }
      await UserCardModel.edit({ _id: cardId }, patch);
      await UserCardLogModel.insert({
        CARD_LOG_USER_ID: card.USER_CARD_USER_ID,
        CARD_LOG_USER_CARD_ID: cardId,
        CARD_LOG_MEET_TITLE: "手动加次",
        CARD_LOG_MEET_TYPE_NAME: "手动调整",
        CARD_LOG_MEET_DAY: day,
        CARD_LOG_TIMES: times,
        CARD_LOG_ACTION: UserCardLogModel.ACTION.MANUAL_ADD,
        CARD_LOG_STATUS: UserCardLogModel.STATUS.VALID,
        CARD_LOG_MEMO: memo.slice(0, 50),
        CARD_LOG_OPERATOR_NAME: operatorName,
        CARD_LOG_ADD_TIME: now,
        CARD_LOG_EDIT_TIME: now,
      });
      return { cardId, action: "add", times, quota: next };
    }

    if (action === "deduct") {
      const left = Number(card.USER_CARD_QUOTA) || 0;
      if (times > left) this.AppError("剩余次数不足");
      const next = left - times;
      const patch = {
        USER_CARD_QUOTA: next,
        USER_CARD_EDIT_TIME: now,
      };
      if (next <= 0) patch.USER_CARD_STATUS = UserCardModel.STATUS.USED;
      await UserCardModel.edit({ _id: cardId }, patch);
      await UserCardLogModel.insert({
        CARD_LOG_USER_ID: card.USER_CARD_USER_ID,
        CARD_LOG_USER_CARD_ID: cardId,
        CARD_LOG_MEET_TITLE: "手动消次",
        CARD_LOG_MEET_TYPE_NAME: "手动调整",
        CARD_LOG_MEET_DAY: day,
        CARD_LOG_TIMES: times,
        CARD_LOG_ACTION: UserCardLogModel.ACTION.MANUAL_DEDUCT,
        CARD_LOG_STATUS: UserCardLogModel.STATUS.VALID,
        CARD_LOG_MEMO: memo.slice(0, 50),
        CARD_LOG_OPERATOR_NAME: operatorName,
        CARD_LOG_ADD_TIME: now,
        CARD_LOG_EDIT_TIME: now,
      });
      return { cardId, action: "deduct", times, quota: next };
    }

    this.AppError("不支持的操作");
  }
}

module.exports = UserCardService;
