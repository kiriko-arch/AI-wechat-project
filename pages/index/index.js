function buildFallbackBilibiliResources(goal) {
  const keyword = encodeURIComponent(goal);

  return [
    {
      type: 'video',
      title: `B站搜索：${goal}`,
      author: '系统兜底推荐',
      url: `https://search.bilibili.com/all?keyword=${keyword}`,
      reason: '如果云函数没有给出具体视频，这里给你提供相关的搜索链接，方便快速查找。'
    },
    {
      type: 'creator',
      title: `B站UP主搜索：${goal} 老师`,
      author: '系统兜底推荐',
      url: `https://search.bilibili.com/upuser?keyword=${keyword}%20%E8%80%81%E5%B8%88`,
      reason: '优先找持续输出该主题内容的博主，后续更适合长期跟学。'
    }
  ];
}

function normalizePlan(planObj, goal) {
  const nextPlan = {
    ...planObj,
    goal,
    daily_tasks: Array.isArray(planObj.daily_tasks) ? [...planObj.daily_tasks] : [],
    weekly_tasks: Array.isArray(planObj.weekly_tasks) ? [...planObj.weekly_tasks] : [],
    bilibili_resources: Array.isArray(planObj.bilibili_resources) ? [...planObj.bilibili_resources] : []
  };

  if (nextPlan.bilibili_resources.length === 0) {
    nextPlan.bilibili_resources = buildFallbackBilibiliResources(goal);
  }

  const hasVideoTask = nextPlan.daily_tasks.some((task) => /哔哩哔哩|B站|视频|博主/.test(task));
  if (!hasVideoTask) {
    const firstResource = nextPlan.bilibili_resources[0];
    const label = firstResource.type === 'creator'
      ? `学习推荐博主：${firstResource.title}，并整理 3 条收获`
      : `观看哔哩哔哩推荐内容：${firstResource.title}，并记录学习笔记`;
    nextPlan.daily_tasks.push(label);
  }

  if (nextPlan.weekly_tasks.length === 0) {
    nextPlan.weekly_tasks.push('完成 1 次相关视频学习并输出复盘');
  }

  return nextPlan;
}

Page({
  data: {
    target: '',
    studyDays: 0,
    completedCount: 0,
    totalCount: 0,
    
    // 动态加载动画状态
    isGenerating: false,
    loadingMessages: [
      "正在唤醒 AI 学习管家...",
      "正在深入分析您的学习目标...",
      "正在量身定制每日打卡任务...",
      "正在为您排期本周核心计划...",
      "正在全网检索匹配 B 站优质资源...",
      "正在生成您的专属学习锦囊，请稍候..."
    ],
    loadingMessageIndex: 0,
    loadingTimer: null
  },

  onShow: function() {
    // 1. 读取坚持学习天数
    const studyDays = wx.getStorageSync('studyDays') || 0;

    // 2. 读取所有计划的任务进度 (支持多计划)
    const checkinPlans = wx.getStorageSync('checkinPlans') || [];
    let totalCount = 0;
    let completedCount = 0;
    
    // 兼容旧数据：把旧的 checkinTasks 迁移到新结构
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

    // 统计所有计划中的任务总数和完成数
    checkinPlans.forEach(plan => {
      const tasksObj = plan.tasksObj || {};
      const taskKeys = Object.keys(tasksObj);
      totalCount += taskKeys.length;
      taskKeys.forEach(key => {
        if (tasksObj[key].done) {
          completedCount++;
        }
      });
    });

    this.setData({
      studyDays: studyDays,
      completedCount: completedCount,
      totalCount: totalCount
    });
  },

  onInput(e) {
    this.setData({
      target: e.detail.value
    });
  },

  generatePlan() {
    const goal = this.data.target.trim();

    if (!goal) {
      wx.showToast({
        title: '请输入学习目标',
        icon: 'none'
      });
      return;
    }

    // 开启加载动画
    this.setData({
      isGenerating: true,
      loadingMessageIndex: 0
    });

    // 每隔 2.5 秒切换一次提示文案
    const timer = setInterval(() => {
      let nextIndex = this.data.loadingMessageIndex + 1;
      // 停留在最后一条
      if (nextIndex >= this.data.loadingMessages.length) {
        nextIndex = this.data.loadingMessages.length - 1;
      }
      this.setData({
        loadingMessageIndex: nextIndex
      });
    }, 2500);

    this.setData({ loadingTimer: timer });

    wx.cloud.callFunction({
      name: 'getPlan',
      data: { goal }
    }).then((res) => {
      clearInterval(this.data.loadingTimer);
      this.setData({ isGenerating: false });

      const aiPlan = res.result.plan;

      try {
        let planObj = JSON.parse(aiPlan);
        planObj = normalizePlan(planObj, goal);

        // 我们不再在这里直接将计划强行存入打卡和历史记录中
        // 而是将完整数据传递给 plan 页面，由用户点击“应用”后再做保存
        
        // 为了避免 URL 超长，把完整对象存入临时缓存
        wx.setStorageSync('tempPlanData', planObj);
        
        // 跳转到学习计划页，并带有 isNew 标记，用于显示底部按钮
        wx.navigateTo({
          url: '/pages/plan/plan?isNew=1'
        });
      } catch (error) {
        console.error('解析或保存计划数据失败', error);
        wx.showToast({
          title: '计划解析失败',
          icon: 'none'
        });
      }
    }).catch((err) => {
      clearInterval(this.data.loadingTimer);
      this.setData({ isGenerating: false });
      
      console.error('调用云函数失败', err);
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none'
      });
    });
  },

  goToChat() {
    wx.switchTab({
      url: '/pages/chat/chat'
    });
  },

  goToCheckin() {
    wx.switchTab({
      url: '/pages/checkin/checkin'
    });
  }
});
