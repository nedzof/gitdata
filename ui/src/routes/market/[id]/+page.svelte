<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { api } from '$lib/api';
	import InteractiveLineageGraph from '$lib/components/InteractiveLineageGraph.svelte';
	import { AuthFetch } from '@bsv/sdk';

	let asset = null;
	let lineageData = [];
	let loading = true;
	let error = null;
	let policyCompliance = null;
	let selectedPolicy = null;
	let authFetch;

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

			// Evaluate policy compliance
			await evaluatePolicyCompliance();
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

	async function evaluatePolicyCompliance() {
		if (!asset) return;

		// Define actual policies with their requirements
		const policies = [
			{
				name: 'Data Classification Policy',
				description: 'Ensures proper data classification',
				checks: [
					{ rule: 'Classification Required', matches: !!asset.classification },
					{ rule: 'Public Classification Safe', matches: asset.classification?.toLowerCase() === 'public' }
				]
			},
			{
				name: 'Security Compliance Policy',
				description: 'Validates security requirements',
				checks: [
					{ rule: 'No PII Detected', matches: !asset.pii_flags?.length },
					{ rule: 'Access Level Defined', matches: !!asset.access_level },
					{ rule: 'License Specified', matches: !!asset.license }
				]
			},
			{
				name: 'Data Quality Standards',
				description: 'Ensures minimum quality thresholds',
				checks: [
					{ rule: 'Quality Score ≥ 60%', matches: asset.quality_score >= 0.6 },
					{ rule: 'Content Hash Present', matches: !!(asset.contentHash || asset.content_hash) },
					{ rule: 'Format Specified', matches: !!asset.format }
				]
			},
			{
				name: 'Provenance Policy',
				description: 'Validates data origin and tracking',
				checks: [
					{ rule: 'Producer Identified', matches: !!asset.producer },
					{ rule: 'Confirmations ≥ 1', matches: asset.confirmations >= 1 },
					{ rule: 'Creation Date Present', matches: !!asset.createdAt }
				]
			}
		];

		// Evaluate each policy
		const evaluatedPolicies = policies.map(policy => {
			const passingChecks = policy.checks.filter(c => c.matches);
			const totalChecks = policy.checks.length;
			const status = passingChecks.length === totalChecks ? 'compliant' :
						  passingChecks.length > 0 ? 'partial' : 'non-compliant';

			return {
				...policy,
				status,
				passingChecks: passingChecks.length,
				totalChecks
			};
		});

		// Create flat list for display
		const allChecks = [];
		evaluatedPolicies.forEach(policy => {
			policy.checks.forEach(check => {
				allChecks.push({
					name: `${policy.name}: ${check.rule}`,
					matches: check.matches,
					policyName: policy.name,
					policyStatus: policy.status
				});
			});
		});

		policyCompliance = {
			policies: evaluatedPolicies,
			checks: allChecks,
			matching: allChecks.filter(c => c.matches).length,
			total: allChecks.length,
			compliantPolicies: evaluatedPolicies.filter(p => p.status === 'compliant').length,
			totalPolicies: evaluatedPolicies.length
		};

		// Auto-select first policy
		if (evaluatedPolicies.length > 0) {
			selectedPolicy = evaluatedPolicies[0];
		}
	}

	function selectPolicy(policy) {
		selectedPolicy = policy;
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

	// Handle purchase functionality
	async function handlePurchase(asset) {
		console.log('Purchase initiated for asset:', asset);

		if (!asset.pricePerKB || asset.pricePerKB === 0) {
			// Free asset - just grant access
			alert(`Free access granted for ${asset.title || asset.datasetId}`);
			return;
		}

		try {
			// Import wallet service
			const { walletService, generateAuthHeaders } = await import('$lib/wallet');

			// Check if wallet is connected
			if (!walletService.isConnected()) {
				const connectConfirmed = confirm('You need to connect your wallet to make a purchase. Connect now?');
				if (connectConfirmed) {
					await walletService.connect();
				} else {
					return;
				}
			}

			// Calculate total price in satoshis
			const priceInUSD = asset.pricePerKB * (asset.dataSizeBytes / 1024); // Total price in USD
			const satoshisPerUSD = 100000; // Example conversion rate - should be fetched from API
			const totalSatoshis = Math.floor(priceInUSD * satoshisPerUSD);

			// Show confirmation dialog
			const confirmed = confirm(
				`Confirm D06 BSV Payment:\n\n` +
				`Asset: ${asset.title || asset.datasetId}\n` +
				`Price: $${asset.pricePerKB.toFixed(3)}/KB\n` +
				`Size: ${(asset.dataSizeBytes / 1024 / 1024).toFixed(2)} MB\n` +
				`Total: $${priceInUSD.toFixed(4)} (${totalSatoshis} satoshis)\n\n` +
				`Process payment via D06 Payment API?`
			);

			if (!confirmed) {
				return;
			}

			// Generate authentication headers
			const paymentRequest = {
				versionId: asset.versionId || asset.datasetId || asset.id,
				quantity: 1,
				paymentMethod: 'bsv'
			};

			const authHeaders = await generateAuthHeaders(JSON.stringify(paymentRequest));

			// Process payment via D06 API
			console.log('Processing D06 payment:', paymentRequest);
			const paymentResult = await api.processPayment(paymentRequest, authHeaders);

			if (paymentResult.success) {
				alert(`Payment successful!\n\nReceipt ID: ${paymentResult.receiptId}\nTotal: ${paymentResult.totalSatoshis} satoshis\n\nYour purchase has been processed via the D06 payment system.`);

				// Optionally redirect to receipt details or refresh the page
				console.log('Payment result:', paymentResult);
			} else {
				alert(`Payment failed: ${paymentResult.reason || 'Unknown error'}`);
			}

		} catch (error) {
			console.error('Payment error:', error);

			if (error.message.includes('unauthorized')) {
				alert(`Payment failed: Authentication required. Please ensure your wallet is connected and properly authenticated.`);
			} else if (error.message.includes('signature-invalid')) {
				alert(`Payment failed: Invalid signature. Please try reconnecting your wallet.`);
			} else {
				alert(`Payment failed: ${(error as Error).message}`);
			}
		}
	}
</script>

<svelte:head>
	<title>{asset?.title || 'Asset Details'} - Market</title>
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
			<a href="/market" class="back-link">← Back to Market</a>
		</div>
	{:else if asset}
		<div class="header">
			<a href="/market" class="back-link">← Back to Market</a>
			<div class="title-section">
				<h1>{asset.title || 'Untitled Asset'}</h1>
				<div class="title-badges">
					{#if policyCompliance}
						<div class="compliance-badge">
							{policyCompliance.compliantPolicies}/{policyCompliance.totalPolicies} Policies Compliant
						</div>
					{/if}
					<button
						class="buy-btn-detail"
						on:click={() => handlePurchase(asset)}
					>
						{asset.pricePerKB ? `💳 Buy - $${asset.pricePerKB.toFixed(3)}/KB` : '💾 Get Free'}
					</button>
				</div>
			</div>
			{#if asset.description}
				<p class="description">{asset.description}</p>
			{/if}
		</div>

		<div class="content-grid">
			<!-- Policy Status -->
			{#if policyCompliance}
			<div class="section policy-section">
				<h2>Policy Compliance</h2>

				<!-- Policy Selector -->
				<div class="policy-selector">
					{#each policyCompliance.policies as policy}
						<button
							class="policy-tab {policy === selectedPolicy ? 'active' : ''} policy-{policy.status}"
							on:click={() => selectPolicy(policy)}
						>
							<span class="policy-name">{policy.name}</span>
							<span class="policy-status-indicator">
								{#if policy.status === 'compliant'}✓
								{:else if policy.status === 'partial'}⚠
								{:else}✗{/if}
							</span>
						</button>
					{/each}
				</div>

				<!-- Selected Policy Results -->
				{#if selectedPolicy}
				<div class="policy-columns">
					<div class="policy-column matches">
						<h3>✓ Matches</h3>
						<div class="policy-list">
							{#each selectedPolicy.checks.filter(c => c.matches) as check}
								<div class="check-item match">
									{check.rule}
								</div>
							{/each}
						</div>
					</div>
					<div class="policy-column mismatches">
						<h3>✗ Mismatches</h3>
						<div class="policy-list">
							{#each selectedPolicy.checks.filter(c => !c.matches) as check}
								<div class="check-item mismatch">
									{check.rule}
								</div>
							{/each}
						</div>
					</div>
				</div>
				{/if}
			</div>
			{/if}

			<!-- Asset Overview -->
			<div class="section">
				<h2>Asset Overview</h2>
				<div class="asset-summary">
					<span><strong>Producer:</strong> {formatValue(asset.producer)}</span>
					<span><strong>Type:</strong> {formatValue(asset.type)} ({formatValue(asset.format)})</span>
					<span><strong>Quality:</strong>
						<span class="quality-score score-{asset.quality_score >= 0.8 ? 'high' : asset.quality_score >= 0.6 ? 'medium' : 'low'}">
							{asset.quality_score ? (asset.quality_score * 100).toFixed(1) + '%' : 'N/A'}
						</span>
					</span>
				</div>
			</div>

			<!-- Data Lineage -->
			<div class="section lineage-section">
				<h2>Data Lineage</h2>
				<div class="lineage-container">
					{#if lineageData.length > 0}
						<InteractiveLineageGraph
							{lineageData}
							currentAssetId={assetId}
						/>
					{:else}
						<div class="no-lineage">
							<p>No lineage data available for this asset.</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div class="error">
			<h2>Asset Not Found</h2>
			<p>The requested asset could not be found.</p>
			<a href="/market" class="back-link">← Back to Market</a>
		</div>
	{/if}
</div>

<style>
	/* Base styling */
	.asset-details {
		min-height: 100vh;
		background: #0d1117;
		color: #e6edf3;
		padding: 1.5rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
		line-height: 1.5;
	}

	/* Loading states */
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
		border-radius: 0.75rem;
		background: #161b22;
		max-width: 600px;
		margin: 2rem auto;
	}

	.error h2 {
		color: #f85149;
		margin-bottom: 1rem;
	}

	/* Header section */
	.header {
		max-width: 1200px;
		margin: 0 auto 2rem;
	}

	.back-link {
		color: #79c0ff;
		text-decoration: none;
		font-size: 0.9rem;
		margin-bottom: 1.5rem;
		display: inline-block;
		transition: all 0.2s ease;
		padding: 0.5rem 0;
	}

	.back-link:hover {
		color: #58a6ff;
		text-decoration: underline;
	}

	.title-section {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.title-badges {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.header h1 {
		font-size: 2rem;
		font-weight: 600;
		margin: 0;
		color: #f0f6fc;
		line-height: 1.2;
	}

	.compliance-badge {
		padding: 0.5rem 1rem;
		border-radius: 1.5rem;
		font-size: 0.9rem;
		font-weight: 600;
		background: rgba(56, 139, 253, 0.15);
		color: #58a6ff;
		border: 1px solid #58a6ff;
	}

	.buy-btn-detail {
		background: #238636;
		border: 1px solid #238636;
		color: #ffffff;
		padding: 0.75rem 1.5rem;
		border-radius: 1.5rem;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		white-space: nowrap;
	}

	.buy-btn-detail:hover {
		background: #2ea043;
		border-color: #2ea043;
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(35, 134, 54, 0.3);
	}

	.description {
		font-size: 1.1rem;
		color: #8b949e;
		line-height: 1.6;
		margin: 0;
	}

	/* Grid layout */
	.content-grid {
		max-width: 1200px;
		margin: 0 auto;
		display: grid;
		gap: 1.5rem;
		grid-template-columns: 1fr;
	}

	/* Section styling */
	.section {
		background: #161b22;
		border: 1px solid #21262d;
		border-radius: 0.75rem;
		padding: 1.5rem;
	}

	.section h2 {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
		color: #f0f6fc;
		border-bottom: 1px solid #21262d;
		padding-bottom: 0.75rem;
	}

	/* Policy checks - left/right columns */
	.policy-section {
		grid-column: 1 / -1;
	}

	/* Policy Selector */
	.policy-selector {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 2rem;
	}

	.policy-tab {
		background: #21262d;
		border: 1px solid #30363d;
		color: #e6edf3;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		transition: all 0.2s ease;
	}

	.policy-tab:hover {
		background: #30363d;
		border-color: #444c56;
	}

	.policy-tab.active {
		background: #238636;
		border-color: #238636;
		color: #fff;
	}

	.policy-tab.policy-partial.active {
		background: #bb800a;
		border-color: #bb800a;
	}

	.policy-tab.policy-non-compliant.active {
		background: #da3633;
		border-color: #da3633;
	}

	.policy-name {
		font-weight: 500;
	}

	.policy-status-indicator {
		font-weight: 600;
		font-size: 0.9rem;
	}

	.policy-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
	}

	.policy-column h3 {
		font-size: 0.9rem;
		font-weight: 600;
		margin: 0 0 1.5rem 0;
		padding: 0.5rem 1rem;
		border-radius: 0.375rem;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.matches h3 {
		background: #238636;
		color: #fff;
	}

	.mismatches h3 {
		background: #da3633;
		color: #fff;
	}

	.policy-list {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.check-item {
		padding: 0.625rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		border: none;
		transition: all 0.2s ease;
	}

	.check-item.match {
		background: rgba(35, 134, 54, 0.08);
		color: #3fb950;
	}

	.check-item.match:hover {
		background: rgba(35, 134, 54, 0.12);
	}

	.check-item.mismatch {
		background: rgba(248, 81, 73, 0.08);
		color: #f85149;
	}

	.check-item.mismatch:hover {
		background: rgba(248, 81, 73, 0.12);
	}

	/* Asset summary - compact */
	.asset-summary {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		font-size: 0.95rem;
	}

	.asset-summary span {
		color: #e6edf3;
	}

	.asset-summary strong {
		color: #8b949e;
		font-weight: 600;
	}

	/* Special value styling */
	.classification {
		padding: 0.25rem 0.75rem;
		border-radius: 1rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		border: 1px solid;
		display: inline-flex;
		align-items: center;
	}

	.classification.public {
		background: rgba(35, 134, 54, 0.15);
		color: #3fb950;
		border-color: #3fb950;
	}

	.classification.internal {
		background: rgba(240, 136, 62, 0.15);
		color: #f0883e;
		border-color: #f0883e;
	}

	.classification.confidential {
		background: rgba(248, 81, 73, 0.15);
		color: #f85149;
		border-color: #f85149;
	}

	.classification.restricted {
		background: rgba(139, 148, 158, 0.15);
		color: #8b949e;
		border-color: #8b949e;
	}

	.quality-score {
		padding: 0.25rem 0.75rem;
		border-radius: 1rem;
		font-weight: 600;
		font-size: 0.85rem;
		display: inline-flex;
		align-items: center;
	}

	.score-high {
		background: rgba(35, 134, 54, 0.15);
		color: #3fb950;
	}

	.score-medium {
		background: rgba(187, 128, 9, 0.15);
		color: #d29922;
	}

	.score-low {
		background: rgba(248, 81, 73, 0.15);
		color: #f85149;
	}

	/* Lineage section */
	.lineage-section {
		grid-column: 1 / -1;
	}

	.lineage-container {
		min-height: 600px;
		height: 80vh;
	}

	.no-lineage {
		text-align: center;
		color: #8b949e;
		font-style: italic;
		padding: 3rem;
		background: rgba(33, 38, 45, 0.3);
		border-radius: 0.5rem;
		border: 1px dashed #21262d;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.asset-details {
			padding: 1rem;
		}

		.header h1 {
			font-size: 1.5rem;
		}

		.title-section {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
		}

		.title-badges {
			width: 100%;
			justify-content: flex-start;
		}

		.buy-btn-detail {
			font-size: 0.85rem;
			padding: 0.6rem 1.2rem;
		}

		.policy-columns {
			grid-template-columns: 1fr;
			gap: 1rem;
		}
	}

	@media (min-width: 768px) {
		.content-grid {
			grid-template-columns: 1fr 1fr;
		}

		.policy-section {
			grid-column: 1 / -1;
		}

		.lineage-section {
			grid-column: 1 / -1;
		}
	}

	@media (min-width: 1024px) {
		.asset-details {
			padding: 2rem;
		}
	}
</style>