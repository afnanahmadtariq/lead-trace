import socket
import unittest
from unittest.mock import patch

import httpx

from lead_trace_worker.fetch import UnsafeSourceUrl, ensure_public_http_url, fetch_with_httpx


PUBLIC_DNS = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 443))]


class PublicSourceUrlTest(unittest.TestCase):
    def test_rejects_loopback_ip_without_dns_lookup(self):
        with self.assertRaises(UnsafeSourceUrl):
            ensure_public_http_url('http://127.0.0.1/internal')

    def test_rejects_localhost(self):
        with self.assertRaises(UnsafeSourceUrl):
            ensure_public_http_url('http://localhost/admin')

    def test_rejects_hostname_resolving_to_private_address(self):
        private_dns = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('10.0.0.8', 80))]
        with patch('socket.getaddrinfo', return_value=private_dns):
            with self.assertRaises(UnsafeSourceUrl):
                ensure_public_http_url('http://example.test/private')

    def test_accepts_hostname_resolving_only_to_public_addresses(self):
        with patch('socket.getaddrinfo', return_value=PUBLIC_DNS):
            self.assertEqual(
                ensure_public_http_url('https://example.test/article'),
                'https://example.test/article',
            )

    def test_revalidates_redirect_destinations(self):
        def handler(request):
            return httpx.Response(302, headers={'location': 'http://127.0.0.1/private'}, request=request)

        with patch('socket.getaddrinfo', return_value=PUBLIC_DNS):
            with self.assertRaises(UnsafeSourceUrl):
                fetch_with_httpx('https://example.test/start', transport=httpx.MockTransport(handler))

    def test_caps_download_before_extracting_text(self):
        def handler(request):
            return httpx.Response(
                200,
                headers={'content-type': 'text/plain; charset=utf-8'},
                content=b'a' * 1_100_000,
                request=request,
            )

        with patch('socket.getaddrinfo', return_value=PUBLIC_DNS):
            text = fetch_with_httpx('https://example.test/large', transport=httpx.MockTransport(handler))

        self.assertEqual(len(text), 12_000)

    def test_rejects_ipv6_forms_that_embed_internal_ipv4(self):
        for url in ('http://[64:ff9b::7f00:1]/', 'http://[2002:7f00:1::]/', 'http://[::ffff:127.0.0.1]/'):
            with self.subTest(url=url):
                with self.assertRaises(UnsafeSourceUrl):
                    ensure_public_http_url(url)

    def test_request_connects_to_validated_address_so_dns_rebinding_cannot_redirect_it(self):
        seen = []

        def handler(request):
            seen.append(request)
            return httpx.Response(200, headers={'content-type': 'text/plain'}, content=b'ok', request=request)

        rebinding_dns = [PUBLIC_DNS, [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 443))]]
        with patch('socket.getaddrinfo', side_effect=rebinding_dns) as resolver:
            text = fetch_with_httpx('https://example.test/article', transport=httpx.MockTransport(handler))

        self.assertEqual(text, 'ok')
        self.assertEqual(resolver.call_count, 1)
        self.assertEqual(seen[0].url.host, '93.184.216.34')
        self.assertEqual(seen[0].url.path, '/article')
        self.assertEqual(seen[0].headers['host'], 'example.test')
        self.assertEqual(seen[0].extensions['sni_hostname'], 'example.test')

    def test_relative_redirect_keeps_hostname_for_host_header_and_sni(self):
        seen = []

        def handler(request):
            seen.append(request)
            if request.url.path == '/start':
                return httpx.Response(302, headers={'location': '/next'}, request=request)
            return httpx.Response(200, headers={'content-type': 'text/plain'}, content=b'done', request=request)

        with patch('socket.getaddrinfo', return_value=PUBLIC_DNS) as resolver:
            text = fetch_with_httpx('https://example.test/start', transport=httpx.MockTransport(handler))

        self.assertEqual(text, 'done')
        self.assertEqual(resolver.call_count, 2)
        self.assertEqual(seen[1].url.path, '/next')
        self.assertEqual(seen[1].headers['host'], 'example.test')
        self.assertEqual(seen[1].extensions['sni_hostname'], 'example.test')

    def test_redirect_to_hostname_resolving_to_private_address_is_rejected(self):
        seen = []

        def handler(request):
            seen.append(request)
            return httpx.Response(302, headers={'location': 'http://internal.test/admin'}, request=request)

        def resolve(host, *_args, **_kwargs):
            if host == 'internal.test':
                return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('10.0.0.8', 80))]
            return PUBLIC_DNS

        with patch('socket.getaddrinfo', side_effect=resolve):
            with self.assertRaises(UnsafeSourceUrl):
                fetch_with_httpx('https://example.test/start', transport=httpx.MockTransport(handler))

        self.assertEqual(len(seen), 1)


if __name__ == '__main__':
    unittest.main()
