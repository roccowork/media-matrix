# 分镜总览图：把每镜的预览帧拼成一张图（3 列），顶部写标题。用法：python tools/storyboard_sheet.py 输出.jpg 标题 图1 图2 …
import sys
from PIL import Image, ImageDraw, ImageFont

out, title, files = sys.argv[1], sys.argv[2], sys.argv[3:]
cols, tw, th, pad, head = 3, 640, 360, 12, 70
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw + (cols + 1) * pad, head + rows * (th + pad) + pad), (12, 14, 20))
d = ImageDraw.Draw(sheet)
for fp in ('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'):
    try:
        font = ImageFont.truetype(fp, 34)
        break
    except OSError:
        font = ImageFont.load_default()
d.text((pad, 16), f'{title}（{len(files)} 镜）', font=font, fill=(255, 255, 255))
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB').resize((tw, th))
    x = pad + (i % cols) * (tw + pad)
    y = head + (i // cols) * (th + pad)
    sheet.paste(im, (x, y))
sheet.save(out, quality=88)
print('✓ 总览图', out)
