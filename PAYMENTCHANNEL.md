# Payment Channel

Payment channel implementatio will allow to open accounts with Doges on Minecraft servers for in-game payment without the need of a third-party holding the funds.

## How?

There is 2 differents kind of payment channels : unidirectionnel and bidirectionnnel.

It also exists different scheme for it :
* Nakamoto high-frequency transactions
* Spillman-style payment channels
* CLTV-style payment channels
* Poon-Dryja payment channels
* Decker-Wattenhofer duplex payment channels
* Decker-Russell-Osuntokun eltoo Channels

In our use case we want to do unidirectionel payment. 

## Spillman-style payment channels

This method requires 2 transactions : a multisig one and one that remove the funds from the multisig.

1. Create a public key (K1). Request a public key from the server (K2).
2. Create and sign but do not broadcast a transaction (T1) that sets up a payment of (for example) 10 DOGE to an output requiring both the server's private key and one of your own to be used. A good way to do this is use OP_CHECKMULTISIG. The value to be used is chosen as an efficiency tradeoff.

```
2 <payee> <payer> OP_2 OP_CHECKMULTISIG
```

3. Create a refund transaction (T2) that is connected to the output of T1 which sends all the money back to yourself. It has a time lock set for some time in the future, for instance a few hours. Don't sign it, and provide the unsigned transaction to the server. By convention, the output script is "2 K1 K2 2 CHECKMULTISIG"