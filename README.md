# Whistleblower


![](./assets/irys-whistleblower.png?raw=true)

Whistleblower is a light client for monitoring [transactions uploaded to Irys](https://docs.irys.xyz/learn/transaction-lifecycle), verifying they are finalized on Arweave and seeded to miners. 

> A transaction is "finalized" once >= 50 Arweave block confirmations have passed. With a block time of ~2 minutes, it takes ~100 minutes before a transaction can be considered final.

> A transaction is "seeded" when the data can be fully retrieved from >= 5 miners.

Whistleblower can be easily deployed on most computers, making transaction monitoring both simple and accessible.

With Whistleblower, you can ensure that:

- Transactions are finalized on Arweave by their deadline height (the block number by which the transaction must be finalized on Arweave).
- Transactions have valid formats and signatures.
- [Bundles](https://docs.irys.xyz/learn/bundles) have valid formats and signatures.
- Data uploaded is seeded to Arweave miners.


## Whistleblower step-by-step

![](./assets/irys-whistleblower-steps.png?raw=true)

Whistleblower connects to [Irys](https://docs.irys.xyz/overview/nodes) and then:
1. Initializes WebSocket connections to each of the selected nodes for real-time monitoring.
2. Connects to an Arweave gateway to retrieve all bundles associated with the nodes being tracked.
3. Connects to Arweave miners, making sure it can download the entire bundle. 
   1. Traverses through each transaction within a bundle, ensuring that it can both download and cryptographically verify each one.
4. Triggers an alert if a transaction cannot be downloaded or verified prior to reaching its deadline height.

## Whistleblower failure modes
Whistleblower cares that a transaction is in a bundle, that bundle is onchain and the data can be downloaded from miners.

As it tracks the status of each transaction, an alert will be triggered if a transaction is invalid. 

A transaction is invalid if and only if:
- The transaction isn't included in a bundle by the deadline height.
- The bundle the transaction resides in isn't seeded to >=5 miners by the deadline height.
- The bundle the transaction resides in has <50 confirmations on Arweave.

Whistleblower then:
1. Initializes WebSocket connections to each of the selected nodes for real-time monitoring.
2. Connects to an Arweave gateway to retrieve all bundles associated with the nodes being tracked.
3. Connects to Arweave miners, making sure it can download the entire bundle. 
   1. Traverses through each transaction within a bundle, ensuring that it can both download and cryptographically verify each one.
4. Triggers an alert if a transaction cannot be downloaded or verified prior to reaching its deadline height.

## Alerts

By default, Whistleblower sends alerts via the CLI if a transaction isn't finalized by its deadline height. To create a custom alert, write a class implementing [this interface](/src/utils/alert.ts), and include your custom behavior in the alert function shown below. There's also [an example implementation](/alert.ts) demonstrating how to set up an alert using [PagerDuty](https://www.pagerduty.com/).

```js
export default async function alert(alert: Alert): Promise<void> {
   // Add your custom alert code here
}
```

## Configuration

Whistleblower requires no configuration by default. If you need to customize its behavior, rename [example.config.ts](./example.config.ts) file to `config.ts` and modify as needed. A heavily commented example implementation [can be found here](./src/types/config.ts).

## Installation

Clone this repository and then install Whistleblower via: 

### Via yarn

```console
yarn
yarn build
```

### Via npm

```console
npm install
npm run build
```

## Running
 
![](./assets/whistleblower-running.png?raw=true)

You can run Whistleblower using either yarn or npm. Start by initializing it with the address(es) of the nodes you want to monitor, then start the application.

### Via yarn

```console
yarn whistleblower init --nodes https://node1.irys.xyz https://node2.irys.xyz
yarn start 
```

### Via npm

```console
npm run whistleblower init  -- --nodes https://node1.irys.xyz https://node2.irys.xyz
npm run start 
```
