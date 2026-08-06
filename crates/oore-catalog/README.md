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
- a safe summary of a verified catalog chain.

The crate does not yet expose component records. It cannot authorize a
download, installation, activation, or execution. That remains blocked until
the complete closed component schema and exact dependency resolver exist.

The catalog signer uses Oore release keys. Apple Developer credentials are not
part of this trust chain.
