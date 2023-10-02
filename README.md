# Whistleblower


![](https://github.com/Bundlr-Network/Whistleblower/blob/master/assets/irys-whistleblower.png?raw=true)

Whistleblower is a lightweight tool for monitoring transactions uploaded to Irys and verifying their finalization on Arweave. It cross-references uploaded transactions with finalized ones and triggers an alert if a transaction misses its finalization deadline. Whistleblower can be easily deployed on any computer with a single command argument, making transaction monitoring both simple and accessible.


With Whistleblower, you can ensure that:

- Transactions are finalized on Arweave by their deadline height (the block number by which the transaction must be finalized on Arweave).
- Transactions have valid formats and signatures.
- Bundles have valid formats and signatures.


## Whistleblower step-by-step

![](https://github.com/Bundlr-Network/Whistleblower/blob/master/assets/irys-whistleblower-steps.png?raw=true)

Start by launching Whistleblower via your CLI and select the nodes you want to monitor.
Whistleblower then:
1. Initializes WebSocket connections to each of the selected nodes for real-time monitoring.
2. Connects to an Arweave gateway to retrieve all bundles associated with the nodes being tracked.
3. Connects to Arweave miners, making sure it can download the entire bundle. 
   1. Traverses through each transaction within a bundle, ensuring that it can both download and cryptographically verify each one.
4. Triggers an alert if a transaction cannot be downloaded or verified prior to reaching its deadline height.


## Whistleblower failure modes
Whistleblower cares that a transaction is in a bundle and that bundle is onchain. 
As it tracks the status of each transaction, an alert will be triggered if:

1. Whistleblower can't download and verify a transaction by its deadline height.
2. A transaction is invalid by its deadline height.
3. A bundle is found to be invalid:
   1. Because it can't be cryptographically verified.
   2. Because Whistleblower can't download the full bundle.
4. A transaction is invalid:
   1. Because it hasn't been verified by its deadline height.
   2. Because it's orphaned, Whistleblower is tracking it, but it hasn't showed in any posted bundles. 
5. A transaction is included in a bundle tagged as invalid.

## Alerts

By default, Whistleblower sends alerts via the CLI if a transaction isn't finalized by its deadline height. To create a custom alert, write a class implementing [this interface](/Whistleblower/blob/master/src/utils/alert.ts), and include your custom behavior in the alert function shown below. There's also [an example implementation](/Whistleblower/blob/master/alert.ts) demonstrating how to set up an alert using [PagerDuty](https://www.pagerduty.com/).

```js
export default async function alert(alert: Alert): Promise<void> {
   // Add your custom alert code here
}
```

## Configuration

Whistleblower requires minimal configuration. If you need to customize its behavior, rename [example.config.ts](/Whistleblower/blob/master/example.config.ts) file to `config.ts` and modify as needed. A heavily commented example implementation [can be found here](/Whistleblower/blob/master/src/types/config.ts).

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
yarn wb-init --nodes https://node1.irys.xyz https://node2.irys.xyz 
yarn restart 
```

### Via npm

```console
npm run init-wb -- -n https://node1.irys.xyz https://node2.irys.xyz
npm run restart 
```
