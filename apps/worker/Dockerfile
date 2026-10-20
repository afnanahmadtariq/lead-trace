FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml /app/pyproject.toml
COPY src /app/src
RUN pip install --no-cache-dir .
ENV PYTHONUNBUFFERED=1
CMD ["python", "-m", "lead_trace_worker"]
