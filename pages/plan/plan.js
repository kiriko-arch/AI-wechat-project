function buildFallbackBilibiliResources(goal) {
  if (!goal) return [];

  const keyword = encodeURIComponent(goal);
  return [
    {
      type: 'video',
      title: `B站搜索：${goal}`,
      author: '系统兜底推荐',
      url: `https://search.bilibili.com/all?keyword=${keyword}`,
      reason: '当前计划未返回具体 B 站资源，先用搜索页快速找到相关视频。'
    },
    {
      type: 'creator',
      title: `B站UP主搜索：${goal} 老师`,
      author: '系统兜底推荐',
      url: `https://search.bilibili.com/upuser?keyword=${keyword}%20%E8%80%81%E5%B8%88`,
      reason: '更适合找长期更新该主题的博主。'
    }
  ];
}

Page({
  data: {
    aiPlan: '',
    planObj: null,
    isNew: false // 标记是否为新生成的计划
  },

  onLoad(options) {
    if (options.isNew === '1') {
      // 1. 如果是新生成的计划，从临时缓存中读取
      const tempPlan = wx.getStorageSync('tempPlanData');
      if (tempPlan) {
        if (!Array.isArray(tempPlan.bilibili_resources) || tempPlan.bilibili_resources.length === 0) {
          tempPlan.bilibili_resources = buildFallbackBilibiliResources(tempPlan.goal || tempPlan.title || '');
        }

        this.setData({
          planObj: tempPlan,
          isNew: true
        });
        return;
      }
    }

    // 2. 兼容旧的跳转逻辑（如果有从别的地方传 plan 参数过来的话）
    if (options.plan) {
      const decodedPlan = decodeURIComponent(options.plan);

      try {
        const planObj = JSON.parse(decodedPlan);
        if (!Array.isArray(planObj.bilibili_resources) || planObj.bilibili_resources.length === 0) {
          planObj.bilibili_resources = buildFallbackBilibiliResources(planObj.goal || planObj.title || '');
        }

        this.setData({
          planObj
        });
      } catch (error) {
        console.error('学习计划解析失败', error);
        this.setData({
          aiPlan: decodedPlan
        });
      }
      return;
    }

    wx.showToast({
      title: '请先生成学习计划',
      icon: 'none'
    });
  },

  // 放弃该计划，返回首页
  discardPlan() {
    wx.showModal({
      title: '提示',
      content: '确定丢弃当前计划并返回首页吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('tempPlanData');
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      }
    });
  },

  // 应用该计划，保存到本地打卡及历史记录（并同步到云端）
  applyPlan() {
    const planObj = this.data.planObj;
    if (!planObj) return;

    // 显示加载提示，因为要存云端了
    wx.showLoading({ title: '保存中...', mask: true });

    // --- 准备要保存的数据格式 ---
    const goal = planObj.goal || planObj.title;
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // 生成打卡任务对象
    const tasksObj = {};
    if (planObj.daily_tasks && planObj.daily_tasks.length > 0) {
      planObj.daily_tasks.forEach((taskName, index) => {
        const taskId = `task${index + 1}`;
        tasksObj[taskId] = {
          text: taskName,
          done: false
        };
      });
    }

    // 组装一条完整的计划记录
    const planRecord = {
      goal: goal,
      date: dateStr,
      tasksObj: tasksObj, // 打卡任务
      completedTasks: [], // 历史记录展示用
      fullPlan: planObj   // 完整的原始 JSON（包含建议、视频链接等）
    };

    // --- 1. 先调用云函数存入云数据库 ---
    wx.cloud.callFunction({
      name: 'syncPlan',
      data: {
        action: 'add',
        planData: planRecord
      }
    }).then(res => {
      if (res.result && res.result.success) {
        // 云端保存成功，拿到云端生成的唯一 ID
        const cloudPlanId = res.result.planId;
        planRecord.id = cloudPlanId; // 给本地记录也打上云端 ID

        // --- 2. 存入本地，保持前端渲染依然丝滑 ---
        
        // A. 更新打卡计划列表 (checkinPlans)
        let checkinPlans = wx.getStorageSync('checkinPlans') || [];
        checkinPlans.unshift({
          id: cloudPlanId,
          goal: goal,
          tasksObj: tasksObj,
          fullPlan: planObj // 保存完整的计划信息供锦囊使用
        });
        wx.setStorageSync('checkinPlans', checkinPlans);

        // B. 更新历史记录列表 (historyRecords)
        let historyRecords = wx.getStorageSync('historyRecords') || [];
        historyRecords.unshift({
          id: cloudPlanId,
          goal: goal,
          completedTasks: [],
          date: dateStr,
          fullPlan: planObj // 保存完整的计划信息供锦囊使用
        });
        wx.setStorageSync('historyRecords', historyRecords);

        wx.hideLoading();
        wx.showToast({ title: '已应用到打卡', icon: 'success' });

        this.setData({ isNew: false });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/checkin/checkin' });
        }, 1500);

      } else {
        throw new Error(res.result.error || '云端保存失败');
      }
    }).catch(err => {
      wx.hideLoading();
      console.error("同步云端计划失败:", err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    });
  },

  copyLink(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      wx.showToast({
        title: '该资源暂无链接',
        icon: 'none'
      });
      return;
    }

    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showToast({
          title: '链接已复制',
          icon: 'success'
        });
      }
    });
  }
});
