# Econ-Sim: Networked Intertemporal Optimization

An interactive web simulator for the Ramsey social-planner problem on economic networks, with deep analogies to lattice field theory.

Based on handwritten notes by **Anarkitty** (August 2026), transcribed and annotated.

## Live Demo

Deployed at: [quantumofgravity.com/projects/econ-sim/](https://quantumofgravity.com/projects/econ-sim/)

## Features

- **Interactive Network Editor**: Drag-and-drop nodes (producers/households), draw edges, configure parameters
- **Real-time Simulation**: Numerical solution of the planner's optimization problem
- **Visualizations**: 
  - Animated network graph with flow visualization
  - Time-series plots for consumption, shadow prices, stocks
  - Welfare trajectory and adjacency matrix heatmap
- **Physics Analogy Docs**: Side-by-side comparison with continuum field theory

## Mathematical Model

The planner maximizes welfare over an infinite horizon:

$$W = \sum_{t=0}^{\infty} \beta^t \sum_{d=1}^{D} \omega_d u_d(c_{d,t})$$

Subject to node-level flow balance and goods-market accounting constraints on a graph.

See the [docs](docs/) for full mathematical details and the physics analogy.

## Development

```bash
git clone https://github.com/space-cadet/econ-sim.git
cd econ-sim
# Open index.html in a browser, or serve with any static server
python3 -m http.server 8000
```

## Project Structure

```
econ-sim/
├── index.html          # Main entry point
├── src/
│   ├── simulation.js   # Core optimization engine
│   ├── graph.js        # Graph data structures
│   ├── solver.js       # Numerical solver
│   ├── visualization.js # Network graph renderer
│   ├── plots.js        # Chart components
│   ├── ui.js           # UI controls
│   └── docs.js         # Documentation renderer
├── docs/               # Markdown documentation
├── styles/             # CSS
└── memory-bank/        # Project memory bank
```

## License

MIT
