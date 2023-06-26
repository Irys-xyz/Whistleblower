# Whistleblower

Whistleblower is a lightweight, fully-featured transaction and bundle verifier that allows anyone to monitor a Bundlr node and ensure transactions are finalized on Arweave.

![](https://github.com/Bundlr-Network/Whistleblower/blob/master/assets/whistleblower.png?raw=true)

Whistleblower monitors transactions uploaded to Bundlr and their finalization on Arweave. For each upload, Whistleblower checks the assigned deadline height - the block number by which a transaction must be finalized - and ensures it’s finalized by this block number. Acting as a bridge between Bundlr nodes and Arweave, it matches uploaded transactions with finalized ones, and triggers alerts if any transaction misses its deadline.

With Whistleblower, you can ensure that:

- Transactions are finalized on Arweave by their deadline height (the block number by which the transaction must be finalized on Arweave).
- Transactions have valid formats and signatures.
- Bundles have valid formats and signatures.

## How 


Whistleblower sets up WebSocket connections with Bundlr's nodes, tracking and adding all transactions uploaded to these nodes into its database.

Whistleblower periodically checks Arweave for finalized bundles, downloads them, and verifies their contents. Tracked transactions within a bundle are verified and marked as valid or invalid.

If a transaction is invalidated or doesn't get finalized by its deadline height, an alert is issued.


## Alerts

By default, Whistleblower sends alerts via the CLI if a transaction isn't finalized by its deadline height. To create a custom alert, write a class implementing [this interface](/Whistleblower/blob/master/src/utils/alert.ts), and include your custom behavior in the alert function shown below. There's also [an example implementation](/Whistleblower/blob/master/alert.ts) demonstrating how to set up an alert using [PagerDuty](https://www.pagerduty.com/).

```js
export default async function alert(alert: Alert): Promise<void> {
   // Add your custom alert code here!
}
```

## Configuration

Whistleblower is designed to be user-friendly and requires minimal configuration. However, if you need to customize its behavior, rename [example.config.ts](/Whistleblower/blob/master/example.config.ts) file to `config.ts` and modify as needed. A heavily commented example implementation [can be found here](/Whistleblower/blob/master/src/types/config.ts).

## Installation

1. Clone this repository
2. Install dependencies via: 
- npm: `npm install`
- yarn: `yarn`


## Running
 
![](https://github.com/Bundlr-Network/Whistleblower/blob/master/assets/whistleblower-running.png?raw=true)

You can run Whistleblower using either yarn or npm. Start by initializing it with the address(es) of the nodes you want to monitor, then start the application.

### Via yarn

```console
yarn wb-init --nodes https://node1.bundlr.network https://node2.bundlr.network 
yarn restart 
```

### Via npm

```console
npm run init-wb -- -n https://node1.bundlr.network https://node2.bundlr.network
npm run restart 
```
