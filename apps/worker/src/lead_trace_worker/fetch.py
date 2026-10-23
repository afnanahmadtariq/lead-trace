from __future__ import annotations

import asyncio
import ipaddress
import logging
import re
import socket
from html import unescape
from typing import Optional
from urllib.parse import quote, urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger('lead-trace.worker.fetch')

USER_AGENT = 'LeadTrace-Research/0.1 (+https://leadtrace.online)'
TRACKING = re.compile(r'\s+')
MAX_TEXT = 12_000
MAX_DOWNLOAD_BYTES = 1_000_000
MAX_REDIRECTS = 5
WIKI_API = 'https://en.wikipedia.org/w/api.php'
WRONG_TOPIC = ('fruit', 'plant', 'album', 'film', 'song', 'disambiguation')
BUSINESS_TOPIC = ('inc.', 'inc', 'company', 'corporation', 'technology', 'software', 'chief executive')


class UnsafeSourceUrl(ValueError):
    pass


def ensure_public_http_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname:
        raise UnsafeSourceUrl('source URL must use http or https and include a hostname')
    if parsed.username or parsed.password:
        raise UnsafeSourceUrl('source URL must not contain credentials')

    hostname = parsed.hostname.rstrip('.').lower()
    if hostname == 'localhost' or hostname.endswith('.localhost'):
        raise UnsafeSourceUrl('source URL resolves to localhost')

    try:
        addresses = [ipaddress.ip_address(hostname)]
    except ValueError:
        try:
            records = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == 'https' else 80), type=socket.SOCK_STREAM)
        except socket.gaierror as error:
            raise UnsafeSourceUrl('source hostname could not be resolved') from error
        addresses = list({ipaddress.ip_address(record[4][0]) for record in records})

    if not addresses or any(not address.is_global for address in addresses):
        raise UnsafeSourceUrl('source URL resolves to a non-public network address')
    return url


def strip_html(raw: str) -> str:
    soup = BeautifulSoup(raw, 'html.parser')
    for tag in soup(['script', 'style', 'noscript', 'svg', 'nav', 'footer', 'header']):
        tag.decompose()
    text = unescape(soup.get_text('\n', strip=True))
    return TRACKING.sub(' ', text).strip()


def fetch_with_httpx(url: str, timeout: float = 20.0, *, transport=None) -> str:
    with httpx.Client(
        follow_redirects=False,
        timeout=timeout,
        headers={'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'},
        transport=transport,
    ) as client:
        current_url = url
        for redirect_count in range(MAX_REDIRECTS + 1):
            ensure_public_http_url(current_url)
            with client.stream('GET', current_url) as response:
                if response.is_redirect:
                    location = response.headers.get('location')
                    if not location:
                        raise httpx.HTTPError('redirect response did not include a location')
                    if redirect_count == MAX_REDIRECTS:
                        raise httpx.TooManyRedirects('source exceeded the redirect limit', request=response.request)
                    current_url = urljoin(str(response.url), location)
                    continue

                response.raise_for_status()
                content_type = response.headers.get('content-type', '').lower()
                if content_type and not any(
                    allowed in content_type
                    for allowed in ('text/', 'application/json', 'application/xhtml+xml')
                ):
                    raise httpx.HTTPError(f'unsupported source content type: {content_type}')

                body = bytearray()
                for chunk in response.iter_bytes():
                    remaining = MAX_DOWNLOAD_BYTES - len(body)
                    if remaining <= 0:
                        break
                    body.extend(chunk[:remaining])
                text = bytes(body).decode(response.encoding or 'utf-8', errors='replace')
                if 'html' in content_type or '<html' in text[:500].lower():
                    return strip_html(text)[:MAX_TEXT]
                return text[:MAX_TEXT]
    return ''


async def fetch_with_crawl4ai(url: str) -> Optional[str]:
    ensure_public_http_url(url)
    try:
        from crawl4ai import AsyncWebCrawler
    except ImportError:
        log.debug('crawl4ai unavailable for %s', url)
        return None

    try:
        async with AsyncWebCrawler(verbose=False) as crawler:
            result = await crawler.arun(url=url)
            markdown = getattr(result, 'markdown', None) or getattr(result, 'markdown_v2', None)
            if isinstance(markdown, str) and markdown.strip():
                return markdown.strip()[:MAX_TEXT]
            cleaned = getattr(result, 'cleaned_html', None)
            if isinstance(cleaned, str) and cleaned.strip():
                return strip_html(cleaned)[:MAX_TEXT]
    except Exception as error:
        log.warning('crawl4ai fetch failed url=%s error=%s', url, error)
    return None


def fetch_page_text(url: str, *, prefer_crawl4ai: bool = False) -> str:
    if prefer_crawl4ai:
        try:
            crawled = asyncio.run(fetch_with_crawl4ai(url))
            if crawled:
                return crawled
        except RuntimeError:
            loop = asyncio.new_event_loop()
            try:
                crawled = loop.run_until_complete(fetch_with_crawl4ai(url))
                if crawled:
                    return crawled
            finally:
                loop.close()
    try:
        return fetch_with_httpx(url)
    except Exception as error:
        log.warning('httpx fetch failed url=%s error=%s', url, error)
        return ''


def _wiki_search(client: httpx.Client, term: str, limit: int = 5) -> list[dict]:
    response = client.get(
        WIKI_API,
        params={'action': 'query', 'list': 'search', 'srsearch': term, 'format': 'json', 'srlimit': limit},
    )
    response.raise_for_status()
    return response.json().get('query', {}).get('search', [])


def _score_wikipedia_hit(hit: dict, hints: tuple[str, ...], query: str) -> int:
    title = str(hit.get('title', '')).lower()
    snippet = re.sub(r'<[^>]+>', ' ', str(hit.get('snippet', ''))).lower()
    query_lower = query.strip().lower()
    if title == query_lower:
        return 100
    score = 0
    if any(token in title for token in BUSINESS_TOPIC):
        score += 4
    if any(token in snippet for token in BUSINESS_TOPIC):
        score += 2
    for hint in hints:
        token = hint.lower().strip()
        if len(token) >= 3 and (token in title or token in snippet):
            score += 3
    name_parts = [part for part in query_lower.split() if len(part) >= 3]
    if name_parts:
        if all(part in title for part in name_parts):
            score += 8
        elif any(part in title for part in name_parts):
            score += 4
        else:
            score -= 8
    if any(token in title for token in WRONG_TOPIC):
        score -= 6
    if any(token in snippet for token in ('edible fruit', 'apple tree', 'fruit tree', 'genus malus')):
        score -= 6
    return score


def _wiki_summary_by_title(client: httpx.Client, title: str) -> tuple[str, Optional[str]]:
    slug = quote(title.replace(' ', '_'), safe='/_')
    response = client.get(f'https://en.wikipedia.org/api/rest_v1/page/summary/{slug}')
    if response.status_code == 404:
        return '', None
    response.raise_for_status()
    payload = response.json()
    extract = str(payload.get('extract') or '').strip()
    page_url = payload.get('content_urls', {}).get('desktop', {}).get('page')
    return extract[:MAX_TEXT], page_url


def wikipedia_resolve(query: str, *, hints: tuple[str, ...] = ()) -> tuple[str, Optional[str], str]:
    cleaned = query.strip()
    if not cleaned:
        return '', None, ''
    searches = [cleaned]
    if ' ' not in cleaned:
        searches = [f'{cleaned} Inc.', cleaned]

    with httpx.Client(timeout=15.0, headers={'User-Agent': USER_AGENT}) as client:
        direct_extract, direct_url = _wiki_summary_by_title(client, cleaned.replace(' ', '_'))
        if direct_extract:
            return direct_extract, direct_url, cleaned

        best_hit: Optional[dict] = None
        best_score = -999
        for term in searches:
            for hit in _wiki_search(client, term):
                score = _score_wikipedia_hit(hit, hints, cleaned)
                if score > best_score:
                    best_score = score
                    best_hit = hit
        if best_hit and best_score > 0:
            title = str(best_hit['title'])
            extract, page_url = _wiki_summary_by_title(client, title)
            if extract:
                return extract, page_url, title
    return '', None, ''


def wikipedia_summary(title: str) -> tuple[str, Optional[str]]:
    extract, page_url, _ = wikipedia_resolve(title)
    return extract, page_url


def company_news_urls(company_name: str) -> list[str]:
    slug = re.sub(r'[^a-z0-9]', '', company_name.lower())
    if not slug:
        return []
    return [
        f'https://www.{slug}.com/newsroom/',
        f'https://{slug}.com/newsroom/',
        f'https://www.{slug}.com/leadership/',
    ]
