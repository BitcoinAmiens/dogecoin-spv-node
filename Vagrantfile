# -*- mode: ruby -*-
# vi: set ft=ruby :

###############################################################################
#                                                                             #
# Vagrantfile project: Dogecoin SPV node                                      #
# Description:                                                                #
# Will start a ubuntu 16.04 box with a docker dogecoind regtest node for dev  #
# for use.                                                                    #
# Author: Lola <me@lola.ninja>s                                               #
#                                                                             #
###############################################################################

Vagrant.require_version ">= 2.0.0"
VAGRANTFILE_API_VERSION = "2"

Vagrant.configure(VAGRANTFILE_API_VERSION) do |config|

  config.vm.box = "ubuntu/xenial64"

  # Forwarding dogecoind ports
  # config.vm.network "forwarded_port", guest: 44555, host: 44555
  # config.vm.network "forwarded_port", guest: 44556, host: 44556

  # Get a proper private network
  config.vm.network "private_network", ip: "192.168.50.4"

  config.vm.provider "virtualbox" do |vb|
     vb.name = "Dogecoin dev"
     vb.customize ["modifyvm", :id, "--memory", "2048"]
     vb.customize ["modifyvm", :id, "--nicpromisc2", "allow-all"]
  end

  config.vm.synced_folder ".", "/home/ubuntu/workspace"

  # Install node & npm
  # config.vm.provision :shell, path: "provision.sh", privileged: true

  # Install update
  config.vm.provision :shell, path: "./provision/provision.sh", privileged: true

  # Install dogecoind && start dogecoind regtest
  config.vm.provision :shell, path: "./provision/dogecoind/provision.sh", privileged: false

end
