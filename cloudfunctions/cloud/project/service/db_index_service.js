const cloudBase = require("../../framework/cloud/cloud_base.js");

const INDEXES = [
  ["ax_join", "_pid"], ["ax_join", "JOIN_USER_ID"],
  ["ax_join", "JOIN_STATUS"], ["ax_join", "JOIN_MEET_ID"],
  ["ax_join", "JOIN_MEET_TIME_MARK"], ["ax_join", "JOIN_MEET_DAY"],
  ["ax_user_card", "_pid"], ["ax_user_card", "USER_CARD_USER_ID"],
  ["ax_user_card", "USER_CARD_STATUS"], ["ax_user_card_log", "_pid"],
  ["ax_user_card_log", "CARD_LOG_USER_CARD_ID"],
  ["ax_user_card_log", "CARD_LOG_JOIN_ID"], ["ax_day", "_pid"],
  ["ax_day", "DAY_MEET_ID"], ["ax_day", "day"],
];

class DbIndexService {
  async ensureIndexes() {
    const db = cloudBase.getCloud().database();
    const result = { created: [], skipped: [], unsupported: [], failed: [] };
    for (const [collectionName, fieldName] of INDEXES) {
      const collection = db.collection(collectionName);
      try {
        if (typeof collection.createIndex !== "function") {
          result.unsupported.push({ collection: collectionName, field: fieldName });
          continue;
        }
        let existing = [];
        if (typeof collection.getIndexes === "function") {
          const indexes = await collection.getIndexes();
          existing = (indexes && (indexes.indexes || indexes.data)) || indexes || [];
        }
        const exists = existing.some((item) => {
          const key = item.key || item.fields || item.fieldName;
          return key === fieldName || (key && key[fieldName]);
        });
        if (exists) {
          result.skipped.push({ collection: collectionName, field: fieldName });
          continue;
        }
        await collection.createIndex({ fieldName, order: "asc" });
        result.created.push({ collection: collectionName, field: fieldName });
      } catch (error) {
        result.failed.push({ collection: collectionName, field: fieldName, message: error.message });
      }
    }
    return result;
  }
}

DbIndexService.INDEXES = INDEXES;
module.exports = DbIndexService;
