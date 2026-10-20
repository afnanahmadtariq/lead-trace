#!/bin/sh
set -eu

run_database_migrations() {
  npm run db:migrate --workspace=@lead-trace/db
}

case "${1:-serve}" in
  migrate)
    run_database_migrations
    ;;
  notify-waitlist-launch)
    shift
    exec node apps/api/dist/launch/send-waitlist-launch.js "$@"
    ;;
  serve)
    if [ "${API_RUN_DB_SETUP_ON_STARTUP:-true}" = "true" ]; then
      run_database_migrations
    fi
    exec node apps/api/dist/main.js
    ;;
  *)
    exec "$@"
    ;;
esac
