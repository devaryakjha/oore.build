# oore-component-store

`oore-component-store` installs a component selected from Oore's verified
catalog.

The store accepts only exact archive bytes from a verified component record.
It rejects links, special files, extra files, missing files, and changed file
metadata. It publishes a component only after every signed fact matches.

The crate does not download catalogs, choose trust roots, or run components.
