#!/usr/bin/env bash

echo "===== INSTALL DOGECOIND ====="
wget https://github.com/dogecoin/dogecoin/releases/download/v1.14.0/dogecoin-1.14.0-x86_64-linux-gnu.tar.gz
tar -xzvf dogecoin-1.14.0-x86_64-linux-gnu.tar.gz
chmod +x dogecoin-1.14.0/bin/dogecoind dogecoin-1.14.0/bin/dogecoin-cli
cp -a dogecoin-1.14.0/bin .

echo "===== CONFIG DOGECOIND ====="
mkdir .dogecoin
cp workspace/provision/dogecoind/dogecoin.conf .dogecoin/dogecoin.conf

echo "===== START DOGECOIND DAEMON ====="
dogecoind --daemon
