# Development

## Structure

The project structure is the following:
* `/bin/**` files for the CLI
* `/docs/**` compiled 
* `/documentation/**` the documentation files
* `/provision/**` dogecoind dockerfile for quick dev setup
* `/src/**` all the sources files for the core logic of the application
    - `commands/` the messages used by the node to communicate with other nodes (serialize/deserialize functions)
    - `interface/` it is the User Interface, the **Interface** class manage the differents ~~screens~~ and navigation
    - `paymentchannel/` the payment channel logic
    - `spvnode/` the Simplified Payment Verification node logic (handle connections to peers, syncing, etc...)
    - `store/` a store for the **wallet/node** that can be used in as a source of information in the **interface**
    - `wallet/` the wallet logic (signing, storing transactions and keys...)
* `/test/**` testing logic
    - `integration/` tests using Dogecoin in regtest
    - `test_vectors/` json files used in testing
    - `tools/` some scripts used during development
    - `unit/` unit tests


## Start developing

### Pre-requisite

Install [NodeJS Version 16](https://nodejs.org) and [Docker](https://docs.docker.com/engine/install/).

### Setup dev environment

Install npm dependencies
```
$ npm install
```

Build the dogecoind docker image
```
$ make build-regtest
```

Start the dogecoind container in regtest mode
```
$ make regtest
```

Generate some blocks
```
$ make generate count=150
```

### Start the wallet in regtest mode

You can start the wallet in regtest mode by specifying the `NETWORK` envrionment variable to `regtest` and `DEV` to `true` to create a local folder with all the data.
```
$ NETWORK=regtest DEV=true npm start
```

In an other terminal you can check the logs by reading the `stdout.log` file.
```
$ tail -f stoud.log
```