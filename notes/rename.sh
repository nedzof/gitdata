#!/bin/bash
# Script to rename "genius system" to "gitdata" throughout the project
# Usage: ./rename-script.sh

set -e  # Exit on any error

echo "Starting project rename from 'genius system' to 'gitdata'"
echo "Working directory: $(pwd)"

# Check if we're in the root of the repository
if [ ! -f "package.json" ]; then
  echo "Error: This script should be run from the root of the repository."
  exit 1
fi

# Create a backup
echo "Creating backup of the current state..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="../project_backup_${TIMESTAMP}"
mkdir -p "$BACKUP_DIR"
cp -r . "$BACKUP_DIR"
echo "Backup created at $BACKUP_DIR"

# Update GitHub workflow files
echo "Updating GitHub workflow files..."
if [ -f ".github/workflows/ci.yml" ]; then
  sed -i 's/genius-overlay/gitdata-overlay/g' .github/workflows/ci.yml
  echo "  Updated .github/workflows/ci.yml"
fi

# Update systemd service files
echo "Updating systemd service files..."
if [ -d "etc/systemd/system" ]; then
  # Rename files
  for file in etc/systemd/system/genius-*.{service,timer}; do
    if [ -f "$file" ]; then
      new_file=$(echo "$file" | sed 's/genius-/gitdata-/g')
      mv "$file" "$new_file"
      echo "  Renamed $file to $new_file"
    fi
  done
  
  # Update content
  for file in etc/systemd/system/gitdata-*.{service,timer}; do
    if [ -f "$file" ]; then
      sed -i 's/Genius/Gitdata/g' "$file"
      sed -i 's/genius/gitdata/g' "$file"
      sed -i 's/\/opt\/genius-overlay/\/opt\/gitdata-overlay/g' "$file"
      echo "  Updated content in $file"
    fi
  done
fi

# Update OpenAPI spec
echo "Updating OpenAPI specification..."
if [ -f "openapi.yaml" ]; then
  sed -i 's/Genius System Overlay API/Gitdata Overlay API/g' openapi.yaml
  echo "  Updated openapi.yaml"
fi

# Update package.json (if needed)
echo "Checking package.json..."
if [ -f "package.json" ]; then
  if grep -q "genius" package.json; then
    sed -i 's/genius/gitdata/g' package.json
    echo "  Updated package.json"
  fi
fi

# Update environment files
echo "Updating environment files..."
if [ -f "opt/genius-overlay/.env" ]; then
  mkdir -p opt/gitdata-overlay
  sed 's/genius/gitdata/g' opt/genius-overlay/.env > opt/gitdata-overlay/.env
  echo "  Created updated env file at opt/gitdata-overlay/.env"
fi

# Update documentation files
echo "Updating documentation files..."
for doc in CONTRIBUTING.md DEVELOPMENT_STANDARDS.md README.md specs/pdr.md; do
  if [ -f "$doc" ]; then
    sed -i 's/Contributing to Genius System/Contributing to Gitdata/g' "$doc"
    sed -i 's/Genius System/Gitdata/g' "$doc"
    sed -i 's/genius system/gitdata/g' "$doc"
    sed -i 's/genius-overlay/gitdata-overlay/g' "$doc"
    echo "  Updated $doc"
  fi
done

# Update UI files
echo "Updating UI files..."
if [ -f "public/index.html" ]; then
  sed -i 's/Genius Marketplace MVP/Gitdata Marketplace MVP/g' public/index.html
  sed -i 's/>Genius Marketplace</>Gitdata Marketplace</g' public/index.html
  echo "  Updated public/index.html"
fi

# Update Postman files
echo "Updating Postman files..."
if [ -d "postman" ]; then
  find postman -type f -name "*.json" -exec sed -i 's/Genius System/Gitdata/g' {} \;
  find postman -type f -name "*.json" -exec sed -i 's/"name":"Genius /"name":"Gitdata /g' {} \;
  echo "  Updated Postman files"
fi

# Update source code
echo "Updating source code..."
find src -type f \( -name "*.ts" -o -name "*.js" \) -exec sed -i 's/genius/gitdata/g' {} \;
find src -type f \( -name "*.ts" -o -name "*.js" \) -exec sed -i 's/Genius/Gitdata/g' {} \;
echo "  Updated source code files"

# Update issue files
echo "Updating issue files..."
if [ -d "issues" ]; then
  find issues -type f -name "*.md" -exec sed -i 's/genius/gitdata/g' {} \;
  find issues -type f -name "*.md" -exec sed -i 's/Genius/Gitdata/g' {} \;
  echo "  Updated issue files"
fi

# Update tests
echo "Updating test files..."
if [ -d "test" ]; then
  find test -type f \( -name "*.ts" -o -name "*.js" -o -name "*.spec.ts" \) -exec sed -i 's/genius/gitdata/g' {} \;
  find test -type f \( -name "*.ts" -o -name "*.js" -o -name "*.spec.ts" \) -exec sed -i 's/Genius/Gitdata/g' {} \;
  echo "  Updated test files"
fi

echo "Rename complete! Please review the changes before committing."
echo "You may want to run your tests to ensure everything still works correctly."
echo ""
echo "Next steps:"
echo "1. git status (to see all changed files)"
echo "2. Run tests and verify the application works"
echo "3. git add ."
echo "4. git commit -m \"Rename project from 'genius system' to 'gitdata'\""
echo "5. git push"
