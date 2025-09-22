<script>
	import { onMount, afterUpdate } from 'svelte';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	export let lineageData = [];
	export let currentAssetId = null;

	let container;
	let nodes = [];
	let edges = [];
	let selectedNode = null;
	let hoveredNode = null;
	let isDragging = false;
	let dragOffset = { x: 0, y: 0 };
	let transform = { x: 0, y: 0, scale: 1 };
	let animatedTransform = tweened({ x: 0, y: 0, scale: 1 }, { duration: 300, easing: cubicOut });

	const nodeRadius = 40;
	const edgeStrokeWidth = 2;
	const colors = {
		current: '#2f81f7',
		parent: '#f78166',
		child: '#56d364',
		sibling: '#d2a8ff',
		default: '#8b949e'
	};

	onMount(() => {
		processLineageData();
		setupPanAndZoom();
	});

	afterUpdate(() => {
		if (lineageData.length > 0) {
			processLineageData();
		}
	});

	function processLineageData() {
		if (!lineageData || lineageData.length === 0) {
			nodes = [];
			edges = [];
			return;
		}

		// Create nodes from lineage data
		const nodeMap = new Map();
		const edgeList = [];

		lineageData.forEach(item => {
			// Add source node
			if (!nodeMap.has(item.source_id)) {
				nodeMap.set(item.source_id, {
					id: item.source_id,
					label: item.source_name || `Asset ${item.source_id}`,
					type: getNodeType(item.source_id),
					x: 0,
					y: 0
				});
			}

			// Add target node
			if (!nodeMap.has(item.target_id)) {
				nodeMap.set(item.target_id, {
					id: item.target_id,
					label: item.target_name || `Asset ${item.target_id}`,
					type: getNodeType(item.target_id),
					x: 0,
					y: 0
				});
			}

			// Add edge
			edgeList.push({
				source: item.source_id,
				target: item.target_id,
				type: item.relationship_type || 'derived_from'
			});
		});

		nodes = Array.from(nodeMap.values());
		edges = edgeList;

		// Layout nodes using force-directed algorithm
		layoutNodes();
	}

	function getNodeType(nodeId) {
		if (nodeId === currentAssetId) return 'current';

		// Find relationships for this node
		const parentEdges = edges.filter(e => e.target === nodeId);
		const childEdges = edges.filter(e => e.source === nodeId);
		const currentNodeEdges = edges.filter(e =>
			(e.source === currentAssetId && e.target === nodeId) ||
			(e.target === currentAssetId && e.source === nodeId)
		);

		if (currentNodeEdges.some(e => e.source === nodeId)) return 'parent';
		if (currentNodeEdges.some(e => e.target === nodeId)) return 'child';
		if (parentEdges.length > 0 || childEdges.length > 0) return 'sibling';

		return 'default';
	}

	function layoutNodes() {
		if (nodes.length === 0) return;

		const width = container?.offsetWidth || 800;
		const height = container?.offsetHeight || 400;
		const centerX = width / 2;
		const centerY = height / 2;

		if (nodes.length === 1) {
			nodes[0].x = centerX;
			nodes[0].y = centerY;
			return;
		}

		// Find current node
		const currentNode = nodes.find(n => n.id === currentAssetId);

		if (currentNode) {
			currentNode.x = centerX;
			currentNode.y = centerY;
		}

		// Position other nodes in layers around current node
		const layers = {
			parents: nodes.filter(n => n.type === 'parent'),
			children: nodes.filter(n => n.type === 'child'),
			siblings: nodes.filter(n => n.type === 'sibling'),
			others: nodes.filter(n => n.type === 'default')
		};

		// Position parents above
		positionLayer(layers.parents, centerX, centerY - 120, 150);

		// Position children below
		positionLayer(layers.children, centerX, centerY + 120, 150);

		// Position siblings to the sides
		positionLayer(layers.siblings, centerX - 200, centerY, 100, true);
		positionLayer(layers.others, centerX + 200, centerY, 100, true);

		// Apply force simulation for better positioning
		applyForceSimulation();
	}

	function positionLayer(layerNodes, centerX, centerY, spacing, vertical = false) {
		if (layerNodes.length === 0) return;

		const angleStep = (2 * Math.PI) / Math.max(layerNodes.length, 3);

		layerNodes.forEach((node, i) => {
			if (vertical && layerNodes.length > 1) {
				node.x = centerX;
				node.y = centerY + (i - (layerNodes.length - 1) / 2) * spacing;
			} else {
				const angle = i * angleStep;
				node.x = centerX + Math.cos(angle) * spacing;
				node.y = centerY + Math.sin(angle) * spacing;
			}
		});
	}

	function applyForceSimulation() {
		// Simple force simulation to prevent overlaps
		for (let iteration = 0; iteration < 50; iteration++) {
			// Repulsion between nodes
			for (let i = 0; i < nodes.length; i++) {
				for (let j = i + 1; j < nodes.length; j++) {
					const dx = nodes[j].x - nodes[i].x;
					const dy = nodes[j].y - nodes[i].y;
					const distance = Math.sqrt(dx * dx + dy * dy);

					if (distance < nodeRadius * 3) {
						const force = (nodeRadius * 3 - distance) / distance * 0.1;
						const fx = dx * force;
						const fy = dy * force;

						nodes[i].x -= fx;
						nodes[i].y -= fy;
						nodes[j].x += fx;
						nodes[j].y += fy;
					}
				}
			}
		}
	}

	function setupPanAndZoom() {
		if (!container) return;

		let isPanning = false;
		let startX, startY;

		container.addEventListener('mousedown', (e) => {
			if (e.target === container || e.target.classList.contains('graph-background')) {
				isPanning = true;
				startX = e.clientX - transform.x;
				startY = e.clientY - transform.y;
				container.style.cursor = 'grabbing';
			}
		});

		container.addEventListener('mousemove', (e) => {
			if (isPanning) {
				transform.x = e.clientX - startX;
				transform.y = e.clientY - startY;
				updateTransform();
			}
		});

		container.addEventListener('mouseup', () => {
			isPanning = false;
			container.style.cursor = 'grab';
		});

		container.addEventListener('wheel', (e) => {
			e.preventDefault();
			const delta = e.deltaY > 0 ? 0.9 : 1.1;
			const newScale = Math.max(0.1, Math.min(3, transform.scale * delta));

			const rect = container.getBoundingClientRect();
			const centerX = rect.width / 2;
			const centerY = rect.height / 2;

			transform.scale = newScale;
			updateTransform();
		});
	}

	function updateTransform() {
		animatedTransform.set(transform);
	}

	function handleNodeClick(node) {
		selectedNode = selectedNode?.id === node.id ? null : node;

		// Center on clicked node
		const rect = container.getBoundingClientRect();
		transform.x = rect.width / 2 - node.x * transform.scale;
		transform.y = rect.height / 2 - node.y * transform.scale;
		updateTransform();
	}

	function handleNodeHover(node) {
		hoveredNode = node;
	}

	function handleNodeLeave() {
		hoveredNode = null;
	}

	function getNodeColor(node) {
		if (selectedNode?.id === node.id) return '#f78166';
		if (hoveredNode?.id === node.id) return '#58a6ff';
		return colors[node.type] || colors.default;
	}

	function getEdgeOpacity(edge) {
		if (!selectedNode && !hoveredNode) return 0.6;
		if (selectedNode?.id === edge.source || selectedNode?.id === edge.target) return 1;
		if (hoveredNode?.id === edge.source || hoveredNode?.id === edge.target) return 0.8;
		return 0.2;
	}

	function resetView() {
		transform = { x: 0, y: 0, scale: 1 };
		updateTransform();
		selectedNode = null;
	}

	$: transformString = `translate(${$animatedTransform.x}px, ${$animatedTransform.y}px) scale(${$animatedTransform.scale})`;
</script>

<div class="lineage-graph-container" bind:this={container}>
	{#if nodes.length === 0}
		<div class="empty-state">
			<div class="empty-icon">🔗</div>
			<h3>No Lineage Data</h3>
			<p>No data lineage information is available for this asset.</p>
		</div>
	{:else}
		<div class="graph-controls">
			<button class="control-btn" on:click={resetView} title="Reset View">
				<svg width="16" height="16" viewBox="0 0 16 16">
					<path fill="currentColor" d="M8 2.5a5.5 5.5 0 0 0-4.25 2.028l-.896-.896a.5.5 0 0 0-.854.353V7.5a.5.5 0 0 0 .5.5h3.515a.5.5 0 0 0 .353-.854l-.896-.896A4.5 4.5 0 1 1 8 3.5a.5.5 0 0 0 0-1z"/>
				</svg>
			</button>
			<div class="zoom-info">
				{Math.round($animatedTransform.scale * 100)}%
			</div>
		</div>

		<div class="graph-legend">
			<div class="legend-item">
				<div class="legend-color" style="background: {colors.current}"></div>
				<span>Current Asset</span>
			</div>
			<div class="legend-item">
				<div class="legend-color" style="background: {colors.parent}"></div>
				<span>Parent</span>
			</div>
			<div class="legend-item">
				<div class="legend-color" style="background: {colors.child}"></div>
				<span>Child</span>
			</div>
			<div class="legend-item">
				<div class="legend-color" style="background: {colors.sibling}"></div>
				<span>Related</span>
			</div>
		</div>

		<svg class="graph-svg" style="transform: {transformString}">
			<defs>
				<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
					<polygon points="0 0, 10 3.5, 0 7" fill="#8b949e" />
				</marker>
			</defs>

			<!-- Edges -->
			{#each edges as edge}
				{@const sourceNode = nodes.find(n => n.id === edge.source)}
				{@const targetNode = nodes.find(n => n.id === edge.target)}
				{#if sourceNode && targetNode}
					<line
						x1={sourceNode.x}
						y1={sourceNode.y}
						x2={targetNode.x}
						y2={targetNode.y}
						stroke="#8b949e"
						stroke-width={edgeStrokeWidth}
						opacity={getEdgeOpacity(edge)}
						marker-end="url(#arrowhead)"
						class="edge"
					/>
				{/if}
			{/each}

			<!-- Nodes -->
			{#each nodes as node}
				<g class="node-group" transform="translate({node.x}, {node.y})">
					<!-- Node shadow -->
					<circle
						cx="2"
						cy="2"
						r={nodeRadius}
						fill="rgba(0,0,0,0.3)"
						class="node-shadow"
					/>

					<!-- Node background -->
					<circle
						cx="0"
						cy="0"
						r={nodeRadius}
						fill={getNodeColor(node)}
						stroke="#21262d"
						stroke-width="2"
						class="node-background"
						on:click={() => handleNodeClick(node)}
						on:mouseenter={() => handleNodeHover(node)}
						on:mouseleave={handleNodeLeave}
					/>

					<!-- Node icon -->
					<circle
						cx="0"
						cy="0"
						r={nodeRadius - 8}
						fill="rgba(255,255,255,0.1)"
						class="node-icon"
					/>

					<!-- Node label -->
					<text
						x="0"
						y={nodeRadius + 20}
						text-anchor="middle"
						fill="#e6edf3"
						font-size="12"
						font-weight="500"
						class="node-label"
					>
						{node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label}
					</text>

					<!-- Node type indicator -->
					{#if node.type === 'current'}
						<circle cx="0" cy="0" r="6" fill="#fff" />
						<circle cx="0" cy="0" r="3" fill={colors.current} />
					{/if}
				</g>
			{/each}
		</svg>

		{#if selectedNode}
			<div class="node-details">
				<h4>{selectedNode.label}</h4>
				<p><strong>ID:</strong> {selectedNode.id}</p>
				<p><strong>Type:</strong> {selectedNode.type}</p>
				<button class="close-details" on:click={() => selectedNode = null}>×</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.lineage-graph-container {
		position: relative;
		width: 100%;
		height: 100%;
		background: #0d1117;
		border-radius: 0.5rem;
		overflow: hidden;
		cursor: grab;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #8b949e;
		text-align: center;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.5;
	}

	.empty-state h3 {
		margin: 0 0 0.5rem;
		font-size: 1.25rem;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.9rem;
	}

	.graph-controls {
		position: absolute;
		top: 1rem;
		right: 1rem;
		z-index: 10;
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.control-btn {
		background: #21262d;
		border: 1px solid #30363d;
		color: #e6edf3;
		padding: 0.5rem;
		border-radius: 0.375rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.control-btn:hover {
		background: #30363d;
		border-color: #484f58;
	}

	.zoom-info {
		background: #21262d;
		border: 1px solid #30363d;
		color: #e6edf3;
		padding: 0.5rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.8rem;
		font-weight: 500;
	}

	.graph-legend {
		position: absolute;
		top: 1rem;
		left: 1rem;
		z-index: 10;
		background: rgba(33, 38, 45, 0.9);
		border: 1px solid #30363d;
		border-radius: 0.5rem;
		padding: 1rem;
		backdrop-filter: blur(8px);
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		font-size: 0.8rem;
		color: #e6edf3;
	}

	.legend-item:last-child {
		margin-bottom: 0;
	}

	.legend-color {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 1px solid #30363d;
	}

	.graph-svg {
		width: 100%;
		height: 100%;
		transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		transform-origin: center;
	}

	.node-group {
		cursor: pointer;
		transition: all 0.2s;
	}

	.node-group:hover {
		filter: brightness(1.2);
	}

	.node-background {
		transition: all 0.2s;
	}

	.node-background:hover {
		stroke-width: 3;
		stroke: #58a6ff;
	}

	.node-label {
		pointer-events: none;
		user-select: none;
	}

	.edge {
		transition: opacity 0.2s;
	}

	.node-details {
		position: absolute;
		bottom: 1rem;
		left: 1rem;
		background: rgba(33, 38, 45, 0.95);
		border: 1px solid #30363d;
		border-radius: 0.5rem;
		padding: 1rem;
		min-width: 200px;
		backdrop-filter: blur(8px);
		z-index: 10;
	}

	.node-details h4 {
		margin: 0 0 0.5rem;
		color: #f0f6fc;
		font-size: 1rem;
	}

	.node-details p {
		margin: 0.25rem 0;
		font-size: 0.8rem;
		color: #8b949e;
	}

	.close-details {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		background: none;
		border: none;
		color: #8b949e;
		font-size: 1.25rem;
		cursor: pointer;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.25rem;
	}

	.close-details:hover {
		background: #30363d;
		color: #e6edf3;
	}
</style>