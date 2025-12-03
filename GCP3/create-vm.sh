#!/bin/bash
set -e

echo "🚀 Creating VM for Aligo SMS Proxy..."

# Configuration
VM_NAME="aligo-proxy"
ZONE="us-central1-a"
MACHINE_TYPE="f1-micro"
IMAGE_FAMILY="debian-11"
IMAGE_PROJECT="debian-cloud"
DISK_SIZE="10GB"
TAGS="proxy-server,http-server,https-server"

# Create VM
gcloud compute instances create $VM_NAME \
  --zone=$ZONE \
  --machine-type=$MACHINE_TYPE \
  --image-family=$IMAGE_FAMILY \
  --image-project=$IMAGE_PROJECT \
  --boot-disk-size=$DISK_SIZE \
  --boot-disk-type=pd-standard \
  --tags=$TAGS \
  --metadata=enable-oslogin=FALSE

echo "✅ VM created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Run: bash allocate-static-ip.sh"
echo "2. SSH into VM and install Tinyproxy"
echo "   gcloud compute ssh $VM_NAME --zone=$ZONE"
echo "3. Run setup script on VM"
