#!/usr/bin/env python3
"""Rewrite a zip/apk with forward-slash entry names (aapt2 on Windows emits
backslashes for nested assets, which Android's asset manager cannot open),
optionally adding extra entries such as classes.dex.

Usage:
  python tools/fix_zip.py <in.apk> <out.apk> [--add path/to/classes.dex ...]
"""
import sys
import zipfile


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    src, dst = sys.argv[1], sys.argv[2]
    add = []
    args = sys.argv[3:]
    i = 0
    while i < len(args):
        if args[i] == '--add' and i + 1 < len(args):
            add.append(args[i + 1])
            i += 2
        else:
            i += 1

    total = 0
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w') as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            name = info.filename.replace('\\', '/')
            ni = zipfile.ZipInfo(name, date_time=info.date_time)
            ni.compress_type = info.compress_type
            ni.external_attr = info.external_attr
            ni.internal_attr = info.internal_attr
            ni.create_system = info.create_system
            zout.writestr(ni, data)
            total += 1
        for path in add:
            ni = zipfile.ZipInfo('classes.dex')
            ni.compress_type = zipfile.ZIP_DEFLATED
            ni.external_attr = 0o644 << 16
            ni.create_system = 3
            with open(path, 'rb') as f:
                zout.writestr(ni, f.read())
    print('fix_zip: wrote %s (%d entries + %d added)' % (dst, total, len(add)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
