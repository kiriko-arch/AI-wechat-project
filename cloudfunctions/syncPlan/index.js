// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // 接收前端传来的 action 和参数
  const { action, planData, planId, tasksObj, stats } = event;

  try {
    if (action === 'add') {
      // 1. 新增学习计划
      const newPlan = {
        ...planData,
        _openid: openid,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      };
      const res = await db.collection('plans').add({ data: newPlan });
      return { success: true, planId: res._id };

    } else if (action === 'delete') {
      // 2. 删除学习计划
      if (!planId) throw new Error('缺少 planId');
      await db.collection('plans').where({ _id: planId, _openid: openid }).remove();
      return { success: true };

    } else if (action === 'updateTasks') {
      // 3. 专门用于更新打卡状态 (仅更新 tasksObj 字段)
      if (!planId || !tasksObj) throw new Error('缺少参数');
      await db.collection('plans').where({ _id: planId, _openid: openid }).update({
        data: {
          tasksObj: tasksObj,
          updatedAt: db.serverDate()
        }
      });
      return { success: true };

    } else if (action === 'updateUserStats') {
      // 4. 更新用户的统计档案 (天数、日历)
      if (!stats) throw new Error('缺少 stats 参数');
      await db.collection('users').where({ _openid: openid }).update({
        data: {
          studyDays: stats.studyDays,
          lastCheckinDate: stats.lastCheckinDate,
          completedDates: stats.completedDates,
          updatedAt: db.serverDate()
        }
      });
      return { success: true };

    } else if (action === 'resetAllTasks') {
      // 5. 跨越凌晨两点，批量重置该用户所有计划中的任务为未完成状态
      const res = await db.collection('plans').where({ _openid: openid }).get();
      
      const updatePromises = res.data.map(plan => {
        let updatedTasks = plan.tasksObj || {};
        let hasChange = false;
        
        for(let key in updatedTasks) {
          if (updatedTasks[key].done) {
            updatedTasks[key].done = false;
            hasChange = true;
          }
        }
        
        // 只有确实存在已完成任务时，才执行数据库更新，节省资源
        if (hasChange) {
          return db.collection('plans').doc(plan._id).update({
            data: {
              tasksObj: updatedTasks,
              updatedAt: db.serverDate()
            }
          });
        }
        return Promise.resolve();
      });
      
      await Promise.all(updatePromises);
      return { success: true };

    } else {
      return { success: false, error: '未知的 action 类型' };
    }

  } catch (error) {
    console.error(`执行 ${action} 失败:`, error);
    return { success: false, error: error.message };
  }
}