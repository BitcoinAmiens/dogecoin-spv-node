# Dogecoin SPV node

A simple spv node for Dogecoin.

## Development (regtest)

You will need docker installed.

Build the docker image:
```
$ make build
```

Start the docker container:
```
$ make regtest
```

Restart the container (in case you stopped the container and want to continue developpment):
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

## NOTES

THE MNEMONIC SHOULD ONLY BE USE IN REGTEST OR FOR TEST.
