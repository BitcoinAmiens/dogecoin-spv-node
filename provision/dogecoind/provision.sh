#!/usr/bin/env bash

echo "===== INSTALL DOGECOIND ====="
wget https://github.com/dogecoin/dogecoin/releases/download/v1.10.0/dogecoin-1.10.0-linux64.tar.gz
tar -xzvf dogecoin-1.10.0-linux64.tar.gz
chmod +x dogecoin-1.10.0/bin/dogecoind dogecoin-1.10.0/bin/dogecoin-cli
cp -a dogecoin-1.10.0/bin .

echo "===== CONFIG DOGECOIND ====="
mkdir .dogecoin
cp workspace/provision/dogecoind/dogecoin.conf .dogecoin/dogecoin.conf

echo "===== START DOGECOIND DAEMON ====="
dogecoind --daemon
