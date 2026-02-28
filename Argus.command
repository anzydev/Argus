#!/usr/bin/env bash

# This script allows double-clicking in macOS Finder to launch Argus
# It changes the directory to wherever this script is located
cd "$(dirname "$0")"

echo "Starting Argus environment..."

# Use the virtual environment Python if it exists, otherwise fallback to system python
if [ -f "./.venv/bin/python" ]; then
    PYTHON_CMD="./.venv/bin/python"
elif [ -f "./venv/bin/python" ]; then
    PYTHON_CMD="./venv/bin/python"
else
    PYTHON_CMD="python3"
fi

$PYTHON_CMD run.py
