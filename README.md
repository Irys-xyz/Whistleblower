# Whistleblower - Bundler node validation system

Whistleblower is designed to be a lightweight, fully featured transaction/bundle verifier
# what whistleblower validates
 - transactions make it onto Arweave (seeded) by their [deadline height](http://link-to-docs)
 - transactions have valid formats & signatures
 - bundles have valid formats & signatures

# how
WB sets up a set of websocket connections that listen to every Tx uploaded to a node, adding these txs to it's tracking database

WB also regularly checks arweave for bundles produced by the node, and when found, downloads them and verifies them and their contents - if a tracked Tx is found in a bundle, it's verified and marked as valid or invalid.

if a tx isn't found in a bundle after a while, WB will go looking for it, downloading & processing it's parent bundle in order to validate the transaction.

if a tx has been invalidated or hasn't been validated after it's deadline height, an alert is triggered.


# alerts
WB allows you to provide a custom alert function, the interface can be found [here](./src/utils/alert.ts), and an example [here](./alert.ts)

# configuration
WB doesn't require much configuration, but a config file (schema [here](./src/types/config.ts)) can be provided to tweak how it functions

# getting started

install dependencies via `npm`, `yarn`, or your nodeJS package manager of choice.

run the setup CLI with the nodes you want to monitor like so: \
` yarn wb-init --nodes https://node1.bundlr.network https://node2.bundlr.network
`
run WB: \
`yarn build`
`yarn start`
or in one command: \
`yarn restart`


you will see WB start up and begin processing.
