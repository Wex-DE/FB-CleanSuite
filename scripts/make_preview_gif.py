import os
import sys
from PIL import Image

def create_preview_gif(duration_ms=1800):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    shot_dir = os.path.normpath(os.path.join(script_dir, '..', 'screenshot'))
    files = ['screenshot1.png', 'screenshot2.png', 'screenshot3.png']
    
    imgs = []
    for f in files:
        p = os.path.join(shot_dir, f)
        if os.path.exists(p):
            imgs.append(Image.open(p))

    if not imgs:
        print("No screenshots found in screenshot folder.")
        return

    # Standardize dimensions to crisp resolution
    target_size = (1560, 1040)
    resized = [im.resize(target_size, Image.Resampling.LANCZOS) for im in imgs]

    out_path = os.path.join(shot_dir, 'preview.gif')
    resized[0].save(
        out_path,
        save_all=True,
        append_images=resized[1:],
        duration=duration_ms,
        loop=0,
        optimize=True,
    )
    print(f"Successfully created {out_path} ({len(imgs)} frames, {duration_ms}ms duration, {os.path.getsize(out_path)} bytes)")

if __name__ == '__main__':
    duration = int(sys.argv[1]) if len(sys.argv) > 1 else 1800
    create_preview_gif(duration)
