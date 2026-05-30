/**
 * 获取当前时间的“逻辑日期”
 * 规则：每天凌晨 2:00 作为新的一天的分界线
 * 比如：
 * 2023-10-10 01:00 -> 逻辑日期是 2023-10-09
 * 2023-10-10 03:00 -> 逻辑日期是 2023-10-10
 */
function getLogicalDate() {
  const now = new Date();
  // 减去2小时
  const logicalTime = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const year = logicalTime.getFullYear();
  const month = String(logicalTime.getMonth() + 1).padStart(2, '0');
  const day = String(logicalTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 检查并执行懒加载重置任务
 * @returns {boolean} 是否发生了重置
 */
function checkAndResetDailyTasks() {
  const currentLogicalDate = getLogicalDate();
  const lastResetDate = wx.getStorageSync('lastResetDate');

  if (!lastResetDate) {
    // 第一次使用，初始化记录
    wx.setStorageSync('lastResetDate', currentLogicalDate);
    return false;
  }

  if (currentLogicalDate !== lastResetDate) {
    console.log('检测到跨越逻辑日期凌晨2点，执行本地任务重置...');
    
    // 1. 重置本地打卡计划
    let checkinPlans = wx.getStorageSync('checkinPlans') || [];
    let needsReset = false;
    
    checkinPlans.forEach(plan => {
      if (plan.tasksObj) {
        for (let key in plan.tasksObj) {
          if (plan.tasksObj[key].done) {
            plan.tasksObj[key].done = false;
            needsReset = true;
          }
        }
      }
    });

    if (needsReset) {
      wx.setStorageSync('checkinPlans', checkinPlans);
      
      // 2. 异步通知云端也重置，保证多端数据一致性 (懒重置机制)
      wx.cloud.callFunction({
        name: 'syncPlan',
        data: { action: 'resetAllTasks' }
      }).catch(err => console.error('云端重置任务失败', err));
    }

    // 3. 更新最后的重置日期
    wx.setStorageSync('lastResetDate', currentLogicalDate);
    return needsReset; // 如果发生了实质性的重置（有已完成变成未完成）返回 true
  }
  
  return false;
}

module.exports = {
  checkAndResetDailyTasks
};
