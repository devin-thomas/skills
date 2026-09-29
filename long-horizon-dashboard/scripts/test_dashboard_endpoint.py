"""Offline tests; HTTP fixtures listen only on ephemeral loopback ports."""

from contextlib import contextmanager, redirect_stderr, redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import socket
import threading
import unittest
from unittest.mock import patch

import dashboard_endpoint as checks


TASK = "task-example"
UPDATED = "2026-09-29T19:00:00Z"
HTML = f'<!doctype html><html><head><meta name="dashboard-task-id" content="{TASK}"><meta name="dashboard-updated-at" content="{UPDATED}"></head><body>Dashboard</body></html>'


def routes():
    return {
        "/status.json": (200, "application/json", json.dumps({"task_id": TASK, "updated_at": UPDATED})),
        "/index.html": (200, "text/html; charset=utf-8", HTML),
    }


@contextmanager
def serve(responses):
    requested = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            requested.append(self.path)
            code, content_type, body = responses.get(self.path, (404, "text/plain", "Missing"))
            self.send_response(code)
            self.send_header("Content-Type", content_type)
            if 300 <= code < 400:
                self.send_header("Location", "/should-not-follow")
            self.end_headers()
            self.wfile.write(body.encode("utf-8"))

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", requested
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


class PortChecks(unittest.TestCase):
    def test_free_port(self):
        with socket.socket() as candidate:
            candidate.bind(("127.0.0.1", 0))
            port = candidate.getsockname()[1]
        checks.check_port(port)

    def test_occupied_port_does_not_stop_owner(self):
        with serve(routes()) as (url, _):
            port = int(url.rsplit(":", 1)[1])
            with self.assertRaises(checks.CheckError):
                checks.check_port(port)
            checks.verify_endpoint(url, TASK, UPDATED)

    def test_invalid_ports(self):
        for port in (-1, 0, 65536):
            with self.subTest(port=port), self.assertRaises(checks.CheckError):
                checks.check_port(port)

    def test_bind_failure_is_explicit(self):
        with patch.object(socket.socket, "bind", side_effect=OSError(13, "Permission denied")):
            with self.assertRaisesRegex(checks.CheckError, "cannot be bound"):
                checks.check_port(8765)

    def test_cli_failure_is_nonzero(self):
        output = io.StringIO()
        with redirect_stderr(output):
            self.assertEqual(checks.main(["port", "--port", "0"]), 1)
        self.assertIn("Dashboard check failed", output.getvalue())


class EndpointChecks(unittest.TestCase):
    def assert_bad_response(self, response_routes, pattern):
        with serve(response_routes) as (url, _):
            with self.assertRaisesRegex(checks.CheckError, pattern):
                checks.verify_endpoint(url, TASK, UPDATED)

    def test_identity_and_mount_path(self):
        mounted = {"/dash/example" + path: value for path, value in routes().items()}
        with serve(mounted) as (url, requested):
            checks.verify_endpoint(url + "/dash/example", TASK, UPDATED)
            self.assertEqual(requested, ["/dash/example/status.json", "/dash/example/index.html"])

    def test_cli_success(self):
        with serve(routes()) as (url, _), redirect_stdout(io.StringIO()) as output:
            self.assertEqual(checks.main(["verify", "--url", url, "--task-id", TASK, "--updated-at", UPDATED]), 0)
            self.assertIn("Verified", output.getvalue())

    def test_unrelated_http_200(self):
        responses = routes()
        responses["/status.json"] = (200, "application/json", '{"task_id":"someone-else"}')
        self.assert_bad_response(responses, "task_id does not match")

    def test_stale_or_missing_json_timestamp(self):
        for value in ({"task_id": TASK}, {"task_id": TASK, "updated_at": "old"}):
            responses = routes()
            responses["/status.json"] = (200, "application/json", json.dumps(value))
            self.assert_bad_response(responses, "updated_at does not match")

    def test_invalid_json(self):
        responses = routes()
        responses["/status.json"] = (200, "application/json", "not JSON")
        self.assert_bad_response(responses, "not valid JSON")

    def test_html_missing_wrong_and_duplicate_markers(self):
        for body in ("<html>Other server</html>", HTML.replace(TASK, "other"), HTML + f'<meta name="dashboard-task-id" content="{TASK}">'):
            responses = routes()
            responses["/index.html"] = (200, "text/html", body)
            self.assert_bad_response(responses, "dashboard-task-id")

    def test_stale_html(self):
        responses = routes()
        responses["/index.html"] = (200, "text/html", HTML.replace(UPDATED, "old"))
        self.assert_bad_response(responses, "dashboard-updated-at")

    def test_incorrect_content_types(self):
        for path in ("/index.html", "/status.json"):
            responses = routes()
            code, _, body = responses[path]
            responses[path] = (code, "text/plain", body)
            self.assert_bad_response(responses, "Content-Type")

    def test_redirects_are_not_followed(self):
        for path in ("/status.json", "/index.html"):
            responses = routes()
            responses[path] = (302, "text/plain", "redirect")
            with serve(responses) as (url, requested):
                with self.assertRaisesRegex(checks.CheckError, "redirects"):
                    checks.verify_endpoint(url, TASK, UPDATED)
                self.assertNotIn("/should-not-follow", requested)

    def test_invalid_urls(self):
        for url in ("file:///tmp/dashboard", "http://user:secret@localhost/", "http://localhost:bad/", "http://localhost:0/", "http://localhost/?token=secret", "http://localhost/#fragment", "http://local\nhost/", "http://[broken/"):
            with self.subTest(url=url), self.assertRaises(checks.CheckError):
                checks.base_url(url)

    def test_non_200(self):
        responses = routes()
        responses["/status.json"] = (503, "application/json", "{}")
        self.assert_bad_response(responses, "HTTP 503")

    def test_expected_values_and_timeout_are_required(self):
        for task, updated, timeout in (("", UPDATED, 5), (TASK, "", 5), (TASK, UPDATED, -1), (TASK, UPDATED, float("nan"))):
            with self.assertRaises(checks.CheckError):
                checks.verify_endpoint("http://127.0.0.1:1/", task, updated, timeout)


if __name__ == "__main__":
    unittest.main()
