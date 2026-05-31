#!/usr/bin/env fish

# Activate the virtual environment
set VENV_PATH (dirname (status filename))/myenv
echo "Activating virtual environment: $VENV_PATH"

# Ensure we're using the Python from our virtual environment
set -gx VIRTUAL_ENV $VENV_PATH
set -gx PATH $VENV_PATH/bin $PATH
set -gx PYTHONHOME ''

echo "Starting backend server..."

# Run the uvicorn server
exec python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000