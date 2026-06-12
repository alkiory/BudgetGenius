#!/usr/bin/env bash
set -euo pipefail

echo "Setting up GCE VM for BudgetGenius..."

# Update and install dependencies
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine and Docker Compose
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable and start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Create deployment directory
USER_HOME=$(eval echo ~${SUDO_USER:-$USER})
mkdir -p "$USER_HOME/budgetgenius"
chown -R ${SUDO_USER:-$USER}:${SUDO_USER:-$USER} "$USER_HOME/budgetgenius"

# Add user to docker group (requires logout/login to take effect)
sudo usermod -aG docker ${SUDO_USER:-$USER}

# Configure firewall (UFW)
echo "Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
echo "y" | sudo ufw enable

echo "GCE VM setup complete. Please log out and log back in for docker group changes to take effect."
