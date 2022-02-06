# Dogecoin SPV node

[![JavaScript Style Guide](https://cdn.rawgit.com/standard/standard/master/badge.svg)](https://github.com/standard/standard)

A simple spv node for Dogecoin.

## Development (regtest)

You will need docker installed.

Build the docker image:
```
$ make build-regtest
```

Start the docker container:
```
$ make regtest
```

Restart the container (in case you stopped the container and want to continue development):
```
$ make restart
```

Generate 5 blocks:
```
$ make generate
```

Start the spvnoce in regtest mode:
```
NETWORK=regtest npm start
```

## Development in Testnet Network

```
NETWORK=testnet npm start
```


## See debug log

```
tail -f stdout.log
```

## Documentation

Run the doucmentation server locally
```
$ npm run docs:dev
```

Build the documentation
```
$ npm run docs:build
```


## Troubleshouting

### bad-txns-inputs-spent 12
Sometime freshly collecty inputs won't work. Just wait a bit for some new blocks...