# oore-catalog

`oore-catalog` verifies Oore's official component metadata chain.

The current checkpoint provides:

- a shell-pinned Root trust anchor;
- Ed25519 role thresholds;
- old-and-new threshold Root rotation;
- strict canonical JSON parsing;
- Root, Targets, Snapshot, and Timestamp expiry checks;
- exact metadata length and SHA-256 bindings;
- durable rollback and equivocation state;
- a closed component, gate, service, lifecycle, and revocation schema;
- exact dependency resolution and complete closure checks;
- a safe summary of a verified catalog chain.

The crate does not expose component records yet. It cannot authorize a
download, installation, activation, or execution. The next layer must add
host and capability selection without allowing callers to fabricate records.

The catalog signer uses Oore release keys. Apple Developer credentials are not
part of this trust chain.
