# Frendly Observability

Prometheus and Grafana are private by default.

## Local or staging start

```bash
docker compose -f compose.prod.yml -f compose.observability.yml up -d prometheus grafana
```

For config validation:

```bash
docker compose -f compose.observability.yml config
```

Default ports bind to localhost only:

- Prometheus: `127.0.0.1:9090`
- Grafana: `127.0.0.1:3009`

Override with env only on a private network:

```bash
PROMETHEUS_PORT=127.0.0.1:9090
GRAFANA_PORT=127.0.0.1:3009
GRAFANA_ADMIN_PASSWORD=change-me
```

## Secrets

Do not commit real database, Redis, Grafana, S3 or token values.

Exporter connection strings can be passed through environment variables:

- `POSTGRES_EXPORTER_DATA_SOURCE_NAME`
- `REDIS_EXPORTER_ADDR`
- `PGBOUNCER_EXPORTER_CONNECTION_STRING`
- `GRAFANA_ADMIN_PASSWORD`

## Public access

`deploy/nginx/frendly.conf` blocks public `/metrics` on the API host.

Prometheus should scrape service metrics from the Docker network, not through `api.frendly.tech`.

## Dashboards

Dashboard JSON files live in `deploy/observability/grafana/dashboards/`.

Grafana provisions Prometheus and all Frendly dashboards automatically from:

- `deploy/observability/grafana/provisioning/datasources/prometheus.yml`
- `deploy/observability/grafana/provisioning/dashboards/frendly.yml`

Dashboards are mounted read-only from the repo. Edit JSON in the repo, then restart Grafana.
