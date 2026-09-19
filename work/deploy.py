#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将 italian-vocal-site 部署到 GitHub Pages（SSH over 443）。
用法：
  git add remote origin 后执行：python deploy.py
前置：
  - 远程仓库 realrentao/italian-vocal-site 已创建且 Pages 指向 "/" 根目录
  - 本机 ~/.ssh/id_ed25519.pub 已注册到 GitHub（PAT 有 repo 权限即可）
  - remote 设为 ssh://git@ssh.github.com:443/realrentao/italian-vocal-site.git
分批提交+推送，避免 Windows 命令行超长 / 单次 commit 过大；可断点续跑。
"""
import os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REMOTE = "origin"
BRANCH = "main"
TARGET_MB = 25  # 每批约 25MB

def run(cmd, check=True):
    print("> " + " ".join(cmd) if isinstance(cmd, list) else "> " + cmd)
    r = subprocess.run(cmd, cwd=ROOT, shell=isinstance(cmd, str))
    if check and r.returncode != 0:
        print("!! 命令失败:", r.returncode); sys.exit(1)
    return r

def main():
    # 1. 状态
    run(["git", "status", "--porcelain"])
    # 2. 取待提交文件（含 untracked），按路径分批
    out = subprocess.run(["git", "status", "--porcelain", "-z"], cwd=ROOT,
                         capture_output=True, text=True)
    files = []
    for line in out.stdout.split("\0"):
        line = line.strip()
        if not line:
            continue
        st, path = line[:2], line[3:]
        # 只处理 M/A/??/A 类
        files.append(path)
    if not files:
        print("没有需要提交的内容。"); return
    # 3. 分批
    batch, sz = [], 0
    for f in files:
        fp = os.path.join(ROOT, f)
        try:
            sz += os.path.getsize(fp)
        except OSError:
            pass
        batch.append(f)
        if sz >= TARGET_MB * 1024 * 1024:
            commit_push(batch)
            batch, sz = [], 0
    if batch:
        commit_push(batch)
    print("部署完成。")

def commit_push(batch):
    with open(os.path.join(ROOT, "_paths.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(batch))
    run(["git", "add", "--pathspec-from-file=_paths.txt"])
    # 跳过空提交
    staged = subprocess.run(["git", "diff", "--cached", "--name-only"], cwd=ROOT,
                            capture_output=True, text=True).stdout.strip()
    if not staged:
        print("本批无变更，跳过。"); return
    run(["git", "commit", "-m", "deploy: 意大利语声乐属于与对话学习站"])
    run(["git", "push", REMOTE, BRANCH])

if __name__ == "__main__":
    main()
