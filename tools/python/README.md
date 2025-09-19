# Gitdata Ready-CLI (Python)

Purpose
- CI/CD gate that returns exit 0 if a dataset version is ready (meets min confirmations and no blocking advisories), else exit 1.

Usage
- Default host is http://localhost:8788 (override with --host or $OVERLAY_URL)
- Timeout default 8000 ms (override with --timeout or $READY_TIMEOUT_MS)

Examples

1) Simple GET (/ready)
```bash
python3 tools/python/verify_ready.py --host http://localhost:8788 --versionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
echo $?  # 0 if ready, 1 otherwise
```

2) With a policy body (tries POST /ready, falls back to GET if unsupported)
```bash
python3 tools/python/verify_ready.py \
  --host http://localhost:8788 \
  --versionId aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
  --policy-json '{"minConfs":2,"allowWarn":true}'
```

3) In CI (GitHub Actions)
```yaml
- name: Ready gate
  run: |
    python3 tools/python/verify_ready.py --host ${{ env.OVERLAY_URL }} --versionId ${{ env.VERSION_ID }}
```

Exit codes
- 0 => ready:true
- 1 => ready:false (e.g., advisory-blocked, insufficient-confs, missing-envelope)
- 2 => CLI/network errors (invalid args, timeouts)

Notes
- The CLI expects the overlay to expose GET /ready?versionId=... as in D04. If you later add POST /ready with a policy body, the CLI will use it when --policy-json or --policy-file is provided.