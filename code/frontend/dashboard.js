const analyticsData = {
    kpis: [
      { label: "Active Users", value: 4286, delta: "+8.4%" },
      { label: "Total Questions", value: 39122, delta: "+14.2%" },
      { label: "Avg Response Time", value: "1.18s", delta: "-9.1%" },
      { label: "Positive Feedback", value: "92.6%", delta: "+2.3%" }
    ],
    dailyUsage: [
      710, 690, 740, 760, 810, 835, 790, 820, 870, 920,
      905, 930, 940, 890, 910, 960, 980, 1020, 1060, 1040,
      1090, 1140, 1120, 1165, 1190, 1240, 1210, 1280, 1320, 1360
    ],
    channels: [
      { name: "Web App", share: 56 },
      { name: "Microsoft Teams", share: 22 },
      { name: "Mobile", share: 14 },
      { name: "API", share: 8 }
    ],
    intents: [
      { name: "Product Docs", count: 12730 },
      { name: "Troubleshooting", count: 10220 },
      { name: "Policy Search", count: 7210 },
      { name: "Feature Requests", count: 5230 },
      { name: "Onboarding", count: 3732 }
    ],
    users: [
      { id: "U-104", name: "Aarav Shah", sessions: 81, latency: "0.92s", satisfaction: "96%", lastActive: "2m ago", topIntent: "Troubleshooting", docsViewed: 38, avgTokens: 970, escalations: 1 },
      { id: "U-221", name: "Nina Patel", sessions: 69, latency: "1.05s", satisfaction: "94%", lastActive: "8m ago", topIntent: "Product Docs", docsViewed: 41, avgTokens: 1150, escalations: 0 },
      { id: "U-317", name: "Leo Kim", sessions: 63, latency: "1.24s", satisfaction: "89%", lastActive: "16m ago", topIntent: "Policy Search", docsViewed: 27, avgTokens: 1022, escalations: 2 },
      { id: "U-502", name: "Maya Chen", sessions: 55, latency: "1.13s", satisfaction: "91%", lastActive: "20m ago", topIntent: "Feature Requests", docsViewed: 21, avgTokens: 866, escalations: 1 },
      { id: "U-590", name: "Omar Reyes", sessions: 49, latency: "1.30s", satisfaction: "87%", lastActive: "33m ago", topIntent: "Onboarding", docsViewed: 19, avgTokens: 799, escalations: 3 }
    ]
};

const kpiGrid = document.getElementById("kpiGrid");
const channelList = document.getElementById("channelList");
const userTableBody = document.getElementById("userTableBody");
const userDetails = document.getElementById("userDetails");
const intentBars = document.getElementById("intentBars");
const trendLabel = document.getElementById("trendLabel");
const rangeSelect = document.getElementById("rangeSelect");
const analyticsExportBtn = document.getElementById("analyticsExportBtn");
const quickExportBtn = document.getElementById("quickExportBtn");

function toast(msg) {
    const n = document.getElementById('note');
    n.textContent = msg;
    n.classList.remove('hidden');
    setTimeout(() => n.classList.add('hidden'), 1800);
}

function formatNumber(value) {
    return typeof value === "number" ? value.toLocaleString() : value;
}

function renderKpis() {
    kpiGrid.innerHTML = analyticsData.kpis.map((kpi) => `
        <article class="stat-card">
          <p class="subtitle">${kpi.label}</p>
          <p class="stat-value">${formatNumber(kpi.value)}</p>
          <p class="badge" style="background:none; border:none; padding:0; color:var(--brand)">${kpi.delta}</p>
        </article>
    `).join("");
}

function renderChannels() {
    channelList.innerHTML = analyticsData.channels.map((channel) => `
        <li>
          <div class="stat-header">
            <span>${channel.name}</span>
            <span>${channel.share}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${channel.share}%"></div>
          </div>
        </li>
    `).join("");
}

function renderUsers() {
    userTableBody.innerHTML = analyticsData.users.map((user, index) => `
        <tr data-index="${index}" class="cursor-pointer">
          <td>${user.name}</td>
          <td>${user.sessions}</td>
          <td>${user.latency}</td>
          <td>${user.satisfaction}</td>
          <td style="color:var(--stone-400)">${user.lastActive}</td>
        </tr>
    `).join("");

    userTableBody.querySelectorAll("tr").forEach((row) => {
        row.addEventListener("click", () => {
            const selectedIndex = Number(row.dataset.index);
            renderUserDetails(analyticsData.users[selectedIndex]);
            userTableBody.querySelectorAll("tr").forEach((r) => r.classList.remove("bg-brand/20"));
            row.classList.add("bg-brand/20");
        });
    });
}

function renderUserDetails(user) {
    userDetails.innerHTML = `
      <div class="detail-grid">
        <div class="detail-card detail-id">
          <p class="detail-label">USER ID</p>
          <p class="detail-value">${user.id}</p>
        </div>
        <div class="detail-card">
          <p class="detail-label">Top Intent</p>
          <p class="detail-value">${user.topIntent}</p>
        </div>
        <div class="detail-card">
          <p class="detail-label">Docs Viewed</p>
          <p class="detail-value">${user.docsViewed}</p>
        </div>
        <div class="detail-card">
          <p class="detail-label">Avg Tokens</p>
          <p class="detail-value">${user.avgTokens}</p>
        </div>
        <div class="detail-card">
          <p class="detail-label">Escalations</p>
          <p class="detail-value">${user.escalations}</p>
        </div>
      </div>
      <p class="detail-summary">Satisfaction score: ${user.satisfaction} | Last active: ${user.lastActive}</p>
    `;
}

function renderIntents() {
    const max = Math.max(...analyticsData.intents.map((item) => item.count));
    intentBars.innerHTML = analyticsData.intents.map((intent) => {
        const width = Math.round((intent.count / max) * 100);
        return `
          <div style="margin-bottom:12px">
            <div class="stat-header">
              <span>${intent.name}</span>
              <span>${intent.count.toLocaleString()}</span>
            </div>
            <div class="progress-bar-bg" style="height:10px">
              <div class="progress-bar-fill" style="width: ${width}%"></div>
            </div>
          </div>
        `;
    }).join("");
}

function drawTrendChart(days) {
    const canvas = document.getElementById("trendChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const data = analyticsData.dailyUsage.slice(-days);

    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const maxY = Math.max(...data) + 60;
    const minY = Math.min(...data) - 60;
    const chartW = rect.width - 32;
    const chartH = rect.height - 28;
    const offsetX = 16;
    const offsetY = 12;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
        const y = offsetY + (chartH / 4) * i;
        ctx.beginPath(); ctx.moveTo(offsetX, y); ctx.lineTo(offsetX + chartW, y); ctx.stroke();
    }

    ctx.beginPath();
    data.forEach((value, index) => {
        const x = offsetX + (chartW / (data.length - 1)) * index;
        const y = offsetY + ((maxY - value) / (maxY - minY)) * chartH;
        index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#f97316";
    ctx.stroke();

    const last = data[data.length - 1];
    const prev = data[data.length - 2] || last;
    const diff = (((last - prev) / prev) * 100).toFixed(1);
    trendLabel.textContent = `${diff >= 0 ? "+" : ""}${diff}% vs prev day`;
}

function exportAnalytics() {
    const payload = { generatedAt: new Date().toISOString(), rangeDays: Number(rangeSelect.value), analyticsData };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dashboard-analytics-export.json";
    link.click();
    toast("Analytics export downloaded.");
}

function init() {
    renderKpis();
    renderChannels();
    renderUsers();
    renderUserDetails(analyticsData.users[0]);
    const firstRow = userTableBody.querySelector("tr");
    if (firstRow) firstRow.classList.add("bg-brand/20");
    renderIntents();
    drawTrendChart(Number(rangeSelect.value));
}

rangeSelect.addEventListener("change", () => drawTrendChart(Number(rangeSelect.value)));
analyticsExportBtn.addEventListener("click", exportAnalytics);
quickExportBtn.addEventListener("click", exportAnalytics);
window.addEventListener("resize", () => drawTrendChart(Number(rangeSelect.value)));

init();