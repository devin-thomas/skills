#!/usr/bin/env python3
"""Read-only dashboard port and HTTP identity checks (standard library only)."""

import argparse
import errno
from html.parser import HTMLParser
from http.client import HTTPException
import json
import math
import socket
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


class CheckError(Exception):
    """An unavailable port or an endpoint that did not prove its identity."""


def check_port(port):
    if not 1 <= port <= 65535:
        raise CheckError("Port must be between 1 and 65535.")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            probe.bind(("127.0.0.1", port))
        except OSError as exc:
            if exc.errno == errno.EADDRINUSE:
                raise CheckError(f"Port {port} is occupied; leave its owner running and select another port.") from None
            raise CheckError(f"Port {port} cannot be bound on 127.0.0.1 (OS error {exc.errno}).") from None


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class DashboardMarkers(HTMLParser):
    def __init__(self):
        super().__init__()
        self.markers = {"dashboard-task-id": [], "dashboard-updated-at": []}

    def handle_starttag(self, tag, attrs):
        if tag == "meta":
            values = dict(attrs)
            name = values.get("name")
            if name in self.markers:
                self.markers[name].append(values.get("content"))


def base_url(url):
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        raise CheckError("URL has an invalid hostname or port.") from None
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise CheckError("URL must be an absolute http:// or https:// dashboard directory URL.")
    if parts.username is not None or parts.password is not None:
        raise CheckError("URL credentials are forbidden.")
    if parts.query or parts.fragment or any(ord(char) <= 32 for char in url):
        raise CheckError("URL must not contain a query, fragment, whitespace, or control characters.")
    if port is not None and not 1 <= port <= 65535:
        raise CheckError("URL port must be between 1 and 65535.")
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/") + "/", "", ""))


def read_endpoint(opener, url, media_type, label, timeout):
    request = Request(url, headers={"Accept": media_type, "Cache-Control": "no-cache"})
    try:
        with opener.open(request, timeout=timeout) as response:
            if response.status != 200:
                raise CheckError(f"{label} returned HTTP {response.status}; expected 200.")
            if response.headers.get_content_type() != media_type:
                raise CheckError(f"{label} has an unexpected Content-Type; expected {media_type}.")
            body = response.read(2 * 1024 * 1024 + 1)
    except HTTPError as exc:
        exc.close()
        raise CheckError(f"{label} returned HTTP {exc.code}; redirects and non-200 responses are refused.") from None
    except (URLError, TimeoutError, OSError, HTTPException):
        raise CheckError(f"{label} could not be retrieved; check the service, URL, TLS, and network.") from None
    if len(body) > 2 * 1024 * 1024:
        raise CheckError(f"{label} exceeds the 2 MiB verification limit.")
    try:
        return body.decode("utf-8")
    except UnicodeDecodeError:
        raise CheckError(f"{label} is not valid UTF-8.") from None


def verify_endpoint(url, task_id, updated_at, timeout=5):
    if not task_id or not updated_at:
        raise CheckError("Expected task_id and updated_at must be nonempty.")
    if not math.isfinite(timeout) or timeout <= 0:
        raise CheckError("Timeout must be finite and positive.")
    base = base_url(url)
    # Direct requests avoid routing a private dashboard through environment proxies.
    opener = build_opener(ProxyHandler({}), NoRedirect())
    raw_status = read_endpoint(opener, base + "status.json", "application/json", "status.json", timeout)
    try:
        status = json.loads(raw_status)
    except json.JSONDecodeError:
        raise CheckError("status.json is not valid JSON.") from None
    if not isinstance(status, dict) or status.get("task_id") != task_id:
        raise CheckError("status.json task_id does not match the expected dashboard.")
    if status.get("updated_at") != updated_at:
        raise CheckError("status.json updated_at does not match the expected revision; the dashboard may be stale.")
    html = read_endpoint(opener, base + "index.html", "text/html", "index.html", timeout)
    parser = DashboardMarkers()
    parser.feed(html)
    parser.close()
    if parser.markers["dashboard-task-id"] != [task_id]:
        raise CheckError("index.html must contain exactly one matching dashboard-task-id meta marker.")
    if parser.markers["dashboard-updated-at"] != [updated_at]:
        raise CheckError("index.html must contain exactly one matching dashboard-updated-at meta marker.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    port = commands.add_parser("port", help="Probe whether a loopback port can be bound; does not reserve it")
    port.add_argument("--port", type=int, required=True)
    verify = commands.add_parser("verify", help="Check status.json and index.html identity without following redirects")
    verify.add_argument("--url", required=True, help="Dashboard directory URL, including any Tailscale mount path")
    verify.add_argument("--task-id", required=True)
    verify.add_argument("--updated-at", required=True, help="Exact updated_at value from the intended local status.json")
    verify.add_argument("--timeout", type=float, default=5)
    args = parser.parse_args(argv)
    try:
        if args.command == "port":
            check_port(args.port)
            print(f"Port {args.port} is free on 127.0.0.1 now. This probe does not reserve it; startup can still race. Verify the endpoint after starting the server.")
        else:
            verify_endpoint(args.url, args.task_id, args.updated_at, args.timeout)
            print("Verified status.json and index.html match the expected task_id and updated_at.")
    except CheckError as exc:
        print(f"Dashboard check failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
