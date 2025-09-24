#!/bin/bash

# E2E Integration Tests Runner
# Comprehensive BRC Stack Producer-Consumer Integration Testing

set -e

# Configuration
TEST_DIR="$(dirname "$(realpath "$0")")"
PROJECT_ROOT="$(dirname "$(dirname "$TEST_DIR")")"
OVERLAY_PORT=${OVERLAY_PORT:-3000}
DB_NAME=${DB_NAME:-overlay_test}
REDIS_DB=${REDIS_DB:-0}
LOG_LEVEL=${LOG_LEVEL:-warn}
TIMEOUT=${TIMEOUT:-300} # 5 minutes default timeout

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup function
cleanup() {
    log_info "Performing cleanup..."

    # Stop any background processes
    if [[ -n "$OVERLAY_PID" ]]; then
        kill -TERM "$OVERLAY_PID" 2>/dev/null || true
        wait "$OVERLAY_PID" 2>/dev/null || true
    fi

    # Kill any processes on the test port
    lsof -ti:$OVERLAY_PORT | xargs -r kill -9 2>/dev/null || true

    # Cleanup test database
    dropdb -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} --if-exists "$DB_NAME" 2>/dev/null || true

    # Cleanup Redis
    redis-cli -h ${REDIS_HOST:-localhost} -p ${REDIS_PORT:-6379} -n "$REDIS_DB" FLUSHDB 2>/dev/null || true

    # Remove test directories
    rm -rf "$PROJECT_ROOT/test/fixtures/e2e-data" 2>/dev/null || true
    rm -rf "$PROJECT_ROOT/test/fixtures/cli-output" 2>/dev/null || true
    rm -rf "$PROJECT_ROOT/tmp/test-uploads" 2>/dev/null || true
    rm -rf "$PROJECT_ROOT/tmp/test-downloads" 2>/dev/null || true

    log_success "Cleanup completed"
}

# Set trap for cleanup on exit
trap cleanup EXIT

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi

    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        log_error "PostgreSQL client (psql) is not installed"
        exit 1
    fi

    # Check Redis
    if ! command -v redis-cli &> /dev/null; then
        log_error "Redis client (redis-cli) is not installed"
        exit 1
    fi

    # Check Python3 (for CLI tests)
    if ! command -v python3 &> /dev/null; then
        log_warning "Python3 is not installed - CLI tests will be skipped"
    fi

    log_success "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."

    cd "$PROJECT_ROOT"

    # Install Node.js dependencies
    npm install

    # Install Python dependencies if CLI tests are enabled
    if command -v python3 &> /dev/null && [[ -f "requirements.txt" ]]; then
        python3 -m pip install -r requirements.txt --user || log_warning "Failed to install Python dependencies"
    fi

    log_success "Dependencies installed"
}

# Setup test environment
setup_test_environment() {
    log_info "Setting up test environment..."

    # Set environment variables
    export NODE_ENV=test
    export VITEST=true
    export PORT=$OVERLAY_PORT
    export DB_NAME=$DB_NAME
    export REDIS_DB=$REDIS_DB
    export LOG_LEVEL=$LOG_LEVEL
    export BRC31_ENABLED=true
    export BRC41_ENABLED=true
    export BRC64_ENABLED=true
    export D21_ENABLED=true
    export D22_ENABLED=true

    # Create test directories
    mkdir -p "$PROJECT_ROOT/test-results"
    mkdir -p "$PROJECT_ROOT/test/fixtures/e2e-data"
    mkdir -p "$PROJECT_ROOT/test/fixtures/cli-output"
    mkdir -p "$PROJECT_ROOT/tmp/test-uploads"
    mkdir -p "$PROJECT_ROOT/tmp/test-downloads"

    # Initialize test database
    log_info "Initializing test database..."
    dropdb -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} --if-exists "$DB_NAME" 2>/dev/null || true
    createdb -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} "$DB_NAME"

    # Apply database schema
    if [[ -f "$PROJECT_ROOT/src/db/postgresql-schema-complete.sql" ]]; then
        psql -h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} -d "$DB_NAME" -f "$PROJECT_ROOT/src/db/postgresql-schema-complete.sql"
    fi

    # Flush Redis
    redis-cli -h ${REDIS_HOST:-localhost} -p ${REDIS_PORT:-6379} -n "$REDIS_DB" FLUSHDB 2>/dev/null || true

    log_success "Test environment setup completed"
}

# Start services
start_services() {
    log_info "Starting services..."

    cd "$PROJECT_ROOT"

    # Check if service is already running
    if curl -s "http://localhost:$OVERLAY_PORT/health" >/dev/null 2>&1; then
        log_info "Overlay service is already running on port $OVERLAY_PORT"
        return 0
    fi

    # Start overlay service in background
    log_info "Starting overlay service on port $OVERLAY_PORT..."
    npm run dev > "/tmp/overlay-service-$$.log" 2>&1 &
    OVERLAY_PID=$!

    # Wait for service to start
    local attempts=0
    local max_attempts=30

    while [[ $attempts -lt $max_attempts ]]; do
        if curl -s "http://localhost:$OVERLAY_PORT/health" >/dev/null 2>&1; then
            log_success "Overlay service started successfully"
            return 0
        fi

        sleep 2
        ((attempts++))
    done

    log_error "Overlay service failed to start within $((max_attempts * 2)) seconds"
    if [[ -n "$OVERLAY_PID" ]]; then
        log_info "Service logs:"
        cat "/tmp/overlay-service-$$.log" || true
    fi
    exit 1
}

# Run integration tests
run_tests() {
    log_info "Running E2E integration tests..."

    cd "$PROJECT_ROOT"

    local test_command="npx vitest run --config test/integration/vitest.integration.config.ts"

    # Add specific test patterns if provided
    if [[ -n "$1" ]]; then
        test_command="$test_command $1"
    else
        test_command="$test_command test/integration/**/*.spec.ts"
    fi

    # Add timeout
    test_command="timeout $TIMEOUT $test_command"

    log_info "Executing: $test_command"

    # Run tests and capture output
    if eval "$test_command"; then
        log_success "All integration tests passed!"
        return 0
    else
        local exit_code=$?
        log_error "Integration tests failed with exit code $exit_code"

        # Show test results if available
        if [[ -f "$PROJECT_ROOT/test-results/integration-test-results.json" ]]; then
            log_info "Test results summary:"
            cat "$PROJECT_ROOT/test-results/integration-test-results.json" | jq '.testResults[] | {file: .name, tests: .assertionResults | length, failures: [.assertionResults[] | select(.status == "failed")] | length}' 2>/dev/null || true
        fi

        return $exit_code
    fi
}

# Generate test report
generate_report() {
    log_info "Generating test report..."

    local report_file="$PROJECT_ROOT/test-results/e2e-integration-report-$(date +%Y%m%d-%H%M%S).json"

    cat > "$report_file" << EOF
{
  "testRun": "E2E BRC Stack Integration Tests",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)",
  "environment": {
    "nodeVersion": "$(node --version)",
    "npmVersion": "$(npm --version)",
    "platform": "$(uname -s)",
    "arch": "$(uname -m)",
    "overlayPort": "$OVERLAY_PORT",
    "database": "$DB_NAME",
    "redisDb": "$REDIS_DB"
  },
  "configuration": {
    "brcStandards": {
      "BRC-22": "Transaction Submission",
      "BRC-24": "Lookup Services",
      "BRC-26": "UHRP Content Storage",
      "BRC-31": "Identity Authentication",
      "BRC-41": "PacketPay HTTP Micropayments",
      "BRC-64": "History Tracking",
      "BRC-88": "Service Discovery",
      "D21": "BSV Native Payments",
      "D22": "Storage Backend"
    }
  },
  "testFiles": [
    "e2e-producer-consumer-comprehensive.spec.ts",
    "d14-d15-cli-integration.spec.ts"
  ],
  "status": "completed",
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
}
EOF

    log_success "Test report generated: $report_file"
}

# Main execution
main() {
    log_info "Starting E2E Integration Tests for BRC Stack Producer-Consumer"
    log_info "=========================================================="

    # Parse command line arguments
    local test_pattern=""
    while [[ $# -gt 0 ]]; do
        case $1 in
            --pattern)
                test_pattern="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [--pattern TEST_PATTERN]"
                echo "  --pattern    Specify a test pattern to run specific tests"
                echo "  --help       Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Execute test steps
    check_prerequisites
    install_dependencies
    setup_test_environment
    start_services

    # Run tests
    if run_tests "$test_pattern"; then
        generate_report
        log_success "E2E Integration Tests completed successfully!"
        exit 0
    else
        generate_report
        log_error "E2E Integration Tests failed!"
        exit 1
    fi
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi