import dotenv from 'dotenv';
dotenv.config();

async function testMLForecastingFlow() {
  console.log('--- Testing ML Demand Forecasting & Reorder Alerts Architecture ---');

  const GATEWAY_URL = 'http://localhost:3000';

  // 1. Train Model via API Gateway
  console.log('\n1. Calling POST /api/v1/analytics/train-model...');
  const trainRes = await fetch(`${GATEWAY_URL}/api/v1/analytics/train-model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (!trainRes.ok) {
    throw new Error(`train-model failed: ${trainRes.status} ${await trainRes.text()}`);
  }

  const trainData = await trainRes.json();
  console.log('✓ Training Response Success:', trainData.success);
  console.log('  Selected Best Model:', trainData.data.selectedModelName);
  console.log('  Model Type:', trainData.data.selectedModelType);
  console.log('  Validation Accuracy:', trainData.data.bestMetrics.accuracy + '%');
  console.log('  Validation MAPE:', trainData.data.bestMetrics.mape + '%');
  console.log('  Validation RMSE:', trainData.data.bestMetrics.rmse);
  console.log('  Candidate Models in Tournament:');
  trainData.data.comparison.forEach((c, idx) => {
    console.log(`    ${idx + 1}. [${c.isSelected ? 'WINNER' : 'CANDIDATE'}] ${c.name} -> MAPE: ${c.mape}%, RMSE: ${c.rmse}, Acc: ${c.accuracy}%`);
  });

  // Verify that a winner was selected
  const winner = trainData.data.comparison.find(c => c.isSelected);
  if (!winner) throw new Error('No winner was marked as selected in ML tournament comparison');

  // 2. Fetch Model Info via GET /api/v1/analytics/model-info
  console.log('\n2. Calling GET /api/v1/analytics/model-info...');
  const infoRes = await fetch(`${GATEWAY_URL}/api/v1/analytics/model-info`);
  if (!infoRes.ok) throw new Error(`model-info failed: ${infoRes.status}`);
  const infoData = await infoRes.json();
  console.log('✓ Model Info fetched:', infoData.data.selectedModelId, '| Trained at:', infoData.data.trainedAt);

  // 3. Generate Storewide Forecasts (7-Day Horizon)
  console.log('\n3. Calling POST /api/v1/analytics/generate-forecasts (Horizon: 7 Days)...');
  const forecastRes = await fetch(`${GATEWAY_URL}/api/v1/analytics/generate-forecasts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ horizonDays: 7 }),
  });
  if (!forecastRes.ok) throw new Error(`generate-forecasts failed: ${forecastRes.status}`);
  const forecastData = await forecastRes.json();
  console.log('✓ Forecasts generated successfully!');
  console.log('  Total Items Analyzed:', forecastData.data.summary.totalSkus);
  console.log('  Critical Stockout Risks:', forecastData.data.summary.criticalCount);
  console.log('  Stockouts (0 units):', forecastData.data.summary.stockoutCount);
  console.log('  Low Stock Warnings:', forecastData.data.summary.lowStockCount);
  console.log('  Healthy Stock Items:', forecastData.data.summary.normalCount);

  // 4. Inspect Forecasts for Key User Products
  console.log('\n4. Inspecting Forecasts for Specific Variants:');
  const targetSkus = [
    'AMUL-BTR-500G',
    'LUX-ROSE-100G',
    'BRIT-BREAD-LRG-500G',
    'COLG-TOOTH-200G',
    'HNC-SHAMP-200G',
    'TATA-SALT-500G',
    'MADHUR-SUGAR-2KG',
    'SURF-TOPLOAD-4KG'
  ];

  targetSkus.forEach(sku => {
    const item = forecastData.data.items.find(i => i.sku === sku);
    if (item) {
      console.log(`  * ${item.productName} (${item.variantName}) [${item.sku}]`);
      console.log(`      Stock: ${item.currentStock} units | Velocity: ${item.dailyVelocity}/day | 7D Forecast: ${item.forecastDemandUnits} units`);
      console.log(`      Days of Supply: ${item.daysOfSupply}d | Risk: ${item.riskLevel} | Reorder: +${item.recommendedReorderUnits} units`);
    } else {
      console.log(`  ! SKU not found in forecasts: ${sku}`);
    }
  });

  console.log('\n======================================================');
  console.log('🎉 ALL ML DEMAND FORECASTING & REORDER ALERT TESTS PASSED!');
  console.log('======================================================');
}

testMLForecastingFlow().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

