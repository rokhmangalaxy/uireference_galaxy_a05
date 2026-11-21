"""Draws the PWA icons and the social preview card (pure stdlib PNG writer)."""
import math, struct, zlib

def write_png(path, w, h, pixels):
    raw = b"".join(b"\x00" + bytes(pixels[y * w * 4:(y + 1) * w * 4]) for y in range(h))
    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
    out = b"\x89PNG\r\n\x1a\n"
    out += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    out += chunk(b"IDAT", zlib.compress(raw, 9))
    out += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(out)

def galaxy(path, size, maskable=False):
    px = [0] * (size * size * 4)
    cx = cy = size / 2.0
    radius = size * (0.33 if maskable else 0.43)
    stars = [(0.18, 0.22), (0.80, 0.16), (0.12, 0.78), (0.86, 0.72), (0.50, 0.06), (0.62, 0.94)]
    for y in range(size):
        for x in range(size):
            i = (y * size + x) * 4
            t = y / size
            px[i] = int(11 + 18 * t)
            px[i + 1] = int(15 + 26 * t)
            px[i + 2] = int(20 + 38 * t)
            px[i + 3] = 255
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if d < radius:
                ang = math.atan2(dy, dx)
                ring = 0.62 + 0.10 * math.sin(ang * 3 + 1.2) + 0.06 * math.cos(ang * 7)
                if d < radius * ring * 0.42:
                    px[i], px[i + 1], px[i + 2] = 255, 204, 51
                elif d < radius * ring * 0.80:
                    k = d / radius
                    px[i] = int(120 + 90 * k)
                    px[i + 1] = int(60 + 60 * k)
                    px[i + 2] = int(140 + 80 * k)
                elif d < radius:
                    px[i], px[i + 1], px[i + 2] = 57, 211, 255
            for sx, sy in stars:
                if abs(x - sx * size) < max(1, size * 0.008) and abs(y - sy * size) < max(1, size * 0.008):
                    px[i], px[i + 1], px[i + 2], px[i + 3] = 231, 238, 247, 255
    write_png(path, size, size, px)

if __name__ == "__main__":
    galaxy("icons/icon-192.png", 192)
    galaxy("icons/icon-512.png", 512)
    galaxy("icons/icon-maskable-512.png", 512, maskable=True)
    print("icons written")
