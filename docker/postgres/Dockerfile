FROM postgis/postgis:18-3.6

RUN apt-get update \
  && apt-get install --yes --no-install-recommends "postgresql-${PG_MAJOR}-pgvector" \
  && rm -rf /var/lib/apt/lists/* \
  && rm /docker-entrypoint-initdb.d/10_postgis.sh

COPY initdb/ /docker-entrypoint-initdb.d/
