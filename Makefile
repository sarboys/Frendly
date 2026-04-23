COMPOSE := docker compose -f compose.prod.yml

.PHONY: clear_test_user

# noop trigger for deploy rerun
clear_test_user:
	@if [ "$$($(COMPOSE) ps -q api)" != "" ]; then \
		$(COMPOSE) exec -T api pnpm db:reset:test-users; \
	else \
		$(COMPOSE) run --rm api pnpm db:reset:test-users; \
	fi
