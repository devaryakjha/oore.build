.PHONY: landing landing-dev landing-deploy

# Landing page commands
landing:
	cd landing && bun run build

landing-dev:
	cd landing && bun run dev

landing-deploy: landing
	cd landing && bunx wrangler pages deploy dist --project-name=oore

# Docs page commands
docs:
	cd docs && bun run build

docs-dev:
	cd docs && bun run dev

docs-deploy: docs
	cd docs && bunx wrangler pages deploy dist --project-name=oore-docs