#!/bin/bash

# Bootstrap script for Gapin setup

echo "Installing global tools..."
npm install -g typescript ts-node

echo "Installing workspace dependencies..."
npm install --workspaces

echo "Starting Docker services..."
docker compose -f infra/docker-compose.yml up -d

echo "Initializing database..."
cd packages/gateway && npm run db:init

echo "Setup complete! Run 'npm run dev --workspace=gateway' to start the gateway."