import os
from PIL import Image, ImageDraw, ImageFont

def draw_audenic_logo(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background rounded rect
    margin = int(size * 0.05)
    rect = [margin, margin, size - margin, size - margin]
    radius = int(size * 0.22)
    
    # Dark gradient-like background
    draw.rounded_rectangle(rect, radius=radius, fill=(10, 10, 13, 255), outline=(200, 242, 73, 100), width=max(1, int(size * 0.02)))
    
    # Inner neon accent ring
    inner_margin = int(size * 0.1)
    inner_rect = [inner_margin, inner_margin, size - inner_margin, size - inner_margin]
    draw.rounded_rectangle(inner_rect, radius=int(radius * 0.8), fill=None, outline=(200, 242, 73, 40), width=max(1, int(size * 0.015)))
    
    # Draw musical note icon in neon lime
    accent_color = (200, 242, 73, 255)
    
    # Note head 1 (left)
    n1_x = int(size * 0.40)
    n1_y = int(size * 0.65)
    r1 = int(size * 0.12)
    draw.ellipse([n1_x - r1, n1_y - r1, n1_x + r1, n1_y + r1], fill=accent_color)
    
    # Note head 2 (right)
    n2_x = int(size * 0.68)
    n2_y = int(size * 0.55)
    r2 = int(size * 0.10)
    draw.ellipse([n2_x - r2, n2_y - r2, n2_x + r2, n2_y + r2], fill=accent_color)
    
    # Stems
    stem_w = max(2, int(size * 0.06))
    draw.rectangle([n1_x + r1 - stem_w, int(size * 0.25), n1_x + r1, n1_y], fill=accent_color)
    draw.rectangle([n2_x + r2 - stem_w, int(size * 0.20), n2_x + r2, n2_y], fill=accent_color)
    
    # Beam top
    draw.polygon([
        (n1_x + r1 - stem_w, int(size * 0.25)),
        (n2_x + r2, int(size * 0.20)),
        (n2_x + r2, int(size * 0.28)),
        (n1_x + r1 - stem_w, int(size * 0.33))
    ], fill=accent_color)
    
    return img

def main():
    base_dir = r"c:\Users\MWIJAY TECH\Desktop\PROJECTS\audenic music"
    res_dir = os.path.join(base_dir, "android", "app", "src", "main", "res")
    
    # Save web 512x512 logo
    logo512 = draw_audenic_logo(512)
    logo512.save(os.path.join(base_dir, "public", "icon.png"))
    logo512.save(os.path.join(base_dir, "public", "logo.png"))
    
    # Mipmap densities for Android
    densities = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192
    }
    
    for folder, size in densities.items():
        folder_path = os.path.join(res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        img = draw_audenic_logo(size)
        img.save(os.path.join(folder_path, "ic_launcher.png"))
        img.save(os.path.join(folder_path, "ic_launcher_round.png"))
        img.save(os.path.join(folder_path, "ic_launcher_foreground.png"))
    
    print("Audenic Android launcher icons generated successfully!")

if __name__ == "__main__":
    main()
