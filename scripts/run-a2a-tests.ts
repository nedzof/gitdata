#!/usr/bin/env npx tsx
/**
 * D16 A2A Test Runner Script
 *
 * Automated test execution and report generation for D16 A2A Demo
 * Implements all requirements from notes/d16.txt and issues/D16-a2a-demo.md
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { A2AE2ETest } from '../test/integration/a2a-e2e.spec';

interface TestResults {
  timestamp: string;
  environment: {
    nodeVersion: string;
    overlayPort: string;
    agentWebhookPort: string;
  };
  tests: {
    unitTests: { passed: boolean; output: string };
    integrationTests: { passed: boolean; output: string };
    e2eTests: { passed: boolean; output: string; evidenceDir?: string };
  };
  artifacts: {
    postmanCollection: boolean;
    evidenceDirectory: boolean;
    summaryReport: boolean;
  };
  summary: {
    overallSuccess: boolean;
    totalErrors: number;
    recommendations: string[];
  };
}

class A2ATestRunner {
  private results: TestResults;
  private outputDir: string;

  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        overlayPort: process.env.OVERLAY_PORT || '3030',
        agentWebhookPort: '9099'
      },
      tests: {
        unitTests: { passed: false, output: '' },
        integrationTests: { passed: false, output: '' },
        e2eTests: { passed: false, output: '' }
      },
      artifacts: {
        postmanCollection: false,
        evidenceDirectory: false,
        summaryReport: false
      },
      summary: {
        overallSuccess: false,
        totalErrors: 0,
        recommendations: []
      }
    };

    this.outputDir = path.join(process.cwd(), 'test-results', `a2a-${Date.now()}`);
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  async runCommand(command: string, description: string): Promise<{ success: boolean; output: string }> {
    console.log(`🔄 ${description}...`);
    try {
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: 30000,
        cwd: process.cwd()
      });
      console.log(`✅ ${description} completed`);
      return { success: true, output };
    } catch (error: any) {
      console.error(`❌ ${description} failed:`, error.message);
      return { success: false, output: error.message };
    }
  }

  async checkPrerequisites(): Promise<boolean> {
    console.log('🔍 Checking prerequisites...');

    const checks = [
      {
        name: 'TypeScript installation',
        command: 'npx tsc --version'
      },
      {
        name: 'Database schema file',
        check: () => fs.existsSync('./src/db/schema.sql')
      },
      {
        name: 'A2A routes',
        check: () => fs.existsSync('./src/routes/agents.ts') &&
                     fs.existsSync('./src/routes/rules.ts') &&
                     fs.existsSync('./src/routes/jobs.ts')
      },
      {
        name: 'BRC-31 signer',
        check: () => fs.existsSync('./src/brc31/signer.ts')
      },
      {
        name: 'Job processor',
        check: () => fs.existsSync('./src/worker/job-processor.ts')
      },
      {
        name: 'Example agent webhook',
        check: () => fs.existsSync('./examples/agent-webhook.ts')
      }
    ];

    let allPassed = true;

    for (const check of checks) {
      if ('command' in check) {
        const result = await this.runCommand(check.command, `Checking ${check.name}`);
        if (!result.success) {
          allPassed = false;
          this.results.summary.recommendations.push(`Install or fix: ${check.name}`);
        }
      } else if ('check' in check) {
        const passed = check.check();
        if (passed) {
          console.log(`✅ ${check.name} - OK`);
        } else {
          console.log(`❌ ${check.name} - Missing`);
          allPassed = false;
          this.results.summary.recommendations.push(`Create missing file for: ${check.name}`);
        }
      }
    }

    return allPassed;
  }

  async runUnitTests(): Promise<boolean> {
    console.log('🧪 Running unit tests...');

    // Check if we have a test script in package.json
    let testCommand = 'npx tsx test/integration/metrics.spec.ts';

    try {
      const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
      if (packageJson.scripts && packageJson.scripts.test) {
        testCommand = 'npm test';
      }
    } catch {
      // Use default command
    }

    const result = await this.runCommand(testCommand, 'Unit tests execution');
    this.results.tests.unitTests = result;

    return result.success;
  }

  async runIntegrationTests(): Promise<boolean> {
    console.log('🔬 Running integration tests...');

    const result = await this.runCommand(
      'npx tsx test/integration/metrics.spec.ts',
      'Integration tests execution'
    );

    this.results.tests.integrationTests = result;
    return result.success;
  }

  async runE2ETests(): Promise<boolean> {
    console.log('🎭 Running end-to-end A2A tests...');

    try {
      const e2eTest = new A2AE2ETest();
      await e2eTest.runFullE2ETest();

      this.results.tests.e2eTests = {
        passed: true,
        output: 'E2E test completed successfully with evidence collection'
      };

      // Check for evidence directory in temp
      const tempDirs = fs.readdirSync('/tmp').filter(dir => dir.startsWith('a2a-demo-evidence-'));
      if (tempDirs.length > 0) {
        const evidenceDir = path.join('/tmp', tempDirs[tempDirs.length - 1]);
        this.results.tests.e2eTests.evidenceDir = evidenceDir;
        this.results.artifacts.evidenceDirectory = true;

        // Copy evidence to output directory
        const outputEvidenceDir = path.join(this.outputDir, 'a2a-demo-evidence');
        execSync(`cp -r "${evidenceDir}" "${outputEvidenceDir}"`);
        console.log(`📁 Evidence copied to: ${outputEvidenceDir}`);
      }

      return true;
    } catch (error) {
      this.results.tests.e2eTests = {
        passed: false,
        output: `E2E test failed: ${error}`
      };
      this.results.summary.totalErrors++;
      return false;
    }
  }

  async checkArtifacts(): Promise<void> {
    console.log('📦 Checking required artifacts...');

    // Check Postman collection
    const postmanFiles = [
      './postman/a2a_demo_collection.json',
      './postman/gitdata_api_collection_with_tests.json'
    ];

    for (const file of postmanFiles) {
      if (fs.existsSync(file)) {
        this.results.artifacts.postmanCollection = true;
        console.log(`✅ Found Postman collection: ${file}`);
        break;
      }
    }

    // Check for A2A demo script
    if (fs.existsSync('./examples/a2a-demo.ts')) {
      console.log('✅ Found A2A demo script');
    } else {
      this.results.summary.recommendations.push('Create A2A demo script');
    }

    // Evidence directory already checked in E2E tests

    this.results.artifacts.summaryReport = true; // This script generates it
  }

  async generateFinalReport(): Promise<void> {
    console.log('📊 Generating final test report...');

    const reportContent = `# D16 A2A Test Report

## Test Execution Summary
**Timestamp:** ${this.results.timestamp}
**Node Version:** ${this.results.environment.nodeVersion}
**Overlay Port:** ${this.results.environment.overlayPort}

## Test Results

### Unit Tests
- **Status:** ${this.results.tests.unitTests.passed ? '✅ PASSED' : '❌ FAILED'}
- **Output:** ${this.results.tests.unitTests.output}

### Integration Tests
- **Status:** ${this.results.tests.integrationTests.passed ? '✅ PASSED' : '❌ FAILED'}
- **Output:** ${this.results.tests.integrationTests.output}

### End-to-End Tests
- **Status:** ${this.results.tests.e2eTests.passed ? '✅ PASSED' : '❌ FAILED'}
- **Output:** ${this.results.tests.e2eTests.output}
${this.results.tests.e2eTests.evidenceDir ? `- **Evidence Directory:** ${this.results.tests.e2eTests.evidenceDir}` : ''}

## Artifacts Status

### Required Artifacts (D16 Section 9)
- **Postman Collection:** ${this.results.artifacts.postmanCollection ? '✅ Present' : '❌ Missing'}
- **Evidence Directory:** ${this.results.artifacts.evidenceDirectory ? '✅ Generated' : '❌ Missing'}
- **Summary Report:** ${this.results.artifacts.summaryReport ? '✅ Generated' : '❌ Missing'}

## D16 Definition of Done (DoD) Compliance

### E2E-Minimal Requirements
- **Agents registered and discoverable:** ${this.results.tests.e2eTests.passed ? '✅' : '❌'}
- **Rules executed successfully:** ${this.results.tests.e2eTests.passed ? '✅' : '❌'}
- **Jobs state transitions working:** ${this.results.tests.e2eTests.passed ? '✅' : '❌'}
- **BRC-31 signed webhook evidence:** ${this.results.tests.e2eTests.passed ? '✅' : '❌'}

### Acceptance Criteria Met
- **Agent registry/discovery:** ${this.results.tests.e2eTests.passed ? '✅' : '❌'}
- **Rule CRUD and triggering:** ${this.results.tests.e2eTests.passed ? '✅' : '❌'}
- **Job queue processing:** ${this.results.tests.e2eTests.passed ? '✅' : '❌'}
- **Evidence collection:** ${this.results.artifacts.evidenceDirectory ? '✅' : '❌'}

## Overall Status
**${this.results.summary.overallSuccess ? '🎉 SUCCESS' : '❌ FAILURE'}**

${this.results.summary.totalErrors > 0 ? `\n## Errors Found: ${this.results.summary.totalErrors}` : ''}

${this.results.summary.recommendations.length > 0 ? `\n## Recommendations\n${this.results.summary.recommendations.map(r => `- ${r}`).join('\n')}` : ''}

## Generated Files
- Test results: ${this.outputDir}
${this.results.artifacts.evidenceDirectory ? '- A2A evidence: a2a-demo-evidence/' : ''}
- This report: ${path.join(this.outputDir, 'test-report.md')}

---
Generated by D16 A2A Test Runner
`;

    fs.writeFileSync(path.join(this.outputDir, 'test-report.md'), reportContent);
    fs.writeFileSync(path.join(this.outputDir, 'results.json'), JSON.stringify(this.results, null, 2));

    console.log(`📄 Final report saved: ${path.join(this.outputDir, 'test-report.md')}`);
  }

  async run(): Promise<boolean> {
    console.log('🚀 Starting D16 A2A comprehensive test suite...');
    console.log(`📁 Output directory: ${this.outputDir}`);

    try {
      // Check prerequisites
      const prereqsOk = await this.checkPrerequisites();
      if (!prereqsOk) {
        console.log('❌ Prerequisites not met, continuing with available tests...');
      }

      // Run test suites
      const unitTestsOk = await this.runUnitTests();
      const integrationTestsOk = await this.runIntegrationTests();
      const e2eTestsOk = await this.runE2ETests();

      // Check artifacts
      await this.checkArtifacts();

      // Determine overall success
      this.results.summary.overallSuccess = unitTestsOk && integrationTestsOk && e2eTestsOk;

      if (!this.results.summary.overallSuccess) {
        this.results.summary.totalErrors = [unitTestsOk, integrationTestsOk, e2eTestsOk]
          .filter(test => !test).length;
      }

      // Generate final report
      await this.generateFinalReport();

      if (this.results.summary.overallSuccess) {
        console.log('🎉 All D16 A2A tests completed successfully!');
        console.log('✅ Definition of Done (DoD) requirements met');
        console.log('✅ Evidence and artifacts generated');
      } else {
        console.log('❌ Some tests failed or requirements not met');
        console.log(`📊 Check detailed report: ${path.join(this.outputDir, 'test-report.md')}`);
      }

      return this.results.summary.overallSuccess;

    } catch (error) {
      console.error('💥 Test runner encountered an error:', error);
      this.results.summary.totalErrors++;
      this.results.summary.overallSuccess = false;
      await this.generateFinalReport();
      return false;
    }
  }
}

// If running directly, execute the test runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new A2ATestRunner();
  runner.run()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { A2ATestRunner };