#!/usr/bin/env python3
"""Pull an OCI/Docker image's filesystem into a directory, without a container runtime.

Phase 2 needs a Debian i386 rootfs to turn into an ext2 disk. The obvious route
is `docker export`, but the build machine has no Docker, Podman, or debootstrap,
and installing them needs root. A registry pull is just HTTPS plus tar, so this
script does it directly: token -> manifest -> layer blobs -> extract in order.

Run it under `fakeroot` (see build-ext2.sh) so file ownership from the layers is
preserved; mke2fs -d must read the tree inside the SAME fakeroot session or every
file lands owned by the build user instead of root.

Usage:
  pull-rootfs.py --image i386/debian:bookworm-slim --arch 386 --out rootfs/
"""
import argparse
import gzip
import io
import json
import os
import shutil
import sys
import tarfile
import urllib.request

AUTH = "https://auth.docker.io/token?service=registry.docker.io&scope=repository:{repo}:pull"
REGISTRY = "https://registry-1.docker.io/v2/{repo}"

ACCEPT = ", ".join([
    "application/vnd.docker.distribution.manifest.v2+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.oci.image.index.v1+json",
])


def get(url, token=None, accept=None, binary=False):
    request = urllib.request.Request(url)
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    if accept:
        request.add_header("Accept", accept)
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read()
    return data if binary else json.loads(data)


def resolve_manifest(repo, reference, token, arch, variant=None):
    """Follow a manifest list/index down to the single-platform manifest."""
    manifest = get(f"{REGISTRY.format(repo=repo)}/manifests/{reference}", token, ACCEPT)
    media = manifest.get("mediaType", "")
    if "list" in media or "index" in media or "manifests" in manifest:
        for entry in manifest.get("manifests", []):
            platform = entry.get("platform", {})
            if platform.get("os") != "linux":
                continue
            if platform.get("architecture") != arch:
                continue
            if variant and platform.get("variant") != variant:
                continue
            return resolve_manifest(repo, entry["digest"], token, arch, variant)
        available = [
            f"{e.get('platform', {}).get('os')}/{e.get('platform', {}).get('architecture')}"
            for e in manifest.get("manifests", [])
        ]
        raise SystemExit(f"no linux/{arch} manifest; image offers: {', '.join(available)}")
    return manifest


def safe_target(root, name):
    """Reject path traversal before writing anything."""
    target = os.path.realpath(os.path.join(root, name))
    if target != os.path.realpath(root) and not target.startswith(os.path.realpath(root) + os.sep):
        raise SystemExit(f"layer entry escapes the rootfs: {name}")
    return target


def apply_whiteouts(root, members):
    """Honour OCI whiteouts so deletions in later layers actually happen."""
    for member in members:
        base = os.path.basename(member.name)
        if not base.startswith(".wh."):
            continue
        directory = os.path.dirname(member.name)
        if base == ".wh..wh..opq":
            opaque = safe_target(root, directory)
            if os.path.isdir(opaque):
                for entry in os.listdir(opaque):
                    path = os.path.join(opaque, entry)
                    shutil.rmtree(path, ignore_errors=True) if os.path.isdir(path) and not os.path.islink(path) else os.remove(path)
        else:
            victim = safe_target(root, os.path.join(directory, base[len(".wh."):]))
            if os.path.isdir(victim) and not os.path.islink(victim):
                shutil.rmtree(victim, ignore_errors=True)
            elif os.path.lexists(victim):
                os.remove(victim)


def extract_layer(blob, root):
    stream = io.BytesIO(blob)
    if blob[:2] == b"\x1f\x8b":
        stream = io.BytesIO(gzip.decompress(blob))
    with tarfile.open(fileobj=stream, mode="r:") as archive:
        members = archive.getmembers()
        apply_whiteouts(root, members)
        keep = [m for m in members if not os.path.basename(m.name).startswith(".wh.")]
        for member in keep:
            safe_target(root, member.name)
        # fully_trusted keeps uid/gid/modes, which is the whole point: this tree
        # becomes a root filesystem. The traversal guard above is what makes it safe.
        if hasattr(tarfile, "fully_trusted_filter"):
            archive.extractall(root, members=keep, numeric_owner=True, filter="fully_trusted")
        else:
            archive.extractall(root, members=keep, numeric_owner=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", default="i386/debian:bookworm-slim")
    parser.add_argument("--arch", default="386", help="OCI architecture, e.g. 386, amd64")
    parser.add_argument("--variant", default=None)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    repo, _, tag = args.image.partition(":")
    tag = tag or "latest"
    if "/" not in repo:
        repo = f"library/{repo}"

    print(f"[pull] {repo}:{tag} (linux/{args.arch})", flush=True)
    token = get(AUTH.format(repo=repo))["token"]
    manifest = resolve_manifest(repo, tag, token, args.arch, args.variant)
    layers = manifest.get("layers", [])
    if not layers:
        raise SystemExit("manifest declares no layers")

    os.makedirs(args.out, exist_ok=True)
    total = 0
    for index, layer in enumerate(layers, 1):
        digest = layer["digest"]
        size = layer.get("size", 0)
        total += size
        print(f"[pull] layer {index}/{len(layers)} {digest[:19]} ({size/1e6:.1f} MB)", flush=True)
        blob = get(f"{REGISTRY.format(repo=repo)}/blobs/{digest}", token, binary=True)
        extract_layer(blob, args.out)

    print(f"[pull] extracted {len(layers)} layer(s), {total/1e6:.1f} MB compressed -> {args.out}")


if __name__ == "__main__":
    sys.exit(main())
