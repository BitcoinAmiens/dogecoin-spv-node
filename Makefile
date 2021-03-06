VERSION=`node -pe "require('./package.json').version"`

build-regtest:
	docker build --network=host -t dogecoind provision/dogecoind/

regtest:
	docker run --network=host -p 18444:18444 --name dogecoind_regtest dogecoind
	
restart:
	docker start dogecoind_regtest
	
generate:
	docker exec dogecoind_regtest dogecoin-cli generate 5
	
clean-regtest:
	rm -rf data/regtest

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
	cp -r node_modules/leveldown/prebuilds/darwin-x64 dist/darwin/prebuilds
	zip -r dogecoin-spv-$(VERSION)-darwin.zip dist/darwin

clean-package:
	rm -rf dist