#!/usr/bin/env python3
"""
Gitdata Ready-CLI (D14)
- Calls /ready on the overlay and exits:
  0 if ready:true
  1 if ready:false (recall, insufficient confirmations, etc.)
  2 on network/CLI errors

Supports:
- GET /ready?versionId=...
- If --policy-json or --policy-file is provided, tries POST /ready with JSON body; falls back to GET if POST returns 404.
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
import ssl
from typing import Optional, Tuple


def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


def colorize(s: str, color: Optional[str] = None) -> str:
    if not sys.stdout.isatty():
        return s
    codes = {
        "green": "\033[32m",
        "red": "\033[31m",
        "yellow": "\033[33m",
        "cyan": "\033[36m",
        "reset": "\033[0m",
    }
    if color and color in codes:
        return f"{codes[color]}{s}{codes['reset']}"
    return s


def http_json(method: str, url: str, body: Optional[dict], timeout: int, insecure: bool) -> Tuple[int, dict]:
    data = None
    headers = {
        "accept": "application/json",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["content-type"] = "application/json"

    ctx = None
    if insecure and url.lower().startswith("https"):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(url, data=data, method=method.upper(), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            status = resp.getcode()
            ct = resp.headers.get("content-type", "")
            if "application/json" not in ct:
                # Try to parse anyway
                raw = resp.read()
                try:
                    return status, json.loads(raw.decode("utf-8"))
                except Exception:
                    return status, {"raw": raw.decode("utf-8", errors="replace")}
            return status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as he:
        # Attempt to parse error body as JSON
        status = he.code
        try:
            raw = he.read().decode("utf-8")
            return status, json.loads(raw)
        except Exception:
            return status, {"error": "http-error", "message": str(he)}
    except Exception as e:
        raise RuntimeError(f"network-error: {e}")


def main():
    parser = argparse.ArgumentParser(description="Gitdata Ready-CLI (exit 0 if ready, 1 otherwise)")
    parser.add_argument("--host", required=False, default=os.environ.get("OVERLAY_URL", "http://localhost:8788"),
                        help="Overlay base URL (default: http://localhost:8788 or $OVERLAY_URL)")
    parser.add_argument("--versionId", required=True, help="Target versionId (64-hex)")
    parser.add_argument("--timeout", required=False, type=int, default=int(os.environ.get("READY_TIMEOUT_MS", "8000")),
                        help="HTTP timeout in ms (default: 8000 or $READY_TIMEOUT_MS)")
    parser.add_argument("--policy-json", required=False, help="Inline policy JSON string (POST /ready); falls back to GET if unsupported")
    parser.add_argument("--policy-file", required=False, help="Path to policy JSON file (POST /ready); falls back to GET if unsupported")
    parser.add_argument("--insecure", action="store_true", help="Allow insecure TLS (skip cert/hostname)")
    args = parser.parse_args()

    host = args.host.rstrip("/")
    version_id = args.versionId.strip().lower()
    if not isinstance(version_id, str) or len(version_id) != 64:
        eprint("versionId must be 64-hex")
        sys.exit(2)

    timeout_s = max(1, int(args.timeout) // 1000)

    # Load policy if provided
    policy = None
    if args.policy_json:
        try:
            policy = json.loads(args.policy_json)
        except Exception as e:
            eprint(f"invalid --policy-json: {e}")
            sys.exit(2)
    elif args.policy_file:
        try:
            with open(args.policy_file, "r", encoding="utf-8") as f:
                policy = json.load(f)
        except Exception as e:
            eprint(f"invalid --policy-file: {e}")
            sys.exit(2)

    # Prefer POST /ready when policy provided, else GET /ready
    try:
        if policy is not None:
            # Some overlays may expose POST /ready accepting { versionId, policy }
            url = f"{host}/ready"
            status, body = http_json("POST", url, {"versionId": version_id, "policy": policy}, timeout_s, args.insecure)
            if status == 404:
                # Fallback to GET
                status, body = http_json("GET", f"{host}/ready?versionId={version_id}", None, timeout_s, args.insecure)
        else:
            status, body = http_json("GET", f"{host}/ready?versionId={version_id}", None, timeout_s, args.insecure)
    except RuntimeError as e:
        eprint(colorize("NETWORK ERROR", "red"), str(e))
        sys.exit(2)

    # Expect { ready, reason?, confirmations? }
    ready = bool(body.get("ready")) if isinstance(body, dict) else False
    reason = body.get("reason") if isinstance(body, dict) else None
    confirmations = body.get("confirmations") if isinstance(body, dict) else None

    # Human output
    if ready:
        print(colorize("READY", "green"), f"versionId={version_id}", f"confirmations={confirmations if confirmations is not None else '-'}")
        sys.exit(0)
    else:
        print(colorize("NOT READY", "red"), f"versionId={version_id}", f"reason={reason}", f"confirmations={confirmations if confirmations is not None else '-'}")
        sys.exit(1)


if __name__ == "__main__":
    main()