import logging
import os
import signal
import time

from lead_trace_worker.db import Worker

log = logging.getLogger('lead-trace.worker')


def configure_logging() -> None:
    level_name = os.environ.get('WORKER_LOG_LEVEL', 'INFO').upper()
    level = getattr(logging, level_name, None)
    if not isinstance(level, int):
        raise ValueError(f'Unsupported WORKER_LOG_LEVEL: {level_name}')
    logging.basicConfig(
        level=level,
        format='%(asctime)s %(levelname)s [%(name)s] %(message)s',
        force=True,
    )


def main() -> None:
    configure_logging()
    worker = Worker.from_env()
    idle = float(os.environ.get('WORKER_POLL_SECONDS', '3'))
    heartbeat = float(os.environ.get('WORKER_HEARTBEAT_SECONDS', '60'))
    last_heartbeat = time.monotonic()
    stop = False
    stop_reason = 'loop ended'

    def request_stop(signum, _frame) -> None:
        nonlocal stop, stop_reason
        stop = True
        stop_reason = signal.Signals(signum).name

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)
    log.info(
        'worker starting worker_id=%s poll_seconds=%s heartbeat_seconds=%s lock_interval=%s backoff_interval=%s',
        worker.worker_id,
        idle,
        heartbeat,
        worker.lock_for,
        worker.backoff_for,
    )

    try:
        worker.check_connection()
        log.info('worker ready worker_id=%s database=postgresql', worker.worker_id)
        while not stop:
            if not worker.poll_once():
                now = time.monotonic()
                if heartbeat > 0 and now - last_heartbeat >= heartbeat:
                    log.info('worker heartbeat worker_id=%s state=idle', worker.worker_id)
                    last_heartbeat = now
                time.sleep(idle)
            else:
                last_heartbeat = time.monotonic()
    except Exception:
        stop_reason = 'error'
        log.exception('worker stopped unexpectedly worker_id=%s', worker.worker_id)
        raise
    finally:
        log.info('worker stopped worker_id=%s reason=%s', worker.worker_id, stop_reason)


if __name__ == '__main__':
    main()
