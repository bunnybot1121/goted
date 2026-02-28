import os
import cv2
import numpy as np

os.makedirs('assets/avatars', exist_ok=True)

image = cv2.imread('gotared_alpha.png', cv2.IMREAD_UNCHANGED)
if image is None:
    print("Failed to load gotared_alpha.png")
    exit(1)

alpha = image[:, :, 3]

# Threshold alpha to be strictly binary
_, bin_alpha = cv2.threshold(alpha, 127, 255, cv2.THRESH_BINARY)

contours, _ = cv2.findContours(bin_alpha, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

min_area = 3000
bboxes = []
for cnt in contours:
    x, y, w, h = cv2.boundingRect(cnt)
    area = w * h
    if area > min_area:
        aspect_ratio = w / float(h)
        # Filter out wide title text at the very top
        if aspect_ratio < 3.0:
            bboxes.append((x, y, w, h))

print(f"Found {len(bboxes)} bounding boxes before sorting.")

bboxes.sort(key=lambda b: b[1])
rows = []
current_row = []
if bboxes:
    current_y = bboxes[0][1]
    for b in bboxes:
        if abs(b[1] - current_y) > 100:
            current_row.sort(key=lambda x: x[0])
            rows.append(current_row)
            current_row = [b]
            current_y = b[1]
        else:
            current_row.append(b)
    if current_row:
        current_row.sort(key=lambda x: x[0])
        rows.append(current_row)

    idx = 1
    for r_idx, r in enumerate(rows):
        print(f"Row {r_idx} has {len(r)} items")
        for (x, y, w, h) in r:
            crop = image[y:y+h, x:x+w].copy()
            
            # Remove label text at the bottom by cropping bottom 15%
            crop_h = int(h * 0.85)
            crop = crop[0:crop_h, :, :]
            print(f"  gotared_{idx}: cropped to {crop_h}/{h}")
            
            # Clean up any semi-transparent gray pixels (from checkered bg)
            a = crop[:, :, 3]
            # Make near-transparent pixels fully transparent
            crop[:, :, 3] = np.where(a < 30, 0, a)
            
            cv2.imwrite(f'assets/avatars/gotared_{idx}.png', crop)
            idx += 1
