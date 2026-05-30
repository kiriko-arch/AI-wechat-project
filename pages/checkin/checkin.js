const { checkAndResetDailyTasks } = require('../../utils/dailyReset');

function getTodayStr() {
  const now = new Date();
  return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
}

function getWeekday() {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return '星期' + days[new Date().getDay()];
}

function getMotivationalMsg(ratio) {
  if (ratio === 0) return '新的一天，从第一个任务开始吧';
  if (ratio < 0.3) return '好的开始是成功的一半，继续加油';
  if (ratio < 0.6) return '进度过半，保持节奏';
  if (ratio < 1) return '胜利在望，再坚持一下';
  return '太棒了，今天全勤打卡';
}

Page({
  data: {
    plans: [],
    currentPlanIndex: 0,
    tasksArray: [],
    currentCompletedCount: 0,
    totalCount: 0,

    todayDate: getTodayStr(),
    weekday: getWeekday(),
    motivationalMsg: '',
    progressPercent: 0,

    isAddingTask: false,
    newTaskText: '',

    isShowingTips: false,
    currentFullPlan: null,

    // 滑动删除状态
    swipedTaskId: '',
    swipeStartX: 0
  },

  onLoad: function () {
    this.setData({
      todayDate: getTodayStr(),
      weekday: getWeekday()
    });
    this.loadTasks();
  },

  onShow: function () {
    const isReset = checkAndResetDailyTasks();
    if (isReset) {
      wx.showToast({ title: '新的一天，任务已重置', icon: 'none' });
    }
    this.setData({
      todayDate: getTodayStr(),
      weekday: getWeekday()
    });
    this.loadTasks();
  },

  loadTasks: function () {
    let checkinPlans = wx.getStorageSync('checkinPlans') || [];

    // 兼容旧版本数据迁移
    const oldCheckinTasks = wx.getStorageSync('checkinTasks');
    if (oldCheckinTasks && Object.keys(oldCheckinTasks).length > 0 && checkinPlans.length === 0) {
      checkinPlans.push({
        id: 'plan_legacy',
        goal: '默认学习计划',
        tasksObj: oldCheckinTasks
      });
      wx.setStorageSync('checkinPlans', checkinPlans);
      wx.removeStorageSync('checkinTasks');
    }

    if (checkinPlans.length > 0) {
      let index = this.data.currentPlanIndex;
      if (index >= checkinPlans.length) index = 0;
      this.setData({ plans: checkinPlans, currentPlanIndex: index });
      this.renderCurrentPlanTasks();
    } else {
      this.setData({
        plans: [],
        tasksArray: [],
        currentCompletedCount: 0,
        totalCount: 0,
        progressPercent: 0,
        motivationalMsg: ''
      });
    }
  },

  onPlanPickerChange: function (e) {
    const index = parseInt(e.detail.value, 10);
    this.setData({
      currentPlanIndex: index,
      swipedTaskId: ''
    });
    this.renderCurrentPlanTasks();
  },

  renderCurrentPlanTasks: function () {
    const plans = this.data.plans;
    const currentPlan = plans[this.data.currentPlanIndex];
    if (!currentPlan) return;

    const tasksObj = currentPlan.tasksObj || {};
    const tasksArray = [];
    for (const key in tasksObj) {
      tasksArray.push({
        id: key,
        text: tasksObj[key].text,
        done: tasksObj[key].done || false,
        translateX: 0
      });
    }

    this.setData({ tasksArray, swipedTaskId: '' });
    this.calculateProgress();
  },

  deleteCurrentPlan: function () {
    const that = this;
    const currentPlan = this.data.plans[this.data.currentPlanIndex];

    wx.showModal({
      title: '删除计划',
      content: `确定要删除计划【${currentPlan.goal}】吗？该计划下的打卡任务将一并清除。`,
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...', mask: true });

          wx.cloud.callFunction({
            name: 'syncPlan',
            data: { action: 'delete', planId: currentPlan.id }
          }).then(cloudRes => {
            wx.hideLoading();
            if (cloudRes.result && cloudRes.result.success) {
              let checkinPlans = wx.getStorageSync('checkinPlans') || [];
              checkinPlans.splice(that.data.currentPlanIndex, 1);
              wx.setStorageSync('checkinPlans', checkinPlans);

              let historyRecords = wx.getStorageSync('historyRecords') || [];
              historyRecords = historyRecords.filter(r => r.id !== currentPlan.id);
              wx.setStorageSync('historyRecords', historyRecords);

              that.setData({ currentPlanIndex: 0 });
              that.loadTasks();
              wx.showToast({ title: '已删除', icon: 'success' });
            } else {
              throw new Error('云端删除失败');
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('删除云端计划失败:', err);
            wx.showToast({ title: '删除失败，请重试', icon: 'none' });
          });
        }
      }
    });
  },

  goToIndex: function () {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // ================= 滑动删除手势 =================

  onTaskTouchStart: function (e) {
    const taskId = e.currentTarget.dataset.id;
    // 先复位其他已滑出的任务
    if (this.data.swipedTaskId && this.data.swipedTaskId !== taskId) {
      this.resetSwipe();
    }
    this.setData({
      swipeStartX: e.touches[0].clientX
    });
  },

  onTaskTouchMove: function (e) {
    const taskId = e.currentTarget.dataset.id;
    const moveX = e.touches[0].clientX;
    const deltaX = this.data.swipeStartX - moveX;

    if (deltaX > 10) {
      const translateX = Math.min(deltaX, 160);
      const tasksArray = this.data.tasksArray.map(t => {
        if (t.id === taskId) {
          return { ...t, translateX: -translateX };
        }
        return { ...t, translateX: 0 };
      });
      this.setData({ tasksArray });
    }
  },

  onTaskTouchEnd: function (e) {
    const taskId = e.currentTarget.dataset.id;
    const task = this.data.tasksArray.find(t => t.id === taskId);
    if (!task) return;

    if (task.translateX < -80) {
      // 滑到位，锁定删除按钮露出
      const tasksArray = this.data.tasksArray.map(t => {
        if (t.id === taskId) {
          return { ...t, translateX: -160 };
        }
        return { ...t, translateX: 0 };
      });
      this.setData({ tasksArray, swipedTaskId: taskId });
    } else {
      // 没滑到位，弹回去
      this.resetSwipe();
    }
  },

  resetSwipe: function () {
    const tasksArray = this.data.tasksArray.map(t => ({ ...t, translateX: 0 }));
    this.setData({ tasksArray, swipedTaskId: '' });
  },

  swipeDeleteTask: function (e) {
    const taskId = e.currentTarget.dataset.id;
    const that = this;

    wx.showModal({
      title: '删除任务',
      content: '确定要删除这个任务吗？',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          const plans = that.data.plans;
          const currentPlanIndex = that.data.currentPlanIndex;
          const tasksObj = plans[currentPlanIndex].tasksObj;
          delete tasksObj[taskId];

          plans[currentPlanIndex].tasksObj = tasksObj;
          wx.setStorageSync('checkinPlans', plans);
          that.setData({ plans, swipedTaskId: '' });
          that.renderCurrentPlanTasks();
          wx.showToast({ title: '已删除', icon: 'success' });
        } else {
          that.resetSwipe();
        }
      }
    });
  },

  // ================= 任务复选框 =================

  checkboxChange: function (e) {
    const checkedTaskIds = e.detail.value;
    const tasksArray = this.data.tasksArray;
    const plans = this.data.plans;
    const currentPlanIndex = this.data.currentPlanIndex;
    const tasksObj = plans[currentPlanIndex].tasksObj;

    for (const key in tasksObj) {
      tasksObj[key].done = checkedTaskIds.includes(key);
    }

    for (let i = 0; i < tasksArray.length; i++) {
      tasksArray[i].done = tasksObj[tasksArray[i].id].done;
    }

    this.setData({ tasksArray, plans });
    this.calculateProgress();

    wx.setStorageSync('checkinPlans', plans);
    this.syncCheckinToCloud(plans);

    // 同步历史记录
    const completedTexts = tasksArray.filter(t => t.done).map(t => t.text);
    let historyRecords = wx.getStorageSync('historyRecords') || [];
    const planId = plans[currentPlanIndex].id;
    const historyIndex = historyRecords.findIndex(r => r.id === planId);
    if (historyIndex > -1) {
      historyRecords[historyIndex].completedTasks = completedTexts;
      wx.setStorageSync('historyRecords', historyRecords);
    }
  },

  calculateProgress: function () {
    const tasksArray = this.data.tasksArray;
    const completedCount = tasksArray.filter(t => t.done).length;
    const totalCount = tasksArray.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const motivationalMsg = getMotivationalMsg(totalCount > 0 ? completedCount / totalCount : 0);

    this.setData({
      currentCompletedCount: completedCount,
      totalCount,
      progressPercent,
      motivationalMsg
    });

    // 坚持天数逻辑
    const plans = this.data.plans;
    let allTotal = 0;
    let allCompleted = 0;

    if (plans.length > 0) {
      plans.forEach(p => {
        const tObj = p.tasksObj || {};
        const keys = Object.keys(tObj);
        allTotal += keys.length;
        keys.forEach(k => { if (tObj[k].done) allCompleted++; });
      });

      if (allTotal > 0) {
        let studyDays = wx.getStorageSync('studyDays') || 0;
        let lastCheckinDate = wx.getStorageSync('lastCheckinDate') || '';
        let completedDates = wx.getStorageSync('completedDates') || [];

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
        let isStudyDaysChanged = false;

        if (allCompleted === allTotal) {
          if (lastCheckinDate !== todayStr) {
            studyDays += 1;
            wx.setStorageSync('studyDays', studyDays);
            wx.setStorageSync('lastCheckinDate', todayStr);
            isStudyDaysChanged = true;

            if (!completedDates.includes(todayStr)) {
              completedDates.push(todayStr);
              wx.setStorageSync('completedDates', completedDates);
            }
          }
        } else {
          if (lastCheckinDate === todayStr) {
            studyDays = Math.max(0, studyDays - 1);
            wx.setStorageSync('studyDays', studyDays);
            wx.setStorageSync('lastCheckinDate', '');
            isStudyDaysChanged = true;

            completedDates = completedDates.filter(d => d !== todayStr);
            wx.setStorageSync('completedDates', completedDates);
          }
        }

        if (isStudyDaysChanged) {
          wx.cloud.callFunction({
            name: 'syncPlan',
            data: {
              action: 'updateUserStats',
              stats: {
                studyDays,
                lastCheckinDate: wx.getStorageSync('lastCheckinDate') || '',
                completedDates
              }
            }
          }).catch(err => console.error('同步用户统计数据失败', err));
        }
      }
    }
  },

  syncCheckinToCloud: function (plans) {
    const currentPlan = plans[this.data.currentPlanIndex];
    if (!currentPlan || !currentPlan.id || currentPlan.id === 'plan_legacy') return;

    wx.cloud.callFunction({
      name: 'syncPlan',
      data: {
        action: 'updateTasks',
        planId: currentPlan.id,
        tasksObj: currentPlan.tasksObj
      }
    }).catch(err => {
      console.error('后台同步打卡状态失败:', err);
    });
  },

  // ================= 学习锦囊 =================

  showTipsModal: function () {
    const plans = this.data.plans;
    if (plans.length === 0) return;
    const currentPlan = plans[this.data.currentPlanIndex];
    this.setData({
      isShowingTips: true,
      currentFullPlan: currentPlan.fullPlan || null
    });
  },

  closeTipsModal: function () {
    this.setData({ isShowingTips: false });
  },

  stopBubble: function () { },

  copyLink: function (e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.setClipboardData({
      data: url,
      success: () => wx.showToast({ title: '链接已复制', icon: 'success' })
    });
  },

  // ================= 添加任务 =================

  showAddTaskModal: function () {
    this.setData({ isAddingTask: true, newTaskText: '' });
  },

  cancelAddTask: function () {
    this.setData({ isAddingTask: false });
  },

  onNewTaskInput: function (e) {
    this.setData({ newTaskText: e.detail.value });
  },

  confirmAddTask: function () {
    const text = this.data.newTaskText.trim();
    if (!text) {
      wx.showToast({ title: '任务内容不能为空', icon: 'none' });
      return;
    }

    const plans = this.data.plans;
    const currentPlanIndex = this.data.currentPlanIndex;
    if (plans.length === 0) return;

    const tasksObj = plans[currentPlanIndex].tasksObj || {};
    const newTaskId = 'task_' + Date.now();
    tasksObj[newTaskId] = { text, done: false };
    plans[currentPlanIndex].tasksObj = tasksObj;
    wx.setStorageSync('checkinPlans', plans);

    this.setData({ isAddingTask: false, plans });
    this.renderCurrentPlanTasks();
    wx.showToast({ title: '添加成功', icon: 'success' });
  }
});
