VERSION=`node -pe "require('./package.json').version"`

build-regtest:
	docker build -t dogecoind provision/dogecoind/

regtest:
	docker run --network=host --mount type=bind,source=${PWD}/provision/dogecoind/dogecoin.conf,target=/root/.dogecoin/dogecoin.conf --name dogecoind_regtest dogecoind
	
restart:
	docker start dogecoind_regtest
	
generate:
	docker exec dogecoind_regtest dogecoin-cli generate $(count)
	
clean-regtest:
	rm -rf data/regtest

clean-regtest-data:
	rm -rf data/regtest/spvnode data/regtest/wallet

package: clean-package package-linux package-win package-macos

package-linux:
	pkg . --targets node16-linux-x64 --out-path dist/linux
	mkdir -p dist/linux/prebuilds
	cp -r node_modules/leveldown/prebuilds/linux-x64 dist/linux/prebuilds
	tar -czvf dogecoin-spv-$(VERSION)-linux-x64.tar.gz dist/linux

package-win:
	pkg . --targets node16-win-x64 --out-path dist/win
	mkdir -p dist/win/prebuilds/win32-x64
	cp -r node_modules/leveldown/prebuilds/win32-x64 dist/win/prebuilds
	zip -r dogecoin-spv-$(VERSION)-win-x64.zip dist/win

package-macos:
	pkg . --targets node16-macos-x64 --out-path dist/darwin
	mkdir -p dist/darwin/prebuilds/darwin-x64
	cp -r node_modules/leveldown/prebuilds/darwin-x64+arm64 dist/darwin/prebuilds
	zip -r dogecoin-spv-$(VERSION)-darwin-x64.zip dist/darwin

clean-package:
	rm -rf dist

install-deps:
	npm install -g pkg

.PHONY: build-regtest regtest restart generate clean-regtest clean-regtest-data clean-package install-deps