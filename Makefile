.PHONY: landing landing-dev landing-deploy

# Landing page commands
landing:
	cd landing && bun run build

landing-dev:
	cd landing && bun run dev

landing-deploy: landing
	cd landing && npx wrangler pages deploy dist --project-name=oore
