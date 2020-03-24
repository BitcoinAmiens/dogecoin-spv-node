# Dogecoin SPV node

A simple spv node for Dogecoin.

## Development

Start the vagrantbox :
```
$ vagrant up
```

It will start the dogecoind in regtest mode.

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
