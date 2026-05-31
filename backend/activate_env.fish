#!/usr/bin/env fish

# Activate the virtual environment
set VENV_PATH (dirname (status filename))/myenv
echo "Activating virtual environment: $VENV_PATH"

# Ensure we're using the Python from our virtual environment
set -gx VIRTUAL_ENV $VENV_PATH
set -gx PATH $VENV_PATH/bin $PATH
set -gx PYTHONHOME ''

echo "Virtual environment activated!"
echo "Python location: "(which python)
echo "Version: "(python --version)