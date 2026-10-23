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


if __name__ == '__main__':
    unittest.main()
