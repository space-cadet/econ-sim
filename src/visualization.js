/**
 * Network graph visualization using D3.js
 * Interactive drag-and-drop editor with animated flows
 */

class NetworkVisualization {
  constructor(containerId, width = 800, height = 500, colors = {}) {
    this.container = d3.select(containerId);
    this.width = width;
    this.height = height;
    this.svg = null;
    this.simulation = null;
    this.graph = null;
    this.onNodeClick = null;
    this.onEdgeClick = null;
    this.selectedNode = null;
    this.selectedEdge = null;
    this.flowAnimationEnabled = true;
    
    // Edge creation state
    this.edgeSourceNode = null;
    this.ghostLine = null;
    
    // Color palette
    this.colors = {
      producer: colors.producer || '#f87171',
      household: colors.household || '#2dd4bf',
      producerFill: colors.producer || '#f87171',
      householdFill: colors.household || '#2dd4bf',
      edge: colors.edge || '#475569',
      text: colors.text || '#e2e8f0',
      highlight: colors.highlight || '#fbbf24',
      stroke: colors.stroke || '#1e293b',
      flow: colors.flow || '#fbbf24',
      ...colors,
    };
  }

  init(graph) {
    this.graph = graph;
    this.container.selectAll("*").remove();
    
    this.svg = this.container
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", [0, 0, this.width, this.height])
      .style("background", "#020617");

    // Define arrow markers
    const defs = this.svg.append("defs");
    
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 28)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", this.colors.edge);

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
      source: nodes.find(n => n.id === e.source),
      target: nodes.find(n => n.id === e.target),
      id: `${e.source}-${e.target}`,
      value: e.flow || 0,
    })).filter(l => l.source && l.target); // ensure both endpoints exist

    // Initialize or update force simulation
    if (!this.simulation) {
      this.simulation = d3.forceSimulation(nodes)
        .force("link", d3.forceLink(links).id(d => d.id).distance(120))
        .force("charge", d3.forceManyBody().strength(-400))
        .force("center", d3.forceCenter(this.width / 2, this.height / 2))
        .force("collision", d3.forceCollide().radius(35));
    } else {
      this.simulation.nodes(nodes);
      this.simulation.force("link").links(links);
    }

    // Update links with proper D3 join pattern
    const link = this.linkGroup.selectAll("line")
      .data(links, d => d.id);

    link.exit().remove();

    const linkEnter = link.enter().append("line")
      .attr("stroke", this.colors.edge)
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)")
      .attr("cursor", "pointer")
      .on("click", (e, d) => {
        e.stopPropagation();
        this.selectEdge(d);
      });

    const linkUpdate = link.merge(linkEnter);

    // Update nodes with proper D3 join pattern
    const node = this.nodeGroup.selectAll("g.node")
      .data(nodes, d => d.id);

    node.exit().remove();

    const nodeEnter = node.enter().append("g")
      .attr("class", "node")
      .attr("cursor", "pointer")
      .call(d3.drag()
        .on("start", (e, d) => this.dragstarted(e, d))
        .on("drag", (e, d) => this.dragged(e, d))
        .on("end", (e, d) => this.dragended(e, d)));

    // Node circles
    nodeEnter.append("circle")
      .attr("r", 22)
      .attr("fill", d => d.type === 'producer' ? this.colors.producerFill : this.colors.householdFill)
      .attr("fill-opacity", d => d.type === 'household' ? 0.25 : 0.9)
      .attr("stroke", this.colors.stroke)
      .attr("stroke-width", 2);

    // Selection ring (separate element for easy updating)
    nodeEnter.append("circle")
      .attr("class", "selection-ring")
      .attr("r", 26)
      .attr("fill", "none")
      .attr("stroke", this.colors.highlight)
      .attr("stroke-width", 3)
      .attr("opacity", 0);

    // Node labels
    nodeEnter.append("text")
      .attr("class", "node-label")
      .attr("dy", 38)
      .attr("text-anchor", "middle")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("fill", this.colors.text);

    // Stock indicator
    nodeEnter.append("text")
      .attr("class", "stock-label")
      .attr("dy", 5)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("font-weight", "600")
      .attr("fill", this.colors.text)
      .text(d => d.type === 'producer' ? 'P' : 'H');

    // MERGE + UPDATE existing nodes
    const nodeUpdate = node.merge(nodeEnter);
    
    nodeUpdate.select("circle:first-child")
      .attr("fill", d => d.type === 'producer' ? this.colors.producerFill : this.colors.householdFill)
      .attr("fill-opacity", d => d.type === 'household' ? 0.25 : 0.9);
    
    nodeUpdate.select("circle.selection-ring")
      .attr("opacity", d => d === this.selectedNode ? 1 : 0);
    
    nodeUpdate.select("text.node-label")
      .text(d => d.label);
    
    nodeUpdate.select("text.stock-label")
      .text(d => d.type === 'producer' ? 'P' : 'H');
    
    nodeUpdate.on("click", (e, d) => {
      e.stopPropagation();
      this.selectNode(d);
    });

    // Update positions on tick
    this.simulation.on("tick", () => {
      linkUpdate
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      nodeUpdate.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    // Only re-heat if structure changed
    if (node.enter().size() > 0 || node.exit().size() > 0 || link.enter().size() > 0) {
      this.simulation.alpha(0.3).restart();
    }
  }

  selectNode(node) {
    this.selectedNode = node;
    // Update selection ring without full re-render
    this.nodeGroup.selectAll("g.node").select("circle.selection-ring")
      .attr("opacity", d => d === this.selectedNode ? 1 : 0);
    // Note: onNodeClick is called by the click handler, not here
    // to avoid infinite recursion when onNodeClick calls selectNode
  }

  // Edge creation visual feedback
  setEdgeSource(node) {
    this.edgeSourceNode = node;
    // Highlight source node with different color
    this.nodeGroup.selectAll("g.node").select("circle:first-child")
      .attr("stroke", d => d === this.edgeSourceNode ? '#fbbf24' : this.colors.stroke)
      .attr("stroke-width", d => d === this.edgeSourceNode ? 4 : 2);
    
    // Create ghost line
    if (!this.ghostLine) {
      this.ghostLine = this.svg.append("line")
        .attr("class", "ghost-edge")
        .attr("stroke", "#fbbf24")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5,5")
        .attr("opacity", 0.6)
        .attr("x1", node.x)
        .attr("y1", node.y)
        .attr("x2", node.x)
        .attr("y2", node.y);
    }
    
    // Add mouse move listener
    this.svg.on("mousemove.edge-create", (e) => {
      if (!this.ghostLine || !this.edgeSourceNode) return;
      const [x, y] = d3.pointer(e, this.svg.node());
      this.ghostLine
        .attr("x1", this.edgeSourceNode.x)
        .attr("y1", this.edgeSourceNode.y)
        .attr("x2", x)
        .attr("y2", y);
    });
  }

  clearEdgeSource() {
    this.edgeSourceNode = null;
    if (this.ghostLine) {
      this.ghostLine.remove();
      this.ghostLine = null;
    }
    this.svg.on("mousemove.edge-create", null);
    // Reset node strokes
    this.nodeGroup.selectAll("g.node").select("circle:first-child")
      .attr("stroke", this.colors.stroke)
      .attr("stroke-width", 2);
  }

  selectEdge(edgeData) {
    this.selectedEdge = edgeData;
    this.linkGroup.selectAll("line")
      .attr("stroke", d => d === this.selectedEdge ? '#fbbf24' : this.colors.edge)
      .attr("stroke-width", d => d === this.selectedEdge ? 4 : 2);
    if (this.onEdgeClick) this.onEdgeClick(edgeData);
  }

  clearEdgeSelection() {
    this.selectedEdge = null;
    this.linkGroup.selectAll("line")
      .attr("stroke", this.colors.edge)
      .attr("stroke-width", 2);
  }

  getColor(index) {
    const palette = [
      '#f87171', '#2dd4bf', '#60a5fa', '#fbbf24', 
      '#a78bfa', '#34d399', '#fb923c', '#e879f9',
    ];
    return palette[index % palette.length];
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

  // Update flow visualization with animated particles
  updateFlows(flowData, timeStep) {
    if (!this.flowAnimationEnabled) return;

    const activeFlows = flowData.filter(d => d.value > 0.01);
    
    const flows = this.flowGroup.selectAll("circle.flow-particle")
      .data(activeFlows, d => `${d.source}-${d.target}-${timeStep}`);

    flows.exit().remove();

    const nodes = this.graph.nodes;
    
    flows.enter().append("circle")
      .attr("class", "flow-particle")
      .attr("r", d => Math.max(3, Math.min(8, Math.sqrt(d.value) * 4)))
      .attr("fill", this.colors.flow)
      .attr("opacity", 0.9)
      .attr("cx", d => {
        const n = nodes.get(d.source);
        return n ? n.x : 0;
      })
      .attr("cy", d => {
        const n = nodes.get(d.source);
        return n ? n.y : 0;
      })
      .transition()
      .duration(800)
      .ease(d3.easeLinear)
      .attr("cx", d => {
        const n = nodes.get(d.target);
        return n ? n.x : 0;
      })
      .attr("cy", d => {
        const n = nodes.get(d.target);
        return n ? n.y : 0;
      })
      .remove();
  }

  // Update node stocks display
  updateStocks(stocks) {
    this.nodeGroup.selectAll("g.node").select("text.stock-label")
      .text(d => {
        const s = stocks.get(d.id);
        return s !== undefined ? s.toFixed(1) : (d.stock?.toFixed(1) ?? "0");
      });
  }

  // Resize to container
  resize(width, height) {
    this.width = width;
    this.height = height;
    if (this.svg) {
      this.svg.attr("viewBox", [0, 0, width, height]);
    }
    if (this.simulation) {
      this.simulation.force("center", d3.forceCenter(width / 2, height / 2));
      this.simulation.alpha(0.3).restart();
    }
  }

  destroy() {
    if (this.simulation) this.simulation.stop();
    this.container.selectAll("*").remove();
  }
}

export { NetworkVisualization };
