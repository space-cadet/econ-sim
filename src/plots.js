/**
 * Plotting components using Chart.js
 * Time series, welfare trajectory, adjacency matrix heatmap
 */

class PlotManager {
  constructor() {
    this.charts = new Map();
  }

  createTimeSeriesPlot(canvasId, datasets, labels, options = {}) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;
    
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
          backgroundColor: (ds.color || this.getColor(i)) + '20',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { 
            display: true, 
            position: 'top',
            labels: { color: '#94a3b8', font: { size: 11 } }
          },
          title: { 
            display: !!options.title, 
            text: options.title || '',
            color: '#e2e8f0',
            font: { size: 13 }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            borderColor: '#334155',
            borderWidth: 1,
          },
        },
        scales: {
          x: { 
            title: { display: true, text: 'Time', color: '#64748b' },
            ticks: { color: '#64748b', maxTicksLimit: 10 },
            grid: { color: '#1e293b' }
          },
          y: { 
            title: { display: true, text: options.yLabel || 'Value', color: '#64748b' },
            ticks: { color: '#64748b' },
            grid: { color: '#1e293b' }
          },
        },
        animation: { duration: 0 },
      },
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  createWelfarePlot(canvasId, welfareData, labels) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;
    
    if (this.charts.has(canvasId)) {
      this.charts.get(canvasId).destroy();
    }

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Per-Period Welfare',
          data: welfareData,
          borderColor: '#2dd4bf',
          backgroundColor: 'rgba(45, 212, 191, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            display: true,
            labels: { color: '#94a3b8', font: { size: 11 } }
          },
          title: { 
            display: true, 
            text: 'Welfare Trajectory',
            color: '#e2e8f0',
            font: { size: 13 }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#e2e8f0',
            bodyColor: '#94a3b8',
            borderColor: '#334155',
            borderWidth: 1,
          },
        },
        scales: {
          x: { 
            title: { display: true, text: 'Time', color: '#64748b' },
            ticks: { color: '#64748b', maxTicksLimit: 10 },
            grid: { color: '#1e293b' }
          },
          y: { 
            title: { display: true, text: 'Utility', color: '#64748b' },
            ticks: { color: '#64748b' },
            grid: { color: '#1e293b' }
          },
        },
      },
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  createShadowPricePlot(canvasId, shadowPrices, labels) {
    const datasets = Array.from(shadowPrices.entries()).map(([id, prices], i) => {
      // Sanity check: if values are extreme, log scale or clamp
      const maxVal = Math.max(...prices.map(Math.abs));
      const isExtreme = maxVal > 1000;
      
      return {
        label: `Node ${id}`,
        data: isExtreme ? prices.map(v => Math.min(Math.max(v, -100), 100)) : prices,
        color: this.getColor(i),
        note: isExtreme ? ' (clipped for display)' : '',
      };
    });

    return this.createTimeSeriesPlot(canvasId, datasets, labels, {
      title: 'Shadow Prices',
      yLabel: 'λ',
    });
  }

  // Draw adjacency matrix as a proper heatmap using HTML5 Canvas
  createAdjacencyHeatmap(canvasId, matrix, nodeLabels) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    // Destroy any existing Chart.js chart on this canvas
    if (this.charts.has(canvasId)) {
      this.charts.get(canvasId).destroy();
      this.charts.delete(canvasId);
    }
    
    const ctx = canvas.getContext('2d');
    const n = matrix.length;
    if (n === 0) return;
    
    // Get actual canvas size from parent container
    const rect = canvas.parentElement.getBoundingClientRect();
    const padding = 40; // space for labels
    const availableSize = Math.min(rect.width, rect.height - 30);
    const size = Math.min(availableSize - padding, 280);
    
    canvas.width = size + padding;
    canvas.height = size + padding;
    
    const cellSize = size / n;
    const offsetX = padding;
    const offsetY = padding;
    
    // Clear background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid cells
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const val = matrix[i][j];
        if (val > 0) {
          ctx.fillStyle = 'rgba(45, 212, 191, 0.9)';
        } else {
          ctx.fillStyle = 'rgba(51, 65, 85, 0.4)';
        }
        ctx.fillRect(offsetX + j * cellSize + 0.5, offsetY + i * cellSize + 0.5, cellSize - 1, cellSize - 1);
      }
    }
    
    // Draw labels
    ctx.fillStyle = '#94a3b8';
    const fontSize = Math.max(8, Math.min(11, cellSize * 0.35));
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < n; i++) {
      // Row labels - truncate if too long
      let label = nodeLabels?.[i] ?? String(i);
      if (label.length > 4) label = label.substring(0, 3) + '…';
      ctx.fillText(label, offsetX - 6, offsetY + (i + 0.5) * cellSize);
    }
    
    // Column labels - rotated to prevent overlap
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let j = 0; j < n; j++) {
      let label = nodeLabels?.[j] ?? String(j);
      if (label.length > 4) label = label.substring(0, 3) + '…';
      
      ctx.save();
      ctx.translate(offsetX + (j + 0.5) * cellSize, offsetY - 10);
      ctx.rotate(-Math.PI / 3);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  }

  // Mini plot for inline display
  createMiniPlot(canvasId, datasets, labels, color) {
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;
    
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
          backgroundColor: (ds.color || this.getColor(i)) + '15',
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 1.5,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1, labels: { color: '#94a3b8', font: { size: 9 }, boxWidth: 8 } },
          title: { display: false },
        },
        scales: {
          x: { display: false },
          y: { 
            display: true,
            ticks: { color: '#64748b', font: { size: 8 } },
            grid: { color: '#1e293b' }
          },
        },
        animation: { duration: 300 },
      },
    });

    this.charts.set(canvasId, chart);
    return chart;
  }

  getColor(index) {
    const colors = [
      '#f87171', '#2dd4bf', '#60a5fa', '#fbbf24', 
      '#a78bfa', '#34d399', '#fb923c', '#e879f9',
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
