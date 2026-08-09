/**
 * Plotting components using Chart.js
 * Time series, welfare trajectory, adjacency matrix heatmap
 */

class PlotManager {
  constructor() {
    this.charts = new Map();
  }

  createTimeSeriesPlot(canvasId, datasets, labels) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if (this.charts.has(canvasId)) {
      this.charts.get(canvasId).destroy();
    }

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets.map((ds, i) => ({
          label: ds.label,
          data: ds.data,
          borderColor: ds.color || this.getColor(i),
          backgroundColor: ds.color || this.getColor(i),
          fill: false,
          tension: 0.1,
          pointRadius: 2,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' },
          title: { display: true, text: 'Time Series' },
        },
        scales: {
          x: { title: { display: true, text: 'Time Period' } },
          y: { title: { display: true, text: 'Value' } },
        },
        animation: { duration: 0 },
      },
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  createWelfarePlot(canvasId, welfareData, labels) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if (this.charts.has(canvasId)) {
      this.charts.get(canvasId).destroy();
    }

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Cumulative Welfare',
          data: welfareData,
          borderColor: '#27ae60',
          backgroundColor: 'rgba(39, 174, 96, 0.1)',
          fill: true,
          tension: 0.1,
          pointRadius: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          title: { display: true, text: 'Welfare Trajectory' },
        },
        scales: {
          x: { title: { display: true, text: 'Time Period' } },
          y: { title: { display: true, text: 'Discounted Welfare' } },
        },
      },
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  createAdjacencyHeatmap(canvasId, matrix, nodeLabels) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    if (this.charts.has(canvasId)) {
      this.charts.get(canvasId).destroy();
    }

    const n = matrix.length;
    // Flatten matrix for scatter plot
    const data = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        data.push({
          x: j,
          y: n - 1 - i, // flip y for matrix display
          v: matrix[i][j],
        });
      }
    }

    const chart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Adjacency Matrix',
          data: data,
          backgroundColor: d => {
            const v = d.raw?.v || 0;
            const intensity = Math.min(1, v);
            return `rgba(231, 76, 60, ${intensity})`;
          },
          pointRadius: d => {
            const v = d.raw?.v || 0;
            return v > 0 ? 15 : 0;
          },
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Network Adjacency Matrix' },
          tooltip: {
            callbacks: {
              label: (ctx) => `A[${n - 1 - ctx.raw.y}][${ctx.raw.x}] = ${ctx.raw.v.toFixed(2)}`,
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: -0.5,
            max: n - 0.5,
            ticks: { stepSize: 1, callback: v => nodeLabels[v] || v },
            title: { display: true, text: 'To Node' },
          },
          y: {
            type: 'linear',
            min: -0.5,
            max: n - 0.5,
            ticks: { stepSize: 1, callback: v => nodeLabels[n - 1 - v] || (n - 1 - v) },
            title: { display: true, text: 'From Node' },
          },
        },
      },
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  createShadowPricePlot(canvasId, shadowPrices, labels) {
    const datasets = Array.from(shadowPrices.entries()).map(([id, prices], i) => ({
      label: `Node ${id}`,
      data: prices,
      color: this.getColor(i),
    }));

    return this.createTimeSeriesPlot(canvasId, datasets, labels);
  }

  getColor(index) {
    const colors = [
      '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
      '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
    ];
    return colors[index % colors.length];
  }

  destroyAll() {
    for (const chart of this.charts.values()) {
      chart.destroy();
    }
    this.charts.clear();
  }
}

export { PlotManager };
