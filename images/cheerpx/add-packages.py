#!/usr/bin/env python3
"""Install Debian packages into a rootfs directory without apt, chroot or root.

pull-rootfs.py can only flatten image layers — it cannot run a Dockerfile RUN
step — so the base image is bash and coreutils and nothing else. That makes the
CheerpX guest *less* capable than the v86 one, which defeats the point of the
provider.

A .deb needs none of that machinery to unpack: it is an `ar` archive whose
data member is a tar. So this resolves dependencies against the release's
Packages index, downloads the .debs, and untars their data members into the
rootfs.

WHAT THIS DOES NOT DO: run maintainer scripts. preinst/postinst never execute,
so anything that depends on them (users, services, generated caches,
alternatives symlinks, ca-certificates hashing) will be missing or inert. That
is fine for self-contained CLI tools and is why the package list stays close to
them. It is not a substitute for apt.

Run it under the same fakeroot session as mke2fs -d, or file ownership is lost.

Usage:
  add-packages.py --rootfs DIR [--suite bookworm] [--arch i386] git jq ripgrep
"""
import argparse
import gzip
import io
import os
import sys
import tarfile
import urllib.request

MIRROR = "http://deb.debian.org/debian"
AR_MAGIC = b"!<arch>\n"


def fetch(url):
    with urllib.request.urlopen(url, timeout=300) as response:
        return response.read()


# --- Packages index --------------------------------------------------------

def parse_index(raw):
    """Return (by_name, provided_by) from a Packages file."""
    by_name, provided_by = {}, {}
    for block in raw.decode("utf-8", "replace").split("\n\n"):
        if not block.strip():
            continue
        fields, key = {}, None
        for line in block.split("\n"):
            if line[:1] in (" ", "\t"):
                continue
            if ":" in line:
                key, _, value = line.partition(":")
                fields[key.strip()] = value.strip()
        name = fields.get("Package")
        if not name:
            continue
        by_name[name] = fields
        for virtual in split_list(fields.get("Provides", "")):
            provided_by.setdefault(strip_constraint(virtual), []).append(name)
    return by_name, provided_by


def split_list(value):
    return [item.strip() for item in value.split(",") if item.strip()]


def strip_constraint(atom):
    """"libc6 (>= 2.36)" -> "libc6"; also drops :any / architecture qualifiers."""
    return atom.split("(")[0].split(":")[0].strip()


def installed_packages(rootfs):
    """Packages already present in the base image, per dpkg's status file."""
    status = os.path.join(rootfs, "var/lib/dpkg/status")
    present = set()
    if not os.path.exists(status):
        return present
    with open(status, "r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            if line.startswith("Package:"):
                present.add(line.split(":", 1)[1].strip())
            elif line.startswith("Provides:"):
                for virtual in split_list(line.split(":", 1)[1]):
                    present.add(strip_constraint(virtual))
    return present


def resolve(wanted, by_name, provided_by, present):
    """Transitive Depends/Pre-Depends closure, skipping what the base image has."""
    selected, queue, missing = [], list(wanted), []
    seen = set()
    while queue:
        atom = strip_constraint(queue.pop(0))
        if not atom or atom in seen:
            continue
        seen.add(atom)
        if atom in present:
            continue

        fields = by_name.get(atom)
        if fields is None:
            # Virtual package: take the first real provider.
            providers = provided_by.get(atom) or []
            providers = [p for p in providers if p not in present]
            if not providers:
                if atom not in provided_by:
                    missing.append(atom)
                continue
            queue.append(providers[0])
            continue

        selected.append(fields)
        for relation in ("Pre-Depends", "Depends"):
            for dependency in split_list(fields.get(relation, "")):
                # "a | b" — take the first alternative, as apt would by default.
                queue.append(dependency.split("|")[0])
    return selected, missing


# --- .deb extraction -------------------------------------------------------

def ar_members(blob):
    """Yield (name, payload) from an ar archive. The format is 60-byte headers."""
    if not blob.startswith(AR_MAGIC):
        raise SystemExit("not an ar archive — is this really a .deb?")
    offset = len(AR_MAGIC)
    while offset + 60 <= len(blob):
        header = blob[offset:offset + 60]
        name = header[0:16].decode("ascii", "replace").strip().rstrip("/")
        try:
            size = int(header[48:58].decode("ascii").strip())
        except ValueError:
            break
        start = offset + 60
        yield name, blob[start:start + size]
        offset = start + size + (size % 2)  # members are padded to even


def extract_deb(blob, rootfs):
    for name, payload in ar_members(blob):
        if not name.startswith("data.tar"):
            continue
        if name.endswith(".zst"):
            raise SystemExit(
                "zstd-compressed .deb: Python's tarfile cannot read it. "
                "Debian 12 uses xz, so this suggests a non-Debian mirror."
            )
        mode = "r:xz" if name.endswith(".xz") else "r:gz" if name.endswith(".gz") else "r:*"
        with tarfile.open(fileobj=io.BytesIO(payload), mode=mode) as archive:
            members = []
            for member in archive.getmembers():
                target = os.path.realpath(os.path.join(rootfs, member.name.lstrip("./")))
                if target != os.path.realpath(rootfs) and not target.startswith(os.path.realpath(rootfs) + os.sep):
                    raise SystemExit(f"package entry escapes the rootfs: {member.name}")
                members.append(member)
            if hasattr(tarfile, "fully_trusted_filter"):
                archive.extractall(rootfs, members=members, numeric_owner=True, filter="fully_trusted")
            else:
                archive.extractall(rootfs, members=members, numeric_owner=True)
        return
    raise SystemExit("no data.tar member found in .deb")


def record_installed(rootfs, packages):
    """Append to dpkg's status so a second run does not reinstall these."""
    status = os.path.join(rootfs, "var/lib/dpkg/status")
    os.makedirs(os.path.dirname(status), exist_ok=True)
    with open(status, "a", encoding="utf-8") as handle:
        for fields in packages:
            handle.write(
                f"\nPackage: {fields['Package']}\n"
                f"Status: install ok unpacked\n"
                f"Architecture: {fields.get('Architecture', 'i386')}\n"
                f"Version: {fields.get('Version', '0')}\n"
                + (f"Provides: {fields['Provides']}\n" if fields.get("Provides") else "")
                + f"Description: {fields.get('Description', 'unpacked by add-packages.py')}\n"
            )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rootfs", required=True)
    parser.add_argument("--suite", default="bookworm")
    parser.add_argument("--arch", default="i386")
    parser.add_argument("--component", default="main")
    parser.add_argument("packages", nargs="+")
    args = parser.parse_args()

    index_url = f"{MIRROR}/dists/{args.suite}/{args.component}/binary-{args.arch}/Packages.gz"
    print(f"[pkg] index {index_url}", flush=True)
    by_name, provided_by = parse_index(gzip.decompress(fetch(index_url)))
    print(f"[pkg] {len(by_name)} packages in the index", flush=True)

    present = installed_packages(args.rootfs)
    print(f"[pkg] {len(present)} already in the base image", flush=True)

    selected, missing = resolve(args.packages, by_name, provided_by, present)
    if missing:
        raise SystemExit(f"[pkg] not found in the index: {', '.join(sorted(set(missing)))}")

    total = sum(int(fields.get("Size", 0)) for fields in selected)
    print(f"[pkg] resolving {len(args.packages)} requested -> {len(selected)} to unpack "
          f"({total / 1e6:.1f} MB compressed)", flush=True)

    for index, fields in enumerate(selected, 1):
        name = fields["Package"]
        url = f"{MIRROR}/{fields['Filename']}"
        print(f"[pkg] {index}/{len(selected)} {name} ({int(fields.get('Size', 0)) / 1e6:.1f} MB)", flush=True)
        extract_deb(fetch(url), args.rootfs)

    record_installed(args.rootfs, selected)
    print(f"[pkg] unpacked {len(selected)} package(s)")


if __name__ == "__main__":
    sys.exit(main())
