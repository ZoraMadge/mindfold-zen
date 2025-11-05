const fs = require('fs');
const path = require('path');

// Read deployment file
const deploymentPath = path.join(__dirname, '..', 'deployments', 'localhost', 'MindfoldZen.json');
const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));

// Generate TypeScript file
const abiCode = `/*
  Contract ABI for MindfoldZen
  Auto-generated from deployment artifacts
  Updated: ${new Date().toISOString()}
*/
export const MindfoldZenABI = {
  abi: ${JSON.stringify(deployment.abi, null, 2)}
} as const;
`;

// Write to UI directory
const outputPath = path.join(__dirname, '..', 'ui', 'src', 'abi', 'MindfoldZenABI.ts');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, abiCode, 'utf8');

console.log('✅ MindfoldZenABI.ts generated successfully');
console.log(`   Output: ${outputPath}`);

