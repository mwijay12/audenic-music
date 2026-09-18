import os
from PIL import Image, ImageDraw, ImageFilter

def draw_audenic_master_logo(size=1024):
    # Render at 2x for ultra smooth anti-aliasing
    render_size = size * 2
    img = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Margin & Dimensions
    margin = int(render_size * 0.06)
    rect = [margin, margin, render_size - margin, render_size - margin]
    radius = int(render_size * 0.22)
    
    # 1. Dark OLED Obsidian Background
    draw.rounded_rectangle(rect, radius=radius, fill=(10, 10, 14, 255))
    
    # 2. Subtle Outer Glow / Bezel (Neon Lime with alpha)
    border_w = max(2, int(render_size * 0.022))
    draw.rounded_rectangle(rect, radius=radius, outline=(200, 242, 73, 160), width=border_w)
    
    # 3. Inner Subtle Glass Ring
    inner_margin = int(render_size * 0.11)
    inner_rect = [inner_margin, inner_margin, render_size - inner_margin, render_size - inner_margin]
    inner_radius = int(radius * 0.78)
    draw.rounded_rectangle(inner_rect, radius=inner_radius, outline=(200, 242, 73, 50), width=max(1, int(render_size * 0.012)))
    
    # 4. Neon Lime Music Note & Waveform Geometry
    lime_color = (200, 242, 73, 255)
    
    # Left Note Head (angle slightly tilted up)
    n1_x = int(render_size * 0.38)
    n1_y = int(render_size * 0.67)
    r1 = int(render_size * 0.125)
    draw.ellipse([n1_x - r1, n1_y - r1, n1_x + r1, n1_y + r1], fill=lime_color)
    
    # Right Note Head
    n2_x = int(render_size * 0.68)
    n2_y = int(render_size * 0.55)
    r2 = int(render_size * 0.105)
    draw.ellipse([n2_x - r2, n2_y - r2, n2_x + r2, n2_y + r2], fill=lime_color)
    
    # Stems
    stem_w = max(4, int(render_size * 0.055))
    draw.rectangle([n1_x + r1 - stem_w, int(render_size * 0.24), n1_x + r1, n1_y], fill=lime_color)
    draw.rectangle([n2_x + r2 - stem_w, int(render_size * 0.18), n2_x + r2, n2_y], fill=lime_color)
    
    # Top Slanted Beam
    draw.polygon([
        (n1_x + r1 - stem_w, int(render_size * 0.24)),
        (n2_x + r2, int(render_size * 0.18)),
        (n2_x + r2, int(render_size * 0.27)),
        (n1_x + r1 - stem_w, int(render_size * 0.33))
    ], fill=lime_color)
    
    # Secondary Beam (double-beamed modern dynamic style)
    draw.polygon([
        (n1_x + r1 - stem_w, int(render_size * 0.37)),
        (n2_x + r2, int(render_size * 0.31)),
        (n2_x + r2, int(render_size * 0.37)),
        (n1_x + r1 - stem_w, int(render_size * 0.43))
    ], fill=lime_color)
    
    # Subtle acoustic pulse wave dots on the left
    for i, (dx, dy, dot_r) in enumerate([
        (int(render_size * 0.22), int(render_size * 0.50), int(render_size * 0.022)),
        (int(render_size * 0.18), int(render_size * 0.60), int(render_size * 0.016)),
        (int(render_size * 0.24), int(render_size * 0.70), int(render_size * 0.020))
    ]):
        draw.ellipse([dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r], fill=(200, 242, 73, 180))

    # Downscale smoothly to target size (LANCZOS antialiasing)
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

def main():
    base_dir = r"c:\Users\MWIJAY TECH\Desktop\PROJECTS\audenic music"
    
    # 1. Generate master image
    master = draw_audenic_master_logo(1024)
    
    # 2. Save public web & dist icons
    for p in [os.path.join(base_dir, "public"), os.path.join(base_dir, "dist")]:
        if os.path.exists(p):
            master.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(p, "icon.png"))
            master.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(p, "logo.png"))
    
    # 3. Save Tauri desktop icons in src-tauri/icons
    tauri_icons_dir = os.path.join(base_dir, "src-tauri", "icons")
    os.makedirs(tauri_icons_dir, exist_ok=True)
    
    tauri_sizes = {
        "32x32.png": 32,
        "128x128.png": 128,
        "128x128@2x.png": 256,
        "icon.png": 512,
        "Square30x30Logo.png": 30,
        "Square44x44Logo.png": 44,
        "Square71x71Logo.png": 71,
        "Square89x89Logo.png": 89,
        "Square107x107Logo.png": 107,
        "Square142x142Logo.png": 142,
        "Square150x150Logo.png": 150,
        "Square284x284Logo.png": 284,
        "Square310x310Logo.png": 310,
        "StoreLogo.png": 50,
    }
    
    for filename, sz in tauri_sizes.items():
        resized = master.resize((sz, sz), Image.Resampling.LANCZOS)
        resized.save(os.path.join(tauri_icons_dir, filename))
    
    # Generate multi-resolution .ico for Windows (Tauri desktop executable & titlebar)
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_images = [master.resize((s, s), Image.Resampling.LANCZOS) for s in ico_sizes]
    ico_path = os.path.join(tauri_icons_dir, "icon.ico")
    ico_images[0].save(ico_path, format="ICO", sizes=[(s, s) for s in ico_sizes], append_images=ico_images[1:])
    print(f"Generated Tauri multi-res ICO at: {ico_path}")

    # Also save app_icon.ico for Windows runner in audenic_flutter
    flutter_win_res = os.path.join(base_dir, "audenic_flutter", "windows", "runner", "resources")
    if os.path.exists(flutter_win_res):
        ico_images[0].save(os.path.join(flutter_win_res, "app_icon.ico"), format="ICO", sizes=[(s, s) for s in ico_sizes], append_images=ico_images[1:])
        print("Updated Flutter Windows app_icon.ico")
        
    # Also update Android launcher icons in audenic_flutter
    flutter_res_dir = os.path.join(base_dir, "audenic_flutter", "android", "app", "src", "main", "res")
    densities = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192
    }
    for folder, size in densities.items():
        folder_path = os.path.join(flutter_res_dir, folder)
        os.makedirs(folder_path, exist_ok=True)
        img = master.resize((size, size), Image.Resampling.LANCZOS)
        img.save(os.path.join(folder_path, "ic_launcher.png"))
        img.save(os.path.join(folder_path, "ic_launcher_round.png"))
        img.save(os.path.join(folder_path, "ic_launcher_foreground.png"))
        
    # Also update Capacitor android icons
    cap_res_dir = os.path.join(base_dir, "android", "app", "src", "main", "res")
    if os.path.exists(cap_res_dir):
        for folder, size in densities.items():
            folder_path = os.path.join(cap_res_dir, folder)
            os.makedirs(folder_path, exist_ok=True)
            img = master.resize((size, size), Image.Resampling.LANCZOS)
            img.save(os.path.join(folder_path, "ic_launcher.png"))
            img.save(os.path.join(folder_path, "ic_launcher_round.png"))
            img.save(os.path.join(folder_path, "ic_launcher_foreground.png"))
            
    print("ALL custom Audenic icons generated successfully across desktop & mobile targets!")

if __name__ == "__main__":
    main()
