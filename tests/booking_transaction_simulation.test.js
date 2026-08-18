const test = require("node:test");
const assert = require("node:assert/strict");

/**
 * 本地并发模型：模拟云数据库 runTransaction 的串行提交与失败回滚。
 * 用于验证预约、扣卡、扣卡流水必须同成同败。
 */
class MemoryBookingStore {
  constructor({ limit = 1, quota = 1 } = {}) {
    this.state = { limit, quota, joins: [], logs: [] };
    this.queue = Promise.resolve();
  }

  runTransaction(work) {
    const execute = this.queue.then(async () => {
      const snapshot = structuredClone(this.state);
      try {
        const result = await work(this.state);
        return result;
      } catch (error) {
        this.state = snapshot;
        throw error;
      }
    });
    this.queue = execute.catch(() => undefined);
    return execute;
  }

  async joinAndConsume(userId, { failAfterCardUpdate = false } = {}) {
    return this.runTransaction(async (state) => {
      if (state.joins.some((join) => join.userId === userId)) {
        throw new Error("duplicate");
      }
      if (state.joins.length >= state.limit) throw new Error("full");
      if (state.quota < 1) throw new Error("insufficient");

      state.quota -= 1;
      if (failAfterCardUpdate) throw new Error("simulated write failure");
      const join = { userId, id: `join-${state.joins.length + 1}` };
      state.joins.push(join);
      state.logs.push({ userId, joinId: join.id, action: "deduct" });
      return join.id;
    });
  }
}

test("two concurrent users with one slot: exactly one succeeds", async () => {
  const store = new MemoryBookingStore({ limit: 1, quota: 2 });
  const results = await Promise.allSettled([
    store.joinAndConsume("user-a"),
    store.joinAndConsume("user-b"),
  ]);

  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected").length, 1);
  assert.equal(store.state.joins.length, 1);
  assert.equal(store.state.logs.length, 1);
  assert.equal(store.state.quota, 1);
});

test("card deduction failure rolls back the reservation and card quota", async () => {
  const store = new MemoryBookingStore({ limit: 1, quota: 1 });
  await assert.rejects(store.joinAndConsume("user-a", { failAfterCardUpdate: true }), /simulated/);
  assert.deepEqual(store.state, { limit: 1, quota: 1, joins: [], logs: [] });
});

test("duplicate reservation does not create a second deduction log", async () => {
  const store = new MemoryBookingStore({ limit: 2, quota: 2 });
  await store.joinAndConsume("user-a");
  await assert.rejects(store.joinAndConsume("user-a"), /duplicate/);
  assert.equal(store.state.joins.length, 1);
  assert.equal(store.state.logs.length, 1);
  assert.equal(store.state.quota, 1);
});
