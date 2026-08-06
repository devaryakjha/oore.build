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

## Detached signing

`oore-catalog-author prepare` creates a short-lived canonical signing request.
It does not load a private key.

`oore-catalog-author assemble` verifies detached responses with their public
keys. It then creates a canonical signed envelope. The complete catalog
verifier must still accept that envelope before publication.

## Local alpha signer

`oore-catalog-local-signer` keeps local private-key use outside the catalog
author. It does not support noninteractive signing.

Create one signer on an encrypted offline volume:

```console
oore-catalog-local-signer generate \
  --private-key ./targets-1.pk8 \
  --public-key ./targets-1.public.json
```

The private-key file uses mode `0600` on Unix. It is not password-encrypted.
Do not commit it, copy it to a runner, or store it in a CI secret.

Prepare one short-lived request on the release machine:

```console
oore-catalog-author prepare \
  --role targets \
  --input ./targets.signed.json \
  --output ./targets.request.json \
  --repository oore-ci/oore.build \
  --commit 0123456789abcdef0123456789abcdef01234567 \
  --tag v0.2.0-alpha.1 \
  --catalog-revision 1
```

Move only the request to the offline signer. Review the displayed release
facts and type the complete payload digest:

```console
oore-catalog-local-signer sign \
  --request ./targets.request.json \
  --private-key ./targets-1.pk8 \
  --output ./targets-1.signature.json
```

Return only the detached response. Repeat the operation with the required
independent keys. The author then assembles the responses with the matching
public-key files.

OpenBao can replace one local signer later. The detached request, response,
and catalog formats do not change.
