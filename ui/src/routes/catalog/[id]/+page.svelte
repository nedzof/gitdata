<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import InteractiveLineageGraph from '$lib/components/InteractiveLineageGraph.svelte';

	let asset = null;
	let lineageData = [];
	let loading = true;
	let error = null;

	$: assetId = $page.params.id;

	onMount(async () => {
		if (assetId) {
			await loadAssetDetails();
		}
	});

	async function loadAssetDetails() {
		try {
			loading = true;
			console.log('Loading asset details for ID:', assetId);

			// Load asset details from search endpoint and find matching asset
			const searchResponse = await api.request('/search?limit=100', {
				method: 'GET'
			});

			console.log('Search response:', searchResponse);

			// Find the asset with matching ID
			const assets = searchResponse.items || searchResponse || [];
			asset = assets.find(a =>
				a.versionId === assetId ||
				a.datasetId === assetId ||
				a.id === assetId
			);

			if (!asset) {
				throw new Error(`Asset with ID ${assetId} not found`);
			}

			console.log('Asset found:', asset);

			// Load lineage data
			await loadLineageData();
		} catch (err) {
			console.error('Error loading asset details:', err);
			error = err.message || 'Failed to load asset details';
		} finally {
			loading = false;
		}
	}

	async function loadLineageData() {
		try {
			console.log('Loading lineage data for asset:', asset.versionId);
			const response = await api.request(`/lineage?versionId=${asset.versionId}`, {
				method: 'GET'
			});

			console.log('Lineage response:', response);

			if (response && response.current) {
				// Transform the lineage data into the format expected by the component
				const nodes = [response.current];
				const edges = [];

				// Add upstream nodes and edges
				if (response.upstream) {
					nodes.push(...response.upstream);
					response.upstream.forEach(upstream => {
						edges.push({
							source_id: upstream.versionId,
							target_id: response.current.versionId,
							source_name: upstream.title,
							target_name: response.current.title,
							relationship_type: upstream.relationshipType || 'derived_from'
						});
					});
				}

				// Add downstream nodes and edges
				if (response.downstream) {
					nodes.push(...response.downstream);
					response.downstream.forEach(downstream => {
						edges.push({
							source_id: response.current.versionId,
							target_id: downstream.versionId,
							source_name: response.current.title,
							target_name: downstream.title,
							relationship_type: downstream.relationshipType || 'derived_from'
						});
					});
				}

				// Transform nodes to expected format
				lineageData = edges;
				console.log('Lineage data processed:', lineageData.length, 'edges');
			} else {
				lineageData = [];
			}
		} catch (err) {
			console.error('Error loading lineage data:', err);
			lineageData = [];
		}
	}

	function formatValue(value) {
		if (value === null || value === undefined) return 'N/A';
		if (typeof value === 'object') return JSON.stringify(value, null, 2);
		return value.toString();
	}

	function formatDate(dateString) {
		if (!dateString) return 'N/A';
		try {
			return new Date(dateString).toLocaleDateString();
		} catch {
			return dateString;
		}
	}
</script>

<svelte:head>
	<title>{asset?.title || 'Asset Details'} - Data Catalog</title>
</svelte:head>

<div class="asset-details">
	{#if loading}
		<div class="loading">
			<div class="spinner"></div>
			<p>Loading asset details...</p>
		</div>
	{:else if error}
		<div class="error">
			<h2>Error Loading Asset</h2>
			<p>{error}</p>
			<a href="/catalog" class="back-link">← Back to Catalog</a>
		</div>
	{:else if asset}
		<div class="header">
			<a href="/catalog" class="back-link">← Back to Catalog</a>
			<h1>{asset.title || 'Untitled Asset'}</h1>
			{#if asset.description}
				<p class="description">{asset.description}</p>
			{/if}
		</div>

		<div class="content-grid">
			<!-- Asset Information -->
			<div class="section">
				<h2>Asset Information</h2>
				<div class="info-grid">
					<div class="info-item">
						<label>Dataset ID</label>
						<span>{formatValue(asset.datasetId)}</span>
					</div>
					<div class="info-item">
						<label>Version ID</label>
						<span class="monospace">{formatValue(asset.versionId)}</span>
					</div>
					<div class="info-item">
						<label>Producer</label>
						<span>{formatValue(asset.producer)}</span>
					</div>
					<div class="info-item">
						<label>Type</label>
						<span>{formatValue(asset.type)}</span>
					</div>
					<div class="info-item">
						<label>Format</label>
						<span>{formatValue(asset.format)}</span>
					</div>
					<div class="info-item">
						<label>Size</label>
						<span>{formatValue(asset.size)}</span>
					</div>
					<div class="info-item">
						<label>Created</label>
						<span>{formatDate(asset.createdAt)}</span>
					</div>
					<div class="info-item">
						<label>Content Hash</label>
						<span class="monospace">{formatValue(asset.contentHash)}</span>
					</div>
				</div>
			</div>

			<!-- Classification & Security -->
			<div class="section">
				<h2>Classification & Security</h2>
				<div class="info-grid">
					<div class="info-item">
						<label>Classification</label>
						<span class="classification {asset.classification?.toLowerCase()}">{formatValue(asset.classification)}</span>
					</div>
					<div class="info-item">
						<label>License</label>
						<span>{formatValue(asset.license)}</span>
					</div>
					<div class="info-item">
						<label>Access Level</label>
						<span>{formatValue(asset.access_level)}</span>
					</div>
					<div class="info-item">
						<label>Encryption</label>
						<span>{formatValue(asset.encryption_status)}</span>
					</div>
				</div>
			</div>

			<!-- Technical Details -->
			<div class="section">
				<h2>Technical Details</h2>
				<div class="info-grid">
					<div class="info-item">
						<label>Schema Version</label>
						<span>{formatValue(asset.schema_version)}</span>
					</div>
					<div class="info-item">
						<label>Checksum</label>
						<span class="monospace">{formatValue(asset.checksum)}</span>
					</div>
					<div class="info-item">
						<label>Compression</label>
						<span>{formatValue(asset.compression_type)}</span>
					</div>
					<div class="info-item">
						<label>Location</label>
						<span class="monospace">{formatValue(asset.storage_location)}</span>
					</div>
					<div class="info-item">
						<label>MIME Type</label>
						<span>{formatValue(asset.mime_type)}</span>
					</div>
					<div class="info-item">
						<label>Quality Score</label>
						<span>{formatValue(asset.quality_score)}</span>
					</div>
					<div class="info-item">
						<label>Confirmations</label>
						<span>{formatValue(asset.confirmations)}</span>
					</div>
					<div class="info-item">
						<label>Content Hash</label>
						<span class="monospace">{formatValue(asset.content_hash)}</span>
					</div>
				</div>
			</div>

			<!-- Economic & Policy Information -->
			<div class="section">
				<h2>Economic & Policy Information</h2>
				<div class="info-grid">
					<div class="info-item">
						<label>Price per Byte</label>
						<span>{asset.price_per_byte ? `${asset.price_per_byte} units` : 'N/A'}</span>
					</div>
					<div class="info-item">
						<label>PII Flags</label>
						<span class="pii-flags">{asset.pii_flags ? asset.pii_flags.join(', ') : 'None'}</span>
					</div>
					<div class="info-item">
						<label>Geographic Origin</label>
						<span>{formatValue(asset.geographic_origin)}</span>
					</div>
					<div class="info-item">
						<label>Content Tags</label>
						<span class="content-tags">{asset.tags ? asset.tags.join(', ') : 'None'}</span>
					</div>
					<div class="info-item">
						<label>Regulatory Compliance</label>
						<span>{formatValue(asset.regulatory_compliance)}</span>
					</div>
					<div class="info-item">
						<label>Data Sovereignty</label>
						<span>{formatValue(asset.data_sovereignty)}</span>
					</div>
				</div>
			</div>

			<!-- Usage & Performance Metrics -->
			{#if asset.usage_metrics || asset.performance_metrics}
			<div class="section">
				<h2>Usage & Performance Metrics</h2>
				<div class="info-grid">
					{#if asset.usage_metrics}
						<div class="info-item">
							<label>Downloads</label>
							<span>{formatValue(asset.usage_metrics.downloads)}</span>
						</div>
						<div class="info-item">
							<label>Views</label>
							<span>{formatValue(asset.usage_metrics.views)}</span>
						</div>
					{/if}
					{#if asset.performance_metrics}
						<div class="info-item">
							<label>Avg Response Time</label>
							<span>{asset.performance_metrics.avg_response_time || 'N/A'}</span>
						</div>
						<div class="info-item">
							<label>Availability</label>
							<span>{asset.performance_metrics.availability || 'N/A'}</span>
						</div>
					{/if}
				</div>
			</div>
			{/if}

			<!-- Lineage Visualization -->
			<div class="section lineage-section">
				<h2>Data Lineage</h2>
				<div class="lineage-container">
					<InteractiveLineageGraph
						{lineageData}
						currentAssetId={assetId}
					/>
				</div>
			</div>
		</div>
	{:else}
		<div class="error">
			<h2>Asset Not Found</h2>
			<p>The requested asset could not be found.</p>
			<a href="/catalog" class="back-link">← Back to Catalog</a>
		</div>
	{/if}
</div>

<style>
	.asset-details {
		min-height: 100vh;
		background: #0d1117;
		color: #e6edf3;
		padding: 2rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 50vh;
		gap: 1rem;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid #21262d;
		border-top: 2px solid #2f81f7;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.error {
		text-align: center;
		padding: 3rem;
		border: 1px solid #f85149;
		border-radius: 0.5rem;
		background: #161b22;
		max-width: 600px;
		margin: 2rem auto;
	}

	.error h2 {
		color: #f85149;
		margin-bottom: 1rem;
	}

	.header {
		max-width: 1200px;
		margin: 0 auto 2rem;
	}

	.back-link {
		color: #79c0ff;
		text-decoration: none;
		font-size: 0.9rem;
		margin-bottom: 1rem;
		display: inline-block;
		transition: color 0.2s;
	}

	.back-link:hover {
		color: #58a6ff;
		text-decoration: underline;
	}

	.header h1 {
		font-size: 2.5rem;
		font-weight: 600;
		margin: 1rem 0;
		color: #f0f6fc;
	}

	.description {
		font-size: 1.1rem;
		color: #8b949e;
		line-height: 1.6;
		margin-bottom: 1rem;
	}

	.content-grid {
		max-width: 1200px;
		margin: 0 auto;
		display: grid;
		gap: 2rem;
		grid-template-columns: 1fr;
	}

	.section {
		background: #161b22;
		border: 1px solid #21262d;
		border-radius: 0.5rem;
		padding: 1.5rem;
	}

	.section h2 {
		font-size: 1.25rem;
		font-weight: 600;
		margin-bottom: 1rem;
		color: #f0f6fc;
		border-bottom: 1px solid #21262d;
		padding-bottom: 0.5rem;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-item label {
		font-size: 0.85rem;
		font-weight: 600;
		color: #8b949e;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.info-item span {
		font-size: 0.95rem;
		color: #e6edf3;
		word-break: break-word;
	}

	.monospace {
		font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
		font-size: 0.85rem;
		background: #0d1117;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		border: 1px solid #21262d;
	}

	.classification {
		padding: 0.25rem 0.75rem;
		border-radius: 1rem;
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.classification.public {
		background: #238636;
		color: #fff;
	}

	.classification.internal {
		background: #f0883e;
		color: #fff;
	}

	.classification.confidential {
		background: #f85149;
		color: #fff;
	}

	.classification.restricted {
		background: #8b949e;
		color: #fff;
	}

	.pii-flags {
		color: #f85149;
		font-weight: 500;
	}

	.content-tags {
		color: #79c0ff;
		font-weight: 500;
	}

	.lineage-section {
		grid-column: 1 / -1;
	}

	.lineage-container {
		min-height: 400px;
	}

	.lineage-graph {
		width: 100%;
		height: 400px;
		border: 1px solid #21262d;
		border-radius: 0.5rem;
		background: #0d1117;
		position: relative;
		overflow: hidden;
	}

	.no-lineage {
		text-align: center;
		color: #8b949e;
		font-style: italic;
		padding: 2rem;
	}

	@media (min-width: 768px) {
		.content-grid {
			grid-template-columns: 1fr 1fr;
		}

		.section:nth-child(4) {
			grid-column: 1 / -1;
		}
	}

	@media (min-width: 1024px) {
		.asset-details {
			padding: 3rem;
		}
	}
</style>