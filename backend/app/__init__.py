"""
Backend application package entrypoint.

This package is structured according to the project specification:
- config / database
- models / schemas
- routers
- services
- dependencies
- utils
"""

from .main import create_app

__all__ = ["create_app"]

