// [AI_START TIMESTAMP=2025-01-25 12:30:00]
/**
 * Notes: 租户定制页面注册表
 * Description: 记录每个租户(PID)定制了哪些页面
 *              只有在此注册的页面才会走定制路径，其余走默认路径(projects/A00/)
 *
 * 使用方法：
 *   新增定制页面时：
 *   1. 在 projects/PID/ 下创建页面文件
 *   2. 在 app.json 注册页面路径
 *   3. 在此处添加页面路径到对应PID的数组中
 *
 * 示例：
 *   A01: [
 *     'default/index/default_index',  // 馆B定制了首页
 *     'meet/detail/meet_detail',      // 馆B定制了课程详情页
 *   ],
 */

module.exports = {
  // A00: 默认馆，使用标准模板（无需注册，自动走 projects/A00/）
  // 如需为A00定制特定页面，取消下方注释：
  // A00: [
  //   'default/index/default_index',
  // ],
  // 新增租户在此注册其定制页面（仅列出有差异的页面）：
  // A01: [
  //   'default/index/default_index',  // 馆B定制首页
  // ],
  // A02: [
  //   'meet/detail/meet_detail',      // 馆C定制课程详情页
  // ],
};
// [AI_END LINES=33 TIMESTAMP=2025-01-25 12:30:00]
