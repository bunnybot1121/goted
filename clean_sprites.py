"""
Clean GoTared sprites:
1. Aggressively removes gray/checkered background artifacts
2. Adds a bold dark border around the character for a Neo-Brutalist look
"""
import os
import cv2
import numpy as np

avatars_dir = 'assets/avatars'

def clean_and_border(img_path):
    """Remove gray bg artifacts and add a bold outline border."""
    img = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f"  SKIP: {img_path}")
        return
    
    if img.shape[2] != 4:
        print(f"  SKIP (no alpha): {img_path}")
        return
    
    h, w = img.shape[:2]
    
    # --- Step 1: Aggressive background cleanup ---
    alpha = img[:, :, 3].copy()
    bgr = img[:, :, :3]
    
    # Calculate how "gray" each pixel is (low saturation = gray/white bg)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    
    # Gray pixels: low saturation AND semi-transparent
    # These are the checkered/gray bg artifacts
    gray_mask = (saturation < 30) & (alpha < 200) & (alpha > 0)
    alpha[gray_mask] = 0
    
    # Also kill very faint pixels (alpha < 80)
    alpha[alpha < 80] = 0
    
    # Make remaining pixels fully opaque for clean edges
    alpha[alpha >= 80] = 255
    
    img[:, :, 3] = alpha
    
    # --- Step 2: Auto-crop to content ---
    coords = cv2.findNonZero(alpha)
    if coords is None:
        print(f"  SKIP (empty): {img_path}")
        return
    
    x, y, cw, ch = cv2.boundingRect(coords)
    pad = 8
    x = max(0, x - pad)
    y = max(0, y - pad)
    cw = min(w - x, cw + pad * 2)
    ch = min(h - y, ch + pad * 2)
    img = img[y:y+ch, x:x+cw]
    alpha = img[:, :, 3]
    
    # --- Step 3: Add bold border around the character ---
    # Dilate the alpha mask to create an outline
    border_size = 3
    kernel = np.ones((border_size * 2 + 1, border_size * 2 + 1), np.uint8)
    dilated = cv2.dilate(alpha, kernel, iterations=1)
    
    # Border = dilated minus original alpha
    border_mask = (dilated > 127) & (alpha < 127)
    
    # Draw the border in dark color (near-black with full opacity)
    img[border_mask, 0] = 30   # B
    img[border_mask, 1] = 30   # G
    img[border_mask, 2] = 30   # R
    img[border_mask, 3] = 255  # A (fully opaque)
    
    cv2.imwrite(img_path, img)
    print(f"  OK: {img_path} ({img.shape[1]}x{img.shape[0]})")


# Process all gotared sprites
sprites = sorted([f for f in os.listdir(avatars_dir) if f.startswith('gotared_') and f.endswith('.png')])
print(f"Processing {len(sprites)} GoTared sprites...")
for fname in sprites:
    path = os.path.join(avatars_dir, fname)
    clean_and_border(path)

print("\nDone! Sprites cleaned + bordered.")
