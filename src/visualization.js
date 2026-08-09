/**
 * Network graph visualization using D3.js
 * Interactive drag-and-drop editor with animated flows
 */

class NetworkVisualization {
  constructor(containerId, width = 800, height = 500) {
    this.container = d3.select(containerId);
    this.width = width;
    this.height = height;
    this.svg = null;
    this.simulation = null;
    this.graph = null;
    this.onNodeClick = null;
    this.onEdgeClick = null;
    this.selectedNode = null;
    this.flowAnimationEnabled = true;
  }

  init(graph) {
    this.graph = graph;
    this.container.selectAll("*").remove();
    
    this.svg = this.container
      .append("svg")
      .attr("width", this.width)
      .attr("height", this.height)
      .attr("viewBox", [0, 0, this.width, this.height]);

    // Define arrow markers
    this.svg.append("defs").selectAll("marker")
      .data(["arrow"])
      .enter().append("marker")
      .attr("id", d => d)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 25)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#7f8c8d");

    // Groups for layering
    this.linkGroup = this.svg.append("g").attr("class", "links");
    this.nodeGroup = this.svg.append("g").attr("class", "nodes");
    this.flowGroup = this.svg.append("g").attr("class", "flows");

    this.update();
  }

  update() {
    if (!this.graph) return;

    const nodes = Array.from(this.graph.nodes.values());
    const links = Array.from(this.graph.edges.values()).map(e => ({
      source: e.source,
      target: e.target,
      id: `${e.source}-${e.target}`,
      value: e.flow || 0,
    }));

    // D3 force simulation
    this.simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(this.width / 2, this.height / 2))
      .force("collision", d3.forceCollide().radius(30));

    // Draw links
    const link = this.linkGroup.selectAll("line")
      .data(links, d => d.id);

    link.exit().remove();

    const linkEnter = link.enter().append("line")
      .attr("stroke", "#7f8c8d")
      .attr("stroke-width", d => Math.max(1, Math.sqrt(d.value) * 2))
      .attr("marker-end", "url(#arrow)");

    // Draw nodes
    const node = this.nodeGroup.selectAll("g")
      .data(nodes, d => d.id);

    node.exit().remove();

    const nodeEnter = node.enter().append("g")
      .attr("cursor", "pointer")
      .call(d3.drag()
        .on("start", (e, d) => this.dragstarted(e, d))
        .on("drag", (e, d) => this.dragged(e, d))
        .on("end", (e, d) => this.dragended(e, d)));

    // Node circles
    nodeEnter.append("circle")
      .attr("r", 20)
      .attr("fill", d => d.type === 'producer' ? '#e74c3c' : '#3498db')
      .attr("stroke", d => d === this.selectedNode ? '#f39c12' : '#2c3e50')
      .attr("stroke-width", d => d === this.selectedNode ? 4 : 2)
      .attr("fill-opacity", d => d.type === 'household' ? 0.3 : 0.9)
      .on("click", (e, d) => {
        e.stopPropagation();
        this.selectNode(d);
      });

    // Node labels
    nodeEnter.append("text")
      .attr("dy", 35)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#2c3e50")
      .text(d => d.label);

    // Stock indicator
    nodeEnter.append("text")
      .attr("class", "stock-label")
      .attr("dy", 5)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "white")
      .text(d => d.stock?.toFixed(1) || "0");

    // Merge and update positions
    this.simulation.on("tick", () => {
      this.linkGroup.selectAll("line")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      this.nodeGroup.selectAll("g")
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Keep nodes within bounds
    nodes.forEach(d => {
      d.x = Math.max(20, Math.min(this.width - 20, d.x));
      d.y = Math.max(20, Math.min(this.height - 20, d.y));
    });
  }

  selectNode(node) {
    this.selectedNode = node;
    this.update();
    if (this.onNodeClick) this.onNodeClick(node);
  }

  dragstarted(event, d) {
    if (!event.active) this.simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  dragended(event, d) {
    if (!event.active) this.simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // Update flow visualization
  updateFlows(flowData, timeStep) {
    if (!this.flowAnimationEnabled) return;

    const flows = this.flowGroup.selectAll("circle.flow-particle")
      .data(flowData.filter(d => d.value > 0.01), d => `${d.source}-${d.target}-${timeStep}`);

    flows.exit().remove();

    const nodes = this.graph.nodes;
    
    flows.enter().append("circle")
      .attr("class", "flow-particle")
      .attr("r", d => Math.max(2, Math.sqrt(d.value) * 3))
      .attr("fill", "#f39c12")
      .attr("opacity", 0.8)
      .attr("cx", d => nodes.get(d.source)?.x || 0)
      .attr("cy", d => nodes.get(d.source)?.y || 0)
      .transition()
      .duration(1000)
      .ease(d3.easeLinear)
      .attr("cx", d => nodes.get(d.target)?.x || 0)
      .attr("cy", d => nodes.get(d.target)?.y || 0)
      .remove();
  }

  // Update node stocks display
  updateStocks(stocks) {
    this.nodeGroup.selectAll("text.stock-label")
      .text(d => stocks.get(d.id)?.toFixed(1) || "0");
  }

  destroy() {
    if (this.simulation) this.simulation.stop();
    this.container.selectAll("*").remove();
  }
}

export { NetworkVisualization };
