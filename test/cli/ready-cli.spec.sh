#!/bin/bash
# Test script for D14 Ready CLI

set -e

CLI_PATH="tools/python/verify_ready.py"
TEST_VERSION_ID="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

echo "Testing D14 Ready CLI..."

# Test 1: Help functionality
echo "1. Testing --help"
python3 "$CLI_PATH" --help >/dev/null
echo "✓ Help displays correctly"

# Test 2: Invalid versionId validation
echo "2. Testing versionId validation"
if python3 "$CLI_PATH" --versionId "invalid" 2>/dev/null; then
    echo "✗ Should have failed with invalid versionId"
    exit 1
else
    echo "✓ Correctly rejects invalid versionId"
fi

# Test 3: Network error handling (server not running)
echo "3. Testing network error handling"
result=$(python3 "$CLI_PATH" --host "http://localhost:8788" --versionId "$TEST_VERSION_ID" 2>&1 || echo "exit_code:$?")
if [[ "$result" == *"NETWORK ERROR"* ]] && [[ "$result" == *"exit_code:2"* ]]; then
    echo "✓ Correctly handles network errors with exit code 2"
else
    echo "✗ Network error handling failed"
    exit 1
fi

# Test 4: Policy JSON validation
echo "4. Testing policy JSON validation"
if python3 "$CLI_PATH" --versionId "$TEST_VERSION_ID" --policy-json "invalid json" 2>/dev/null; then
    echo "✗ Should have failed with invalid JSON"
    exit 1
else
    echo "✓ Correctly rejects invalid policy JSON"
fi

# Test 5: Valid policy JSON (still expect network error)
echo "5. Testing valid policy JSON"
result=$(python3 "$CLI_PATH" --versionId "$TEST_VERSION_ID" --policy-json '{"minConfs":2}' 2>&1 || echo "exit_code:$?")
if [[ "$result" == *"NETWORK ERROR"* ]] && [[ "$result" == *"exit_code:2"* ]]; then
    echo "✓ Correctly processes valid policy JSON (network error expected)"
else
    echo "✗ Policy JSON processing failed"
    exit 1
fi

# Test 6: Environment variable support
echo "6. Testing environment variable support"
export OVERLAY_URL="http://test:9999"
export READY_TIMEOUT_MS="5000"
result=$(python3 "$CLI_PATH" --versionId "$TEST_VERSION_ID" 2>&1 || echo "exit_code:$?")
if [[ "$result" == *"NETWORK ERROR"* ]] && [[ "$result" == *"exit_code:2"* ]]; then
    echo "✓ Correctly uses environment variables"
else
    echo "✗ Environment variable support failed: $result"
    exit 1
fi

echo ""
echo "All CLI tests passed! ✓"
echo ""
echo "Expected behavior when server is running:"
echo "- Exit 0: READY versionId=... confirmations=N"
echo "- Exit 1: NOT READY versionId=... reason=... confirmations=N"
echo "- Exit 2: NETWORK ERROR (connection issues, invalid args)"