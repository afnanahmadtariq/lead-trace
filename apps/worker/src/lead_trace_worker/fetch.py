from __future__ import annotations

import ipaddress
import logging
import re
import socket
from html import unescape
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger('lead-trace.worker.fetch')

USER_AGENT = 'LeadTrace-Research/0.1 (+https://leadtrace.online)'
TRACKING = re.compile(r'\s+')
MAX_TEXT = 12_000
MAX_DOWNLOAD_BYTES = 1_000_000
MAX_REDIRECTS = 5
# Python 3.12.0 reports these as global, but they can translate to internal IPv4 targets.
NON_PUBLIC_IPV6 = tuple(ipaddress.ip_network(net) for net in ('64:ff9b::/96', '64:ff9b:1::/48', '::/96'))


class UnsafeSourceUrl(ValueError):
    pass


def _is_public_address(address) -> bool:
    if address.version == 6:
        if any(address in network for network in NON_PUBLIC_IPV6):
            return False
        embedded = address.ipv4_mapped or address.sixtofour
        if embedded is not None and not embedded.is_global:
            return False
    return address.is_global


def ensure_public_http_url(url: str) -> str:
    _public_addresses(url)
    return url


def _public_addresses(url: str) -> list:
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
        addresses = list(dict.fromkeys(ipaddress.ip_address(record[4][0]) for record in records))

    if not addresses or any(not _is_public_address(address) for address in addresses):
        raise UnsafeSourceUrl('source URL resolves to a non-public network address')
    return addresses


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
        trust_env=False,
    ) as client:
        current_url = url
        for redirect_count in range(MAX_REDIRECTS + 1):
            addresses = _public_addresses(current_url)
            # Connect to the address we validated so a second DNS lookup cannot rebind to an internal host.
            # IPv4 first: one pinned address replaces httpcore trying each one, and containers often lack IPv6.
            address = next((item for item in addresses if item.version == 4), addresses[0])
            target = httpx.URL(current_url)
            headers = {}
            extensions = {}
            if target.host != str(address):
                headers['Host'] = target.netloc.decode('ascii')
                if target.scheme == 'https':
                    extensions['sni_hostname'] = target.raw_host.decode('ascii')
            request_url = target.copy_with(host=str(address))
            with client.stream('GET', request_url, headers=headers, extensions=extensions) as response:
                if response.is_redirect:
                    location = response.headers.get('location')
                    if not location:
                        raise httpx.HTTPError('redirect response did not include a location')
                    if redirect_count == MAX_REDIRECTS:
                        raise httpx.TooManyRedirects('source exceeded the redirect limit', request=response.request)
                    # response.url holds the pinned IP; relative redirects must resolve against the hostname.
                    current_url = urljoin(current_url, location)
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


def fetch_page_text(url: str) -> str:
    try:
        return fetch_with_httpx(url)
    except Exception as error:
        log.warning('httpx fetch failed url=%s error=%s', url, error)
        return ''
