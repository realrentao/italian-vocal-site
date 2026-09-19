#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import subprocess, os, json, urllib.request, urllib.error

KEY_PATH = os.path.expanduser("~/.ssh/id_ed25519")
PUB = KEY_PATH + ".pub"
SSH_KEYGEN = r"C:/Users/迪丽希斯/.workbuddy/binaries/PortableGit/versions/1.2.0/bin/ssh-keygen.exe"
MCP = os.path.expanduser("~/.workbuddy/mcp.json")

cfg = json.load(open(MCP, encoding="utf-8"))
TOK = cfg["mcpServers"]["github"]["env"]["GITHUB_PERSONAL_ACCESS_TOKEN"]

def api(method, url, data=None):
    headers = {"Authorization": "token " + TOK, "Accept": "application/vnd.github+json", "User-Agent": "wb"}
    body = None
    if data is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        return r.status, r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")

# 1. ensure ssh key
if not os.path.exists(PUB):
    subprocess.run([SSH_KEYGEN, "-t", "ed25519", "-C", "realrentao", "-N", "", "-f", KEY_PATH, "-q"], check=True)
    print("generated ssh key at", KEY_PATH)
else:
    print("ssh key already exists")
pubkey = open(PUB, encoding="utf-8").read().strip()
print("pubkey len:", len(pubkey))

# 2. register key (idempotent)
st, body = api("GET", "https://api.github.com/user/keys")
existing = json.loads(body) if st == 200 else []
if any(k.get("key", "").strip() == pubkey for k in existing):
    print("ssh key already registered on GitHub")
else:
    st, body = api("POST", "https://api.github.com/user/keys", {"title": "workbuddy-italian-vocal", "key": pubkey})
    print("register key:", st, body[:200])

# 3. create repo
st, body = api("POST", "https://api.github.com/user/repos",
               {"name": "italian-vocal-site", "private": False,
                "description": "意大利语声乐术语与对话 · 互动学习站", "auto_init": False})
print("create repo:", st, body[:200])
