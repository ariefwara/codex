#!/bin/bash

# Codex startup script

# Create uploads directory if it doesn't exist
if [ ! -d "uploads" ]; then
  mkdir uploads
  echo "Created uploads directory"
fi

# Create logs directory if it doesn't exist
if [ ! -d "logs" ]; then
  mkdir logs
  echo "Created logs directory"
fi

# Start the application
echo "Starting Codex document management system..."
node server.js