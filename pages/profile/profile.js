Page({
  data: {
    badge: '青柠新手 🌱',
    studyDays: 0,
    totalCompletedTasks: 0,
    
    // 新版热力图状态
    heatmapGrid: [],
    
    // 往期回顾弹窗状态
    showHistoryModal: false,
    currentViewYear: 2023,
    currentViewMonth: 10,
    isCurrentMonth: true,
    historyGrid: []
  },

  onShow: function() {
    // 1. 统计历史记录中的任务总数
    const historyRecords = wx.getStorageSync('historyRecords') || [];
    let totalCompleted = 0;
    historyRecords.forEach(record => {
      if (record.completedTasks) {
        totalCompleted += record.completedTasks.length;
      }
    });

    // 2. 获取坚持天数，并计算称号
    const studyDays = wx.getStorageSync('studyDays') || 0;
    let badge = '青柠新手 🌱';
    if (studyDays >= 21) {
      badge = '卷王本王 👑';
    } else if (studyDays >= 7) {
      badge = '自律新星 🔥';
    } else if (studyDays >= 3) {
      badge = '进阶学霸 📚';
    }

    this.setData({
      badge: badge,
      studyDays: studyDays,
      totalCompletedTasks: totalCompleted
    });

    // 3. 生成新版近30天学习热力图
    this.initRecent30DaysGrid();
  },

  // 生成近30天带星期占位的网格
  initRecent30DaysGrid: function() {
    const completedDates = wx.getStorageSync('completedDates') || [];
    const today = new Date();
    const days = [];
    
    // 生成过去30天的数据
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const dateStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      days.push({
        date: dateStr,
        day: d.getDate(),
        weekday: d.getDay(), // 0-6 (周日-周六)
        active: completedDates.includes(dateStr),
        isToday: i === 0,
        empty: false
      });
    }

    // 计算第一天是星期几，在前面填充空白格对齐星期
    const firstDayWeekday = days[0].weekday;
    const paddedDays = [];
    for (let i = 0; i < firstDayWeekday; i++) {
      paddedDays.push({ empty: true });
    }
    paddedDays.push(...days);

    this.setData({ heatmapGrid: paddedDays });
  },

  // ================= 往期回顾模态框 =================
  openHistoryModal: function() {
    const today = new Date();
    this.generateMonthGrid(today.getFullYear(), today.getMonth() + 1);
    this.setData({
      showHistoryModal: true,
      currentViewYear: today.getFullYear(),
      currentViewMonth: today.getMonth() + 1,
      isCurrentMonth: true
    });
  },

  closeHistoryModal: function() {
    this.setData({ showHistoryModal: false });
  },

  stopBubble: function() {
    // 阻止点击内容区关闭弹窗
  },

  prevMonth: function() {
    let y = this.data.currentViewYear;
    let m = this.data.currentViewMonth - 1;
    if (m < 1) {
      m = 12;
      y--;
    }
    this.generateMonthGrid(y, m);
  },

  nextMonth: function() {
    if (this.data.isCurrentMonth) return; // 不能超过当前月
    let y = this.data.currentViewYear;
    let m = this.data.currentViewMonth + 1;
    if (m > 12) {
      m = 1;
      y++;
    }
    this.generateMonthGrid(y, m);
  },

  generateMonthGrid: function(year, month) {
    const completedDates = wx.getStorageSync('completedDates') || [];
    const today = new Date();
    const isCurrentMonth = (year === today.getFullYear() && month === today.getMonth() + 1);

    const firstDayDate = new Date(year, month - 1, 1);
    const lastDayDate = new Date(year, month, 0); // 这个月的最后一天
    const daysInMonth = lastDayDate.getDate();
    const firstWeekday = firstDayDate.getDay();

    const grid = [];
    // 填充当月第一天前面的空白
    for (let i = 0; i < firstWeekday; i++) {
      grid.push({ empty: true });
    }

    // 填充当月所有的天数
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${month}-${i}`;
      const isToday = isCurrentMonth && (i === today.getDate());
      const isFuture = isCurrentMonth && (i > today.getDate());
      
      grid.push({
        date: dateStr,
        day: i,
        active: completedDates.includes(dateStr),
        isToday: isToday,
        isFuture: isFuture,
        empty: false
      });
    }

    this.setData({
      historyGrid: grid,
      currentViewYear: year,
      currentViewMonth: month,
      isCurrentMonth: isCurrentMonth
    });
  },

  // 跳转到历史记录页面
  goToHistory: function() {
    wx.navigateTo({
      url: '/pages/history/history'
    });
  }
});